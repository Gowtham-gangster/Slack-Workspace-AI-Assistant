import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest, signAccessToken, REFRESH_EXPIRY } from '../middleware/auth.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function recordLoginAttempt(username: string, ip: string, success: boolean) {
  try {
    await db.execute(
      'INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, ?)',
      [username, ip, success ? 1 : 0]
    );
  } catch (err) {
    console.error('Failed to record login attempt:', err);
  }
}

async function isLockedOut(username: string, ip: string): Promise<boolean> {
  // Lock if 5+ failed attempts in the last 15 minutes
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE username = ? AND ip_address = ? AND success = 0
     AND attempted_at >= ?`,
    [username, ip, windowStart]
  );
  return (result?.count || 0) >= 5;
}

async function createRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY * 1000);
  await db.execute(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
  return token;
}

async function writeAuditLog(userId: number | null, action: string, target: string | null, ip: string) {
  try {
    await db.execute(
      'INSERT INTO audit_logs (user_id, action, target, ip_address) VALUES (?, ?, ?, ?)',
      [userId, action, target, ip]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, fullName } = req.body;
  const ip = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Password complexity checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMinLength = password.length >= 8;

  if (!isMinLength || !hasUppercase || !hasLowercase || !hasSpecial) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }

  try {
    const salt = bcrypt.genSaltSync(12); // Increased from 10 to 12 rounds
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = await db.execute(
      'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)',
      [username, passwordHash, fullName || null]
    );

    await writeAuditLog(result.insertId, 'REGISTER', username, ip);

    res.status(201).json({
      message: 'User registered successfully.',
      userId: result.insertId
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('duplicate')) {
      res.status(400).json({ error: 'Username already exists.' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user.' });
    }
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Brute-force lockout check
  const locked = await isLockedOut(username, ip);
  if (locked) {
    return res.status(429).json({
      error: 'Too many failed login attempts. Please wait 15 minutes and try again.'
    });
  }

  try {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      await recordLoginAttempt(username, ip, false);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    await recordLoginAttempt(username, ip, true);
    await writeAuditLog(user.id, 'LOGIN', null, ip);

    const accessToken = signAccessToken({ id: user.id, username: user.username, fullName: user.full_name });
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});

// POST /api/auth/refresh — Exchange refresh token for new access token
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const ip = getClientIp(req);

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const stored = await db.queryOne<any>(
      `SELECT rt.*, u.username, u.full_name
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = ? AND rt.revoked = 0 AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (!stored) {
      return res.status(401).json({ error: 'Invalid or expired refresh token. Please log in again.' });
    }

    // Rotate refresh token (revoke old, issue new)
    await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refreshToken]);
    const newRefreshToken = await createRefreshToken(stored.user_id);
    const newAccessToken = signAccessToken({
      id: stored.user_id,
      username: stored.username,
      fullName: stored.full_name
    });

    await writeAuditLog(stored.user_id, 'TOKEN_REFRESH', null, ip);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: stored.user_id,
        username: stored.username,
        fullName: stored.full_name
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token.' });
  }
});

// POST /api/auth/logout — Revoke all refresh tokens for the user
router.post('/logout', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const ip = getClientIp(req);
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      // Revoke specific token
      await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refreshToken]);
    } else {
      // Revoke ALL refresh tokens for user (full logout from all devices)
      await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [req.user!.id]);
    }

    await writeAuditLog(req.user!.id, 'LOGOUT', null, ip);
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  const ip = getClientIp(req);

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!response.ok) {
      return res.status(400).json({ error: 'Invalid Google credential.' });
    }

    const payload: any = await response.json();
    const { email, name } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google.' });
    }

    let user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [email]);

    if (!user) {
      const salt = bcrypt.genSaltSync(12);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(randomPassword, salt);

      const result = await db.execute(
        'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)',
        [email, passwordHash, name || null]
      );

      user = {
        id: result.insertId,
        username: email,
        full_name: name || null
      };

      await writeAuditLog(result.insertId, 'REGISTER_GOOGLE', email, ip);
    } else {
      await writeAuditLog(user.id, 'LOGIN_GOOGLE', null, ip);
    }

    const accessToken = signAccessToken({ id: user.id, username: user.username, fullName: user.full_name });
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const { username, password, fullName } = req.body;
  const ip = getClientIp(req);

  if (!username) {
    return res.status(400).json({ error: 'Email Address is required.' });
  }

  try {
    const existingUser = await db.queryOne<any>(
      'SELECT * FROM users WHERE username = ? AND id != ?',
      [username, req.user.id]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Email Address is already taken.' });
    }

    if (password) {
      const salt = bcrypt.genSaltSync(12);
      const passwordHash = bcrypt.hashSync(password, salt);
      await db.execute(
        'UPDATE users SET username = ?, password_hash = ?, full_name = ? WHERE id = ?',
        [username, passwordHash, fullName || null, req.user.id]
      );
    } else {
      await db.execute(
        'UPDATE users SET username = ?, full_name = ? WHERE id = ?',
        [username, fullName || null, req.user.id]
      );
    }

    await writeAuditLog(req.user.id, 'PROFILE_UPDATE', username, ip);

    const newAccessToken = signAccessToken({ id: req.user.id, username, fullName: fullName || null });
    const newRefreshToken = await createRefreshToken(req.user.id);

    res.json({
      message: 'Profile updated successfully.',
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: req.user.id,
        username,
        fullName: fullName || null
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// DELETE /api/auth/account
router.delete('/account', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const ip = getClientIp(req);

  try {
    await writeAuditLog(req.user.id, 'ACCOUNT_DELETE', req.user.username, ip);
    await db.execute('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;

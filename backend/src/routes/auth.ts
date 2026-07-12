import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest, signAccessToken, REFRESH_EXPIRY, JWT_SECRET } from '../middleware/auth.js';
import { MCPClientManager } from '../services/mcpClient.js';

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
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);

  // Lock if 5+ failed attempts from the same IP for this username in 15 min
  const perIpResult = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE username = ? AND ip_address = ? AND success = 0
     AND attempted_at >= ?`,
    [username, ip, windowStart]
  );
  if ((perIpResult?.count || 0) >= 5) return true;

  // Also lock if 20+ failed attempts from ANY IP for this username in 15 min (distributed attack)
  const perUserResult = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE username = ? AND success = 0
     AND attempted_at >= ?`,
    [username, windowStart]
  );
  return (perUserResult?.count || 0) >= 20;
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
    const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 rounds
    const passwordHash = await bcrypt.hash(password, salt);

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
    const isMatch = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !isMatch) {
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

let googleCertsCache: Record<string, string> | null = null;
let googleCertsExpiry = 0;

async function getGoogleCert(kid: string): Promise<string | null> {
  const now = Date.now();
  if (!googleCertsCache || now > googleCertsExpiry) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v1/certs');
      if (res.ok) {
        googleCertsCache = (await res.json()) as Record<string, string>;
        // Cache for 6 hours
        googleCertsExpiry = now + 6 * 60 * 60 * 1000;
      }
    } catch (err) {
      console.error('Failed to fetch Google OAuth2 certs:', err);
    }
  }
  return googleCertsCache ? googleCertsCache[kid] || null : null;
}

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  const ip = getClientIp(req);

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  try {
    let payload: any = null;

    // 1. Try fast local JWT verification
    try {
      const decoded: any = jwt.decode(credential, { complete: true });
      if (decoded && decoded.header && decoded.header.kid) {
        const kid = decoded.header.kid;
        const cert = await getGoogleCert(kid);
        if (cert) {
          payload = jwt.verify(credential, cert, {
            algorithms: ['RS256'],
            audience: process.env.GOOGLE_CLIENT_ID || undefined,
            issuer: ['accounts.google.com', 'https://accounts.google.com']
          });
        }
      }
    } catch (err) {
      console.warn('Local Google JWT verification failed, falling back to HTTP tokeninfo:', err);
    }

    // 2. Fallback to HTTP tokeninfo if local verification did not resolve a payload
    if (!payload) {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!response.ok) {
        console.warn(`[Google Auth] HTTP tokeninfo verification failed with status: ${response.status}`);
        return res.status(400).json({ error: 'Invalid Google credential.' });
      }
      payload = await response.json();
    }

    const { email, name } = payload;

    // Verify the token was issued for THIS application (audience check)
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId && payload.aud !== googleClientId) {
      console.warn(`[Google Auth] Audience mismatch. Expected (GOOGLE_CLIENT_ID): "${googleClientId}" | Received in Token (payload.aud): "${payload.aud}"`);
      return res.status(400).json({ error: 'Invalid Google credential: audience mismatch.' });
    }

    if (!email) {
      console.warn('[Google Auth] Email was not provided by Google in token payload:', payload);
      return res.status(400).json({ error: 'Email not provided by Google.' });
    }

    let user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [email]);

    if (!user) {
      // Use asynchronous bcrypt hash with 10 rounds to avoid blocking event loop (80ms instead of 1200ms)
      const salt = await bcrypt.genSalt(10);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);

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

// GET /api/auth/slack — Start Slack OAuth 2.0 flow
router.get('/slack', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/slack/callback`;

    if (!clientId) {
      console.error('SLACK_CLIENT_ID is not configured in backend .env.');
      return res.status(500).json({ error: 'Slack Client ID is not configured on the server.' });
    }

    // Generate stateless signed CSRF state with JWT
    const statePayload = {
      userId,
      csrf: crypto.randomBytes(16).toString('hex'),
      exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes expiry
    };
    const state = jwt.sign(statePayload, JWT_SECRET);

    // Mandated Slack OAuth Bot Scopes
    const scopes = [
      'app_mentions:read',
      'channels:history',
      'channels:read',
      'chat:write',
      'chat:write.public',
      'files:read',
      'files:write',
      'groups:history',
      'groups:read',
      'im:history',
      'im:read',
      'mpim:history',
      'mpim:read',
      'reactions:read',
      'reactions:write',
      'team:read',
      'users:read',
      'users:read.email',
      'users.profile:read'
    ];

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?` + new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state: state
    }).toString();

    console.log(`Redirecting user ${userId} to Slack OAuth authorization page...`);
    res.redirect(slackAuthUrl);
  } catch (error) {
    console.error('Slack OAuth redirect error:', error);
    res.status(500).json({ error: 'Failed to initiate Slack authorization.' });
  }
});

// GET /api/auth/slack/callback — Slack OAuth redirect destination
router.get('/slack/callback', async (req: Request, res: Response) => {
  const { code, state, error: slackError } = req.query;
  const frontendSettingsUrl = process.env.FRONTEND_SETTINGS_URL || 'http://localhost:7505/settings';

  if (slackError) {
    console.error('Slack OAuth callback error parameter:', slackError);
    return res.redirect(`${frontendSettingsUrl}?error=${encodeURIComponent(String(slackError))}`);
  }

  if (!code || !state) {
    console.error('Slack OAuth callback missing code or state parameters.');
    return res.redirect(`${frontendSettingsUrl}?error=missing_parameters`);
  }

  let decodedState: any;
  try {
    decodedState = jwt.verify(String(state), JWT_SECRET);
  } catch (err) {
    console.error('Slack OAuth state validation failed (invalid, tempered, or expired JWT):', err);
    return res.redirect(`${frontendSettingsUrl}?error=invalid_state`);
  }

  const userId = decodedState.userId;
  if (!userId) {
    console.error('Slack OAuth state did not contain a valid userId.');
    return res.redirect(`${frontendSettingsUrl}?error=invalid_user`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/slack/callback`;

  if (!clientId || !clientSecret) {
    console.error('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is missing from backend configuration.');
    return res.redirect(`${frontendSettingsUrl}?error=server_configuration_missing`);
  }

  try {
    console.log(`Exchanging Slack OAuth authorization code for tokens (User: ${userId})...`);
    
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(`Slack API returned status ${tokenResponse.status} during token exchange.`);
    }

    const tokenData = await tokenResponse.json() as any;
    if (!tokenData.ok) {
      console.error('Slack OAuth token exchange returned error:', tokenData.error);
      return res.redirect(`${frontendSettingsUrl}?error=${encodeURIComponent(tokenData.error || 'token_exchange_failed')}`);
    }

    const botAccessToken = tokenData.access_token;
    const botUserId = tokenData.bot_user_id;
    const slackUserId = tokenData.authed_user?.id || '';
    const teamId = tokenData.team?.id || '';
    const teamName = tokenData.team?.name || '';
    const enterpriseId = tokenData.enterprise?.id || '';

    // Fetch team info to extract workspace icon
    let workspaceIcon = '';
    try {
      console.log(`Fetching team info to resolve workspace icon for Team ${teamId}...`);
      const teamInfoResponse = await fetch(`https://slack.com/api/team.info?team=${teamId}`, {
        headers: {
          'Authorization': `Bearer ${botAccessToken}`
        }
      });
      if (teamInfoResponse.ok) {
        const teamInfoData = await teamInfoResponse.json() as any;
        if (teamInfoData.ok && teamInfoData.team?.icon) {
          workspaceIcon = teamInfoData.team.icon.image_132 || 
                          teamInfoData.team.icon.image_88 || 
                          teamInfoData.team.icon.image_44 || 
                          teamInfoData.team.icon.image_default_original || '';
        }
      }
    } catch (teamInfoErr) {
      console.warn('Failed to fetch Slack workspace icon details:', teamInfoErr);
    }

    // Save tokens and workspace settings securely in database
    const settingsPayload = {
      mcp_slack_bot_token: botAccessToken,
      mcp_slack_team_id: teamId,
      slack_workspace_name: teamName,
      slack_workspace_icon: workspaceIcon,
      slack_bot_user_id: botUserId,
      slack_connected_user_id: slackUserId,
      slack_connected_at: new Date().toISOString(),
      slack_enterprise_id: enterpriseId
    };

    console.log(`Persisting Slack OAuth settings for User ${userId}...`);
    for (const [key, value] of Object.entries(settingsPayload)) {
      await db.execute(
        'INSERT INTO settings (user_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [userId, key, String(value), String(value)]
      );
    }

    console.log(`Slack Workspace ${teamName} (${teamId}) connected successfully for user ${userId}. Re-starting MCP Client...`);
    
    // Asynchronously spin up the MCP connection
    MCPClientManager.getInstance(userId).initializeClient().catch(err => {
      console.error(`Error initializing MCP Client post-OAuth for user ${userId}:`, err);
    });

    return res.redirect(`${frontendSettingsUrl}?status=connected`);
  } catch (error) {
    console.error('Internal error handling Slack OAuth callback:', error);
    return res.redirect(`${frontendSettingsUrl}?error=server_error`);
  }
});

// POST /api/auth/slack/disconnect — Terminate integration and clean configuration
router.post('/slack/disconnect', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const ip = getClientIp(req);

    console.log(`Disconnecting Slack integration for User ${userId}...`);

    const keysToClear = [
      'mcp_slack_bot_token',
      'mcp_slack_team_id',
      'slack_workspace_name',
      'slack_workspace_icon',
      'slack_bot_user_id',
      'slack_connected_user_id',
      'slack_connected_at',
      'slack_enterprise_id'
    ];

    for (const key of keysToClear) {
      await db.execute('DELETE FROM settings WHERE user_id = ? AND `key` = ?', [userId, key]);
    }

    await writeAuditLog(userId, 'SLACK_DISCONNECT', null, ip);

    // Re-initialize MCP Client asynchronously to clear the subprocess and active tokens
    MCPClientManager.getInstance(userId).initializeClient().catch(err => {
      console.error(`Failed to refresh/terminate MCP Client during disconnect for user ${userId}:`, err);
    });

    res.json({ message: 'Slack Workspace disconnected successfully.' });
  } catch (error) {
    console.error('Failed to disconnect Slack workspace:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack workspace.' });
  }
});

export default router;

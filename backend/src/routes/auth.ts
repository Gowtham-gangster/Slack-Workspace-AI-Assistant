import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest, signAccessToken, REFRESH_EXPIRY, JWT_SECRET } from '../middleware/auth.js';
import { MCPClientManager } from '../services/mcpClient.js';
import { sendNewLoginEmail, sendForgotPasswordEmail, sendAccountDeletionEmail } from '../services/emailService.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  try {
    await db.execute(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)',
      [email, ip, success ? 1 : 0]
    );
  } catch (err) {
    console.error('Failed to record login attempt:', err);
  }
}

async function isLockedOut(email: string, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);

  // Lock if 5+ failed attempts from the same IP for this email in 15 min
  const perIpResult = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE email = ? AND ip_address = ? AND success = 0
     AND attempted_at >= ?`,
    [email, ip, windowStart]
  );
  if ((perIpResult?.count || 0) >= 5) return true;

  // Also lock if 20+ failed attempts from ANY IP for this email in 15 min (distributed attack)
  const perUserResult = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE email = ? AND success = 0
     AND attempted_at >= ?`,
    [email, windowStart]
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
  const { email, password, fullName } = req.body;
  const ip = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
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
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email, passwordHash, fullName || null]
    );

    await writeAuditLog(result.insertId, 'REGISTER', email, ip);

    res.status(201).json({
      message: 'User registered successfully.',
      userId: result.insertId
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('duplicate')) {
      res.status(400).json({ error: 'Email Address already exists.' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user.' });
    }
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Brute-force lockout check
  const locked = await isLockedOut(email, ip);
  if (locked) {
    return res.status(429).json({
      error: 'Too many failed login attempts. Please wait 15 minutes and try again.'
    });
  }

  try {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    const isMatch = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !isMatch) {
      await recordLoginAttempt(email, ip, false);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await recordLoginAttempt(email, ip, true);
    await writeAuditLog(user.id, 'LOGIN', null, ip);

    const accessToken = signAccessToken({ id: user.id, email: user.email, fullName: user.full_name });
    const refreshToken = await createRefreshToken(user.id);

    // Send login notification email immediately in the background
    sendNewLoginEmail({
      toEmail: user.email,
      toName: user.full_name || user.email || 'User',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      loginTime: new Date()
    }).catch(err => {
      console.error('[Login] Failed to send login notification email:', err);
    });

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
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
      `SELECT rt.*, u.email, u.full_name
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
      email: stored.email,
      fullName: stored.full_name
    });

    await writeAuditLog(stored.user_id, 'TOKEN_REFRESH', null, ip);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: stored.user_id,
        email: stored.email,
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

    let user = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      // Use asynchronous bcrypt hash with 10 rounds to avoid blocking event loop (80ms instead of 1200ms)
      const salt = await bcrypt.genSalt(10);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const result = await db.execute(
        'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
        [email, passwordHash, name || null]
      );

      user = {
        id: result.insertId,
        email: email,
        full_name: name || null
      };

      await writeAuditLog(result.insertId, 'REGISTER_GOOGLE', email, ip);
    } else {
      await writeAuditLog(user.id, 'LOGIN_GOOGLE', null, ip);
    }

    const accessToken = signAccessToken({ id: user.id, email: user.email, fullName: user.full_name });
    const refreshToken = await createRefreshToken(user.id);

    // Send login notification email immediately in the background
    sendNewLoginEmail({
      toEmail: user.email,
      toName: user.full_name || user.email || 'User',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      loginTime: new Date()
    }).catch(err => {
      console.error('[Google Login] Failed to send login notification email:', err);
    });

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
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
  const { email, password, fullName } = req.body;
  const ip = getClientIp(req);

  if (!email) {
    return res.status(400).json({ error: 'Email Address is required.' });
  }

  try {
    const existingUser = await db.queryOne<any>(
      'SELECT * FROM users WHERE email = ? AND id != ?',
      [email, req.user.id]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Email Address is already taken.' });
    }

    if (password) {
      const salt = bcrypt.genSaltSync(12);
      const passwordHash = bcrypt.hashSync(password, salt);
      await db.execute(
        'UPDATE users SET email = ?, password_hash = ?, full_name = ? WHERE id = ?',
        [email, passwordHash, fullName || null, req.user.id]
      );
    } else {
      await db.execute(
        'UPDATE users SET email = ?, full_name = ? WHERE id = ?',
        [email, fullName || null, req.user.id]
      );
    }

    await writeAuditLog(req.user.id, 'PROFILE_UPDATE', email, ip);

    const newAccessToken = signAccessToken({ id: req.user.id, email, fullName: fullName || null });
    const newRefreshToken = await createRefreshToken(req.user.id);

    res.json({
      message: 'Profile updated successfully.',
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: req.user.id,
        email,
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
    const user = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (user) {
      // Send deletion email first before database record is removed
      await sendAccountDeletionEmail({
        toEmail: user.email,
        toName: user.full_name || user.email || 'User'
      });
    }

    await writeAuditLog(req.user.id, 'ACCOUNT_DELETE', req.user.email, ip);
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
  const frontendSettingsUrl = process.env.FRONTEND_SETTINGS_URL || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/settings` : 'https://slack-workspace-ai-assistant.vercel.app/settings');

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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  const ip = getClientIp(req);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      // Return a generic success message to prevent user enumeration
      return res.json({
        message: 'If a user with that email address exists, a password reset link has been sent.'
      });
    }

    // Generate valid reset token before sending
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, user.id]
    );

    await writeAuditLog(user.id, 'FORGOT_PASSWORD_REQUEST', email, ip);

    // Call email service
    await sendForgotPasswordEmail({
      toEmail: user.email,
      toName: user.full_name || user.email || 'User',
      resetToken
    });

    res.json({
      message: 'If a user with that email address exists, a password reset link has been sent.'
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const ip = getClientIp(req);

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  // Password complexity checks
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isMinLength = newPassword.length >= 8;

  if (!isMinLength || !hasUppercase || !hasLowercase || !hasSpecial) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.'
    });
  }

  try {
    const user = await db.queryOne<any>(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?',
      [token, new Date()]
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.execute(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    await writeAuditLog(user.id, 'PASSWORD_RESET_SUCCESS', user.email, ip);

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

export default router;

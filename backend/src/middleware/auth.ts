import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'slack-ai-assistant-secret-key-change-this-in-production';
export const JWT_EXPIRY = '15m';   // Short-lived access token
export const REFRESH_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName?: string;
  };
}

/**
 * Authenticate a JWT access token.
 * Returns 401 if missing, 403 if invalid/expired.
 */
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization header format. Use: Bearer <token>' });
  }

  const token = parts[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Access token expired.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(403).json({ error: 'Invalid token.' });
    }

    req.user = decoded as { id: number; username: string; fullName?: string };
    next();
  });
}

/**
 * Sign a new short-lived access token (15 minutes).
 */
export function signAccessToken(payload: { id: number; username: string; fullName?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'slack-ai-assistant-secret-key-12345';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName?: string;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Authorization: Bearer <token>

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
      }

      req.user = user as { id: number; username: string; fullName?: string };
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }
}

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'slack-ai-assistant-secret-key-12345';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, fullName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Password complexity checks: minimum length 8, contains uppercase, lowercase, and special characters
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
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = await db.execute(`
      INSERT INTO users (username, password_hash, full_name)
      VALUES (?, ?, ?)
    `, [username, passwordHash, fullName || null]);

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
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
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

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body;

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

    // Check if the user exists mapped by email
    let user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [email]);

    if (!user) {
      // Create user if not exists
      const salt = bcrypt.genSaltSync(10);
      const randomPassword = Math.random().toString(36) + Math.random().toString(36);
      const passwordHash = bcrypt.hashSync(randomPassword, salt);
      
      const result = await db.execute(`
        INSERT INTO users (username, password_hash, full_name)
        VALUES (?, ?, ?)
      `, [email, passwordHash, name || null]);
      
      user = {
        id: result.insertId,
        username: email,
        full_name: name || null
      };
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
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
  if (!username) {
    return res.status(400).json({ error: 'Email Address is required.' });
  }

  try {
    // Check for duplicate username (email)
    const existingUser = await db.queryOne<any>(
      'SELECT * FROM users WHERE username = ? AND id != ?',
      [username, req.user.id]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Email Address is already taken.' });
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
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

    const token = jwt.sign(
      { id: req.user.id, username, fullName: fullName || null },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Profile updated successfully.',
      token,
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

  try {
    // Delete the user from users
    await db.execute('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;



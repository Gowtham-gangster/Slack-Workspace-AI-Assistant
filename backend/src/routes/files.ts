import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authenticateJWT, AuthenticatedRequest, JWT_SECRET } from '../middleware/auth.js';
import { FileService } from '../services/fileService.js';
import { Readable } from 'stream';
import multer from 'multer';
import { db } from '../db/index.js';
import jwt from 'jsonwebtoken';

const router = Router();
const fileService = FileService.getInstance();

// Configure multer for file uploads with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Custom authentication middleware for files that accepts token in query or auth header, ignoring token expiration
function authenticateFileJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization header format. Use: Bearer <token>' });
    }
    token = parts[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization header with Bearer token or token query parameter is required.' });
  }

  jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token.' });
    }

    req.user = decoded as { id: number; username: string; fullName?: string };
    next();
  });
}

// GET /api/files/:fileId - Stream download/preview private Slack files with authentication, Range support & caching
router.get('/:fileId', authenticateFileJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { fileId } = req.params;
  const urlParam = req.query.url as string;
  const filenameParam = req.query.filename as string;

  console.log(`[FileProxy Route] Request received for file: ${fileId}`);

  try {
    const userId = req.user!.id;
    const rangeHeader = req.headers.range;

    // 1. Delegate to FileService to resolve and fetch the file stream
    const { status, headers, stream } = await fileService.getFileStream(
      userId,
      fileId,
      rangeHeader,
      urlParam,
      filenameParam
    );

    // 2. Set response status and headers
    res.status(status);
    Object.entries(headers).forEach(([key, val]) => {
      res.setHeader(key, val);
    });

    // Content Disposition
    const forceDownload = req.query.download === 'true';
    const name = headers['X-File-Name'] || 'download';
    res.removeHeader('X-File-Name'); // Clean up internal helper header

    if (forceDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    }

    // Override security headers to allow inline preview within iframe/img tags
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // 3. Stream binary download response directly to client
    if (stream) {
      Readable.fromWeb(stream as any).pipe(res);
      console.log(`[FileProxy Route] Successfully streaming file ${fileId} to client`);
    } else {
      console.error(`[FileProxy Route] No response body stream found for file ${fileId}`);
      res.status(500).json({ error: 'No response body stream found from Slack CDN.' });
    }
  } catch (error: any) {
    // If the thrown error is a Slack fetch response that failed
    if (error instanceof Response) {
      const responseBody = await error.text();
      console.error(`[FileProxy Route] Failed to download file from Slack CDN for ${fileId}:`);
      console.error(`  - Slack response status: ${error.status}`);
      console.error(`  - Slack response body: ${responseBody}`);
      console.error(`  - Response headers: ${JSON.stringify([...error.headers.entries()])}`);
      return res.status(error.status).json({
        error: `Failed to download file from Slack CDN`,
        slackStatus: error.status,
        slackBody: responseBody
      });
    }

    // Standard backend exception logging
    console.error(`[FileProxy Route] Backend exception for file ${fileId}:`, error);
    res.status(500).json({ error: error?.message || 'Failed to stream file.' });
  }
});

// POST /api/files/upload - Upload file to Slack and save metadata
router.post('/upload', authenticateJWT, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.user!.id;
    const file = req.file;
    const channelId = req.body.channelId || '';
    const messageText = req.body.messageText || '';

    console.log(`[FileUpload] User ${userId} uploading: ${file.originalname} (${file.size} bytes)`);

    // Upload to Slack S3
    const uploadResult = await fileService.uploadFileDirect(
      userId,
      file.originalname,
      file.size,
      file.mimetype,
      file.buffer
    );

    if (!uploadResult.ok) {
      throw new Error('File upload to Slack failed');
    }

    // Complete upload with Slack to get file metadata
    const tokenRow = await db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE user_id = ? AND `key` = ?',
      [userId, 'mcp_slack_bot_token']
    );
    const token = tokenRow?.value;

    if (!token) {
      throw new Error('Slack token not configured');
    }

    // Complete the upload
    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{
          id: uploadResult.fileId,
          title: file.originalname
        }],
        channel_id: channelId || undefined,
        initial_comment: messageText || undefined
      })
    });

    const completeData = await completeResponse.json() as any;

    if (!completeData.ok) {
      console.error('[FileUpload] Complete upload failed:', completeData.error);
      throw new Error(`Complete upload failed: ${completeData.error}`);
    }

    const uploadedFile = completeData.files?.[0];
    
    if (uploadedFile) {
      // Save file metadata to database
      await fileService.saveFileMetadata(uploadedFile);
    }

    console.log(`[FileUpload] Successfully uploaded file ${uploadResult.fileId}`);

    res.json({
      success: true,
      fileId: uploadResult.fileId,
      file: uploadedFile || {
        id: uploadResult.fileId,
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }
    });

  } catch (error: any) {
    console.error('[FileUpload] Error:', error);
    res.status(500).json({ error: error?.message || 'File upload failed' });
  }
});

export default router;

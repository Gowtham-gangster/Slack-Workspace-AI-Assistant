import { Router, Request, Response } from 'express';
import { getEmailHealthStatus, verifyTransporter, sendTestEmail } from '../services/emailService.js';

const router = Router();

// GET /api/system/email-health
router.get('/email-health', async (req: Request, res: Response) => {
  try {
    const verifyResult = await verifyTransporter();
    const health = await getEmailHealthStatus();
    
    const host = process.env.SMTP_HOST || null;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
    const secure = port === 465;

    res.json({
      configured: health.configured,
      verified: verifyResult.success,
      provider: health.provider,
      host: host,
      port: port,
      secure: secure,
      error: verifyResult.error
    });
  } catch (error: any) {
    res.status(500).json({
      configured: false,
      verified: false,
      error: error?.message || String(error)
    });
  }
});

// POST /api/system/test-email
router.post('/test-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email field is required.' });
  }

  try {
    const result = await sendTestEmail(email);
    if (result.success) {
      return res.json({ success: true, message: 'Success', messageId: result.messageId });
    } else {
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { sendTestEmail } from '../services/emailService.js';

const router = Router();

// POST /api/email/test
router.post('/test', async (req: Request, res: Response) => {
  const to = req.body?.to || req.query?.to;

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'A valid recipient email address is required in the "to" parameter.'
    });
  }

  try {
    const result = await sendTestEmail(to);
    if (result.success) {
      return res.json({
        success: true,
        message: `Test email sent successfully to ${to}.`,
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test email due to an unknown provider error.'
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err)
    });
  }
});

export default router;

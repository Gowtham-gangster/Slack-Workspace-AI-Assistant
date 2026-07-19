import { Router, Request, Response } from 'express';
import { getEmailHealthStatus, getOrCreateTransporter, sendTestEmail } from '../services/emailService.js';

const router = Router();

// GET /api/system/email-test
router.get('/email-test', async (req: Request, res: Response) => {
  try {
    const transporterInstance = await getOrCreateTransporter();
    if (!transporterInstance) {
      return res.status(500).json({
        success: false,
        message: 'Transporter is not initialized due to configuration errors.'
      });
    }

    await transporterInstance.verify();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      code: err?.code || 'N/A',
      message: err?.message || String(err),
      response: err?.response || 'N/A',
      command: err?.command || 'N/A'
    });
  }
});

// GET /api/system/email-health
router.get('/email-health', async (req: Request, res: Response) => {
  try {
    const health = await getEmailHealthStatus();
    res.json({
      'SMTP configured': health.configured,
      'SMTP verified': health.verified,
      'Last successful email': health.lastSuccessfulEmail ? health.lastSuccessfulEmail.toISOString() : null,
      'Last failed email': health.lastFailedEmail ? health.lastFailedEmail.toISOString() : null,
      'Failure reason': health.failureReason
    });
  } catch (error: any) {
    res.status(500).json({
      'SMTP configured': false,
      'SMTP verified': false,
      'Last successful email': null,
      'Last failed email': null,
      'Failure reason': error?.message || String(error)
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

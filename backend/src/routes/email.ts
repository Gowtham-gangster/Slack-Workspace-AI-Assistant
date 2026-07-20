import { Router, Request, Response } from 'express';
import { sendTestEmail, sendSupportContactEmail } from '../services/emailService.js';

const router = Router();

// POST /api/email/contact
router.post('/contact', async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ success: false, error: 'Subject is required.' });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message body is required.' });
  }

  try {
    const result = await sendSupportContactEmail({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim()
    });

    if (result.success) {
      return res.json({
        success: true,
        message: 'Your support request has been submitted successfully.'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to deliver support email to support team.'
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err)
    });
  }
});

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

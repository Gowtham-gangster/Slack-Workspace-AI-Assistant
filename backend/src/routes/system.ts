import { Router, Request, Response } from 'express';
import dns from 'dns';
import { 
  getEmailHealthStatus, 
  getActiveProvider, 
  sendTestEmail, 
  testTcpConnection 
} from '../services/emailService.js';

const router = Router();

// Helper to resolve DNS addresses
function resolveDns(hostname: string, family: 4 | 6): Promise<string[]> {
  return new Promise((resolve) => {
    dns.resolve(hostname, family === 4 ? 'A' : 'AAAA', (err, addresses) => {
      if (err) {
        resolve([]);
      } else {
        resolve(addresses);
      }
    });
  });
}

// GET /api/system/network-test (Step 3)
router.get('/network-test', async (req: Request, res: Response) => {
  try {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    
    // DNS resolution
    const ipv4 = await resolveDns(host, 4);
    const ipv6 = await resolveDns(host, 6);
    const dnsResolution = ipv4.length > 0 || ipv6.length > 0 ? 'SUCCESS' : 'FAILED';

    // TCP connectivity checks
    const tcp465 = await testTcpConnection(host, 465, 5000);
    const tcp587 = await testTcpConnection(host, 587, 5000);

    // Provider verification
    const provider = getActiveProvider();
    const verifyResult = await provider.verify();

    res.json({
      'DNS Resolution': dnsResolution,
      'IPv4': ipv4,
      'IPv6': ipv6,
      'TCP 465': tcp465.status,
      'TCP 587': tcp587.status,
      'SMTP Verify': verifyResult.success ? 'SUCCESS' : `FAILED: ${verifyResult.error || 'Unknown error'}`
    });
  } catch (error: any) {
    res.status(500).json({
      'DNS Resolution': 'FAILED',
      'IPv4': [],
      'IPv6': [],
      'TCP 465': 'ERROR',
      'TCP 587': 'ERROR',
      'SMTP Verify': `ERROR: ${error?.message || String(error)}`
    });
  }
});

// GET /api/system/email-test
router.get('/email-test', async (req: Request, res: Response) => {
  try {
    const provider = getActiveProvider();
    const verifyResult = await provider.verify();
    if (verifyResult.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({
        success: false,
        message: verifyResult.error || 'Verification failed.'
      });
    }
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

import nodemailer from 'nodemailer';
import dns from 'dns';
import net from 'net';

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Email Provider Interface (Step 7) ───────────────────────────────────────
export interface EmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  emailType: string;
}

export interface EmailProvider {
  name: string;
  send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
  verify(): Promise<{ success: boolean; error: string | null }>;
}

// ─── Email Health Monitoring State ───────────────────────────────────────────
let lastSuccessfulEmail: Date | null = null;
let lastFailedEmail: Date | null = null;
let lastFailureReason: string | null = null;
let isVerified = false;
let lastVerificationError: string | null = null;

// ─── Environment Variables Validation ──────────────────────────────────────────

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://slack-workspace-ai-assistant.vercel.app';
}

function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  
  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const errors: string[] = [];
    if (!apiKey) errors.push('RESEND_API_KEY is missing');
    if (!from) errors.push('EMAIL_FROM is missing');
    return { provider: 'resend' as const, apiKey, from, errors };
  } else if (provider === 'brevo') {
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const errors: string[] = [];
    if (!apiKey) errors.push('BREVO_API_KEY is missing');
    if (!from) errors.push('EMAIL_FROM is missing');
    return { provider: 'brevo' as const, apiKey, from, errors };
  } else if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const errors: string[] = [];
    if (!apiKey) errors.push('SENDGRID_API_KEY is missing');
    if (!from) errors.push('EMAIL_FROM is missing');
    return { provider: 'sendgrid' as const, apiKey, from, errors };
  } else if (provider === 'mailgun') {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const errors: string[] = [];
    if (!apiKey) errors.push('MAILGUN_API_KEY is missing');
    if (!domain) errors.push('MAILGUN_DOMAIN is missing');
    if (!from) errors.push('EMAIL_FROM is missing');
    return { provider: 'mailgun' as const, apiKey, domain, from, errors };
  } else {
    // Default to Gmail SMTP
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS?.replace(/\s/g, ''); // Strip spacing for App Password correctness
    const from = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const secure = Number(portStr) === 465;

    const errors: string[] = [];
    if (!host) errors.push('SMTP_HOST is missing');
    if (!portStr) errors.push('SMTP_PORT is missing');
    if (!user || user === 'your-email@gmail.com') errors.push('SMTP_USER is missing or default');
    if (!pass) errors.push('SMTP_PASS is missing');
    if (!from) errors.push('SMTP_FROM is missing');

    const port = portStr ? parseInt(portStr, 10) : 587;
    if (portStr && isNaN(port)) {
      errors.push('SMTP_PORT is not a valid number');
    }

    return { provider: 'gmail' as const, host, port, secure, user, pass, from, errors };
  }
}

// Helper to detect Gmail configuration issues
function validateGmailConfig(host: string, port: number, secure: boolean, pass: string) {
  if (host.toLowerCase().includes('gmail')) {
    if (host !== 'smtp.gmail.com') {
      console.warn(`[EmailService] WARNING: Gmail SMTP host is configured as "${host}". For Gmail, it should be "smtp.gmail.com".`);
    }
    if (port !== 465 && port !== 587) {
      console.warn(`[EmailService] WARNING: Gmail SMTP usually uses port 465 (SSL) or 587 (TLS/STARTTLS). You are using port ${port}.`);
    }
    if (port === 465 && !secure) {
      console.warn(`[EmailService] WARNING: Gmail SMTP port 465 requires secure (SSL) mode. Please check SMTP_PORT or secure setting.`);
    }
    if (port === 587 && secure) {
      console.warn(`[EmailService] WARNING: Gmail SMTP port 587 requires secure to be false (it upgrades via STARTTLS). Please check SMTP_PORT or secure setting.`);
    }
    const cleanPass = pass.replace(/\s/g, '');
    if (cleanPass.length !== 16) {
      console.warn(`[EmailService] WARNING: Gmail SMTP_PASS is ${pass.length} characters long. A Google App Password must be exactly 16 characters (excluding spaces). Please generate a valid App Password from Google Account Settings.`);
    }
  }
}

// ─── Transporter Management (Gmail/SMTP only) ───────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function resolveHostToIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) {
        reject(err);
      } else {
        resolve(address);
      }
    });
  });
}

export async function initializeTransporter() {
  if (transporter) {
    return transporter; // Singleton pattern
  }

  const config = getEmailConfig();
  if (config.provider !== 'gmail') {
    return null;
  }

  if (config.errors.length > 0) {
    transporter = null;
    isVerified = false;
    lastVerificationError = `Configuration errors: ${config.errors.join(', ')}`;
    console.error(`[EmailService] CRITICAL: SMTP configuration is incomplete. Missing: ${config.errors.join(', ')}.`);
    return null;
  }

  validateGmailConfig(config.host || '', config.port, config.secure, config.pass || '');

  try {
    let smtpIp = config.host || '';
    if (config.host) {
      try {
        smtpIp = await resolveHostToIPv4(config.host);
        console.log(`[EmailService] Resolved ${config.host} to IPv4: ${smtpIp}`);
      } catch (dnsErr) {
        console.warn(`[EmailService] DNS resolution for ${config.host} failed, falling back to hostname.`);
      }
    }

    transporter = nodemailer.createTransport({
      host: smtpIp,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: { 
        rejectUnauthorized: false,
        servername: config.host || undefined
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    } as any);
    console.log('[EmailService] Singleton SMTP Transporter initialized successfully');
    return transporter;
  } catch (err: any) {
    transporter = null;
    isVerified = false;
    lastVerificationError = `Transporter initialization failed: ${err?.message || err}`;
    console.error(`[EmailService] ${lastVerificationError}`);
    return null;
  }
}

// Lazy creation helper
export async function getOrCreateTransporter() {
  if (!transporter) {
    await initializeTransporter();
  }
  return transporter;
}

// ─── Raw TCP Socket Tester (Step 2) ──────────────────────────────────────────

export function testTcpConnection(host: string, port: number, timeoutMs = 5000): Promise<{ status: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: 'Connected' });
      }
    });

    socket.on('error', (err: any) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: err.code || 'ERROR', error: err.message });
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: 'Timed Out' });
      }
    });
  });
}

// Helper to identify authentication errors
function isAuthError(err: any): boolean {
  const errMsg = String(err?.message || '').toLowerCase();
  const errCode = String(err?.code || '').toUpperCase();
  return (
    errCode === 'EAUTH' ||
    errCode === 'AUTH' ||
    errMsg.includes('auth') ||
    errMsg.includes('credential') ||
    errMsg.includes('password') ||
    errMsg.includes('not accepted')
  );
}

// Helper to provide detailed explanations for common SMTP timeout/network errors
function getMeaningfulErrorExplanation(err: any): string {
  const code = err?.code || '';
  const msg = (err?.message || '').toLowerCase();
  
  if (code === 'ETIMEDOUT') {
    return 'Connection timed out. Outbound SMTP TCP port is blocked by the network or hosting environment (e.g. Railway Hobby plan limitations) or the host is offline.';
  }
  if (code === 'ECONNRESET') {
    return 'Connection reset by peer. The destination SMTP server abruptly closed the socket connection.';
  }
  if (code === 'ECONNREFUSED') {
    return 'Connection refused. The server explicitly rejected the connection. Check if SMTP_PORT is correct.';
  }
  if (isAuthError(err)) {
    return 'Authentication failed. Verify SMTP_USER and SMTP_PASS (Gmail App Password) credentials. Spaces have been automatically stripped.';
  }
  if (code === 'ENOTFOUND') {
    return 'SMTP Host name not found. DNS resolution failed. Check SMTP_HOST value.';
  }
  return 'Unknown or general SMTP connection failure.';
}

// Improved logging function for SMTP errors
function logSmtpError(err: any, context: string) {
  const config = getEmailConfig();
  const secure = Number(process.env.SMTP_PORT) === 465;
  const nodeVersion = process.version;
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT || 'N/A';
  const explanation = getMeaningfulErrorExplanation(err);

  console.error(`[EmailService Error] Details during: ${context}`);
  if (config.provider === 'gmail') {
    console.error(`  SMTP Host:         ${(config as any).host}`);
    console.error(`  SMTP Port:         ${(config as any).port}`);
    console.log(`  Secure Mode:       ${secure}`);
    console.log(`  TLS Configuration: rejectUnauthorized=false`);
  }
  console.log(`  Node Version:      ${nodeVersion}`);
  console.log(`  Railway Env:       ${railwayEnv}`);
  console.error(`  Error Code:        ${err?.code || 'N/A'}`);
  console.error(`  Error Message:     ${err?.message || String(err)}`);
  console.error(`  SMTP Response:     ${err?.response || 'N/A'}`);
  console.log(`  Socket Timeout:    30000ms`);
  console.error(`  Explanation:       ${explanation}`);
  if (err?.stack) {
    console.error(`  Stack Trace:\n${err.stack}`);
  }
}

// ─── Provider Abstraction Classes (Step 7) ───────────────────────────────────

class GmailProvider implements EmailProvider {
  name = 'gmail';

  async verify(): Promise<{ success: boolean; error: string | null }> {
    await getOrCreateTransporter();
    if (!transporter) {
      return { success: false, error: lastVerificationError || 'Transporter not initialized.' };
    }
    try {
      await transporter.verify();
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    await getOrCreateTransporter();
    if (!transporter) {
      return { success: false, error: lastVerificationError || 'Transporter is not initialized.' };
    }

    const config = getEmailConfig();
    const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
    const fromEmail = (config as any).from || '';

    const retryDelays = [2000, 5000, 10000]; // 2s, 5s, 10s
    let attempts = 0;
    let lastError: any = null;

    while (attempts <= 3) {
      if (attempts > 0) {
        const waitTime = retryDelays[attempts - 1];
        console.log(`[EmailService] Retrying SMTP send to ${payload.toEmail} in ${waitTime / 1000}s (Attempt ${attempts} of 3)...`);
        await delay(waitTime);
      }

      try {
        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: `"${payload.toName}" <${payload.toEmail}>`,
          subject: payload.subject,
          text: payload.text,
          html: payload.html
        });
        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        lastError = err;
        attempts++;
        console.error(`[EmailService] SMTP Attempt ${attempts} failed for ${payload.toEmail}: ${err?.message || String(err)}`);

        if (isAuthError(err)) {
          console.error('[EmailService] Authentication failure detected. Skipping SMTP retries.');
          break;
        }
      }
    }

    logSmtpError(lastError, 'SMTP Gmail Send');
    return { success: false, error: lastError?.message || 'Failed to deliver email after retries.' };
  }
}

class ResendProvider implements EmailProvider {
  name = 'resend';

  async verify(): Promise<{ success: boolean; error: string | null }> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    if (!key) return { success: false, error: 'RESEND_API_KEY is missing.' };
    if (!from) return { success: false, error: 'EMAIL_FROM is missing.' };
    return { success: true, error: null };
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
    let fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';

    // Step 7: Automatically fallback to onboarding@resend.dev for public domains on Resend sandbox
    const emailLower = fromEmail.toLowerCase();
    if (
      emailLower.endsWith('gmail.com') ||
      emailLower.endsWith('yahoo.com') ||
      emailLower.endsWith('outlook.com') ||
      emailLower.endsWith('hotmail.com') ||
      emailLower.endsWith('.ac.in') ||
      emailLower === ''
    ) {
      console.log(`[EmailService] Sender "${fromEmail}" is a public/unverified domain. Falling back to "onboarding@resend.dev" for Resend compatibility.`);
      fromEmail = 'onboarding@resend.dev';
    }

    // Step 7: Sandbox restriction redirection to the registered owner address
    let toEmail = payload.toEmail;
    const ownerEmail = process.env.SMTP_USER || process.env.EMAIL_FROM || '';
    if (ownerEmail && toEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
      console.log(`[EmailService] Resend sandbox restriction: Redirecting email recipient from "${toEmail}" to verified owner account "${ownerEmail}".`);
      toEmail = ownerEmail;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          from: `"${fromName}" <${fromEmail}>`,
          to: [toEmail],
          subject: payload.subject,
          html: payload.html,
          text: payload.text
        })
      });

      const resData = await response.json() as any;
      if (response.ok && resData.id) {
        return { success: true, messageId: resData.id };
      } else {
        return { success: false, error: resData.message || `Resend API returned status ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}

class BrevoProvider implements EmailProvider {
  name = 'brevo';

  async verify(): Promise<{ success: boolean; error: string | null }> {
    const key = process.env.BREVO_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    if (!key) return { success: false, error: 'BREVO_API_KEY is missing.' };
    if (!from) return { success: false, error: 'EMAIL_FROM is missing.' };
    return { success: true, error: null };
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const key = process.env.BREVO_API_KEY;
    const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': `${key}`
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: payload.toEmail, name: payload.toName }],
          subject: payload.subject,
          htmlContent: payload.html,
          textContent: payload.text
        })
      });

      const resData = await response.json() as any;
      if (response.ok && (resData.messageId || resData.id)) {
        return { success: true, messageId: resData.messageId || resData.id };
      } else {
        return { success: false, error: resData.message || `Brevo API returned status ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}

class SendGridProvider implements EmailProvider {
  name = 'sendgrid';

  async verify(): Promise<{ success: boolean; error: string | null }> {
    const key = process.env.SENDGRID_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    if (!key) return { success: false, error: 'SENDGRID_API_KEY is missing.' };
    if (!from) return { success: false, error: 'EMAIL_FROM is missing.' };
    return { success: true, error: null };
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const key = process.env.SENDGRID_API_KEY;
    const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: payload.toEmail, name: payload.toName }]
          }],
          from: { email: fromEmail, name: fromName },
          subject: payload.subject,
          content: [
            { type: 'text/plain', value: payload.text },
            { type: 'text/html', value: payload.html }
          ]
        })
      });

      if (response.ok) {
        return { success: true, messageId: response.headers.get('x-message-id') || 'SG_SUCCESS' };
      } else {
        const resData = await response.json() as any;
        const errMsg = resData.errors?.[0]?.message || `SendGrid API returned status ${response.status}`;
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}

class MailgunProvider implements EmailProvider {
  name = 'mailgun';

  async verify(): Promise<{ success: boolean; error: string | null }> {
    const key = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    if (!key) return { success: false, error: 'MAILGUN_API_KEY is missing.' };
    if (!domain) return { success: false, error: 'MAILGUN_DOMAIN is missing.' };
    if (!from) return { success: false, error: 'EMAIL_FROM is missing.' };
    return { success: true, error: null };
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const key = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    try {
      const basicAuth = Buffer.from(`api:${key}`).toString('base64');
      const body = new URLSearchParams();
      body.append('from', `"${fromName}" <${fromEmail}>`);
      body.append('to', payload.toEmail);
      body.append('subject', payload.subject);
      body.append('text', payload.text);
      body.append('html', payload.html);

      const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: body.toString()
      });

      const resData = await response.json() as any;
      if (response.ok && resData.id) {
        return { success: true, messageId: resData.id };
      } else {
        return { success: false, error: resData.message || `Mailgun API returned status ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}

// ─── Provider Factory Selection (Step 7) ─────────────────────────────────────

let activeProvider: EmailProvider | null = null;

export function getActiveProvider(): EmailProvider {
  if (activeProvider) return activeProvider;

  const providerType = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  switch (providerType) {
    case 'resend':
      activeProvider = new ResendProvider();
      break;
    case 'brevo':
      activeProvider = new BrevoProvider();
      break;
    case 'sendgrid':
      activeProvider = new SendGridProvider();
      break;
    case 'mailgun':
      activeProvider = new MailgunProvider();
      break;
    case 'gmail':
    default:
      activeProvider = new GmailProvider();
      break;
  }
  return activeProvider;
}

export function getEmailFromAddress(): string {
  const config = getEmailConfig();
  return config.from || '';
}

// Diagnostics Startup Print helper
function printStartupDiagnostics(verified: boolean, verifyError: string | null) {
  const config = getEmailConfig();
  const nodeVersion = process.version;
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT || 'N/A';
  const isGmail = (config.provider === 'gmail');
  const sender = config.from || 'N/A';
  const transportInitialized = transporter !== null;

  console.log('\n=========================');
  console.log('EMAIL CONFIGURATION');
  console.log('=========================');
  console.log(`Provider:              ${(process.env.EMAIL_PROVIDER || 'gmail').toUpperCase()}`);
  if (isGmail) {
    console.log(`Host:                  ${(config as any).host}`);
    console.log(`Port:                  ${(config as any).port}`);
    console.log(`Secure:                ${(config as any).secure}`);
    console.log(`Using Gmail:           true`);
  }
  console.log(`Node version:          ${nodeVersion}`);
  console.log(`Railway environment:   ${railwayEnv}`);
  console.log(`Email sender:          ${sender}`);
  console.log(`Transport initialized: ${transportInitialized}`);
  console.log(`SMTP verified:         ${verified}`);
  if (!verified && verifyError) {
    console.log(`Verification error:    ${verifyError}`);
  }
  console.log('=========================\n');
}
// ─── Logging Helpers ──────────────────────────────────────────────────────────

function logEmail(status: 'REQUESTED' | 'QUEUED' | 'SENT' | 'FAILED' | 'PROVIDER_RESPONSE', type: string, recipient: string, details?: any) {
  const logObj = {
    timestamp: new Date().toISOString(),
    event: status,
    emailType: type,
    to: recipient,
    ...(details ? { details } : {})
  };
  console.log(`[EmailService Log] ${JSON.stringify(logObj, null, 2)}`);
}

interface MailOptions {
  toEmail: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  emailType: string;
}

// ─── Exported Verification Helpers ───────────────────────────────────────────

export async function verifyTransporter(): Promise<{ success: boolean; error: string | null }> {
  const provider = getActiveProvider();
  return provider.verify();
}

export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  return config.errors.length === 0;
}

export async function getEmailHealthStatus() {
  const config = getEmailConfig();
  const configured = isEmailConfigured();
  return {
    configured,
    provider: configured ? config.provider : 'none' as const,
    verified: isVerified,
    error: lastVerificationError,
    lastSuccessfulEmail,
    lastFailedEmail,
    failureReason: lastVerificationError || lastFailureReason
  };
}

export async function runStartupVerification() {
  const provider = getActiveProvider();
  
  console.log('\n===============================================');
  console.log('EMAIL PROVIDER STARTUP DIAGNOSTICS');
  console.log('===============================================');
  console.log(`Active Provider:      ${provider.name.toUpperCase()}`);
  console.log(`Node Version:         ${process.version}`);
  console.log(`Railway Env:          ${process.env.RAILWAY_ENVIRONMENT || 'N/A'}`);
  console.log(`Email Sender:         ${getEmailFromAddress()}`);

  if (provider.name === 'gmail') {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const portStr = process.env.SMTP_PORT || '587';
    console.log(`SMTP Host:            ${host}`);
    console.log(`SMTP Port:            ${portStr}`);
    console.log(`SMTP Secure:          ${Number(portStr) === 465}`);
    
    // Validate environment variables
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error(`\n[EmailService] CRITICAL: SMTP environment variable check failed.`);
      console.error(`  Missing required variables: ${missing.join(', ')}`);
      console.error(`  Process will exit immediately to prevent invalid startup.\n`);
      process.exit(1);
    }

    // Raw TCP socket connectivity test
    console.log('[EmailService] Performing raw TCP socket connectivity check...');
    const tcp465 = await testTcpConnection(host, 465, 5000);
    const tcp587 = await testTcpConnection(host, 587, 5000);
    
    console.log(`  TCP Port 465 Reachability: ${tcp465.status}`);
    console.log(`  TCP Port 587 Reachability: ${tcp587.status}`);

    const selectedPort = Number(portStr);
    const selectedReach = selectedPort === 465 ? tcp465.status : tcp587.status;
    if (selectedReach !== 'Connected') {
      console.error(`\n[EmailService] CRITICAL ERROR: SMTP connection blocked by hosting environment or network.`);
      console.error(`  Outbound SMTP TCP port ${selectedPort} is unreachable (Status: ${selectedReach}).`);
      console.error(`  Please verify your hosting environment firewall or switch to an HTTP-based provider.\n`);
    }
  } else {
    // API provider validation
    const requiredKey = `${provider.name.toUpperCase()}_API_KEY`;
    if (!process.env[requiredKey]) {
      console.error(`[EmailService] CRITICAL: Missing required API key for provider ${provider.name}: ${requiredKey}`);
      process.exit(1);
    }
  }

  // Verification retry strategy
  let verified = false;
  let attempt = 1;
  const backoffs = [1000, 2000, 4000]; // 1s, 2s, 4s

  while (attempt <= 3) {
    try {
      console.log(`[EmailService] Attempting provider verification (Attempt ${attempt} of 3)...`);
      const result = await provider.verify();
      if (result.success) {
        verified = true;
        isVerified = true;
        lastVerificationError = null;
        console.log(`[EmailService] Provider ${provider.name} verified successfully.`);
        break;
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (err: any) {
      console.error(`[EmailService] Attempt ${attempt} failed: ${err?.message || String(err)}`);
      lastVerificationError = err?.message || String(err);
      lastFailedEmail = new Date();
      lastFailureReason = `${err?.code || 'N/A'}: ${err?.message || String(err)}`;

      if (attempt < 3) {
        const delayMs = backoffs[attempt - 1];
        console.log(`[EmailService] Retrying in ${delayMs / 1000}s...`);
        await delay(delayMs);
      }
      attempt++;
    }
  }

  printStartupDiagnostics(verified, lastVerificationError);

  if (!verified) {
    console.warn(`[EmailService] WARNING: Provider ${provider.name} verification failed 3 times. Continuing server startup with warning.`);
  }
}

async function sendMailInternal(options: MailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  logEmail('REQUESTED', options.emailType, options.toEmail, { name: options.toName, subject: options.subject });

  if (!isEmailConfigured()) {
    const errorMsg = 'Email provider is not configured or setup is incomplete.';
    logEmail('FAILED', options.emailType, options.toEmail, { error: errorMsg });
    return { success: false, error: errorMsg };
  }

  const provider = getActiveProvider();
  logEmail('QUEUED', options.emailType, options.toEmail);

  try {
    const result = await provider.send({
      toEmail: options.toEmail,
      toName: options.toName,
      subject: options.subject,
      text: options.text,
      html: options.html,
      emailType: options.emailType
    });

    if (result.success) {
      logEmail('SENT', options.emailType, options.toEmail, { messageId: result.messageId });
      lastSuccessfulEmail = new Date();
      return { success: true, messageId: result.messageId };
    } else {
      logEmail('FAILED', options.emailType, options.toEmail, { error: result.error });
      lastFailedEmail = new Date();
      lastFailureReason = result.error || 'Unknown error';
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logEmail('FAILED', options.emailType, options.toEmail, { error: errorMsg, rawError: err });
    lastFailedEmail = new Date();
    lastFailureReason = errorMsg;
    return { success: false, error: errorMsg };
  }
}

// ─── Send Reminder Email ──────────────────────────────────────────────────────

export interface ReminderEmailPayload {
  toEmail: string;
  toName: string;
  messageContent: string;
  reminderId: number;
  channelName?: string;
  setAt: Date;
}

export async function sendReminderEmail(payload: ReminderEmailPayload): Promise<boolean> {
  const preview = payload.messageContent.length > 200
    ? payload.messageContent.slice(0, 200) + '…'
    : payload.messageContent;

  const setAtFormatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(payload.setAt);

  const targetUrl = `${getFrontendUrl()}/reminders`;
  console.log(`[EmailService] Generated link for Reminder Email: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Message Reminder</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c6af7 0%, #6366f1 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 14px; }
    .bell-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
    .message-box { background: #0f101a; border: 1px solid #1e2035; border-radius: 14px; padding: 18px 20px; }
    .message-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; margin: 0; word-break: break-word; }
    .meta { margin-top: 20px; display: flex; gap: 24px; }
    .meta-item { flex: 1; }
    .meta-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
    .meta-value { font-size: 13px; color: #9ca3af; margin-top: 3px; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #7c6af7, #6366f1); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="bell-icon">🔔</span>
      <h1>Message Reminder</h1>
      <p>Hi ${payload.toName}, you asked to be reminded about this message.</p>
    </div>
    <div class="body">
      <div class="label">Original Message</div>
      <div class="message-box">
        <p class="message-text">${preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      <div class="meta">
        ${payload.channelName ? `<div class="meta-item"><div class="meta-label">Channel / Session</div><div class="meta-value">#${payload.channelName}</div></div>` : ''}
        <div class="meta-item"><div class="meta-label">Reminder Set</div><div class="meta-value">${setAtFormatted}</div></div>
      </div>
      <div class="divider"></div>
      <div class="cta">
        <a href="${targetUrl}">View Reminders →</a>
      </div>
    </div>
    <div class="footer">
      <p>This reminder was set in your Slack AI Workspace Assistant. You can dismiss it in the app.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🔔 Message Reminder\n\nHi ${payload.toName},\n\nYou asked to be reminded about this message:\n\n"${preview}"\n\n${payload.channelName ? `Channel: #${payload.channelName}\n` : ''}Reminder set at: ${setAtFormatted}\n\nView Reminders: ${targetUrl}`;

  const result = await sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `🔔 Reminder: Message in ${payload.channelName || 'your workspace'}`,
    text,
    html,
    emailType: 'Reminder'
  });
  return result.success;
}

// ─── Send New Login Notification Email ────────────────────────────────────────

export interface LoginEmailPayload {
  toEmail: string;
  toName: string;
  ipAddress: string;
  userAgent?: string;
  loginTime: Date;
}

export async function sendNewLoginEmail(payload: LoginEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(payload.loginTime);

  const targetUrl = `${getFrontendUrl()}/dashboard`;
  console.log(`[EmailService] Generated link for Login Notification: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Login Detected</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .shield-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
    .details-box { background: #0f101a; border: 1px solid #1e2035; border-radius: 14px; padding: 18px 20px; }
    .details-item { margin: 8px 0; color: #e5e7eb; font-size: 14px; }
    .details-item strong { color: #9ca3af; }
    .warning-text { color: #f87171; font-size: 14px; line-height: 1.5; margin-top: 20px; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="shield-icon">🛡️</span>
      <h1>New Login Detected</h1>
      <p>Hi ${payload.toName}, a new login was detected on your account.</p>
    </div>
    <div class="body">
      <div class="label">Login Details</div>
      <div class="details-box">
        <div class="details-item"><strong>IP Address:</strong> ${payload.ipAddress}</div>
        <div class="details-item"><strong>Date & Time:</strong> ${formattedTime}</div>
        ${payload.userAgent ? `<div class="details-item"><strong>Browser/Device:</strong> ${payload.userAgent}</div>` : ''}
      </div>
      <p class="warning-text">⚠️ If this was not you, please secure your account or change your password immediately.</p>
      <div class="divider"></div>
      <div class="cta">
        <a href="${targetUrl}">Open Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated security notification from your Slack AI Workspace Assistant.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🛡️ New Login Detected\n\nHi ${payload.toName},\n\nA new login was detected on your account.\n\nDetails:\n- IP Address: ${payload.ipAddress}\n- Date & Time: ${formattedTime}${payload.userAgent ? `\n- Browser/Device: ${payload.userAgent}` : ''}\n\nIf this was not you, please secure your account immediately.\n\nOpen Dashboard: ${targetUrl}`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `🛡️ Security Alert: New login detected`,
    text,
    html,
    emailType: 'New Login'
  });
}

// ─── Send Forgot Password Reset Email ──────────────────────────────────────────

export interface ForgotPasswordEmailPayload {
  toEmail: string;
  toName: string;
  resetToken: string;
}

export async function sendForgotPasswordEmail(payload: ForgotPasswordEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = `${getFrontendUrl()}/reset-password?token=${payload.resetToken}`;
  console.log(`[EmailService] Generated link for Forgot Password Reset: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c6af7 0%, #6366f1 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .key-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
    .token-box { background: #0f101a; border: 1px solid #1e2035; border-radius: 14px; padding: 18px 20px; text-align: center; margin-bottom: 20px; }
    .token-text { font-family: 'Courier New', Courier, monospace; color: #7c6af7; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 0; }
    .info-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #7c6af7, #6366f1); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="key-icon">🔑</span>
      <h1>Password Reset Request</h1>
      <p>Hi ${payload.toName}, we received a request to reset your password.</p>
    </div>
    <div class="body">
      <p class="info-text">You can reset your password using the link or the reset token below. This link and token are valid for 1 hour.</p>
      <div class="label">Reset Token</div>
      <div class="token-box">
        <p class="token-text">${payload.resetToken}</p>
      </div>
      <div class="cta">
        <a href="${targetUrl}">Reset Password →</a>
      </div>
      <div class="divider"></div>
      <p class="info-text" style="font-size: 13px; color: #9ca3af;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>This is an automated security notification from your Slack AI Workspace Assistant.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🔑 Password Reset Request\n\nHi ${payload.toName},\n\nWe received a request to reset your password. You can reset your password by clicking the link below or using this reset token (valid for 1 hour):\n\nToken: ${payload.resetToken}\n\nReset Link: ${targetUrl}\n\nIf you did not request this, you can ignore this email.`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `🔑 Password Reset Request`,
    text,
    html,
    emailType: 'Forgot Password'
  });
}

// ─── Send Email Verification Email ───────────────────────────────────────────

export interface VerificationEmailPayload {
  toEmail: string;
  toName: string;
  token: string;
}

export async function sendEmailVerificationEmail(payload: VerificationEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = `${getFrontendUrl()}/verify-email?token=${payload.token}`;
  console.log(`[EmailService] Generated link for Email Verification: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c6af7 0%, #6366f1 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .check-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .info-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #7c6af7, #6366f1); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="check-icon">✉️</span>
      <h1>Verify Your Email Address</h1>
      <p>Hi ${payload.toName}, please confirm your email address to complete registration.</p>
    </div>
    <div class="body">
      <p class="info-text">Thank you for joining us! Please verify your email by clicking the button below. This link is valid for 24 hours.</p>
      <div class="cta">
        <a href="${targetUrl}">Verify Email Address →</a>
      </div>
      <div class="divider"></div>
      <p class="info-text" style="font-size: 13px; color: #9ca3af;">If you did not request this registration, you can ignore this message.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from your Slack AI Workspace Assistant.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `✉️ Verify Your Email Address\n\nHi ${payload.toName},\n\nPlease confirm your email address by clicking the link below:\n\nVerify Link: ${targetUrl}\n\nIf you did not request this, you can ignore this email.`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `✉️ Verify Your Email Address`,
    text,
    html,
    emailType: 'Email Verification'
  });
}

// ─── Send Account Activation Email ───────────────────────────────────────────

export interface ActivationEmailPayload {
  toEmail: string;
  toName: string;
  token: string;
}

export async function sendAccountActivationEmail(payload: ActivationEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = `${getFrontendUrl()}/activate-account?token=${payload.token}`;
  console.log(`[EmailService] Generated link for Account Activation: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Activate Your Account</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .act-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .info-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="act-icon">⚡</span>
      <h1>Activate Your Account</h1>
      <p>Hi ${payload.toName}, your account is ready for activation.</p>
    </div>
    <div class="body">
      <p class="info-text">Please activate your account by clicking the button below. This will authenticate your registration and set up your workspace settings.</p>
      <div class="cta">
        <a href="${targetUrl}">Activate Account Now →</a>
      </div>
      <div class="divider"></div>
      <p class="info-text" style="font-size: 13px; color: #9ca3af;">If you did not request account creation, you can ignore this message.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from your Slack AI Workspace Assistant.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `⚡ Activate Your Account\n\nHi ${payload.toName},\n\nPlease activate your account by clicking the link below:\n\nActivation Link: ${targetUrl}`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `⚡ Activate Your Account`,
    text,
    html,
    emailType: 'Account Activation'
  });
}

// ─── Send Account Deletion Notification Email ──────────────────────────────────

export interface AccountDeletionEmailPayload {
  toEmail: string;
  toName: string;
}

export async function sendAccountDeletionEmail(payload: AccountDeletionEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = `${getFrontendUrl()}/login`;
  console.log(`[EmailService] Generated link for Account Deletion: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account Deleted</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .trash-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .info-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="trash-icon">🗑️</span>
      <h1>Account Permanently Deleted</h1>
      <p>Goodbye ${payload.toName}, your account has been successfully removed.</p>
    </div>
    <div class="body">
      <p class="info-text">As requested, your Slack AI Workspace Assistant account has been permanently deleted from our database.</p>
      <p class="info-text">All of your configurations, API keys, chat transcripts, database associations, and session indexes have been completely wiped. You will no longer receive any scheduled email reminders.</p>
      <div class="cta">
        <a href="${targetUrl}">Go to Login Screen</a>
      </div>
      <div class="divider"></div>
      <p class="info-text" style="font-size: 13px; color: #9ca3af;">We're sad to see you go! If you ever want to return, you can register a new account on our platform at any time.</p>
    </div>
    <div class="footer">
      <p>Slack AI Workspace Assistant Team</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🗑️ Account Permanently Deleted\n\nHi ${payload.toName},\n\nYour account has been permanently deleted from our system, along with all configurations, history, and scheduled reminders.\n\nWe're sad to see you go! You can sign up again at any time at: ${targetUrl}`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.toName,
    subject: `🗑️ Account Deleted successfully`,
    text,
    html,
    emailType: 'Account Deletion'
  });
}

// ─── Send Workspace Invite Email ─────────────────────────────────────────────

export interface WorkspaceInvitePayload {
  toEmail: string;
  inviteeName: string;
  inviterName: string;
  workspaceName: string;
}

export async function sendWorkspaceInviteEmail(payload: WorkspaceInvitePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = `${getFrontendUrl()}/register`;
  console.log(`[EmailService] Generated link for Workspace Invite: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Workspace Invitation</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0b14; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #141624; border-radius: 20px; border: 1px solid #1e2035; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c6af7 0%, #6366f1 100%); padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .invite-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .body { padding: 32px 36px; }
    .info-text { color: #e5e7eb; font-size: 15px; line-height: 1.6; }
    .divider { height: 1px; background: #1e2035; margin: 28px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #7c6af7, #6366f1); color: #fff; text-decoration: none; border-radius: 12px; padding: 13px 32px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 36px; background: #0f101a; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="invite-icon">🤝</span>
      <h1>Workspace Invitation</h1>
      <p>Hi ${payload.inviteeName}, you have been invited to join a workspace.</p>
    </div>
    <div class="body">
      <p class="info-text">${payload.inviterName} has invited you to join the Slack workspace <strong>${payload.workspaceName}</strong> integrated with Slack AI Workspace Assistant.</p>
      <p class="info-text">Set up your credentials and sync your profile by registering via the button below.</p>
      <div class="cta">
        <a href="${targetUrl}">Accept Invitation & Register →</a>
      </div>
      <div class="divider"></div>
      <p class="info-text" style="font-size: 13px; color: #9ca3af;">If you do not recognize this workspace, you can safely ignore this invitation.</p>
    </div>
    <div class="footer">
      <p>This invitation was sent from your Slack AI Workspace Assistant integration.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🤝 Workspace Invitation\n\nHi ${payload.inviteeName},\n\nYou have been invited by ${payload.inviterName} to join the workspace "${payload.workspaceName}". Accept and register at:\n\nRegister Link: ${targetUrl}`;

  return sendMailInternal({
    toEmail: payload.toEmail,
    toName: payload.inviteeName,
    subject: `🤝 Invitation to join ${payload.workspaceName} on Slack AI Assistant`,
    text,
    html,
    emailType: 'Workspace Invite'
  });
}

// ─── Send SMTP Test Email ───────────────────────────────────────────────────

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const targetUrl = getFrontendUrl();
  console.log(`[EmailService] Generated link for SMTP Test: ${targetUrl}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>SMTP Test Email</title>
</head>
<body style="background: #0a0b14; color: #e5e7eb; font-family: sans-serif; padding: 40px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background: #141624; border: 1px solid #1e2035; border-radius: 12px; padding: 30px;">
    <h1 style="color: #10b981; margin-top: 0;">🚀 SMTP Integration Active</h1>
    <p style="font-size: 16px;">This is a test email sent from your <strong>Slack AI Workspace Assistant</strong>.</p>
    <p style="font-size: 14px; color: #9ca3af;">If you received this email, your SMTP configuration is successfully verified and fully operational.</p>
    <div style="margin: 24px 0;">
      <a href="${targetUrl}" style="display: inline-block; background: #10b981; color: #fff; text-decoration: none; border-radius: 8px; padding: 10px 20px; font-weight: bold;">Go to App Platform →</a>
    </div>
    <hr style="border: none; border-top: 1px solid #1e2035; margin: 20px 0;" />
    <p style="font-size: 12px; color: #4b5563;">Timestamp: ${new Date().toISOString()}</p>
  </div>
</body>
</html>
  `.trim();

  const text = `🚀 SMTP Integration Active\n\nThis is a test email sent from your Slack AI Workspace Assistant.\n\nIf you received this email, your SMTP configuration is successfully verified and fully operational.\n\nApp Platform: ${targetUrl}\n\nTimestamp: ${new Date().toISOString()}`;

  return sendMailInternal({
    toEmail,
    toName: 'SMTP Tester',
    subject: `🚀 SMTP Integration Test Email`,
    text,
    html,
    emailType: 'Test'
  });
}

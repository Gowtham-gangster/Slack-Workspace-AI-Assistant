import nodemailer from 'nodemailer';

// ─── Environment Variables Validation ──────────────────────────────────────────

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://slack-workspace-ai-assistant.vercel.app';
}

function getEmailConfig() {
  const isResend = !!process.env.RESEND_API_KEY;
  if (isResend) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const errors: string[] = [];
    if (!apiKey) errors.push('RESEND_API_KEY is missing');
    if (!from) errors.push('EMAIL_FROM is missing');
    return { provider: 'resend' as const, apiKey, from, errors };
  } else {
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const secure = process.env.SMTP_SECURE === 'true';

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

    return { provider: 'smtp' as const, host, port, secure, user, pass, from, errors };
  }
}

// ─── Transporter Management ──────────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;
let lastVerificationError: string | null = null;
let isVerified = false;

export function initializeTransporter() {
  const config = getEmailConfig();
  if (config.errors.length > 0) {
    transporter = null;
    isVerified = false;
    lastVerificationError = `Configuration errors: ${config.errors.join(', ')}`;
    console.error(`[EmailService] Configuration validation failed: ${lastVerificationError}`);
    return null;
  }

  try {
    if (config.provider === 'resend') {
      transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: config.apiKey
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 15000      // 15 seconds
      });
      console.log('[EmailService] Transporter initialized for Resend SMTP');
    } else {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 15000      // 15 seconds
      });
      console.log('[EmailService] Transporter initialized for SMTP');
    }
    return transporter;
  } catch (err: any) {
    transporter = null;
    isVerified = false;
    lastVerificationError = `Transporter initialization failed: ${err?.message || err}`;
    console.error(`[EmailService] ${lastVerificationError}`);
    return null;
  }
}

export async function verifyTransporter(): Promise<{ success: boolean; error: string | null }> {
  // Re-run initialization to catch latest env settings
  initializeTransporter();

  if (!transporter) {
    const errorMsg = lastVerificationError || 'Transporter not initialized due to configuration errors';
    console.error(`[EmailService] Verification failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    console.log('[EmailService] Verifying transporter connection...');
    await transporter.verify();
    isVerified = true;
    lastVerificationError = null;
    console.log('[EmailService] Transporter connection verified successfully.');
    return { success: true, error: null };
  } catch (err: any) {
    isVerified = false;
    lastVerificationError = err?.message || String(err);
    console.error(`[EmailService] Transporter verification failed: ${lastVerificationError}`);
    return { success: false, error: lastVerificationError };
  }
}

export function isEmailConfigured(): boolean {
  const user = process.env.SMTP_USER;
  const hasSmtp = !!(user && user !== 'your-email@gmail.com');
  const hasResend = !!process.env.RESEND_API_KEY;
  return hasSmtp || hasResend;
}

export async function getEmailHealthStatus(): Promise<{
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
  verified: boolean;
  error: string | null;
}> {
  const config = getEmailConfig();
  const configured = isEmailConfigured();
  return {
    configured,
    provider: configured ? config.provider : 'none',
    verified: isVerified,
    error: lastVerificationError
  };
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

// ─── Send Mail Base ──────────────────────────────────────────────────────────

interface MailOptions {
  toEmail: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  emailType: string;
}

async function sendMailInternal(options: MailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  logEmail('REQUESTED', options.emailType, options.toEmail, { name: options.toName, subject: options.subject });

  if (!isEmailConfigured()) {
    const errorMsg = 'Email provider is not configured.';
    logEmail('FAILED', options.emailType, options.toEmail, { error: errorMsg });
    return { success: false, error: errorMsg };
  }

  if (!transporter) {
    initializeTransporter();
  }

  if (!transporter) {
    const errorMsg = lastVerificationError || 'Transporter is not initialized.';
    logEmail('FAILED', options.emailType, options.toEmail, { error: errorMsg });
    return { success: false, error: errorMsg };
  }

  logEmail('QUEUED', options.emailType, options.toEmail);

  const config = getEmailConfig();
  const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
  const fromEmail = config.from || '';

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${options.toName}" <${options.toEmail}>`,
      subject: options.subject,
      text: options.text,
      html: options.html
    });

    logEmail('SENT', options.emailType, options.toEmail, { messageId: info.messageId });
    logEmail('PROVIDER_RESPONSE', options.emailType, options.toEmail, { response: info.response, messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logEmail('FAILED', options.emailType, options.toEmail, { error: errorMsg, rawError: err });
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

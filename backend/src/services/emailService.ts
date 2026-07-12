import nodemailer from 'nodemailer';

// ─── Transporter ─────────────────────────────────────────────────────────────

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user === 'your-email@gmail.com') {
    return null; // Email not configured — skip silently
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
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
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[EmailService] SMTP not configured — skipping email for reminder', payload.reminderId);
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Slack AI Assistant';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
  const preview = payload.messageContent.length > 200
    ? payload.messageContent.slice(0, 200) + '…'
    : payload.messageContent;

  const setAtFormatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(payload.setAt);

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
        <a href="http://localhost:7505/dashboard">Open Workspace →</a>
      </div>
    </div>
    <div class="footer">
      <p>This reminder was set in your Slack AI Workspace Assistant. You can dismiss it in the app.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `🔔 Message Reminder\n\nHi ${payload.toName},\n\nYou asked to be reminded about this message:\n\n"${preview}"\n\n${payload.channelName ? `Channel: #${payload.channelName}\n` : ''}Reminder set at: ${setAtFormatted}\n\nOpen the app: http://localhost:7505/dashboard`;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${payload.toName}" <${payload.toEmail}>`,
      subject: `🔔 Reminder: Message in ${payload.channelName || 'your workspace'}`,
      text,
      html
    });
    console.log(`[EmailService] Reminder email sent to ${payload.toEmail} for reminder #${payload.reminderId}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send reminder email for #${payload.reminderId}:`, err);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  const user = process.env.SMTP_USER;
  return !!(user && user !== 'your-email@gmail.com');
}

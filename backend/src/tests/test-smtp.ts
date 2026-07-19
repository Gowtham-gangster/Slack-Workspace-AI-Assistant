import dotenv from 'dotenv';
import dns from 'dns';
import nodemailer from 'nodemailer';

dotenv.config();

async function run() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`Connecting to ${host}:${port} (secure: ${secure}) using user: ${user}`);
  
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    lookup: (hostname: string, options: any, callback: any) => {
      console.log(`[DNS Lookup] resolving: ${hostname} with options:`, options);
      dns.lookup(hostname, { ...options, family: 4 }, (err, address, family) => {
        console.log(`[DNS Result] address: ${address}, family: ${family}, error: ${err}`);
        callback(err, address, family);
      });
    }
  } as any);

  try {
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('✓ Success! Connected to SMTP server.');
  } catch (err) {
    console.error('✗ Failure connecting to SMTP server:', err);
  }
}

run().catch(console.error);

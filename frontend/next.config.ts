import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const WS_BACKEND_URL = BACKEND_URL.replace(/^http/, 'ws');

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy — restrict browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  },
  // HSTS — force HTTPS for 1 year (only meaningful in production)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // XSS protection for older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `connect-src 'self' ${BACKEND_URL} ${WS_BACKEND_URL} http://127.0.0.1:3001 ws://127.0.0.1:3001 https://accounts.google.com https://oauth2.googleapis.com https://generativelanguage.googleapis.com`,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob: " + BACKEND_URL + " http://127.0.0.1:3001",
      "media-src 'self' " + BACKEND_URL + " http://127.0.0.1:3001",
      "frame-src https://accounts.google.com " + BACKEND_URL + " http://127.0.0.1:3001",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

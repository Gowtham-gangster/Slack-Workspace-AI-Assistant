import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Security middleware: Helmet + CSP + HSTS + all security headers
 * Applies enterprise-grade HTTP security headers to every response.
 */
export const securityMiddleware: RequestHandler[] = [
  // Core Helmet with conservative defaults
  helmet({
    // Strict Transport Security — force HTTPS for 1 year
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Prevent MIME type sniffing
    noSniff: true,
    // Disable X-Powered-By header (don't reveal Express)
    hidePoweredBy: true,
    // XSS filter for older browsers
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Content Security Policy — permissive for API server, restrictive for browser
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://generativelanguage.googleapis.com', 'https://api.openai.com', 'https://oauth2.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    // Permissions policy — restrict browser features
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        accelerometer: [],
        gyroscope: [],
        magnetometer: [],
      },
    },
  } as any),
];

/**
 * Input sanitizer — strip dangerous characters from string fields.
 * Guards against XSS in body/query params before route handlers.
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove script tags, event handlers
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input !== null && typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      cleaned[key] = sanitizeInput(value);
    }
    return cleaned;
  }
  return input;
}

import { Request, Response, NextFunction } from 'express';

/**
 * Body sanitizer middleware — sanitize req.body in place.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
}

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Helper to build a consistent rate limiter.
 */
function buildLimiter(windowMinutes: number, maxRequests: number, message: string) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,    // Disable X-RateLimit-* headers
    message: {
      error: message,
      retryAfter: `${windowMinutes} minute${windowMinutes !== 1 ? 's' : ''}`,
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: message,
        retryAfter: `${windowMinutes} minute${windowMinutes !== 1 ? 's' : ''}`,
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  });
}

/**
 * Auth routes — strict limit to prevent brute force attacks.
 * 10 attempts per 15 minutes per IP.
 */
export const authLimiter = buildLimiter(
  15,
  10,
  'Too many authentication attempts. Please wait 15 minutes and try again.'
);

/**
 * Channel sync — expensive Slack API calls.
 * 5 sync requests per minute per IP.
 */
export const syncLimiter = buildLimiter(
  1,
  5,
  'Too many sync requests. Please wait a moment before syncing again.'
);

/**
 * AI Summarization — expensive LLM calls.
 * 20 summaries per minute per IP.
 */
export const summarizeLimiter = buildLimiter(
  1,
  20,
  'Summarization rate limit reached. Please wait a moment before requesting more summaries.'
);

/**
 * Report generation — expensive AI calls.
 * 10 reports per minute per IP.
 */
export const reportLimiter = buildLimiter(
  1,
  10,
  'Report generation rate limit reached. Please wait before generating more reports.'
);

/**
 * Message search & retrieval — moderate limit.
 * 60 search requests per minute per IP.
 */
export const searchLimiter = buildLimiter(
  1,
  60,
  'Search rate limit reached. Please slow down your requests.'
);

/**
 * General API limiter — fallback for all other routes.
 * 200 requests per minute per IP.
 */
export const generalLimiter = buildLimiter(
  1,
  200,
  'Too many requests. Please slow down.'
);

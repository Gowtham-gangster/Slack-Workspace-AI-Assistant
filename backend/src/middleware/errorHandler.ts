import { Request, Response, NextFunction } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Global error handler — must be registered LAST in Express middleware chain.
 * Never exposes stack traces or internal details in production.
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  // Log full error internally
  const requestId = (req as any).requestId || 'unknown';
  console.error(`[ERROR] requestId=${requestId} method=${req.method} path=${req.path}`, err);

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Never expose internals in production
  const message = IS_PRODUCTION
    ? getProductionMessage(statusCode, err)
    : (err.message || 'An unexpected error occurred.');

  res.status(statusCode).json({ error: message });
}

function getProductionMessage(status: number, err: any): string {
  // Allow explicit user-facing errors through
  if (err.isUserFacing && err.message) {
    return err.message;
  }
  switch (status) {
    case 400: return 'Bad request. Please check your input.';
    case 401: return 'Authentication required.';
    case 403: return 'You do not have permission to access this resource.';
    case 404: return 'The requested resource was not found.';
    case 409: return 'A conflict occurred. The resource may already exist.';
    case 422: return 'Validation failed. Please check your input.';
    case 429: return 'Too many requests. Please slow down.';
    default:  return 'An internal server error occurred. Please try again later.';
  }
}

/**
 * Request ID middleware — add unique trace ID to every request.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Not found handler — catch all unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
}

/**
 * Sanitizes AI/LLM errors into clean user-facing messages.
 * Prevents raw JSON blobs (429 rate limit errors) from being shown to users.
 */
export function sanitizeAIError(error: any, fallbackMessage = 'AI service is temporarily unavailable. Please try again.'): string {
  const msg: string = error?.message || String(error) || '';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate-limit')) {
    return 'AI quota exceeded. Please wait a moment and try again.';
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
    return 'AI service is temporarily overloaded. Please try again in a few seconds.';
  }
  if (msg.includes('401') || msg.includes('API key') || msg.includes('invalid_auth')) {
    return 'AI API key is invalid or not configured. Please check your Settings.';
  }
  if (msg.includes('LLM error')) {
    // Strip out raw JSON blobs from LLM error messages
    return fallbackMessage;
  }
  // If the message looks like it could contain a JSON blob, sanitize it
  if (msg.includes('"code"') || msg.includes('"message"') || msg.includes('"status"')) {
    return fallbackMessage;
  }
  return fallbackMessage;
}

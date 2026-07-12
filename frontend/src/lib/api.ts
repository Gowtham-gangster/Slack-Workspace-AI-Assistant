const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// ─── Token Storage ────────────────────────────────────────────────────────────
// Desktop: sessionStorage (clears when tab closes)
// Mobile:  localStorage (persists until logout)

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    if (isMobileDevice()) {
      return localStorage.getItem('slack_ai_token');
    } else {
      return sessionStorage.getItem('slack_ai_token');
    }
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (typeof window !== 'undefined') {
    const isMobile = isMobileDevice();
    if (token) {
      if (isMobile) {
        localStorage.setItem('slack_ai_token', token);
      } else {
        sessionStorage.setItem('slack_ai_token', token);
      }
    } else {
      localStorage.removeItem('slack_ai_token');
      sessionStorage.removeItem('slack_ai_token');
    }
  }
}

function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('slack_ai_refresh_token');
  }
  return null;
}

function setRefreshToken(token: string | null): void {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('slack_ai_refresh_token', token);
    } else {
      localStorage.removeItem('slack_ai_refresh_token');
    }
  }
}

export { setRefreshToken, getRefreshToken };

// ─── Token Refresh ────────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed — clear all tokens
      setAuthToken(null);
      setRefreshToken(null);
      return null;
    }

    const data = await response.json();
    setAuthToken(data.token);
    setRefreshToken(data.refreshToken);
    return data.token;
  } catch {
    setAuthToken(null);
    setRefreshToken(null);
    return null;
  }
}

// ─── API Fetch ────────────────────────────────────────────────────────────────

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string>;
  body?: any;
  _isRetry?: boolean; // Internal flag — prevent infinite refresh loops
}

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const apiCache = new Map<string, CacheEntry>();
const activeRequests = new Map<string, Promise<any>>();

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  // Generate cache key for GET requests
  const paramsStr = options.params ? new URLSearchParams(options.params).toString() : '';
  const requestKey = `${method}:${path}:${paramsStr}`;

  if (isGet) {
    // Check client-side memory cache
    const cached = apiCache.get(requestKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check in-flight active requests (request deduplication)
    const active = activeRequests.get(requestKey);
    if (active) {
      return active;
    }
  }

  // Define actual fetch runner
  const runRequest = async (): Promise<any> => {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      headers.set('Content-Type', 'application/json');
      options.body = JSON.stringify(options.body);
    }

    let url = `${BACKEND_URL}${path}`;
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const { _isRetry, ...fetchOptions } = options;

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // ── Token Expired — attempt refresh ──────────────────────────────────────
    if (response.status === 401 && !_isRetry) {
      let errorData: any = {};
      try { errorData = await response.clone().json(); } catch {}

      if (errorData?.code === 'TOKEN_EXPIRED') {
        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await attemptTokenRefresh();
          isRefreshing = false;

          refreshQueue.forEach((cb) => cb(newToken));
          refreshQueue = [];

          if (newToken) {
            return apiFetch(path, { ...options, _isRetry: true });
          } else {
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            throw new Error('Session expired. Please log in again.');
          }
        } else {
          return new Promise((resolve, reject) => {
            refreshQueue.push(async (newToken: string | null) => {
              if (newToken) {
                try {
                  resolve(await apiFetch(path, { ...options, _isRetry: true }));
                } catch (e) {
                  reject(e);
                }
              } else {
                reject(new Error('Session expired. Please log in again.'));
              }
            });
          });
        }
      }
    }

    if (!response.ok) {
      let errorMsg = `Request failed with status ${response.status}`;
      try {
        const data = await response.json();
        errorMsg = data.error || errorMsg;
      } catch (e) {
        try {
          errorMsg = await response.text() || errorMsg;
        } catch (_) {}
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  };

  if (isGet) {
    const promise = runRequest()
      .then((data) => {
        // Cache successful response for 5 seconds (absorb navigation duplicate fetches)
        apiCache.set(requestKey, {
          data,
          expiresAt: Date.now() + 5000,
        });
        activeRequests.delete(requestKey);
        return data;
      })
      .catch((err) => {
        activeRequests.delete(requestKey);
        throw err;
      });

    activeRequests.set(requestKey, promise);
    return promise;
  } else {
    // For non-GET mutations, invalidate client-side cache
    apiCache.clear();
    return runRequest();
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string>;
  body?: any;
}

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<any> {
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

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      // JSON parsing failed, use status text
      try {
        errorMsg = await response.text() || errorMsg;
      } catch (_) {}
    }
    throw new Error(errorMsg);
  }

  // Handle empty or 204 responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

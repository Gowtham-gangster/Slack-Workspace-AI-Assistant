import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const credential = url.searchParams.get('credential') || url.searchParams.get('id_token') || url.searchParams.get('token');
  
  if (!credential) {
    return NextResponse.redirect(new URL('/login?error=Google authentication credential missing', request.url), 303);
  }
  return processGoogleCredential(credential, request.url);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const credential = formData.get('credential') as string;

    if (!credential) {
      return NextResponse.redirect(new URL('/login?error=Google authentication failed', request.url), 303);
    }
    return processGoogleCredential(credential, request.url);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login?error=Authentication server error', request.url), 303);
  }
}

async function processGoogleCredential(credential: string, requestUrl: string) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.error || 'Google authentication failed';
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, requestUrl), 303);
    }

    const data = await res.json();
    const params = new URLSearchParams();
    params.set('g_token', data.token);
    if (data.refreshToken) {
      params.set('g_refresh', data.refreshToken);
    }
    params.set('g_user', JSON.stringify(data.user));

    return NextResponse.redirect(new URL(`/login?${params.toString()}`, requestUrl), 303);
  } catch (err: any) {
    console.error('Google OAuth processing error:', err);
    return NextResponse.redirect(new URL('/login?error=Authentication server error', requestUrl), 303);
  }
}

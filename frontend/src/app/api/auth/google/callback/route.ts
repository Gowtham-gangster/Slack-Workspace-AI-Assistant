import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const credential = formData.get('credential') as string;

    if (!credential) {
      return NextResponse.redirect(new URL('/login?error=Google authentication failed', request.url), 303);
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.error || 'Google authentication failed';
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url), 303);
    }

    const data = await res.json();
    const params = new URLSearchParams();
    params.set('g_token', data.token);
    if (data.refreshToken) {
      params.set('g_refresh', data.refreshToken);
    }
    params.set('g_user', JSON.stringify(data.user));

    return NextResponse.redirect(new URL(`/login?${params.toString()}`, request.url), 303);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login?error=Authentication server error', request.url), 303);
  }
}

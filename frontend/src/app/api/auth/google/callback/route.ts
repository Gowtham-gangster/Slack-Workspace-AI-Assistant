import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const credential = url.searchParams.get('credential') || url.searchParams.get('id_token') || url.searchParams.get('token');
  
  if (credential) {
    return processGoogleCredential(credential, request.url);
  }

  // Client-side fallback to parse hash fragments (#id_token=...) sent by Google OAuth Implicit flow
  const html = `<!DOCTYPE html>
<html>
<head><title>Completing Google Authentication...</title></head>
<body style="background-color:#030408;color:#ffffff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <div style="width:32px;height:32px;border:3px solid rgba(124,106,247,0.3);border-top-color:#7c6af7;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
    <p style="font-size:14px;color:#a1a1aa;">Completing authentication...</p>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
  <script>
    (function() {
      var hash = window.location.hash.substring(1);
      var params = new URLSearchParams(hash);
      var token = params.get('id_token') || params.get('credential') || params.get('access_token');
      if (token) {
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/auth/google/callback';
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'credential';
        input.value = token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      } else {
        window.location.href = '/login?error=' + encodeURIComponent('Google authentication credential missing');
      }
    })();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const credential = (formData.get('credential') || formData.get('id_token')) as string;

    if (!credential) {
      return NextResponse.redirect(new URL('/login?error=Google authentication credential missing', request.url), 303);
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

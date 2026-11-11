import { NextResponse } from 'next/server';

import { GOOGLE_ERROR_PARAM } from '@/app/login/schema';
import { createClient } from '@/lib/supabase/server';

// Where Supabase sends the browser after Google. A `code` means the user approved;
// swapping it for a session sets the auth cookies. Anything else is a failed or
// cancelled sign-in, and /login shows the message.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const siteOrigin = getSiteOrigin(request);
  const failureUrl = `${siteOrigin}/login?error=${GOOGLE_ERROR_PARAM}`;

  if (!code) {
    return NextResponse.redirect(failureUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(failureUrl);
  }

  return NextResponse.redirect(`${siteOrigin}/dashboard`);
}

// Behind Vercel's proxy the request URL carries the internal host; the forwarded one is
// the real site. Every redirect goes through here so success and failure land on the
// same host.
function getSiteOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';

  if (!forwardedHost || isLocal) {
    return origin;
  }

  return `https://${forwardedHost}`;
}

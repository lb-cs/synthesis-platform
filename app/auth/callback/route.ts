import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// Where Supabase sends the browser after Google. A `code` means the user approved;
// swapping it for a session sets the auth cookies. Anything else is a failed or
// cancelled sign-in, and /login shows the message.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  // Behind Vercel's proxy `origin` is the internal host; the forwarded one is the real site.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';

  if (forwardedHost && !isLocal) {
    return NextResponse.redirect(`https://${forwardedHost}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

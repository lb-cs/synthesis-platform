import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Reachable signed out. Everything else redirects to /login.
const PUBLIC_PATHS = ['/', '/login', '/api/health'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() — it can log users out.
  // getClaims() verifies the JWT; getSession() would trust a spoofable cookie.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && !PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Must return supabaseResponse as-is, or refreshed auth cookies never reach the browser.
  return supabaseResponse;
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Reachable signed out. Everything else redirects to /login. `/` is handled separately.
const PUBLIC_PATHS = ['/home', '/login', '/api/health'];

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

  // `/` has no page of its own: signed in goes to the dashboard, signed out to the landing.
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/dashboard' : '/home';
    return redirectWithSession(url, supabaseResponse);
  }

  if (!user && !PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Signed-in users have no business on the sign-in form.
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectWithSession(url, supabaseResponse);
  }

  // Must return supabaseResponse as-is, or refreshed auth cookies never reach the browser.
  return supabaseResponse;
}

// A fresh response drops the refreshed session. Copy the cookies and cache headers over,
// as the Supabase docs require for any response other than supabaseResponse.
function redirectWithSession(url: URL, supabaseResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = supabaseResponse.headers.get(header);
    if (value) {
      response.headers.set(header, value);
    }
  }
  return response;
}


import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The cookie name for the Firebase session
const FIREBASE_SESSION_COOKIE = '__session';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // If user has a session and tries to access a public route (like login),
  // redirect them to the dashboard.
  if (sessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user does not have a session and tries to access a protected route,
  // redirect them to the login page.
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request to proceed if none of the above conditions are met
  return NextResponse.next();
}

// Configure the middleware to run on all routes except for static assets
// and internal Next.js paths.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
}

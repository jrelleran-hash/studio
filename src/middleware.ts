
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware is currently disabled.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
}

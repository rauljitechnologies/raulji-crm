import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/register', '/forgot-password', '/reset-password', '/accept-invite'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname.includes('.');
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get('accessToken')?.value;
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

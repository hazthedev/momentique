// ============================================
// MOMENTIQUE - Next.js Middleware
// ============================================
// Tenant resolution and authentication

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure middleware to use Node.js runtime (required for database access)
export const runtime = 'nodejs';

/**
 * Next.js middleware
 * Runs on every request (except static files)
 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // For local development, inject default tenant headers
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1') || hostname.startsWith('192.168.')) {
    const headers = new Headers(request.headers);
    headers.set('x-tenant-id', '00000000-0000-0000-0000-000000000001');
    headers.set('x-tenant-type', 'master');
    headers.set('x-tenant-tier', 'enterprise');
    headers.set('x-tenant-name', 'Gatherly Dev');
    headers.set('x-tenant-branding', JSON.stringify({
      primary_color: '#8B5CF6',
      secondary_color: '#EC4899',
      accent_color: '#F59E0B',
    }));
    headers.set('x-tenant-features', JSON.stringify({
      lucky_draw: true,
      photo_reactions: true,
      video_uploads: true,
      custom_templates: true,
      api_access: true,
      sso: true,
      white_label: true,
      advanced_analytics: true,
    }));
    headers.set('x-tenant-limits', JSON.stringify({
      max_events_per_month: -1,
      max_storage_gb: -1,
      max_admins: -1,
      max_photos_per_event: -1,
      max_draw_entries_per_event: -1,
    }));
    headers.set('x-is-custom-domain', 'false');
    headers.set('x-is-master', 'true');
    return NextResponse.next({ request: { headers } });
  }

  // For production, the tenant resolution would happen here
  // For now, just pass through
  return NextResponse.next();
}

/**
 * Configure which paths the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

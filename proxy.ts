// ============================================
// Galeria - Next.js Middleware
// ============================================
// Tenant resolution and authentication

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_HOST = process.env.NEXT_PUBLIC_APP_URL
  ? stripHostPort(process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, ''))
  : '';
const MASTER_HOST = (process.env.NEXT_PUBLIC_MASTER_DOMAIN || '').trim().toLowerCase();

function stripHostPort(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();

  // IPv6 host format: [::1]:3000 or [::1]
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end > 0) {
      return host.slice(1, end);
    }
    return host;
  }

  // IPv4/hostname format: host:port or host
  const parts = host.split(':');
  return parts[0];
}

function isPrivateIpv4(host: string): boolean {
  if (host.startsWith('10.') || host.startsWith('127.') || host.startsWith('192.168.')) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  const match172 = host.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function isLocalDevHost(hostHeader: string): boolean {
  const host = stripHostPort(hostHeader);

  if (host === 'localhost' || host === '::1') {
    return true;
  }

  if (isPrivateIpv4(host)) {
    return true;
  }

  // mDNS / local machine hostnames often used by mobile testing
  if (host.endsWith('.local')) {
    return true;
  }

  // Hostnames without dots (e.g., DESKTOP-ABC123) in local LAN
  if (!host.includes('.')) {
    return true;
  }

  return false;
}

function isPrimaryAppHost(hostHeader: string): boolean {
  const host = stripHostPort(hostHeader);
  if (!host) {
    return false;
  }

  if (APP_HOST && host === APP_HOST) {
    return true;
  }

  if (MASTER_HOST && host === MASTER_HOST) {
    return true;
  }

  return false;
}

/**
 * Next.js proxy
 * Runs on every request (except static files)
 */
export async function proxy(request: NextRequest) {
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

  // Inject default tenant headers for:
  // 1) local/LAN/mobile-dev hosts
  // 2) configured primary app domain (single-tenant deployments)
  if (isLocalDevHost(hostname) || isPrimaryAppHost(hostname)) {
    const headers = new Headers(request.headers);
    headers.set('x-tenant-id', '00000000-0000-0000-0000-000000000001');
    headers.set('x-tenant-type', 'master');
    headers.set('x-tenant-tier', 'enterprise');
    headers.set('x-tenant-name', 'Galeria Dev');
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


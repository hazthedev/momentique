// ============================================
// GATHERLY - Tenant Resolution Middleware
// ============================================
// Handles multi-tenant routing via custom domains and subdomains

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getTenantDb } from './db';
import type { ITenant, ITenantContext, TenantType, SubscriptionTier } from './types';

// ============================================
// CONFIGURATION
// ============================================

const MASTER_DOMAIN = process.env.NEXT_PUBLIC_MASTER_DOMAIN || 'app.gatherly.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Cache tenant lookups to reduce database queries
const tenantCache = new Map<string, { tenant: ITenant; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// TENANT RESOLUTION
// ============================================

/**
 * Extract tenant identifier from hostname
 * Priority:
 * 1. Custom domain (e.g., events.luxeevents.com)
 * 2. Subdomain (e.g., luxeevents.app.gatherly.com)
 * 3. Master tenant (fallback)
 */
export function extractTenantIdentifier(hostname: string): {
  type: 'custom_domain' | 'subdomain' | 'master' | 'local';
  identifier: string | null;
} {
  // Local development
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    return { type: 'local', identifier: null };
  }

  // Check for custom domain
  // Custom domains don't match the master domain pattern
  if (!hostname.endsWith(MASTER_DOMAIN) && !hostname.endsWith(APP_URL.replace(/^https?:\/\//, ''))) {
    return { type: 'custom_domain', identifier: hostname };
  }

  // Extract subdomain from hostname
  // e.g., luxeevents.app.gatherly.com -> luxeevents
  const parts = hostname.split('.');

  // Handle subdomain.app.masterdomain.com format
  if (parts.length >= 4) {
    const subdomain = parts[0];
    return { type: 'subdomain', identifier: subdomain };
  }

  // Handle subdomain.masterdomain.com format
  if (parts.length === 3 && parts[0] !== 'www' && parts[0] !== 'app') {
    const subdomain = parts[0];
    return { type: 'subdomain', identifier: subdomain };
  }

  // Fallback to master tenant
  return { type: 'master', identifier: null };
}

/**
 * Get tenant by custom domain
 */
export async function getTenantByDomain(domain: string): Promise<ITenant | null> {
  const cacheKey = `domain:${domain}`;
  const cached = tenantCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  try {
    const db = getTenantDb('00000000-0000-0000-0000-000000000000'); // System DB for tenant lookup
    const tenant = await db.findOne<ITenant>('tenants', {
      domain: domain,
      status: 'active',
    });

    if (tenant) {
      tenantCache.set(cacheKey, {
        tenant,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return tenant;
  } catch (error) {
    console.error('[Tenant] Error fetching tenant by domain:', error);
    return null;
  }
}

/**
 * Get tenant by subdomain
 */
export async function getTenantBySubdomain(subdomain: string): Promise<ITenant | null> {
  const cacheKey = `subdomain:${subdomain}`;
  const cached = tenantCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  try {
    const db = getTenantDb('00000000-0000-0000-0000-000000000000'); // System DB for tenant lookup
    const tenant = await db.findOne<ITenant>('tenants', {
      subdomain: subdomain,
      status: 'active',
    });

    if (tenant) {
      tenantCache.set(cacheKey, {
        tenant,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return tenant;
  } catch (error) {
    console.error('[Tenant] Error fetching tenant by subdomain:', error);
    return null;
  }
}

/**
 * Get master tenant
 */
export async function getMasterTenant(): Promise<ITenant | null> {
  const cacheKey = 'master';
  const cached = tenantCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  try {
    const db = getTenantDb('00000000-0000-0000-0000-000000000000'); // System DB for tenant lookup
    const tenant = await db.findOne<ITenant>('tenants', {
      tenant_type: 'master',
      status: 'active',
    });

    if (!tenant && process.env.AUTO_SEED_MASTER_TENANT === 'true') {
      const seeded = await seedMasterTenant();
      if (seeded) {
        tenantCache.set(cacheKey, {
          tenant: seeded,
          expiresAt: Date.now() + CACHE_TTL,
        });
        return seeded;
      }
    }

    if (tenant) {
      tenantCache.set(cacheKey, {
        tenant,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return tenant;
  } catch (error) {
    console.error('[Tenant] Error fetching master tenant:', error);
    return null;
  }
}

/**
 * Resolve tenant from request hostname
 */
export async function resolveTenant(hostname: string): Promise<ITenant | null> {
  const { type, identifier } = extractTenantIdentifier(hostname);

  // Local development - use master tenant
  if (type === 'local') {
    return await getMasterTenant();
  }

  // Custom domain
  if (type === 'custom_domain' && identifier) {
    return await getTenantByDomain(identifier);
  }

  // Subdomain
  if (type === 'subdomain' && identifier) {
    return await getTenantBySubdomain(identifier);
  }

  // Master tenant
  return await getMasterTenant();
}

/**
 * Create tenant context for request
 */
export async function createTenantContext(hostname: string): Promise<ITenantContext | null> {
  const tenant = await resolveTenant(hostname);

  if (!tenant) {
    return null;
  }

  const { type } = extractTenantIdentifier(hostname);

  return {
    tenant,
    is_custom_domain: type === 'custom_domain',
    is_master: tenant.tenant_type === 'master',
  };
}

// ============================================
// NEXT.JS MIDDLEWARE
// ============================================

/**
 * Next.js middleware for tenant resolution
 * Injects tenant context into request headers
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl;

  console.log('[Middleware] Processing request:', {
    hostname,
    pathname: url.pathname,
  });

  // Resolve tenant
  const tenantContext = await createTenantContext(hostname);

  // No tenant found - this could be:
  // 1. An invalid domain (show 404)
  // 2. A new custom domain not yet configured
  // 3. System error
  if (!tenantContext) {
    // For API routes, return 404
    if (url.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For pages, show 404 page
    return new NextResponse('Tenant not found', { status: 404 });
  }

  // Check if tenant is suspended
  if (tenantContext.tenant.status === 'suspended') {
    if (url.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Tenant suspended' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Show suspended page
    return NextResponse.rewrite(new URL('/suspended', request.url));
  }

  // Check if tenant trial has expired
  if (
    tenantContext.tenant.trial_ends_at &&
    new Date() > tenantContext.tenant.trial_ends_at
  ) {
    // TODO: Handle trial expiration
    console.log('[Middleware] Trial expired for tenant:', tenantContext.tenant.id);
  }

  // Create response with tenant context injected into headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Inject tenant context as headers
  response.headers.set('x-tenant-id', tenantContext.tenant.id);
  response.headers.set('x-tenant-type', tenantContext.tenant.tenant_type);
  response.headers.set('x-tenant-tier', tenantContext.tenant.subscription_tier);
  response.headers.set(
    'x-tenant-branding',
    JSON.stringify(tenantContext.tenant.branding)
  );
  response.headers.set(
    'x-tenant-features',
    JSON.stringify(tenantContext.tenant.features_enabled)
  );
  response.headers.set(
    'x-tenant-limits',
    JSON.stringify(tenantContext.tenant.limits)
  );

  // Inject tenant context flags
  response.headers.set('x-is-custom-domain', tenantContext.is_custom_domain.toString());
  response.headers.set('x-is-master', tenantContext.is_master.toString());

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

// ============================================
// SERVER-SIDE HELPER FUNCTIONS
// ============================================

/**
 * Get tenant context from headers (server-side)
 */
export function getTenantContextFromHeaders(headers: Headers): ITenantContext | null {
  const tenantId = headers.get('x-tenant-id');
  const tenantType = headers.get('x-tenant-type');
  const tenantTier = headers.get('x-tenant-tier');
  const brandingStr = headers.get('x-tenant-branding');
  const featuresStr = headers.get('x-tenant-features');
  const limitsStr = headers.get('x-tenant-limits');
  const isCustomDomain = headers.get('x-is-custom-domain') === 'true';
  const isMaster = headers.get('x-is-master') === 'true';

  if (!tenantId || !tenantType || !brandingStr || !featuresStr || !limitsStr) {
    return null;
  }

  try {
    return {
      tenant: {
        id: tenantId,
        tenant_type: tenantType as TenantType,
        brand_name: '', // Will be populated by DB
        company_name: '',
        contact_email: '',
        is_custom_domain: isCustomDomain,
        subscription_tier: tenantTier as SubscriptionTier,
        branding: JSON.parse(brandingStr),
        features_enabled: JSON.parse(featuresStr),
        limits: JSON.parse(limitsStr),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      is_custom_domain: isCustomDomain,
      is_master: isMaster,
    };
  } catch (error) {
    console.error('[Tenant] Error parsing tenant context from headers:', error);
    return null;
  }
}

/**
 * Get tenant ID from headers (server-side)
 */
export function getTenantId(headers: Headers): string | null {
  return headers.get('x-tenant-id');
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear tenant cache
 */
export function clearTenantCache(tenantId?: string): void {
  if (tenantId) {
    // Clear specific tenant from cache
    for (const [key, value] of tenantCache.entries()) {
      if (value.tenant.id === tenantId) {
        tenantCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    tenantCache.clear();
  }
}

/**
 * Warm up tenant cache (for startup)
 */
export async function warmTenantCache(): Promise<void> {
  try {
    const db = getTenantDb('00000000-0000-0000-0000-000000000000');
    const tenants = await db.findMany<ITenant>('tenants', { status: 'active' });

    for (const tenant of tenants) {
      if (tenant.domain) {
        tenantCache.set(`domain:${tenant.domain}`, {
          tenant,
          expiresAt: Date.now() + CACHE_TTL,
        });
      }
      if (tenant.subdomain) {
        tenantCache.set(`subdomain:${tenant.subdomain}`, {
          tenant,
          expiresAt: Date.now() + CACHE_TTL,
        });
      }
      if (tenant.tenant_type === 'master') {
        tenantCache.set('master', {
          tenant,
          expiresAt: Date.now() + CACHE_TTL,
        });
      }
    }

    console.log(`[Tenant] Warmed cache with ${tenants.length} tenants`);
  } catch (error) {
    console.error('[Tenant] Error warming cache:', error);
  }
}

// ============================================
// TENANT CREATION
// ============================================

interface ICreateTenantInput {
  tenant_type: 'master' | 'white_label' | 'demo';
  brand_name: string;
  company_name: string;
  contact_email: string;
  domain?: string;
  subdomain?: string;
  subscription_tier?: 'free' | 'pro' | 'premium' | 'enterprise';
}

/**
 * Create a new tenant
 */
export async function createTenant(input: ICreateTenantInput): Promise<ITenant> {
  const db = getTenantDb('00000000-0000-0000-0000-000000000000');

  // Generate unique subdomain if not provided
  let subdomain = input.subdomain;
  if (!subdomain && input.tenant_type === 'white_label') {
    subdomain = generateSubdomain(input.brand_name);
  }

  // Check if domain/subdomain is already taken
  if (input.domain) {
    const existingDomain = await db.findOne<ITenant>('tenants', {
      domain: input.domain,
    });
    if (existingDomain) {
      throw new Error('Domain already taken');
    }
  }

  if (subdomain) {
    const existingSubdomain = await db.findOne<ITenant>('tenants', {
      subdomain: subdomain,
    });
    if (existingSubdomain) {
      throw new Error('Subdomain already taken');
    }
  }

  // Create tenant with default branding
  const tenantId = crypto.randomUUID();
  const tenant = await db.insert<ITenant>('tenants', {
    id: tenantId,
    tenant_type: input.tenant_type,
    brand_name: input.brand_name,
    company_name: input.company_name,
    contact_email: input.contact_email,
    domain: input.domain,
    subdomain: subdomain,
    is_custom_domain: !!input.domain,
    branding: {
      primary_color: '#8B5CF6',
      secondary_color: '#EC4899',
      accent_color: '#F59E0B',
    },
    subscription_tier: input.subscription_tier || 'free',
    features_enabled: getDefaultFeatures(input.subscription_tier || 'free'),
    limits: getDefaultLimits(input.subscription_tier || 'free'),
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Clear cache so new tenant is immediately available
  clearTenantCache();

  return tenant;
}

// ============================================
// MASTER TENANT AUTO-SEED
// ============================================

async function seedMasterTenant(): Promise<ITenant | null> {
  try {
    const db = getTenantDb('00000000-0000-0000-0000-000000000000');
    const masterId = process.env.MASTER_TENANT_ID || '00000000-0000-0000-0000-000000000001';
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Momentique';
    const masterDomain = process.env.NEXT_PUBLIC_MASTER_DOMAIN || 'app.momentique.com';
    const contactEmail = process.env.MASTER_TENANT_CONTACT_EMAIL || `admin@${masterDomain}`;

    const existing = await db.findOne<ITenant>('tenants', { id: masterId });
    if (existing) {
      return existing;
    }

    const tenant = await db.insert<ITenant>('tenants', {
      id: masterId,
      tenant_type: 'master',
      brand_name: appName,
      company_name: appName,
      contact_email: contactEmail,
      is_custom_domain: false,
      branding: {
        primary_color: '#7c3aed',
        secondary_color: '#ec4899',
        accent_color: '#f59e0b',
      },
      subscription_tier: 'enterprise',
      features_enabled: getDefaultFeatures('enterprise'),
      limits: getDefaultLimits('enterprise'),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log('[Tenant] Seeded master tenant', { id: masterId, domain: masterDomain });
    return tenant;
  } catch (error) {
    console.error('[Tenant] Failed to seed master tenant:', error);
    return null;
  }
}

/**
 * Generate a unique subdomain from brand name
 */
function generateSubdomain(brandName: string): string {
  const base = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

/**
 * Get default features for subscription tier
 */
function getDefaultFeatures(tier: string) {
  const defaults = {
    free: {
      lucky_draw: false, // Upgrade required for lucky draw
      photo_reactions: true,
      video_uploads: false,
      custom_templates: false,
      api_access: false,
      sso: false,
      white_label: false, // Shows "Powered by Gatherly"
      advanced_analytics: false,
    },
    pro: {
      lucky_draw: true,
      photo_reactions: true,
      video_uploads: false,
      custom_templates: true,
      api_access: false,
      sso: false,
      white_label: true, // No branding watermark
      advanced_analytics: true,
    },
    premium: {
      lucky_draw: true,
      photo_reactions: true,
      video_uploads: true,
      custom_templates: true,
      api_access: true,
      sso: false,
      white_label: true,
      advanced_analytics: true,
    },
    enterprise: {
      lucky_draw: true,
      photo_reactions: true,
      video_uploads: true,
      custom_templates: true,
      api_access: true,
      sso: true,
      white_label: true,
      advanced_analytics: true,
    },
  };

  return defaults[tier as keyof typeof defaults] || defaults.free;
}

/**
 * Get default limits for subscription tier
 */
function getDefaultLimits(tier: string) {
  const defaults = {
    free: {
      max_events_per_month: 1,
      max_storage_gb: 1,
      max_admins: 1,
      max_photos_per_event: 20, // Updated to match tier-config
      max_draw_entries_per_event: 0, // No lucky draw on free tier
      custom_features: [],
    },
    pro: {
      max_events_per_month: 10,
      max_storage_gb: 50,
      max_admins: 3,
      max_photos_per_event: 500,
      max_draw_entries_per_event: 200,
      custom_features: [],
    },
    premium: {
      max_events_per_month: 50,
      max_storage_gb: 200,
      max_admins: 10,
      max_photos_per_event: 2000,
      max_draw_entries_per_event: 1000,
      custom_features: [],
    },
    enterprise: {
      max_events_per_month: -1, // Unlimited
      max_storage_gb: -1, // Unlimited
      max_admins: -1, // Unlimited
      max_photos_per_event: -1, // Unlimited
      max_draw_entries_per_event: -1, // Unlimited
      custom_features: [],
    },
  };

  return defaults[tier as keyof typeof defaults] || defaults.free;
}

// ============================================
// TENANT VALIDATION
// ============================================

/**
 * Validate if a tenant can perform an action based on their limits
 */
export function validateTenantLimits(
  tenant: ITenant,
  action: 'create_event' | 'upload_photo' | 'add_draw_entry',
  currentUsage?: {
    events_this_month?: number;
    photos_in_event?: number;
    entries_in_event?: number;
  }
): { allowed: boolean; reason?: string } {
  const limits = tenant.limits;

  switch (action) {
    case 'create_event':
      if (
        limits.max_events_per_month !== -1 &&
        currentUsage?.events_this_month &&
        currentUsage.events_this_month >= limits.max_events_per_month
      ) {
        return {
          allowed: false,
          reason: `Monthly event limit reached (${limits.max_events_per_month})`,
        };
      }
      break;

    case 'upload_photo':
      if (
        limits.max_photos_per_event !== -1 &&
        currentUsage?.photos_in_event &&
        currentUsage.photos_in_event >= limits.max_photos_per_event
      ) {
        return {
          allowed: false,
          reason: `Photo limit reached for this event (${limits.max_photos_per_event})`,
        };
      }
      break;

    case 'add_draw_entry':
      if (
        limits.max_draw_entries_per_event !== -1 &&
        currentUsage?.entries_in_event &&
        currentUsage.entries_in_event >= limits.max_draw_entries_per_event
      ) {
        return {
          allowed: false,
          reason: `Draw entry limit reached (${limits.max_draw_entries_per_event})`,
        };
      }
      break;
  }

  return { allowed: true };
}

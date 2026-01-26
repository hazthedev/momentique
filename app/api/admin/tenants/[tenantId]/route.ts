// ============================================
// MOMENTIQUE - Admin Tenant Detail API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';
import { clearTenantCache } from '@/lib/tenant';
import type { ITenant, ITenantFeatures, ITenantLimits, SubscriptionTier, TenantStatus, TenantType } from '@/lib/types';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

type TenantUpdatePayload = {
  tenant_type?: TenantType;
  brand_name?: string;
  company_name?: string;
  contact_email?: string;
  domain?: string | null;
  subdomain?: string | null;
  subscription_tier?: SubscriptionTier;
  status?: TenantStatus;
  features_enabled?: ITenantFeatures;
  limits?: ITenantLimits;
};

function normalizeDomain(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function getTenantOr404(db: ReturnType<typeof getTenantDb>, tenantId: string) {
  const tenant = await db.findOne<ITenant>('tenants', { id: tenantId });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return tenant;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { tenantId } = await params;
    const db = getTenantDb(SYSTEM_TENANT_ID);
    const tenant = await getTenantOr404(db, tenantId);
    if (tenant instanceof NextResponse) {
      return tenant;
    }

    return NextResponse.json({ data: tenant });
  } catch (error) {
    console.error('[ADMIN_TENANT] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { tenantId } = await params;
    const db = getTenantDb(SYSTEM_TENANT_ID);
    const existing = await getTenantOr404(db, tenantId);
    if (existing instanceof NextResponse) {
      return existing;
    }

    const body = (await request.json()) as TenantUpdatePayload;
    const normalizedDomain = normalizeDomain(body.domain);
    const normalizedSubdomain = normalizeDomain(body.subdomain);

    if (normalizedDomain) {
      const domainConflict = await db.query<{ id: string }>(
        'SELECT id FROM tenants WHERE domain = $1 AND id <> $2 LIMIT 1',
        [normalizedDomain, tenantId]
      );
      if (domainConflict.rowCount) {
        return NextResponse.json(
          { error: 'Domain already taken', code: 'DOMAIN_TAKEN' },
          { status: 409 }
        );
      }
    }

    if (normalizedSubdomain) {
      const subdomainConflict = await db.query<{ id: string }>(
        'SELECT id FROM tenants WHERE subdomain = $1 AND id <> $2 LIMIT 1',
        [normalizedSubdomain, tenantId]
      );
      if (subdomainConflict.rowCount) {
        return NextResponse.json(
          { error: 'Subdomain already taken', code: 'SUBDOMAIN_TAKEN' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (body.tenant_type) updateData.tenant_type = body.tenant_type;
    if (body.brand_name !== undefined) updateData.brand_name = body.brand_name;
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.contact_email !== undefined) updateData.contact_email = body.contact_email;
    if (body.subscription_tier) updateData.subscription_tier = body.subscription_tier;
    if (body.status) updateData.status = body.status;
    if (body.features_enabled) updateData.features_enabled = body.features_enabled;
    if (body.limits) updateData.limits = body.limits;

    if (normalizedDomain !== undefined) {
      updateData.domain = normalizedDomain;
      updateData.is_custom_domain = !!normalizedDomain;
    }

    if (normalizedSubdomain !== undefined) {
      updateData.subdomain = normalizedSubdomain;
    }

    await db.update('tenants', updateData, { id: tenantId });
    clearTenantCache(tenantId);

    const updated = await db.findOne<ITenant>('tenants', { id: tenantId });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[ADMIN_TENANT] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update tenant', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { tenantId } = await params;
    const db = getTenantDb(SYSTEM_TENANT_ID);
    const tenant = await getTenantOr404(db, tenantId);
    if (tenant instanceof NextResponse) {
      return tenant;
    }

    if (tenant.tenant_type === 'master') {
      return NextResponse.json(
        { error: 'Cannot delete master tenant', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const deleted = await db.delete('tenants', { id: tenantId });
    if (!deleted) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    clearTenantCache(tenantId);

    return NextResponse.json({ message: 'Tenant deleted' });
  } catch (error) {
    console.error('[ADMIN_TENANT] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tenant', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

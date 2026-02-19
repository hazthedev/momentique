// ============================================
// Galeria - Admin Tenant Detail API (disabled)
// ============================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return NextResponse.json(
    { error: 'Tenants management is disabled', code: 'FEATURE_DISABLED' },
    { status: 410 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return NextResponse.json(
    { error: 'Tenants management is disabled', code: 'FEATURE_DISABLED' },
    { status: 410 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  return NextResponse.json(
    { error: 'Tenants management is disabled', code: 'FEATURE_DISABLED' },
    { status: 410 }
  );
}
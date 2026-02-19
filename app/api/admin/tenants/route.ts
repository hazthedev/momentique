// ============================================
// Galeria - Admin Tenants API (disabled)
// ============================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Tenants management is disabled', code: 'FEATURE_DISABLED' },
    { status: 410 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Tenants management is disabled', code: 'FEATURE_DISABLED' },
    { status: 410 }
  );
}
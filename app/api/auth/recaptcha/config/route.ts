// ============================================
// Galeria - reCAPTCHA Configuration API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getRecaptchaSiteKey, shouldRenderRecaptcha } from '@/lib/recaptcha';

/**
 * GET /api/auth/recaptcha/config
 * Returns reCAPTCHA configuration for the client
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from headers if available
    const tenantId = request.headers.get('x-tenant-id') || undefined;

    const siteKey = getRecaptchaSiteKey(tenantId);
    const enabled = shouldRenderRecaptcha(tenantId);

    // Don't expose secret key to client
    return NextResponse.json({
      enabled,
      siteKey,
    });
  } catch (error) {
    console.error('[RECAPTCHA] Config error:', error);
    return NextResponse.json(
      { error: 'Failed to load CAPTCHA configuration' },
      { status: 500 }
    );
  }
}
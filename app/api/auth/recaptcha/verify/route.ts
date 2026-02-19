// ============================================
// Galeria - reCAPTCHA Verification API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/recaptcha';
import type { SubscriptionTier } from '@/lib/types';
import { resolveUserTier } from '@/lib/subscription';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';

/**
 * POST /api/auth/recaptcha/verify
 * Verifies a reCAPTCHA token for anonymous uploads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, tier = 'free' } = body || {};

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required', code: 'MISSING_TOKEN' },
        { status: 400 }
      );
    }

    // Resolve user tier for custom thresholds
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, auth);
    const subscriptionTier = await resolveUserTier(headers, tenantId, 'free');

    // Configure threshold based on tier
    // Higher tiers may have more lenient thresholds
      const tierThresholds: Record<SubscriptionTier, number> = {
        free: 0.5,
        pro: 0.4,
        premium: 0.3,
        enterprise: 0.3,
        tester: 0.2,
      };

    const result = await verifyRecaptchaToken(token);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'CAPTCHA verification failed',
          code: 'VERIFICATION_FAILED',
          details: result['error-codes'],
        },
        { status: 400 }
      );
    }

    if (result.score === undefined) {
      return NextResponse.json(
        { error: 'CAPTCHA score not available', code: 'NO_SCORE' },
        { status: 400 }
      );
    }

    // Check score against threshold
    const threshold = tierThresholds[subscriptionTier] || 0.5;
    const passed = result.score >= threshold;

    return NextResponse.json({
      success: passed,
      score: result.score,
      threshold,
      action: result.action,
      challenge_ts: result.challenge_ts,
    });
  } catch (error) {
    console.error('[RECAPTCHA] Verify error:', error);
    return NextResponse.json(
      { error: 'CAPTCHA verification failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Photo Challenge Prize Verification API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

/**
 * POST /api/events/[eventId]/photo-challenge/verify
 * Verify a prize claim token
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;

    // Authenticate organizer
    const { tenantId } = await requireAuthForApi(req.headers);

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required', code: 'NO_TOKEN' },
        { status: 400 }
      );
    }

    const db = getTenantDb(tenantId);

    const event = await db.findOne<{
      id: string;
      settings?: {
        features?: {
          photo_challenge_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    assertEventFeatureEnabled(event, 'photo_challenge_enabled');

    // Find the prize claim
    const claim = await db.findOne('prize_claims', {
      event_id: eventId,
      qr_code_token: token,
      revoked_at: null,
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'Invalid or expired claim token', code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    // Get challenge details
    const challenge = await db.findOne('photo_challenges', {
      id: claim.challenge_id,
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found', code: 'CHALLENGE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get progress details
    const progress = await db.findOne('guest_photo_progress', {
      event_id: eventId,
      user_fingerprint: claim.user_fingerprint,
    });

    return NextResponse.json({
      data: {
        claim_id: claim.id,
        user_fingerprint: claim.user_fingerprint,
        prize_title: challenge.prize_title,
        prize_description: challenge.prize_description,
        photos_approved: progress?.photos_approved || 0,
        goal_photos: challenge.goal_photos,
        claimed_at: claim.claimed_at,
        verified: !claim.revoked_at,
      },
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[PHOTO_CHALLENGE_VERIFY] POST error:', error);

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Verification failed', code: 'VERIFY_ERROR' },
      { status: 500 }
    );
  }
}

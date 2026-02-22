// ============================================
// Photo Challenge Progress API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

/**
 * GET /api/events/[eventId]/photo-challenge/progress
 * Get current user's photo challenge progress
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const headers = req.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

    // Get fingerprint from request header sent by client
    const fingerprint = headers.get('x-fingerprint');

    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Unable to identify user', code: 'NO_FINGERPRINT' },
        { status: 400 }
      );
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
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

    // Check if photo challenge is enabled
    const challenge = await db.findOne('photo_challenges', {
      event_id: eventId,
      enabled: true,
    });

    if (!challenge) {
      return NextResponse.json({
        enabled: false,
      });
    }

    // Get user's progress
    const progress = await db.findOne('guest_photo_progress', {
      event_id: eventId,
      user_fingerprint: fingerprint,
    });

    // Get user's approved photos count
    const photos = await db.findMany('photos', {
      event_id: eventId,
      user_fingerprint: `guest_${fingerprint}`,
      status: 'approved',
    });

    const photosApproved = photos.length;
    const goalPhotos = challenge.goal_photos;
    const goalReached = photosApproved >= goalPhotos;

    // Check if prize is available to claim
    const canClaim = goalReached && !progress?.prize_revoked;

    return NextResponse.json({
      data: {
        enabled: true,
        goal_photos: goalPhotos,
        prize_title: challenge.prize_title,
        prize_description: challenge.prize_description,
        prize_tier: challenge.prize_tier,
        photos_uploaded: progress?.photos_uploaded || 0,
        photos_approved: photosApproved,
        goal_reached: goalReached,
        can_claim: canClaim,
        prize_claimed_at: progress?.prize_claimed_at || null,
        prize_revoked: progress?.prize_revoked || false,
      },
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    if (error instanceof Error && error.message.includes('Tenant context missing')) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[PHOTO_CHALLENGE_PROGRESS] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Photo Challenge Revoke API Route
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
 * POST /api/events/[eventId]/photo-challenge/revoke
 * Revoke a prize claim (organizer only)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;

    // Authenticate organizer
    const { tenantId } = await requireAuthForApi(req.headers);

    const body = await req.json();

    const { user_fingerprint, reason } = body;

    if (!user_fingerprint || !reason) {
      return NextResponse.json(
        { error: 'User fingerprint and reason are required', code: 'MISSING_FIELDS' },
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

    // Revoke the prize
    await db.update(
      'prize_claims',
      { revoked_at: new Date(), revoke_reason: reason },
      {
        event_id: eventId,
        user_fingerprint: user_fingerprint,
      }
    );

    // Update progress record
    await db.update(
      'guest_photo_progress',
      { prize_revoked: true, revoke_reason: reason },
      {
        event_id: eventId,
        user_fingerprint: user_fingerprint,
      }
    );

    return NextResponse.json({
      message: 'Prize revoked successfully',
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[PHOTO_CHALLENGE_REVOKE] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke prize', code: 'REVOKE_ERROR' },
      { status: 500 }
    );
  }
}

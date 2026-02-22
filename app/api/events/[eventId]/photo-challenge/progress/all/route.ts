// ============================================
// Photo Challenge All Progress API Route
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
 * GET /api/events/[eventId]/photo-challenge/progress/all
 * Get all guest progress for an event (admin only)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;

    // Authenticate organizer
    const { tenantId } = await requireAuthForApi(req.headers);

    const db = getTenantDb(tenantId);

    // Verify event exists
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

    // Get all progress entries for this event
    const progressEntries = await db.findMany('guest_photo_progress', {
      event_id: eventId,
    });

    return NextResponse.json({
      data: progressEntries,
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[PHOTO_CHALLENGE_PROGRESS_ALL] GET error:', error);

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch progress', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Photo Challenge All Progress API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';

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
    const { userId, tenantId } = await requireAuthForApi(req.headers);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get all progress entries for this event
    const progressEntries = await db.findMany('guest_photo_progress', {
      event_id: eventId,
    });

    return NextResponse.json({
      data: progressEntries,
    });
  } catch (error) {
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

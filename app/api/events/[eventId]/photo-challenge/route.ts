// ============================================
// Photo Challenge API Routes
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { hasModeratorRole, requireAuthForApi } from '@/lib/auth';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

type EventAccessRecord = {
  id: string;
  organizer_id: string;
  settings?: {
    features?: {
      photo_challenge_enabled?: boolean;
    };
  };
};

async function requirePhotoChallengeManageAccess(
  req: NextRequest,
  eventId: string
): Promise<{ db: ReturnType<typeof getTenantDb> }> {
  const { userId, tenantId, payload } = await requireAuthForApi(req.headers);

  if (!hasModeratorRole(payload.role)) {
    throw new Error('Forbidden');
  }

  const db = getTenantDb(tenantId);
  const event = await db.findOne<EventAccessRecord>('events', { id: eventId });
  if (!event) {
    throw new Error('Event not found');
  }
  assertEventFeatureEnabled(event, 'photo_challenge_enabled');

  if (payload.role === 'organizer' && event.organizer_id !== userId) {
    throw new Error('Forbidden');
  }

  return { db };
}

function getMutationErrorResponse(
  error: unknown,
  fallbackError: string,
  fallbackCode: string
) {
  if (isFeatureDisabledError(error)) {
    return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
  }

  if (error instanceof Error) {
    if (
      error.message.includes('Authentication required') ||
      error.message.includes('Invalid or expired access token')
    ) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (error.message.includes('Event not found')) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(
    { error: fallbackError, code: fallbackCode },
    { status: 500 }
  );
}

/**
 * GET /api/events/[eventId]/photo-challenge
 * Get photo challenge configuration for an event
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const headers = req.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

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

    // Get photo challenge configuration
    const challenge = await db.findOne('photo_challenges', { event_id: eventId });

    if (!challenge) {
      return NextResponse.json({
        data: null,
        enabled: false,
      });
    }

    return NextResponse.json({
      data: challenge,
      enabled: challenge.enabled,
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[PHOTO_CHALLENGE] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photo challenge', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/photo-challenge
 * Create photo challenge configuration
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const body = await req.json();
    const { db } = await requirePhotoChallengeManageAccess(req, eventId);

    // Check if challenge already exists
    const existing = await db.findOne('photo_challenges', { event_id: eventId });
    if (existing) {
      return NextResponse.json(
        { error: 'Photo challenge already exists for this event', code: 'ALREADY_EXISTS' },
        { status: 400 }
      );
    }

    // Create challenge
    const challenge = await db.insert('photo_challenges', {
      event_id: eventId,
      goal_photos: body.goal_photos ?? 5,
      prize_title: body.prize_title,
      prize_description: body.prize_description || null,
      prize_tier: body.prize_tier || null,
      enabled: body.enabled ?? true,
      auto_grant: body.auto_grant ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      data: challenge,
      message: 'Photo challenge created successfully',
    });
  } catch (error) {
    console.error('[PHOTO_CHALLENGE] POST error:', error);
    return getMutationErrorResponse(error, 'Failed to create photo challenge', 'CREATE_ERROR');
  }
}

/**
 * PATCH /api/events/[eventId]/photo-challenge
 * Update photo challenge configuration
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const body = await req.json();
    const { db } = await requirePhotoChallengeManageAccess(req, eventId);

    // Update challenge
    await db.update(
      'photo_challenges',
      {
        ...(body.goal_photos !== undefined && { goal_photos: body.goal_photos }),
        ...(body.prize_title !== undefined && { prize_title: body.prize_title }),
        ...(body.prize_description !== undefined && { prize_description: body.prize_description }),
        ...(body.prize_tier !== undefined && { prize_tier: body.prize_tier }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.auto_grant !== undefined && { auto_grant: body.auto_grant }),
        updated_at: new Date(),
      },
      { event_id: eventId }
    );

    // Fetch and return the updated challenge
    const updated = await db.findOne('photo_challenges', { event_id: eventId });

    return NextResponse.json({
      data: updated,
    });
  } catch (error) {
    console.error('[PHOTO_CHALLENGE] PATCH error:', error);
    return getMutationErrorResponse(error, 'Failed to update photo challenge', 'UPDATE_ERROR');
  }
}

/**
 * DELETE /api/events/[eventId]/photo-challenge
 * Delete photo challenge configuration
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const { db } = await requirePhotoChallengeManageAccess(req, eventId);

    // Delete challenge
    await db.delete('photo_challenges', { event_id: eventId });

    return NextResponse.json({
      message: 'Photo challenge deleted successfully',
    });
  } catch (error) {
    console.error('[PHOTO_CHALLENGE] DELETE error:', error);
    return getMutationErrorResponse(error, 'Failed to delete photo challenge', 'DELETE_ERROR');
  }
}

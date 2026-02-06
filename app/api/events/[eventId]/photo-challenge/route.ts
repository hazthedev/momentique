// ============================================
// Photo Challenge API Routes
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { getTenantId } from '@/lib/tenant';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

/**
 * GET /api/events/[eventId]/photo-challenge
 * Get photo challenge configuration for an event
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const headers = req.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

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
    const headers = req.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // TODO: Add organizer authentication check here
    // For now, we'll skip auth to make it work for development

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
    return NextResponse.json(
      { error: 'Failed to create photo challenge', code: 'CREATE_ERROR' },
      { status: 500 }
    );
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
    const headers = req.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // TODO: Add organizer authentication check here

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
    return NextResponse.json(
      { error: 'Failed to update photo challenge', code: 'UPDATE_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]/photo-challenge
 * Delete photo challenge configuration
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const headers = req.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // TODO: Add organizer authentication check here

    // Delete challenge
    await db.delete('photo_challenges', { event_id: eventId });

    return NextResponse.json({
      message: 'Photo challenge deleted successfully',
    });
  } catch (error) {
    console.error('[PHOTO_CHALLENGE] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo challenge', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
}

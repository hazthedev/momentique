// ============================================
// Galeria - Single Event API Routes
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import { generateSlug, generateEventUrl } from '@/lib/utils';
import type { IEvent, IEventUpdate } from '@/lib/types';
import { resolveOptionalAuth, resolveRequiredTenantId, resolveTenantId } from '@/lib/api-request-context';

// ============================================
// GET /api/events/:eventId - Get single event
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: id } = await params;
  try {
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, authContext);

    const db = getTenantDb(tenantId);
    const event = await db.findOne<IEvent>('events', { id });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: event });
  } catch (error) {
    console.error('[API] Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/events/:eventId - Update event
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: id } = await params;
  try {
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Get user from session or JWT token (supports both auth methods)
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
      }
    }

    // Fallback to JWT token
    if (!userId && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        userId = payload.sub;
        userRole = payload.role;
      } catch {
        // Token invalid
      }
    }

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const updates: IEventUpdate = await request.json();
    const db = getTenantDb(tenantId);

    const existingEvent = await db.findOne<IEvent>('events', { id });
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isOwner = existingEvent.organizer_id === userId;
    const isSuperAdmin = userRole === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Regenerate slug and QR URL if name changed
    if (updates.name && updates.name !== existingEvent.name) {
      const newSlug = generateSlug(updates.name);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const newUrl = generateEventUrl(baseUrl, id, newSlug);

      updates.slug = newSlug;
      updates.qr_code_url = newUrl;
    }

    if (typeof updates.short_code === 'string') {
      const shortCode = updates.short_code.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,20}$/.test(shortCode)) {
        return NextResponse.json(
          { error: 'Short code must be 3-20 characters (letters, numbers, hyphens)', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      if (shortCode !== existingEvent.short_code) {
        const shortCodeExists = await db.findOne<IEvent>('events', { short_code: shortCode });
        if (shortCodeExists && shortCodeExists.id !== id) {
          return NextResponse.json(
            { error: 'Short code already in use', code: 'SHORT_CODE_TAKEN' },
            { status: 409 }
          );
        }
      }

      updates.short_code = shortCode;
    }

    await db.update(
      'events',
      { ...updates, updated_at: new Date() },
      { id }
    );

    const updatedEvent = await db.findOne<IEvent>('events', { id });

    return NextResponse.json({
      data: updatedEvent,
      message: 'Event updated successfully',
    });
  } catch (error) {
    console.error('[API] Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/events/:eventId - Delete event
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: id } = await params;
  try {
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Get user from session or JWT token
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
      }
    }

    // Fallback to JWT token
    if (!userId && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        userId = payload.sub;
        userRole = payload.role;
      } catch {
        // Token invalid
      }
    }

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const db = getTenantDb(tenantId);

    const existingEvent = await db.findOne<IEvent>('events', { id });
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isOwner = existingEvent.organizer_id === userId;
    const isSuperAdmin = userRole === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const deletedCount = await db.delete('events', { id });

    if (deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete event', code: 'DELETE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('[API] Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

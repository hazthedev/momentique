// ============================================
// Galeria - Events Service
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantContextFromHeaders } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { generateSlug, generateUUID, generateEventUrl } from '@/lib/utils';
import { extractSessionId, validateSession } from '@/lib/session';
import { generateUniqueShortCode } from '@/lib/short-code';
import { checkEventLimit } from '@/lib/limit-check';
import { getSystemSettings } from '@/lib/system-settings';
import type { IEvent, SubscriptionTier } from '@/lib/types';
import { resolveUserTier } from '@/lib/subscription';
import { eventBulkUpdateSchema, eventCreateSchema } from '@/lib/validation/events';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';

// ============================================
// GET /api/events - List events (service)
// ============================================

export async function handleEventsList(request: NextRequest) {
  try {
    // Get tenant from headers (injected by middleware)
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

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

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!['organizer', 'super_admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get database connection
    const db = getTenantDb(tenantId);

    // Build query conditions
    const conditions: Record<string, unknown> = {};
    if (status) {
      conditions.status = status;
    }
    if (userRole === 'organizer') {
      conditions.organizer_id = userId;
    }

    // Fetch events
    const events = await db.findMany<IEvent>('events', conditions, {
      limit,
      offset,
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });

    // Get total count
    const total = await db.count('events', conditions);

    return NextResponse.json({
      data: events,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error('[API] Error listing events:', error);
    return NextResponse.json(
      { error: 'Failed to list events', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/events - Create event (service)
// ============================================

export async function handleEventCreate(request: NextRequest) {
  try {
    // Get tenant from headers
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Get user from session or JWT token
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.session) {
        userId = session.session.userId;
      }
    }

    // Fallback to JWT token
    if (!userId && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        userId = payload.sub;
      } catch {
        // Token invalid
      }
    }

    // Parse and validate request body
    const parsed = eventCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid event payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Get database connection
    const db = getTenantDb(tenantId);

    // Check tenant limits (if authenticated)
    if (userId) {
      const tenantContext = getTenantContextFromHeaders(headers);
      if (tenantContext) {
        // Get subscription tier from tenant context
        const subscriptionTier = await resolveUserTier(headers, tenantId, 'free');

        // Check if event limit is reached
        const limitResult = await checkEventLimit(tenantId, subscriptionTier);
        if (!limitResult.allowed) {
          return NextResponse.json(
            {
              error: limitResult.message || 'Event limit reached',
              code: 'LIMIT_REACHED',
              upgradeRequired: true,
              currentCount: limitResult.currentCount,
              limit: limitResult.limit,
            },
            { status: 403 }
          );
        }
      }
    }

    // Generate unique slug
    let slug = generateSlug(body.name);
    let slugExists = await db.findOne<IEvent>('events', { slug });

    // If slug exists, add random suffix
    let attempts = 0;
    while (slugExists && attempts < 10) {
      slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
      slugExists = await db.findOne<IEvent>('events', { slug });
      attempts++;
    }

    if (slugExists) {
      return NextResponse.json(
        { error: 'Could not generate unique slug', code: 'SLUG_ERROR' },
        { status: 500 }
      );
    }

    // Generate event ID (use UUID for database compatibility)
    const eventId = generateUUID();

    // Generate short code for sharing (e.g., "helo", "party123")
    const shortCode = await generateUniqueShortCode(tenantId);

    // Generate QR code URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const eventUrl = generateEventUrl(baseUrl, eventId, slug);

    // Default settings
    let defaultSettings: IEvent['settings'] = {
      theme: {
        primary_color: '#8B5CF6',
        secondary_color: '#EC4899',
        background: '#F9FAFB',
        surface_color: '#1F2937',
        logo_url: undefined,
        frame_template: 'polaroid',
        photo_card_style: 'vacation',
      },
      features: {
        photo_upload_enabled: true,
        lucky_draw_enabled: true,
        reactions_enabled: true,
        moderation_required: false,
        anonymous_allowed: true,
        guest_download_enabled: true,
        photo_challenge_enabled: false,
        attendance_enabled: false,
      },
      limits: {
        max_photos_per_user: 5,
        max_total_photos: 50,
        max_draw_entries: 30,
      },
      security: {
        upload_rate_limits: {
          per_ip_hourly: 10,
          per_fingerprint_hourly: 10,
          burst_per_ip_minute: 5,
          per_event_daily: 100,
        },
      },
    };

    try {
      const systemSettings = await getSystemSettings();
      if (systemSettings?.events?.default_settings) {
        defaultSettings = {
          ...defaultSettings,
          ...systemSettings.events.default_settings,
          theme: {
            ...defaultSettings.theme,
            ...(systemSettings.events.default_settings.theme || {}),
          },
          features: {
            ...defaultSettings.features,
            ...(systemSettings.events.default_settings.features || {}),
          },
        };
      }
    } catch (error) {
      console.warn('[API] Failed to load system defaults:', error);
    }

    // Require authentication for event creation
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Create event
    const event = await db.insert<IEvent>('events', {
      id: eventId,
      tenant_id: tenantId,
      organizer_id: userId, // Authenticated user
      name: body.name,
      slug,
      short_code: shortCode,
      description: body.description,
      event_type: body.event_type,
      event_date: new Date(body.event_date),
      timezone: 'UTC',
      location: body.location,
      expected_guests: body.expected_guests,
      custom_hashtag: body.custom_hashtag,
      settings: { ...defaultSettings, ...body.settings },
      status: 'active',
      qr_code_url: eventUrl,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json(
      {
        data: event,
        message: 'Event created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/events - Bulk update events (service)
// ============================================

export async function handleEventsBulkUpdate(request: NextRequest) {
  try {
    // Get tenant from headers
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Get user from JWT token
    const authHeader = headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const parsed = eventBulkUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid event update payload', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Get database connection
    const db = getTenantDb(tenantId);

    // Check permissions (only organizer or admin can update)
    const userRole = payload.role;
    if (!['organizer', 'super_admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Update events (only events belonging to this user if organizer)
    const events: IEvent[] = [];

    if (userRole === 'organizer') {
      // Only update own events
      for (const eventId of body.ids) {
        await db.update(
          'events',
          body.updates,
          { id: eventId, organizer_id: payload.sub }
        );
      }
    } else {
      // Admin can update any event in tenant
      for (const eventId of body.ids) {
        await db.update(
          'events',
          body.updates,
          { id: eventId }
        );
      }
    }

    // Fetch updated events to return
    let finalEvents: IEvent[] = [];

    if (body.ids.length === 1) {
      const event = await db.findOne<IEvent>('events', { id: body.ids[0] });
      if (event) {
        finalEvents.push(event);
      }
    } else {
      // Use SQL IN clause for multiple IDs
      const placeholders = body.ids.map((_, index) => `$${index + 1}`).join(', ');
      const result = await db.query<IEvent>(
        `SELECT * FROM events WHERE id IN (${placeholders})`,
        body.ids
      );
      finalEvents = result.rows;
    }

    return NextResponse.json({
      events: finalEvents,
      message: `Updated ${finalEvents.length} event(s)`,
    });
  } catch (error) {
    console.error('[API] Error updating events:', error);
    return NextResponse.json(
      { error: 'Failed to update events', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/events - Bulk delete events (service)
// ============================================

export async function handleEventsBulkDelete(request: NextRequest) {
  try {
    // Get tenant from headers
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    // Get user from JWT token
    const authHeader = headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // Parse request body
    const requestBody = await request.json();
    const { ids } = requestBody;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No event IDs provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Get database connection
    const db = getTenantDb(tenantId);

    // Check permissions
    const userRole = payload.role;
    if (!['organizer', 'super_admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Delete events
    let deletedCount = 0;

    if (userRole === 'organizer') {
      // Only delete own events
      for (const eventId of ids) {
        deletedCount += await db.delete('events', {
          id: eventId,
          organizer_id: payload.sub,
        });
      }
    } else {
      // Admin can delete any event in tenant
      for (const eventId of ids) {
        deletedCount += await db.delete('events', { id: eventId });
      }
    }

    return NextResponse.json({
      message: `Deleted ${deletedCount} event(s)`,
    });
  } catch (error) {
    console.error('[API] Error deleting events:', error);
    return NextResponse.json(
      { error: 'Failed to delete events', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

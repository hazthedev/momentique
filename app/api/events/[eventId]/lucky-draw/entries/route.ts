// ============================================
// Galeria - Lucky Draw Entries API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { createManualEntries, getActiveConfig, getEventEntries } from '@/lib/lucky-draw';
import { extractSessionId, validateSession } from '@/lib/session';
import { resolveOptionalAuth, resolveRequiredTenantId, resolveTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

export const runtime = 'nodejs';

const isRecoverableReadError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['42P01', '42703'].includes((error as { code?: string }).code || '');

// ============================================
// GET /api/events/:eventId/lucky-draw/entries - List entries
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await resolveOptionalAuth(request.headers);
    const tenantId = resolveTenantId(request.headers, auth);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne<{
      id: string;
      settings?: {
        features?: {
          lucky_draw_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
    assertEventFeatureEnabled(event, 'lucky_draw_enabled');

    // Get active config
    const config = await getActiveConfig(tenantId, eventId);
    if (!config) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          limit: 0,
          offset: 0,
        },
        message: 'No active draw configuration',
      });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const offsetParam = Number(searchParams.get('offset'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

    const entries = await getEventEntries(tenantId, config.id, {
      limit,
      offset,
    });

    let total = entries.length;
    const warnings: string[] = [];
    try {
      const countResult = await db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM lucky_draw_entries WHERE config_id = $1',
        [config.id]
      );
      total = Number(countResult.rows[0]?.count || 0);
    } catch {
      warnings.push('Entry count unavailable; using current page size.');
    }

    return NextResponse.json({
      data: entries,
      pagination: {
        total,
        limit,
        offset,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    if (isRecoverableReadError(error)) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          limit: 0,
          offset: 0,
        },
        message: 'Lucky draw tables not initialized',
      });
    }
    console.error('[API] Entries fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/events/:eventId/lucky-draw/entries - Manual entry
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, auth);

    const db = getTenantDb(tenantId);

    // Verify user is authenticated (session or JWT)
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.session) {
        userId = session.session.userId;
        // Get user role from database
        const user = await db.findOne('users', { id: userId });
        userRole = user?.role || null;
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
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const isAdmin = userRole === 'super_admin' || userRole === 'organizer';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const event = await db.findOne<{
      id: string;
      settings?: {
        features?: {
          lucky_draw_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
    assertEventFeatureEnabled(event, 'lucky_draw_enabled');

    const body = await request.json();
    const participantName = typeof body.participantName === 'string' ? body.participantName.trim() : '';
    const participantFingerprint = typeof body.participantFingerprint === 'string'
      ? body.participantFingerprint.trim()
      : undefined;
    const photoId = typeof body.photoId === 'string' ? body.photoId.trim() : undefined;
    const entryCountRaw = Number(body.entryCount);
    const entryCount = Number.isFinite(entryCountRaw) && entryCountRaw > 0 ? Math.floor(entryCountRaw) : 1;

    if (!participantName) {
      return NextResponse.json(
        { error: 'Participant name is required', code: 'INVALID_NAME' },
        { status: 400 }
      );
    }

    if (participantName.length > 120) {
      return NextResponse.json(
        { error: 'Participant name is too long', code: 'NAME_TOO_LONG' },
        { status: 400 }
      );
    }

    // UUID validation helper
    const isValidUUID = (str: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Validate photo ID format if provided
    if (photoId && !isValidUUID(photoId)) {
      return NextResponse.json(
        { error: 'Photo ID must be a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). You entered: ' + photoId, code: 'INVALID_PHOTO_ID' },
        { status: 400 }
      );
    }

    const config = await getActiveConfig(tenantId, eventId);
    if (!config) {
      return NextResponse.json(
        { error: 'No active draw configuration found', code: 'NO_CONFIG' },
        { status: 400 }
      );
    }

    // Only require photo if configured
    if (config.requirePhotoUpload && !photoId) {
      return NextResponse.json(
        { error: 'This draw requires a photo ID. Please either upload a photo first or disable "Require photo upload" in the draw configuration.', code: 'PHOTO_REQUIRED' },
        { status: 400 }
      );
    }

    // Only validate photo exists if:
    // 1. A photoId was provided, AND
    // 2. Either photos are required OR we should validate any provided photo
    // Skip validation if photo upload is not required and user just has something in the field
    if (photoId && config.requirePhotoUpload) {
      const photo = await db.findOne('photos', { id: photoId, event_id: eventId });
      if (!photo) {
        return NextResponse.json(
          { error: 'Photo not found for this event', code: 'PHOTO_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    // Clear photoId if it's not required and we're not validating it
    const finalPhotoId = (photoId && config.requirePhotoUpload) ? photoId : null;

    const result = await createManualEntries(tenantId, eventId, {
      participantName,
      userFingerprint: participantFingerprint,
      photoId: finalPhotoId,
      entryCount,
    });

    return NextResponse.json({
      data: {
        entries: result.entries,
        userFingerprint: result.userFingerprint,
      },
      message: 'Manual entries created successfully',
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create manual entries';
    const status = message.includes('Maximum entries per user') || message.includes('No active draw configuration')
      ? 400
      : 500;
    return NextResponse.json(
      { error: message, code: 'CREATE_ERROR' },
      { status }
    );
  }
}

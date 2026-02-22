// ============================================
// Galeria - Attendance API Routes
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import type { IAttendance, IAttendanceCreate, CheckInMethod } from '@/lib/types';
import { resolveOptionalAuth, resolveRequiredTenantId, resolveTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

// ============================================
// TYPES
// ============================================

interface EventWithAttendance {
  id: string;
  status: string;
  settings: {
    features?: {
      attendance_enabled?: boolean;
    };
  };
}

const isMissingTableError = (error: unknown) =>
  typeof error === 'object' && error !== null &&
  'code' in error && (error as { code?: string }).code === '42P01';

// ============================================
// GET /api/events/:eventId/attendance - List attendance records
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne<EventWithAttendance>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    assertEventFeatureEnabled(event, 'attendance_enabled');

    // Verify authorization (organizer only)
    const authHeader = headers.get('authorization');
    const cookieHeader = headers.get('cookie');
    let userRole: string | null = null;

    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.user) {
        userRole = session.user.role;
      }
    }

    if (!userRole && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        userRole = payload.role;
      } catch {
        // Token invalid
      }
    }

    if (userRole !== 'super_admin' && userRole !== 'organizer') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 500);
    const offset = Number(searchParams.get('offset')) || 0;
    const sortBy = searchParams.get('sortBy') || 'check_in_time';
    const sortOrder = (searchParams.get('sortOrder') || 'DESC') as 'ASC' | 'DESC';

    const attendances = await db.query<IAttendance>(
      `SELECT * FROM attendances
       WHERE event_id = $1
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $2 OFFSET $3`,
      [eventId, limit, offset]
    );

    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM attendances WHERE event_id = $1',
      [eventId]
    );

    const total = Number(countResult.rows[0]?.count || 0);

    return NextResponse.json({
      data: attendances.rows,
      pagination: { limit, offset, total }
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    if (isMissingTableError(error)) {
      return NextResponse.json({
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 }
      });
    }
    console.error('[API] Attendance fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/events/:eventId/attendance - Guest check-in
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

    // Verify event exists and is active
    const event = await db.findOne<EventWithAttendance>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (event.status !== 'active') {
      return NextResponse.json(
        { error: 'Event is not active', code: 'EVENT_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    assertEventFeatureEnabled(event, 'attendance_enabled');

    const body = await request.json() as IAttendanceCreate;

    // Validate required fields
    if (!body.guest_name || body.guest_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Guest name is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate companions count
    if (body.companions_count !== undefined && (body.companions_count < 0 || body.companions_count > 100)) {
      return NextResponse.json(
        { error: 'Companions count must be between 0 and 100', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Check for duplicate by email
    if (body.guest_email && body.guest_email.trim()) {
      const existingByEmail = await db.query<IAttendance>(
        'SELECT id FROM attendances WHERE event_id = $1 AND guest_email = $2',
        [eventId, body.guest_email.toLowerCase().trim()]
      );

      if (existingByEmail.rows.length > 0) {
        return NextResponse.json(
          { error: 'Guest already checked in', code: 'ALREADY_CHECKED_IN', email: body.guest_email },
          { status: 409 }
        );
      }
    }

    // Check for duplicate by phone
    if (body.guest_phone && body.guest_phone.trim()) {
      const existingByPhone = await db.query<IAttendance>(
        'SELECT id FROM attendances WHERE event_id = $1 AND guest_phone = $2',
        [eventId, body.guest_phone.trim()]
      );

      if (existingByPhone.rows.length > 0) {
        return NextResponse.json(
          { error: 'Guest already checked in', code: 'ALREADY_CHECKED_IN', phone: body.guest_phone },
          { status: 409 }
        );
      }
    }

    // Get user fingerprint for tracking
    const userFingerprint = body.user_fingerprint ||
      headers.get('x-fingerprint') ||
      crypto.randomUUID();

    // Create attendance record
    const result = await db.query<IAttendance>(
      `INSERT INTO attendances
       (event_id, guest_name, guest_email, guest_phone, user_fingerprint,
        companions_count, check_in_method, notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        eventId,
        body.guest_name.trim(),
        body.guest_email?.toLowerCase().trim() || null,
        body.guest_phone?.trim() || null,
        userFingerprint,
        body.companions_count || 0,
        body.check_in_method || 'guest_self',
        body.notes || null,
        JSON.stringify({
          ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
          user_agent: headers.get('user-agent') || 'unknown',
        })
      ]
    );

    const attendance = result.rows[0];

    return NextResponse.json({
      data: attendance,
      message: 'Check-in successful'
    }, { status: 201 });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[API] Check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to check in', code: 'CHECKIN_ERROR' },
      { status: 500 }
    );
  }
}

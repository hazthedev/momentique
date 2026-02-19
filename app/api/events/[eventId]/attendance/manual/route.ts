// ============================================
// Galeria - Manual Check-in API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import type { IAttendance, IAttendanceCreate } from '@/lib/types';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';

// ============================================
// POST /api/events/:eventId/attendance/manual
// Manual check-in by organizer
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

    // Verify organizer authorization
    const authHeader = headers.get('authorization');
    const cookieHeader = headers.get('cookie');
    let userId: string | null = null;
    let userRole: string | null = null;

    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
      }
    }

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

    if (userRole !== 'super_admin' && userRole !== 'organizer') {
      return NextResponse.json(
        { error: 'Forbidden - organizer access required', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - no user found', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Verify event exists
    const event = await db.findOne<{ id: string; status: string }>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

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

    // Create attendance record with organizer_manual method
    const result = await db.query<IAttendance>(
      `INSERT INTO attendances
       (event_id, guest_name, guest_email, guest_phone, user_fingerprint,
        companions_count, check_in_method, checked_in_by, notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        eventId,
        body.guest_name.trim(),
        body.guest_email?.toLowerCase().trim() || null,
        body.guest_phone?.trim() || null,
        body.user_fingerprint || crypto.randomUUID(),
        body.companions_count || 0,
        'organizer_manual',
        userId,
        body.notes || null,
        JSON.stringify({
          ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
          user_agent: headers.get('user-agent') || 'unknown',
          manual_entry: true,
        })
      ]
    );

    const attendance = result.rows[0];

    return NextResponse.json({
      data: attendance,
      message: 'Manual check-in successful'
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Manual check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to check in', code: 'CHECKIN_ERROR' },
      { status: 500 }
    );
  }
}

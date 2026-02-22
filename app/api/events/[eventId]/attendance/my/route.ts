// ============================================
// Galeria - My Attendance API Route
// ============================================
// Get current user's attendance status for an event

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

/**
 * GET /api/events/:eventId/attendance/my
 * Get the current user's attendance record (if any)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { eventId } = await context.params;
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

    const db = getTenantDb(tenantId);

    // Get fingerprint from request header sent by client
    const fingerprint = headers.get('x-fingerprint');

    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Unable to identify user', code: 'NO_FINGERPRINT' },
        { status: 400 }
      );
    }

    // Verify event exists
    const event = await db.findOne<{
      id: string;
      status: string;
      settings: {
        features?: {
          attendance_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if attendance feature is enabled
    if (event.settings?.features?.attendance_enabled === false) {
      return NextResponse.json(
        { error: 'Attendance feature is disabled', code: 'FEATURE_DISABLED' },
        { status: 400 }
      );
    }

    // Look for attendance record by fingerprint
    // Try with both direct fingerprint and guest_ prefix
    let attendance = await db.findOne<{
      id: string;
      event_id: string;
      guest_name: string;
      user_fingerprint: string;
      check_in_time: Date;
    }>('attendances', {
      event_id: eventId,
      user_fingerprint: fingerprint,
    });

    // If not found, try with guest_ prefix
    if (!attendance) {
      attendance = await db.findOne<{
        id: string;
        event_id: string;
        guest_name: string;
        user_fingerprint: string;
        check_in_time: Date;
      }>('attendances', {
        event_id: eventId,
        user_fingerprint: `guest_${fingerprint}`,
      });
    }

    if (!attendance) {
      return NextResponse.json({
        data: null,
      });
    }

    return NextResponse.json({
      data: {
        id: attendance.id,
        event_id: attendance.event_id,
        guest_name: attendance.guest_name,
        checked_in_at: attendance.check_in_time,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Tenant context missing')) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[ATTENDANCE_MY] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

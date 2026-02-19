// ============================================
// Galeria - Attendance CSV Export API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import type { IAttendance } from '@/lib/types';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';

// ============================================
// GET /api/events/:eventId/attendance/export
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, auth);

    const db = getTenantDb(tenantId);

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

    // Fetch all attendance records sorted by check-in time
    const result = await db.query<IAttendance>(
      `SELECT * FROM attendances
       WHERE event_id = $1
       ORDER BY check_in_time ASC`,
      [eventId]
    );

    const attendances = result.rows;

    // Generate CSV
    const headers_row = 'Name,Email,Phone,Companions,Check-in Time,Method,Notes\n';
    const rows = attendances.map(a =>
      [
        `"${(a.guest_name || '').replace(/"/g, '""')}"`,
        `"${(a.guest_email || '').replace(/"/g, '""')}"`,
        `"${(a.guest_phone || '').replace(/"/g, '""')}"`,
        a.companions_count,
        new Date(a.check_in_time).toLocaleString(),
        a.check_in_method,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ].join(',')
    ).join('\n');

    const csv = headers_row + rows;

    // Return CSV file with appropriate headers
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance-${eventId}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Tenant context missing')) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[API] Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export', code: 'EXPORT_ERROR' },
      { status: 500 }
    );
  }
}

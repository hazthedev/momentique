// ============================================
// Gatherly - Attendance Stats API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import type { IAttendanceStats, CheckInMethod } from '@/lib/types';

// ============================================
// GET /api/events/:eventId/attendance/stats
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

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

    // Fetch all attendance records for this event
    const result = await db.query<{
      companions_count: number;
      check_in_time: Date;
      check_in_method: CheckInMethod;
      guest_email: string | null;
    }>(
      `SELECT companions_count, check_in_time, check_in_method, guest_email
       FROM attendances
       WHERE event_id = $1`,
      [eventId]
    );

    const attendances = result.rows;

    // Calculate statistics
    const totalCheckIns = attendances.length;
    const totalGuests = attendances.reduce((sum, a) => sum + a.companions_count + 1, 0);

    // Check-ins today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInsToday = attendances.filter(a => new Date(a.check_in_time) >= today).length;

    // Unique guests (with email)
    const uniqueEmails = new Set(attendances.map(a => a.guest_email).filter(Boolean));
    const uniqueGuests = uniqueEmails.size;

    // Average companions
    const avgCompanions = totalCheckIns > 0
      ? attendances.reduce((sum, a) => sum + a.companions_count, 0) / totalCheckIns
      : 0;

    // Method breakdown
    const methodBreakdown: Record<CheckInMethod, number> = {
      guest_self: 0,
      guest_qr: 0,
      organizer_manual: 0,
      organizer_qr: 0,
    };

    attendances.forEach(a => {
      methodBreakdown[a.check_in_method] = (methodBreakdown[a.check_in_method] || 0) + 1;
    });

    const stats: IAttendanceStats = {
      total_check_ins: totalCheckIns,
      total_guests: totalGuests,
      check_ins_today: checkInsToday,
      unique_guests: uniqueGuests,
      average_companions: Math.round(avgCompanions * 10) / 10,
      check_in_method_breakdown: methodBreakdown,
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('[API] Attendance stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', code: 'STATS_ERROR' },
      { status: 500 }
    );
  }
}

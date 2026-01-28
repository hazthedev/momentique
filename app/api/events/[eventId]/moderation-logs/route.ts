// ============================================
// MOMENTIQUE - Moderation Logs API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';

const isMissingTableError = (error: unknown) =>
  (error as { code?: string })?.code === '42P01';

// ============================================
// GET /api/events/:eventId/moderation-logs
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    const headers = request.headers;
    const { userId, tenantId: authTenantId, payload } = await requireAuthForApi(headers);
    const db = getTenantDb(authTenantId);

    const event = await db.findOne<{ id: string; organizer_id: string }>('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === userId;
    const isSuperAdmin = payload.role === 'super_admin';
    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    const tableCheck = await db.query<{ name: string | null }>(
      'SELECT to_regclass($1) AS name',
      ['public.photo_moderation_logs']
    );

    if (!tableCheck.rows[0]?.name) {
      return NextResponse.json({ data: [] });
    }

    const result = await db.query<{
      id: string;
      photoId: string;
      action: string;
      reason: string | null;
      createdAt: Date;
      moderatorId: string;
      moderatorName: string | null;
      moderatorEmail: string;
      photoStatus: string | null;
      imageUrl: string | null;
    }>(
      `
        SELECT
          l.id,
          l.photo_id AS "photoId",
          l.action,
          l.reason,
          l.created_at AS "createdAt",
          l.moderator_id AS "moderatorId",
          u.name AS "moderatorName",
          u.email AS "moderatorEmail",
          p.status AS "photoStatus",
          (p.images ->> 'thumbnail_url') AS "imageUrl"
        FROM photo_moderation_logs l
        JOIN users u ON u.id = l.moderator_id
        JOIN photos p ON p.id = l.photo_id
        WHERE l.event_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [eventId, limit, offset]
    ).catch((error) => (isMissingTableError(error) ? null : Promise.reject(error)));

    if (!result) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('[API] Moderation logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation logs', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

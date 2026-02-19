// ============================================
// Galeria - Supervisor Recent Activity API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';
import { SYSTEM_TENANT_ID } from '@/lib/constants/tenants';

type ActivityType = 'user' | 'event' | 'photo' | 'moderation';

type ActivityItem = {
  id: string;
  type: ActivityType;
  createdAt: string;
  tenantName?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  eventStatus?: string | null;
  organizerName?: string | null;
  contributorName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  moderatorName?: string | null;
  moderatorEmail?: string | null;
  action?: string | null;
  photoStatus?: string | null;
  reason?: string | null;
  imageUrl?: string | null;
};


const toIsoString = (value: Date | string) => {
  if (typeof value === 'string') {
    return new Date(value).toISOString();
  }
  return value.toISOString();
};

const isMissingTableError = (error: unknown) =>
  (error as { code?: string })?.code === '42P01';
const isDatabaseError = (error: unknown) =>
  Boolean((error as { code?: string })?.code) ||
  (error instanceof Error && /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND/i.test(error.message));

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const db = getTenantDb(SYSTEM_TENANT_ID);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 50);
    const perTableLimit = Math.min(limit * 2, 50);

    const emptyResult = { rows: [] };

    const [usersResult, eventsResult, photosResult, moderationResult] = await Promise.all([
      db.query<{
        id: string;
        createdAt: Date;
        userName: string | null;
        userEmail: string;
        tenantName: string | null;
      }>(
        `
          SELECT
            u.id,
            u.created_at AS "createdAt",
            u.name AS "userName",
            u.email AS "userEmail",
            t.company_name AS "tenantName"
          FROM users u
          JOIN tenants t ON t.id = u.tenant_id
          ORDER BY u.created_at DESC
          LIMIT $1
        `,
        [perTableLimit]
      ).catch((error) => (isMissingTableError(error) ? emptyResult : Promise.reject(error))),
      db.query<{
        id: string;
        createdAt: Date;
        eventName: string;
        eventStatus: string;
        organizerName: string | null;
        tenantName: string | null;
      }>(
        `
          SELECT
            e.id,
            e.created_at AS "createdAt",
            e.name AS "eventName",
            e.status AS "eventStatus",
            u.name AS "organizerName",
            t.company_name AS "tenantName"
          FROM events e
          JOIN users u ON u.id = e.organizer_id
          JOIN tenants t ON t.id = e.tenant_id
          ORDER BY e.created_at DESC
          LIMIT $1
        `,
        [perTableLimit]
      ).catch((error) => (isMissingTableError(error) ? emptyResult : Promise.reject(error))),
      db.query<{
        id: string;
        createdAt: Date;
        contributorName: string | null;
        photoStatus: string | null;
        eventId: string;
        eventName: string;
        tenantName: string | null;
        imageUrl: string | null;
      }>(
        `
          SELECT
            p.id,
            p.created_at AS "createdAt",
            p.contributor_name AS "contributorName",
            p.status AS "photoStatus",
            e.id AS "eventId",
            e.name AS "eventName",
            t.company_name AS "tenantName",
            (p.images ->> 'thumbnail_url') AS "imageUrl"
          FROM photos p
          JOIN events e ON e.id = p.event_id
          JOIN tenants t ON t.id = e.tenant_id
          ORDER BY p.created_at DESC
          LIMIT $1
        `,
        [perTableLimit]
      ).catch((error) => (isMissingTableError(error) ? emptyResult : Promise.reject(error))),
      db.query<{
        id: string;
        createdAt: Date;
        action: string;
        reason: string | null;
        moderatorName: string | null;
        moderatorEmail: string | null;
        eventId: string;
        eventName: string;
        tenantName: string | null;
        imageUrl: string | null;
        photoStatus: string | null;
      }>(
        `
          SELECT
            l.id,
            l.created_at AS "createdAt",
            l.action,
            l.reason,
            u.name AS "moderatorName",
            u.email AS "moderatorEmail",
            e.id AS "eventId",
            e.name AS "eventName",
            t.company_name AS "tenantName",
            (p.images ->> 'thumbnail_url') AS "imageUrl",
            p.status AS "photoStatus"
          FROM photo_moderation_logs l
          JOIN users u ON u.id = l.moderator_id
          JOIN events e ON e.id = l.event_id
          JOIN tenants t ON t.id = l.tenant_id
          JOIN photos p ON p.id = l.photo_id
          ORDER BY l.created_at DESC
          LIMIT $1
        `,
        [perTableLimit]
      ).catch((error) => (isMissingTableError(error) ? emptyResult : Promise.reject(error))),
    ]);

    const activityItems: ActivityItem[] = [
      ...usersResult.rows.map((row) => ({
        id: row.id,
        type: 'user' as const,
        createdAt: toIsoString(row.createdAt),
        tenantName: row.tenantName,
        userName: row.userName,
        userEmail: row.userEmail,
      })),
      ...eventsResult.rows.map((row) => ({
        id: row.id,
        type: 'event' as const,
        createdAt: toIsoString(row.createdAt),
        tenantName: row.tenantName,
        eventName: row.eventName,
        eventStatus: row.eventStatus,
        organizerName: row.organizerName,
      })),
      ...photosResult.rows.map((row) => ({
        id: row.id,
        type: 'photo' as const,
        createdAt: toIsoString(row.createdAt),
        tenantName: row.tenantName,
        eventId: row.eventId,
        eventName: row.eventName,
        contributorName: row.contributorName,
        photoStatus: row.photoStatus,
        imageUrl: row.imageUrl,
      })),
      ...moderationResult.rows.map((row) => ({
        id: row.id,
        type: 'moderation' as const,
        createdAt: toIsoString(row.createdAt),
        tenantName: row.tenantName,
        eventId: row.eventId,
        eventName: row.eventName,
        moderatorName: row.moderatorName,
        moderatorEmail: row.moderatorEmail,
        action: row.action,
        reason: row.reason,
        imageUrl: row.imageUrl,
        photoStatus: row.photoStatus,
      })),
    ];

    const sorted = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ data: sorted });
  } catch (error) {
    console.error('[SUPERVISOR_ACTIVITY] Error:', error);
    if (isDatabaseError(error)) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json(
      { error: 'Failed to fetch recent activity', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
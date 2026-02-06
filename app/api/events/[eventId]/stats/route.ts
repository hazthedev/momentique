// ============================================
// Gatherly - Event Stats API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, getSession, refreshSession } from '@/lib/session';
import { getActiveConfig } from '@/lib/lucky-draw';
import { getTierConfig } from '@/lib/tier-config';
import type { IPhoto, SubscriptionTier } from '@/lib/types';

interface EventStats {
  totalPhotos: number;
  totalParticipants: number;
  photosToday: number;
  avgPhotosPerUser: number;
  topContributors: { name: string; count: number }[];
  uploadTimeline: { date: string; count: number }[];
  totalReactions: number;
  pendingModeration: number;
  luckyDrawStatus: 'active' | 'not_set';
  luckyDrawEntryCount: number;
  tierMaxPhotosPerEvent: number;
  tierDisplayName: string;
  topLikedPhotos: {
    id: string;
    imageUrl: string;
    heartCount: number;
    contributorName: string;
    isAnonymous: boolean;
  }[];
}

interface TopContributor {
  contributor_name: string;
  count: number;
}

// ============================================
// GET /api/events/:id/stats - Get event statistics
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: id } = await params;
  try {
    const headers = request.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development (Turbopack middleware issue)
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    // Get user from session or JWT token
    let cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    if (!cookieHeader) {
      const sessionCookie = (await cookies()).get('session')?.value;
      if (sessionCookie) {
        cookieHeader = `session=${sessionCookie}`;
      }
    }

    // Try session-based auth first (Redis only to avoid extra DB connections)
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await getSession(sessionResult.sessionId);
      if (session) {
        const now = Date.now();
        if (now <= session.expiresAt) {
          userId = session.userId;
          userRole = session.role;
          await refreshSession(sessionResult.sessionId);
        }
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

    // Stats are optional - return empty stats if not authenticated
    if (!userId) {
      const emptyStats: EventStats = {
        totalPhotos: 0,
        totalParticipants: 0,
        photosToday: 0,
        avgPhotosPerUser: 0,
        topContributors: [],
        uploadTimeline: [],
      totalReactions: 0,
      pendingModeration: 0,
      luckyDrawStatus: 'not_set',
      luckyDrawEntryCount: 0,
      tierMaxPhotosPerEvent: 0,
      tierDisplayName: 'Free',
      topLikedPhotos: [],
    };
    return NextResponse.json({ data: emptyStats });
    }

    const db = getTenantDb(tenantId);

    // Check if event exists AND get tenant info in parallel
    const [event, tenant] = await Promise.all([
      db.findOne('events', { id }),
      db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: tenantId })
    ]);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check permissions
    const isOwner = event.organizer_id === userId;
    const isSuperAdmin = userRole === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Use tenant's subscription tier
    const effectiveTier = (tenant?.subscription_tier as SubscriptionTier) || 'free';
    const tierConfig = getTierConfig(effectiveTier);

    // Use SQL aggregations instead of fetching all photos - much faster!
    // Run multiple queries in parallel where possible

    const [
      totalPhotosResult,
      uniqueParticipantsResult,
      photosTodayResult,
      contributorStatsResult,
      timelineResult,
      reactionsResult,
      topLikedResult,
      pendingModerationResult
    ] = await Promise.all([
      // Total photos
      db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = $1',
        [id]
      ),
      // Unique participants
      db.query<{ count: bigint }>(
        'SELECT COUNT(DISTINCT user_fingerprint) as count FROM photos WHERE event_id = $1',
        [id]
      ),
      // Photos today
      db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = $1 AND created_at >= $2',
        [id, new Date(new Date().setHours(0, 0, 0, 0))]
      ),
      // Top contributors (SQL aggregation)
      db.query<{ contributor_name: string; is_anonymous: boolean; count: bigint }>(
        `SELECT
          COALESCE(contributor_name, 'Guest') as contributor_name,
          is_anonymous,
          COUNT(*) as count
        FROM photos
        WHERE event_id = $1
        GROUP BY contributor_name, is_anonymous
        ORDER BY count DESC
        LIMIT 3`,
        [id]
      ),
      // Upload timeline (last 7 days)
      db.query<{ date: string; count: bigint }>(
        `SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM photos
        WHERE event_id = $1
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date`,
        [id]
      ),
      // Total reactions (SQL aggregation)
      db.query<{ total_reactions: bigint }>(
        `SELECT
          SUM(
            (COALESCE((reactions->>'heart')::int, 0)) +
            (COALESCE((reactions->>'clap')::int, 0)) +
            (COALESCE((reactions->>'laugh')::int, 0)) +
            (COALESCE((reactions->>'wow')::int, 0))
          ) as total_reactions
        FROM photos
        WHERE event_id = $1`,
        [id]
      ),
      // Top liked photos
      db.query<{ id: string; images: IPhoto['images']; reactions: IPhoto['reactions']; contributor_name: string | null; is_anonymous: boolean }>(
        `SELECT id, images, reactions, contributor_name, is_anonymous
        FROM photos
        WHERE event_id = $1
        ORDER BY (reactions->>'heart')::int DESC NULLS LAST
        LIMIT 3`,
        [id]
      ),
      // Pending moderation
      db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = $1 AND status = $2',
        [id, 'pending']
      )
    ]);

    // Calculate stats from query results
    const totalPhotos = Number(totalPhotosResult.rows[0]?.count || 0);
    const totalParticipants = Number(uniqueParticipantsResult.rows[0]?.count || 0);
    const photosToday = Number(photosTodayResult.rows[0]?.count || 0);
    const avgPhotosPerUser = totalParticipants > 0
      ? Math.round((totalPhotos / totalParticipants) * 10) / 10
      : 0;

    const topContributors = contributorStatsResult.rows.map(row => ({
      name: row.is_anonymous ? 'Anonymous' : (row.contributor_name || 'Guest'),
      count: Number(row.count)
    }));

    // Build timeline map and fill in missing days
    const timelineMap = new Map(timelineResult.rows.map(r => [r.date, Number(r.count)]));
    const uploadTimeline: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      uploadTimeline.push({ date: dateStr, count: timelineMap.get(dateStr) || 0 });
    }

    const totalReactions = Number(reactionsResult.rows[0]?.total_reactions || 0);

    const topLikedPhotos = topLikedResult.rows.map((photo) => ({
      id: photo.id,
      imageUrl: photo.images?.medium_url || photo.images?.full_url || photo.images?.original_url || photo.images?.thumbnail_url || '',
      heartCount: photo.reactions?.heart || 0,
      contributorName: photo.is_anonymous ? 'Anonymous' : (photo.contributor_name || 'Guest'),
      isAnonymous: photo.is_anonymous,
    }));

    const pendingModeration = Number(pendingModerationResult.rows[0]?.count || 0);

    const stats: EventStats = {
      totalPhotos,
      totalParticipants,
      photosToday,
      avgPhotosPerUser,
      topContributors,
      uploadTimeline,
      totalReactions,
      pendingModeration,
      luckyDrawStatus: 'not_set',
      luckyDrawEntryCount: 0,
      tierMaxPhotosPerEvent: tierConfig.limits.max_photos_per_event,
      tierDisplayName: tierConfig.displayName,
      topLikedPhotos,
    };

    try {
      const activeConfig = await getActiveConfig(tenantId, id);
      if (activeConfig) {
        const countResult = await db.query<{ count: bigint }>(
          `SELECT COUNT(*) as count FROM lucky_draw_entries WHERE config_id = $1`,
          [activeConfig.id]
        );
        stats.luckyDrawStatus = 'active';
        stats.luckyDrawEntryCount = Number(countResult.rows[0]?.count || 0);
      }
    } catch (err) {
      console.warn('[API] Lucky draw stats failed:', err);
    }

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('[API] Error fetching event stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event stats', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

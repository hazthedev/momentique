// ============================================
// Galeria - Event Stats API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { getActiveConfig } from '@/lib/lucky-draw';
import { getTierConfig } from '@/lib/tier-config';
import type { IPhoto, SubscriptionTier } from '@/lib/types';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';

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

function buildEmptyStats(tierMaxPhotosPerEvent = 0, tierDisplayName = 'Free'): EventStats {
  return {
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
    tierMaxPhotosPerEvent,
    tierDisplayName,
    topLikedPhotos: [],
  };
}

function getTimelineDate(value: string | Date): string {
  return new Date(value).toISOString().split('T')[0];
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
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

    // Keep stats publicly safe by returning empty stats when unauthenticated.
    if (!auth?.userId) {
      return NextResponse.json({ data: buildEmptyStats() });
    }

    const db = getTenantDb(tenantId);
    const [event, tenant] = await Promise.all([
      db.findOne<{ id: string; organizer_id: string }>('events', { id }),
      db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: tenantId }),
    ]);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === auth.userId;
    const isSuperAdmin = auth.role === 'super_admin';
    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const effectiveTier = (tenant?.subscription_tier as SubscriptionTier) || 'free';
    const tierConfig = getTierConfig(effectiveTier);
    const stats = buildEmptyStats(tierConfig.limits.max_photos_per_event, tierConfig.displayName);
    const warnings: string[] = [];

    const [
      totalPhotosResult,
      uniqueParticipantsResult,
      photosTodayResult,
      contributorStatsResult,
      timelineResult,
      reactionsResult,
      topLikedResult,
      pendingModerationResult,
    ] = await Promise.allSettled([
      db.query<{ count: bigint }>('SELECT COUNT(*) as count FROM photos WHERE event_id = $1', [id]),
      db.query<{ count: bigint }>(
        'SELECT COUNT(DISTINCT user_fingerprint) as count FROM photos WHERE event_id = $1',
        [id]
      ),
      db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = $1 AND created_at >= $2',
        [id, new Date(new Date().setHours(0, 0, 0, 0))]
      ),
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
      db.query<{ date: string | Date; count: bigint }>(
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
      db.query<{
        id: string;
        images: IPhoto['images'];
        reactions: IPhoto['reactions'];
        contributor_name: string | null;
        is_anonymous: boolean;
      }>(
        `SELECT id, images, reactions, contributor_name, is_anonymous
        FROM photos
        WHERE event_id = $1
        ORDER BY (reactions->>'heart')::int DESC NULLS LAST
        LIMIT 3`,
        [id]
      ),
      db.query<{ count: bigint }>(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = $1 AND status = $2',
        [id, 'pending']
      ),
    ]);

    if (totalPhotosResult.status === 'fulfilled') {
      stats.totalPhotos = Number(totalPhotosResult.value.rows[0]?.count || 0);
    } else {
      warnings.push('Total photos metric unavailable.');
    }

    if (uniqueParticipantsResult.status === 'fulfilled') {
      stats.totalParticipants = Number(uniqueParticipantsResult.value.rows[0]?.count || 0);
    } else {
      warnings.push('Participants metric unavailable.');
    }

    if (photosTodayResult.status === 'fulfilled') {
      stats.photosToday = Number(photosTodayResult.value.rows[0]?.count || 0);
    } else {
      warnings.push('Photos today metric unavailable.');
    }

    if (contributorStatsResult.status === 'fulfilled') {
      stats.topContributors = contributorStatsResult.value.rows.map((row) => ({
        name: row.is_anonymous ? 'Anonymous' : (row.contributor_name || 'Guest'),
        count: Number(row.count),
      }));
    } else {
      warnings.push('Top contributors unavailable.');
    }

    if (timelineResult.status === 'fulfilled') {
      const timelineMap = new Map(
        timelineResult.value.rows.map((row) => [getTimelineDate(row.date), Number(row.count)])
      );
      const uploadTimeline: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateStr = date.toISOString().split('T')[0];
        uploadTimeline.push({ date: dateStr, count: timelineMap.get(dateStr) || 0 });
      }
      stats.uploadTimeline = uploadTimeline;
    } else {
      warnings.push('Upload timeline unavailable.');
    }

    if (reactionsResult.status === 'fulfilled') {
      stats.totalReactions = Number(reactionsResult.value.rows[0]?.total_reactions || 0);
    } else {
      warnings.push('Reactions metric unavailable.');
    }

    if (topLikedResult.status === 'fulfilled') {
      stats.topLikedPhotos = topLikedResult.value.rows.map((photo) => ({
        id: photo.id,
        imageUrl:
          photo.images?.medium_url ||
          photo.images?.full_url ||
          photo.images?.original_url ||
          photo.images?.thumbnail_url ||
          '',
        heartCount: photo.reactions?.heart || 0,
        contributorName: photo.is_anonymous ? 'Anonymous' : (photo.contributor_name || 'Guest'),
        isAnonymous: photo.is_anonymous,
      }));
    } else {
      warnings.push('Top liked photos unavailable.');
    }

    if (pendingModerationResult.status === 'fulfilled') {
      stats.pendingModeration = Number(pendingModerationResult.value.rows[0]?.count || 0);
    } else {
      warnings.push('Pending moderation metric unavailable.');
    }

    if (stats.totalParticipants > 0) {
      stats.avgPhotosPerUser = Math.round((stats.totalPhotos / stats.totalParticipants) * 10) / 10;
    }

    try {
      const activeConfig = await getActiveConfig(tenantId, id);
      if (activeConfig) {
        stats.luckyDrawStatus = 'active';
        try {
          const countResult = await db.query<{ count: bigint }>(
            'SELECT COUNT(*) as count FROM lucky_draw_entries WHERE config_id = $1',
            [activeConfig.id]
          );
          stats.luckyDrawEntryCount = Number(countResult.rows[0]?.count || 0);
        } catch {
          stats.luckyDrawEntryCount = Number(activeConfig.totalEntries || 0);
          warnings.push('Lucky draw entry count unavailable; showing cached value.');
        }
      }
    } catch {
      warnings.push('Lucky draw stats unavailable.');
    }

    return NextResponse.json({
      data: stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('[API] Error fetching event stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event stats', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}


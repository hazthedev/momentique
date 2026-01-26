// ============================================
// MOMENTIQUE - Event Stats API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import type { IPhoto } from '@/lib/types';

interface EventStats {
  totalPhotos: number;
  totalParticipants: number;
  photosToday: number;
  avgPhotosPerUser: number;
  topContributors: { name: string; count: number }[];
  uploadTimeline: { date: string; count: number }[];
  totalReactions: number;
  pendingModeration: number;
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
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
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
        topLikedPhotos: [],
      };
      return NextResponse.json({ data: emptyStats });
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne('events', { id });
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

    // Get all photos for this event
    const photos = await db.findMany<IPhoto>('photos', { event_id: id });

    // Calculate stats
    const totalPhotos = photos.length;

    // Count unique participants (by user_fingerprint)
    const uniqueFingerprints = new Set(photos.map(p => p.user_fingerprint));
    const totalParticipants = uniqueFingerprints.size;

    // Count photos today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const photosToday = photos.filter(p => {
      const photoDate = new Date(p.created_at);
      return photoDate >= today;
    }).length;

    // Calculate average photos per user
    const avgPhotosPerUser = totalParticipants > 0
      ? Math.round((totalPhotos / totalParticipants) * 10) / 10
      : 0;

    // Get top contributors
    const contributorMap = new Map<string, number>();
    for (const photo of photos) {
      const name = photo.is_anonymous ? 'Anonymous' : (photo.contributor_name || 'Guest');
      contributorMap.set(name, (contributorMap.get(name) || 0) + 1);
    }

    const topContributors = Array.from(contributorMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate upload timeline (last 7 days)
    const uploadTimeline: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const count = photos.filter(p => {
        const photoDate = new Date(p.created_at);
        const photoDateStr = photoDate.toISOString().split('T')[0];
        return photoDateStr === dateStr;
      }).length;

      uploadTimeline.push({ date: dateStr, count });
    }

    // Calculate total reactions
    let totalReactions = 0;
    for (const photo of photos) {
      totalReactions += photo.reactions.heart || 0;
      totalReactions += photo.reactions.clap || 0;
      totalReactions += photo.reactions.laugh || 0;
      totalReactions += photo.reactions.wow || 0;
    }

    const topLikedPhotos = photos
      .map((photo) => ({
        id: photo.id,
        imageUrl: photo.images?.thumbnail_url || photo.images?.medium_url || photo.images?.full_url || photo.images?.original_url || '',
        heartCount: photo.reactions?.heart || 0,
        contributorName: photo.is_anonymous ? 'Anonymous' : (photo.contributor_name || 'Guest'),
        isAnonymous: photo.is_anonymous,
      }))
      .sort((a, b) => b.heartCount - a.heartCount)
      .slice(0, 3);

    // Count pending moderation
    const pendingModeration = photos.filter(p => p.status === 'pending').length;

    const stats: EventStats = {
      totalPhotos,
      totalParticipants,
      photosToday,
      avgPhotosPerUser,
      topContributors,
      uploadTimeline,
      totalReactions,
      pendingModeration,
      topLikedPhotos,
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('[API] Error fetching event stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event stats', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Galeria - Lucky Draw Participants API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { getActiveConfig, getEventEntries } from '@/lib/lucky-draw';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

export const runtime = 'nodejs';

const isRecoverableReadError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['42P01', '42703'].includes((error as { code?: string }).code || '');

// ============================================
// GET /api/events/:eventId/lucky-draw/participants - List participants
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await resolveOptionalAuth(request.headers);
    const tenantId = resolveTenantId(request.headers, auth);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne<{
      id: string;
      settings?: {
        features?: {
          lucky_draw_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
    assertEventFeatureEnabled(event, 'lucky_draw_enabled');

    // Get active config
    const config = await getActiveConfig(tenantId, eventId);

    if (!config) {
      return NextResponse.json({
        data: [],
        message: 'No active draw configuration',
      });
    }

    // Get all entries for this draw
    const entries = await getEventEntries(tenantId, config.id);

    // Group by user fingerprint to count entries per user
    const userEntryMap = new Map<string, typeof entries>();
    for (const entry of entries) {
      const existing = userEntryMap.get(entry.userFingerprint) || [];
      existing.push(entry);
      userEntryMap.set(entry.userFingerprint, existing);
    }

    // Format participants list
    const participants = Array.from(userEntryMap.entries()).map(([fingerprint, entries]) => {
      const winnerEntry = entries.find(e => e.isWinner);
      const participantName = entries.find(e => e.participantName)?.participantName || null;
      const timestamps = entries.map(entry => new Date(entry.createdAt).getTime());
      const firstEntryAt = timestamps.length ? new Date(Math.min(...timestamps)) : null;
      const lastEntryAt = timestamps.length ? new Date(Math.max(...timestamps)) : null;
      return {
        userFingerprint: fingerprint,
        participantName,
        entryCount: entries.length,
        isWinner: !!winnerEntry,
        prizeTier: winnerEntry?.prizeTier || null,
        firstEntryAt,
        lastEntryAt,
      };
    });

    // Sort by entry count (descending), then by first entry date
    participants.sort((a, b) => {
      if (b.entryCount !== a.entryCount) {
        return b.entryCount - a.entryCount;
      }
      // Handle null dates
      if (!a.firstEntryAt && !b.firstEntryAt) return 0;
      if (!a.firstEntryAt) return 1;
      if (!b.firstEntryAt) return -1;
      return new Date(a.firstEntryAt).getTime() - new Date(b.firstEntryAt).getTime();
    });

    return NextResponse.json({
      data: participants,
      pagination: {
        total: participants.length,
        uniqueParticipants: participants.length,
        totalEntries: entries.length,
      },
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    if (isRecoverableReadError(error)) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          uniqueParticipants: 0,
          totalEntries: 0,
        },
        message: 'Lucky draw tables not initialized',
      });
    }
    console.error('[API] Participants fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Galeria - Lucky Draw History API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import type { Winner } from '@/lib/types';
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
// GET /api/events/:eventId/lucky-draw/history - Get draw history
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

    const warnings: string[] = [];
    const [configsResult, winnersResult] = await Promise.allSettled([
      db.query<{
        id: string;
        status: string;
        prizeTiers: unknown;
        totalEntries: number;
        createdAt: Date;
        completedAt: Date | null;
      }>(
        `SELECT
          id,
          status,
          prize_tiers AS "prizeTiers",
          total_entries AS "totalEntries",
          created_at AS "createdAt",
          completed_at AS "completedAt"
        FROM lucky_draw_configs
        WHERE event_id = $1
        ORDER BY created_at DESC`,
        [eventId]
      ),
      db.query<(Winner & { configId: string })>(
        `SELECT
          w.id,
          w.entry_id AS "entryId",
          w.participant_name AS "participantName",
          w.prize_tier AS "prizeTier",
          w.prize_name AS "prizeName",
          w.prize_description AS "prizeDescription",
          w.selection_order AS "selectionOrder",
          w.is_claimed AS "isClaimed",
          w.drawn_at AS "drawnAt",
          w.created_at AS "createdAt",
          e.config_id AS "configId"
        FROM winners w
        JOIN lucky_draw_entries e ON e.id = w.entry_id
        WHERE w.event_id = $1
        ORDER BY w.drawn_at DESC`,
        [eventId]
      ),
    ]);

    if (configsResult.status === 'rejected') {
      if (isRecoverableReadError(configsResult.reason)) {
        return NextResponse.json({
          data: [],
          summary: {
            totalDraws: 0,
            completedDraws: 0,
            totalWinners: 0,
          },
          message: 'Lucky draw history unavailable right now.',
        });
      }
      throw configsResult.reason;
    }

    if (winnersResult.status === 'rejected') {
      if (isRecoverableReadError(winnersResult.reason)) {
        warnings.push('Winner details are temporarily unavailable.');
      } else {
        throw winnersResult.reason;
      }
    }

    const winnersByConfig = new Map<string, Winner[]>();
    if (winnersResult.status === 'fulfilled') {
      for (const winner of winnersResult.value.rows) {
        const configId = winner.configId;
        const list = winnersByConfig.get(configId) || [];
        list.push(winner);
        winnersByConfig.set(configId, list);
      }
    }

    const history = configsResult.value.rows.map((config) => {
      const configWinners = winnersByConfig.get(config.id) || [];
      return {
        configId: config.id,
        status: config.status,
        prizeTiers: config.prizeTiers,
        totalEntries: config.totalEntries,
        createdAt: config.createdAt,
        completedAt: config.completedAt,
        winners: configWinners.map((winner) => ({
          id: winner.id,
          participantName: winner.participantName,
          prizeTier: winner.prizeTier,
          prizeName: winner.prizeName,
          selectionOrder: winner.selectionOrder,
          isClaimed: winner.isClaimed,
          drawnAt: winner.drawnAt,
        })),
        winnerCount: configWinners.length,
      };
    });

    return NextResponse.json({
      data: history,
      summary: {
        totalDraws: history.length,
        completedDraws: history.filter(h => h.status === 'completed').length,
        totalWinners: winnersResult.status === 'fulfilled' ? winnersResult.value.rows.length : 0,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    if (isRecoverableReadError(error)) {
      return NextResponse.json({
        data: [],
        summary: {
          totalDraws: 0,
          completedDraws: 0,
          totalWinners: 0,
        },
        message: 'Lucky draw tables not initialized',
      });
    }
    console.error('[API] History fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

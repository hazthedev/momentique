// ============================================
// Gatherly - Lucky Draw History API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import type { Winner } from '@/lib/types';

export const runtime = 'nodejs';

const isMissingTableError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42P01';

// ============================================
// GET /api/events/:eventId/lucky-draw/history - Get draw history
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development (Turbopack middleware issue)
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get all draw configurations
    const configsResult = await db.query<{
      id: string;
      status: string;
      prizeTiers: unknown;
      totalEntries: number;
      createdAt: Date;
      completedAt: Date | null;
    }>(`
      SELECT
        id,
        status,
        prize_tiers AS "prizeTiers",
        total_entries AS "totalEntries",
        created_at AS "createdAt",
        completed_at AS "completedAt"
      FROM lucky_draw_configs
      WHERE event_id = $1
      ORDER BY created_at DESC
    `, [eventId]);

    // Get winners with their config_id
    const winnersResult = await db.query<(Winner & { configId: string })>(`
      SELECT
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
      ORDER BY w.drawn_at DESC
    `, [eventId]);

    const winnersByConfig = new Map<string, Winner[]>();
    for (const winner of winnersResult.rows) {
      const configId = winner.configId;
      const list = winnersByConfig.get(configId) || [];
      list.push(winner);
      winnersByConfig.set(configId, list);
    }

    const history = configsResult.rows.map((config) => {
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
        totalWinners: winnersResult.rows.length,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
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

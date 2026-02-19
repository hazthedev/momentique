// ============================================
// GALERIA - Lucky Draw Redraw API Route
// ============================================
// Endpoint to redraw a single prize tier when winner is unavailable

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { redrawPrizeTier } from '@/lib/lucky-draw';
import { extractSessionId, validateSession } from '@/lib/session';
import { verifyAccessToken } from '@/lib/auth';
import { publishEventBroadcast } from '@/lib/realtime/server';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';

export const runtime = 'nodejs';

// ============================================
// POST /api/events/:eventId/lucky-draw/redraw
// ============================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const headers = request.headers;
        const authContext = await resolveOptionalAuth(headers);
        const tenantId = resolveRequiredTenantId(headers, authContext);

        const db = getTenantDb(tenantId);

        // Parse request body
        const body = await request.json();
        const { prizeTier, previousWinnerId, configId, reason } = body;

        if (!prizeTier || !configId) {
            return NextResponse.json(
                { error: 'prizeTier and configId are required', code: 'MISSING_PARAMS' },
                { status: 400 }
            );
        }

        // Verify user is admin
        const cookieHeader = headers.get('cookie');
        const authHeader = headers.get('authorization');
        let userId: string | null = null;
        let userRole: string | null = null;

        // Try session-based auth first
        const sessionResult = extractSessionId(cookieHeader, authHeader);
        if (sessionResult.sessionId) {
            const session = await validateSession(sessionResult.sessionId, false);
            if (session.valid && session.session) {
                userId = session.session.userId;
                const user = await db.findOne('users', { id: userId });
                userRole = user?.role || null;
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

        if (!userId || !userRole || !['super_admin', 'organizer'].includes(userRole)) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // Execute redraw
        const result = await redrawPrizeTier(tenantId, {
            eventId,
            configId,
            prizeTier,
            previousWinnerId,
            reason: reason || 'Winner unavailable',
            redrawBy: userId,
        });

        await publishEventBroadcast(eventId, 'draw_winner', mapWinnerToBroadcastPayload(result.newWinner, eventId));

        return NextResponse.json({
            data: {
                newWinner: result.newWinner,
                previousWinner: result.previousWinner,
            },
            message: `Redraw successful. New winner: ${result.newWinner.participantName}`,
        });
    } catch (error) {
        console.error('[API] Redraw error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: errorMessage || 'Failed to redraw', code: 'REDRAW_ERROR' },
            { status: 500 }
        );
    }
}

function mapPrizeTierToLegacy(prizeTier: unknown): number {
    if (typeof prizeTier === 'number' && Number.isFinite(prizeTier)) {
        return prizeTier;
    }

    if (typeof prizeTier !== 'string') {
        return 1;
    }

    const lookup: Record<string, number> = {
        grand: 1,
        first: 2,
        second: 3,
        third: 4,
        consolation: 5,
    };

    return lookup[prizeTier] ?? 1;
}

function mapWinnerToBroadcastPayload(
    winner: {
        id?: string;
        eventId?: string;
        entryId?: string;
        participantName?: string;
        selfieUrl?: string;
        prizeTier?: string | number;
        drawnAt?: Date;
        isClaimed?: boolean;
    },
    eventId: string
) {
    const normalizedEventId = winner.eventId || eventId;
    const normalizedEntryId = winner.entryId || '';
    const normalizedParticipant = winner.participantName || 'Anonymous';
    const normalizedSelfie = winner.selfieUrl || '';
    const normalizedPrizeTier = mapPrizeTierToLegacy(winner.prizeTier);
    const normalizedDrawnAt = winner.drawnAt ?? new Date();

    return {
        id: winner.id || `winner_${Date.now()}`,
        event_id: normalizedEventId,
        entry_id: normalizedEntryId,
        participant_name: normalizedParticipant,
        selfie_url: normalizedSelfie,
        prize_tier: normalizedPrizeTier,
        drawn_at: normalizedDrawnAt,
        drawn_by: 'admin',
        is_claimed: winner.isClaimed ?? false,

        eventId: normalizedEventId,
        entryId: normalizedEntryId,
        participantName: normalizedParticipant,
        selfieUrl: normalizedSelfie,
        prizeTier: winner.prizeTier,
        drawnAt: normalizedDrawnAt,
        isClaimed: winner.isClaimed ?? false,
    };
}

// ============================================
// GATHERLY - Lucky Draw Redraw API Route
// ============================================
// Endpoint to redraw a single prize tier when winner is unavailable

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { redrawPrizeTier } from '@/lib/lucky-draw';
import { extractSessionId, validateSession } from '@/lib/session';
import { verifyAccessToken } from '@/lib/auth';

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
        let tenantId = getTenantId(headers);

        // Fallback to default tenant for development
        if (!tenantId) {
            tenantId = '00000000-0000-0000-0000-000000000001';
        }

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

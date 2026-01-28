// ============================================
// MOMENTIQUE - Supervisor Stats API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const isMissingTableError = (error: unknown) =>
    (error as { code?: string })?.code === '42P01';
const isDatabaseError = (error: unknown) =>
    Boolean((error as { code?: string })?.code) ||
    (error instanceof Error && /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND/i.test(error.message));

export async function GET(request: NextRequest) {
    try {
        // Require supervisor role
        const auth = await requireSuperAdmin(request);
        if (auth instanceof NextResponse) {
            return auth;
        }

        const db = getTenantDb(SYSTEM_TENANT_ID);

        const safeCount = async (query: string) => {
            try {
                const result = await db.query(query);
                return Number(result.rows[0]?.count || 0);
            } catch (error) {
                if (isMissingTableError(error)) return 0;
                throw error;
            }
        };

        const [
            totalUsers,
            totalEvents,
            totalPhotos,
            totalTenants,
            activeEvents,
            recentUsers,
        ] = await Promise.all([
            safeCount('SELECT COUNT(*) as count FROM users'),
            safeCount('SELECT COUNT(*) as count FROM events'),
            safeCount('SELECT COUNT(*) as count FROM photos'),
            safeCount('SELECT COUNT(*) as count FROM tenants'),
            safeCount("SELECT COUNT(*) as count FROM events WHERE status = 'active'"),
            safeCount("SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'"),
        ]);

        return NextResponse.json({
            data: {
                totalUsers,
                totalEvents,
                totalPhotos,
                totalTenants,
                activeEvents,
                recentUsers,
            },
        });
    } catch (error) {
        console.error('[SUPERVISOR_STATS] Error:', error);
        if (isDatabaseError(error)) {
            return NextResponse.json({
                data: {
                    totalUsers: 0,
                    totalEvents: 0,
                    totalPhotos: 0,
                    totalTenants: 0,
                    activeEvents: 0,
                    recentUsers: 0,
                },
            });
        }
        return NextResponse.json(
            { error: 'Failed to fetch stats', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

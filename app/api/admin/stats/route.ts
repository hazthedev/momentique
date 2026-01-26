// ============================================
// MOMENTIQUE - Supervisor Stats API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
    try {
        // Require supervisor role
        const auth = await requireSuperAdmin(request);
        if (auth instanceof NextResponse) {
            return auth;
        }

        const db = getTenantDb(SYSTEM_TENANT_ID);

        // Get counts from database
        const [usersResult, eventsResult, photosResult, tenantsResult] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM users'),
            db.query('SELECT COUNT(*) as count FROM events'),
            db.query('SELECT COUNT(*) as count FROM photos'),
            db.query('SELECT COUNT(*) as count FROM tenants'),
        ]);

        // Get active events count
        const activeEventsResult = await db.query(
            "SELECT COUNT(*) as count FROM events WHERE status = 'active'"
        );

        // Get recent users (last 7 days)
        const recentUsersResult = await db.query(
            "SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
        );

        return NextResponse.json({
            data: {
                totalUsers: Number(usersResult.rows[0]?.count || 0),
                totalEvents: Number(eventsResult.rows[0]?.count || 0),
                totalPhotos: Number(photosResult.rows[0]?.count || 0),
                totalTenants: Number(tenantsResult.rows[0]?.count || 0),
                activeEvents: Number(activeEventsResult.rows[0]?.count || 0),
                recentUsers: Number(recentUsersResult.rows[0]?.count || 0),
            },
        });
    } catch (error) {
        console.error('[SUPERVISOR_STATS] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

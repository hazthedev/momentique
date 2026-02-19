// ============================================
// Galeria - Supervisor Users API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireSuperAdmin(request);
        if (auth instanceof NextResponse) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
        const role = searchParams.get('role');
        const search = searchParams.get('search');

        const offset = (page - 1) * limit;
        const db = getTenantDb(auth.user.tenant_id);

        // Build query conditions
        let whereClause = '1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (role && role !== 'all') {
            whereClause += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        if (search) {
            whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get users
        const usersResult = await db.query(
            `SELECT
         u.id,
         u.email,
         u.name,
         u.role,
         u.tenant_id,
         CASE
           WHEN u.role = 'super_admin' THEN COALESCE(u.subscription_tier, 'free')
           ELSE COALESCE(t.subscription_tier, u.subscription_tier, 'free')
         END AS subscription_tier,
         u.subscription_tier AS user_subscription_tier,
         t.subscription_tier AS tenant_subscription_tier,
         u.created_at,
         u.last_login_at
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as count FROM users u WHERE ${whereClause}`,
            params
        );

        const total = Number(countResult.rows[0]?.count || 0);

        return NextResponse.json({
            data: usersResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('[SUPERVISOR_USERS] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

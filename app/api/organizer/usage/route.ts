// ============================================
// Galeria - Organizer Usage API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';
import { getTierConfig } from '@/lib/tier-config';
import type { SubscriptionTier, IUser } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { userId, tenantId, payload } = await requireAuthForApi(request.headers);

    if (!['organizer', 'super_admin'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const db = getTenantDb(tenantId);
    const [user, tenant] = await Promise.all([
      db.findOne<IUser>('users', { id: userId }),
      db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: tenantId }),
    ]);
    const tier = (tenant?.subscription_tier || user?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = getTierConfig(tier);

    const eventsThisMonthResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM events
       WHERE organizer_id = $1
       AND created_at >= date_trunc('month', now())`,
      [userId]
    );

    const totalEventsResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM events
       WHERE organizer_id = $1`,
      [userId]
    );

    const totalPhotosResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM photos p
       JOIN events e ON p.event_id = e.id
       WHERE e.organizer_id = $1`,
      [userId]
    );

    return NextResponse.json({
      data: {
        tier,
        usage: {
          eventsThisMonth: Number(eventsThisMonthResult.rows[0]?.count || 0),
          totalEvents: Number(totalEventsResult.rows[0]?.count || 0),
          totalPhotos: Number(totalPhotosResult.rows[0]?.count || 0),
        },
        limits: tierConfig.limits,
        features: tierConfig.features,
      },
    });
  } catch (error) {
    console.error('[ORGANIZER_USAGE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load usage', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

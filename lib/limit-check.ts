// ============================================
// GALERIA - Limit Checking Utilities
// ============================================
// Functions for checking subscription tier limits before actions.
// Used to enforce limits on events, photos, and features.

import { getTenantDb } from './db';
import { getTierConfig, isLimitReached, isFeatureEnabled } from './tier-config';
import type { SubscriptionTier, ITenantFeatures } from './types';

// ============================================
// RESULT TYPES
// ============================================

export interface ILimitCheckResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    remaining: number;
    upgradeRequired: boolean;
    message?: string;
}

export interface IFeatureCheckResult {
    allowed: boolean;
    feature: keyof ITenantFeatures;
    upgradeRequired: boolean;
    message?: string;
}

// ============================================
// EVENT LIMIT CHECK
// ============================================

/**
 * Check if a tenant can create more events this month
 */
export async function checkEventLimit(
    tenantId: string,
    subscriptionTier: SubscriptionTier
): Promise<ILimitCheckResult> {
    const tierConfig = getTierConfig(subscriptionTier);
    const limit = tierConfig.limits.max_events_per_month;

    // Unlimited (-1)
    if (limit === -1) {
        return {
            allowed: true,
            currentCount: 0,
            limit: -1,
            remaining: -1,
            upgradeRequired: false,
        };
    }

    // Count events created this month
    const db = getTenantDb(tenantId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM events 
     WHERE tenant_id = $1 
     AND created_at >= $2`,
        [tenantId, startOfMonth]
    );

    const currentCount = parseInt(result.rows[0]?.count || '0', 10);
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return {
        allowed,
        currentCount,
        limit,
        remaining,
        upgradeRequired: !allowed,
        message: allowed
            ? undefined
            : `You've reached your monthly event limit (${limit}). Upgrade to create more events.`,
    };
}

// ============================================
// PHOTO LIMIT CHECK
// ============================================

/**
 * Check if an event can accept more photos
 */
export async function checkPhotoLimit(
    eventId: string,
    tenantId: string,
    subscriptionTier: SubscriptionTier
): Promise<ILimitCheckResult> {
    const tierConfig = getTierConfig(subscriptionTier);
    const limit = tierConfig.limits.max_photos_per_event;

    // Unlimited (-1)
    if (limit === -1) {
        return {
            allowed: true,
            currentCount: 0,
            limit: -1,
            remaining: -1,
            upgradeRequired: false,
        };
    }

    // Count photos in this event
    const db = getTenantDb(tenantId);
    const result = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM photos WHERE event_id = $1`,
        [eventId]
    );

    const currentCount = parseInt(result.rows[0]?.count || '0', 10);
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return {
        allowed,
        currentCount,
        limit,
        remaining,
        upgradeRequired: !allowed,
        message: allowed
            ? undefined
            : `This event has reached its photo limit (${limit}). Upgrade to allow more photos.`,
    };
}

// ============================================
// FEATURE ACCESS CHECK
// ============================================

/**
 * Check if a feature is available for a subscription tier
 */
export function checkFeatureAccess(
    subscriptionTier: SubscriptionTier,
    feature: keyof ITenantFeatures
): IFeatureCheckResult {
    const allowed = isFeatureEnabled(subscriptionTier, feature);

    const featureNames: Record<keyof ITenantFeatures, string> = {
        lucky_draw: 'Lucky Draw',
        photo_reactions: 'Photo Reactions',
        video_uploads: 'Video Uploads',
        custom_templates: 'Custom Templates',
        api_access: 'API Access',
        sso: 'Single Sign-On',
        white_label: 'White Label',
        advanced_analytics: 'Advanced Analytics',
    };

    return {
        allowed,
        feature,
        upgradeRequired: !allowed,
        message: allowed
            ? undefined
            : `${featureNames[feature]} is not available on your current plan. Upgrade to unlock this feature.`,
    };
}

// ============================================
// BULK LIMIT CHECK
// ============================================

/**
 * Get all limit statuses for a tenant (useful for dashboard)
 */
export async function getTenantLimitStatus(
    tenantId: string,
    subscriptionTier: SubscriptionTier
): Promise<{
    events: ILimitCheckResult;
    tier: SubscriptionTier;
    tierDisplayName: string;
}> {
    const tierConfig = getTierConfig(subscriptionTier);
    const eventLimit = await checkEventLimit(tenantId, subscriptionTier);

    return {
        events: eventLimit,
        tier: subscriptionTier,
        tierDisplayName: tierConfig.displayName,
    };
}

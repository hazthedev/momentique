// ============================================
// GATHERLY - Subscription Tier Configuration
// ============================================
// Defines features and limits for each subscription tier.
// Used for limit enforcement and feature gating throughout the app.

import type { ITenantFeatures, ITenantLimits, SubscriptionTier } from './types';

// ============================================
// TIER FEATURE DEFINITIONS
// ============================================

export const FREE_TIER_FEATURES: ITenantFeatures = {
  lucky_draw: false,
  photo_reactions: true,
  video_uploads: false,
  custom_templates: false,
  api_access: false,
  sso: false,
  white_label: false, // Shows "Powered by Gatherly"
  advanced_analytics: false,
};

export const PRO_TIER_FEATURES: ITenantFeatures = {
  lucky_draw: true,
  photo_reactions: true,
  video_uploads: false,
  custom_templates: true,
  api_access: false,
  sso: false,
  white_label: true, // No branding watermark
  advanced_analytics: true,
};

export const PREMIUM_TIER_FEATURES: ITenantFeatures = {
  lucky_draw: true,
  photo_reactions: true,
  video_uploads: true,
  custom_templates: true,
  api_access: true,
  sso: false,
  white_label: true,
  advanced_analytics: true,
};

export const ENTERPRISE_TIER_FEATURES: ITenantFeatures = {
  lucky_draw: true,
  photo_reactions: true,
  video_uploads: true,
  custom_templates: true,
  api_access: true,
  sso: true,
  white_label: true,
  advanced_analytics: true,
};

export const TESTER_TIER_FEATURES: ITenantFeatures = {
  lucky_draw: true,
  photo_reactions: true,
  video_uploads: true,
  custom_templates: true,
  api_access: true,
  sso: true,
  white_label: true,
  advanced_analytics: true,
};

// ============================================
// TIER LIMIT DEFINITIONS
// ============================================

export const FREE_TIER_LIMITS: ITenantLimits = {
  max_events_per_month: 1,
  max_storage_gb: 1,
  max_admins: 1,
  max_photos_per_event: 20,
  max_draw_entries_per_event: 0, // No lucky draw
  custom_features: [],
};

export const PRO_TIER_LIMITS: ITenantLimits = {
  max_events_per_month: 10,
  max_storage_gb: 50,
  max_admins: 3,
  max_photos_per_event: 100,
  max_draw_entries_per_event: 200,
  custom_features: [],
};

export const PREMIUM_TIER_LIMITS: ITenantLimits = {
  max_events_per_month: 50,
  max_storage_gb: 200,
  max_admins: 10,
  max_photos_per_event: 500,
  max_draw_entries_per_event: 1000,
  custom_features: [],
};

export const ENTERPRISE_TIER_LIMITS: ITenantLimits = {
  max_events_per_month: -1, // Unlimited
  max_storage_gb: -1, // Unlimited
  max_admins: -1, // Unlimited
  max_photos_per_event: -1, // Unlimited
  max_draw_entries_per_event: -1, // Unlimited
  custom_features: [],
};

export const TESTER_TIER_LIMITS: ITenantLimits = {
  max_events_per_month: -1,
  max_storage_gb: -1,
  max_admins: -1,
  max_photos_per_event: -1,
  max_draw_entries_per_event: -1,
  custom_features: [],
};

// ============================================
// TIER CONFIG HELPER
// ============================================

export interface ITierConfig {
  tier: SubscriptionTier;
  features: ITenantFeatures;
  limits: ITenantLimits;
  displayName: string;
  description: string;
  priceMonthly: number; // in cents, 0 = free
}

export const TIER_CONFIGS: Record<SubscriptionTier, ITierConfig> = {
  free: {
    tier: 'free',
    features: FREE_TIER_FEATURES,
    limits: FREE_TIER_LIMITS,
    displayName: 'Free',
    description: 'Perfect for trying out Gatherly',
    priceMonthly: 0,
  },
  pro: {
    tier: 'pro',
    features: PRO_TIER_FEATURES,
    limits: PRO_TIER_LIMITS,
    displayName: 'Pro',
    description: 'For regular event organizers',
    priceMonthly: 2900, // $29/month
  },
  premium: {
    tier: 'premium',
    features: PREMIUM_TIER_FEATURES,
    limits: PREMIUM_TIER_LIMITS,
    displayName: 'Premium',
    description: 'For agencies and power users',
    priceMonthly: 7900, // $79/month
  },
  enterprise: {
    tier: 'enterprise',
    features: ENTERPRISE_TIER_FEATURES,
    limits: ENTERPRISE_TIER_LIMITS,
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: -1, // Contact sales
  },
  tester: {
    tier: 'tester',
    features: TESTER_TIER_FEATURES,
    limits: TESTER_TIER_LIMITS,
    displayName: 'Tester',
    description: 'Unlimited access for internal testing',
    priceMonthly: 0,
  },
};

/**
 * Get the configuration for a subscription tier
 */
export function getTierConfig(tier: SubscriptionTier): ITierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Check if a feature is enabled for a tier
 */
export function isFeatureEnabled(tier: SubscriptionTier, feature: keyof ITenantFeatures): boolean {
  const config = getTierConfig(tier);
  return config.features[feature];
}

/**
 * Get the limit value for a tier (-1 means unlimited)
 */
export function getTierLimit(tier: SubscriptionTier, limit: keyof ITenantLimits): number | string[] {
  const config = getTierConfig(tier);
  return config.limits[limit];
}

/**
 * Check if a limit has been reached
 * Returns true if limit is reached (should block action)
 */
export function isLimitReached(
  tier: SubscriptionTier,
  limit: keyof Omit<ITenantLimits, 'custom_features'>,
  currentCount: number
): boolean {
  const limitValue = getTierLimit(tier, limit) as number;
  
  // -1 means unlimited
  if (limitValue === -1) {
    return false;
  }
  
  return currentCount >= limitValue;
}

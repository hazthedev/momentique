// ============================================
// GALERIA - Subscription Tier Helpers
// ============================================

import { getTenantDb } from './db';
import { extractSessionId, validateSession } from './session';
import { verifyAccessToken } from './auth';
import type { SubscriptionTier, IUser } from './types';

export async function resolveUserTier(
  headers: Headers,
  tenantId: string,
  fallbackTier: SubscriptionTier = 'free'
): Promise<SubscriptionTier> {
  const resolveTenantTier = async (effectiveTenantId: string): Promise<SubscriptionTier | null> => {
    const db = getTenantDb(effectiveTenantId);
    const tenant = await db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: effectiveTenantId });
    return tenant?.subscription_tier || null;
  };

  const authHeader = headers.get('authorization');
  const cookieHeader = headers.get('cookie');

  // Try session-based auth first
  const sessionResult = extractSessionId(cookieHeader, authHeader);
  if (sessionResult.sessionId) {
    const session = await validateSession(sessionResult.sessionId, false);
    if (session.valid && session.user) {
      const effectiveTenantId = session.user.tenant_id || tenantId;
      try {
        const tenantTier = await resolveTenantTier(effectiveTenantId);
        if (tenantTier) return tenantTier;
      } catch {
        // Fall through to user tier / fallback.
      }
      return (session.user.subscription_tier as SubscriptionTier) || fallbackTier;
    }
  }

  // Fallback to JWT
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyAccessToken(token);
      const effectiveTenantId = payload.tenant_id || tenantId;
      try {
        const tenantTier = await resolveTenantTier(effectiveTenantId);
        if (tenantTier) return tenantTier;
      } catch {
        // Fall through to user tier / fallback.
      }
      const db = getTenantDb(effectiveTenantId);
      const user = await db.findOne<IUser>('users', { id: payload.sub });
      return (user?.subscription_tier as SubscriptionTier) || fallbackTier;
    } catch {
      return fallbackTier;
    }
  }

  return fallbackTier;
}

// ============================================
// Galeria - Cache Strategy Helpers
// ============================================

export type CacheProfile = {
  scope?: 'public' | 'private';
  maxAge: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
};

export const CACHE_PROFILES = {
  photosPublic: {
    scope: 'public' as const,
    maxAge: 30,
    sMaxAge: 60,
    staleWhileRevalidate: 120,
  },
  apiPrivate: {
    scope: 'private' as const,
    maxAge: 10,
  },
};

export const buildCacheControl = (profile: CacheProfile) => {
  const parts: string[] = [];
  parts.push(profile.scope || 'private');
  parts.push(`max-age=${profile.maxAge}`);
  if (profile.sMaxAge !== undefined) {
    parts.push(`s-maxage=${profile.sMaxAge}`);
  }
  if (profile.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${profile.staleWhileRevalidate}`);
  }
  return parts.join(', ');
};

export const applyCacheHeaders = (response: Response, profile: CacheProfile) => {
  response.headers.set('Cache-Control', buildCacheControl(profile));
  return response;
};

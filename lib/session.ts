// ============================================
// Galeria - Session Management
// ============================================
// Redis-based session storage for multi-tenant authentication
// Features: sliding expiration, device tracking, security validation

import { randomBytes } from 'crypto';
import type { IUser, UserRole } from './types';
import { getRedisClient, deleteKey, setKeyWithExpiry, getKey, setExpiry, getTTL } from './redis';
import { getTenantDb } from './db';

// ============================================
// CONFIGURATION
// ============================================

const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '604800', 10); // 7 days default
const SESSION_MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '2592000', 10); // 30 days absolute max
const SESSION_REMEMBER_ME_TTL = parseInt(process.env.SESSION_REMEMBER_ME_TTL || '2592000', 10); // 30 days for remember me
const USE_IN_MEMORY_SESSIONS = process.env.NODE_ENV !== 'production';

const inMemorySessions = new Map<string, ISessionData>();

function getInMemorySession(sessionId: string): ISessionData | null {
  const session = inMemorySessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    inMemorySessions.delete(sessionId);
    return null;
  }
  return session;
}

if (!process.env.SESSION_SECRET) {
  console.warn('[SESSION] SESSION_SECRET is not configured. Set it in production for stronger session hardening.');
}

// ============================================
// TYPES
// ============================================

/**
 * Session data stored in Redis
 */
export interface ISessionData {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  createdAt: number; // Unix timestamp in milliseconds
  lastActivity: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
  ipAddress?: string;
  userAgent?: string;
  rememberMe: boolean;
}

/**
 * Session validation result
 */
export interface ISessionValidationResult {
  valid: boolean;
  session?: ISessionData;
  user?: IUser;
  error?: string;
}

/**
 * Session creation options
 */
export interface ISessionOptions {
  ipAddress?: string;
  userAgent?: string;
  rememberMe?: boolean;
}

// ============================================
// SESSION ID GENERATION
// ============================================

/**
 * Generate a secure session ID
 * Uses crypto.randomBytes for cryptographically secure random values
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get the Redis key for a session
 */
export function getSessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

// ============================================
// SESSION CREATION
// ============================================

/**
 * Create a new session for a user
 * @param user - The user object
 * @param options - Session options (IP address, user agent, remember me)
 * @returns The session ID
 */
export async function createSession(
  user: IUser,
  options: ISessionOptions = {}
): Promise<string> {
  const { ipAddress, userAgent, rememberMe = false } = options;

  const sessionId = generateSessionId();
  const now = Date.now();
  const ttl = rememberMe ? SESSION_REMEMBER_ME_TTL : SESSION_TTL_SECONDS;

  const sessionData: ISessionData = {
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email,
    name: user.name,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + (ttl * 1000),
    ipAddress,
    userAgent,
    rememberMe,
  };

  // Store session in Redis with TTL
  await setKeyWithExpiry(getSessionKey(sessionId), sessionData, ttl);
  if (USE_IN_MEMORY_SESSIONS) {
    inMemorySessions.set(sessionId, sessionData);
  } else {
    // In production/serverless, sessions must persist in Redis.
    const persistedSession = await getKey<ISessionData>(getSessionKey(sessionId));
    if (!persistedSession) {
      throw new Error('[SESSION] Failed to persist session in Redis');
    }
  }

  console.log(`[SESSION] Created session ${sessionId} for user ${user.id}`);

  return sessionId;
}

// ============================================
// SESSION RETRIEVAL
// ============================================

/**
 * Get a session by ID
 * @param sessionId - The session ID
 * @returns The session data or null if not found
 */
export async function getSession(sessionId: string): Promise<ISessionData | null> {
  const session = await getKey<ISessionData>(getSessionKey(sessionId));
  if (session) {
    if (USE_IN_MEMORY_SESSIONS) {
      inMemorySessions.set(sessionId, session);
    }
    return session;
  }
  return USE_IN_MEMORY_SESSIONS ? getInMemorySession(sessionId) : null;
}

// ============================================
// SESSION VALIDATION
// ============================================

/**
 * Validate a session and optionally refresh its TTL (sliding window)
 * @param sessionId - The session ID
 * @param refreshTTL - Whether to refresh the session TTL on validation (default: true)
 * @returns The validation result with session and user data if valid
 */
export async function validateSession(
  sessionId: string,
  refreshTTL: boolean = true
): Promise<ISessionValidationResult> {
  if (!sessionId) {
    return { valid: false, error: 'No session ID provided' };
  }

  // Get session from Redis
  const session = await getSession(sessionId);

  if (!session) {
    return { valid: false, error: 'Session not found or expired' };
  }

  // Check if session has expired
  const now = Date.now();
  if (now > session.expiresAt) {
    await deleteKey(getSessionKey(sessionId));
    return { valid: false, error: 'Session expired' };
  }

  // Check if session exceeds maximum age
  const maxAge = SESSION_MAX_AGE_SECONDS * 1000;
  if (now - session.createdAt > maxAge) {
    await deleteKey(getSessionKey(sessionId));
    return { valid: false, error: 'Session exceeded maximum age' };
  }

  // Get user from database to verify they still exist
  try {
    const db = getTenantDb(session.tenantId);
    const user = await db.findOne<IUser>('users', { id: session.userId });

    if (!user) {
      await deleteKey(getSessionKey(sessionId));
      return { valid: false, error: 'User not found' };
    }

    // Refresh session TTL if requested (sliding window)
    if (refreshTTL) {
      await refreshSession(sessionId);
    }

    return {
      valid: true,
      session,
      user,
    };
  } catch (error) {
    console.error('[SESSION] Error validating session:', error);
    return { valid: false, error: 'Database error' };
  }
}

// ============================================
// SESSION REFRESH (Sliding Window)
// ============================================

/**
 * Refresh a session's TTL and update last activity
 * This implements the "sliding window" expiration pattern
 * @param sessionId - The session ID
 * @returns True if session was refreshed, false if not found
 */
export async function refreshSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);

  if (!session) {
    return false;
  }

  // Update last activity
  session.lastActivity = Date.now();

  // Calculate new TTL based on remember me setting
  const ttl = session.rememberMe ? SESSION_REMEMBER_ME_TTL : SESSION_TTL_SECONDS;

  // Update expiresAt
  session.expiresAt = Date.now() + (ttl * 1000);

  // Save updated session with new TTL
  await setKeyWithExpiry(getSessionKey(sessionId), session, ttl);
  if (USE_IN_MEMORY_SESSIONS) {
    inMemorySessions.set(sessionId, session);
  }

  return true;
}

// ============================================
// SESSION DELETION
// ============================================

/**
 * Delete a session (logout)
 * @param sessionId - The session ID
 * @returns True if session was deleted
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await deleteKey(getSessionKey(sessionId));
  if (USE_IN_MEMORY_SESSIONS) {
    inMemorySessions.delete(sessionId);
  }
  const deleted = result > 0;

  if (deleted) {
    console.log(`[SESSION] Deleted session ${sessionId}`);
  }

  return deleted;
}

/**
 * Delete all sessions for a user (logout from all devices)
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @returns Number of sessions deleted
 */
export async function deleteUserSessions(
  userId: string,
  tenantId: string
): Promise<number> {
  // This would require scanning Redis keys, which can be expensive
  // For now, we'll implement a simpler approach using user-specific keys
  // In production, consider using a SET to track user sessions

  const redis = getRedisClient();
  const pattern = `session:*`;
  const keys: string[] = [];

  // Scan for sessions (this is expensive, use sparingly)
  // A better approach would be to maintain a SET of user session IDs
  let cursor = '0';
  do {
    const [newCursor, scannedKeys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      '100'
    );
    cursor = newCursor;

    for (const key of scannedKeys) {
      const sessionData = await getKey<ISessionData>(key);
      if (sessionData?.userId === userId && sessionData?.tenantId === tenantId) {
        keys.push(key);
      }
    }
  } while (cursor !== '0');

  if (keys.length === 0) {
    return 0;
  }

  const deleted = await deleteKeys(keys);
  if (USE_IN_MEMORY_SESSIONS) {
    for (const [key, session] of inMemorySessions.entries()) {
      if (session.userId === userId && session.tenantId === tenantId) {
        inMemorySessions.delete(key);
      }
    }
  }
  return deleted;
}

/**
 * Helper to delete multiple session keys
 */
async function deleteKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const redis = getRedisClient();
  return await redis.del(...keys);
}

// ============================================
// SESSION INFO
// ============================================

/**
 * Get the remaining time until session expires (in seconds)
 * @param sessionId - The session ID
 * @returns Remaining TTL in seconds, or -1 if session doesn't exist
 */
export async function getSessionTTL(sessionId: string): Promise<number> {
  try {
    return await getTTL(getSessionKey(sessionId));
  } catch {
    if (!USE_IN_MEMORY_SESSIONS) return -1;
    const session = getInMemorySession(sessionId);
    if (!session) return -1;
    const ttlMs = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(ttlMs / 1000));
  }
}

/**
 * Check if a session exists and is valid
 * @param sessionId - The session ID
 * @returns True if session exists
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;

  // Check expiration
  return Date.now() <= session.expiresAt;
}

// ============================================
// SECURITY: DEVICE/IP TRACKING
// ============================================

/**
 * Verify that the session is being used from the same IP address
 * Useful for detecting session hijacking
 * @param session - The session data
 * @param ipAddress - The current IP address
 * @returns True if IP matches or session has no IP recorded
 */
export function verifySessionIP(session: ISessionData, ipAddress: string): boolean {
  if (!session.ipAddress) {
    return true; // No IP recorded, skip check
  }
  return session.ipAddress === ipAddress;
}

/**
 * Verify that the session is being used from the same user agent
 * Useful for detecting session hijacking
 * @param session - The session data
 * @param userAgent - The current user agent
 * @returns True if user agent matches or session has no UA recorded
 */
export function verifySessionUserAgent(session: ISessionData, userAgent: string): boolean {
  if (!session.userAgent) {
    return true; // No UA recorded, skip check
  }
  return session.userAgent === userAgent;
}

// ============================================
// SESSION CLEANUP (Maintenance)
// ============================================

/**
 * Clean up expired sessions
 * This is typically handled by Redis's built-in key expiration
 * but can be useful for maintenance or if using a different storage
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  // Redis handles this automatically with TTL
  // This is a no-op but kept for API compatibility
  // if switching to a different storage mechanism
  return 0;
}

// ============================================
// MIDDLEWARE HELPERS
// ============================================

/**
 * Extract session ID from a request
 * Checks cookie header first, then authorization header
 */
export interface SessionIdExtractionResult {
  sessionId: string | null;
  source: 'cookie' | 'header' | null;
}

export function extractSessionId(
  cookieHeader: string | null,
  authHeader: string | null
): SessionIdExtractionResult {
  // Try cookie first
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session='));

    if (sessionCookie) {
      return {
        sessionId: sessionCookie.substring('session='.length),
        source: 'cookie',
      };
    }
  }

  // Try authorization header (Bearer token)
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return {
        sessionId: parts[1],
        source: 'header',
      };
    }
  }

  return { sessionId: null, source: null };
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  // Check various headers for IP address
  const forwardedFor = headers instanceof Headers 
    ? headers.get('x-forwarded-for')
    : headers['x-forwarded-for'];
  const realIp = headers instanceof Headers
    ? headers.get('x-real-ip')
    : headers['x-real-ip'];
  const cfConnectingIp = headers instanceof Headers
    ? headers.get('cf-connecting-ip')
    : headers['cf-connecting-ip'];

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(',')[0]?.trim() || 'unknown';
  }
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  if (typeof realIp === 'string') {
    return realIp;
  }
  if (typeof cfConnectingIp === 'string') {
    return cfConnectingIp;
  }

  return 'unknown';
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  const userAgent = headers instanceof Headers
    ? headers.get('user-agent')
    : headers['user-agent'];

  if (typeof userAgent === 'string') {
    return userAgent;
  }

  return 'unknown';
}

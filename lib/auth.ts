// ============================================
// GATHERLY - Authentication & JWT
// ============================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import type { IUser, IJWTPayload, IAuthTokens, IAuthResponse } from './types';
import { getTenantDb } from './db';
import { extractSessionId, validateSession } from './session';

// ============================================
// CONFIGURATION
// ============================================

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || '';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || '';
const ACCESS_TOKEN_EXPIRES = parseInt(process.env.JWT_ACCESS_EXPIRES || '900', 10); // 15 minutes
const REFRESH_TOKEN_EXPIRES = parseInt(process.env.JWT_REFRESH_EXPIRES || '604800', 10); // 7 days

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  if (IS_PROD && !IS_BUILD && typeof window === 'undefined') {
    throw new Error('[Auth] JWT secrets not configured');
  }
  if (!IS_PROD) {
    console.warn('[Auth] JWT secrets not configured. Using temporary secrets in development only.');
  }
}

// ============================================
// PASSWORD HASHING
// ============================================

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with its hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate access token
 */
export function generateAccessToken(payload: IJWTPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
    issuer: 'gatherly.app',
    audience: 'gatherly-api',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: IJWTPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
    issuer: 'gatherly.app',
    audience: 'gatherly-api',
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: IJWTPayload): IAuthTokens {
  return {
    access_token: generateAccessToken(payload),
    refresh_token: generateRefreshToken(payload),
    expires_in: ACCESS_TOKEN_EXPIRES,
  };
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): IJWTPayload {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: 'gatherly.app',
      audience: 'gatherly-api',
    }) as IJWTPayload;
  } catch (_error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): IJWTPayload {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'gatherly.app',
      audience: 'gatherly-api',
    }) as IJWTPayload;
  } catch (_error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Decode token without verification (for getting headers)
 */
export function decodeToken(token: string): IJWTPayload | null {
  try {
    return jwt.decode(token) as IJWTPayload;
  } catch {
    return null;
  }
}

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<IAuthTokens> {
  const payload = verifyRefreshToken(refreshToken);

  // Verify user still exists and is active
  const db = getTenantDb(payload.tenant_id);
  const user = await db.findOne<IUser>('users', { id: payload.sub });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate new tokens
  return generateTokens({
    sub: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
  });
}

// ============================================
// USER AUTHENTICATION
// ============================================

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  tenantId: string,
  email: string,
  password: string
): Promise<IAuthResponse> {
  const db = getTenantDb(tenantId);

  // Find user by email
  const user = await db.findOne<IUser>('users', {
    tenant_id: tenantId,
    email: email.toLowerCase(),
  });

  if (!user || !user.password_hash) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const tokens = generateTokens({
    sub: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
  });

  // Update last login
  await db.update(
    'users',
    { last_login_at: new Date() },
    { id: user.id }
  );

  // Remove password hash from response
  const { password_hash: _removed, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword as IUser,
    tokens,
  };
}

// ============================================
// USER REGISTRATION
// ============================================

interface IRegisterInput {
  email: string;
  password: string;
  name: string;
  tenant_id: string;
}

/**
 * Register a new user
 */
export async function registerUser(
  input: IRegisterInput
): Promise<IAuthResponse> {
  const { email, password, name, tenant_id } = input;

  const db = getTenantDb(tenant_id);

  // Check if user already exists
  const existingUser = await db.findOne<IUser>('users', {
    tenant_id,
    email: email.toLowerCase(),
  });

  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Create user
  const userId = crypto.randomUUID();
  const user = await db.insert<IUser>('users', {
    id: userId,
    tenant_id,
    email: email.toLowerCase(),
    password_hash,
    name,
    role: 'organizer',
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Generate tokens
  const tokens = generateTokens({
    sub: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
  });

  // Remove password hash from response
  const { password_hash: _removed, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword as IUser,
    tokens,
  };
}

// ============================================
// SESSION STORAGE (Redis)
// ============================================

interface ISession {
  user_id: string;
  tenant_id: string;
  refresh_token: string;
  expires_at: Date;
  user_agent?: string;
  ip_address?: string;
}

/**
 * Store refresh token in Redis
 */
export async function storeSession(
  sessionId: string,
  _session: ISession
): Promise<void> {
  // TODO: Implement Redis storage
  // For now, we'll use in-memory (not production-ready)
  console.log('[Auth] Session stored:', sessionId);
}

/**
 * Get session from Redis
 */
export async function getSession(
  sessionId: string
): Promise<ISession | null> {
  // TODO: Implement Redis retrieval
  console.log('[Auth] Session retrieved:', sessionId);
  return null;
}

/**
 * Delete session from Redis
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // TODO: Implement Redis deletion
  console.log('[Auth] Session deleted:', sessionId);
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: string,
  requiredRoles: string[]
): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if user owns a resource
 */
export function isOwner(
  userId: string,
  resourceOwnerId: string
): boolean {
  return userId === resourceOwnerId;
}

/**
 * Check if user is super_admin (system-wide admin)
 */
export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}

// ============================================
// TOKEN EXTRACTION FROM REQUEST
// ============================================

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Extract token from cookie
 */
export function extractTokenFromCookie(
  cookieHeader: string | null,
  cookieName: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const cookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!cookie) {
    return null;
  }

  return cookie.substring(cookieName.length + 1);
}

// ============================================
// PASSWORD RESET
// ============================================

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'password_reset' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Verify password reset token
 */
export function verifyPasswordResetToken(token: string): string {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
      sub: string;
      type?: string;
    };

    if (payload.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    return payload.sub;
  } catch (_error) {
    throw new Error('Invalid or expired reset token');
  }
}

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'email_verification' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify email verification token
 */
export function verifyEmailVerificationToken(token: string): string {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
      sub: string;
      type?: string;
    };

    if (payload.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }

    return payload.sub;
  } catch (_error) {
    throw new Error('Invalid or expired verification token');
  }
}

// ============================================
// MAGIC LINK (Passwordless Login)
// ============================================

/**
 * Generate magic link token
 */
export function generateMagicLinkToken(
  tenantId: string,
  email: string
): string {
  return jwt.sign(
    { tenant_id: tenantId, email, type: 'magic_link' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Verify magic link token
 */
export async function verifyMagicLinkToken(
  token: string
): Promise<{ tenant_id: string; email: string }> {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
      tenant_id: string;
      email: string;
      type?: string;
    };

    if (payload.type !== 'magic_link') {
      throw new Error('Invalid token type');
    }

    return {
      tenant_id: payload.tenant_id,
      email: payload.email,
    };
  } catch (_error) {
    throw new Error('Invalid or expired magic link');
  }
}

// ============================================
// API AUTHENTICATION & AUTHORIZATION
// ============================================

/**
 * Authenticate API request and return user info
 * Used by photo moderation endpoints
 */
export async function requireAuthForApi(headers: Headers): Promise<{
  payload: IJWTPayload;
  userId: string;
  tenantId: string;
}> {
  const authHeader = headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const payload = verifyAccessToken(token);

    return {
      payload,
      userId: payload.sub,
      tenantId: payload.tenant_id,
    };
  }

  // Fallback: session-based auth (cookie or header)
  const cookieHeader = headers.get('cookie');
  const { sessionId } = extractSessionId(cookieHeader, authHeader);

  if (!sessionId) {
    throw new Error('Authentication required');
  }

  const session = await validateSession(sessionId, false);
  if (!session.valid || !session.user || !session.session) {
    throw new Error('Authentication required');
  }

  const payload: IJWTPayload = {
    sub: session.user.id,
    tenant_id: session.user.tenant_id,
    role: session.user.role,
  };

  return {
    payload,
    userId: session.user.id,
    tenantId: session.user.tenant_id,
  };
}

/**
 * Check if user has organizer or super_admin role (can moderate content)
 */
export function hasModeratorRole(role: string): boolean {
  return ['super_admin', 'organizer'].includes(role);
}

/**
 * Verify photo exists and user has permission to moderate it
 * Used by photo moderation endpoints
 */
export async function verifyPhotoModerationAccess(
  photoId: string,
  tenantId: string,
  userId: string,
  userRole: string
): Promise<{
  photo: { id: string; organizer_id: string; event_id: string; user_fingerprint: string; is_anonymous: boolean };
  isOwner: boolean;
  isAdmin: boolean;
}> {
  const db = getTenantDb(tenantId);

  const photoResult = await db.query<{
    id: string;
    organizer_id: string;
    event_id: string;
    user_fingerprint: string;
    is_anonymous: boolean;
  }>(
    `SELECT p.id,
            e.organizer_id,
            p.event_id,
            p.user_fingerprint,
            p.is_anonymous
     FROM photos p
     JOIN events e ON p.event_id = e.id
     WHERE p.id = $1`,
    [photoId]
  );

  if (!photoResult.rows || photoResult.rows.length === 0) {
    throw new Error('Photo not found');
  }

  const photo = photoResult.rows[0];

  return {
    photo,
    isOwner: photo.organizer_id === userId,
    isAdmin: hasModeratorRole(userRole),
  };
}

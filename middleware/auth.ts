// ============================================
// Galeria - Authentication Middleware
// ============================================
// Protected route middleware for Next.js API routes
// Validates sessions and attaches user context to requests

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionTTL, extractSessionId, getClientIp, getUserAgent } from '../lib/session';
import type { ISessionData, IUser, UserRole } from '../lib/types';

// ============================================
// CONFIGURATION
// ============================================

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/health',
  '/api/health',
  '/_next',
  '/static',
  '/auth/admin/login',
];

const PROTECTED_PREFIXES = [
  '/api',
  '/organizer',
  '/admin',
  '/events',
];

// ============================================
// TYPES
// ============================================

/**
 * Extended NextRequest with auth context
 */
export interface AuthenticatedRequest extends NextRequest {
  user?: IUser;
  session?: ISessionData;
  sessionId?: string;
}

/**
 * Auth context attached to requests
 */
export interface IAuthContext {
  user: IUser;
  session: ISessionData;
  sessionId: string;
  clientId: string;
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Main authentication middleware
 * Validates session and attaches user context to request
 *
 * @param request - Next.js request object
 * @returns Response or null (if request should proceed)
 */
export async function authMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Skip authentication for public paths
  if (isPublicPath(pathname)) {
    return null;
  }

  // Only protect API routes and protected prefixes
  if (!isProtectedPath(pathname)) {
    return null;
  }

  try {
    // Extract session ID from cookie or authorization header
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');

    const { sessionId, source } = extractSessionId(cookieHeader, authHeader);

    if (!sessionId) {
      return createUnauthorizedResponse('No session provided');
    }

    // Validate session
    const result = await validateSession(sessionId);

    if (!result.valid || !result.session || !result.user) {
      return createUnauthorizedResponse(result.error || 'Invalid session');
    }

    // Session is valid - attach auth context to request headers
    // This is how we pass context to API route handlers
    const response = NextResponse.next();

    response.headers.set('x-user-id', result.user.id);
    response.headers.set('x-user-email', result.user.email);
    response.headers.set('x-user-role', result.user.role);
    response.headers.set('x-tenant-id', result.user.tenant_id);
    response.headers.set('x-session-id', sessionId);
    response.headers.set('x-session-source', source || 'unknown');

    // Add session TTL info for monitoring
    const ttl = await getSessionTTL(sessionId);
    response.headers.set('x-session-ttl', ttl.toString());

    return response;

  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Error:', error);
    return createErrorResponse('Internal authentication error', 500);
  }
}

/**
 * Role-based authorization middleware
 * Checks if user has required role
 *
 * @param request - Request object
 * @param allowedRoles - Array of allowed roles
 * @returns Response or null (if authorized)
 */
export function roleMiddleware(
  request: NextRequest,
  allowedRoles: string[]
): NextResponse | null {
  const userRole = request.headers.get('x-user-role');

  if (!userRole) {
    return createUnauthorizedResponse('No user role in context');
  }

  if (!allowedRoles.includes(userRole)) {
    return createForbiddenResponse('Insufficient permissions');
  }

  return null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a path is public (no auth required)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if a path should be protected
 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Create unauthorized response (401)
 */
function createUnauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      error: 'unauthorized',
      message,
      code: 'AUTH_001',
    },
    { status: 401 }
  );
}

/**
 * Create forbidden response (403)
 */
function createForbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    {
      error: 'forbidden',
      message,
      code: 'AUTH_002',
    },
    { status: 403 }
  );
}

/**
 * Create error response
 */
function createErrorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      error: 'internal_error',
      message,
      code: 'AUTH_500',
    },
    { status }
  );
}

// ============================================
// API ROUTE HELPERS
// ============================================

/**
 * Get authenticated user from request headers
 * Call this inside API route handlers to get user context
 */
export function getAuthenticatedUser(request: NextRequest): IUser | null {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  const userRole = request.headers.get('x-user-role');
  const tenantId = request.headers.get('x-tenant-id');

  if (!userId || !userEmail || !userRole || !tenantId) {
    return null;
  }

  return {
    id: userId,
    email: userEmail,
    name: request.headers.get('x-user-name') || '',
    role: userRole as UserRole,
    tenant_id: tenantId,
    email_verified: request.headers.get('x-user-email-verified') === 'true',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Get session data from request headers
 */
export function getSessionData(request: NextRequest): ISessionData | null {
  const sessionId = request.headers.get('x-session-id');
  const userId = request.headers.get('x-user-id');
  const tenantId = request.headers.get('x-tenant-id');
  const userRole = request.headers.get('x-user-role');

  if (!sessionId || !userId || !tenantId || !userRole) {
    return null;
  }

  return {
    userId,
    tenantId,
    role: userRole as UserRole,
    email: request.headers.get('x-user-email') || '',
    name: request.headers.get('x-user-name') || '',
    createdAt: parseInt(request.headers.get('x-session-created') || '0', 10),
    lastActivity: parseInt(request.headers.get('x-session-activity') || '0', 10),
    expiresAt: parseInt(request.headers.get('x-session-expires') || '0', 10),
    rememberMe: request.headers.get('x-session-remember') === 'true',
  };
}

/**
 * Get client IP from request
 */
export function getRequestIp(request: NextRequest): string {
  return getClientIp(Object.fromEntries(request.headers.entries()));
}

/**
 * Get user agent from request
 */
export function getRequestUserAgent(request: NextRequest): string {
  return getUserAgent(Object.fromEntries(request.headers.entries()));
}

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * Handle authentication errors consistently
 */
export class AuthError extends Error {
  constructor(
    public type: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Create error response from AuthError
 */
export function createAuthErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json(
    {
      error: error.type,
      message: error.message,
      code: `AUTH_${error.statusCode}`,
    },
    { status: error.statusCode }
  );
}

// ============================================
// COMMON AUTHENTICATION PATTERNS
// ============================================

/**
 * Require authentication for an API route
 * Use this pattern in your route handlers:
 *
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *
 *   // Now you have access to auth.user and auth.session
 * }
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: IUser; session: ISessionData } | NextResponse> {
  let user = getAuthenticatedUser(request);
  let session = getSessionData(request);

  // If headers are missing (middleware didn't run or didn't populate them),
  // we must validate the session manually here.
  if (!user || !session) {
    // Extract session ID
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');

    const { sessionId } = extractSessionId(cookieHeader, authHeader);

    if (!sessionId) {
      return createUnauthorizedResponse('Authentication required');
    }

    // Validate session
    const result = await validateSession(sessionId);

    if (!result.valid || !result.user || !result.session) {
      return createUnauthorizedResponse(result.error || 'Invalid session');
    }

    user = result.user;
    session = result.session;
  }

  if (!user || !session) {
    return createUnauthorizedResponse('Authentication required');
  }

  return { user, session };
}

/**
 * Require specific role for an API route
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ user: IUser; session: ISessionData } | NextResponse> {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!allowedRoles.includes(auth.user.role)) {
    return createForbiddenResponse(`Role required: ${allowedRoles.join(' or ')}`);
  }

  return auth;
}

/**
 * Require super_admin role for an API route
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ user: IUser; session: ISessionData } | NextResponse> {
  return requireRole(request, ['super_admin']);
}

/**
 * Require tenant ownership for an API route
 * Checks if the user belongs to the specified tenant
 */
export async function requireTenantAccess(
  request: NextRequest,
  tenantId: string
): Promise<{ user: IUser; session: ISessionData } | NextResponse> {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  if (auth.user.tenant_id !== tenantId && auth.user.role !== 'super_admin') {
    return createForbiddenResponse('Access denied to this tenant');
  }

  return auth;
}

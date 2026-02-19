// ============================================
// Galeria - Login API Endpoint
// ============================================
// POST /api/auth/login
// Authenticates user with email and password, creates session

import { NextRequest, NextResponse } from 'next/server';
import { comparePassword } from '../../../../lib/auth';
import { getTenantDb } from '../../../../lib/db';
import { createSession, deleteSession, extractSessionId } from '../../../../lib/session';
import { checkLoginRateLimit, createRateLimitErrorResponse } from '../../../../lib/rate-limit';
import { getRequestIp, getRequestUserAgent } from '../../../../middleware/auth';
import type { IAuthResponseSession } from '../../../../lib/types';
import { loginSchema } from '../../../../lib/validation/auth';
import { getTenantId } from '../../../../lib/tenant';
import type { IUser, ITenant } from '../../../../lib/types';
import { SYSTEM_TENANT_ID } from '@/lib/constants/tenants';

// Configure route to use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginUserMatch = {
  db: ReturnType<typeof getTenantDb>;
  user: IUser;
};

async function findUserForLogin(
  normalizedEmail: string,
  hintedTenantId: string | null
): Promise<LoginUserMatch | null> {
  const systemDb = getTenantDb(SYSTEM_TENANT_ID);
  const tenantIds: string[] = [];

  if (hintedTenantId) {
    tenantIds.push(hintedTenantId);
  }

  // Keep backward compatibility for existing data that may still live in system tenant.
  tenantIds.push(SYSTEM_TENANT_ID);

  try {
    const activeTenants = await systemDb.findMany<ITenant>('tenants', { status: 'active' });
    tenantIds.push(...activeTenants.map((tenant) => tenant.id));
  } catch (error) {
    console.error('[LOGIN] Failed to load active tenants:', error);
  }

  const checked = new Set<string>();
  for (const tenantId of tenantIds) {
    if (!tenantId || checked.has(tenantId)) {
      continue;
    }
    checked.add(tenantId);

    try {
      const tenantDb = getTenantDb(tenantId);
      const user = await tenantDb.findOne<IUser>('users', { email: normalizedEmail });
      if (user) {
        return { db: tenantDb, user };
      }
    } catch (error) {
      console.error(`[LOGIN] Tenant lookup failed for ${tenantId}:`, error);
    }
  }

  return null;
}

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: 'Invalid login request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const { email, password, rememberMe = false } = parsed.data;

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get client IP and user agent
    const ipAddress = getRequestIp(request);
    const userAgent = getRequestUserAgent(request);

    // Check rate limits
    const rateLimitResult = await checkLoginRateLimit(normalizedEmail, ipAddress);

    if (!rateLimitResult.allowed) {
      const errorResponse = createRateLimitErrorResponse(rateLimitResult);
      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString(),
          'Retry-After': errorResponse.retryAfter.toString(),
        },
      });
    }

    const tenantHintId = getTenantId(request.headers);
    const loginMatch = await findUserForLogin(normalizedEmail, tenantHintId);

    const user = loginMatch?.user;
    const passwordHash = user?.password_hash;

    if (!user || !passwordHash) {
      // Don't reveal whether user exists for security
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await comparePassword(password, passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await loginMatch.db.update(
      'users',
      { last_login_at: new Date() },
      { id: user.id }
    );

    // SECURITY: Invalidate any existing session to prevent session fixation attacks
    // Check if there's an existing session cookie and invalidate it before creating a new one
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');
    const { sessionId: existingSessionId } = extractSessionId(cookieHeader, authHeader);

    if (existingSessionId) {
      await deleteSession(existingSessionId);
    }

    // Create new session (always regenerate session ID on login)
    const sessionId = await createSession(user, {
      ipAddress,
      userAgent,
      rememberMe,
    });

    // Create response with session cookie
    const response = NextResponse.json<IAuthResponseSession>(
      {
        success: true,
        user: {
          ...user,
          password_hash: undefined, // Remove password hash from response
        } as IUser,
        sessionId,
        message: 'Login successful',
      },
      { status: 200 }
    );

    // Set session cookie
    const cookieOptions = getCookieOptions(rememberMe);
    response.cookies.set('session', sessionId, cookieOptions);

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString());

    return response;

  } catch (error) {
    console.error('[LOGIN] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An error occurred during login'
          : `Login error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Get cookie options based on remember me preference
 */
function getCookieOptions(rememberMe: boolean) {
  const isSecure = process.env.NODE_ENV === 'production';
  const maxAge = rememberMe ? 2592000 : 604800; // 30 days or 7 days

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

// ============================================
// Galeria - Register API Endpoint
// ============================================
// POST /api/auth/register
// Registers a new user, creates their tenant, and creates session

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '../../../../lib/auth';
import { getTenantDb } from '../../../../lib/db';
import { createSession } from '../../../../lib/session';
import { checkRegistrationRateLimit, createRateLimitErrorResponse } from '../../../../lib/rate-limit';
import { validatePassword, DEFAULT_PASSWORD_REQUIREMENTS } from '../../../../lib/password-validator';
import { getRequestIp, getRequestUserAgent } from '../../../../middleware/auth';
import type { IAuthResponseSession } from '../../../../lib/types';
import { registerSchema } from '../../../../lib/validation/auth';
import type { IUser, ITenant } from '../../../../lib/types';
import { randomBytes } from 'crypto';
import { SYSTEM_TENANT_ID } from '@/lib/constants/tenants';

// Configure route to use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generate a unique slug for tenant
 */
function generateTenantSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  // Add random suffix for uniqueness
  const randomSuffix = randomBytes(4).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

/**
 * POST /api/auth/register
 * Register new user and create their own tenant
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: 'Invalid registration request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const { email, password, name, tenantName } = parsed.data;

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: 'Name must be at least 2 characters long',
        },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password, DEFAULT_PASSWORD_REQUIREMENTS);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'WEAK_PASSWORD',
          message: passwordValidation.errors.join(', '),
        },
        { status: 400 }
      );
    }

    // Get client IP and user agent
    const ipAddress = getRequestIp(request);
    const userAgent = getRequestUserAgent(request);

    // Check rate limits
    const rateLimitResult = await checkRegistrationRateLimit(normalizedEmail, ipAddress);

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

    // For Phase 2, we use the default tenant ID
    // In a full multi-tenant system, we would create a new tenant here
    const defaultTenantId = SYSTEM_TENANT_ID;
    const db = getTenantDb(defaultTenantId);

    // Check if user already exists
    const existingUser = await db.findOne<IUser>('users', {
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'USER_ALREADY_EXISTS',
          message: 'An account with this email already exists',
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateUUID();
    const now = new Date();

    const newUser: Partial<IUser> = {
      id: userId,
      tenant_id: defaultTenantId,
      email: normalizedEmail,
      password_hash: passwordHash,
      name: trimmedName,
      role: 'organizer', // First user is organizer of their tenant
      subscription_tier: 'free',
      email_verified: false, // Phase 3: implement email verification
      created_at: now,
      updated_at: now,
    };

    // SECURITY: Handle race condition - wrap insert in try-catch
    // to handle duplicate email errors from concurrent registration attempts
    try {
      await db.insert('users', newUser);
    } catch (error: unknown) {
      // Check for unique constraint violation (PostgreSQL error code 23505)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: 'USER_ALREADY_EXISTS',
            message: 'An account with this email already exists',
          },
          { status: 409 }
        );
      }
      // Re-throw other errors
      throw error;
    }

    // Fetch the created user (without password hash)
    const createdUser = await db.findOne<IUser>('users', { id: userId });

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    // Create session
    const sessionId = await createSession(createdUser, {
      ipAddress,
      userAgent,
      rememberMe: false,
    });

    // Create response with session cookie
    const response = NextResponse.json<IAuthResponseSession>(
      {
        success: true,
        user: {
          ...createdUser,
          password_hash: undefined,
        } as IUser,
        sessionId,
        message: 'Registration successful',
      },
      { status: 201 }
    );

    // Set session cookie
    const cookieOptions = getCookieOptions(false);
    response.cookies.set('session', sessionId, cookieOptions);

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString());

    return response;

  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during registration',
      },
      { status: 500 }
    );
  }
}

/**
 * Get cookie options for session cookie
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
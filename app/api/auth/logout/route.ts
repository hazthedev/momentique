// ============================================
// Galeria - Logout API Endpoint
// ============================================
// POST /api/auth/logout
// Invalidates user session and clears cookie

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, getSession, extractSessionId } from '../../../../lib/session';

// Configure route to use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 * Logout user by invalidating their session
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session ID from cookie
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');

    const { sessionId } = extractSessionId(cookieHeader, authHeader);

    // Delete session from Redis if it exists
    if (sessionId) {
      await deleteSession(sessionId);
    }

    // Create response with cleared cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    );

    // Clear session cookie
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Immediately expire
    });

    return response;

  } catch (error) {
    console.error('[LOGOUT] Error:', error);

    // Still clear the cookie even if there was an error
    const response = NextResponse.json(
      {
        success: true, // Report success to user even on error
        message: 'Logged out',
      },
      { status: 200 }
    );

    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  }
}
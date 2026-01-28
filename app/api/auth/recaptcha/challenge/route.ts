// ============================================
// MOMENTIQUE - Fallback Challenge API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { generateMathChallenge, storeChallenge, verifyChallenge, cleanupChallenge } from '@/lib/recaptcha';

/**
 * POST /api/auth/recaptcha/challenge
 * Creates a new math challenge for fallback verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, answer } = body || {};

    // If providing an answer, verify it
    if (sessionId && answer !== undefined) {
      const isValid = await verifyChallenge(sessionId, parseInt(answer, 10));

      // Clean up the challenge session
      await cleanupChallenge(sessionId);

      if (isValid) {
        // Generate a token that can be used instead of reCAPTCHA token
        const fallbackToken = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        return NextResponse.json({
          valid: true,
          token: fallbackToken,
        });
      }

      return NextResponse.json(
        { error: 'Invalid answer', code: 'INVALID_ANSWER' },
        { status: 400 }
      );
    }

    // Generate new challenge
    const challenge = generateMathChallenge();

    // Store the answer
    await storeChallenge(challenge.sessionId, challenge.answer);

    // Return challenge to client (not the answer!)
    return NextResponse.json({
      sessionId: challenge.sessionId,
      question: challenge.question,
      ttl: 300, // 5 minutes
    });
  } catch (error) {
    console.error('[RECAPTCHA] Challenge error:', error);
    return NextResponse.json(
      { error: 'Challenge generation failed', code: 'CHALLENGE_ERROR' },
      { status: 500 }
    );
  }
}

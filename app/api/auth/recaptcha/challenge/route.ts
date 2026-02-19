// ============================================
// Galeria - Fallback Challenge API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { cleanupChallenge, generateMathChallenge, issueFallbackToken, storeChallenge, verifyChallenge } from '@/lib/recaptcha';

/**
 * POST /api/auth/recaptcha/challenge
 * Creates a new math challenge for fallback verification
 */
export async function POST(request: NextRequest) {
  try {
    let body: { sessionId?: string; answer?: number | string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const { sessionId, answer } = body || {};

    // If providing an answer, verify it
    if (sessionId && answer !== undefined) {
      const normalizedAnswer =
        typeof answer === 'number' ? answer : parseInt(answer, 10);
      const isValid = await verifyChallenge(sessionId, normalizedAnswer);

      // Clean up the challenge session
      await cleanupChallenge(sessionId);

      if (isValid) {
        const fallbackToken = await issueFallbackToken();

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

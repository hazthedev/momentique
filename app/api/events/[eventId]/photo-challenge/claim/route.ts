// ============================================
// Photo Challenge Prize Claim API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import crypto from 'crypto';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

/**
 * POST /api/events/[eventId]/photo-challenge/claim
 * Generate QR code for prize claim when goal is reached
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const headers = req.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, auth);

    // Get fingerprint from request header sent by client
    const fingerprint = headers.get('x-fingerprint');

    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Unable to identify user', code: 'NO_FINGERPRINT' },
        { status: 400 }
      );
    }

    const db = getTenantDb(tenantId);

    // Check if event exists
    const event = await db.findOne<{
      id: string;
      settings?: {
        features?: {
          photo_challenge_enabled?: boolean;
        };
      };
    }>('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
    assertEventFeatureEnabled(event, 'photo_challenge_enabled');

    // Check if photo challenge is enabled
    const challenge = await db.findOne('photo_challenges', {
      event_id: eventId,
      enabled: true,
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'Photo challenge not available', code: 'NOT_AVAILABLE' },
        { status: 400 }
      );
    }

    // Get user's approved photos count
    const photos = await db.findMany('photos', {
      event_id: eventId,
      user_fingerprint: `guest_${fingerprint}`,
      status: 'approved',
    });

    const photosApproved = photos.length;
    const goalPhotos = challenge.goal_photos;
    const goalReached = photosApproved >= goalPhotos;

    if (!goalReached) {
      return NextResponse.json(
        { error: 'Goal not reached yet', code: 'GOAL_NOT_REACHED' },
        { status: 400 }
      );
    }

    // Get user's progress record
    const progress = await db.findOne('guest_photo_progress', {
      event_id: eventId,
      user_fingerprint: fingerprint,
    });

    if (progress?.prize_revoked) {
      return NextResponse.json(
        { error: 'Prize has been revoked', code: 'PRIZE_REVOKED' },
        { status: 403 }
      );
    }

    // Check if already claimed
    const existingClaim = await db.findOne('prize_claims', {
      event_id: eventId,
      user_fingerprint: fingerprint,
    });

    if (existingClaim && !existingClaim.revoked_at) {
      return NextResponse.json({
        already_claimed: true,
        qr_code_url: existingClaim.metadata?.qr_code_url || null,
        claim_token: existingClaim.qr_code_token,
        prize_title: challenge.prize_title,
      });
    }

    // Generate QR code token
    const token = crypto.randomBytes(16).toString('hex');
    const qrCodeData = {
      event_id: eventId,
      user_fingerprint: fingerprint,
      challenge_id: challenge.id,
      token,
      timestamp: Date.now(),
    };

    // Store claim record
    await db.insert('prize_claims', {
      event_id: eventId,
      user_fingerprint: fingerprint,
      challenge_id: challenge.id,
      qr_code_token: token,
      metadata: qrCodeData,
      claimed_at: new Date(),
      created_at: new Date(),
    });

    // Update or create progress record
    if (progress) {
      await db.update(
        'guest_photo_progress',
        { prize_claimed_at: new Date() },
        { id: progress.id }
      );
    } else {
      await db.insert('guest_photo_progress', {
        event_id: eventId,
        user_fingerprint: fingerprint,
        photos_uploaded: photosApproved,
        goal_reached: true,
        prize_claimed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Generate QR code URL (client will generate actual QR)
    // For now, return the token that the client can use
    const qrCodeDataString = JSON.stringify(qrCodeData);
    const qrCodeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/claim/${token}`;

    return NextResponse.json({
      data: {
        qr_code_url: qrCodeUrl,
        claim_token: token,
        qr_data: qrCodeDataString,
      },
      prize_title: challenge.prize_title,
      prize_description: challenge.prize_description,
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[PHOTO_CHALLENGE_CLAIM] POST error:', error);
    console.error('[PHOTO_CHALLENGE_CLAIM] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[PHOTO_CHALLENGE_CLAIM] Error message:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Failed to generate prize claim',
        code: 'CLAIM_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Galeria - Photo Approval API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi, verifyPhotoModerationAccess } from '@/lib/auth';
import { updateGuestProgress } from '@/lib/photo-challenge';
import { publishEventBroadcast } from '@/lib/realtime/server';

const shouldLogModeration = async (db: ReturnType<typeof getTenantDb>) => {
  const result = await db.query<{ name: string | null }>(
    'SELECT to_regclass($1) AS name',
    ['public.photo_moderation_logs']
  );
  return Boolean(result.rows[0]?.name);
};

// ============================================
// PATCH /api/photos/:id/approve - Approve photo
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
    const headers = request.headers;

    // Authenticate and get user info
    const { payload, userId, tenantId: authTenantId } = await requireAuthForApi(headers);

    // Verify access
    const { photo, isOwner, isAdmin } = await verifyPhotoModerationAccess(
      photoId,
      authTenantId,
      userId,
      payload.role
    );

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const db = getTenantDb(authTenantId);

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;

    // Update photo status
    await db.update(
      'photos',
      { status: 'approved', approved_at: new Date() },
      { id: photoId }
    );

    // Update photo challenge progress (if user_fingerprint exists)
    if (photo.user_fingerprint && !photo.is_anonymous) {
      try {
        await updateGuestProgress(db, photo.event_id, photo.user_fingerprint, true);
        console.log('[PHOTO_CHALLENGE] Progress updated on approval:', photo.user_fingerprint);
      } catch (challengeError) {
        console.warn('[API] Photo challenge progress update on approval skipped:', challengeError);
      }
    }

    if (await shouldLogModeration(db)) {
      await db.insert('photo_moderation_logs', {
        photo_id: photoId,
        event_id: photo.event_id,
        tenant_id: authTenantId,
        moderator_id: userId,
        action: 'approve',
        reason,
        created_at: new Date(),
      });
    }

    await publishEventBroadcast(photo.event_id, 'photo_updated', {
      photo_id: photoId,
      status: 'approved',
      event_id: photo.event_id,
    });

    return NextResponse.json({
      data: { id: photoId, status: 'approved' },
      message: 'Photo approved successfully',
    });
  } catch (error) {
    console.error('[API] Approve error:', error);

    // Handle different error types
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('Authentication required')) {
        return NextResponse.json(
          { error: 'Authentication required', code: 'AUTH_REQUIRED' },
          { status: 401 }
        );
      }

      if (errorMessage.includes('Photo not found')) {
        return NextResponse.json(
          { error: 'Photo not found', code: 'PHOTO_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (errorMessage.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Insufficient permissions', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to approve photo', code: 'APPROVE_ERROR' },
      { status: 500 }
    );
  }
}

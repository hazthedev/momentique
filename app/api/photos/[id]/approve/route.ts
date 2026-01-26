// ============================================
// MOMENTIQUE - Photo Approval API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi, verifyPhotoModerationAccess } from '@/lib/auth';

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
    const tenantId = getTenantId(headers);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

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

    await db.insert('photo_moderation_logs', {
      photo_id: photoId,
      event_id: photo.event_id,
      tenant_id: authTenantId,
      moderator_id: userId,
      action: 'approve',
      reason,
      created_at: new Date(),
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

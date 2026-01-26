// ============================================
// MOMENTIQUE - Photo Delete API Route
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi, verifyPhotoModerationAccess } from '@/lib/auth';
import { deletePhotoAssets } from '@/lib/images';

// ============================================
// DELETE /api/photos/:id - Delete photo
// ============================================

export async function DELETE(
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
    const existingPhoto = await db.findOne<{
      id: string;
      event_id: string;
    }>('photos', { id: photoId });

    if (!existingPhoto) {
      return NextResponse.json(
        { error: 'Photo not found', code: 'PHOTO_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Best-effort delete in storage
    try {
      await deletePhotoAssets(existingPhoto.event_id, existingPhoto.id);
    } catch {
      // Storage failures should not block moderation action
    }

    // Delete photo record
    await db.delete('photos', { id: photoId });

    // Audit log
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;

    await db.insert('photo_moderation_logs', {
      photo_id: photoId,
      event_id: existingPhoto.event_id,
      tenant_id: authTenantId,
      moderator_id: userId,
      action: 'delete',
      reason,
      created_at: new Date(),
    });

    return NextResponse.json({
      data: { id: photoId, status: 'deleted' },
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    console.error('[API] Delete photo error:', error);

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
      { error: 'Failed to delete photo', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
}


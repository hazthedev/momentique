// ============================================
// Gatherly - Organizer Bulk Photo Delete API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';
import { deletePhotoAssets } from '@/lib/images';

const shouldLogModeration = async (db: ReturnType<typeof getTenantDb>) => {
  const result = await db.query<{ name: string | null }>(
    'SELECT to_regclass($1) AS name',
    ['public.photo_moderation_logs']
  );
  return Boolean(result.rows[0]?.name);
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { userId, tenantId, payload } = await requireAuthForApi(request.headers);

    if (!['organizer', 'super_admin'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { photoIds, reason } = body || {};

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: 'No photo IDs provided', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const db = getTenantDb(tenantId);
    const eventResult = await db.query<{ id: string; organizer_id: string }>(
      'SELECT id, organizer_id FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventResult.rows.length) {
      return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    if (payload.role === 'organizer' && event.organizer_id !== userId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const photosResult = await db.query<{ id: string; event_id: string }>(
      'SELECT id, event_id FROM photos WHERE event_id = $1 AND id = ANY($2)',
      [eventId, photoIds]
    );
    const photos = photosResult.rows || [];
    const deletedIds = photos.map((photo) => photo.id);

    // Best-effort delete in storage
    await Promise.all(
      photos.map(async (photo) => {
        try {
          await deletePhotoAssets(photo.event_id, photo.id);
        } catch {
          // Storage failures should not block moderation action
        }
      })
    );

    const normalizedReason = typeof reason === 'string' ? reason.trim() : null;
    if (deletedIds.length > 0 && await shouldLogModeration(db)) {
      await db.query(
        `INSERT INTO photo_moderation_logs
          (photo_id, event_id, tenant_id, moderator_id, action, reason, created_at)
         SELECT UNNEST($1::uuid[]), $2, $3, $4, 'delete', $5, NOW()`,
        [deletedIds, eventId, tenantId, userId, normalizedReason]
      );
    }

    if (deletedIds.length > 0) {
      await db.query(
        'DELETE FROM photos WHERE event_id = $1 AND id = ANY($2)',
        [eventId, deletedIds]
      );
    }

    const skippedIds = photoIds.filter((id: string) => !deletedIds.includes(id));

    return NextResponse.json({
      data: {
        deletedIds,
        skippedIds,
      },
      message: `Deleted ${deletedIds.length} photo${deletedIds.length === 1 ? '' : 's'}`,
    });
  } catch (error) {
    console.error('[PHOTO_BULK_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete photos', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// Galeria - Organizer Photo Export API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { requireAuthForApi } from '@/lib/auth';
import type { IEvent, IPhoto } from '@/lib/types';
import { createPhotoExportZip } from '@/lib/export/zip-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const { photoIds, status = 'all', watermark = false } = body || {};

    const db = getTenantDb(tenantId);

    const eventResult = await db.query<IEvent>(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventResult.rows.length) {
      return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    if (payload.role === 'organizer' && event.organizer_id !== userId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const conditions: string[] = ['event_id = $1'];
    const values: unknown[] = [eventId];
    let paramIndex = 2;

    if (Array.isArray(photoIds) && photoIds.length > 0) {
      conditions.push(`id = ANY($${paramIndex})`);
      values.push(photoIds);
      paramIndex++;
    }

    if (status && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const photosResult = await db.query<IPhoto>(
      `SELECT * FROM photos WHERE ${conditions.join(' AND ')}`,
      values
    );

    const { stream, filename } = await createPhotoExportZip({
      event,
      photos: photosResult.rows || [],
      watermark: Boolean(watermark),
      includeManifest: true,
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PHOTO_EXPORT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export photos', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
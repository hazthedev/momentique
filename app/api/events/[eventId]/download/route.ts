// ============================================
// Galeria - Guest Event Download API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import type { IEvent, IPhoto } from '@/lib/types';
import { createPhotoExportZip } from '@/lib/export/zip-generator';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const watermark = request.nextUrl.searchParams.get('watermark') === '1';

    const auth = await resolveOptionalAuth(request.headers);
    const tenantId = resolveTenantId(request.headers, auth);
    const db = getTenantDb(tenantId);

    const eventResult = await db.query<IEvent>(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventResult.rows.length) {
      return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    const guestDownloadEnabled = event.settings?.features?.guest_download_enabled !== false;
    if (!guestDownloadEnabled) {
      return NextResponse.json({ error: 'Download not allowed', code: 'FORBIDDEN' }, { status: 403 });
    }

    const photosResult = await db.query<IPhoto>(
      `SELECT * FROM photos WHERE event_id = $1 AND status = 'approved'`,
      [eventId]
    );

    const { stream, filename } = await createPhotoExportZip({
      event,
      photos: photosResult.rows || [],
      watermark,
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
    if (error instanceof Error && error.message.includes('Tenant context missing')) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[EVENT_DOWNLOAD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download event photos', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => null);
    const photoIdsRaw = body?.photoIds;
    const watermark = body?.watermark === true;

    if (!Array.isArray(photoIdsRaw) || photoIdsRaw.length === 0) {
      return NextResponse.json({ error: 'No photos selected', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const photoIds = photoIdsRaw.filter((id: unknown) => typeof id === 'string');
    if (photoIds.length === 0) {
      return NextResponse.json({ error: 'Invalid photo IDs', code: 'INVALID_INPUT' }, { status: 400 });
    }

    if (photoIds.length > 500) {
      return NextResponse.json({ error: 'Too many photos selected', code: 'LIMIT_EXCEEDED' }, { status: 400 });
    }

    const auth = await resolveOptionalAuth(request.headers);
    const tenantId = resolveTenantId(request.headers, auth);
    const db = getTenantDb(tenantId);

    const eventResult = await db.query<IEvent>(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );
    if (!eventResult.rows.length) {
      return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    const guestDownloadEnabled = event.settings?.features?.guest_download_enabled !== false;
    if (!guestDownloadEnabled) {
      return NextResponse.json({ error: 'Download not allowed', code: 'FORBIDDEN' }, { status: 403 });
    }

    const photosResult = await db.query<IPhoto>(
      `SELECT * FROM photos WHERE event_id = $1 AND status = 'approved' AND id = ANY($2)`,
      [eventId, photoIds]
    );

    if (!photosResult.rows.length) {
      return NextResponse.json({ error: 'No approved photos found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { stream, filename } = await createPhotoExportZip({
      event,
      photos: photosResult.rows || [],
      watermark,
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
    if (error instanceof Error && error.message.includes('Tenant context missing')) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[EVENT_DOWNLOAD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download selected photos', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

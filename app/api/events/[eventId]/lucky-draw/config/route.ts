// ============================================
// Galeria - Lucky Draw Config & Statistics API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { hasModeratorRole, requireAuthForApi } from '@/lib/auth';
import { resolveOptionalAuth, resolveTenantId } from '@/lib/api-request-context';
import {
  createLuckyDrawConfig,
  getActiveConfig,
  getLatestConfig,
  getEventEntries,
} from '@/lib/lucky-draw';

export const runtime = 'nodejs';

const isRecoverableReadError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['42P01', '42703'].includes((error as { code?: string }).code || '');

type EventAccessRecord = {
  id: string;
  organizer_id: string;
};

async function requireConfigWriteAccess(
  request: NextRequest,
  eventId: string
): Promise<{
  db: ReturnType<typeof getTenantDb>;
  tenantId: string;
  userId: string;
}> {
  const { userId, tenantId, payload } = await requireAuthForApi(request.headers);
  if (!hasModeratorRole(payload.role)) {
    throw new Error('Forbidden');
  }

  const db = getTenantDb(tenantId);
  const event = await db.findOne<EventAccessRecord>('events', { id: eventId });
  if (!event) {
    throw new Error('Event not found');
  }

  if (payload.role === 'organizer' && event.organizer_id !== userId) {
    throw new Error('Forbidden');
  }

  return { db, tenantId, userId };
}

function getConfigMutationError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes('Authentication required') ||
      error.message.includes('Invalid or expired access token')
    ) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (error.message.includes('Event not found')) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Failed to save configuration', code: 'CONFIG_ERROR' },
    { status: 500 }
  );
}

// ============================================
// GET /api/events/:eventId/lucky-draw/config - Get active config
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await resolveOptionalAuth(request.headers);
    const tenantId = resolveTenantId(request.headers, auth);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    // Get latest config (most recent, regardless of status) or active scheduled config
    const config = activeOnly
      ? await getActiveConfig(tenantId, eventId)
      : await getLatestConfig(tenantId, eventId);

    if (!config) {
      return NextResponse.json({
        data: null,
        message: 'No draw configuration found',
      });
    }

    // Get entries count
    let entryCount = 0;
    const warnings: string[] = [];
    try {
      const entries = await getEventEntries(tenantId, config.id);
      entryCount = entries.length;
    } catch {
      entryCount = Number(config.totalEntries || 0);
      warnings.push('Entry count unavailable; showing cached value.');
    }

    return NextResponse.json({
      data: {
        ...config,
        entryCount,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (isRecoverableReadError(error)) {
      return NextResponse.json({
        data: null,
        message: 'Lucky draw configuration unavailable right now.',
      });
    }
    console.error('[API] Config fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/events/:eventId/lucky-draw/config - Create/Update config
// ============================================

async function upsertConfig(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { db, tenantId, userId } = await requireConfigWriteAccess(request, eventId);

    // Parse request body
    const body = await request.json();
    const {
      prizeTiers,
      maxEntriesPerUser,
      requirePhotoUpload,
      preventDuplicateWinners,
      ...settings
    } = body;

    // Validate prize tiers
    if (!prizeTiers || prizeTiers.length === 0) {
      return NextResponse.json(
        { error: 'At least one prize tier is required', code: 'INVALID_PRIZES' },
        { status: 400 }
      );
    }

    const validTiers = ['grand', 'first', 'second', 'third', 'consolation'];
    for (const tier of prizeTiers) {
      if (!validTiers.includes(tier.tier)) {
        return NextResponse.json(
          { error: `Invalid prize tier: ${tier.tier}`, code: 'INVALID_TIER' },
          { status: 400 }
        );
      }
      if (tier.count <= 0) {
        return NextResponse.json(
          { error: `Prize count must be positive for tier: ${tier.tier}`, code: 'INVALID_COUNT' },
          { status: 400 }
        );
      }
    }

    // Get existing config or create new one
    const existingConfig = await getActiveConfig(tenantId, eventId);

    if (existingConfig) {
      await db.update(
        'lucky_draw_configs',
        {
          prize_tiers: JSON.stringify(prizeTiers),
          max_entries_per_user: maxEntriesPerUser || 1,
          require_photo_upload: requirePhotoUpload !== false,
          prevent_duplicate_winners: preventDuplicateWinners !== false,
          animation_style: settings.animationStyle || 'spinning_wheel',
          animation_duration: settings.animationDuration || 8,
          show_selfie: settings.showSelfie !== false,
          show_full_name: settings.showFullName !== false,
          play_sound: settings.playSound !== false,
          confetti_animation: settings.confettiAnimation !== false,
          updated_at: new Date(),
        },
        { id: existingConfig.id }
      );

      const updatedConfig = await getLatestConfig(tenantId, eventId);
      return NextResponse.json({
        data: updatedConfig,
        message: 'Draw configuration updated successfully',
      });
    }

    // Create new config
    const newConfig = await createLuckyDrawConfig(tenantId, eventId, {
      eventId,
      prizeTiers,
      maxEntriesPerUser: maxEntriesPerUser || 1,
      requirePhotoUpload: requirePhotoUpload !== false,
      preventDuplicateWinners: preventDuplicateWinners !== false,
      animationStyle: settings.animationStyle || 'spinning_wheel',
      animationDuration: settings.animationDuration || 8,
      showSelfie: settings.showSelfie !== false,
      showFullName: settings.showFullName !== false,
      playSound: settings.playSound !== false,
      confettiAnimation: settings.confettiAnimation !== false,
      createdBy: userId,
    });

    return NextResponse.json({
      data: newConfig,
      message: 'Draw configuration created successfully',
    });
  } catch (error) {
    console.error('[API] Config error:', error);
    return getConfigMutationError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  return upsertConfig(request, { params });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  return upsertConfig(request, { params });
}

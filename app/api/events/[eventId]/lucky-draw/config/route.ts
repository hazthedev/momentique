// ============================================
// Gatherly - Lucky Draw Config & Statistics API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getTenantDb } from '@/lib/db';
import {
  createLuckyDrawConfig,
  getActiveConfig,
  getLatestConfig,
  getEventEntries,
} from '@/lib/lucky-draw';

export const runtime = 'nodejs';

const isMissingTableError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42P01';

// ============================================
// GET /api/events/:eventId/lucky-draw/config - Get active config
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development (Turbopack middleware issue)
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get latest config (most recent, regardless of status)
    const config = await getLatestConfig(tenantId, eventId);

    if (!config) {
      return NextResponse.json({
        data: null,
        message: 'No draw configuration found',
      });
    }

    // Get entries count
    const entries = await getEventEntries(tenantId, config.id);

    return NextResponse.json({
      data: {
        ...config,
        entryCount: entries.length,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({
        data: null,
        message: 'Lucky draw tables not initialized',
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
    const headers = request.headers;
    let tenantId = getTenantId(headers);

    // Fallback to default tenant for development (Turbopack middleware issue)
    if (!tenantId) {
      tenantId = '00000000-0000-0000-0000-000000000001';
    }

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

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
      createdBy: 'system', // TODO: Get from authenticated user when available
    });

    return NextResponse.json({
      data: newConfig,
      message: 'Draw configuration created successfully',
    });
  } catch (error) {
    console.error('[API] Config error:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
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

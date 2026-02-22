// ============================================
// Galeria - Lucky Draw API Routes
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import {
  executeDraw,
  getActiveConfig,
  createLuckyDrawConfig,
} from '@/lib/lucky-draw';
import { extractSessionId, validateSession } from '@/lib/session';
import { verifyAccessToken } from '@/lib/auth';
import { publishEventBroadcast } from '@/lib/realtime/server';
import { resolveOptionalAuth, resolveRequiredTenantId } from '@/lib/api-request-context';
import {
  assertEventFeatureEnabled,
  buildFeatureDisabledPayload,
  isFeatureDisabledError,
} from '@/lib/event-feature-gate';

export const runtime = 'nodejs';

// ============================================
// POST /api/events/:eventId/lucky-draw/draw - Execute draw
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    const db = getTenantDb(tenantId);

    // Verify event exists and is active
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    assertEventFeatureEnabled(event, 'lucky_draw_enabled');

    // Get active draw configuration
    const config = await getActiveConfig(tenantId, eventId);
    if (!config) {
      return NextResponse.json(
        { error: 'No active draw configuration found', code: 'NO_CONFIG' },
        { status: 400 }
      );
    }

    // Verify user is admin (check session or authorization header)
    const cookieHeader = headers.get('cookie');
    const authHeader = headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    // Try session-based auth first
    const sessionResult = extractSessionId(cookieHeader, authHeader);
    if (sessionResult.sessionId) {
      const session = await validateSession(sessionResult.sessionId, false);
      if (session.valid && session.session) {
        userId = session.session.userId;
        // Get user role from database
        const user = await db.findOne('users', { id: userId });
        userRole = user?.role || null;
      }
    }

    // Fallback to JWT token
    if (!userId && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        userId = payload.sub;
        userRole = payload.role;
      } catch {
        // Token invalid
      }
    }

    if (!userId || !userRole || !['super_admin', 'organizer'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Execute draw
    const result = await executeDraw(tenantId, config.id, 'admin');
    await publishEventBroadcast(eventId, 'draw_started', {
      event_id: eventId,
      config_id: config.id,
      started_at: new Date().toISOString(),
    });

    for (const winner of result.winners) {
      await publishEventBroadcast(eventId, 'draw_winner', mapWinnerToBroadcastPayload(winner, eventId));
    }

    return NextResponse.json({
      data: {
        winners: result.winners,
        statistics: result.statistics,
      },
      message: 'Draw executed successfully',
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[API] Draw execution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage || 'Failed to execute draw', code: 'DRAW_ERROR' },
      { status: 500 }
    );
  }
}

function mapPrizeTierToLegacy(prizeTier: unknown): number {
  if (typeof prizeTier === 'number' && Number.isFinite(prizeTier)) {
    return prizeTier;
  }

  if (typeof prizeTier !== 'string') {
    return 1;
  }

  const lookup: Record<string, number> = {
    grand: 1,
    first: 2,
    second: 3,
    third: 4,
    consolation: 5,
  };

  return lookup[prizeTier] ?? 1;
}

function mapWinnerToBroadcastPayload(
  winner: {
    id?: string;
    eventId?: string;
    entryId?: string;
    participantName?: string;
    selfieUrl?: string;
    prizeTier?: string | number;
    drawnAt?: Date;
    isClaimed?: boolean;
  },
  eventId: string
) {
  const normalizedEventId = winner.eventId || eventId;
  const normalizedEntryId = winner.entryId || '';
  const normalizedParticipant = winner.participantName || 'Anonymous';
  const normalizedSelfie = winner.selfieUrl || '';
  const normalizedPrizeTier = mapPrizeTierToLegacy(winner.prizeTier);
  const normalizedDrawnAt = winner.drawnAt ?? new Date();

  return {
    // Legacy snake_case fields (guest page compatibility)
    id: winner.id || `winner_${Date.now()}`,
    event_id: normalizedEventId,
    entry_id: normalizedEntryId,
    participant_name: normalizedParticipant,
    selfie_url: normalizedSelfie,
    prize_tier: normalizedPrizeTier,
    drawn_at: normalizedDrawnAt,
    drawn_by: 'admin',
    is_claimed: winner.isClaimed ?? false,

    // V2 camelCase mirrors (additive compatibility)
    eventId: normalizedEventId,
    entryId: normalizedEntryId,
    participantName: normalizedParticipant,
    selfieUrl: normalizedSelfie,
    prizeTier: winner.prizeTier,
    drawnAt: normalizedDrawnAt,
    isClaimed: winner.isClaimed ?? false,
  };
}

// ============================================
// POST /api/events/:eventId/lucky-draw/config - Create/Update config
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const headers = request.headers;
    const authContext = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, authContext);

    const db = getTenantDb(tenantId);

    // Verify event exists
    const event = await db.findOne('events', { id: eventId });
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    assertEventFeatureEnabled(event, 'lucky_draw_enabled');

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
      // Update existing config
      await db.update(
        'lucky_draw_configs',
        {
          prize_tiers: prizeTiers,
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

      const updatedConfig = await getActiveConfig(tenantId, eventId);

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
      createdBy: 'admin',
    });

    return NextResponse.json({
      data: newConfig,
      message: 'Draw configuration created successfully',
    });
  } catch (error) {
    if (isFeatureDisabledError(error)) {
      return NextResponse.json(buildFeatureDisabledPayload(error.feature), { status: 400 });
    }
    console.error('[API] Config error:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }
}

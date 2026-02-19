// ============================================
// Galeria - Lucky Draw Core Logic
// ============================================
// Core lucky draw functionality including draw execution algorithm and entry management

import { getTenantDb } from '@/lib/db';
import type {
  LuckyDrawConfig,
  NewLuckyDrawConfig,
  LuckyDrawEntry,
  NewLuckyDrawEntry,
  Winner,
  NewWinner,
  DrawStatus,
  PrizeTier
} from '@/lib/types';

import crypto from 'crypto';

const luckyDrawConfigColumns = `
  id,
  event_id AS "eventId",
  prize_tiers AS "prizeTiers",
  max_entries_per_user AS "maxEntriesPerUser",
  require_photo_upload AS "requirePhotoUpload",
  prevent_duplicate_winners AS "preventDuplicateWinners",
  scheduled_at AS "scheduledAt",
  status,
  completed_at AS "completedAt",
  animation_style AS "animationStyle",
  animation_duration AS "animationDuration",
  show_selfie AS "showSelfie",
  show_full_name AS "showFullName",
  play_sound AS "playSound",
  confetti_animation AS "confettiAnimation",
  total_entries AS "totalEntries",
  created_by AS "createdBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const luckyDrawEntryColumns = `
  id,
  event_id AS "eventId",
  config_id AS "configId",
  photo_id AS "photoId",
  user_fingerprint AS "userFingerprint",
  participant_name AS "participantName",
  is_winner AS "isWinner",
  prize_tier AS "prizeTier",
  created_at AS "createdAt"
`;

const winnerColumns = `
  id,
  event_id AS "eventId",
  entry_id AS "entryId",
  participant_name AS "participantName",
  selfie_url AS "selfieUrl",
  prize_tier AS "prizeTier",
  prize_name AS "prizeName",
  prize_description AS "prizeDescription",
  selection_order AS "selectionOrder",
  is_claimed AS "isClaimed",
  drawn_at AS "drawnAt",
  notified_at AS "notifiedAt",
  created_at AS "createdAt"
`;

/**
 * Generate a random UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

// ============================================
// FISHER-YATES SHUFFLE ALGORITHM
// ============================================

/**
 * Shuffles array using Fisher-Yates algorithm
 * Time complexity: O(n), Space complexity: O(n)
 * Uses crypto.randomInt for cryptographic randomness
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a random string for testing/reproducible draws
 */
export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ============================================
// LUCKY DRAW CONFIG
// ============================================

/**
 * Create a new lucky draw configuration for an event
 */
export async function createLuckyDrawConfig(
  tenantId: string,
  eventId: string,
  config: NewLuckyDrawConfig
): Promise<LuckyDrawConfig> {
  const db = getTenantDb(tenantId);

  const now = new Date();

  const result = await db.query<LuckyDrawConfig>(`
    INSERT INTO lucky_draw_configs (
      event_id,
      prize_tiers,
      max_entries_per_user,
      require_photo_upload,
      prevent_duplicate_winners,
      scheduled_at,
      status,
      completed_at,
      animation_style,
      animation_duration,
      show_selfie,
      show_full_name,
      play_sound,
      confetti_animation,
      total_entries,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2::json, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING ${luckyDrawConfigColumns}
  `, [
    eventId,
    JSON.stringify(config.prizeTiers),
    config.maxEntriesPerUser ?? 1,
    config.requirePhotoUpload ?? true,
    config.preventDuplicateWinners ?? true,
    config.scheduledAt ?? null,
    'scheduled',
    config.completedAt ?? null,
    config.animationStyle ?? 'spinning_wheel',
    config.animationDuration ?? 8,
    config.showSelfie ?? true,
    config.showFullName ?? true,
    config.playSound ?? true,
    config.confettiAnimation ?? true,
    0,
    config.createdBy ?? null,
    now,
    now,
  ]);

  return result.rows[0];
}

/**
 * Get the active configuration for an event
 */
export async function getActiveConfig(
  tenantId: string,
  eventId: string
): Promise<LuckyDrawConfig | null> {
  const db = getTenantDb(tenantId);

  const result = await db.query<LuckyDrawConfig>(`
    SELECT ${luckyDrawConfigColumns}
    FROM lucky_draw_configs
    WHERE event_id = $1 AND status = 'scheduled'
    LIMIT 1
  `, [eventId]);

  return result.rows[0] || null;
}

/**
 * Get the most recent configuration for an event.
 * Prioritizes 'scheduled' configs (active draft) over completed/cancelled ones.
 * If no scheduled config exists, returns the most recent config of any status.
 */
export async function getLatestConfig(
  tenantId: string,
  eventId: string
): Promise<LuckyDrawConfig | null> {
  const db = getTenantDb(tenantId);

  // First try to get the most recent scheduled config (active draft)
  const scheduledResult = await db.query<LuckyDrawConfig>(`
    SELECT ${luckyDrawConfigColumns}
    FROM lucky_draw_configs
    WHERE event_id = $1 AND status = 'scheduled'
    ORDER BY created_at DESC
    LIMIT 1
  `, [eventId]);

  if (scheduledResult.rows[0]) {
    return scheduledResult.rows[0];
  }

  // Fallback: return the most recent config of any status
  const result = await db.query<LuckyDrawConfig>(`
    SELECT ${luckyDrawConfigColumns}
    FROM lucky_draw_configs
    WHERE event_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [eventId]);

  return result.rows[0] || null;
}

// ============================================
// LUCKY DRAW ENTRIES
// ============================================

/**
 * Create a lucky draw entry (auto-created from photo upload)
 */
export async function createEntryFromPhoto(
  tenantId: string,
  eventId: string,
  photoId: string,
  userFingerprint: string,
  participantName?: string
): Promise<LuckyDrawEntry> {
  const db = getTenantDb(tenantId);

  // Get active config for event
  const config = await getActiveConfig(tenantId, eventId);
  if (!config) {
    throw new Error('No active draw configuration found for this event');
  }

  // Check for duplicate entries (respect max entries per user rule)
  const userEntryCountResult = await db.query<{ count: bigint }>(`
    SELECT COUNT(*) as count
    FROM lucky_draw_entries
    WHERE config_id = $1 AND user_fingerprint = $2
  `, [config.id, userFingerprint]);
  const userEntryCount = Number(userEntryCountResult.rows[0]?.count || 0);

  if (userEntryCount >= (config.maxEntriesPerUser || 1)) {
    throw new Error('Maximum entries per user reached');
  }

  // Create entry
  const entryResult = await db.query<LuckyDrawEntry>(`
    INSERT INTO lucky_draw_entries (
      event_id,
      config_id,
      photo_id,
      user_fingerprint,
      participant_name,
      is_winner,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${luckyDrawEntryColumns}
  `, [
    eventId,
    config.id,
    photoId,
    userFingerprint,
    participantName || null,
    false,
    new Date(),
  ]);

  await db.query(
    `UPDATE lucky_draw_configs
     SET total_entries = (
       SELECT COUNT(*) FROM lucky_draw_entries WHERE config_id = $1
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [config.id]
  );

  return entryResult.rows[0];
}

/**
 * Create one or more manual lucky draw entries
 */
export async function createManualEntries(
  tenantId: string,
  eventId: string,
  input: {
    participantName: string;
    userFingerprint?: string;
    photoId?: string | null;
    entryCount?: number;
  }
): Promise<{ entries: LuckyDrawEntry[]; userFingerprint: string }> {
  const db = getTenantDb(tenantId);

  const config = await getActiveConfig(tenantId, eventId);
  if (!config) {
    throw new Error('No active draw configuration found for this event');
  }

  const requestedCount = input.entryCount && input.entryCount > 0 ? Math.floor(input.entryCount) : 1;
  const userFingerprint = input.userFingerprint || `manual_${generateUUID()}`;

  const existingResult = await db.query<{ count: bigint }>(`
    SELECT COUNT(*) as count
    FROM lucky_draw_entries
    WHERE config_id = $1 AND user_fingerprint = $2
  `, [config.id, userFingerprint]);
  const existingCount = Number(existingResult.rows[0]?.count || 0);
  const maxAllowed = config.maxEntriesPerUser || 1;

  if (existingCount + requestedCount > maxAllowed) {
    throw new Error('Maximum entries per user reached');
  }

  const entries: LuckyDrawEntry[] = [];
  for (let i = 0; i < requestedCount; i += 1) {
    const result = await db.query<LuckyDrawEntry>(`
      INSERT INTO lucky_draw_entries (
        event_id,
        config_id,
        photo_id,
        user_fingerprint,
        participant_name,
        is_winner,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${luckyDrawEntryColumns}
    `, [
      eventId,
      config.id,
      input.photoId ?? null,
      userFingerprint,
      input.participantName,
      false,
      new Date(),
    ]);
    entries.push(result.rows[0]);
  }

  await db.query(
    `UPDATE lucky_draw_configs
     SET total_entries = (
       SELECT COUNT(*) FROM lucky_draw_entries WHERE config_id = $1
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [config.id]
  );

  return { entries, userFingerprint };
}

/**
 * Get all entries for a config (with optional filtering)
 */
export async function getEventEntries(
  tenantId: string,
  configId: string,
  options?: {
    winnersOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<LuckyDrawEntry[]> {
  const db = getTenantDb(tenantId);

  const sql = options?.winnersOnly
    ? `SELECT ${luckyDrawEntryColumns} FROM lucky_draw_entries WHERE config_id = $1 AND is_winner = true ORDER BY created_at DESC`
    : `SELECT ${luckyDrawEntryColumns} FROM lucky_draw_entries WHERE config_id = $1 ORDER BY created_at DESC`;

  if (options?.limit) {
    const offset = options.offset || 0;
    const result = await db.query<LuckyDrawEntry>(`${sql} LIMIT $2 OFFSET $3`, [configId, options.limit, offset]);
    return result.rows;
  }

  const result = await db.query<LuckyDrawEntry>(sql, [configId]);
  return result.rows;
}

/**
 * Get entries by user fingerprint
 */
export async function getUserEntries(
  tenantId: string,
  eventId: string,
  userFingerprint: string
): Promise<LuckyDrawEntry[]> {
  const db = getTenantDb(tenantId);

  const entries = await db.query<LuckyDrawEntry>(`
    SELECT ${luckyDrawEntryColumns}
    FROM lucky_draw_entries
    WHERE event_id = $1 AND user_fingerprint = $2
    ORDER BY created_at DESC
  `, [eventId, userFingerprint]);

  return entries.rows;
}

// ============================================
// DRAW EXECUTION
// ============================================

/**
 * Execute the lucky draw and select winners
 *
 * Process:
 * 1. Get all eligible entries
 * 2. Group by user fingerprint (respect max entries per user)
 * 3. Shuffle eligible entries
 * 4. Select winners by prize tiers
 * 5. Mark winners in database
 * 6. Create winner records
 */
export async function executeDraw(
  tenantId: string,
  configId: string,
  executedBy: string,
  options?: {
    seed?: string; // For testing/reproducible draws
  }
): Promise<{
  winners: Winner[];
  statistics: {
    totalEntries: number;
    eligibleEntries: number;
    winnersSelected: number;
  };
}> {
  const db = getTenantDb(tenantId);

  // 1. Get configuration
  const configResult = await db.query<LuckyDrawConfig>(`
    SELECT ${luckyDrawConfigColumns}
    FROM lucky_draw_configs
    WHERE id = $1
  `, [configId]);

  const config = configResult.rows[0];

  if (!config) {
    throw new Error('Draw configuration not found');
  }

  if (config.status !== 'scheduled') {
    throw new Error('Draw is not in scheduled status');
  }

  // 2. Get all entries for this config
  const allEntries = await db.query<LuckyDrawEntry>(`
    SELECT ${luckyDrawEntryColumns}
    FROM lucky_draw_entries
    WHERE config_id = $1 AND is_winner = false
    ORDER BY created_at ASC
  `, [configId]);

  const eligibleEntries = allEntries.rows;
  const totalEntries = eligibleEntries.length;

  if (eligibleEntries.length === 0) {
    throw new Error('No eligible entries found');
  }

  // 3. Handle duplicate entries (respect max_entries_per_user)
  const userEntriesMap = new Map<string, LuckyDrawEntry[]>();
  for (const entry of eligibleEntries) {
    const entries = userEntriesMap.get(entry.userFingerprint) || [];
    entries.push(entry);
    userEntriesMap.set(entry.userFingerprint, entries);
  }

  // Select only up to max_entries_per_user from each user
  const filteredEntries: LuckyDrawEntry[] = [];
  for (const entries of userEntriesMap.values()) {
    const maxCount = config.preventDuplicateWinners ? 1 : (config.maxEntriesPerUser || 1);
    const selected = entries.slice(0, Math.min(entries.length, maxCount));
    filteredEntries.push(...selected);
  }

  const eligibleEntriesCount = filteredEntries.length;

  if (eligibleEntriesCount === 0) {
    throw new Error('No eligible entries after applying duplicate rules');
  }

  // 4. Shuffle entries (Fisher-Yates)
  const shuffledEntries = options?.seed
    ? seededShuffle(filteredEntries, options.seed)
    : fisherYatesShuffle(filteredEntries);
  const entryById = new Map(shuffledEntries.map((entry) => [entry.id, entry]));

  // 5. Select winners by prize tiers
  const winners: Winner[] = [];
  let selectionOrder = 0;

  // Sort prize tiers by tier order (grand → first → second → third → consolation)
  // prize_tier enum is alphabetical, so we need to map to numeric order
  const tierOrder = {
    grand: 0,
    first: 1,
    second: 2,
    third: 3,
    consolation: 4,
  } as const;

  const sortedPrizeTiers = [...config.prizeTiers].sort((a, b) =>
    (tierOrder[a.tier] || 999) - (tierOrder[b.tier] || 999)
  );

  for (const prizeTier of sortedPrizeTiers) {
    for (let i = 0; i < prizeTier.count; i++) {
      if (selectionOrder >= shuffledEntries.length) {
        break;
      }

      const winner = shuffledEntries[selectionOrder];
      const fallbackName = winner.userFingerprint.slice(0, 8) || 'Anonymous';
      winners.push({
        id: generateUUID(),
        eventId: winner.eventId,
        entryId: winner.id,
        participantName: winner.participantName || fallbackName,
        selfieUrl: '',
        prizeTier: prizeTier.tier,
        prizeName: prizeTier.name,
        prizeDescription: prizeTier.description || '',
        selectionOrder: selectionOrder + 1,
        isClaimed: false,
        drawnAt: new Date(),
        createdAt: new Date(),
      });

      selectionOrder++;
    }
  }

  // 6. Mark entries as winners and update config status
  for (const winner of winners) {
    await db.update(
      'lucky_draw_entries',
      { is_winner: true, prize_tier: winner.prizeTier },
      { id: winner.entryId }
    );
  }

  await db.update(
    'lucky_draw_configs',
    {
      status: 'completed',
      completed_at: new Date(),
      updated_at: new Date(),
    },
    { id: configId }
  );

  // 7. Create winner records
  const photoIds = Array.from(
    new Set(
      winners
        .map((winner) => entryById.get(winner.entryId)?.photoId || null)
        .filter((id): id is string => !!id)
    )
  );

  const photosResult = photoIds.length
    ? await db.query<{ id: string; contributorName: string | null; images: { full_url?: string } }>(
      `
          SELECT id, contributor_name AS "contributorName", images
          FROM photos
          WHERE id = ANY($1)
        `,
      [photoIds]
    )
    : { rows: [] as Array<{ id: string; contributorName: string | null; images: { full_url?: string } }> };

  const photoMap = new Map(photosResult.rows.map((photo) => [photo.id, photo]));

  const enrichedWinners = winners.map((winner) => {
    const entry = entryById.get(winner.entryId);
    const photo = entry?.photoId ? photoMap.get(entry.photoId) : undefined;
    const participantName = winner.participantName || photo?.contributorName || 'Anonymous';
    const selfieUrl = photo?.images?.full_url || '';
    return {
      ...winner,
      participantName,
      selfieUrl,
    };
  });

  for (const winner of enrichedWinners) {
    await db.insert('winners', {
      event_id: winner.eventId,
      entry_id: winner.entryId,
      participant_name: winner.participantName,
      selfie_url: winner.selfieUrl,
      prize_tier: winner.prizeTier,
      prize_name: winner.prizeName,
      prize_description: winner.prizeDescription,
      selection_order: winner.selectionOrder,
      is_claimed: false,
      drawn_at: new Date(),
      created_at: new Date(),
    });
  }

  return {
    winners: enrichedWinners,
    statistics: {
      totalEntries,
      eligibleEntries: eligibleEntriesCount,
      winnersSelected: winners.length,
    },
  };
}

/**
 * Seeded shuffle for reproducible draws (for testing)
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const shuffled = [...array];
  let seedValue = 0;

  // Simple hash function
  const hash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
    }
    return hash;
  };

  seedValue = hash(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    seedValue = (seedValue * 1103515245 + 12345) % 2147483648;
    const j = Math.floor(Math.abs(seedValue) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// ============================================
// DRAW STATUS
// ============================================

/**
 * Mark draw as completed
 */
export async function markDrawCompleted(
  tenantId: string,
  configId: string
): Promise<void> {
  const db = getTenantDb(tenantId);

  await db.update(
    'lucky_draw_configs',
    { status: 'completed', completed_at: new Date(), updated_at: new Date() },
    { id: configId }
  );
}

/**
 * Cancel a draw
 */
export async function cancelDraw(
  tenantId: string,
  configId: string,
  reason: string
): Promise<void> {
  const db = getTenantDb(tenantId);

  await db.update(
    'lucky_draw_configs',
    { status: 'cancelled', completed_at: new Date(), updated_at: new Date() },
    { id: configId }
  );
}

// ============================================
// REDRAW FUNCTIONALITY
// ============================================

/**
 * Redraw a single prize tier when a winner is unavailable.
 * Marks the previous winner as replaced and selects a new winner from remaining eligible entries.
 */
export async function redrawPrizeTier(
  tenantId: string,
  params: {
    eventId: string;
    configId: string;
    prizeTier: string;
    previousWinnerId?: string;
    reason?: string;
    redrawBy: string;
  }
): Promise<{
  newWinner: Winner;
  previousWinner: Winner | null;
}> {
  const db = getTenantDb(tenantId);
  const { eventId, configId, prizeTier, previousWinnerId, reason } = params;

  // 1. Get configuration
  const configResult = await db.query<LuckyDrawConfig>(`
    SELECT ${luckyDrawConfigColumns}
    FROM lucky_draw_configs
    WHERE id = $1
  `, [configId]);

  const config = configResult.rows[0];
  if (!config) {
    throw new Error('Draw configuration not found');
  }

  // 2. Get prize tier info
  const tierInfo = config.prizeTiers.find(t => t.tier === prizeTier);
  if (!tierInfo) {
    throw new Error(`Prize tier "${prizeTier}" not found in configuration`);
  }

  // 3. Mark previous winner as replaced (if provided)
  let previousWinner: Winner | null = null;
  if (previousWinnerId) {
    const prevWinnerResult = await db.query<Winner>(`
      SELECT ${winnerColumns}
      FROM winners
      WHERE id = $1
    `, [previousWinnerId]);
    previousWinner = prevWinnerResult.rows[0] || null;

    if (previousWinner) {
      // Mark the winner as replaced (not claimed, add note)
      await db.query(`
        UPDATE winners
        SET is_claimed = false,
            prize_description = COALESCE(prize_description, '') || ' [REPLACED: ' || $2 || ']',
            notified_at = NOW()
        WHERE id = $1
      `, [previousWinnerId, reason || 'Winner unavailable']);

      // Mark the entry as no longer a winner so it's not excluded
      await db.update(
        'lucky_draw_entries',
        { is_winner: false, prize_tier: null },
        { id: previousWinner.entryId }
      );
    }
  }

  // 4. Get all entries excluding existing winners
  const existingWinnersResult = await db.query<{ userFingerprint: string }>(`
    SELECT DISTINCT le.user_fingerprint AS "userFingerprint"
    FROM winners w
    JOIN lucky_draw_entries le ON le.id = w.entry_id
    WHERE w.event_id = $1
      AND w.prize_description NOT LIKE '%[REPLACED:%'
  `, [eventId]);

  const existingWinnerFingerprints = new Set(
    existingWinnersResult.rows.map(r => r.userFingerprint)
  );

  // If previous winner was replaced, remove from exclusion list
  if (previousWinner) {
    const prevEntryResult = await db.query<{ userFingerprint: string }>(`
      SELECT user_fingerprint AS "userFingerprint"
      FROM lucky_draw_entries
      WHERE id = $1
    `, [previousWinner.entryId]);
    if (prevEntryResult.rows[0]) {
      existingWinnerFingerprints.delete(prevEntryResult.rows[0].userFingerprint);
    }
  }

  // 5. Get eligible entries (not winners, not from existing winner fingerprints)
  const eligibleEntriesResult = await db.query<LuckyDrawEntry>(`
    SELECT ${luckyDrawEntryColumns}
    FROM lucky_draw_entries
    WHERE config_id = $1 AND is_winner = false
    ORDER BY created_at ASC
  `, [configId]);

  const eligibleEntries = eligibleEntriesResult.rows.filter(
    entry => !existingWinnerFingerprints.has(entry.userFingerprint)
  );

  if (eligibleEntries.length === 0) {
    throw new Error('No eligible entries available for redraw');
  }

  // 6. Shuffle and select new winner
  const shuffled = fisherYatesShuffle(eligibleEntries);
  const selectedEntry = shuffled[0];

  // 7. Get photo info for selfie URL
  let selfieUrl = '';
  let participantName = selectedEntry.participantName || 'Anonymous';

  if (selectedEntry.photoId) {
    const photoResult = await db.query<{ contributorName: string | null; images: { full_url?: string } }>(`
      SELECT contributor_name AS "contributorName", images
      FROM photos
      WHERE id = $1
    `, [selectedEntry.photoId]);

    if (photoResult.rows[0]) {
      selfieUrl = photoResult.rows[0].images?.full_url || '';
      participantName = photoResult.rows[0].contributorName || participantName;
    }
  }

  // 8. Mark entry as winner
  await db.update(
    'lucky_draw_entries',
    { is_winner: true, prize_tier: prizeTier },
    { id: selectedEntry.id }
  );

  // 9. Get next selection order
  const maxOrderResult = await db.query<{ maxOrder: number }>(`
    SELECT COALESCE(MAX(selection_order), 0) as "maxOrder"
    FROM winners
    WHERE event_id = $1
  `, [eventId]);
  const nextOrder = (maxOrderResult.rows[0]?.maxOrder || 0) + 1;

  // 10. Create new winner record
  const newWinner: Winner = {
    id: generateUUID(),
    eventId,
    entryId: selectedEntry.id,
    participantName,
    selfieUrl,
    prizeTier: tierInfo.tier,
    prizeName: tierInfo.name,
    prizeDescription: tierInfo.description || '' + (reason ? ` [REDRAW: ${reason}]` : ' [REDRAW]'),
    selectionOrder: nextOrder,
    isClaimed: false,
    drawnAt: new Date(),
    createdAt: new Date(),
  };

  await db.insert('winners', {
    event_id: newWinner.eventId,
    entry_id: newWinner.entryId,
    participant_name: newWinner.participantName,
    selfie_url: newWinner.selfieUrl,
    prize_tier: newWinner.prizeTier,
    prize_name: newWinner.prizeName,
    prize_description: newWinner.prizeDescription,
    selection_order: newWinner.selectionOrder,
    is_claimed: false,
    drawn_at: new Date(),
    created_at: new Date(),
  });

  return {
    newWinner,
    previousWinner,
  };
}

// ============================================
// WINNER MANAGEMENT
// ============================================

/**
 * Get winners for a specific draw
 */
export async function getDrawWinners(
  tenantId: string,
  eventId: string
): Promise<Winner[]> {
  const db = getTenantDb(tenantId);

  const winners = await db.query<Winner>(`
    SELECT ${winnerColumns}
    FROM winners
    WHERE event_id = $1
    ORDER BY drawn_at DESC
  `, [eventId]);

  return winners.rows;
}

/**
 * Mark winner as claimed
 */
export async function markWinnerClaimed(
  tenantId: string,
  winnerId: string
): Promise<void> {
  const db = getTenantDb(tenantId);

  await db.update(
    'winners',
    { is_claimed: true, notified_at: new Date() },
    { id: winnerId }
  );
}

/**
 * Get all winners for a tenant (paginated)
 */
export async function getTenantWinners(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    claimed?: boolean;
  }
): Promise<Winner[]> {
  const db = getTenantDb(tenantId);

  let sql = `SELECT ${winnerColumns} FROM winners`;
  const params: unknown[] = [];
  let paramIndex = 1;

  const conditions: string[] = [];
  if (options?.claimed !== undefined) {
    conditions.push(`is_claimed = $${paramIndex++}`);
    params.push(options.claimed);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY drawn_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
    if (options.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }
  }

  const result = await db.query<Winner>(sql, params);
  return result.rows;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get draw statistics for an event
 */
export async function getDrawStatistics(
  tenantId: string,
  eventId: string
): Promise<{
  totalEntries: number;
  uniqueParticipants: number;
  totalDraws: number;
  totalWinners: number;
}> {
  const db = getTenantDb(tenantId);

  // Count total entries
  const entryCountResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(*) as count FROM lucky_draw_entries WHERE event_id = $1`, [eventId]
  );
  const entryCount = Number(entryCountResult.rows[0]?.count || 0);

  // Count unique participants (by fingerprint)
  const participantCountResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(DISTINCT user_fingerprint) as count FROM lucky_draw_entries WHERE event_id = $1`, [eventId]
  );
  const participantCount = Number(participantCountResult.rows[0]?.count || 0);

  // Count total draws
  const drawCountResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(*) as count FROM lucky_draw_configs WHERE event_id = $1 AND status = 'completed'`, [eventId]
  );
  const drawCount = Number(drawCountResult.rows[0]?.count || 0);

  // Count total winners
  const winnerCountResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(*) as count FROM winners WHERE event_id = $1`, [eventId]
  );
  const winnerCount = Number(winnerCountResult.rows[0]?.count || 0);

  return {
    totalEntries: entryCount,
    uniqueParticipants: participantCount,
    totalDraws: drawCount,
    totalWinners: winnerCount,
  };
}

/**
 * Get entry statistics by user fingerprint
 */
export async function getUserEntryStatistics(
  tenantId: string,
  eventId: string,
  userFingerprint: string
): Promise<{
  entryCount: number;
  hasWon: boolean;
}> {
  const db = getTenantDb(tenantId);

  // Count entries
  const entryCountResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(*) as count FROM lucky_draw_entries WHERE event_id = $1 AND user_fingerprint = $2`,
    [eventId, userFingerprint]
  );
  const entryCount = Number(entryCountResult.rows[0]?.count || 0);

  // Check if user has won
  const winnerResult = await db.query<{ count: bigint }>(
    `SELECT COUNT(*) as count FROM lucky_draw_entries WHERE event_id = $1 AND user_fingerprint = $2 AND is_winner = true`,
    [eventId, userFingerprint]
  );
  const hasWon = Number(winnerResult.rows[0]?.count || 0) > 0;

  return {
    entryCount,
    hasWon,
  };
}

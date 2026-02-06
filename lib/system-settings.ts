// ============================================
// Gatherly - System Settings
// ============================================

import { getTenantDb } from './db';
import type { ISystemSettings } from './types';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

const DEFAULT_SYSTEM_SETTINGS: ISystemSettings = {
  uploads: {
    max_file_mb: 10,
    allowed_types: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  },
  moderation: {
    enabled: false,
    aws_region: 'us-east-1',
    aws_access_key_id: undefined,
    aws_secret_access_key: undefined,
    confidence_threshold: 0.8,
    auto_reject: true,
  },
  events: {
    default_settings: {
      theme: {
        primary_color: '#8B5CF6',
        secondary_color: '#EC4899',
        background: '#F9FAFB',
        logo_url: undefined,
        frame_template: 'polaroid',
      },
      features: {
        photo_upload_enabled: true,
        lucky_draw_enabled: true,
        reactions_enabled: true,
        moderation_required: false,
        anonymous_allowed: true,
        guest_download_enabled: true,
        photo_challenge_enabled: false,
        attendance_enabled: false,
      },
    },
  },
};

let cachedSettings: { value: ISystemSettings; expiresAt: number } | null = null;
const CACHE_TTL = 60 * 1000;

function mergeSettings(base: ISystemSettings, patch?: Partial<ISystemSettings>): ISystemSettings {
  if (!patch) return base;

  return {
    uploads: {
      ...base.uploads,
      ...(patch.uploads || {}),
      allowed_types: patch.uploads?.allowed_types || base.uploads.allowed_types,
    },
    moderation: {
      ...base.moderation,
      ...(patch.moderation || {}),
    },
    events: {
      default_settings: {
        theme: {
          ...base.events.default_settings.theme,
          ...(patch.events?.default_settings?.theme || {}),
        },
        features: {
          ...base.events.default_settings.features,
          ...(patch.events?.default_settings?.features || {}),
        },
      },
    },
  };
}

export function getDefaultSystemSettings(): ISystemSettings {
  return DEFAULT_SYSTEM_SETTINGS;
}

export async function getSystemSettings(): Promise<ISystemSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value;
  }

  const db = getTenantDb(SYSTEM_TENANT_ID);
  try {
    const result = await db.query<{ settings: ISystemSettings }>(
      'SELECT settings FROM system_settings ORDER BY updated_at DESC LIMIT 1'
    );

    const merged = mergeSettings(DEFAULT_SYSTEM_SETTINGS, result.rows[0]?.settings);
    cachedSettings = { value: merged, expiresAt: Date.now() + CACHE_TTL };
    return merged;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '42P01') {
      const fallback = DEFAULT_SYSTEM_SETTINGS;
      cachedSettings = { value: fallback, expiresAt: Date.now() + CACHE_TTL };
      return fallback;
    }
    throw error;
  }
}

export async function updateSystemSettings(
  updates: Partial<ISystemSettings>,
  updatedBy?: string
): Promise<ISystemSettings> {
  const db = getTenantDb(SYSTEM_TENANT_ID);
  try {
    const current = await getSystemSettings();
    const merged = mergeSettings(current, updates);

    const existing = await db.query<{ id: string }>(
      'SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1'
    );

    if (existing.rows[0]) {
      await db.query(
        'UPDATE system_settings SET settings = $1, updated_at = $2, updated_by = $3 WHERE id = $4',
        [merged, new Date(), updatedBy || null, existing.rows[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO system_settings (settings, updated_at, updated_by) VALUES ($1, $2, $3)',
        [merged, new Date(), updatedBy || null]
      );
    }

    cachedSettings = { value: merged, expiresAt: Date.now() + CACHE_TTL };
    return merged;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '42P01') {
      throw new Error('System settings table is missing. Run migration 0010_system_settings.sql.');
    }
    throw error;
  }
}

export function clearSystemSettingsCache() {
  cachedSettings = null;
}

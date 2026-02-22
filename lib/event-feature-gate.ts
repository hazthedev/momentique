export type GatedEventFeatureKey =
  | 'attendance_enabled'
  | 'lucky_draw_enabled'
  | 'photo_challenge_enabled';

export type FeatureHighlightKey =
  | 'attendance'
  | 'lucky_draw'
  | 'photo_challenge'
  | 'guest_download'
  | 'moderation'
  | 'anonymous';

const FEATURE_LABELS: Record<GatedEventFeatureKey, string> = {
  attendance_enabled: 'Attendance',
  lucky_draw_enabled: 'Lucky draw',
  photo_challenge_enabled: 'Photo challenge',
};

type EventWithFeatureSettings = {
  settings?: {
    features?: Partial<Record<GatedEventFeatureKey, boolean>>;
  } | null;
};

export class FeatureDisabledError extends Error {
  feature: GatedEventFeatureKey;

  constructor(feature: GatedEventFeatureKey) {
    super(`${FEATURE_LABELS[feature]} feature is disabled`);
    this.name = 'FeatureDisabledError';
    this.feature = feature;
  }
}

export function assertEventFeatureEnabled(
  event: EventWithFeatureSettings,
  feature: GatedEventFeatureKey
) {
  if (event.settings?.features?.[feature] === false) {
    throw new FeatureDisabledError(feature);
  }
}

export function isFeatureDisabledError(error: unknown): error is FeatureDisabledError {
  return error instanceof FeatureDisabledError;
}

export function buildFeatureDisabledPayload(feature: GatedEventFeatureKey) {
  return {
    error: `${FEATURE_LABELS[feature]} feature is disabled`,
    code: 'FEATURE_DISABLED',
    feature,
  };
}

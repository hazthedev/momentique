import type { IEvent } from '@/lib/types';
import type { DEFAULT_UPLOAD_RATE_LIMITS } from './constants';

export type SettingsSubTab = 'basic' | 'theme' | 'features' | 'security' | 'advanced';
export type SettingsFeatureHighlight =
  | 'attendance'
  | 'lucky_draw'
  | 'photo_challenge'
  | 'guest_download'
  | 'moderation'
  | 'anonymous';

export type UploadRateLimits = typeof DEFAULT_UPLOAD_RATE_LIMITS;

export type EventStatus = IEvent['status'];

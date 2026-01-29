// ============================================
// Gatherly - TypeScript Type Definitions
// ============================================

// ============================================
// TENANT TYPES
// ============================================

export type TenantType = 'master' | 'white_label' | 'demo';

export type TenantStatus = 'active' | 'suspended' | 'trial';

export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise' | 'tester';

export interface ITenantBranding {
  primary_color: string;
  secondary_color: string;
  accent_color?: string;
  logo_url?: string;
  favicon_url?: string;
  background_image?: string;
  font_family?: string;
  custom_css?: string;
}

export interface ITenantFeatures {
  lucky_draw: boolean;
  photo_reactions: boolean;
  video_uploads: boolean;
  custom_templates: boolean;
  api_access: boolean;
  sso: boolean;
  white_label: boolean;
  advanced_analytics: boolean;
}

export interface ITenantLimits {
  max_events_per_month: number;
  max_storage_gb: number;
  max_admins: number;
  max_photos_per_event: number;
  max_draw_entries_per_event: number;
  custom_features: string[];
}

export interface ITenant {
  id: string;
  tenant_type: TenantType;
  brand_name: string;
  company_name: string;
  contact_email: string;
  support_email?: string;
  phone?: string;
  domain?: string;
  subdomain?: string;
  is_custom_domain: boolean;
  branding: ITenantBranding;
  subscription_tier: SubscriptionTier;
  features_enabled: ITenantFeatures;
  limits: ITenantLimits;
  status: TenantStatus;
  trial_ends_at?: Date;
  subscription_ends_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SYSTEM SETTINGS
// ============================================

export interface ISystemSettings {
  uploads: {
    max_file_mb: number;
    allowed_types: string[];
  };
  moderation: {
    enabled: boolean;
    aws_region?: string;
    aws_access_key_id?: string;
    aws_secret_access_key?: string;
    confidence_threshold: number;
    auto_reject: boolean;
  };
  events: {
    default_settings: {
      theme: {
        primary_color: string;
        secondary_color: string;
        background: string;
        logo_url?: string;
        frame_template: string;
        photo_card_style?: string;
      };
      features: {
        photo_upload_enabled: boolean;
        lucky_draw_enabled: boolean;
        reactions_enabled: boolean;
        moderation_required: boolean;
        anonymous_allowed: boolean;
        guest_download_enabled: boolean;
      };
      limits: {
        max_photos_per_user: number;
        max_total_photos: number;
        max_draw_entries: number;
      };
    };
  };
}

// ============================================
// USER TYPES
// ============================================

export type UserRole = 'guest' | 'organizer' | 'super_admin';

export interface IUser {
  id: string;
  tenant_id: string;
  email: string;
  password_hash?: string;
  name: string;
  role: UserRole;
  subscription_tier?: SubscriptionTier;
  email_verified: boolean;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface IUserCreate {
  email: string;
  password: string;
  name: string;
  tenant_id?: string;
  subscription_tier?: SubscriptionTier;
}

export interface IUserUpdate {
  name?: string;
  avatar_url?: string;
  email?: string;
  subscription_tier?: SubscriptionTier;
}

// ============================================
// EVENT TYPES
// ============================================

export type EventType = 'birthday' | 'wedding' | 'corporate' | 'other';

export type EventStatus = 'draft' | 'active' | 'ended' | 'archived';

export interface IEventTheme {
  primary_color: string;
  secondary_color: string;
  background: string;
  logo_url?: string;
  frame_template: string;
  photo_card_style?: string;
}

export interface IEventFeatures {
  photo_upload_enabled: boolean;
  lucky_draw_enabled: boolean;
  reactions_enabled: boolean;
  moderation_required: boolean;
  anonymous_allowed: boolean;
  guest_download_enabled: boolean;
}

export interface IEventLimits {
  max_photos_per_user: number;
  max_total_photos: number;
  max_draw_entries: number;
}

export interface IEventSettings {
  theme: IEventTheme;
  features: IEventFeatures;
  limits: IEventLimits;
}

export interface IEvent {
  id: string;
  tenant_id: string;
  organizer_id: string;
  name: string;
  slug: string;
  short_code?: string | null;
  description?: string;
  event_type: EventType;
  event_date: Date;
  timezone: string;
  location?: string;
  expected_guests?: number;
  custom_hashtag?: string;
  settings: IEventSettings;
  status: EventStatus;
  qr_code_url: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IEventCreate {
  name: string;
  event_date: Date;
  event_type: EventType;
  description?: string;
  location?: string;
  expected_guests?: number;
  custom_hashtag?: string;
  settings?: Partial<IEventSettings>;
}

export interface IEventUpdate {
  name?: string;
  description?: string;
  event_date?: Date;
  event_type?: EventType;
  location?: string;
  settings?: Partial<IEventSettings>;
  status?: EventStatus;
  short_code?: string;
  slug?: string;
  qr_code_url?: string;
}

// ============================================
// PHOTO TYPES
// ============================================

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface IPhotoImage {
  original_url: string;
  thumbnail_url: string;
  medium_url: string;
  full_url: string;
  width: number;
  height: number;
  file_size: number;
  format: string;
}

export interface IPhotoReactions {
  heart: number;
  clap: number;
  laugh: number;
  wow: number;
}

export interface IPhotoMetadata {
  ip_address: string; // hashed
  user_agent: string;
  upload_timestamp: Date;
  device_type: DeviceType;
}

export interface IPhoto {
  id: string;
  event_id: string;
  user_fingerprint: string;
  images: IPhotoImage;
  caption?: string;
  contributor_name?: string;
  is_anonymous: boolean;
  status: PhotoStatus;
  reactions: IPhotoReactions;
  metadata: IPhotoMetadata;
  created_at: Date;
  approved_at?: Date;
}

export interface IPhotoCreate {
  event_id: string;
  images: IPhotoImage;
  caption?: string;
  contributor_name?: string;
  is_anonymous?: boolean;
}

// ============================================
// LUCKY DRAW TYPES
// ============================================

export interface ILuckyDrawEntry {
  id: string;
  event_id: string;
  participant_name: string;
  selfie_url: string;
  contact_info?: string; // encrypted
  user_fingerprint: string;
  agreed_to_display: boolean;
  entry_timestamp: Date;
  is_winner: boolean;
  prize_tier?: number;
  metadata: {
    ip_address: string; // hashed
    device_type: string;
  };
  created_at: Date;
}

export interface ILuckyDrawEntryCreate {
  event_id: string;
  participant_name: string;
  selfie_url: string;
  contact_info?: string;
  agreed_to_display: boolean;
}

export type AnimationStyle = 'countdown';

export interface ILuckyDrawConfig {
  number_of_winners: number;
  animation_style: AnimationStyle;
  animation_duration: number;
  show_selfie: boolean;
  show_full_name: boolean;
  play_sound: boolean;
  confetti_animation: boolean;
}

// ============================================
// LUCKY DRAW TYPES (Phase 5)
// ============================================

export type PrizeTier = 'first' | 'second' | 'third' | 'consolation';

export type DrawStatus = 'scheduled' | 'completed' | 'cancelled';

export interface IPrizeTier {
  tier: PrizeTier;
  name: string;
  description?: string;
  count: number;
}

export interface ILuckyDrawConfigV2 {
  id: string;
  eventId: string;
  prizeTiers: IPrizeTier[];
  maxEntriesPerUser: number;
  requirePhotoUpload: boolean;
  preventDuplicateWinners: boolean;
  animationStyle: AnimationStyle;
  animationDuration: number;
  showSelfie: boolean;
  showFullName: boolean;
  playSound: boolean;
  confettiAnimation: boolean;
  status: DrawStatus;
  totalEntries: number;
  scheduledAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILuckyDrawEntryV2 {
  id: string;
  eventId: string;
  configId: string;
  photoId?: string | null;
  userFingerprint: string;
  participantName?: string | null;
  isWinner: boolean;
  prizeTier?: PrizeTier;
  createdAt: Date;
}

export interface IWinnerV2 {
  id: string;
  eventId: string;
  entryId: string;
  participantName: string;
  selfieUrl: string;
  prizeTier: PrizeTier;
  prizeName: string;
  prizeDescription: string;
  selectionOrder: number;
  isClaimed: boolean;
  drawnAt: Date;
  notifiedAt?: Date;
  createdAt: Date;
}

// Type aliases for backward compatibility
export type LuckyDrawConfig = ILuckyDrawConfigV2;
export type LuckyDrawEntry = ILuckyDrawEntryV2;
export type Winner = IWinnerV2;
export type NewLuckyDrawConfig = Omit<ILuckyDrawConfigV2, 'id' | 'status' | 'totalEntries' | 'createdAt' | 'updatedAt'>;
export type NewLuckyDrawEntry = Omit<ILuckyDrawEntryV2, 'id' | 'createdAt'>;
export type NewWinner = Omit<IWinnerV2, 'id' | 'createdAt'>;

// Legacy types (Phase 4 and earlier)
export interface IWinner {
  id: string;
  event_id: string;
  entry_id: string;
  participant_name: string;
  selfie_url: string;
  prize_tier: number;
  drawn_at: Date;
  drawn_by: string; // admin user_id
  is_claimed: boolean;
  notes?: string;
}

// ============================================
// AUTH TYPES
// ============================================

export interface IJWTPayload {
  sub: string; // user id
  tenant_id: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface IAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface IAuthResponse {
  user: IUser;
  tokens: IAuthTokens;
}

// ============================================
// SESSION TYPES (Redis-based)
// ============================================

export interface ISessionData {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  createdAt: number; // Unix timestamp in milliseconds
  lastActivity: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
  ipAddress?: string;
  userAgent?: string;
  rememberMe: boolean;
}

export interface ISessionValidationResult {
  valid: boolean;
  session?: ISessionData;
  user?: IUser;
  error?: string;
}

export interface ISessionOptions {
  ipAddress?: string;
  userAgent?: string;
  rememberMe?: boolean;
}

// ============================================
// AUTHENTICATION REQUEST TYPES
// ============================================

export interface ILoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantName?: string; // Optional: if provided, creates/joins tenant
}

export interface IAuthResponseSession {
  success: boolean;
  user?: IUser;
  sessionId?: string;
  message?: string;
  error?: string;
}

export interface IMeResponse {
  user: IUser;
  tenant?: ITenant;
}

// ============================================
// AUTHENTICATION ERROR TYPES
// ============================================

export type AuthErrorType =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_EXISTS'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'RATE_LIMIT_EXCEEDED'
  | 'WEAK_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface IAuthError {
  type: AuthErrorType;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// PASSWORD TYPES
// ============================================

export interface IPasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars?: string;
}

export interface IPasswordValidationResult {
  valid: boolean;
  strength: 'weak' | 'moderate' | 'strong' | 'very-strong';
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

// ============================================
// API RESPONSE TYPES
// ============================================

export type ApiError = {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  code?: string;
};

export type ApiSuccess<T> = {
  data: T;
  message?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================
// REAL-TIME TYPES
// ============================================

export type SocketEvent =
  | 'join_event'
  | 'leave_event'
  | 'new_photo'
  | 'photo_updated'
  | 'stats_update'
  | 'draw_started'
  | 'draw_winner'
  | 'reaction_added'
  | 'user_joined'
  | 'user_left';

export interface ISocketEventData {
  join_event: { event_id: string };
  leave_event: { event_id: string };
  new_photo: IPhoto;
  photo_updated: { photo_id: string; status: PhotoStatus };
  stats_update: IEventStats;
  draw_started: ILuckyDrawConfig;
  draw_winner: IWinner;
  reaction_added: { photo_id: string; emoji: string; count: number };
  user_joined: { event_id: string; user_count: number };
  user_left: { event_id: string; user_count: number };
}

export interface IEventStats {
  event_id: string;
  unique_visitors: number;
  total_visits: number;
  photos_uploaded: number;
  draw_entries: number;
  total_reactions: number;
  peak_time?: Date;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface IUsageMetrics {
  tenant_id: string;
  billing_period: string; // YYYY-MM format
  events_created: number;
  total_photos_uploaded: number;
  total_storage_gb: number;
  total_lucky_draws: number;
  api_calls: number;
}

export interface IUsageOverage {
  events: number;
  storage: number;
  api_calls: number;
}

export interface IBillingCalculation {
  estimated_cost: number;
  overage_charges: number;
  total_due: number;
}

// ============================================
// EXPORT TYPES
// ============================================

export type ExportFormat = 'zip' | 'csv' | 'json' | 'pdf';

export type ExportQuality = 'thumbnail' | 'medium' | 'original';

export interface IExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  include_metadata: boolean;
  include_contributor_names: boolean;
  include_timestamps: boolean;
  include_reactions: boolean;
  watermark: boolean;
}

export interface IExportJob {
  id: string;
  event_id: string;
  requested_by: string;
  options: IExportOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  expires_at?: Date;
  created_at: Date;
  completed_at?: Date;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEvent =
  | 'photo.uploaded'
  | 'photo.moderated'
  | 'lucky_draw.completed'
  | 'event.created'
  | 'event.ended'
  | 'export.ready';

export interface IWebhook {
  id: string;
  tenant_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IWebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: Date;
  data: unknown;
  tenant_id: string;
}

// ============================================
// REQUEST CONTEXT TYPES
// ============================================

export interface ITenantContext {
  tenant: ITenant;
  is_custom_domain: boolean;
  is_master: boolean;
}

export interface IRequestContext {
  tenant?: ITenant;
  user?: IUser;
  session_id?: string;
  fingerprint?: string;
}

// ============================================
// FORM TYPES
// ============================================

export type ReactionType = 'heart' | 'clap' | 'laugh' | 'wow';

export interface IReactionCreate {
  photo_id: string;
  type: ReactionType;
}

// ============================================
// MODERATION TYPES
// ============================================

export interface IModerationResult {
  is_safe: boolean;
  confidence: number;
  labels: Array<{
    name: string;
    confidence: number;
  }>;
  flagged_reasons: string[];
}

export interface IModerationAction {
  photo_id: string;
  action: 'approve' | 'reject' | 'delete';
  reason?: string;
  ban_user?: boolean;
}

export type ModerationActionType = 'approve' | 'reject' | 'delete';

export interface IPhotoModerationLog {
  id: string;
  photo_id: string;
  event_id: string;
  tenant_id: string;
  moderator_id: string;
  action: ModerationActionType;
  reason?: string;
  created_at: Date;
}

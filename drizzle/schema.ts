// ============================================
// Gatherly - Drizzle Schema Definitions
// ============================================
// This file defines the PostgreSQL database schema using Drizzle ORM.
// It matches the TypeScript interfaces in lib/types.ts.
//
// Tables:
// - tenants: Multi-tenant configuration
// - users: User accounts with tenant isolation
// - events: Event management
// - photos: Photo uploads with metadata
// - migration_version: Schema version tracking
//
// Row-Level Security (RLS):
// All tables with tenant_id have RLS enabled to enforce tenant isolation.
// The set_tenant_id() function (created in migrations) sets the session context.

import { pgTable, pgEnum, uuid, text, integer, timestamp, boolean, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// ENUMS
// ============================================

// Enums matching TypeScript types from lib/types.ts
export const tenantTypeEnum = pgEnum('tenant_type', ['master', 'white_label', 'demo']);
export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended', 'trial']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'premium', 'enterprise', 'tester']);
export const userRoleEnum = pgEnum('user_role', ['guest', 'organizer', 'super_admin']);
export const eventTypeEnum = pgEnum('event_type', ['birthday', 'wedding', 'corporate', 'other']);
export const eventStatusEnum = pgEnum('event_status', ['draft', 'active', 'ended', 'archived']);
export const photoStatusEnum = pgEnum('photo_status', ['pending', 'approved', 'rejected']);
export const deviceTypeEnum = pgEnum('device_type', ['mobile', 'tablet', 'desktop']);
export const moderationActionEnum = pgEnum('moderation_action', ['approve', 'reject', 'delete']);

// ============================================
// MIGRATION VERSION TABLE
// ============================================

// Tracks the current schema version for migration management
// This table is referenced by lib/db.ts getMigrationVersion() and setMigrationVersion()
export const migrationVersion = pgTable('migration_version', {
  version: integer('version').primaryKey(),
  appliedAt: timestamp('applied_at').notNull().defaultNow(),
  description: text('description'),
});

// ============================================
// TENANTS TABLE
// ============================================

// Multi-tenant configuration table
// Each tenant represents a separate customer/organization with their own branding, features, and limits
//
// RLS Policy:
// - System tenant (00000000-0000-0000-0000-000000000000) can see all tenants
// - Regular tenants can only see themselves
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantType: tenantTypeEnum('tenant_type').notNull().default('white_label'),
  brandName: text('brand_name').notNull(),
  companyName: text('company_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  supportEmail: text('support_email'),
  phone: text('phone'),
  domain: text('domain'), // Custom domain (e.g., events.acme.com)
  subdomain: text('subdomain'), // Subdomain (e.g., acme.momentique.com)
  isCustomDomain: boolean('is_custom_domain').notNull().default(false),
  // JSONB fields for flexible configuration
  branding: jsonb('branding').$type<{
    primary_color: string;
    secondary_color: string;
    accent_color?: string;
    logo_url?: string;
    favicon_url?: string;
    background_image?: string;
    font_family?: string;
    custom_css?: string;
  }>().notNull().default(sql`'{}'::jsonb`),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  featuresEnabled: jsonb('features_enabled').$type<{
    lucky_draw: boolean;
    photo_reactions: boolean;
    video_uploads: boolean;
    custom_templates: boolean;
    api_access: boolean;
    sso: boolean;
    white_label: boolean;
    advanced_analytics: boolean;
  }>().notNull().default(sql`'{}'::jsonb`),
  limits: jsonb('limits').$type<{
    max_events_per_month: number;
    max_storage_gb: number;
    max_admins: number;
    max_photos_per_event: number;
    max_draw_entries_per_event: number;
    custom_features: string[];
  }>().notNull().default(sql`'{}'::jsonb`),
  status: tenantStatusEnum('status').notNull().default('trial'),
  trialEndsAt: timestamp('trial_ends_at'),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for tenant lookup optimization
  tenantDomainIdx: index('tenant_domain_idx').on(table.domain),
  tenantSubdomainIdx: index('tenant_subdomain_idx').on(table.subdomain),
  tenantStatusIdx: index('tenant_status_idx').on(table.status),
}));

// ============================================
// SYSTEM SETTINGS TABLE
// ============================================

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  settings: jsonb('settings').$type<{
    uploads: {
      max_file_mb: number;
      allowed_types: string[];
    };
    events: {
      default_settings: {
        theme: {
          primary_color: string;
          secondary_color: string;
          background: string;
          logo_url?: string;
          frame_template: string;
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
  }>().notNull().default(sql`'{}'::jsonb`),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  systemSettingsUpdatedIdx: index('system_settings_updated_idx').on(table.updatedAt),
}));

// ============================================
// USERS TABLE
// ============================================

// User accounts with tenant isolation
// All queries are automatically scoped to the tenant context via RLS
//
// RLS Policy:
// - Users can only see other users in the same tenant
// - set_tenant_id() must be called before any query to set the session context
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  passwordHash: text('password_hash'), // NULL for OAuth-only users
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('guest'),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  emailVerified: boolean('email_verified').notNull().default(false),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  // Unique constraint: each tenant can only have one user with a given email
  userTenantEmailUnique: unique('users_tenant_email_key').on(table.tenantId, table.email),
  // Indexes for user lookup optimization
  userTenantIdx: index('user_tenant_idx').on(table.tenantId),
  userEmailIdx: index('user_email_idx').on(table.email),
}));

// ============================================
// EVENTS TABLE
// ============================================

// Event management with tenant isolation
// Each event belongs to a tenant and is organized by a user
//
// RLS Policy:
// - Events are automatically scoped to the tenant context
// - Users can only see events from their tenant
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  organizerId: uuid('organizer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(), // URL-friendly event identifier
  shortCode: text('short_code').unique(), // Short memorable code for sharing (e.g., "helo", "party123")
  description: text('description'),
  eventType: eventTypeEnum('event_type').notNull().default('other'),
  eventDate: timestamp('event_date').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  location: text('location'),
  expectedGuests: integer('expected_guests'),
  customHashtag: text('custom_hashtag'),
  // JSONB field for flexible event configuration
  settings: jsonb('settings').$type<{
    theme: {
      primary_color: string;
      secondary_color: string;
      background: string;
      logo_url?: string;
      frame_template: string;
    };
    features: {
      photo_upload_enabled: boolean;
      lucky_draw_enabled: boolean;
      reactions_enabled: boolean;
      moderation_required: boolean;
      anonymous_allowed: boolean;
    };
    limits: {
      max_photos_per_user: number;
      max_total_photos: number;
      max_draw_entries: number;
    };
  }>().notNull().default(sql`'{}'::jsonb`),
  status: eventStatusEnum('status').notNull().default('draft'),
  qrCodeUrl: text('qr_code_url').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: each tenant can only have one event with a given slug
  eventTenantSlugUnique: unique('events_tenant_slug_key').on(table.tenantId, table.slug),
  // Composite index for tenant+slug lookup (most common query)
  eventOrganizerIdx: index('event_organizer_idx').on(table.organizerId),
  eventStatusIdx: index('event_status_idx').on(table.status),
  eventDateIdx: index('event_date_idx').on(table.eventDate),
}));

// ============================================
// PHOTOS TABLE
// ============================================

// Photo uploads with metadata and reactions
// Photos belong to events and are isolated via the event's tenant
//
// RLS Policy:
// - Photos are isolated by checking the event's tenant_id
// - Users can only see photos from events in their tenant
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userFingerprint: text('user_fingerprint').notNull(), // Hashed identifier for anonymous uploads
  // JSONB field for image URLs and metadata
  images: jsonb('images').$type<{
    original_url: string;
    thumbnail_url: string;
    medium_url: string;
    full_url: string;
    width: number;
    height: number;
    file_size: number;
    format: string;
  }>().notNull().default(sql`'{}'::jsonb`),
  caption: text('caption'),
  contributorName: text('contributor_name'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  status: photoStatusEnum('status').notNull().default('pending'),
  // JSONB field for reaction counters
  reactions: jsonb('reactions').$type<{
    heart: number;
    clap: number;
    laugh: number;
    wow: number;
  }>().notNull().default(sql`'{"heart": 0, "clap": 0, "laugh": 0, "wow": 0}'::jsonb`),
  // JSONB field for upload metadata
  metadata: jsonb('metadata').$type<{
    ip_address: string; // Hashed for privacy
    user_agent: string;
    upload_timestamp: Date;
    device_type: 'mobile' | 'tablet' | 'desktop';
  }>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
}, (table) => ({
  // Indexes for photo lookup optimization
  photoEventIdx: index('photo_event_idx').on(table.eventId),
  photoStatusIdx: index('photo_status_idx').on(table.status),
  photoCreatedAtIdx: index('photo_created_at_idx').on(table.createdAt),
}));

// ============================================
// PHOTO MODERATION LOGS
// ============================================

export const photoModerationLogs = pgTable('photo_moderation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  moderatorId: uuid('moderator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: moderationActionEnum('action').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  moderationLogEventIdx: index('moderation_log_event_idx').on(table.eventId),
  moderationLogPhotoIdx: index('moderation_log_photo_idx').on(table.photoId),
  moderationLogTenantIdx: index('moderation_log_tenant_idx').on(table.tenantId),
  moderationLogActionIdx: index('moderation_log_action_idx').on(table.action),
}));

// ============================================
// LUCKY DRAW TABLES
// ============================================

// Enums for lucky draw
export const drawStatusEnum = pgEnum('draw_status', ['scheduled', 'completed', 'cancelled']);
export const prizeTierEnum = pgEnum('prize_tier', ['grand', 'first', 'second', 'third', 'consolation']);

// ============================================
// LUCKY DRAW CONFIGURATIONS TABLE
// ============================================

/**
 * Stores draw configuration per event
 * Each event can have one active draw configuration
 * Supports multiple prize tiers, entry limits, and display settings
 */
export const luckyDrawConfigs = pgTable('lucky_draw_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),

  // Prize tiers configuration - JSONB array for flexibility
  prizeTiers: jsonb('prize_tiers').$type<Array<{
    tier: 'grand' | 'first' | 'second' | 'third' | 'consolation';
    name: string;           // "1st Prize", "Grand Prize"
    count: number;            // Number of winners for this tier
    description?: string;    // "iPhone 15", "Airpods"
  }>>().notNull().default(sql`'[]'::jsonb`),

  // Entry rules
  maxEntriesPerUser: integer('max_entries_per_user').notNull().default(1),
  requirePhotoUpload: boolean('require_photo_upload').notNull().default(true),

  // Duplicate prevention
  preventDuplicateWinners: boolean('prevent_duplicate_winners').notNull().default(true),

  // Draw timing
  scheduledAt: timestamp('scheduled_at'), // NULL = immediate draw
  status: drawStatusEnum('status').notNull().default('scheduled'),
  completedAt: timestamp('completed_at'),

  // Display settings
  animationStyle: text('animation_style').notNull().default('spinning_wheel'),
  animationDuration: integer('animation_duration').notNull().default(8), // seconds

  // Display options
  showSelfie: boolean('show_selfie').notNull().default(true),
  showFullName: boolean('show_full_name').notNull().default(true),
  playSound: boolean('play_sound').notNull().default(true),
  confettiAnimation: boolean('confetti_animation').notNull().default(true),

  // Total entries count (updated on entry creation)
  totalEntries: integer('total_entries').notNull().default(0),

  // Admin tracking
  createdBy: uuid('created_by').references(() => users.id),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  drawConfigEventIdx: index('draw_config_event_idx').on(table.eventId),
  drawConfigStatusIdx: index('draw_config_status_idx').on(table.status),
  drawConfigScheduledIdx: index('draw_config_scheduled_idx').on(table.scheduledAt),
}));

// ============================================
// LUCKY DRAW ENTRIES TABLE
// ============================================

/**
 * Individual lucky draw entries
 * Auto-created on photo upload or manually added
 * Links to both config (what draw this entry is for) and photo (what photo represents)
 */
export const luckyDrawEntries = pgTable('lucky_draw_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  configId: uuid('config_id').notNull().references(() => luckyDrawConfigs.id, { onDelete: 'cascade' }),

  // Link to photo that created this entry
  photoId: uuid('photo_id').references(() => photos.id, { onDelete: 'cascade' }),

  // User identification (reuse fingerprint pattern from photos)
  userFingerprint: text('user_fingerprint').notNull(),
  participantName: text('participant_name'),

  // Winner tracking
  isWinner: boolean('is_winner').notNull().default(false),
  prizeTier: prizeTierEnum('prize_tier'), // NULL if not winner

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for queries
  drawEntryConfigIdx: index('draw_entry_config_idx').on(table.configId),
  drawEntryEventIdx: index('draw_entry_event_idx').on(table.eventId),
  drawEntryPhotoIdx: index('draw_entry_photo_idx').on(table.photoId),
  drawEntryUserFingerprintIdx: index('draw_entry_user_fingerprint_idx').on(table.userFingerprint),
  drawEntryWinnerIdx: index('draw_entry_winner_idx').on(table.isWinner),
  // Prevent duplicate entries per photo per draw
  drawEntryConfigPhotoUnique: unique('draw_entry_config_photo_unique').on(table.configId, table.photoId),
}));

// ============================================
// WINNERS TABLE
// ============================================

/**
 * Track all winners across all draws
 * Supports prize tier tracking and winner notifications
 */
export const winners = pgTable('winners', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id').notNull().references(() => luckyDrawEntries.id, { onDelete: 'cascade' }),

  // Denormalized for quick access
  participantName: text('participant_name').notNull(),
  selfieUrl: text('selfie_url').notNull(),

  // Prize information
  prizeTier: prizeTierEnum('prize_tier').notNull(),
  prizeName: text('prize_name').notNull(),
  prizeDescription: text('prize_description'),

  // Selection order
  selectionOrder: integer('selection_order').notNull(),

  // Notification tracking
  isClaimed: boolean('is_claimed').notNull().default(false),
  notifiedAt: timestamp('notified_at'),

  // Admin notes
  notes: text('notes'),

  drawnAt: timestamp('drawn_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  winnerEventIdx: index('winner_event_idx').on(table.eventId),
  winnerDrawIdx: index('winner_draw_idx').on(table.entryId),
  winnerClaimedIdx: index('winner_claimed_idx').on(table.isClaimed),
}));

// ============================================
// PHOTO CHALLENGE TABLES
// ============================================

/**
 * Photo challenge configuration per event
 * Encourages guests to upload photos by offering a prize incentive
 */
export const photoChallenges = pgTable('photo_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),

  // Challenge configuration
  goalPhotos: integer('goal_photos').notNull().default(5),
  prizeTitle: text('prize_title').notNull(),
  prizeDescription: text('prize_description'),
  prizeTier: text('prize_tier'),

  // Settings
  enabled: boolean('enabled').notNull().default(true),
  autoGrant: boolean('auto_grant').notNull().default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  photoChallengeEventIdx: index('photo_challenge_event_idx').on(table.eventId),
}));

/**
 * Track individual guest progress toward photo challenge goal
 * One record per guest per event
 */
export const guestPhotoProgress = pgTable('guest_photo_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userFingerprint: text('user_fingerprint').notNull(),

  // Progress tracking
  photosUploaded: integer('photos_uploaded').notNull().default(0),
  photosApproved: integer('photos_approved').notNull().default(0),
  goalReached: boolean('goal_reached').notNull().default(false),

  // Prize claim tracking
  prizeClaimedAt: timestamp('prize_claimed_at'),
  prizeRevoked: boolean('prize_revoked').notNull().default(false),
  revokeReason: text('revoke_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  guestProgressEventIdx: index('guest_progress_event_idx').on(table.eventId),
  guestProgressUserFingerprintIdx: index('guest_progress_user_fingerprint_idx').on(table.userFingerprint),
  // Unique constraint: one progress record per guest per event
  guestProgressEventUserUnique: unique('guest_progress_event_user_key').on(table.eventId, table.userFingerprint),
}));

/**
 * Prize claim log for verification and revocation
 * Stores QR code tokens and claim history
 */
export const prizeClaims = pgTable('prize_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userFingerprint: text('user_fingerprint').notNull(),
  challengeId: uuid('challenge_id').references(() => photoChallenges.id),

  // QR code for prize claim
  qrCodeToken: text('qr_code_token').notNull().unique(),

  // Claim tracking
  claimedAt: timestamp('claimed_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
  revokeReason: text('revoke_reason'),
  verifiedBy: uuid('verified_by').references(() => users.id),

  // Additional metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes
  prizeClaimEventIdx: index('prize_claim_event_idx').on(table.eventId),
  prizeClaimQrCodeTokenIdx: index('prize_claim_qr_token_idx').on(table.qrCodeToken),
  prizeClaimEventUserUnique: unique('prize_claim_event_user_key').on(table.eventId, table.userFingerprint),
}));

// ============================================
// TYPE EXPORTS
// ============================================

// Infer TypeScript types from Drizzle schema
// These can be used throughout the application for type safety
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferSelect;
export type PhotoModerationLog = typeof photoModerationLogs.$inferSelect;
export type NewPhotoModerationLog = typeof photoModerationLogs.$inferInsert;
export type LuckyDrawConfig = typeof luckyDrawConfigs.$inferSelect;
export type NewLuckyDrawConfig = typeof luckyDrawConfigs.$inferInsert;
export type LuckyDrawEntry = typeof luckyDrawEntries.$inferSelect;
export type NewLuckyDrawEntry = typeof luckyDrawEntries.$inferInsert;
export type Winner = typeof winners.$inferSelect;
export type NewWinner = typeof winners.$inferInsert;
export type DrawStatus = typeof drawStatusEnum;
export type PrizeTier = typeof prizeTierEnum;
export type PhotoChallenge = typeof photoChallenges.$inferSelect;
export type NewPhotoChallenge = typeof photoChallenges.$inferInsert;
export type GuestPhotoProgress = typeof guestPhotoProgress.$inferSelect;
export type NewGuestPhotoProgress = typeof guestPhotoProgress.$inferInsert;
export type PrizeClaim = typeof prizeClaims.$inferSelect;
export type NewPrizeClaim = typeof prizeClaims.$inferInsert;

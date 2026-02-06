-- Migration: Photo Challenge Feature
-- Creates tables for photo challenge functionality

-- Photo challenges table
CREATE TABLE IF NOT EXISTS photo_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    goal_photos INTEGER NOT NULL DEFAULT 5,
    prize_title TEXT NOT NULL,
    prize_description TEXT,
    prize_tier TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_grant BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Guest photo progress table
CREATE TABLE IF NOT EXISTS guest_photo_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    user_fingerprint TEXT NOT NULL,
    photos_uploaded INTEGER NOT NULL DEFAULT 0,
    photos_approved INTEGER NOT NULL DEFAULT 0,
    goal_reached BOOLEAN NOT NULL DEFAULT false,
    prize_claimed_at TIMESTAMP WITH TIME ZONE,
    prize_revoked BOOLEAN NOT NULL DEFAULT false,
    revoke_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_fingerprint)
);

-- Prize claims table for QR code verification
CREATE TABLE IF NOT EXISTS prize_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    user_fingerprint TEXT NOT NULL,
    challenge_id TEXT,
    qr_code_token TEXT NOT NULL UNIQUE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT,
    verified_by TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_photo_challenges_event_id ON photo_challenges(event_id);
CREATE INDEX IF NOT EXISTS idx_photo_challenges_enabled ON photo_challenges(enabled);
CREATE INDEX IF NOT EXISTS idx_guest_photo_progress_event_id ON guest_photo_progress(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_photo_progress_user_fingerprint ON guest_photo_progress(user_fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_photo_progress_goal_reached ON guest_photo_progress(goal_reached);
CREATE INDEX IF NOT EXISTS idx_prize_claims_event_id ON prize_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_prize_claims_user_fingerprint ON prize_claims(user_fingerprint);
CREATE INDEX IF NOT EXISTS idx_prize_claims_qr_code_token ON prize_claims(qr_code_token);
CREATE INDEX IF NOT EXISTS idx_prize_claims_claimed_at ON prize_claims(claimed_at);

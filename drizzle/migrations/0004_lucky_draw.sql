-- ============================================
-- Galeria - Lucky Draw Migration
-- ============================================
-- Adds database tables for lucky draw functionality
-- Supports automatic entries on photo upload, configurable prize tiers, and winner tracking

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE draw_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE prize_tier AS ENUM ('grand', 'first', 'second', 'third', 'consolation');

-- ============================================
-- LUCKY DRAW CONFIGURATIONS TABLE
-- ============================================

CREATE TABLE lucky_draw_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Prize tiers configuration (JSONB array for flexibility)
  prize_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Entry rules
  max_entries_per_user INTEGER NOT NULL DEFAULT 1,
  require_photo_upload BOOLEAN NOT NULL DEFAULT true,

  -- Duplicate prevention
  prevent_duplicate_winners BOOLEAN NOT NULL DEFAULT true,

  -- Draw timing
  scheduled_for TIMESTAMP, -- NULL = immediate draw
  status draw_status NOT NULL DEFAULT 'scheduled',
  completed_at TIMESTAMP,

  -- Display settings
  animation_style TEXT NOT NULL DEFAULT 'spinning_wheel',
  animation_duration INTEGER NOT NULL DEFAULT 8,

  -- Display options
  show_selfie BOOLEAN NOT NULL DEFAULT true,
  show_full_name BOOLEAN NOT NULL DEFAULT true,
  play_sound BOOLEAN NOT NULL DEFAULT true,
  confetti_animation BOOLEAN NOT NULL DEFAULT true,

  -- Total entries count (updated on entry creation)
  total_entries INTEGER NOT NULL DEFAULT 0,

  -- Admin tracking
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LUCKY DRAW ENTRIES TABLE
-- ============================================

CREATE TABLE lucky_draw_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES lucky_draw_configs(id) ON DELETE CASCADE,

  -- Link to photo that created this entry
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,

  -- User identification (reuse fingerprint pattern)
  user_fingerprint TEXT NOT NULL,

  -- Winner tracking
  is_winner BOOLEAN NOT NULL DEFAULT false,
  prize_tier prize_tier, -- NULL if not winner

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WINNERS TABLE
-- ============================================

CREATE TABLE winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES lucky_draw_entries(id) ON DELETE CASCADE,

  -- Denormalized for quick access
  participant_name TEXT NOT NULL,
  selfie_url TEXT NOT NULL,

  -- Prize information
  prize_tier prize_tier NOT NULL,
  prize_name TEXT NOT NULL,
  prize_description TEXT,

  -- Selection order
  selection_order INTEGER NOT NULL,

  -- Notification tracking
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMP,

  -- Admin notes
  notes TEXT,

  drawn_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

-- Lucky draw configs indexes
CREATE INDEX draw_config_event_idx ON lucky_draw_configs(event_id);
CREATE INDEX draw_config_status_idx ON lucky_draw_configs(status);
CREATE INDEX draw_config_scheduled_idx ON lucky_draw_configs(scheduled_for);

-- Lucky draw entries indexes
CREATE INDEX draw_entry_config_idx ON lucky_draw_entries(config_id);
CREATE INDEX draw_entry_event_idx ON lucky_draw_entries(event_id);
CREATE INDEX draw_entry_photo_idx ON lucky_draw_entries(photo_id);
CREATE INDEX draw_entry_user_fingerprint_idx ON lucky_draw_entries(user_fingerprint);
CREATE INDEX draw_entry_winner_idx ON lucky_draw_entries(is_winner);

-- Prevent duplicate entries per user per config
CREATE UNIQUE INDEX draw_entry_config_fingerprint_unique
  ON lucky_draw_entries(config_id, user_fingerprint);

-- Winners indexes
CREATE INDEX winner_event_idx ON winners(event_id);
CREATE INDEX winner_draw_idx ON winners(entry_id);
CREATE INDEX winner_claimed_idx ON winners(is_claimed);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE lucky_draw_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lucky_draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see configs/entries/winners for their tenant's events
CREATE POLICY lucky_draw_configs_tenant_policy ON lucky_draw_configs
  FOR ALL USING (event_id IN (SELECT id FROM events WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

CREATE POLICY lucky_draw_entries_tenant_policy ON lucky_draw_entries
  FOR ALL USING (event_id IN (SELECT id FROM events WHERE tenant_id = current_setting('app.current_tid', true)::uuid));

CREATE POLICY winners_tenant_policy ON winners
  FOR ALL USING (event_id IN (SELECT id FROM events WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

-- Policy: Only admins can insert/update/delete configs
CREATE POLICY lucky_draw_configs_admin_policy ON lucky_draw_configs
  FOR INSERT WITH CHECK (true); -- Application layer verifies admin role

CREATE POLICY lucky_draw_entries_auto_policy ON lucky_draw_entries
  FOR INSERT WITH CHECK (true); -- Auto-created by photo uploads

-- ============================================
-- TRIGGERS
-- ============================================

-- Update total_entries count when entry is added
CREATE OR REPLACE FUNCTION update_total_entries() RETURNS TRIGGER AS $$
BEGIN
  UPDATE lucky_draw_configs
  SET total_entries = (
    SELECT COUNT(*)
    FROM lucky_draw_entries
    WHERE config_id = NEW.config_id
  )
  WHERE id = NEW.config_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_total_entries_trigger
AFTER INSERT ON lucky_draw_entries
FOR EACH ROW
EXECUTE FUNCTION update_total_entries();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get current tenant ID helper
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN NULL::uuid;
END;
$$ LANGUAGE plpgsql;

-- Set tenant context (called from application middleware)
CREATE OR REPLACE FUNCTION set_tenant_id(tenant_uuid UUID) RETURNS VOID AS $$
BEGIN
  PERFORM pg_set_config('app.current_tenant_id', tenant_uuid::text);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON TABLE lucky_draw_configs TO PUBLIC;
GRANT ALL ON TABLE lucky_draw_entries TO PUBLIC;
GRANT ALL ON TABLE winners TO PUBLIC;

COMMENT ON TABLE lucky_draw_configs IS 'Configuration for lucky draws per event';
COMMENT ON TABLE lucky_draw_entries IS 'Individual lucky draw entries linked to photos';
COMMENT ON TABLE winners IS 'Winners from all lucky draws';

-- Migration completed successfully

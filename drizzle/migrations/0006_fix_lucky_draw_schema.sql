-- ============================================
-- Galeria - Lucky Draw Schema Fixes
-- ============================================
-- Align column names and constraints with application logic.

-- Rename scheduled_for -> scheduled_at if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lucky_draw_configs'
      AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE lucky_draw_configs RENAME COLUMN scheduled_for TO scheduled_at;
  END IF;
END $$;

-- Rebuild scheduled index to match scheduled_at
DROP INDEX IF EXISTS draw_config_scheduled_idx;
CREATE INDEX IF NOT EXISTS draw_config_scheduled_at_idx
  ON lucky_draw_configs(scheduled_at);

-- Allow manual entries without photos
ALTER TABLE lucky_draw_entries
  ADD COLUMN IF NOT EXISTS participant_name TEXT;

ALTER TABLE lucky_draw_entries
  ALTER COLUMN photo_id DROP NOT NULL;

-- Allow multiple entries per user while preventing duplicate photo entries
DROP INDEX IF EXISTS draw_entry_config_fingerprint_unique;
CREATE UNIQUE INDEX IF NOT EXISTS draw_entry_config_photo_unique
  ON lucky_draw_entries(config_id, photo_id);

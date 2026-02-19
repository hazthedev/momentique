-- ============================================
-- Galeria - Add Short Code to Events
-- ============================================
-- Adds short_code column for memorable shareable links

-- Add short_code column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Add unique constraint on short_code
ALTER TABLE events ADD CONSTRAINT events_short_code_key UNIQUE (short_code);

-- Create index for fast lookups by short_code
CREATE INDEX IF NOT EXISTS events_short_code_idx ON events(short_code);

-- Add comment
COMMENT ON COLUMN events.short_code IS 'Short, memorable code for sharing events (e.g., "helo", "wedding-jane")';

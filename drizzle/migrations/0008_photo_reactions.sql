-- ============================================
-- Galeria - Migration 0008: Photo Reactions Table
-- ============================================
-- Adds photo_reactions table to track individual user reactions
-- Enables the max 10 reactions per user per photo feature

-- Create photo_reactions table
CREATE TABLE IF NOT EXISTS photo_reactions (
  id TEXT PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- 'user_xxx' for authenticated users, 'guest_xxx' for fingerprinted guests
  type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS photo_reactions_photo_idx ON photo_reactions(photo_id);
CREATE INDEX IF NOT EXISTS photo_reactions_user_idx ON photo_reactions(user_id);
CREATE INDEX IF NOT EXISTS photo_reactions_type_idx ON photo_reactions(type);

-- Composite index for the most common query (count per user per photo)
CREATE INDEX IF NOT EXISTS photo_reactions_photo_user_idx ON photo_reactions(photo_id, user_id);

-- Update migration version
INSERT INTO migration_version (version, description) VALUES (8, 'Add photo_reactions table for per-user reaction tracking')
ON CONFLICT (version) DO NOTHING;

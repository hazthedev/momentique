-- ============================================
-- MOMENTIQUE - Migration 0009: Photo Moderation Logs
-- ============================================
-- Adds moderation audit logging for photo approve/reject/delete actions

DO $$ BEGIN
  CREATE TYPE moderation_action AS ENUM ('approve', 'reject', 'delete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS photo_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action moderation_action NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_log_event_idx ON photo_moderation_logs(event_id);
CREATE INDEX IF NOT EXISTS moderation_log_photo_idx ON photo_moderation_logs(photo_id);
CREATE INDEX IF NOT EXISTS moderation_log_tenant_idx ON photo_moderation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS moderation_log_action_idx ON photo_moderation_logs(action);

ALTER TABLE photo_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY photo_moderation_logs_select_policy ON photo_moderation_logs
  FOR SELECT
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

CREATE POLICY photo_moderation_logs_insert_policy ON photo_moderation_logs
  FOR INSERT
  TO PUBLIC
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY photo_moderation_logs_delete_policy ON photo_moderation_logs
  FOR DELETE
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

INSERT INTO migration_version (version, description) VALUES (9, 'Add photo moderation audit logs')
ON CONFLICT (version) DO NOTHING;

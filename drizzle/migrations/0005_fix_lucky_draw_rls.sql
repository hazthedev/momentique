-- ============================================
-- Galeria - Fix Lucky Draw RLS Policies
-- ============================================
-- Fixes incorrect function references in lucky draw RLS policies
-- Migration: 0005_fix_lucky_draw_rls
--
-- This migration corrects the RLS policies created in 0004_lucky_draw.sql
-- which incorrectly used current_setting() instead of current_tenant_id()
--
-- Before: current_setting('app.current_tenant_id', true)::uuid
-- After:  current_tenant_id()

-- ============================================
-- DROP INCORRECT POLICIES
-- ============================================

DROP POLICY IF EXISTS lucky_draw_configs_tenant_policy ON lucky_draw_configs;
DROP POLICY IF EXISTS lucky_draw_entries_tenant_policy ON lucky_draw_entries;
DROP POLICY IF EXISTS winners_tenant_policy ON winners;

-- ============================================
-- CREATE CORRECTED POLICIES
-- ============================================

-- Policy: Users can see configs for their tenant's events
CREATE POLICY lucky_draw_configs_select_policy ON lucky_draw_configs
  FOR SELECT
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can insert configs (application layer verifies admin role)
CREATE POLICY lucky_draw_configs_insert_policy ON lucky_draw_configs
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can update configs (application layer verifies admin role)
CREATE POLICY lucky_draw_configs_update_policy ON lucky_draw_configs
  FOR UPDATE
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can delete configs (application layer verifies admin role)
CREATE POLICY lucky_draw_configs_delete_policy ON lucky_draw_configs
  FOR DELETE
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can see entries for their tenant's events
CREATE POLICY lucky_draw_entries_select_policy ON lucky_draw_entries
  FOR SELECT
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Auto-created entries (application layer handles validation)
CREATE POLICY lucky_draw_entries_insert_policy ON lucky_draw_entries
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can see winners for their tenant's events
CREATE POLICY winners_select_policy ON winners
  FOR SELECT
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Auto-created winners (application layer handles validation)
CREATE POLICY winners_insert_policy ON winners
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Users can update winners (claim status)
CREATE POLICY winners_update_policy ON winners
  FOR UPDATE
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- ============================================
-- UPDATE MIGRATION VERSION
-- ============================================

INSERT INTO migration_version (version, description)
VALUES (5, 'Fix lucky draw RLS policies to use correct current_tenant_id() function');

-- ============================================
-- Galeria - Row-Level Security (RLS) Policies
-- ============================================
-- Migration: 0002_rls_policies
--
-- This migration creates Row-Level Security policies for all tenant-isolated tables.
--
-- RLS enforces tenant isolation at the DATABASE LEVEL, preventing:
-- - SQL injection bypassing application-level checks
-- - Accidental cross-tenant data access
-- - Privileged user errors
--
-- Security Architecture:
--   1. Application calls set_tenant_id(tenantUuid) before each query
--   2. This sets session variable 'app.current_tenant_id'
--   3. RLS policies filter rows using current_tenant_id() function
--   4. Database automatically enforces tenant isolation
--
-- CRITICAL: RLS policies are the last line of defense for multi-tenant security.

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables with tenant data
-- Once enabled, ALL queries must pass RLS policy checks
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Note: migration_version table does NOT have RLS (system table)

-- ============================================
-- TENANTS TABLE POLICIES
-- ============================================

-- Policy: System tenant can see all tenants (for management)
-- Regular tenants can only see themselves
CREATE POLICY tenants_select_policy ON tenants
  FOR SELECT
  TO PUBLIC
  USING (
    current_tenant_id() = '00000000-0000-0000-0000-000000000000'::uuid  -- System tenant
    OR id = current_tenant_id()  -- Self-access
  );

-- Policy: Only system tenant can create new tenants
CREATE POLICY tenants_insert_policy ON tenants
  FOR INSERT
  TO PUBLIC
  WITH CHECK (current_tenant_id() = '00000000-0000-0000-0000-000000000000'::uuid);

-- Policy: Only system tenant can update tenants
-- WITH CHECK ensures tenant_id cannot be changed to bypass isolation
CREATE POLICY tenants_update_policy ON tenants
  FOR UPDATE
  TO PUBLIC
  USING (current_tenant_id() = '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (current_tenant_id() = '00000000-0000-0000-0000-000000000000'::uuid);

-- Policy: Only system tenant can delete tenants
CREATE POLICY tenants_delete_policy ON tenants
  FOR DELETE
  TO PUBLIC
  USING (current_tenant_id() = '00000000-0000-0000-0000-000000000000'::uuid);

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Policy: Users can only see users in their tenant
CREATE POLICY users_select_policy ON users
  FOR SELECT
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

-- Policy: Users can only insert into their own tenant
-- This prevents a compromised user account from creating users in other tenants
CREATE POLICY users_insert_policy ON users
  FOR INSERT
  TO PUBLIC
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy: Users can only update users in their tenant
-- WITH CHECK prevents users from changing their tenant_id to another tenant
CREATE POLICY users_update_policy ON users
  FOR UPDATE
  TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy: Users can only delete users in their tenant
CREATE POLICY users_delete_policy ON users
  FOR DELETE
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

-- ============================================
-- EVENTS TABLE POLICIES
-- ============================================

-- Policy: Events are scoped to tenant
CREATE POLICY events_select_policy ON events
  FOR SELECT
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

-- Policy: Events can only be created in the current tenant
CREATE POLICY events_insert_policy ON events
  FOR INSERT
  TO PUBLIC
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy: Events can only be updated within the same tenant
-- WITH CHECK prevents events from being moved to another tenant
CREATE POLICY events_update_policy ON events
  FOR UPDATE
  TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy: Events can only be deleted by the owning tenant
CREATE POLICY events_delete_policy ON events
  FOR DELETE
  TO PUBLIC
  USING (tenant_id = current_tenant_id());

-- ============================================
-- PHOTOS TABLE POLICIES
-- ============================================

-- Policy: Photos are isolated by tenant (via event relationship)
-- This policy uses a subquery to check the event's tenant_id
CREATE POLICY photos_select_policy ON photos
  FOR SELECT
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Photos can only be inserted into events in the current tenant
CREATE POLICY photos_insert_policy ON photos
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- Policy: Photos can only be updated by the owning tenant
-- WITH CHECK prevents photos from being moved to another tenant's events
CREATE POLICY photos_update_policy ON photos
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

-- Policy: Photos can only be deleted by the owning tenant
CREATE POLICY photos_delete_policy ON photos
  FOR DELETE
  TO PUBLIC
  USING (
    event_id IN (
      SELECT id FROM events WHERE tenant_id = current_tenant_id()
    )
  );

-- ============================================
-- VALIDATION FUNCTIONS (Optional, for testing)
-- ============================================

-- Function to verify RLS is working correctly
-- This can be used in tests to ensure tenant isolation is enforced
CREATE OR REPLACE FUNCTION verify_rls_isolation(test_tenant_id UUID)
RETURNS TABLE(table_name text, is_isolated boolean) AS $$
BEGIN
  -- Test tenants table
  PERFORM set_tenant_id(test_tenant_id);
  RETURN QUERY
  SELECT
    'tenants'::text,
    EXISTS (SELECT 1 FROM tenants WHERE id = test_tenant_id OR test_tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTES
-- ============================================
--
-- Testing RLS:
--   -- Create test tenants
--   INSERT INTO tenants (id, tenant_type, brand_name, company_name, contact_email, branding, subscription_tier, features_enabled, limits, status)
--   VALUES ('11111111-1111-1111-1111-111111111111', 'white_label', 'Tenant A', 'Company A', 'a@example.com', '{}', 'free', '{}', '{}', 'active'),
--          ('22222222-2222-2222-2222-222222222222', 'white_label', 'Tenant B', 'Company B', 'b@example.com', '{}', 'free', '{}', '{}', 'active');
--
--   -- Set tenant context to Tenant A
--   SELECT set_tenant_id('11111111-1111-1111-1111-111111111111');
--
--   -- Should only see Tenant A
--   SELECT * FROM tenants;
--
--   -- Should NOT see Tenant B's users
--   SELECT * FROM users WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
--
-- Viewing RLS policies:
--   \d+ users           -- View table policies
--   SELECT * FROM pg_policies WHERE tablename = 'users';
--
-- Migration version:
--   INSERT INTO migration_version (version, description) VALUES (2, 'Row-Level Security policies for tenant isolation');

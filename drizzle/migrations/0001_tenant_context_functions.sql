-- ============================================
-- Galeria - Tenant Context Functions
-- ============================================
-- Migration: 0001_tenant_context_functions
--
-- This migration creates the essential tenant context functions
-- required by the TenantDatabase class in lib/db.ts
--
-- CRITICAL: The set_tenant_id() function is called before EVERY query
-- by lib/db.ts:70 to establish tenant isolation via Row-Level Security.
--
-- Usage in application code:
--   await db.query('SELECT set_tenant_id($1)', [tenantId]);
--
-- RLS policies reference current_tenant_id() to filter rows.

-- ============================================
-- TENANT CONTEXT FUNCTION
-- ============================================

-- Set the tenant context for the current database session
-- This function is called by TenantDatabase.query() before each query
--
-- Parameters:
--   tenant_uuid: The UUID of the tenant to set as context
--
-- Behavior:
--   Sets a PostgreSQL session variable 'app.current_tenant_id'
--   This variable persists for the duration of the connection
--   It is automatically cleared when the connection returns to the pool
--
-- Security:
--   SECURITY DEFINER allows the function to set session variables
--   The tenant_id is validated against existing tenants by RLS policies
CREATE OR REPLACE FUNCTION set_tenant_id(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Get Current Tenant
-- ============================================

-- Get the current tenant ID from the session context
-- This function is used by RLS policies to filter rows
--
-- Returns:
--   The current tenant UUID, or NULL if not set
--
-- Usage in RLS policies:
--   USING (tenant_id = current_tenant_id())
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================
-- TRIGGER FUNCTION: Auto-update updated_at
-- ============================================

-- Automatically update the updated_at column on row modification
-- This trigger is attached to all tables with an updated_at column
--
-- Behavior:
--   Sets updated_at to CURRENT_TIMESTAMP before UPDATE
--   Requires the trigger to be created on each table
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- APPLY TRIGGERS TO TABLES
-- ============================================

-- Create triggers on tables that have updated_at columns
-- These triggers automatically update the updated_at timestamp

-- Tenants table
DROP TRIGGER IF EXISTS tenants_update_updated_at ON tenants;
CREATE TRIGGER tenants_update_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Users table
DROP TRIGGER IF EXISTS users_update_updated_at ON users;
CREATE TRIGGER users_update_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Events table
DROP TRIGGER IF EXISTS events_update_updated_at ON events;
CREATE TRIGGER events_update_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- NOTES
-- ============================================
--
-- Testing:
--   -- Set tenant context
--   SELECT set_tenant_id('123e4567-e89b-12d3-a456-426614174000');
--
--   -- Get current tenant
--   SELECT current_tenant_id();
--
--   -- Clear tenant context (for testing only)
--   -- SELECT set_config('app.current_tenant_id', '', false);
--
-- Migration version:
--   INSERT INTO migration_version (version, description) VALUES (1, 'Tenant context functions and triggers');

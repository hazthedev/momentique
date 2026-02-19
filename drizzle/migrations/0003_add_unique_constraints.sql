-- ============================================
-- Galeria - Unique Constraints Migration
-- ============================================
-- Migration: 0003_add_unique_constraints
--
-- This migration adds unique constraints to prevent data integrity issues.
--
-- Changes:
--   1. Add unique constraint on (tenant_id, email) for users table
--   2. Add unique constraint on (tenant_id, slug) for events table
--
-- Rationale:
--   - Multiple users in the same tenant cannot have the same email
--   - Multiple events in the same tenant cannot have the same slug
--   - These constraints work together with RLS to enforce tenant-scoped uniqueness

-- ============================================
-- USERS TABLE: Unique Email per Tenant
-- ============================================

-- Drop existing index if it exists (for idempotency)
DROP INDEX IF EXISTS user_tenant_email_idx CASCADE;

-- Add unique constraint on tenant_id + email combination
-- This ensures each tenant can only have one user with a given email
ALTER TABLE users
  ADD CONSTRAINT users_tenant_email_key
  UNIQUE (tenant_id, email);

-- ============================================
-- EVENTS TABLE: Unique Slug per Tenant
-- ============================================

-- Drop existing index if it exists (for idempotency)
DROP INDEX IF EXISTS event_tenant_slug_idx CASCADE;

-- Add unique constraint on tenant_id + slug combination
-- This ensures each tenant can only have one event with a given slug
ALTER TABLE events
  ADD CONSTRAINT events_tenant_slug_key
  UNIQUE (tenant_id, slug);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify constraints were created successfully
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conname IN ('users_tenant_email_key', 'events_tenant_slug_key');

-- Expected output:
-- constraint_name              | constraint_type
--------------------------------+---------------
-- users_tenant_email_key       | u
-- events_tenant_slug_key       | u

-- ============================================
-- NOTES
-- ============================================
--
-- Impact on Application Code:
--   - INSERT operations that violate uniqueness will now fail
--   - Application code should catch unique constraint violations
--   - Error code for unique violation: 23505 (unique_violation)
--
-- Migration version:
--   UPDATE migration_version SET version = 3, description = 'Added unique constraints for tenant-scoped uniqueness';

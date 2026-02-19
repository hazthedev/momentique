-- ============================================
-- Galeria - Seed Default Tenants
-- ============================================
-- Migration: 0007_seed_default_tenants
--
-- Ensures the system and default tenant rows exist.
-- Required for Phase 2 auth flows that assume a default tenant.

INSERT INTO tenants (
  id,
  tenant_type,
  brand_name,
  company_name,
  contact_email,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'master',
  'Galeria System',
  'Galeria',
  'system@galeria.local',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (
  id,
  tenant_type,
  brand_name,
  company_name,
  contact_email,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'white_label',
  'Default Tenant',
  'Default Tenant',
  'admin@galeria.local',
  'active'
)
ON CONFLICT (id) DO NOTHING;

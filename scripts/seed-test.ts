// ============================================
// GALERIA - Test Seed Data (CI/CD)
// ============================================
// This script creates predictable data for automated testing.
//
// Usage:
//   NODE_ENV=test npm run db:seed:test
//
// Environment Protection:
//   This script only runs in NODE_ENV=test
//
// Data Created:
//   - Deterministic UUIDs (generated from test names)
//   - Predictable user credentials
//   - Test events with known dates
//   - Photos with deterministic URLs

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

// Only run in test environment
if (process.env.NODE_ENV !== 'test') {
  console.error('[SEED:TEST] ERROR: This script only runs in NODE_ENV=test');
  console.error('[SEED:TEST] Set NODE_ENV=test to run this script.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria_test';

// ============================================
// DETERMINISTIC UUID GENERATION
// ============================================

// Generate a UUID v5 (deterministic from a namespace and name)
// This ensures the same data is created every time
function deterministicUUID(namespace: string, name: string): string {
  // SHA-1 hash of namespace + name
  const hash = crypto.createHash('sha1')
    .update(`${namespace}-${name}`)
    .digest('hex');

  // Format as UUID (version 5)
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16), // Version 5
    '8' + hash.substring(17, 20), // Variant
    hash.substring(20, 32)
  ].join('-');
}

// Namespace for test UUIDs (RFC 4122 compliant)
const TEST_NAMESPACE = '9a5b7c8d-1e2f-3a4b-5c6d-7e8f9a0b1c2d';

// ============================================
// TEST DATA (Deterministic)
// ============================================

const testTenantId = deterministicUUID(TEST_NAMESPACE, 'test-tenant');
const testUserId = deterministicUUID(TEST_NAMESPACE, 'test-user');
const testEventId = deterministicUUID(TEST_NAMESPACE, 'test-event');

const testTenant = {
  id: testTenantId,
  tenant_type: 'white_label',
  brand_name: 'Test Organization',
  company_name: 'Test Org',
  contact_email: 'test@example.com',
  branding: {
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
  },
  subscription_tier: 'free',
  features_enabled: {
    lucky_draw: true,
    photo_reactions: true,
    video_uploads: false,
    custom_templates: false,
    api_access: false,
    sso: false,
    white_label: false,
    advanced_analytics: false,
  },
  limits: {
    max_events_per_month: 10,
    max_storage_gb: 5,
    max_admins: 2,
    max_photos_per_event: 100,
    max_draw_entries_per_event: 50,
    custom_features: [],
  },
  status: 'active',
};

const testUser = {
  id: testUserId,
  tenant_id: testTenantId,
  email: 'test@example.com',
  password: 'test123', // For testing only
  name: 'Test User',
  role: 'admin',
};

const testEvent = {
  id: testEventId,
  tenant_id: testTenantId,
  organizer_id: testUserId,
  name: 'Test Event',
  slug: 'test-event',
  event_type: 'other',
  event_date: new Date('2025-01-01T12:00:00Z'),
  timezone: 'UTC',
  status: 'active',
  qr_code_url: 'https://test.galeria.com/test-event/qr',
};

const testPhotos = Array.from({ length: 5 }, (_, i) => ({
  id: deterministicUUID(TEST_NAMESPACE, `test-photo-${i}`),
  event_id: testEventId,
  index: i + 1,
}));

// ============================================
// SEED FUNCTION
// ============================================

async function seedTest() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('[SEED:TEST] Starting test seed...');
    console.log('[SEED:TEST] Database:', connectionString);

    await client.query('BEGIN');

    // Disable RLS temporarily for seeding
    await client.query('SET session_replication_role = replica;');

    // ============================================
    // CREATE TEST TENANT
    // ============================================
    console.log('[SEED:TEST] Creating test tenant...');

    await client.query(`
      INSERT INTO tenants (
        id, tenant_type, brand_name, company_name, contact_email,
        branding, subscription_tier, features_enabled, limits, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        status = EXCLUDED.status
    `, [
      testTenant.id,
      testTenant.tenant_type,
      testTenant.brand_name,
      testTenant.company_name,
      testTenant.contact_email,
      JSON.stringify(testTenant.branding),
      testTenant.subscription_tier,
      JSON.stringify(testTenant.features_enabled),
      JSON.stringify(testTenant.limits),
      testTenant.status,
    ]);

    // ============================================
    // CREATE TEST USER
    // ============================================
    console.log('[SEED:TEST] Creating test user...');

    const passwordHash = await bcrypt.hash(testUser.password, 12);

    await client.query(`
      INSERT INTO users (
        id, tenant_id, email, password_hash, name, role, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name
    `, [
      testUser.id,
      testUser.tenant_id,
      testUser.email,
      passwordHash,
      testUser.name,
      testUser.role,
      true,
    ]);

    // ============================================
    // CREATE TEST EVENT
    // ============================================
    console.log('[SEED:TEST] Creating test event...');

    await client.query(`
      INSERT INTO events (
        id, tenant_id, organizer_id, name, slug, event_type,
        event_date, timezone, status, qr_code_url, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status
    `, [
      testEvent.id,
      testEvent.tenant_id,
      testEvent.organizer_id,
      testEvent.name,
      testEvent.slug,
      testEvent.event_type,
      testEvent.event_date,
      testEvent.timezone,
      testEvent.status,
      testEvent.qr_code_url,
      JSON.stringify({
        theme: {
          primary_color: '#000000',
          secondary_color: '#FFFFFF',
          background: '#F5F5F5',
          frame_template: 'default',
        },
        features: {
          photo_upload_enabled: true,
          lucky_draw_enabled: true,
          reactions_enabled: true,
          moderation_required: false,
          anonymous_allowed: true,
        },
        limits: {
          max_photos_per_user: 100,
          max_total_photos: 500,
          max_draw_entries: 100,
        },
      }),
    ]);

    // ============================================
    // CREATE TEST PHOTOS
    // ============================================
    console.log('[SEED:TEST] Creating test photos...');

    for (const photo of testPhotos) {
      await client.query(`
        INSERT INTO photos (
          id, event_id, user_fingerprint, images, caption, status,
          reactions, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        photo.id,
        photo.event_id,
        'test-fingerprint',
        JSON.stringify({
          original_url: `https://example.com/photo-${photo.index}.jpg`,
          thumbnail_url: `https://example.com/photo-${photo.index}-thumb.jpg`,
          medium_url: `https://example.com/photo-${photo.index}-medium.jpg`,
          full_url: `https://example.com/photo-${photo.index}-full.jpg`,
          width: 1920,
          height: 1080,
          file_size: 524288,
          format: 'jpg',
        }),
        `Test photo ${photo.index}`,
        'approved',
        JSON.stringify({ heart: photo.index, clap: 0, laugh: 0, wow: 0 }),
        JSON.stringify({
          ip_address: 'test-ip-hash',
          user_agent: 'test-agent',
          upload_timestamp: new Date('2025-01-01T12:00:00Z'),
          device_type: 'desktop',
        }),
      ]);
    }

    // Re-enable RLS
    await client.query('SET session_replication_role = DEFAULT;');

    await client.query('COMMIT');

    console.log('[SEED:TEST] ✅ Test seed completed successfully!');
    console.log('[SEED:TEST] Summary:');
    console.log(`[SEED:TEST]   - Tenant ID: ${testTenantId}`);
    console.log(`[SEED:TEST]   - User ID: ${testUserId}`);
    console.log(`[SEED:TEST]   - Event ID: ${testEventId}`);
    console.log(`[SEED:TEST]   - Photos: ${testPhotos.length}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SEED:TEST] ❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ============================================
// RUN SEED
// ============================================

seedTest()
  .then(() => {
    console.log('[SEED:TEST] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SEED:TEST] Fatal error:', error);
    process.exit(1);
  });

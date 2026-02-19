// ============================================
// GALERIA - Development Seed Data
// ============================================
// This script creates sample data for development and testing.
//
// Usage:
//   npm run db:seed
//
// Environment Protection:
//   This script will NOT run in production (NODE_ENV=production)
//
// Data Created:
//   - 1 tenant: "Acme Corporation" (slug: acme)
//   - 1 admin user: admin@acme.com / password123 (hashed)
//   - 2-3 sample events with dates
//   - 10-15 sample photos from placeholder service

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

// Environment protection - refuse to seed production
if (process.env.NODE_ENV === 'production') {
  console.error('[SEED] ERROR: Cannot seed production database!');
  console.error('[SEED] Set NODE_ENV=development to run seed script.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

// ============================================
// SEED DATA
// ============================================

// Generate a UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

// Acme Corporation Tenant
const acmeTenantId = generateUUID();
const acmeTenant = {
  id: acmeTenantId,
  tenant_type: 'white_label',
  brand_name: 'Acme Corporation',
  company_name: 'Acme Corp',
  contact_email: 'admin@acme.com',
  support_email: 'support@acme.com',
  phone: '+1-555-0123',
  domain: null,
  subdomain: 'acme',
  is_custom_domain: false,
  branding: {
    primary_color: '#FF5722',
    secondary_color: '#FF9800',
    accent_color: '#FFC107',
  },
  subscription_tier: 'pro',
  features_enabled: {
    lucky_draw: true,
    photo_reactions: true,
    video_uploads: false,
    custom_templates: true,
    api_access: false,
    sso: false,
    white_label: false,
    advanced_analytics: true,
  },
  limits: {
    max_events_per_month: 50,
    max_storage_gb: 100,
    max_admins: 5,
    max_photos_per_event: 1000,
    max_draw_entries_per_event: 500,
    custom_features: [],
  },
  status: 'active',
};

// Admin User for Acme
const adminUserId = generateUUID();
const adminPassword = 'password123'; // CHANGE IN PRODUCTION!

// Events for Acme
const event1Id = generateUUID();
const event2Id = generateUUID();
const event3Id = generateUUID();

const events = [
  {
    id: event1Id,
    tenant_id: acmeTenantId,
    organizer_id: adminUserId,
    name: 'Annual Company Party 2025',
    slug: 'acme-annual-party-2025',
    description: 'Join us for our biggest celebration of the year!',
    event_type: 'corporate',
    event_date: new Date('2025-06-15T18:00:00Z'),
    timezone: 'America/New_York',
    location: 'Acme Headquarters, 123 Business Ave',
    expected_guests: 150,
    custom_hashtag: '#AcmeParty2025',
    status: 'active',
    qr_code_url: `https://acme.galeria.com/events/${event1Id}/qr`,
  },
  {
    id: event2Id,
    tenant_id: acmeTenantId,
    organizer_id: adminUserId,
    name: 'Product Launch Event',
    slug: 'acme-product-launch',
    description: 'Launching our revolutionary new product!',
    event_type: 'corporate',
    event_date: new Date('2025-04-20T14:00:00Z'),
    timezone: 'America/Los_Angeles',
    location: 'Tech Center, San Francisco',
    expected_guests: 200,
    custom_hashtag: '#AcmeLaunch',
    status: 'active',
    qr_code_url: `https://acme.galeria.com/events/${event2Id}/qr`,
  },
  {
    id: event3Id,
    tenant_id: acmeTenantId,
    organizer_id: adminUserId,
    name: 'Team Building Retreat',
    slug: 'acme-team-retreat',
    description: 'A fun day of activities and team building.',
    event_type: 'other',
    event_date: new Date('2025-05-10T09:00:00Z'),
    timezone: 'America/Chicago',
    location: 'Mountain View Resort',
    expected_guests: 50,
    custom_hashtag: '#AcmeRetreat',
    status: 'draft',
    qr_code_url: `https://acme.galeria.com/events/${event3Id}/qr`,
  },
];

// Sample Photos
const photos = [
  // Event 1 photos (5 photos)
  { id: generateUUID(), event_id: event1Id, index: 1 },
  { id: generateUUID(), event_id: event1Id, index: 2 },
  { id: generateUUID(), event_id: event1Id, index: 3 },
  { id: generateUUID(), event_id: event1Id, index: 4 },
  { id: generateUUID(), event_id: event1Id, index: 5 },
  // Event 2 photos (6 photos)
  { id: generateUUID(), event_id: event2Id, index: 1 },
  { id: generateUUID(), event_id: event2Id, index: 2 },
  { id: generateUUID(), event_id: event2Id, index: 3 },
  { id: generateUUID(), event_id: event2Id, index: 4 },
  { id: generateUUID(), event_id: event2Id, index: 5 },
  { id: generateUUID(), event_id: event2Id, index: 6 },
  // Event 3 photos (4 photos)
  { id: generateUUID(), event_id: event3Id, index: 1 },
  { id: generateUUID(), event_id: event3Id, index: 2 },
  { id: generateUUID(), event_id: event3Id, index: 3 },
  { id: generateUUID(), event_id: event3Id, index: 4 },
];

// ============================================
// SEED FUNCTION
// ============================================

async function seedDevelopment() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('[SEED] Starting development seed...');
    console.log('[SEED] Database:', connectionString);

    await client.query('BEGIN');

    // Disable RLS temporarily for seeding
    await client.query('SET session_replication_role = replica;');

    // ============================================
    // CREATE TENANT
    // ============================================
    console.log('[SEED] Creating tenant: Acme Corporation...');

    await client.query(`
      INSERT INTO tenants (
        id, tenant_type, brand_name, company_name, contact_email, support_email, phone,
        domain, subdomain, is_custom_domain,
        branding, subscription_tier, features_enabled, limits, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO NOTHING
    `, [
      acmeTenant.id,
      acmeTenant.tenant_type,
      acmeTenant.brand_name,
      acmeTenant.company_name,
      acmeTenant.contact_email,
      acmeTenant.support_email,
      acmeTenant.phone,
      acmeTenant.domain,
      acmeTenant.subdomain,
      acmeTenant.is_custom_domain,
      JSON.stringify(acmeTenant.branding),
      acmeTenant.subscription_tier,
      JSON.stringify(acmeTenant.features_enabled),
      JSON.stringify(acmeTenant.limits),
      acmeTenant.status,
    ]);

    // ============================================
    // CREATE ADMIN USER
    // ============================================
    console.log('[SEED] Creating admin user: admin@acme.com...');

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(`
      INSERT INTO users (
        id, tenant_id, email, password_hash, name, role, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `, [
      adminUserId,
      acmeTenantId,
      'admin@acme.com',
      passwordHash,
      'Admin User',
      'admin',
      true,
    ]);

    console.log('[SEED] Admin credentials: admin@acme.com / password123');

    // ============================================
    // CREATE EVENTS
    // ============================================
    console.log('[SEED] Creating events...');

    for (const event of events) {
      await client.query(`
        INSERT INTO events (
          id, tenant_id, organizer_id, name, slug, description, event_type,
          event_date, timezone, location, expected_guests, custom_hashtag,
          settings, status, qr_code_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO NOTHING
      `, [
        event.id,
        event.tenant_id,
        event.organizer_id,
        event.name,
        event.slug,
        event.description,
        event.event_type,
        event.event_date,
        event.timezone,
        event.location,
        event.expected_guests,
        event.custom_hashtag,
        JSON.stringify({
          theme: {
            primary_color: '#FF5722',
            secondary_color: '#FF9800',
            background: '#F5F5F5',
            frame_template: 'default',
          },
          features: {
            photo_upload_enabled: true,
            lucky_draw_enabled: true,
            reactions_enabled: true,
            moderation_required: true,
            anonymous_allowed: true,
          },
          limits: {
            max_photos_per_user: 10,
            max_total_photos: 500,
            max_draw_entries: 100,
          },
        }),
        event.status,
        event.qr_code_url,
      ]);
    }

    // ============================================
    // CREATE PHOTOS
    // ============================================
    console.log('[SEED] Creating photos...');

    for (const photo of photos) {
      await client.query(`
        INSERT INTO photos (
          id, event_id, user_fingerprint, images, caption, contributor_name,
          is_anonymous, status, reactions, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        photo.id,
        photo.event_id,
        crypto.createHash('sha256').update(`seed_user_${photo.index}`).digest('hex'),
        JSON.stringify({
          original_url: `https://picsum.photos/seed/${photo.id}/1920/1080`,
          thumbnail_url: `https://picsum.photos/seed/${photo.id}/200/200`,
          medium_url: `https://picsum.photos/seed/${photo.id}/800/600`,
          full_url: `https://picsum.photos/seed/${photo.id}/1920/1080`,
          width: 1920,
          height: 1080,
          file_size: 524288,
          format: 'jpg',
        }),
        `Sample photo ${photo.index} from Picsum`,
        photo.index % 3 === 0 ? null : `Team Member ${photo.index}`,
        photo.index % 3 === 0, // Every 3rd photo is anonymous
        photo.index % 5 === 0 ? 'pending' : 'approved', // Every 5th photo needs moderation
        JSON.stringify({ heart: photo.index, clap: Math.floor(photo.index / 2), laugh: 0, wow: 0 }),
        JSON.stringify({
          ip_address: crypto.createHash('sha256').update(`127.0.0.${photo.index}`).digest('hex'),
          user_agent: 'Mozilla/5.0 (Seed Script)',
          upload_timestamp: new Date(),
          device_type: 'desktop',
        }),
      ]);
    }

    // Re-enable RLS
    await client.query('SET session_replication_role = DEFAULT;');

    await client.query('COMMIT');

    console.log('[SEED] ✅ Development seed completed successfully!');
    console.log('[SEED] Summary:');
    console.log(`[SEED]   - 1 tenant (Acme Corporation)`);
    console.log(`[SEED]   - 1 admin user (admin@acme.com)`);
    console.log(`[SEED]   - ${events.length} events`);
    console.log(`[SEED]   - ${photos.length} photos`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SEED] ❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ============================================
// RUN SEED
// ============================================

seedDevelopment()
  .then(() => {
    console.log('[SEED] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SEED] Fatal error:', error);
    process.exit(1);
  });

// ============================================
// Galeria - Quick Reset & Admin Creation
// ============================================

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Admin credentials
const ADMIN_EMAIL = 'admin@galeria.com';
const ADMIN_PASSWORD = 'admin123';

// Use the same tenant ID that middleware injects for local development
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function resetAndCreateAdmin() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('[RESET] Starting database reset...');

    await client.query('BEGIN');

    // Disable RLS temporarily
    await client.query('SET session_replication_role = replica;');

    // Delete all data from tables in correct order (respecting foreign keys)
    const tables = [
      'winners',
      'lucky_draw_entries',
      'lucky_draw_configs',
      'photos',
      'events',
      'users',
      'tenants',
    ];

    for (const table of tables) {
      const result = await client.query(`DELETE FROM ${table};`);
      console.log(`[RESET] Deleted from ${table}: ${result.rowCount} rows`);
    }

    // Reset migration version
    await client.query('UPDATE migration_version SET version = 7;');
    console.log('[RESET] Reset migration version to 7');

    // ============================================
    // CREATE DEFAULT TENANT
    // ============================================
    // Use the same tenant ID that middleware injects for local development
    const tenantId = TENANT_ID;

    await client.query(`
      INSERT INTO tenants (
        id, tenant_type, brand_name, company_name, contact_email, support_email,
        domain, subdomain, is_custom_domain, branding, subscription_tier,
        features_enabled, limits, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      tenantId,
      'master',
      'Galeria',
      'Galeria',
      ADMIN_EMAIL,
      'support@galeria.com',
      null,
      'galeria',
      false,
      JSON.stringify({
        primary_color: '#8B5CF6',
        secondary_color: '#EC4899',
        accent_color: '#F59E0B',
      }),
      'premium',
      JSON.stringify({
        lucky_draw: true,
        photo_reactions: true,
        video_uploads: true,
        custom_templates: true,
        api_access: true,
        sso: true,
        white_label: true,
        advanced_analytics: true,
      }),
      JSON.stringify({
        max_events_per_month: 1000,
        max_storage_gb: 1000,
        max_admins: 100,
        max_photos_per_event: 10000,
        max_draw_entries_per_event: 5000,
        custom_features: [],
      }),
      'active',
    ]);

    console.log('[RESET] Created default tenant');

    // ============================================
    // CREATE ADMIN USER
    // ============================================
    const adminId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await client.query(`
      INSERT INTO users (
        id, tenant_id, email, password_hash, name, role, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      adminId,
      tenantId,
      ADMIN_EMAIL,
      passwordHash,
      'Administrator',
      'supervisor',
      true,
    ]);

    console.log('[RESET] Created admin user');

    // Re-enable RLS
    await client.query('SET session_replication_role = DEFAULT;');

    await client.query('COMMIT');

    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           DATABASE RESET COMPLETED ✅                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 ADMIN CREDENTIALS:');
    console.log('   Email:    ' + ADMIN_EMAIL);
    console.log('   Password: ' + ADMIN_PASSWORD);
    console.log('');
    console.log('   Use these to log in at: http://localhost:3000/auth/login');
    console.log('');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[RESET] Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndCreateAdmin()
  .then(() => {
    console.log('[RESET] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[RESET] Fatal error:', error);
    process.exit(1);
  });

// ============================================
// Galeria - Database Reset (Development Only)
// ============================================
// This script drops and recreates the database, then runs migrations and seeds.
//
// ⚠️  WARNING: This will DELETE ALL DATA! Use only in development!
//
// Usage:
//   npm run db:reset
//
// Environment Protection:
//   This script will NOT run in production (NODE_ENV=production)
//
// Steps:
//   1. Drop all tables and sequences
//   2. Re-run migrations
//   3. Seed development data
//   4. Verify setup

import 'dotenv/config'; // Load .env file
import { Pool } from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ============================================
// CONFIGURATION
// ============================================

// Environment protection - refuse to reset production
if (process.env.NODE_ENV === 'production') {
  console.error('[RESET] ERROR: Cannot reset production database!');
  console.error('[RESET] This script only runs in development/test mode.');
  console.error('[RESET] Set NODE_ENV=development to run reset script.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

// ============================================
// DROP ALL TABLES
// ============================================

async function dropAllTables(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('[RESET] Dropping all tables...');

    // Drop all tables in the correct order (respecting foreign keys)
    const tables = [
      'photos',
      'lucky_draw_entries',
      'lucky_draw_configs',
      'winners',
      'webhooks',
      'export_jobs',
      'events',
      'users',
      'tenants',
      'migration_version',
    ];

    // Disable RLS and foreign key checks temporarily
    await client.query('SET session_replication_role = replica;');

    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`[RESET]   Dropped table: ${table}`);
      } catch (error) {
        // Ignore errors for tables that don't exist
        console.log(`[RESET]   Skipped table: ${table} (doesn't exist)`);
      }
    }

    // Drop enums
    const enums = [
      'device_type',
      'draw_status',
      'event_status',
      'event_type',
      'photo_status',
      'prize_tier',
      'subscription_tier',
      'tenant_status',
      'tenant_type',
      'user_role',
    ];

    for (const enumType of enums) {
      try {
        await client.query(`DROP TYPE IF EXISTS ${enumType} CASCADE;`);
        console.log(`[RESET]   Dropped enum: ${enumType}`);
      } catch (error) {
        // Ignore errors
      }
    }

    // Re-enable RLS
    await client.query('SET session_replication_role = DEFAULT;');

    console.log('[RESET] ✅ All tables dropped successfully');

  } finally {
    client.release();
  }
}

// ============================================
// RUN MIGRATIONS
// ============================================

async function runMigrations(): Promise<void> {
  console.log('[RESET] Running migrations...');

  const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('[RESET] ERROR: Migrations directory not found:', migrationsDir);
    throw new Error('Migrations directory not found');
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[RESET] Found ${migrationFiles.length} migration files`);

  const pool = new Pool({ connectionString });

  for (const file of migrationFiles) {
    console.log(`[RESET]   Running migration: ${file}`);

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      await pool.query(sql);
      console.log(`[RESET]     ✅ ${file} completed`);
    } catch (error) {
      console.error(`[RESET]     ❌ ${file} failed:`, error);
      throw error;
    }
  }

  await pool.end();

  // Initialize migration version
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO migration_version (version, description) VALUES (2, \'Migrations applied via reset script\') ON CONFLICT (version) DO NOTHING;');
  } finally {
    client.release();
  }

  console.log('[RESET] ✅ All migrations completed');
}

// ============================================
// SEED DEVELOPMENT DATA
// ============================================

async function seedDevelopmentData(): Promise<void> {
  console.log('[RESET] Seeding development data...');

  try {
    // Run the seed-development.ts script
    const seedScript = path.join(process.cwd(), 'scripts', 'seed-development.ts');
    execSync(`npx tsx "${seedScript}"`, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    console.log('[RESET] ✅ Development data seeded');
  } catch (error) {
    console.error('[RESET] ❌ Seed failed:', error);
    throw error;
  }
}

// ============================================
// VERIFY SETUP
// ============================================

async function verifySetup(): Promise<void> {
  console.log('[RESET] Verifying database setup...');

  const pool = new Pool({ connectionString });

  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = result.rows.map(r => r.table_name);
    const expectedTables = ['events', 'migration_version', 'photos', 'tenants', 'users'];

    console.log('[RESET] Tables found:', tables.join(', '));

    const missingTables = expectedTables.filter(t => !tables.includes(t));
    if (missingTables.length > 0) {
      console.error('[RESET] ❌ Missing tables:', missingTables.join(', '));
      throw new Error('Database verification failed: missing tables');
    }

    // Check if RLS is enabled
    const rlsResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'events', 'photos')
      AND relrowsecurity = true
    `);

    const rlsTables = rlsResult.rows.map(r => r.tablename);
    console.log('[RESET] RLS enabled on:', rlsTables.join(', '));

    // Check if set_tenant_id function exists
    const funcResult = await pool.query(`
      SELECT 1
      FROM pg_proc
      WHERE proname = 'set_tenant_id'
    `);

    if (funcResult.rowCount === 0) {
      console.error('[RESET] ❌ set_tenant_id() function not found!');
      throw new Error('Database verification failed: set_tenant_id function missing');
    }

    console.log('[RESET] ✅ Database verification passed');

  } finally {
    await pool.end();
  }
}

// ============================================
// MAIN RESET FUNCTION
// ============================================

async function resetDatabase() {
  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Galeria DATABASE RESET (DEVELOPMENT ONLY)       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('[RESET] ⚠️  WARNING: This will DELETE ALL DATA!');
  console.log('[RESET] Database:', connectionString);
  console.log('[RESET] Environment:', process.env.NODE_ENV || 'development');
  console.log('');

  const pool = new Pool({ connectionString });

  try {
    // Step 1: Drop all tables
    await dropAllTables(pool);

    // Step 2: Run migrations
    await runMigrations();

    // Step 3: Seed development data
    await seedDevelopmentData();

    // Step 4: Verify setup
    await verifySetup();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log(`║     DATABASE RESET COMPLETED IN ${duration}s             ║`);
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('[RESET] You can now start the development server:');
    console.log('[RESET]   npm run dev');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║              DATABASE RESET FAILED ❌                  ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('[RESET] Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============================================
// RUN RESET
// ============================================

resetDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[RESET] Fatal error:', error);
    process.exit(1);
  });

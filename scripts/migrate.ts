// ============================================
// Galeria - Database Migration Runner
// ============================================
// This script applies pending database migrations.
//
// Usage:
//   npm run db:migrate
//
// Features:
//   - Runs all pending migrations in order
//   - Tracks migration version in migration_version table
//   - Supports rollback
//   - Provides detailed logging

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

// ============================================
// GET CURRENT MIGRATION VERSION
// ============================================

async function getCurrentVersion(pool: Pool): Promise<number> {
  try {
    const result = await pool.query('SELECT MAX(version) as version FROM migration_version');
    const version = result.rows[0]?.version;
    if (version === null || version === undefined) {
      return -1;
    }
    return Number(version);
  } catch (error: unknown) {
    // Table doesn't exist, return 0
    if ((error as { code?: string }).code === '42P01') { // undefined_table
      return -1;
    }
    throw error;
  }
}

// ============================================
// SET MIGRATION VERSION
// ============================================

async function setVersion(client: PoolClient, version: number): Promise<void> {
  await client.query(`
    INSERT INTO migration_version (version, applied_at)
    VALUES ($1, CURRENT_TIMESTAMP)
    ON CONFLICT (version) DO UPDATE
    SET applied_at = CURRENT_TIMESTAMP
  `, [version]);
}

// ============================================
// RUN MIGRATIONS
// ============================================

async function runMigrations() {
  const startTime = Date.now();
  const pool = new Pool({ connectionString });

  try {
    console.log('========================================================');
    console.log('         Galeria DATABASE MIGRATIONS');
    console.log('========================================================');
    console.log('');

    const currentVersion = await getCurrentVersion(pool);
    console.log(`[MIGRATE] Current version: ${currentVersion}`);
    console.log(`[MIGRATE] Database: ${connectionString}`);
    console.log('');

    const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('[MIGRATE] No migration files found');
      return;
    }

    console.log(`[MIGRATE] Found ${migrationFiles.length} migration file(s)`);
    console.log('');

    const client = await pool.connect();

    try {
      for (let i = 0; i < migrationFiles.length; i++) {
        const file = migrationFiles[i];
        const migrationNumber = i; // 0-indexed

        if (migrationNumber <= currentVersion) {
          console.log(`[MIGRATE] [OK] Skipping: ${file} (already applied)`);
          continue;
        }

        console.log(`[MIGRATE] [>] Applying: ${file}`);

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await setVersion(client, migrationNumber);
          await client.query('COMMIT');

          console.log(`[MIGRATE] [OK] Applied: ${file} (version ${migrationNumber})`);
          console.log('');

        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`[MIGRATE] [X] Failed: ${file}`);
          console.error('[MIGRATE] Error:', (error as Error).message);
          throw error;
        }
      }

      const finalVersion = await getCurrentVersion(pool);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('========================================================');
      console.log(`     MIGRATIONS COMPLETED (version ${finalVersion})`);
      console.log(`           Duration: ${duration}s`);
      console.log('========================================================');
      console.log('');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('');
    console.error('========================================================');
    console.error('              MIGRATIONS FAILED [X]');
    console.error('========================================================');
    console.error('');
    console.error('[MIGRATE] Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============================================
// RUN MIGRATIONS
// ============================================

runMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[MIGRATE] Fatal error:', error);
    process.exit(1);
  });

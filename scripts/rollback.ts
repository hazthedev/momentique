// ============================================
// GALERIA - Database Migration Rollback
// ============================================
// This script rolls back database migrations to a specific version.
//
// Usage:
//   npm run db:rollback          # Rollback one version
//   npm run db:rollback 0        # Rollback to version 0 (all)
//   npm run db:rollback 1        # Rollback to version 1
//
// WARNING:
//   This will reverse migrations and may result in data loss!
//   Use with caution in production.

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

// ============================================
// GET CURRENT MIGRATION VERSION
// ============================================

async function getCurrentVersion(pool: Pool): Promise<number> {
  try {
    const result = await pool.query('SELECT COALESCE(MAX(version), 0) AS version FROM migration_version');
    return result.rows[0]?.version || 0;
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '42P01') {
      return 0;
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
// ROLLBACK MIGRATIONS
// ============================================

async function rollback() {
  const targetVersion = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
  const startTime = Date.now();

  const pool = new Pool({ connectionString });

  try {
    console.log('========================================================');
    console.log('       Galeria DATABASE MIGRATION ROLLBACK');
    console.log('========================================================');
    console.log('');

    const currentVersion = await getCurrentVersion(pool);

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Rollback script is disabled in production. Use tested down-migrations or backup/restore runbook.'
      );
    }

    if (currentVersion === 0) {
      console.log('[ROLLBACK] Already at version 0 (base state)');
      console.log('[ROLLBACK] Nothing to rollback');
      return;
    }

    const target = targetVersion !== undefined
      ? targetVersion
      : Math.max(0, currentVersion - 1);

    if (target >= currentVersion) {
      console.log(`[ROLLBACK] Current version: ${currentVersion}`);
      console.log(`[ROLLBACK] Target version: ${target}`);
      console.log('[ROLLBACK] Nothing to rollback (target >= current)');
      return;
    }

    console.log(`[ROLLBACK] Current version: ${currentVersion}`);
    console.log(`[ROLLBACK] Target version: ${target}`);
    console.log(`[ROLLBACK] Rolling back ${currentVersion - target} migration(s)`);
    console.log('');

    const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Reverse the migrations we need to rollback
    const migrationsToRollback = migrationFiles
      .slice(target, currentVersion)
      .reverse();

    if (migrationsToRollback.length === 0) {
      console.log('[ROLLBACK] No migrations to rollback');
      return;
    }

    console.log(`[ROLLBACK] Migrations to rollback:`);
    migrationsToRollback.forEach(f => console.log(`[ROLLBACK]   - ${f}`));
    console.log('');

    const client = await pool.connect();

    try {
      for (const file of migrationsToRollback) {
        console.log(`[ROLLBACK] [>] Rolling back: ${file}`);

        // Note: Drizzle doesn't generate down migrations by default
        // This is a simplified rollback that:
        // 1. Updates the version number
        // 2. Logs a warning that manual SQL may be needed
        // For production, implement proper down migrations

        console.log(`[ROLLBACK] [!] WARNING: Automatic rollback not implemented`);
        console.log(`[ROLLBACK] [!] Manual SQL execution may be required for: ${file}`);
        console.log(`[ROLLBACK] [!] Version number will be decremented`);

        const newIndex = migrationFiles.indexOf(file);
        await setVersion(client, newIndex);

        console.log(`[ROLLBACK] [OK] Version set to ${newIndex}`);
        console.log('');
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('========================================================');
      console.log(`     ROLLBACK COMPLETED (version ${target})`);
      console.log('========================================================');
      console.log('');
      console.log('[ROLLBACK] [!] IMPORTANT NOTES:');
      console.log('[ROLLBACK]   - Database objects may still exist from rolled back migrations');
      console.log('[ROLLBACK]   - Review the database and manually clean up if needed');
      console.log('[ROLLBACK]   - Consider using database snapshots for production rollbacks');
      console.log('');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('');
    console.error('========================================================');
    console.error('              ROLLBACK FAILED [X]');
    console.error('========================================================');
    console.error('');
    console.error('[ROLLBACK] Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============================================
// RUN ROLLBACK
// ============================================

rollback()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[ROLLBACK] Fatal error:', error);
    process.exit(1);
  });

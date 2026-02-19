// ============================================
// GALERIA - Database Restore
// ============================================
// This script restores a database from a backup file.
//
// Usage:
//   npm run db:restore              # Lists available backups
//   npm run db:restore <filename>   # Restores specific backup
//
// ⚠️  WARNING:
//   This will OVERWRITE all existing data in the database!
//   Use with extreme caution in production.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';
const backupsDir = path.join(process.cwd(), 'backups');

// ============================================
// LIST AVAILABLE BACKUPS
// ============================================

function listBackups(): string[] {
  if (!fs.existsSync(backupsDir)) {
    console.log('[RESTORE] No backups directory found');
    return [];
  }

  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sql.gz'))
    .sort()
    .reverse();

  return files;
}

// ============================================
// GET CONNECTION DETAILS
// ============================================

function parseConnectionString(connStr: string) {
  const match = connStr.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// ============================================
// RESTORE FROM BACKUP
// ============================================

async function restore() {
  const targetFile = process.argv[2];

  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         Galeria DATABASE RESTORE                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    // If no file specified, list available backups
    if (!targetFile) {
      const backups = listBackups();

      if (backups.length === 0) {
        console.log('[RESTORE] No backups found');
        console.log('[RESTORE] Create a backup first: npm run db:backup');
        return;
      }

      console.log('[RESTORE] Available backups:');
      console.log('');

      for (const backup of backups) {
        const filepath = path.join(backupsDir, backup);
        const stats = fs.statSync(filepath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const date = backup.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
        console.log(`  ${backup}`);
        console.log(`    Size: ${sizeMB} MB`);
        if (date) {
          console.log(`    Date: ${date[1]} ${date[2].replace(/-/g, ':')}`);
        }
        console.log('');
      }

      console.log('[RESTORE] Usage:');
      console.log('[RESTORE]   npm run db:restore <filename>');
      console.log('[RESTORE] Example:');
      console.log(`[RESTORE]   npm run db:restore ${backups[0]}`);
      return;
    }

    // Find the backup file
    let filepath = targetFile;
    if (!fs.existsSync(filepath)) {
      const possiblePath = path.join(backupsDir, targetFile);
      if (fs.existsSync(possiblePath)) {
        filepath = possiblePath;
      } else if (!targetFile.endsWith('.sql.gz')) {
        const withExtension = possiblePath + '.sql.gz';
        if (fs.existsSync(withExtension)) {
          filepath = withExtension;
        }
      } else {
        console.error(`[RESTORE] Backup file not found: ${targetFile}`);
        console.error('[RESTORE] Available backups:');
        listBackups().forEach(b => console.error(`[RESTORE]   - ${b}`));
        process.exit(1);
      }
    }

    const filename = path.basename(filepath);

    // Safety check for production
    if (process.env.NODE_ENV === 'production' && !process.env.RESTORE_CONFIRMED) {
      console.error('[RESTORE] ⚠️  PRODUCTION ENVIRONMENT DETECTED!');
      console.error('[RESTORE] This will OVERWRITE all production data!');
      console.error('[RESTORE] Set RESTORE_CONFIRMED=true to confirm restore');
      console.error('[RESTORE] Aborting for safety.');
      process.exit(1);
    }

    // Get connection details
    const conn = parseConnectionString(connectionString);

    console.log('[RESTORE] Restoring backup...');
    console.log(`[RESTORE] File: ${filename}`);
    console.log(`[RESTORE] Database: ${conn.database}`);
    console.log(`[RESTORE] Host: ${conn.host}:${conn.port}`);
    console.log('');
    console.log('[RESTORE] ⚠️  WARNING: This will OVERWRITE all existing data!');
    console.log('[RESTORE] Press Ctrl+C to cancel...');
    console.log('');
    console.log('[RESTORE] Starting restore in 3 seconds...');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Set PGPASSWORD environment variable for pg_restore
    const env = {
      ...process.env,
      PGPASSWORD: conn.password,
    };

    // Run restore (gunzip + psql)
    const restoreCommand = `gunzip -c "${filepath}" | psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database}`;

    try {
      execSync(restoreCommand, {
        env,
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      console.log('');
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║     RESTORE COMPLETED SUCCESSFULLY ✓                   ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('[RESTORE] Database restored from:');
      console.log(`[RESTORE]   ${filename}`);
      console.log('');
      console.log('[RESTORE] Next steps:');
      console.log('[RESTORE]   1. Verify the restore: npm run db:health');
      console.log('[RESTORE]   2. Run migrations if needed: npm run db:migrate');
      console.log('[RESTORE]   3. Seed data if needed: npm run db:seed');
      console.log('');

    } catch (error) {
      console.error('');
      console.error('[RESTORE] ⚠️  psql not found or restore failed');
      console.error('[RESTORE] Error:', error instanceof Error ? error.message : String(error));
      throw error;
    }

  } catch (error) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║              RESTORE FAILED ✗                         ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('[RESTORE] Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('[RESTORE] Troubleshooting:');
    console.error('[RESTORE]   1. Ensure psql is installed and in PATH');
    console.error('[RESTORE]   2. Check DATABASE_URL is correct');
    console.error('[RESTORE]   3. Verify backup file exists and is valid');
    console.error('[RESTORE]   4. Check database connectivity');
    process.exit(1);
  }
}

// ============================================
// RUN RESTORE
// ============================================

restore()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[RESTORE] Fatal error:', error);
    process.exit(1);
  });

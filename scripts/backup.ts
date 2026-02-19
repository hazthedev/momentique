// ============================================
// Galeria - Database Backup
// ============================================
// This script creates a timestamped backup of the database.
//
// Usage:
//   npm run db:backup
//
// Features:
//   - Creates timestamped backup files
//   - Stores in backups/ directory
//   - Compresses with gzip
//   - Records backup metadata

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';
const backupsDir = path.join(process.cwd(), 'backups');

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
// CREATE BACKUP
// ============================================

async function createBackup() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         Galeria DATABASE BACKUP                    ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    // Create backups directory
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log('[BACKUP] Created backups directory');
    }

    // Get current timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const time = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const filename = `galeria-backup-${timestamp}_${time}.sql.gz`;
    const filepath = path.join(backupsDir, filename);

    // Get connection details
    const conn = parseConnectionString(connectionString);

    console.log('[BACKUP] Creating backup...');
    console.log(`[BACKUP] Database: ${conn.database}`);
    console.log(`[BACKUP] Host: ${conn.host}:${conn.port}`);
    console.log(`[BACKUP] Output: ${filepath}`);
    console.log('');

    // Set PGPASSWORD environment variable for pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: conn.password,
    };

    // Run pg_dump with gzip compression
    const dumpCommand = `pg_dump -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database} --verbose --no-owner --no-acl | gzip > "${filepath}"`;

    try {
      const output = execSync(dumpCommand, {
        env,
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      // Get file size
      const stats = fs.statSync(filepath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('');
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log(`║     BACKUP COMPLETED SUCCESSFULLY ✓                    ║`);
      console.log(`║     File: ${filename.padEnd(47)} ║`);
      console.log(`║     Size: ${sizeMB.padEnd(47)} MB ║`);
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('[BACKUP] To restore this backup:');
      console.log(`[BACKUP]   npm run db:restore ${filename}`);
      console.log('');

      // Create metadata file
      const metadataPath = filepath.replace('.sql.gz', '.meta.json');
      const metadata = {
        filename,
        timestamp: new Date().toISOString(),
        database: conn.database,
        size_bytes: stats.size,
        size_mb: sizeMB,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`[BACKUP] Metadata saved: ${metadataPath}`);

    } catch (error) {
      console.error('');
      console.error('[BACKUP] ⚠️  pg_dump not found or failed');
      console.error('[BACKUP] Trying alternative backup method...');
      console.error('');

      // Alternative: Use node-pg-dump (if pg_dump is not available)
      // For now, just log the error
      throw new Error('Backup failed: pg_dump not available. Install PostgreSQL client tools.');
    }

  } catch (error) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║              BACKUP FAILED ✗                          ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('[BACKUP] Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('[BACKUP] Troubleshooting:');
    console.error('[BACKUP]   1. Ensure pg_dump is installed and in PATH');
    console.error('[BACKUP]   2. Check DATABASE_URL is correct');
    console.error('[BACKUP]   3. Verify database is accessible');
    console.error('[BACKUP]   4. Check available disk space');
    process.exit(1);
  }
}

// ============================================
// RUN BACKUP
// ============================================

createBackup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[BACKUP] Fatal error:', error);
    process.exit(1);
  });

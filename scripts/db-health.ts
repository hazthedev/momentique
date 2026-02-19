// ============================================
// Galeria - Database Health Check
// ============================================
// This script checks the health and status of the PostgreSQL database.
//
// Usage:
//   npm run db:health
//
// Checks performed:
//   - Connection status
//   - Database version
//   - Connection pool stats
//   - Table existence
//   - RLS status
//   - Migration version
//   - Critical functions

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

interface HealthResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    duration?: number;
  }[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// ============================================
// PERFORM HEALTH CHECKS
// ============================================

async function performHealthChecks(): Promise<HealthResult> {
  const checks: HealthResult['checks'] = [];
  const pool = new Pool({ connectionString });

  try {
    const startTime = Date.now();

    // Check 1: Database Connection
    const connStart = Date.now();
    try {
      await pool.query('SELECT 1');
      const connDuration = Date.now() - connStart;
      checks.push({
        name: 'Database Connection',
        status: 'pass',
        message: 'Successfully connected to database',
        duration: connDuration,
      });
    } catch (error) {
      checks.push({
        name: 'Database Connection',
        status: 'fail',
        message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      });
      return { status: 'unhealthy', checks, summary: { total: 1, passed: 0, failed: 1, warnings: 0 } };
    }

    // Check 2: PostgreSQL Version
    const versionResult = await pool.query('SELECT version()');
    const version = versionResult.rows[0].version.split(' ')[1];
    checks.push({
      name: 'PostgreSQL Version',
      status: version.startsWith('15') || version.startsWith('16') ? 'pass' : 'warn',
      message: `PostgreSQL ${version} ${version.startsWith('15') || version.startsWith('16') ? '(recommended)' : '(may have compatibility issues)'}`,
    });

    // Check 3: Database Size
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    const size = sizeResult.rows[0].size;
    checks.push({
      name: 'Database Size',
      status: 'pass',
      message: `Database size: ${size}`,
    });

    // Check 4: Connection Pool Stats
    const poolResult = await pool.query(`
      SELECT
        count(*) as connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const poolStats = poolResult.rows[0];
    checks.push({
      name: 'Connection Pool',
      status: 'pass',
      message: `Using ${poolStats.connections} of ${poolStats.max_connections} max connections`,
    });

    // Check 5: Tables Exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map(r => r.table_name);
    const expectedTables = ['tenants', 'users', 'events', 'photos', 'migration_version'];
    const missingTables = expectedTables.filter(t => !tables.includes(t));

    if (missingTables.length > 0) {
      checks.push({
        name: 'Table Existence',
        status: 'fail',
        message: `Missing tables: ${missingTables.join(', ')}`,
      });
    } else {
      checks.push({
        name: 'Table Existence',
        status: 'pass',
        message: `All ${expectedTables.length} expected tables exist`,
      });
    }

    // Check 6: Row-Level Security
    if (tables.includes('users') && tables.includes('events')) {
      const rlsResult = await pool.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'events', 'photos')
        AND relrowsecurity = true
      `);
      const rlsTables = rlsResult.rows.map(r => r.tablename);
      checks.push({
        name: 'Row-Level Security',
        status: rlsTables.length >= 3 ? 'pass' : 'fail',
        message: `RLS enabled on ${rlsTables.length} table(s)`,
      });
    }

    // Check 7: Migration Version
    if (tables.includes('migration_version')) {
      const versionResult = await pool.query('SELECT version, applied_at FROM migration_version LIMIT 1');
      const version = versionResult.rows[0]?.version ?? 'unknown';
      checks.push({
        name: 'Migration Version',
        status: typeof version === 'number' && version >= 2 ? 'pass' : 'warn',
        message: `Current migration version: ${version}`,
      });
    }

    // Check 8: Critical Functions
    const funcResult = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname IN ('set_tenant_id', 'current_tenant_id', 'update_updated_at')
    `);
    const functions = funcResult.rows.map(r => r.proname);
    const missingFunctions = ['set_tenant_id', 'current_tenant_id', 'update_updated_at']
      .filter(f => !functions.includes(f));

    if (missingFunctions.length > 0) {
      checks.push({
        name: 'Critical Functions',
        status: 'fail',
        message: `Missing functions: ${missingFunctions.join(', ')}`,
      });
    } else {
      checks.push({
        name: 'Critical Functions',
        status: 'pass',
        message: 'All critical functions exist',
      });
    }

    // Calculate summary
    const totalDuration = Date.now() - startTime;
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warn').length;

    return {
      status: failed > 0 ? 'unhealthy' : 'healthy',
      checks,
      summary: {
        total: checks.length,
        passed,
        failed,
        warnings,
      },
    };

  } finally {
    await pool.end();
  }
}

// ============================================
// PRINT HEALTH RESULTS
// ============================================

function printHealthResults(result: HealthResult): void {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         Galeria DATABASE HEALTH CHECK               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  // Overall status
  const statusIcon = result.status === 'healthy' ? '✓' : '✗';
  const statusColor = result.status === 'healthy' ? '\x1b[32m' : '\x1b[31m';
  console.log(`${statusColor}${statusIcon} Overall Status: ${result.status.toUpperCase()}\x1b[0m`);
  console.log('');

  // Individual checks
  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '⚠';
    const color = check.status === 'pass' ? '\x1b[32m' : check.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
    const duration = check.duration ? ` (${check.duration}ms)` : '';
    console.log(`${color}${icon}\x1b[0m ${check.name}: ${check.message}${duration}`);
  }

  console.log('');
  console.log('Summary:');
  console.log(`  Total: ${result.summary.total}`);
  console.log(`  \x1b[32mPassed: ${result.summary.passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${result.summary.failed}\x1b[0m`);
  console.log(`  \x1b[33mWarnings: ${result.summary.warnings}\x1b[0m`);
  console.log('');

  // Exit with appropriate code
  if (result.summary.failed > 0) {
    process.exit(1);
  }
}

// ============================================
// RUN HEALTH CHECK
// ============================================

performHealthChecks()
  .then(printHealthResults)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[HEALTH] Fatal error:', error);
    process.exit(1);
  });

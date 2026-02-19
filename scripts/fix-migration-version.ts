// Fix migration version to match already-applied migrations
import { Pool } from 'pg';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL || 'postgresql://galeria:galeria_dev_password@localhost:5432/galeria';

async function fixMigrationVersion() {
    const pool = new Pool({ connectionString });

    try {
        console.log('Connecting to database...');

        // Create migration_version table if not exists
        await pool.query(`
      CREATE TABLE IF NOT EXISTS migration_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW(),
        description TEXT
      )
    `);
        console.log('✓ Ensured migration_version table exists');

        // Check current max version
        const result = await pool.query('SELECT MAX(version) as v FROM migration_version');
        console.log('Current max version:', result.rows[0].v);

        // Set versions 0-7 as applied (they already exist in the database)
        for (let i = 0; i <= 7; i++) {
            await pool.query(
                'INSERT INTO migration_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
                [i, 'Pre-existing migration']
            );
        }
        console.log('✓ Set versions 0-7 as applied');

        // Check new max version
        const result2 = await pool.query('SELECT MAX(version) as v FROM migration_version');
        console.log('New max version:', result2.rows[0].v);

        console.log('Done! You can now run: npm run db:migrate');

    } finally {
        await pool.end();
    }
}

fixMigrationVersion().catch(console.error);

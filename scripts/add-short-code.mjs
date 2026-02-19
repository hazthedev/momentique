// ============================================
// Galeria - Add short_code column to events
// ============================================

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '../.env') });

const { Client } = pg;

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const match = dbUrl?.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

const client = new Client({
  host: match ? match[3] : process.env.PGHOST || 'localhost',
  port: match ? parseInt(match[4]) : parseInt(process.env.PGPORT || '5432'),
  database: match ? match[5] : process.env.PGDATABASE || 'galeria',
  user: match ? match[1] : process.env.PGUSER || 'postgres',
  password: match ? match[2] : process.env.PGPASSWORD || 'postgres',
});

async function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'short_code'
    `);

    if (checkResult.rows.length > 0) {
      console.log('short_code column already exists');

      // Check if constraint exists
      const constraintCheck = await client.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'events' AND constraint_name = 'events_short_code_unique'
      `);

      if (constraintCheck.rows.length === 0) {
        console.log('Adding unique constraint...');
        await client.query('ALTER TABLE events ADD CONSTRAINT events_short_code_unique UNIQUE (short_code)');
        console.log('Added unique constraint');
      } else {
        console.log('Unique constraint already exists');
      }

      // Generate short codes for any existing NULL values
      const nullCheck = await client.query('SELECT id FROM events WHERE short_code IS NULL');
      if (nullCheck.rows.length > 0) {
        console.log(`Generating short codes for ${nullCheck.rows.length} events...`);
        for (const row of nullCheck.rows) {
          const shortCode = await generateShortCode();
          await client.query('UPDATE events SET short_code = $1 WHERE id = $2', [shortCode, row.id]);
        }
        console.log('Generated short codes for existing events');
      }
    } else {
      // Add the column
      console.log('Adding short_code column...');
      await client.query('ALTER TABLE events ADD COLUMN short_code TEXT');
      console.log('Added short_code column');

      // Generate short codes for existing events
      const { rows } = await client.query('SELECT id FROM events');
      console.log(`Generating short codes for ${rows.length} events...`);
      for (const row of rows) {
        const shortCode = await generateShortCode();
        await client.query('UPDATE events SET short_code = $1 WHERE id = $2', [shortCode, row.id]);
      }
      console.log('Generated short codes for existing events');

      // Add the unique constraint
      console.log('Adding unique constraint...');
      await client.query('ALTER TABLE events ADD CONSTRAINT events_short_code_unique UNIQUE (short_code)');
      console.log('Added unique constraint');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

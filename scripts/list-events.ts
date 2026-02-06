// List events with their photo limits
import { getTenantDb } from '../lib/db';

async function listEvents() {
  const db = getTenantDb('00000000-0000-0000-0000-000000000001');

  const events = await db.findMany('events', {}, {
    limit: 10,
    orderBy: 'created_at',
    orderDirection: 'DESC'
  });

  console.log('\nRecent Events:\n');
  events.forEach((e: any, i: number) => {
    console.log(`${i + 1}. ID: ${e.id}`);
    console.log(`   Name: ${e.name}`);
    console.log(`   Photo Limit: ${e.settings?.limits?.max_total_photos || 'undefined (uses tier limit)'}`);
    console.log('');
  });

  process.exit(0);
}

listEvents().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

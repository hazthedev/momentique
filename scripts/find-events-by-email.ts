// Find events by organizer email
import { getTenantDb } from '../lib/db';

async function findEventsByEmail(email: string) {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const db = getTenantDb(tenantId);

  // First find the user by email
  const user = await db.findOne<any>('users', { email });

  if (!user) {
    console.log(`\n❌ No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`\n✅ Found user: ${user.name || 'No name'} (${user.email})`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Role: ${user.role}\n`);

  // Find events organized by this user
  const events = await db.findMany<any>('events', { organizer_id: user.id }, {
    limit: 20,
    orderBy: 'created_at',
    orderDirection: 'DESC'
  });

  if (events.length === 0) {
    console.log('No events found for this user.\n');
    process.exit(0);
  }

  console.log(`Found ${events.length} event(s):\n`);

  events.forEach((e, i) => {
    const photoCount = e.settings?.limits?.max_total_photos || 'uses tier limit';
    console.log(`${i + 1}. Event ID: ${e.id}`);
    console.log(`   Name: ${e.name}`);
    console.log(`   Short Code: ${e.short_code}`);
    console.log(`   Status: ${e.status}`);
    console.log(`   Photo Limit: ${photoCount}`);
    console.log(`   Event URL: /e/${e.short_code || e.id}`);
    console.log('');
  });

  // Show command to update the first event's limit
  if (events.length > 0) {
    console.log('To update the photo limit for the first event, run:\n');
    console.log(`   npx tsx scripts/update-event-photo-limit.ts ${events[0].id} 1000`);
    console.log('\nOr to remove the limit and use tier limit instead:\n');
    console.log(`   npx tsx scripts/update-event-photo-limit.ts ${events[0].id} null`);
  }

  process.exit(0);
}

const email = process.argv[2];

if (!email) {
  console.log('Usage: npx tsx scripts/find-events-by-email.ts <email>');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx scripts/find-events-by-email.ts organizer@gmail.com');
  process.exit(1);
}

findEventsByEmail(email).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

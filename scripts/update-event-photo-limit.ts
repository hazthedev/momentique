// Update Event Photo Limit
// Usage: npx tsx scripts/update-event-photo-limit.ts <EVENT_ID> <NEW_LIMIT>

import { getTenantDb } from '../lib/db';

async function updateEventPhotoLimit(eventId: string, newLimit: number | null) {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const db = getTenantDb(tenantId);

  console.log(`[UPDATE] Fetching event: ${eventId}`);

  const event = await db.findOne<any>('events', { id: eventId });

  if (!event) {
    console.error(`[ERROR] Event not found: ${eventId}`);
    process.exit(1);
  }

  console.log('[CURRENT] Event settings:', {
    name: event.name,
    currentLimit: event.settings?.limits?.max_total_photos || 'undefined (uses tier limit)',
  });

  // Update the event's max_total_photos setting
  const updatedSettings = {
    ...event.settings,
    limits: {
      ...event.settings?.limits,
      max_total_photos: newLimit,
    },
  };

  await db.update(
    'events',
    { settings: updatedSettings, updated_at: new Date() },
    { id: eventId }
  );

  console.log('[SUCCESS] Event photo limit updated:', {
    eventId,
    oldLimit: event.settings?.limits?.max_total_photos || 'undefined',
    newLimit: newLimit === null ? 'removed (uses tier limit)' : newLimit,
  });

  process.exit(0);
}

// Get arguments from command line
const eventId = process.argv[2];
const limitArg = process.argv[3];

if (!eventId) {
  console.log('Usage: npx tsx scripts/update-event-photo-limit.ts <EVENT_ID> <NEW_LIMIT>');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/update-event-photo-limit.ts abc123 1000');
  console.log('  npx tsx scripts/update-event-photo-limit.ts abc123 null');
  process.exit(1);
}

const newLimit = limitArg === 'null' || limitArg === 'undefined' ? null : parseInt(limitArg, 10);

if (limitArg !== 'null' && limitArg !== 'undefined' && isNaN(newLimit as number)) {
  console.error('ERROR: NEW_LIMIT must be a number or "null"');
  process.exit(1);
}

updateEventPhotoLimit(eventId, newLimit).catch((error) => {
  console.error('[ERROR]', error);
  process.exit(1);
});

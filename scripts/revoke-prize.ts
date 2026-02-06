import { getTenantDb } from '@/lib/db';

// Revoke a prize claim for testing
async function revokePrizeClaim() {
  const db = getTenantDb('00000000-0000-0000-0000-000000000001');

  const fingerprint = '0baedc92-5102-43e4-94b5-45e14a766483';
  const eventId = 'bacbaf4e-6662-4f8b-8a10-2defc4bed1f4';

  // Reset the prize claim
  await db.update(
    'guest_photo_progress',
    { prize_claimed_at: null },
    {
      event_id: eventId,
      user_fingerprint: fingerprint
    }
  );

  console.log('Prize claim revoked successfully!');
}

revokePrizeClaim().catch(console.error);

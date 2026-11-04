import { db } from './src/db/index.js';
import { properties, ownershipRecords, listings, verificationRecords } from './src/db/schema.js';
import { inArray } from 'drizzle-orm';

async function main() {
  const ids = ['17fda0d9-c8aa-411b-a5ec-4c49c70e4270', '49c391c6-268f-4525-82b6-8bb4aaeb565d'];
  await db.delete(listings).where(inArray(listings.propertyId, ids)).catch(() => {});
  await db.delete(verificationRecords).where(inArray(verificationRecords.targetId, ids)).catch(() => {});
  await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, ids)).catch(() => {});
  await db.delete(properties).where(inArray(properties.id, ids)).catch(() => {});
  console.log('Cleaned up stale test properties');
  process.exit(0);
}

main().catch(console.error);

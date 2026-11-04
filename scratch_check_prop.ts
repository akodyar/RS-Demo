import { db } from './src/db/index.js';
import { properties, ownershipRecords } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const propId = '49c391c6-268f-4525-82b6-8bb4aaeb565d';
  const prop = await db.select().from(properties).where(eq(properties.id, propId));
  console.log('Property in DB:', prop);
  const own = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
  console.log('Ownership records in DB:', own);
  process.exit(0);
}

main().catch(console.error);

import { propertyRepository } from './src/server/repositories/properties.js';
import { db } from './src/db/index.js';
import { properties, ownershipRecords } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const prop = await propertyRepository.createProperty(
    'user_owner_01',
    ['PROPERTY_OWNER'],
    {
      name: 'Test Creation Property',
      type: 'Apartment',
      listingType: 'FOR_RENT',
      price: 1500000,
      currency: 'IQD',
      address: { city: 'Erbil', country: 'Iraq' }
    }
  );

  console.log('Created property ID:', prop.id);
  const records = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
  console.log('Ownership records created:', records);

  // Clean up
  await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
  await db.delete(properties).where(eq(properties.id, prop.id));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

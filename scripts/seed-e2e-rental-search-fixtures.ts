import { pool } from '../src/db/index.js';

const PREFIX = 'E2E-RENTAL-SEARCH-20261030';
const OWNER_ID = `${PREFIX}-user`;

export interface TestRentalSpec {
  idSuffix: string;
  name: string;
  type: string;
  price: number;
  city: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  title: string;
  description: string;
  imageUrl: string;
  amenities: string[];
}

export const TEST_RENTAL_SPECS: TestRentalSpec[] = [
  // 1. Apartments (Multiple)
  {
    idSuffix: 'apt-1',
    name: 'Modern Studio-Style 1BR Apartment in Dream City',
    type: 'APARTMENT',
    price: 450,
    city: 'Erbil',
    neighborhood: 'Dream City',
    bedrooms: 1,
    bathrooms: 1,
    squareFeet: 850,
    title: 'Modern 1BR Apartment for Rent in Dream City',
    description: 'Charming sunlit apartment with balcony, 24/7 power generator and dedicated parking.',
    imageUrl: '/images/card-1.jpg',
    amenities: ['Generator', 'Parking', 'Balcony', 'Fiber Internet'],
  },
  {
    idSuffix: 'apt-2',
    name: 'Spacious 2BR Family Apartment in Sarchinar',
    type: 'APARTMENT',
    price: 850,
    city: 'Sulaymaniyah',
    neighborhood: 'Sarchinar',
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1250,
    title: 'Contemporary 2BR Apartment in Prime Sarchinar',
    description: 'High floor apartment with scenic mountain views, modern kitchen and central heating.',
    imageUrl: '/images/card-3.jpg',
    amenities: ['Central Heating', 'Elevator', 'Security', 'Parking'],
  },
  {
    idSuffix: 'apt-3',
    name: 'Executive 3BR Luxury High-Rise Apartment in Empire World',
    type: 'APARTMENT',
    price: 1650,
    city: 'Erbil',
    neighborhood: 'Empire World',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1850,
    title: 'Executive High-Floor 3BR Apartment in Royal Tower',
    description: 'Ultra-modern apartment with panoramic city views, concierge and underground parking.',
    imageUrl: '/images/card-7.jpg',
    amenities: ['Central AC', 'Underground Parking', 'Pool', 'Gym', '24/7 Security'],
  },

  // 2. Houses (Multiple)
  {
    idSuffix: 'hse-1',
    name: 'Charming 3BR Traditional Family House in Ankawa',
    type: 'HOUSE',
    price: 1200,
    city: 'Erbil',
    neighborhood: 'Ankawa',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 2200,
    title: 'Beautiful 3BR Family House with Private Yard in Ankawa',
    description: 'Independent house in quiet residential neighborhood, green garden and covered garage.',
    imageUrl: '/images/card-6.jpg',
    amenities: ['Garden', 'Parking', 'Generator', 'Water Well'],
  },
  {
    idSuffix: 'hse-2',
    name: 'Grand 4BR Suburban Family House in Malata',
    type: 'HOUSE',
    price: 2100,
    city: 'Duhok',
    neighborhood: 'Malata',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 3100,
    title: 'Grand 4-Bedroom Detached House with Mountain Terrace',
    description: 'Spacious family house featuring private courtyard, master ensuite and rooftop terrace.',
    imageUrl: '/images/card-6.jpg',
    amenities: ['Terrace', 'Garden', 'Central AC', 'Parking'],
  },

  // 3. Villas (Multiple)
  {
    idSuffix: 'vil-1',
    name: 'Contemporary 4BR Villa in Italian Village 1',
    type: 'VILLA',
    price: 2600,
    city: 'Erbil',
    neighborhood: 'Italian Village 1',
    bedrooms: 4,
    bathrooms: 4,
    squareFeet: 3900,
    title: 'Modern Detached Villa with Landscaped Garden',
    description: 'Fully finished villa with double garage, landscaped garden, central heating and AC.',
    imageUrl: '/images/card-2.jpg',
    amenities: ['Garden', 'Central AC', 'Central Heating', 'Underground Parking'],
  },
  {
    idSuffix: 'vil-2',
    name: 'Palatial 5BR Luxury Pool Villa in German Village',
    type: 'VILLA',
    price: 3600,
    city: 'Sulaymaniyah',
    neighborhood: 'German Village',
    bedrooms: 5,
    bathrooms: 5,
    squareFeet: 4800,
    title: 'Luxury 5BR Villa with Private Swimming Pool',
    description: 'Prestigious villa overlooking the mountains with private swimming pool and maid quarters.',
    imageUrl: '/images/card-4.jpg',
    amenities: ['Pool', 'Garden', 'Gym', 'Maid Room', 'Solar Panels'],
  },

  // 4. Commercial (Multiple)
  {
    idSuffix: 'com-1',
    name: 'Prime Retail Corner Shop on Gulan Street',
    type: 'COMMERCIAL',
    price: 1850,
    city: 'Erbil',
    neighborhood: 'Gulan Street',
    bedrooms: 0,
    bathrooms: 1,
    squareFeet: 1400,
    title: 'High-Visibility Ground Floor Commercial Space on Gulan St',
    description: 'Corner retail shop ideal for boutique, clinic, pharmacy or agency with customer parking.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Central AC', 'Parking', '24/7 Security', 'Fiber Internet'],
  },
  {
    idSuffix: 'com-2',
    name: 'Spacious Commercial Showroom on Salim Street',
    type: 'COMMERCIAL',
    price: 2900,
    city: 'Sulaymaniyah',
    neighborhood: 'Salim Street',
    bedrooms: 0,
    bathrooms: 2,
    squareFeet: 3200,
    title: 'Wide Commercial Showroom & Frontage on Main Salim Boulevard',
    description: 'Double-height commercial space with floor-to-ceiling glass frontage and heavy pedestrian footfall.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Central AC', 'Elevator', '24/7 Power Generator'],
  },

  // 5. Studio Apartments (More menu)
  {
    idSuffix: 'stu-1',
    name: 'Chic Compact Studio Apartment in Empire Diamond',
    type: 'STUDIO',
    price: 390,
    city: 'Erbil',
    neighborhood: 'Empire Diamond',
    bedrooms: 1,
    bathrooms: 1,
    squareFeet: 480,
    title: 'Furnished Minimalist Studio Apartment in Empire Diamond',
    description: 'Affordable modern studio with smart layout, kitchenette and high-speed fiber internet.',
    imageUrl: '/images/card-1.jpg',
    amenities: ['Fiber Internet', 'Elevator', 'Security', 'Central AC'],
  },
  {
    idSuffix: 'stu-2',
    name: 'Executive Studio Suite in Downtown Sulaymaniyah',
    type: 'STUDIO',
    price: 680,
    city: 'Sulaymaniyah',
    neighborhood: 'Downtown',
    bedrooms: 1,
    bathrooms: 1,
    squareFeet: 620,
    title: 'Executive High-Spec Studio Flat Near City Center',
    description: 'Premium serviced studio apartment fully equipped for corporate and expatriate tenants.',
    imageUrl: '/images/card-3.jpg',
    amenities: ['Central AC', 'Central Heating', 'Balcony', 'Parking'],
  },

  // 6. Office Spaces (More menu)
  {
    idSuffix: 'off-1',
    name: 'Corporate Office Floor at World Trade Center Erbil',
    type: 'OFFICE',
    price: 1450,
    city: 'Erbil',
    neighborhood: 'World Trade Center',
    bedrooms: 0,
    bathrooms: 2,
    squareFeet: 1650,
    title: 'Turnkey Corporate Office Suite with Meeting Rooms',
    description: 'Partitioned modern office space with conference room, reception and high-speed networking.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Fiber Internet', 'Elevator', 'Central AC', '24/7 Security'],
  },
  {
    idSuffix: 'off-2',
    name: 'Modern Tech & Law Office in Tuwaik',
    type: 'OFFICE',
    price: 950,
    city: 'Sulaymaniyah',
    neighborhood: 'Tuwaik',
    bedrooms: 0,
    bathrooms: 1,
    squareFeet: 1100,
    title: 'Professional Office Suite in Convenient Commercial Center',
    description: 'Affordable office space with private entrance, waiting area and dedicated customer parking.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Parking', 'Generator', 'Fiber Internet'],
  },

  // 7. Warehouse & Storage (More menu)
  {
    idSuffix: 'whs-1',
    name: 'Industrial Logistics Hub & Warehouse South Industrial Zone',
    type: 'WAREHOUSE',
    price: 2450,
    city: 'Erbil',
    neighborhood: 'South Industrial Zone',
    bedrooms: 0,
    bathrooms: 1,
    squareFeet: 6200,
    title: 'Secure Industrial Logistics Warehouse with Loading Bay',
    description: 'High-ceiling industrial storage facility with wide loading docks, three-phase power and 24/7 guard.',
    imageUrl: '/images/card-8.jpg',
    amenities: ['24/7 Security', 'Loading Docks', 'Three Phase Power'],
  },
  {
    idSuffix: 'whs-2',
    name: 'Dry Goods Storage Facility on Zakho Road',
    type: 'WAREHOUSE',
    price: 1350,
    city: 'Duhok',
    neighborhood: 'Zakho Road',
    bedrooms: 0,
    bathrooms: 1,
    squareFeet: 3400,
    title: 'Spacious Secure Commercial Storage Unit',
    description: 'Gated commercial storage unit suited for retail inventory, building supplies and machinery.',
    imageUrl: '/images/card-8.jpg',
    amenities: ['Security', 'Parking', 'Direct Highway Access'],
  },

  // 8. Duplexes (More menu)
  {
    idSuffix: 'dpx-1',
    name: 'Architectural 3BR Duplex Penthouse in Dream City 2',
    type: 'DUPLEX',
    price: 1750,
    city: 'Erbil',
    neighborhood: 'Dream City Phase 2',
    bedrooms: 3,
    bathrooms: 3,
    squareFeet: 2450,
    title: 'Luxury 3BR Two-Story Duplex Apartment with Double Height Ceiling',
    description: 'Breathtaking two-level duplex penthouse with floor-to-ceiling glass, terrace and ensuite bedrooms.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Terrace', 'Balcony', 'Central AC', 'Elevator', 'Parking'],
  },
  {
    idSuffix: 'dpx-2',
    name: 'Contemporary 4BR Duplex Home in Bakrajo Hills',
    type: 'DUPLEX',
    price: 2250,
    city: 'Sulaymaniyah',
    neighborhood: 'Bakrajo Hills',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2950,
    title: 'Panoramic View 4-Bedroom Duplex with Private Garden',
    description: 'Modern two-story duplex residence with private garden, fireplace and mountain outlook.',
    imageUrl: '/images/card-5.jpg',
    amenities: ['Garden', 'Central Heating', 'Parking', 'Generator'],
  },

  // 9. Residential Buildings (More menu)
  {
    idSuffix: 'res-1',
    name: 'Turnkey 12-Unit Residential Apartment Building in New Erbil',
    type: 'RESIDENTIAL',
    price: 5500,
    city: 'Erbil',
    neighborhood: 'New Erbil',
    bedrooms: 12,
    bathrooms: 12,
    squareFeet: 8600,
    title: 'Full Multi-Unit Residential Building for Long-Term Corporate Lease',
    description: 'Brand new four-story residential building with 12 self-contained rental apartments, elevator and generator.',
    imageUrl: '/images/card-7.jpg',
    amenities: ['Elevator', '24/7 Power Generator', 'Water Well', 'Dedicated Parking'],
  },
  {
    idSuffix: 'res-2',
    name: 'Boutique 8-Unit Residential Complex in Nohadra Heights',
    type: 'RESIDENTIAL',
    price: 4300,
    city: 'Duhok',
    neighborhood: 'Nohadra Heights',
    bedrooms: 8,
    bathrooms: 8,
    squareFeet: 6400,
    title: 'Entire Boutique Residential Complex Available for Rental',
    description: 'Enclosed residential rental complex suitable for company accommodation, medical staff or diplomatic residence.',
    imageUrl: '/images/card-7.jpg',
    amenities: ['Parking', 'Central Heating', 'Security Guardhouse'],
  },
];

export async function cleanupFixtures(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete listings
    const delListings = await client.query(
      `DELETE FROM listings WHERE id LIKE '${PREFIX}-%' OR property_id LIKE '${PREFIX}-%'`
    );

    // 2. Delete ownership records
    const delOwnership = await client.query(
      `DELETE FROM ownership_records WHERE id LIKE '${PREFIX}-%' OR property_id LIKE '${PREFIX}-%'`
    );

    // 3. Delete properties
    const delProps = await client.query(
      `DELETE FROM properties WHERE id LIKE '${PREFIX}-%'`
    );

    // 4. Delete owner user if created
    await client.query(
      `DELETE FROM users WHERE id = '${OWNER_ID}'`
    );

    await client.query('COMMIT');
    console.log(`[Fixture Cleanup] Removed ${delProps.rowCount} properties, ${delListings.rowCount} listings, ${delOwnership.rowCount} ownership records.`);
    return delProps.rowCount || 0;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Fixture Cleanup Error]:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function seedFixtures(): Promise<void> {
  // Confirm database safety
  const dbRes = await pool.query('SELECT current_database()');
  const currentDb = dbRes.rows[0]?.current_database;
  if (!currentDb || currentDb === 'homehub_production' || currentDb.includes('prod')) {
    throw new Error(`CRITICAL SAFETY ABORT: Refusing to seed test fixtures into production database (${currentDb})!`);
  }
  console.log(`[Fixture Seed] Verified safe target database: ${currentDb}`);

  // Idempotent cleanup first
  await cleanupFixtures();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure test owner user exists
    await client.query(
      `INSERT INTO users (id, first_name, last_name, email, roles, is_active)
       VALUES ($1, 'E2E Owner', 'Verified', $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET roles = $3`,
      [OWNER_ID, 'e2e-rental-search-audit@homehub.test', JSON.stringify(['PROPERTY_OWNER'])]
    );

    // 2. Insert properties, ownership records, and listings
    for (const spec of TEST_RENTAL_SPECS) {
      const propId = `${PREFIX}-prop-${spec.idSuffix}`;
      const ownId = `${PREFIX}-own-${spec.idSuffix}`;
      const listId = `${PREFIX}-list-${spec.idSuffix}`;

      const addressPayload = {
        city: spec.city,
        neighborhood: spec.neighborhood,
        area: spec.neighborhood,
        street: `${spec.neighborhood} Central Way`,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        photos: [spec.imageUrl],
        amenities: spec.amenities,
      };

      // Property record
      await client.query(
        `INSERT INTO properties (
          id, name, type, address, square_feet, status, verification_status, management_preference, operating_model
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 'VERIFIED', 'SELF_MANAGED', 'FULLY_MANAGED')`,
        [propId, spec.name, spec.type, JSON.stringify(addressPayload), spec.squareFeet]
      );

      // Ownership record (Verified)
      await client.query(
        `INSERT INTO ownership_records (
          id, property_id, owner_id, ownership_percentage, status
        ) VALUES ($1, $2, $3, 100, 'VERIFIED')`,
        [ownId, propId, OWNER_ID]
      );

      // Marketplace listing (Published FOR_RENT)
      await client.query(
        `INSERT INTO listings (
          id, property_id, publisher_user_id, type, price, currency, status, title, description
        ) VALUES ($1, $2, $3, 'FOR_RENT', $4, 'USD', 'PUBLISHED', $5, $6)`,
        [listId, propId, OWNER_ID, spec.price, spec.title, spec.description]
      );
    }

    await client.query('COMMIT');
    console.log(`[Fixture Seed] Successfully seeded ${TEST_RENTAL_SPECS.length} verified rental properties across all categories!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Fixture Seed Error]:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Direct CLI execution
if (process.argv[1]?.endsWith('seed-e2e-rental-search-fixtures.ts')) {
  const isCleanupOnly = process.argv.includes('--cleanup');
  if (isCleanupOnly) {
    cleanupFixtures()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    seedFixtures()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}

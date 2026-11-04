import 'dotenv/config';
import { pool } from '../src/db/index.js';

interface SponsoredCampaignSpec {
  campaignId: string;
  listingId: string;
  propertyId: string;
  campaignType: 'HOME_FEATURED' | 'MULTI_PAGE';
  title: string;
}

const SPONSORED_SPECS: SponsoredCampaignSpec[] = [
  {
    campaignId: 'demo-campaign-hp-01',
    listingId: 'demo-list-apartment-01',
    propertyId: 'demo-sample-apartment-01',
    campaignType: 'HOME_FEATURED',
    title: 'Dream City High-Floor Luxury 2BR',
  },
  {
    campaignId: 'demo-campaign-hp-02',
    listingId: 'demo-list-villa-01',
    propertyId: 'demo-sample-villa-01',
    campaignType: 'HOME_FEATURED',
    title: 'English Village Luxury 5BR Palace Villa',
  },
  {
    campaignId: 'demo-campaign-hp-03',
    listingId: 'demo-list-house-01',
    propertyId: 'demo-sample-house-01',
    campaignType: 'HOME_FEATURED',
    title: 'Traditional Ankawa 3BR Stone Courtyard House',
  },
  {
    campaignId: 'demo-campaign-hp-04',
    listingId: 'demo-list-commercial-01',
    propertyId: 'demo-sample-commercial-01',
    campaignType: 'HOME_FEATURED',
    title: 'Gulan Commercial Boulevard Prime Showroom',
  },
  {
    campaignId: 'demo-campaign-hp-05',
    listingId: 'demo-list-studio-01',
    propertyId: 'demo-sample-studio-01',
    campaignType: 'HOME_FEATURED',
    title: 'Dream City Executive Studio Suite',
  },
  {
    campaignId: 'demo-campaign-hp-06',
    listingId: 'demo-list-office-01',
    propertyId: 'demo-sample-office-01',
    campaignType: 'HOME_FEATURED',
    title: 'World Trade Center Erbil Executive Office Suite',
  },
  {
    campaignId: 'demo-campaign-hp-07',
    listingId: 'demo-list-warehouse-01',
    propertyId: 'demo-sample-warehouse-01',
    campaignType: 'HOME_FEATURED',
    title: 'South Industrial Zone Logistics Hub',
  },
  {
    campaignId: 'demo-campaign-hp-08',
    listingId: 'demo-list-duplex-01',
    propertyId: 'demo-sample-duplex-01',
    campaignType: 'HOME_FEATURED',
    title: 'Dream City Phase 2 Architectural 3BR Duplex Penthouse',
  },
  {
    campaignId: 'demo-campaign-hp-09',
    listingId: 'demo-list-residential-01',
    propertyId: 'demo-sample-residential-01',
    campaignType: 'HOME_FEATURED',
    title: 'New Erbil Turnkey 12-Unit Residential Apartment Building',
  },
  {
    campaignId: 'demo-campaign-hp-10',
    listingId: 'demo-list-apartment-02',
    propertyId: 'demo-sample-apartment-02',
    campaignType: 'HOME_FEATURED',
    title: 'Empire World Royal Tower 3BR Suite',
  },
];

const OWNER_USER_ID = 'demo-verified-owner-90';

export async function seedHomepageSponsoredCampaigns(): Promise<void> {
  const dbRes = await pool.query('SELECT current_database()');
  const currentDb = dbRes.rows[0]?.current_database;
  if (!currentDb || currentDb === 'homehub_production' || currentDb.includes('prod')) {
    throw new Error(`CRITICAL SAFETY ABORT: Refusing to seed test data into production DB (${currentDb})!`);
  }
  console.log(`[Sponsored Seed] Verified safe target database: ${currentDb}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Make sure package exists
    await client.query(`
      INSERT INTO promotion_packages (id, type, name, points_cost, duration_days, placement_scope, is_active, version, description)
      VALUES ('PKG_HOME_FEATURED_7D', 'HOME_FEATURED', 'Homepage Featured Placement (7 Days)', 600, 7, '["HOMEPAGE", "SEARCH"]'::jsonb, true, 1, 'Homepage featured placement')
      ON CONFLICT (id) DO UPDATE SET is_active = true, placement_scope = '["HOMEPAGE", "SEARCH"]'::jsonb;
    `);

    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);  // 30 days ahead

    for (const spec of SPONSORED_SPECS) {
      await client.query(`
        INSERT INTO promotion_campaigns (
          id,
          listing_id,
          property_id,
          requester_user_id,
          payer_user_id,
          package_id,
          package_version,
          campaign_type,
          placement_scope,
          points_cost,
          duration_days,
          status,
          start_time,
          end_time,
          moderation_decision,
          consent_status
        ) VALUES (
          $1, $2, $3, $4, $4, 'PKG_HOME_FEATURED_7D', 1, $5, '["HOMEPAGE", "SEARCH"]'::jsonb, 600, 30, 'ACTIVE', $6, $7, 'APPROVED', 'GRANTED'
        )
        ON CONFLICT (id) DO UPDATE SET
          listing_id = EXCLUDED.listing_id,
          property_id = EXCLUDED.property_id,
          campaign_type = EXCLUDED.campaign_type,
          placement_scope = EXCLUDED.placement_scope,
          status = 'ACTIVE',
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          moderation_decision = 'APPROVED',
          consent_status = 'GRANTED';
      `, [
        spec.campaignId,
        spec.listingId,
        spec.propertyId,
        OWNER_USER_ID,
        spec.campaignType,
        startTime,
        endTime,
      ]);
    }

    await client.query('COMMIT');
    console.log(`[Sponsored Seed] Successfully seeded ${SPONSORED_SPECS.length} active sponsored campaigns for Homepage!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Sponsored Seed Error]:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('seed-homepage-sponsored-campaigns.ts')) {
  seedHomepageSponsoredCampaigns()
    .then(async () => {
      // Test the placement query
      const res = await pool.query(`
        SELECT pc.id, pc.campaign_type, pc.status, p.name as prop_name, p.type as prop_type, l.price
        FROM promotion_campaigns pc
        JOIN listings l ON pc.listing_id = l.id
        JOIN properties p ON l.property_id = p.id
        WHERE pc.status = 'ACTIVE' 
          AND pc.start_time <= NOW() 
          AND pc.end_time > NOW()
          AND (pc.campaign_type IN ('HOME_FEATURED', 'MULTI_PAGE') OR pc.placement_scope::text LIKE '%"HOMEPAGE"%')
          AND l.status = 'PUBLISHED'
          AND p.verification_status = 'VERIFIED'
        ORDER BY pc.start_time DESC
        LIMIT 15;
      `);
      console.log('\nVerified Active Homepage Sponsored Listings:');
      console.table(res.rows);
      console.log(`Total Active Homepage Sponsored Listings: ${res.rows.length}`);
      await pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}


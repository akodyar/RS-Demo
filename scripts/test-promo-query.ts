import { db } from '../src/db/index.js';
import { promotionCampaigns, listings, properties } from '../src/db/schema.js';
import { eq, and, sql, desc, lte, gt } from 'drizzle-orm';

async function testQuery() {
  const effectiveAsOf = new Date();
  
  // Test 1: all campaigns
  const c1 = await db.select().from(promotionCampaigns);
  console.log('Total campaigns:', c1.length);
  const cActive = c1.filter(c => c.status === 'ACTIVE');
  console.log('Active campaigns in Drizzle:', cActive.length, cActive.map(c => ({ id: c.id, type: c.campaignType, start: c.startTime, end: c.endTime, scope: c.placementScope })));

  // Test 2: join listings
  const c2 = await db.select().from(promotionCampaigns)
    .innerJoin(listings, eq(promotionCampaigns.listingId, listings.id));
  console.log('Joined listings:', c2.length);

  // Test 3: join properties
  const c3 = await db.select().from(promotionCampaigns)
    .innerJoin(listings, eq(promotionCampaigns.listingId, listings.id))
    .innerJoin(properties, eq(listings.propertyId, properties.id));
  console.log('Joined properties:', c3.length);

  // Test 4: check where
  for (const row of c3) {
    console.log('Row:', row.promotion_campaigns.id, {
      status: row.promotion_campaigns.status,
      start: row.promotion_campaigns.startTime,
      end: row.promotion_campaigns.endTime,
      effectiveAsOf,
      startOk: row.promotion_campaigns.startTime ? row.promotion_campaigns.startTime <= effectiveAsOf : false,
      endOk: row.promotion_campaigns.endTime ? row.promotion_campaigns.endTime > effectiveAsOf : false,
      listingStatus: row.listings.status,
      propVerif: row.properties.verificationStatus,
    });
  }

  process.exit(0);
}

testQuery().catch(e => {
  console.error(e);
  process.exit(1);
});

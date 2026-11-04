import 'dotenv/config';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { pool } from '../src/db/index.js';

async function verifySearch() {
  console.log('=== Verifying Marketplace Search for All 9 Categories ===\n');

  const categories = [
    { key: 'APARTMENT', labelKu: 'شوقەکان', labelEn: 'Apartments' },
    { key: 'HOUSE', labelKu: 'خانووەکان', labelEn: 'Houses' },
    { key: 'VILLA', labelKu: 'ڤێلاکان', labelEn: 'Villas' },
    { key: 'COMMERCIAL', labelKu: 'بازرگانی', labelEn: 'Commercial' },
    { key: 'STUDIO', labelKu: 'شوقەی ستۆدیۆ', labelEn: 'Studio Apartment' },
    { key: 'OFFICE', labelKu: 'ئۆفیس و نووسینگە', labelEn: 'Office Space' },
    { key: 'WAREHOUSE', labelKu: 'کۆگا و عەمبار', labelEn: 'Warehouse & Storage' },
    { key: 'DUPLEX', labelKu: 'دۆپلێکس', labelEn: 'Duplex' },
    { key: 'RESIDENTIAL', labelKu: 'باڵەخانەی نیشتەجێبوون', labelEn: 'Residential Building' },
  ];

  const results: any[] = [];

  for (const cat of categories) {
    const searchRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      propertyType: cat.key,
      limit: 50,
      offset: 0,
    });

    const demoItems = searchRes.items.filter((item: any) => 
      item.property?.id?.startsWith(`demo-sample-${cat.key.toLowerCase()}`)
    );

    const passed = demoItems.length === 10;
    results.push({
      Category: cat.key,
      Kurdish: cat.labelKu,
      English: cat.labelEn,
      TotalSearchResults: searchRes.total,
      DemoSamplesFound: demoItems.length,
      Status: passed ? 'PASS (10/10)' : `FAIL (${demoItems.length}/10)`,
    });
  }

  console.table(results);

  const allPassed = results.every((r) => r.Status === 'PASS (10/10)');
  if (!allPassed) {
    throw new Error('Not all categories returned 10 demo samples!');
  }

  console.log('\n[VERIFICATION SUCCESS] All 9 property categories have exactly 10 verified, published demo sample records discoverable via Search API!');

  await pool.end();
}

verifySearch().catch((err) => {
  console.error(err);
  process.exit(1);
});


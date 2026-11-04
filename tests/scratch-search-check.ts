import './safe-test-env.js';
import { promotionCampaignRepository } from '../src/server/repositories/promotion-campaign.js';

async function main() {
  const res = await promotionCampaignRepository.searchRentalListings({
    type: 'FOR_RENT',
    limit: 10,
    offset: 0
  });
  console.log('SEARCH RESULTS TOTAL:', res.total, 'ITEMS COUNT:', res.items.length);
  for (const item of res.items) {
    console.log('ITEM:', item.id, item.title, item.price, item.currency, item.property?.name, item.property?.verificationStatus);
  }
  process.exit(0);
}
main();

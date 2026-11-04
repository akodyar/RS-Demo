import { db } from '../src/db/index.js';
import { pointsRewardRules, pointsPurchasePackages, promotionPackages } from '../src/db/schema.js';

async function run() {
  const rules = await db.select().from(pointsRewardRules);
  console.log('--- REWARD RULES ---');
  console.log(JSON.stringify(rules, null, 2));

  const pPackages = await db.select().from(pointsPurchasePackages);
  console.log('--- PURCHASE PACKAGES ---');
  console.log(JSON.stringify(pPackages, null, 2));

  const promoPackages = await db.select().from(promotionPackages);
  console.log('--- PROMOTION PACKAGES ---');
  console.log(JSON.stringify(promoPackages, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

import { db } from './src/db/index.js';
import { organizations } from './src/db/schema.js';

async function main() {
  const orgs = await db.select().from(organizations);
  console.log('Total orgs:', orgs.length);
  for (const o of orgs) {
    console.log(`- ${o.id}: ${o.name} [type=${o.type}, status=${o.status}, verified=${o.verified}]`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'properties' 
    ORDER BY ordinal_position;
  `);
  console.log('PROPERTIES_COLUMNS:', JSON.stringify(res.rows, null, 2));

  const verRes = await db.execute(sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'verification_records' 
    ORDER BY ordinal_position;
  `);
  console.log('VERIFICATION_RECORDS_COLUMNS:', JSON.stringify(verRes.rows, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

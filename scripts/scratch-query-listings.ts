import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/homehub_test',
});

async function main() {
  const targetPropertyId = '60061892-861f-41ca-9a18-14ada57b7370';

  console.log('=== QUERYING LISTINGS FOR PROPERTY ===', targetPropertyId);
  const listingsRes = await pool.query(
    `SELECT id, property_id, publisher_user_id, publisher_company_id, type, price, currency, status, title, description, created_at, updated_at
     FROM listings 
     WHERE property_id = $1
     ORDER BY created_at ASC`,
    [targetPropertyId]
  );
  console.log('COUNT:', listingsRes.rowCount);
  console.log('ROWS:', JSON.stringify(listingsRes.rows, null, 2));

  console.log('\n=== CHECKING ALL TABLES FOR ANCHOR PROPERTY ===');
  const countsRes = await pool.query(`
    SELECT 
      (SELECT count(*) FROM properties WHERE id = $1) AS properties_count,
      (SELECT count(*) FROM ownership_records WHERE property_id = $1) AS ownership_count,
      (SELECT count(*) FROM listings WHERE property_id = $1) AS listings_count,
      (SELECT count(*) FROM rental_applications WHERE property_id = $1) AS applications_count,
      (SELECT count(*) FROM leases WHERE property_id = $1) AS leases_count,
      (SELECT count(*) FROM rent_schedules WHERE property_id = $1) AS schedules_count,
      (SELECT count(*) FROM payment_records WHERE property_id = $1) AS payments_count,
      (SELECT count(*) FROM maintenance_requests WHERE property_id = $1) AS maintenance_count,
      (SELECT count(*) FROM commissions WHERE property_id = $1) AS commissions_count
  `, [targetPropertyId]);
  console.log('ALL COUNTS:', countsRes.rows[0]);

  console.log('\n=== CHECKING COMMISSIONS AND LEDGER FOR RUN e2e_1792485195030 ===');
  const commRes = await pool.query(`
    SELECT id, payment_record_id, property_id, tenant_id, owner_id, commission_type, rate, base_amount, commission_amount, currency, status, policy_version, journal_entry_id
    FROM commissions
    WHERE property_id = $1
  `, [targetPropertyId]);
  console.log('COMMISSIONS:', JSON.stringify(commRes.rows, null, 2));

  if (commRes.rows.length > 0 && commRes.rows[0].journal_entry_id) {
    const journalId = commRes.rows[0].journal_entry_id;
    const ledgerRes = await pool.query(`
      SELECT id, journal_entry_id, account_id, debit, credit, currency
      FROM ledger_lines
      WHERE journal_entry_id = $1
      ORDER BY id ASC
    `, [journalId]);
    console.log('LEDGER LINES:', JSON.stringify(ledgerRes.rows, null, 2));
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

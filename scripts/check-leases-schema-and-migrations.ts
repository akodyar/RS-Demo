import 'dotenv/config';
import { pool } from '../src/db/index';
import fs from 'fs';
import path from 'path';

async function auditPhysicalSchema() {
  console.log('=== AUDITING PHYSICAL LEASES SCHEMA & MIGRATIONS ===\n');

  // 1. Columns of leases table
  const colRes = await pool.query(`
    SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'leases' 
    ORDER BY ordinal_position
  `);
  console.log('1. Physical columns in table "leases":');
  console.table(colRes.rows);

  const hasDepositReconcilCol = colRes.rows.some((r: any) => r.column_name === 'deposit_reconciliation_status');
  console.log(`-> Does "leases" have "deposit_reconciliation_status"? ${hasDepositReconcilCol ? 'YES' : 'NO'}\n`);

  // 2. Check for migration tables across all schemas
  const tablesRes = await pool.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE '%drizzle%' OR table_name LIKE '%migration%'
  `);
  console.log('2. Migration tables in database:');
  console.table(tablesRes.rows);

  if (tablesRes.rows.length > 0) {
    const t = tablesRes.rows[0];
    const migRes = await pool.query(`SELECT * FROM "${t.table_schema}"."${t.table_name}" ORDER BY id`);
    console.log(`Contents of ${t.table_schema}.${t.table_name}:`);
    console.table(migRes.rows);
  } else {
    console.log('No drizzle migration table found in information_schema.tables.');
  }

  // 3. Migration files in drizzle/
  const drizzleDir = path.resolve(process.cwd(), 'drizzle');
  const files = fs.readdirSync(drizzleDir).filter((f: string) => f.endsWith('.sql')).sort();
  console.log('3. Migration files on disk (drizzle/):');
  files.forEach((f: string) => console.log('  -', f));

  // 4. Check actual row for lease_lc_mve3rmb8
  const leaseRow = await pool.query(`
    SELECT id, status, deposit_reconciliation_status, rent_amount, deposit_amount 
    FROM leases 
    WHERE id = 'lease_lc_mve3rmb8'
  `);
  console.log('4. Stored data for lease_lc_mve3rmb8:');
  console.table(leaseRow.rows);

  // 5. Trace Payment Record pay_lc_mve3rmb8
  const payRow = await pool.query(`SELECT * FROM payment_records WHERE id = 'pay_lc_mve3rmb8'`);
  console.log('\n5. Payment Record pay_lc_mve3rmb8:');
  console.table(payRow.rows);

  // 6. Trace Rent Schedule sched_lc_mve3rmb8
  const schedRow = await pool.query(`SELECT id, lease_id, status, amount, paid_amount, due_date FROM rent_schedules WHERE id = 'sched_lc_mve3rmb8'`);
  console.log('\n6. Rent Schedule sched_lc_mve3rmb8:');
  console.table(schedRow.rows);

  // 7. Trace Commission Record
  const commRow = await pool.query(`SELECT * FROM commissions WHERE payment_record_id = 'pay_lc_mve3rmb8'`);
  console.log('\n7. Commission Record for pay_lc_mve3rmb8:');
  console.table(commRow.rows);

  if (commRow.rows.length > 0) {
    const commId = commRow.rows[0].id;
    const jeId = commRow.rows[0].journal_entry_id;

    // 8. Trace Journal Entry & Ledger Lines
    const jeRow = await pool.query(`SELECT * FROM journal_entries WHERE id = $1`, [jeId]);
    console.log(`\n8a. Journal Entry (${jeId}):`);
    console.table(jeRow.rows);

    const linesRow = await pool.query(`SELECT * FROM ledger_lines WHERE journal_entry_id = $1 ORDER BY account_id`, [jeId]);
    console.log(`\n8b. Ledger Lines for Journal Entry (${jeId}):`);
    console.table(linesRow.rows);

    let totalDebit = 0;
    let totalCredit = 0;
    linesRow.rows.forEach(l => {
      totalDebit += Number(l.debit || 0);
      totalCredit += Number(l.credit || 0);
    });
    console.log(`-> Sum of Debits: ${totalDebit} | Sum of Credits: ${totalCredit} | Balanced: ${totalDebit === totalCredit ? 'YES (PASS)' : 'NO (FAIL)'}`);

    // 9. Trace Audit Logs
    const auditRow = await pool.query(`SELECT id, timestamp, actor_user_id, action, resource_type, resource_id, changes FROM audit_logs WHERE resource_id = $1`, [commId]);
    console.log(`\n9. Audit Trail for Commission (${commId}):`);
    console.table(auditRow.rows.map(r => ({
      timestamp: r.timestamp,
      actor: r.actor_user_id,
      action: r.action,
      resourceType: r.resource_type,
      changes: JSON.stringify(r.changes)
    })));
  }

  await pool.end();
}

auditPhysicalSchema().catch((e: any) => {
  console.error(e);
  process.exit(1);
});

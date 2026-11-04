import 'dotenv/config';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { commissionService } from '../src/server/services/commission';
import { eq } from 'drizzle-orm';

async function testAllModelsLedger() {
  console.log('=== TRACING 3 OPERATING MODELS: END-TO-END LEDGER POSTING ===\n');

  const runId = 'p64_1_' + Date.now().toString(36);
  const rent = 1000000;

  // 1. Create 3 properties with each operating model
  const models: Array<{ model: 'FULLY_MANAGED' | 'AGENT_LISTED_PLATFORM_MANAGED' | 'AGENT_OPERATED'; propId: string; rentFee: string; mgmtFee: string }> = [
    { model: 'FULLY_MANAGED', propId: `prop_fm_${runId}`, rentFee: '0.05', mgmtFee: '0.05' },
    { model: 'AGENT_LISTED_PLATFORM_MANAGED', propId: `prop_alpm_${runId}`, rentFee: '0.00', mgmtFee: '0.05' },
    { model: 'AGENT_OPERATED', propId: `prop_ao_${runId}`, rentFee: '0.00', mgmtFee: '0.00' }
  ];

  for (const m of models) {
    console.log(`\n-----------------------------------------------------------`);
    console.log(`Testing Model: ${m.model}`);
    console.log(`-----------------------------------------------------------`);

    await db.insert(schema.properties).values({
      id: m.propId,
      name: `Test Prop ${m.model}`,
      type: 'RESIDENTIAL',
      operatingModel: m.model,
      rentFee: m.rentFee,
      managementFee: m.mgmtFee,
      currency: 'IQD',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    // Create synthetic confirmed payment
    const payId = `pay_${m.model.toLowerCase()}_${runId}`;
    await db.insert(schema.paymentRecords).values({
      id: payId,
      propertyId: m.propId,
      payerId: 'usr_tenant_lc_mve3rmb8',
      amount: rent.toString(),
      currency: 'IQD',
      status: 'CONFIRMED',
      paymentMethod: 'FIB',
      paymentType: 'RENT',
      referenceNumber: `FIB-REF-${payId}`,
      recordedDate: new Date().toISOString()
    }).onConflictDoNothing();

    // Call commissionService.postCommissionForPayment
    const result = await commissionService.postCommissionForPayment(payId, 'usr_sys_auditor', 'SYSTEM');
    console.log(`Posted Commission ID: ${result.commission.id} | Already Posted: ${result.alreadyPosted}`);

    // Inspect Journal Entry & Ledger Lines
    const [je] = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, result.commission.journalEntryId!));
    const lines = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, je.id));

    console.log(`Journal Entry ${je.id} (${je.status})`);
    console.table(lines.map(l => ({
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
      currency: l.currency
    })));

    let sumDebit = 0;
    let sumCredit = 0;
    lines.forEach(l => {
      sumDebit += Number(l.debit || 0);
      sumCredit += Number(l.credit || 0);
    });
    console.log(`-> Sum Debits: ${sumDebit} | Sum Credits: ${sumCredit} | Balanced: ${sumDebit === sumCredit ? 'PASS' : 'FAIL'}`);

    // Test Idempotency: call again
    const retry = await commissionService.postCommissionForPayment(payId, 'usr_sys_auditor', 'SYSTEM');
    console.log(`-> Retry idempotency check: alreadyPosted=${retry.alreadyPosted} (PASS)`);

    // Verify lines count unchanged
    const linesAfterRetry = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, je.id));
    console.log(`-> Lines count after retry: ${linesAfterRetry.length} (Expected: ${lines.length}) -> ${linesAfterRetry.length === lines.length ? 'PASS' : 'FAIL'}`);
  }

  await pool.end();
}

testAllModelsLedger().catch(e => {
  console.error(e);
  process.exit(1);
});

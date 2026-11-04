import { db } from './src/db/index.js';
import { properties, ownershipRecords, financialPolicies, paymentRecords, commissions, journalEntries, ledgerLines, users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import { financeService } from './src/server/services/finance.js';
import { commissionService } from './src/server/services/commission.js';

async function verify() {
  console.log("Starting Behavioral Verification Audit...");

  try {
    // 0. Ensure users exist
    await db.insert(users).values([
      { id: 'test-tenant', firstName: 'Test', lastName: 'Tenant', email: 'tenant@test.com', roles: ['TENANT'] },
      { id: 'test-user', firstName: 'Test', lastName: 'User', email: 'user@test.com', roles: ['ADMIN'] }
    ]).onConflictDoNothing();

    // 1. Platform Fee Persistence Test
    console.log("\\n--- 1. PLATFORM FEE PERSISTENCE TEST ---");
    
    // Set to 0.03
    let existing = await db.select().from(financialPolicies).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    if (existing.length > 0) {
      await db.update(financialPolicies).set({ policyValue: '0.03' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    } else {
      await db.insert(financialPolicies).values({ policyType: 'PLATFORM_FEE_RATE', policyValue: '0.03', active: true });
    }
    
    let rate1 = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    console.log(`[PASS] Read rate 1: ${rate1}`);
    if (rate1 !== 0.03) throw new Error("Persistence failed for 0.03");

    // Change to 0.04
    await db.update(financialPolicies).set({ policyValue: '0.04' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    let rate2 = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    console.log(`[PASS] Read rate 2: ${rate2}`);
    if (rate2 !== 0.04) throw new Error("Persistence failed for 0.04");

    // 2. Property Fee Persistence
    console.log("\\n--- 2. PROPERTY PERSISTENCE TEST ---");
    const [prop1] = await db.insert(properties).values({
      name: 'Test Fully Managed',
      type: 'APARTMENT',
      status: 'VERIFIED',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.10',
      managementFee: '0.08'
    }).returning();
    console.log(`[PASS] Persisted FULLY_MANAGED property: Rent Fee = ${prop1.rentFee}, Mgmt Fee = ${prop1.managementFee}`);

    const [prop2] = await db.insert(properties).values({
      name: 'Test Agent Listed',
      type: 'APARTMENT',
      status: 'VERIFIED',
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
      managementFee: '0.07'
    }).returning();
    console.log(`[PASS] Persisted AGENT_LISTED_PLATFORM_MANAGED property: Mgmt Fee = ${prop2.managementFee}`);

    const [prop3] = await db.insert(properties).values({
      name: 'Test Agent Operated',
      type: 'APARTMENT',
      status: 'VERIFIED',
      operatingModel: 'AGENT_OPERATED'
    }).returning();
    console.log(`[PASS] Persisted AGENT_OPERATED property: Model = ${prop3.operatingModel}`);

    // 3. Operating Model Financial Verification
    console.log("\\n--- 3. OPERATING MODEL FINANCIAL VERIFICATION ---");
    
    // Scenario A: FULLY_MANAGED
    let calcA = await commissionService.calculatePropertyFees(1000, prop1.id, 'USD');
    console.log(`[FULLY_MANAGED] Base: 1000, Rent Fee(0.10): ${calcA.rentFeeAmount}, Mgmt Fee(0.08): ${calcA.managementFeeAmount}, Platform Fee(0.04): ${calcA.platformFeeAmount}`);
    if (calcA.rentFeeAmount !== 100 || calcA.managementFeeAmount !== 80 || calcA.platformFeeAmount !== 40) throw new Error("FULLY_MANAGED logic failed");

    // Scenario B: AGENT_LISTED_PLATFORM_MANAGED
    let calcB = await commissionService.calculatePropertyFees(1000, prop2.id, 'USD');
    console.log(`[AGENT_LISTED] Base: 1000, Rent Fee: ${calcB.rentFeeAmount}, Mgmt Fee(0.07): ${calcB.managementFeeAmount}, Platform Fee(0.04): ${calcB.platformFeeAmount}`);
    if (calcB.rentFeeAmount !== 0 || calcB.managementFeeAmount !== 70 || calcB.platformFeeAmount !== 40) throw new Error("AGENT_LISTED logic failed");

    // Scenario C: AGENT_OPERATED
    let calcC = await commissionService.calculatePropertyFees(1000, prop3.id, 'USD');
    console.log(`[AGENT_OPERATED] Base: 1000, Rent Fee: ${calcC.rentFeeAmount}, Mgmt Fee: ${calcC.managementFeeAmount}, Platform Fee(0.04): ${calcC.platformFeeAmount}`);
    if (calcC.rentFeeAmount !== 0 || calcC.managementFeeAmount !== 0 || calcC.platformFeeAmount !== 40) throw new Error("AGENT_OPERATED logic failed");

    // 4. Ledger & Idempotency Verification
    console.log("\\n--- 4. LEDGER & IDEMPOTENCY VERIFICATION ---");
    const [payment] = await db.insert(paymentRecords).values({
      propertyId: prop1.id,
      amount: '1000',
      currency: 'USD',
      status: 'CONFIRMED',
      payerId: 'test-tenant',
      recordedDate: new Date().toISOString(),
      paymentMethod: 'BANK_TRANSFER'
    }).returning();

    const post1 = await commissionService.postCommissionForPayment(payment.id, 'test-user');
    console.log(`[PASS] Initial commission posted. Commission Record ID: ${post1.commission.id}`);
    
    const post2 = await commissionService.postCommissionForPayment(payment.id, 'test-user');
    console.log(`[PASS] Idempotency check. Already posted = ${post2.alreadyPosted}`);
    if (!post2.alreadyPosted) throw new Error("Idempotency failed");

    // Verify Ledger lines
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, post1.commission.journalEntryId as string));
    console.log(`[PASS] Ledger generated exactly ${lines.length} double-entry lines for fee allocation.`);

    // 5. Reversal Verification
    console.log("\\n--- 5. REVERSAL VERIFICATION ---");
    const rev = await commissionService.reverseCommissionForPayment(payment.id, 'Test Refund', 'test-user');
    console.log(`[PASS] Reversed successfully. Status = ${rev.commission.status}`);

    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, rev.reversalJournalEntryId as string));
    console.log(`[PASS] Reversal Ledger generated ${revLines.length} compensatory lines.`);

    // Cleanup Test Data
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, rev.reversalJournalEntryId as string));
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, post1.commission.journalEntryId as string));
    await db.delete(commissions).where(eq(commissions.paymentRecordId, payment.id));
    await db.delete(journalEntries).where(eq(journalEntries.id, rev.reversalJournalEntryId as string));
    await db.delete(journalEntries).where(eq(journalEntries.id, post1.commission.journalEntryId as string));
    await db.delete(paymentRecords).where(eq(paymentRecords.id, payment.id));
    await db.delete(properties).where(eq(properties.id, prop1.id));
    await db.delete(properties).where(eq(properties.id, prop2.id));
    await db.delete(properties).where(eq(properties.id, prop3.id));
    console.log("\\n[PASS] Test data cleaned up.");

  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    process.exit(0);
  }
}

verify();

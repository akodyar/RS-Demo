import 'dotenv/config';
import { db } from './src/db/index.js';
import { properties, financialPolicies, paymentRecords, journalEntries, commissions, leases, users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import { commissionService } from './src/server/services/commission.js';

async function testFinancials() {
  console.log("=== 2. PLATFORM FEE POLICY SNAPSHOT ===");
  const [prop] = await db.insert(properties).values({ name: 'FinProp', type: 'RESIDENTIAL', status: 'ACTIVE', ownerId: 'user_owner_01', operatingModel: 'FULLY_MANAGED', rentFee: '0.02', managementFee: '0.10' }).returning();
  const [lease] = await db.insert(leases).values({ propertyId: prop.id, startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'ACTIVE', rentAmount: '1000' }).returning();
  const [payment] = await db.insert(paymentRecords).values({ propertyId: prop.id, leaseId: lease.id, payerId: 'user_tenant_01', amount: '1000', currency: 'USD', status: 'CONFIRMED', recordedDate: new Date().toISOString() }).returning();
  
  // Set policy X
  await db.delete(financialPolicies);
  await db.insert(financialPolicies).values({
    policyType: 'PLATFORM_FEE_RATE', policyValue: '0.05'
  });

  // Confirm P
  await commissionService.postCommissionForPayment(payment.id, prop.id, 'admin_01', 'SUPER_ADMIN');

  // Change Policy
  await db.update(financialPolicies).set({ policyValue: '0.08' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));

  // Inspect
  const [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
  console.log(`Original fee: ${comm.commissionAmount} (Rate 0.05 + 0.10 + 0.02 = 17% of 1000 = 170)`);

  // Reverse P
  await commissionService.reverseCommissionForPayment(payment.id, "test", 'admin_01', 'SUPER_ADMIN');
  const reversedComms = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
  console.log(`Reversal amount: ${reversedComms.length > 1 ? reversedComms[1].commissionAmount : 'no reversal row'}`);

  console.log("=== 3. MONEY / ROUNDING ===");
  const testAmounts = [
    { currency: 'IQD', amount: 1000000, rate: 0.17, desc: "Normal" },
    { currency: 'IQD', amount: 333333, rate: 0.17, desc: "Fractional" },
    { currency: 'IQD', amount: 999999999, rate: 0.17, desc: "High value" },
    { currency: 'USD', amount: 1000, rate: 0.17, desc: "Normal" },
    { currency: 'USD', amount: 333.33, rate: 0.17, desc: "Fractional" },
    { currency: 'USD', amount: 999999, rate: 0.17, desc: "High value" }
  ];

  for (const t of testAmounts) {
    const p = await db.insert(paymentRecords).values({ propertyId: prop.id, leaseId: lease.id, payerId: 'user_tenant_01', amount: t.amount.toString(), currency: t.currency, status: 'CONFIRMED', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(p[0].id, prop.id, 'admin_01', 'SUPER_ADMIN');
    const [c] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p[0].id));
    console.log(`${t.desc} ${t.currency} ${t.amount} -> Fee: ${c.commissionAmount} (Expected: Math.round(${t.amount} * ${t.rate}))`);
  }

  console.log("=== 4. PARTIAL PAYMENTS ===");
  // Create 2 payments for same lease
  const p1 = await db.insert(paymentRecords).values({ propertyId: prop.id, leaseId: lease.id, payerId: 'user_tenant_01', amount: '400000', currency: 'IQD', status: 'CONFIRMED', recordedDate: new Date().toISOString() }).returning();
  const p2 = await db.insert(paymentRecords).values({ propertyId: prop.id, leaseId: lease.id, payerId: 'user_tenant_01', amount: '600000', currency: 'IQD', status: 'CONFIRMED', recordedDate: new Date().toISOString() }).returning();

  await commissionService.postCommissionForPayment(p1[0].id, prop.id, 'admin_01', 'SUPER_ADMIN');
  const [c1] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p1[0].id));
  console.log(`P1 (400,000) -> Fee: ${c1.commissionAmount}`);

  await commissionService.postCommissionForPayment(p2[0].id, prop.id, 'admin_01', 'SUPER_ADMIN');
  const [c2] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p2[0].id));
  console.log(`P2 (600,000) -> Fee: ${c2.commissionAmount}`);

}
testFinancials().catch(console.error).then(() => process.exit(0));

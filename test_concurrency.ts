import { db } from './src/db/index.js';
import { paymentRecords, commissions, journalEntries } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function testConcurrency() {
  console.log("=== GATE 7 & 8: IDEMPOTENCY AND CONCURRENCY ===");
  
  const { properties } = await import('./src/db/schema.js');
  const [prop] = await db.insert(properties).values({ name: 'Conc Test Prop', type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED', rentFee: '0.05', managementFee: '0.1' }).returning();

  // Create payment
  const [payment] = await db.insert(paymentRecords).values({
    propertyId: prop.id,
    amount: '500',
    currency: 'USD',
    status: 'RECORDED',
    payerId: 'user_tenant_01',
    dueDate: new Date().toISOString(),
    paymentMethod: 'CASH',
    recordedDate: new Date().toISOString()
  }).returning();

  console.log("Payment created:", payment.id);

  // Send two requests concurrently
  const req1 = fetch(`http://localhost:3000/api/leases/payments/${payment.id}/confirm`, { method: 'POST', headers: { 'Authorization': `Bearer dev-super-admin` }});
  const req2 = fetch(`http://localhost:3000/api/leases/payments/${payment.id}/confirm`, { method: 'POST', headers: { 'Authorization': `Bearer dev-super-admin` }});
  
  const [res1, res2] = await Promise.all([req1, req2]);
  console.log("Concurrent Confirm Res 1:", res1.status, await res1.text());
  console.log("Concurrent Confirm Res 2:", res2.status, await res2.text());
  
  // Verify DB
  const comms = await db.query.commissions.findMany({ where: eq(commissions.paymentRecordId, payment.id) });
  console.log("Commissions created:", comms.length);
  
  const updatedPayment = await db.query.paymentRecords.findFirst({ where: eq(paymentRecords.id, payment.id) });
  console.log("Payment status:", updatedPayment.status);

  // Now test concurrent reversals
  const rev1 = fetch(`http://localhost:3000/api/leases/payments/${payment.id}/reverse`, { method: 'POST', headers: { 'Authorization': `Bearer dev-super-admin`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: "Duplicate rev test" })});
  const rev2 = fetch(`http://localhost:3000/api/leases/payments/${payment.id}/reverse`, { method: 'POST', headers: { 'Authorization': `Bearer dev-super-admin`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: "Duplicate rev test" })});
  
  const [rr1, rr2] = await Promise.all([rev1, rev2]);
  console.log("Concurrent Reverse Res 1:", rr1.status, await rr1.text());
  console.log("Concurrent Reverse Res 2:", rr2.status, await rr2.text());
  
  const revs = await db.query.journalEntries.findMany({ where: eq(journalEntries.referenceId, comms[0]?.id || '') });
  console.log("Reversal Journal Entries created:", revs.filter(r => r.referenceType === 'FEE_REVERSAL').length);
}

testConcurrency().then(() => process.exit(0)).catch(console.error);

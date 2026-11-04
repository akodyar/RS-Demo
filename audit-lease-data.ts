import { db } from './src/db/index.js';
import { leases, units } from './src/db/schema.js';
import { eq, or, and, lte, gte, isNull, ne, sql } from 'drizzle-orm';

async function auditData() {
  console.log("Starting Read-Only Audit of Lease Data...\n");

  // 1. Cross-property unit mismatch
  // SELECT leases.id, leases.property_id AS lease_property, units.property_id AS unit_property
  // FROM leases JOIN units ON leases.unit_id = units.id
  // WHERE leases.property_id != units.property_id
  const mismatchedLeases = await db
    .select({
      leaseId: leases.id,
      leasePropertyId: leases.propertyId,
      unitId: leases.unitId,
      unitPropertyId: units.propertyId
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .where(ne(leases.propertyId, units.propertyId));

  console.log(`[Cross-Property Unit Mismatch] Found: ${mismatchedLeases.length}`);
  if (mismatchedLeases.length > 0) {
    mismatchedLeases.forEach(m => console.log(` - Lease ${m.leaseId}: Lease Prop: ${m.leasePropertyId}, Unit Prop: ${m.unitPropertyId}`));
  }
  
  console.log("");

  // 2. Overlapping property-level leases (unitId = null)
  // We can do a self join to find overlapping date ranges.
  // leases a, leases b
  // a.id != b.id AND a.propertyId = b.propertyId AND a.unitId IS NULL AND b.unitId IS NULL
  // AND a.status IN (ACTIVE, PENDING_APPROVAL) AND b.status IN (ACTIVE, PENDING_APPROVAL)
  // AND a.startDate <= b.endDate AND a.endDate >= b.startDate
  // For simplicity, we can fetch all relevant leases and check in memory, or use raw SQL.
  const propertyLeases = await db
    .select({
      id: leases.id,
      propertyId: leases.propertyId,
      startDate: leases.startDate,
      endDate: leases.endDate,
      status: leases.status
    })
    .from(leases)
    .where(and(
      isNull(leases.unitId),
      or(eq(leases.status, 'ACTIVE'), eq(leases.status, 'PENDING_APPROVAL'))
    ));

  let overlapCount = 0;
  const overlapPairs: string[] = [];

  for (let i = 0; i < propertyLeases.length; i++) {
    for (let j = i + 1; j < propertyLeases.length; j++) {
      const a = propertyLeases[i];
      const b = propertyLeases[j];

      if (a.propertyId === b.propertyId) {
        // Date overlap logic
        const startA = new Date(a.startDate).getTime();
        const endA = new Date(a.endDate).getTime();
        const startB = new Date(b.startDate).getTime();
        const endB = new Date(b.endDate).getTime();

        if (startA <= endB && endA >= startB) {
          overlapCount++;
          overlapPairs.push(` - Property ${a.propertyId} has overlapping leases: ${a.id} (${a.startDate} to ${a.endDate}) AND ${b.id} (${b.startDate} to ${b.endDate})`);
        }
      }
    }
  }

  console.log(`[Property-Level Overlapping Leases] Found: ${overlapCount}`);
  if (overlapCount > 0) {
    overlapPairs.forEach(p => console.log(p));
  }
  
  console.log("\nTotal Leases Scanned:", await db.select({ count: sql<number>`count(*)` }).from(leases).then(res => res[0].count));
  process.exit(0);
}

auditData().catch(e => {
  console.error("Audit failed:", e);
  process.exit(1);
});

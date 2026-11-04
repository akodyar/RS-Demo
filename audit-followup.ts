import { db } from './src/db/index.js';
import { leases, units, properties } from './src/db/schema.js';
import { eq, or, and, lte, gte, isNull, ne } from 'drizzle-orm';

async function auditFollowup() {
  console.log("--- Cross-Property Mismatches ---");
  const mismatchedLeases = await db
    .select({
      leaseId: leases.id,
      leasePropId: leases.propertyId,
      leasePropName: properties.name,
      unitId: leases.unitId,
      unitPropId: units.propertyId,
    })
    .from(leases)
    .innerJoin(units, eq(leases.unitId, units.id))
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .where(ne(leases.propertyId, units.propertyId));

  for (const m of mismatchedLeases) {
    // get unit prop name
    const [uProp] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, m.unitPropId!));
    console.log(`Lease: ${m.leaseId}`);
    console.log(`  Lease Prop: ${m.leasePropId} (${m.leasePropName})`);
    console.log(`  Unit Prop:  ${m.unitPropId} (${uProp?.name})`);
  }

  console.log("\n--- Overlapping Leases ---");
  const propertyLeases = await db
    .select({
      id: leases.id,
      propertyId: leases.propertyId,
      propertyName: properties.name,
      startDate: leases.startDate,
      endDate: leases.endDate,
      status: leases.status
    })
    .from(leases)
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .where(and(
      isNull(leases.unitId),
      or(eq(leases.status, 'ACTIVE'), eq(leases.status, 'PENDING_APPROVAL'))
    ));

  let overlapCount = 0;
  const overlapsByPropName: Record<string, number> = {};

  for (let i = 0; i < propertyLeases.length; i++) {
    for (let j = i + 1; j < propertyLeases.length; j++) {
      const a = propertyLeases[i];
      const b = propertyLeases[j];

      if (a.propertyId === b.propertyId) {
        const startA = new Date(a.startDate).getTime();
        const endA = new Date(a.endDate).getTime();
        const startB = new Date(b.startDate).getTime();
        const endB = new Date(b.endDate).getTime();

        if (startA <= endB && endA >= startB) {
          overlapCount++;
          const pName = a.propertyName || 'Unknown';
          overlapsByPropName[pName] = (overlapsByPropName[pName] || 0) + 1;
        }
      }
    }
  }

  console.log(`Total Overlapping Pairs: ${overlapCount}`);
  console.log("Overlaps by Property Name:");
  for (const [name, count] of Object.entries(overlapsByPropName)) {
    console.log(`  - ${name}: ${count} pairs`);
  }

  process.exit(0);
}

auditFollowup().catch(console.error);

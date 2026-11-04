import { describe, it } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { leases } from '../src/db/schema.js';
import { eq, or, and, lte, gte, isNull } from 'drizzle-orm';
import { LeaseStatus } from '../src/types/index.js';

// We simulate the exact logic of createLease inside a concurrent scenario.
async function simulateCreateLease(propertyId: string, unitId: string | null, startDate: string, endDate: string) {
  return await db.transaction(async (tx) => {
    // 1. Check for overlaps
    const overlapConditions = [
      or(
        eq(leases.status, LeaseStatus.ACTIVE),
        eq(leases.status, LeaseStatus.PENDING_APPROVAL)
      ),
      lte(leases.startDate, endDate),
      gte(leases.endDate, startDate)
    ];

    if (unitId) {
      overlapConditions.push(eq(leases.unitId, unitId));
    } else {
      overlapConditions.push(eq(leases.propertyId, propertyId));
      overlapConditions.push(isNull(leases.unitId));
    }

    // Artificial delay to widen the race condition window
    await new Promise(resolve => setTimeout(resolve, 50));

    const overlaps = await tx.query.leases.findMany({
      where: and(...overlapConditions)
    });

    if (overlaps.length > 0) {
      throw new Error("Lease period overlaps with an existing active or pending lease for this property/unit.");
    }

    // 2. Insert the lease. We'll insert it as ACTIVE to simulate if createLease were activating it,
    // OR we just insert as DRAFT to see if they both insert. The prompt asks about createLease.
    // Let's insert as ACTIVE to see if the READ COMMITTED allows both to insert!
    const [newLease] = await tx.insert(leases).values({
      propertyId,
      unitId,
      startDate,
      endDate,
      rentAmount: '1000',
      status: LeaseStatus.ACTIVE, // simulating the worst case race condition
    }).returning();

    return newLease;
  });
}

describe('Concurrency Audit', () => {
  it('should allow concurrent conflicting leases due to lack of constraints', async () => {
    const propId = 'prop-1'; // Assume valid
    const unitId = null; // property-level

    try {
      const results = await Promise.all([
        simulateCreateLease(propId, unitId, '2025-01-01', '2025-12-31'),
        simulateCreateLease(propId, unitId, '2025-01-01', '2025-12-31')
      ]);
      console.log('Both succeeded:', results);
    } catch (e) {
      console.log('Error caught:', e);
    }
  });
});

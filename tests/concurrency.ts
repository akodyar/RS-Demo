import { LeaseRepository } from '../src/server/repositories/leases.js';

async function testConcurrency() {
  const leaseRepo = new LeaseRepository();
  const propertyId = 'prop-1'; // Assume valid property ID
  
  // To simulate, we'll run two createLease calls concurrently
  try {
    const results = await Promise.all([
      leaseRepo.createLease(propertyId, null, [], '2024-01-01', '2024-12-31', 1000),
      leaseRepo.createLease(propertyId, null, [], '2024-01-01', '2024-12-31', 1000)
    ]);
    console.log("Both succeeded!", results);
  } catch (e) {
    console.log("One or both failed:", e);
  }
}
testConcurrency();

import { db } from './src/db/index.js';
import { LeaseRepository } from './src/server/repositories/leases.js';

async function test() {
  const repo = new LeaseRepository();
  const schedules = await repo.generateRentSchedule('L1', 'P1', 'T1', 'U1', '2024-01-31T00:00:00.000Z', '2024-04-30T00:00:00.000Z', 1000);
  console.log(schedules.map(s => s.periodStart));
  process.exit(0);
}
test().catch(console.error);

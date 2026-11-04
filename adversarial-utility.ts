import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { utilityBillRepository } from './src/server/repositories/utility-bills';
import { auditService } from './src/server/services/audit';
import * as crypto from 'crypto';

async function runAdversarialTests() {
  console.log('Starting Adversarial Audit for Utility Billing Domain');
  
  const sqlClient = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sqlClient, { schema });

  try {
    // 1. Database schema check
    const tables = await sqlClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('utility_bills', 'utility_payments');
    `;
    console.log(`Tables found: ${tables.map(t => t.table_name).join(', ')}`);
    
    // Check columns
    const columns = await sqlClient`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'utility_bills';
    `;
    console.log(`utility_bills columns count: ${columns.length}`);

    // Create test data
    const ownerAId = crypto.randomUUID();
    const ownerBId = crypto.randomUUID();
    const tenantAId = crypto.randomUUID();
    const tenantBId = crypto.randomUUID();
    const propAId = crypto.randomUUID();
    const propBId = crypto.randomUUID();
    const unitAId = crypto.randomUUID();
    const unitBId = crypto.randomUUID();
    const leaseAId = crypto.randomUUID();
    
    // Seed DB
    await db.insert(schema.users).values([
      { id: ownerAId, email: 'owner.a@example.com', passwordHash: 'hash', role: 'OWNER', firstName: 'Owner', lastName: 'A', status: 'ACTIVE' },
      { id: ownerBId, email: 'owner.b@example.com', passwordHash: 'hash', role: 'OWNER', firstName: 'Owner', lastName: 'B', status: 'ACTIVE' },
      { id: tenantAId, email: 'tenant.a@example.com', passwordHash: 'hash', role: 'TENANT', firstName: 'Tenant', lastName: 'A', status: 'ACTIVE' },
      { id: tenantBId, email: 'tenant.b@example.com', passwordHash: 'hash', role: 'TENANT', firstName: 'Tenant', lastName: 'B', status: 'ACTIVE' },
    ]);
    
    await db.insert(schema.ownershipRecords).values([
      { id: crypto.randomUUID(), ownerId: ownerAId, ownershipType: 'INDIVIDUAL', status: 'VERIFIED', verifiedAt: new Date() },
      { id: crypto.randomUUID(), ownerId: ownerBId, ownershipType: 'INDIVIDUAL', status: 'VERIFIED', verifiedAt: new Date() }
    ]);
    
    await db.insert(schema.properties).values([
      { id: propAId, ownerId: ownerAId, name: 'Prop A', type: 'RESIDENTIAL', status: 'ACTIVE' },
      { id: propBId, ownerId: ownerBId, name: 'Prop B', type: 'RESIDENTIAL', status: 'ACTIVE' }
    ]);
    
    await db.insert(schema.units).values([
      { id: unitAId, propertyId: propAId, unitNumber: '101', status: 'OCCUPIED' },
      { id: unitBId, propertyId: propBId, unitNumber: '201', status: 'OCCUPIED' }
    ]);
    
    await db.insert(schema.leases).values([
      { id: leaseAId, propertyId: propAId, unitId: unitAId, tenantId: tenantAId, startDate: '2025-01-01', endDate: '2025-12-31', rentAmount: '1000', currency: 'IQD', status: 'ACTIVE' }
    ]);

    // Create a bill
    const billA1 = await utilityBillRepository.createBill({
      propertyId: propAId,
      unitId: unitAId,
      tenantId: tenantAId,
      leaseId: leaseAId,
      type: 'WATER',
      amount: '50',
      currency: 'USD',
      billingDate: '2026-01-01',
      dueDate: '2026-01-15'
    }, { id: 'admin1', roles: ['ADMIN'] });
    
    console.log(`Created Bill A1: ${billA1.id}`);
    
    // Test Tenant B attempting to access Tenant A's bill
    const tenantBBills = await utilityBillRepository.getTenantBills(tenantBId);
    console.log(`Tenant B sees ${tenantBBills.length} bills (Expected: 0)`);
    
    try {
      await utilityBillRepository.payBill(billA1.id, '50', 'CASH', { id: tenantBId, roles: ['TENANT'] });
      console.log('❌ Tenant B successfully paid Tenant A bill!');
    } catch (e: any) {
      console.log(`✅ Tenant B payment blocked: ${e.message}`);
    }
    
    // Concurrency / Duplicate test
    console.log('Testing concurrency on payBill...');
    try {
      const p1 = utilityBillRepository.payBill(billA1.id, '30', 'SYSTEM', { id: tenantAId, roles: ['TENANT'] });
      const p2 = utilityBillRepository.payBill(billA1.id, '30', 'SYSTEM', { id: tenantAId, roles: ['TENANT'] });
      await Promise.allSettled([p1, p2]);
      
      const billAfter = await db.select().from(schema.utilityBills).where(eq(schema.utilityBills.id, billA1.id));
      console.log(`Bill outstanding amount after 2x concurrent $30 payments on a $50 bill: ${billAfter[0].outstandingAmount}`);
    } catch (e: any) {
      console.log(`Concurrency error: ${e.message}`);
    }
    
  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    await sqlClient.end();
  }
}

runAdversarialTests();

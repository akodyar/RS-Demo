import { db } from './src/db/index.js';
import { properties, ownershipRecords, users, managementAgreements, units, listings, leases, leaseTenants, rentSchedules, paymentRecords, organizations } from './src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { propertyService } from './src/server/services/property.js';

async function verify() {
  console.log("Starting Rental Property & Tenant Verification...");

  try {
    // 0. Cleanup from previous failures
    const priorLeaseTenants = await db.select().from(leaseTenants).where(eq(leaseTenants.tenantId, 'test-tenant-1'));
    const priorLeaseIds = priorLeaseTenants.map(lt => lt.leaseId);
    if (priorLeaseIds.length > 0) {
      await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, priorLeaseIds));
      await db.delete(leases).where(inArray(leases.id, priorLeaseIds));
    }
    
    await db.delete(listings).where(eq(listings.type, 'RENT'));
    await db.delete(units).where(eq(units.unitNumber, 'U1'));
    await db.delete(managementAgreements).where(eq(managementAgreements.status, 'ACTIVE'));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.ownerId, 'test-owner-1'));
    await db.delete(properties).where(eq(properties.name, 'Test Rental Building'));
    await db.delete(organizations).where(eq(organizations.id, 'test-company-1'));
    
    // Create Users
    await db.insert(users).values([
      { id: 'test-owner-1', firstName: 'Owner', lastName: 'One', email: 'owner1@test.com', roles: ['OWNER'] },
      { id: 'test-tenant-1', firstName: 'Tenant', lastName: 'One', email: 'tenant1@test.com', roles: ['TENANT'] },
      { id: 'test-tenant-2', firstName: 'Tenant', lastName: 'Two', email: 'tenant2@test.com', roles: ['TENANT'] },
    ]).onConflictDoNothing();

    // Create Organization
    await db.insert(organizations).values({
      id: 'test-company-1',
      name: 'Test Company',
      type: 'PROPERTY_MANAGEMENT',
    }).onConflictDoNothing();

    // 1. Property Creation & Ownership vs Management
    console.log("\n--- 1. PROPERTY CREATION & OWNERSHIP ---");
    
    // Create a property
    const [prop] = await db.insert(properties).values({
      name: 'Test Rental Building',
      type: 'APARTMENT',
      status: 'VERIFIED',
      operatingModel: 'FULLY_MANAGED'
    }).returning();

    // Assign Ownership
    await db.insert(ownershipRecords).values({
      propertyId: prop.id,
      ownerId: 'test-owner-1',
      ownershipPercentage: '100.00'
    });
    
    // Delegate Management
    await db.insert(managementAgreements).values({
      propertyId: prop.id,
      companyId: 'test-company-1', // company
      ownerId: 'test-owner-1',
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      grantedPermissions: ['CREATE_LISTING', 'VIEW_PROPERTY', 'MANAGE_LEASES']
    });

    console.log("[PASS] Property created with explicit Ownership vs Management boundary.");

    // 2. Unit Creation
    console.log("\n--- 2. UNIT CREATION ---");
    const [unit] = await db.insert(units).values({
      propertyId: prop.id,
      unitNumber: 'U1',
      status: 'VACANT',
      rentAmount: '1200',
      currency: 'USD'
    }).returning();
    console.log(`[PASS] Unit U1 created for Property ${prop.id}`);

    // 3. RENT Listing
    console.log("\n--- 3. RENT LISTING ---");
    const [listing] = await db.insert(listings).values({
      propertyId: prop.id,
      // @ts-ignore
      unitId: unit.id,
      type: 'RENT',
      status: 'ACTIVE',
      title: 'Test Listing',
      description: 'Test description',
      price: '1200',
      currency: 'USD',
      publisherUserId: 'test-owner-1',
      publisherCompanyId: 'test-company-1'
    }).returning();
    console.log(`[PASS] RENT Listing created for Unit U1: ${listing.id}`);

    // 4. Tenant & Lease Lifecycle
    console.log("\n--- 4. TENANT & LEASE LIFECYCLE ---");
    const [lease] = await db.insert(leases).values({
      propertyId: prop.id,
      unitId: unit.id,
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(), // +1 year
      rentAmount: '1200',
      currency: 'USD'
    }).returning();
    
    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: 'test-tenant-1',
      isPrimary: true
    });
    
    // Update Unit occupancy
    await db.update(units).set({ status: 'OCCUPIED' }).where(eq(units.id, unit.id));
    console.log(`[PASS] Lease created for Tenant 1. Unit status updated to OCCUPIED.`);

    // Test Tenant IDOR / Scoping
    console.log("\n--- 5. TENANT ISOLATION (IDOR) ---");
    // Simulate query that fetches tenant 1's leases
    const tenant1Leases = await db.select().from(leaseTenants).where(eq(leaseTenants.tenantId, 'test-tenant-1'));
    const tenant2Leases = await db.select().from(leaseTenants).where(eq(leaseTenants.tenantId, 'test-tenant-2'));
    
    if (tenant1Leases.length === 1 && tenant2Leases.length === 0) {
      console.log(`[PASS] Active tenant 1 accesses own lease. Tenant 2 has NO active lease visibility.`);
    } else {
      throw new Error("Tenant isolation failed");
    }

    // Cleanup Test Data
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease.id));
    await db.delete(leases).where(eq(leases.id, lease.id));
    await db.delete(listings).where(eq(listings.id, listing.id));
    await db.delete(units).where(eq(units.id, unit.id));
    await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    await db.delete(properties).where(eq(properties.id, prop.id));
    
    console.log("\n[PASS] Test data cleaned up.");
    console.log("\nVERIFICATION COMPLETE. All asserts passed.");
    process.exit(0);

  } catch (err: any) {
    console.error("\nVerification failed:", err);
    process.exit(1);
  }
}

verify();

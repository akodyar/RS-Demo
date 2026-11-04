import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  ownershipRecords,
  propertyReviews,
  vendorReviews,
  vendorProfiles,
  workOrders,
  maintenanceRequests,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { signAuthToken } from '../src/server/utils/auth.js';

let passed = 0;
let failed = 0;

function check(testId: string, description: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

async function runExtendedQASuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — REVIEW & RATING EXTENDED QA & REGRESSION SUITE');
  console.log('================================================================\n');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const timestamp = Date.now();
  const runId = `ext_rev_${timestamp}`;

  let ownerUserId = '';
  let directTenantId = '';
  let unrelatedTenantId = '';
  let vendorUserId = '';
  let vendorProfileId = '';
  let propertyId = '';
  let completedWorkOrderId = '';
  let inProgressWorkOrderId = '';
  let maintenanceRequestId = '';

  let directTenantToken = '';
  let unrelatedTenantToken = '';
  let vendorToken = '';

  try {
    console.log('--- Step 1: Seeding Extended Test Fixtures ---');

    // 1. Users
    const [ownerUser] = await db.insert(users).values({
      firstName: 'Aram',
      lastName: 'Owner',
      email: `${runId}_owner@homehub.iq`,
      roles: ['PROPERTY_OWNER'],
    }).returning();
    ownerUserId = ownerUser.id;

    const [tenantDirect] = await db.insert(users).values({
      firstName: 'Shwan',
      lastName: 'DirectRequester',
      email: `${runId}_shwan@homehub.iq`,
      roles: ['TENANT'],
    }).returning();
    directTenantId = tenantDirect.id;
    directTenantToken = signAuthToken({ id: directTenantId, email: tenantDirect.email, roles: ['TENANT'], activeRole: 'TENANT' });

    const [tenantUnrelated] = await db.insert(users).values({
      firstName: 'Goran',
      lastName: 'Unrelated',
      email: `${runId}_goran@homehub.iq`,
      roles: ['TENANT'],
    }).returning();
    unrelatedTenantId = tenantUnrelated.id;
    unrelatedTenantToken = signAuthToken({ id: unrelatedTenantId, email: tenantUnrelated.email, roles: ['TENANT'], activeRole: 'TENANT' });

    const [vUser] = await db.insert(users).values({
      firstName: 'Rebaz',
      lastName: 'Electrician',
      email: `${runId}_rebaz@homehub.iq`,
      roles: ['VENDOR'],
    }).returning();
    vendorUserId = vUser.id;
    vendorToken = signAuthToken({ id: vendorUserId, email: vUser.email, roles: ['VENDOR'], activeRole: 'VENDOR' });

    const [vProf] = await db.insert(vendorProfiles).values({
      userId: vendorUserId,
      businessName: 'Rebaz Fast Electricals',
      categories: ['ELECTRICAL'],
      specialties: ['CIRCUITS', 'PANELS'],
      serviceAreas: ['Erbil', 'Sulaymaniyah'],
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      rating: '5.00',
      reviewCount: 0,
    }).returning();
    vendorProfileId = vProf.id;

    // 2. Property
    const [prop] = await db.insert(properties).values({
      name: `Extended QA Tower ${runId}`,
      type: 'RESIDENTIAL_APARTMENT',
      address: { street: '100m Road', city: 'Erbil', country: 'Iraq' },
      operatingModel: 'FULLY_MANAGED',
      status: 'AVAILABLE',
      rentFee: '0.0300',
      managementFee: '0.0700',
    }).returning();
    propertyId = prop.id;

    // 3. Ownership
    await db.insert(ownershipRecords).values({
      propertyId,
      ownerId: ownerUserId,
      ownershipPercentage: '100.00',
      isPrimary: true,
    });

    // 4. Lease for direct tenant
    const [lease] = await db.insert(leases).values({
      propertyId,
      status: 'ACTIVE',
      rentAmount: '1200.00',
      depositAmount: '1200.00',
      currency: 'USD',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: directTenantId,
      isPrimary: true,
    });

    // 5. Maintenance request & Work Orders
    const [mReq] = await db.insert(maintenanceRequests).values({
      propertyId,
      reporterUserId: directTenantId,
      category: 'ELECTRICAL',
      title: 'Power fluctuation in kitchen',
      description: 'Voltages drop when using kettle.',
      priority: 'MEDIUM',
      status: 'COMPLETED',
    }).returning();
    maintenanceRequestId = mReq.id;

    const [woInProgress] = await db.insert(workOrders).values({
      maintenanceRequestId: mReq.id,
      propertyId,
      vendorId: vendorProfileId,
      vendorUserId,
      status: 'IN_PROGRESS',
      title: 'Check wiring in kitchen',
      description: 'Pending replacement of breakers.',
    }).returning();
    inProgressWorkOrderId = woInProgress.id;

    const [woCompleted] = await db.insert(workOrders).values({
      maintenanceRequestId: mReq.id,
      propertyId,
      vendorId: vendorProfileId,
      vendorUserId,
      status: 'COMPLETED',
      title: 'Finished electrical troubleshooting',
      description: 'Replaced faulty wires and stabilized distribution box.',
    }).returning();
    completedWorkOrderId = woCompleted.id;

    console.log('Fixtures initialized successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Work Order Status Qualification
    // -------------------------------------------------------------------------
    console.log('--- Test 1: In-Progress Work Order Rejection ---');
    const inProgressRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: inProgressWorkOrderId,
        rating: 5,
        comment: 'Cannot review while still in progress',
      }),
    });
    const inProgressData = await inProgressRes.json();
    check('EXT-01', 'In-progress work order review is rejected with 400 WORK_ORDER_NOT_COMPLETED',
      inProgressRes.status === 400 && inProgressData.code === 'WORK_ORDER_NOT_COMPLETED');

    // -------------------------------------------------------------------------
    // TEST 2: Unrelated Tenant Authorization (Security Boundary)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Unrelated Tenant Work Order Review Protection ---');
    const unauthorizedRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unrelatedTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 1,
        comment: 'I do not live here but trying to review the vendor',
      }),
    });
    const unauthorizedData = await unauthorizedRes.json();
    check('EXT-02', 'Unrelated tenant without lease or request is rejected with 403 NOT_QUALIFIED_TO_REVIEW',
      unauthorizedRes.status === 403 && unauthorizedData.code === 'NOT_QUALIFIED_TO_REVIEW');

    // -------------------------------------------------------------------------
    // TEST 3: Rating Validation (Integer, Boundary, Range)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Rating Validation Rules ---');
    // Decimal rating (3.5)
    const decimalRatingRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 3.5,
        comment: 'Decimal rating should be rejected',
      }),
    });
    check('EXT-03A', 'Decimal rating (3.5) rejected with 400 VALIDATION_ERROR',
      decimalRatingRes.status === 400);

    // Negative rating (0)
    const zeroRatingRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 0,
        comment: 'Rating 0 should be rejected',
      }),
    });
    check('EXT-03B', 'Rating 0 rejected with 400 VALIDATION_ERROR',
      zeroRatingRes.status === 400);

    // Excessive rating (6)
    const excessiveRatingRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 6,
        comment: 'Rating 6 should be rejected',
      }),
    });
    check('EXT-03C', 'Rating 6 rejected with 400 VALIDATION_ERROR',
      excessiveRatingRes.status === 400);

    // Short comment (< 5 chars)
    const shortCommentRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 5,
        comment: 'Bad',
      }),
    });
    check('EXT-03D', 'Comment < 5 chars rejected with 400 VALIDATION_ERROR',
      shortCommentRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 4: Authorized Tenant Successfully Submits Review
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Authorized Tenant Review Submission ---');
    const validSubmitRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 5,
        comment: 'Super fast service, fixed our kitchen electrical immediately!',
      }),
    });
    const validSubmitData = await validSubmitRes.json();
    check('EXT-04A', 'Authorized requesting tenant submits vendor review with 201 Created',
      validSubmitRes.status === 201 && validSubmitData.rating === 5);

    // -------------------------------------------------------------------------
    // TEST 5: Public Vendor Reviews Lookup by Profile ID and User ID
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Vendor Public Reviews Lookup Flexibility ---');
    // Fetch by profile ID
    const byProfileRes = await fetch(`${baseUrl}/reviews/vendors/${vendorProfileId}`);
    const byProfileData = await byProfileRes.json();
    check('EXT-05A', 'Vendor public reviews queried by profile ID returns review and average 5.0',
      byProfileRes.status === 200 && byProfileData.totalReviews === 1 && byProfileData.averageRating === 5);

    // Fetch by user ID
    const byUserRes = await fetch(`${baseUrl}/reviews/vendors/${vendorUserId}`);
    const byUserData = await byUserRes.json();
    check('EXT-05B', 'Vendor public reviews queried by vendor userId resolves cleanly to profile reviews',
      byUserRes.status === 200 && byUserData.totalReviews === 1 && byUserData.averageRating === 5);

    // -------------------------------------------------------------------------
    // TEST 6: Vendor Review Uniqueness Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Anti-Stuffing Uniqueness Constraint ---');
    const dupRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directTenantToken}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 4,
        comment: 'Submitting a second review on the same work order should fail',
      }),
    });
    check('EXT-06', 'Submitting duplicate review on same work order fails with 409 REVIEW_ALREADY_EXISTS',
      dupRes.status === 409);

  } finally {
    console.log('\n--- Cleaning up extended test fixtures ---');
    try {
      if (completedWorkOrderId) {
        await db.delete(vendorReviews).where(eq(vendorReviews.workOrderId, completedWorkOrderId));
      }
      if (inProgressWorkOrderId) {
        await db.delete(workOrders).where(eq(workOrders.id, inProgressWorkOrderId));
      }
      if (completedWorkOrderId) {
        await db.delete(workOrders).where(eq(workOrders.id, completedWorkOrderId));
      }
      if (maintenanceRequestId) {
        await db.delete(maintenanceRequests).where(eq(maintenanceRequests.id, maintenanceRequestId));
      }
      if (propertyId) {
        const pLeases = await db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, propertyId));
        for (const l of pLeases) {
          await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, l.id));
        }
        await db.delete(leases).where(eq(leases.propertyId, propertyId));
        await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
        await db.delete(properties).where(eq(properties.id, propertyId));
      }
      if (vendorProfileId) {
        await db.delete(vendorProfiles).where(eq(vendorProfiles.id, vendorProfileId));
      }
      const testUserIds = [ownerUserId, directTenantId, unrelatedTenantId, vendorUserId].filter(Boolean);
      for (const uid of testUserIds) {
        await db.delete(auditLogs).where(eq(auditLogs.actorUserId, uid));
        await db.delete(users).where(eq(users.id, uid));
      }
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr);
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  EXTENDED SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runExtendedQASuite().catch(err => {
  console.error('Extended QA suite crashed:', err);
  process.exit(1);
});

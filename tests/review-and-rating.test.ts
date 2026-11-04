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

async function runReviewAndRatingSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — REVIEW & RATING FEATURE AUDIT & REGRESSION SUITE');
  console.log('================================================================\n');

  // Setup test Express server hosting apiRouter
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const timestamp = Date.now();
  const runId = `rev_${timestamp}`;

  // Test Entities
  let ownerUserId = '';
  let eligibleTenant1Id = '';
  let eligibleTenant2Id = '';
  let unrelatedTenantId = '';
  let adminUserId = '';
  let vendorUserId = '';
  let vendorProfileId = '';
  let propertyId = '';
  let lease1Id = '';
  let lease2Id = '';
  let completedWorkOrderId = '';
  let scheduledWorkOrderId = '';
  let maintenanceRequestId = '';

  let ownerToken = '';
  let tenant1Token = '';
  let tenant2Token = '';
  let unrelatedToken = '';
  let adminToken = '';
  let vendorToken = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP: Seed test users, property, leases, work orders
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Seeding Test Fixtures ---');

    // 1. Users
    const [ownerUser] = await db.insert(users).values({
      firstName: 'Kardo',
      lastName: 'Owner',
      email: `${runId}_owner@homehub.iq`,
      roles: ['PROPERTY_OWNER'],
    }).returning();
    ownerUserId = ownerUser.id;
    ownerToken = signAuthToken({ id: ownerUserId, email: ownerUser.email, roles: ['PROPERTY_OWNER'], activeRole: 'PROPERTY_OWNER' });

    const [tenant1] = await db.insert(users).values({
      firstName: 'Soran',
      lastName: 'TenantOne',
      email: `${runId}_tenant1@homehub.iq`,
      phone: '+9647501112233',
      roles: ['TENANT'],
    }).returning();
    eligibleTenant1Id = tenant1.id;
    tenant1Token = signAuthToken({ id: eligibleTenant1Id, email: tenant1.email, roles: ['TENANT'], activeRole: 'TENANT' });

    const [tenant2] = await db.insert(users).values({
      firstName: 'Diyar',
      lastName: 'TenantTwo',
      email: `${runId}_tenant2@homehub.iq`,
      phone: '+9647504445566',
      roles: ['TENANT'],
    }).returning();
    eligibleTenant2Id = tenant2.id;
    tenant2Token = signAuthToken({ id: eligibleTenant2Id, email: tenant2.email, roles: ['TENANT'], activeRole: 'TENANT' });

    const [unrelated] = await db.insert(users).values({
      firstName: 'Hawkar',
      lastName: 'Stranger',
      email: `${runId}_stranger@homehub.iq`,
      roles: ['TENANT'],
    }).returning();
    unrelatedTenantId = unrelated.id;
    unrelatedToken = signAuthToken({ id: unrelatedTenantId, email: unrelated.email, roles: ['TENANT'], activeRole: 'TENANT' });

    const [adminUser] = await db.insert(users).values({
      firstName: 'Zana',
      lastName: 'Admin',
      email: `${runId}_admin@homehub.iq`,
      roles: ['PLATFORM_ADMIN', 'SUPER_ADMIN'],
    }).returning();
    adminUserId = adminUser.id;
    adminToken = signAuthToken({ id: adminUserId, email: adminUser.email, roles: ['PLATFORM_ADMIN', 'SUPER_ADMIN'], activeRole: 'PLATFORM_ADMIN' });

    const [vUser] = await db.insert(users).values({
      firstName: 'Rebaz',
      lastName: 'Electrician',
      email: `${runId}_vendor@homehub.iq`,
      roles: ['VENDOR'],
    }).returning();
    vendorUserId = vUser.id;
    vendorToken = signAuthToken({ id: vendorUserId, email: vUser.email, roles: ['VENDOR'], activeRole: 'VENDOR' });

    // 2. Vendor profile
    const [vProf] = await db.insert(vendorProfiles).values({
      userId: vendorUserId,
      businessName: `${runId} Electrical Services`,
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
      rating: '5.00',
      reviewCount: 0,
      currency: 'IQD',
    }).returning();
    vendorProfileId = vProf.id;

    // 3. Property
    const [prop] = await db.insert(properties).values({
      name: `${runId} Luxury Tower Flat 402`,
      type: 'RESIDENTIAL_APARTMENT',
      status: 'OCCUPIED',
      currency: 'IQD',
    }).returning();
    propertyId = prop.id;

    // 4. Ownership Record (Kardo is verified owner)
    await db.insert(ownershipRecords).values({
      propertyId,
      ownerId: ownerUserId,
      status: 'VERIFIED',
      ownershipPercentage: '100.00',
    });

    // 5. Leases: Tenant1 and Tenant2 have qualifying leases on propertyId
    const [l1] = await db.insert(leases).values({
      propertyId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '850000',
      currency: 'IQD',
    }).returning();
    lease1Id = l1.id;

    await db.insert(leaseTenants).values({
      leaseId: lease1Id,
      tenantId: eligibleTenant1Id,
      isPrimary: true,
    });

    const [l2] = await db.insert(leases).values({
      propertyId,
      status: 'COMPLETED',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      rentAmount: '800000',
      currency: 'IQD',
    }).returning();
    lease2Id = l2.id;

    await db.insert(leaseTenants).values({
      leaseId: lease2Id,
      tenantId: eligibleTenant2Id,
      isPrimary: true,
    });

    // 6. Maintenance request and work orders for vendor review tests
    const [mReq] = await db.insert(maintenanceRequests).values({
      propertyId,
      reporterUserId: eligibleTenant1Id,
      category: 'ELECTRICAL',
      priority: 'HIGH',
      status: 'COMPLETED',
      title: 'Power failure in kitchen sockets',
      description: 'Breaker tripped and does not reset',
    }).returning();
    maintenanceRequestId = mReq.id;

    const [wo1] = await db.insert(workOrders).values({
      maintenanceRequestId,
      propertyId,
      vendorId: vendorProfileId,
      vendorUserId,
      status: 'COMPLETED',
      priority: 'HIGH',
      completionNotes: 'Replaced faulty circuit breaker',
    }).returning();
    completedWorkOrderId = wo1.id;

    const [wo2] = await db.insert(workOrders).values({
      maintenanceRequestId,
      propertyId,
      vendorId: vendorProfileId,
      vendorUserId,
      status: 'SCHEDULED',
      priority: 'MEDIUM',
    }).returning();
    scheduledWorkOrderId = wo2.id;

    console.log(`Fixtures initialized. Property ID: ${propertyId}\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Tenant Eligibility Verification
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Eligibility Check Endpoint ---');
    const elig1Res = await fetch(`${baseUrl}/reviews/properties/${propertyId}/eligibility`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const elig1Data = await elig1Res.json();
    check('REV-01A', 'Eligible tenant is marked as eligible to review', elig1Res.status === 200 && elig1Data.eligible === true);

    const eligUnrelatedRes = await fetch(`${baseUrl}/reviews/properties/${propertyId}/eligibility`, {
      headers: { Authorization: `Bearer ${unrelatedToken}` },
    });
    const eligUnrelatedData = await eligUnrelatedRes.json();
    check('REV-01B', 'Unrelated user with no lease is marked ineligible', eligUnrelatedRes.status === 200 && eligUnrelatedData.eligible === false);

    // -------------------------------------------------------------------------
    // TEST 2: Ineligible User Review Submission Rejection (403)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Ineligible User Submission Rejection ---');
    const rejectRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unrelatedToken}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 5,
        comment: 'I never lived here but it looks great from outside!',
      }),
    });
    const rejectData = await rejectRes.json();
    check('REV-02', 'Ineligible tenant submission returns 403 NOT_QUALIFIED_TO_REVIEW',
      rejectRes.status === 403 && rejectData.code === 'NOT_QUALIFIED_TO_REVIEW');

    // -------------------------------------------------------------------------
    // TEST 3: Eligible Tenant Valid Review Submission (201)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Eligible Tenant Review Submission ---');
    let review1Id = '';
    const submitRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 5,
        cleanlinessRating: 5,
        maintenanceRating: 4,
        communicationRating: 5,
        locationRating: 5,
        title: 'Spacious apartment with excellent water and power backup',
        comment: 'Lived here for a year. The generator backup is instant and building maintenance is very clean.',
      }),
    });
    const submitData = await submitRes.json();
    review1Id = submitData.id;
    check('REV-03', 'Eligible tenant successfully submits review with 201 Created and PUBLISHED status',
      submitRes.status === 201 && submitData.status === 'PUBLISHED' && submitData.rating === 5);

    // -------------------------------------------------------------------------
    // TEST 4: Anti-Stuffing & Duplicate Submission Prevention (409)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Duplicate Submission Prevention ---');
    const dupRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 1,
        comment: 'Trying to spam a second negative review for same property',
      }),
    });
    const dupData = await dupRes.json();
    check('REV-04', 'Duplicate review attempt by same tenant returns 409 REVIEW_ALREADY_EXISTS',
      dupRes.status === 409 && dupData.code === 'REVIEW_ALREADY_EXISTS');

    // -------------------------------------------------------------------------
    // TEST 5: Input Validation & Boundary Testing (400)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Input Validation & Boundary Enforcement ---');
    // Test 5A: Rating > 5
    const badRatingRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 6,
        comment: 'Valid comment length here',
      }),
    });
    check('REV-05A', 'Rating > 5 is rejected with 400 VALIDATION_ERROR', badRatingRes.status === 400);

    // Test 5B: Rating < 1
    const zeroRatingRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 0,
        comment: 'Valid comment length here',
      }),
    });
    check('REV-05B', 'Rating < 1 is rejected with 400 VALIDATION_ERROR', zeroRatingRes.status === 400);

    // Test 5C: Comment too short (< 5 chars)
    const shortCommentRes = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 4,
        comment: 'Bad',
      }),
    });
    check('REV-05C', 'Comment < 5 chars is rejected with 400 VALIDATION_ERROR', shortCommentRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 6: Second Eligible Tenant Review & Aggregate Calculations
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Second Tenant Review & Aggregate Ratings ---');
    let review2Id = '';
    const submit2Res = await fetch(`${baseUrl}/reviews/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        propertyId,
        rating: 3,
        cleanlinessRating: 3,
        maintenanceRating: 3,
        comment: 'Decent building but elevator was occasionally undergoing maintenance.',
      }),
    });
    const submit2Data = await submit2Res.json();
    review2Id = submit2Data.id;
    check('REV-06A', 'Tenant 2 successfully submits 3-star review', submit2Res.status === 201 && submit2Data.rating === 3);

    // Fetch public reviews and aggregates
    const pubRes = await fetch(`${baseUrl}/reviews/properties/${propertyId}`);
    const pubData = await pubRes.json();
    check('REV-06B', 'Public aggregate computes correct average rating (5 + 3)/2 = 4.0',
      pubData.aggregate.averageRating === 4.0 && pubData.aggregate.totalReviews === 2);
    check('REV-06C', 'Public rating distribution has one 5-star and one 3-star review',
      pubData.aggregate.ratingDistribution[5] === 1 && pubData.aggregate.ratingDistribution[3] === 1);

    // -------------------------------------------------------------------------
    // TEST 7: Privacy & PII Leakage Protection
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Public Endpoint PII Leakage Protection ---');
    const firstReview = pubData.reviews.find((r: any) => r.id === review1Id);
    const hasPhoneLeak = JSON.stringify(firstReview || {}).includes('+9647501112233');
    const hasPasswordLeak = JSON.stringify(firstReview || {}).includes('password');
    const hasFormattedName = firstReview?.tenantName === 'Soran T.';

    check('REV-07A', 'Public reviews response does not leak tenant phone number', !hasPhoneLeak);
    check('REV-07B', 'Public reviews response does not leak password or sensitive fields', !hasPasswordLeak);
    check('REV-07C', 'Tenant name is safely masked for public display (e.g. "Soran T.")', hasFormattedName);

    // -------------------------------------------------------------------------
    // TEST 7: Review Modification & Author-Only Editing (PATCH)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Review Editing Authorization ---');
    // Tenant 2 tries to edit Tenant 1's review -> 403
    const editOtherRes = await fetch(`${baseUrl}/reviews/${review1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ rating: 1, comment: 'Hacked by stranger' }),
    });
    check('REV-07A', 'Attempt to edit another user review is rejected with 403 FORBIDDEN', editOtherRes.status === 403);

    // Tenant 1 updates their own review
    const editOwnRes = await fetch(`${baseUrl}/reviews/${review1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        rating: 5,
        title: 'Updated title: Still five stars after 14 months',
        comment: 'Updated comment: Excellent service from landlord and rapid responses to all queries.',
      }),
    });
    const editOwnData = await editOwnRes.json();
    check('REV-07B', 'Author can update their own review',
      editOwnRes.status === 200 && editOwnData.title.includes('Updated title'));

    // -------------------------------------------------------------------------
    // TEST 8: Verified Owner Official Response
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Verified Owner Response Authorization ---');
    // Unrelated user tries to respond -> 403
    const badOwnerRes = await fetch(`${baseUrl}/reviews/${review1Id}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unrelatedToken}`,
      },
      body: JSON.stringify({ response: 'Fake landlord response' }),
    });
    check('REV-08A', 'Unrelated user cannot respond to reviews (403 FORBIDDEN)', badOwnerRes.status === 403);

    // Verified owner responds -> 200
    const goodOwnerRes = await fetch(`${baseUrl}/reviews/${review1Id}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ response: 'Thank you Soran for being a wonderful resident in flat 402!' }),
    });
    const goodOwnerData = await goodOwnerRes.json();
    check('REV-08B', 'Verified owner successfully posts response to review',
      goodOwnerRes.status === 200 && goodOwnerData.ownerResponse?.includes('Thank you Soran'));

    // -------------------------------------------------------------------------
    // TEST 9: Platform Admin Moderation & Exclusion of HIDDEN Reviews from Aggregates
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Admin Moderation & Aggregate Re-computation ---');
    // Regular user tries to moderate -> 403
    const badModRes = await fetch(`${baseUrl}/reviews/${review2Id}/moderate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ status: 'HIDDEN', reason: 'Trolling' }),
    });
    check('REV-09A', 'Regular tenant cannot moderate reviews (403 FORBIDDEN)', badModRes.status === 403);

    // Admin moderates review 2 to HIDDEN
    const adminModRes = await fetch(`${baseUrl}/reviews/${review2Id}/moderate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'HIDDEN', reason: 'Contains offensive language' }),
    });
    check('REV-09B', 'Platform admin successfully hides review (status: HIDDEN)', adminModRes.status === 200);

    // Check aggregates: HIDDEN review must be excluded from public view and calculations!
    const pubAfterModRes = await fetch(`${baseUrl}/reviews/properties/${propertyId}`);
    const pubAfterModData = await pubAfterModRes.json();
    check('REV-09C', 'HIDDEN review is excluded from public aggregate: average updates from 4.0 to 5.0 and totalReviews to 1',
      pubAfterModData.aggregate.averageRating === 5.0 && pubAfterModData.aggregate.totalReviews === 1);
    check('REV-09D', 'HIDDEN review does not appear in public reviews list',
      pubAfterModData.reviews.every((r: any) => r.id !== review2Id));

    // -------------------------------------------------------------------------
    // TEST 10: Community Review Flagging
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Community Review Flagging ---');
    const flagRes = await fetch(`${baseUrl}/reviews/${review1Id}/flag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unrelatedToken}`,
      },
      body: JSON.stringify({ reason: 'Suspiciously positive review' }),
    });
    const flagData = await flagRes.json();
    check('REV-10', 'Community user can report/flag review for moderator attention',
      flagRes.status === 200 && flagData.status === 'FLAGGED');

    // -------------------------------------------------------------------------
    // TEST 11: Vendor Review & Work Order Relationship Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Vendor Reviews & Work Order Qualification ---');
    // Attempt to review an incomplete / SCHEDULED work order -> 400
    const badWoRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        workOrderId: scheduledWorkOrderId,
        rating: 5,
        comment: 'Work has not been completed yet',
      }),
    });
    check('REV-11A', 'Review for uncompleted work order is rejected (400 WORK_ORDER_NOT_COMPLETED)',
      badWoRes.status === 400);

    // Valid vendor review on COMPLETED work order -> 201
    let vReviewId = '';
    const goodWoRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 5,
        comment: 'Technician arrived promptly and fixed the breaker in under an hour. Very clean and professional.',
      }),
    });
    const goodWoData = await goodWoRes.json();
    vReviewId = goodWoData.id;
    check('REV-11B', 'Customer successfully submits vendor review on COMPLETED work order',
      goodWoRes.status === 201 && goodWoData.rating === 5);

    // Duplicate vendor review on same work order -> 409
    const dupWoRes = await fetch(`${baseUrl}/reviews/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        workOrderId: completedWorkOrderId,
        rating: 1,
        comment: 'Trying duplicate vendor review',
      }),
    });
    check('REV-11C', 'Duplicate review on same work order rejected (409 REVIEW_ALREADY_EXISTS)',
      dupWoRes.status === 409);

    // Vendor responds to client review
    const vRespRes = await fetch(`${baseUrl}/vendor/reviews/${vReviewId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({ response: 'Happy to help! Please call us if you have any further electrical issues.' }),
    });
    const vRespData = await vRespRes.json();
    check('REV-11D', 'Vendor successfully posts official response to client review',
      vRespRes.status === 200 && vRespData.vendorResponse?.includes('Happy to help'));

    // -------------------------------------------------------------------------
    // TEST 13: Review Deletion Authorization (DELETE)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 13: Review Deletion Authorization ---');
    // Unrelated user tries to delete review 1 -> 403
    const badDelRes = await fetch(`${baseUrl}/reviews/${review1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${unrelatedToken}` },
    });
    check('REV-13A', 'Unauthorized user cannot delete review (403 FORBIDDEN)', badDelRes.status === 403);

    // Author deletes review 1 -> 200
    const authorDelRes = await fetch(`${baseUrl}/reviews/${review1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    check('REV-13B', 'Author can successfully delete their own review', authorDelRes.status === 200);

    // Verify review is deleted
    const checkDelRes = await fetch(`${baseUrl}/reviews/properties/${propertyId}`);
    const checkDelData = await checkDelRes.json();
    check('REV-13C', 'Deleted review is removed from database and aggregates',
      checkDelData.aggregate.totalReviews === 0 && checkDelData.reviews.length === 0);

  } catch (err: any) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Clean up test fixtures
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (propertyId) {
        await db.delete(propertyReviews).where(eq(propertyReviews.propertyId, propertyId));
        await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
      }
      if (completedWorkOrderId) {
        await db.delete(vendorReviews).where(eq(vendorReviews.workOrderId, completedWorkOrderId));
      }
      if (scheduledWorkOrderId) {
        await db.delete(vendorReviews).where(eq(vendorReviews.workOrderId, scheduledWorkOrderId));
      }
      if (maintenanceRequestId) {
        await db.delete(workOrders).where(eq(workOrders.maintenanceRequestId, maintenanceRequestId));
        await db.delete(maintenanceRequests).where(eq(maintenanceRequests.id, maintenanceRequestId));
      }
      if (lease1Id) {
        await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease1Id));
        await db.delete(leases).where(eq(leases.id, lease1Id));
      }
      if (lease2Id) {
        await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease2Id));
        await db.delete(leases).where(eq(leases.id, lease2Id));
      }
      if (propertyId) {
        await db.delete(properties).where(eq(properties.id, propertyId));
      }
      if (vendorProfileId) {
        await db.delete(vendorProfiles).where(eq(vendorProfiles.id, vendorProfileId));
      }
      const testUserIds = [ownerUserId, eligibleTenant1Id, eligibleTenant2Id, unrelatedTenantId, adminUserId, vendorUserId].filter(Boolean);
      if (testUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, testUserIds));
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error (ignored):', cleanupErr);
    }

    server.close();

    console.log('\n================================================================');
    console.log(`  SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runReviewAndRatingSuite();

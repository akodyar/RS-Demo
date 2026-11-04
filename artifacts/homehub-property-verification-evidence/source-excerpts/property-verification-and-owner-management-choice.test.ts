import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  listings,
  ownershipRecords,
  managementAgreements,
  verificationRecords,
  notifications,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole } from '../src/types/index.js';

test('Property Verification & Owner Management Choice Regression Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `pv_test_${TIMESTAMP}`;

  // 1. Setup Express Test App
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(async () => {
    server.close();
  });

  // 2. Seed Test Users & Organizations
  const ownerId = `${PREFIX}_owner`;
  const adminId = `${PREFIX}_admin`;
  const readOnlyAdminId = `${PREFIX}_ro_admin`;
  const tenantId = `${PREFIX}_tenant`;
  const verifiedAgencyId = `${PREFIX}_verified_agency`;
  const unverifiedAgencyId = `${PREFIX}_unverified_agency`;

  // Insert Users
  await db.insert(users).values([
    {
      id: ownerId,
      email: `${ownerId}@homehub.test`,
      firstName: 'Salar',
      lastName: 'Owner',
      roles: [UserRole.PROPERTY_OWNER],
    },
    {
      id: adminId,
      email: `${adminId}@homehub.test`,
      firstName: 'Platform',
      lastName: 'Admin',
      roles: [UserRole.PLATFORM_ADMIN, 'SUPER_ADMIN'],
    },
    {
      id: readOnlyAdminId,
      email: `${readOnlyAdminId}@homehub.test`,
      firstName: 'Auditor',
      lastName: 'ReadOnly',
      roles: ['READ_ONLY_ADMIN', 'AUDITOR'],
    },
    {
      id: tenantId,
      email: `${tenantId}@homehub.test`,
      firstName: 'Alan',
      lastName: 'Tenant',
      roles: [UserRole.TENANT],
    },
  ]).onConflictDoNothing();

  // Insert Organizations
  await db.insert(organizations).values([
    {
      id: verifiedAgencyId,
      name: 'Erbil Premier Real Estate',
      type: 'COMPANY',
      status: 'ACTIVE',
      verified: true,
      verificationStatus: 'VERIFIED',
    },
    {
      id: unverifiedAgencyId,
      name: 'Unverified Agency Inc',
      type: 'COMPANY',
      status: 'PENDING_VERIFICATION',
      verified: false,
      verificationStatus: 'PENDING',
    },
  ]).onConflictDoNothing();

  // Auth Tokens
  const tokenOwner = signAuthToken({ id: ownerId, roles: [UserRole.PROPERTY_OWNER], email: `${ownerId}@homehub.test` });
  const tokenAdmin = signAuthToken({ id: adminId, roles: [UserRole.PLATFORM_ADMIN, 'SUPER_ADMIN'], email: `${adminId}@homehub.test` });
  const tokenReadOnly = signAuthToken({ id: readOnlyAdminId, roles: ['READ_ONLY_ADMIN'], email: `${readOnlyAdminId}@homehub.test` });
  const tokenTenant = signAuthToken({ id: tenantId, roles: [UserRole.TENANT], email: `${tenantId}@homehub.test` });

  // --------------------------------------------------------------------------
  // Test 1: New property defaults to PENDING_VERIFICATION on server
  // --------------------------------------------------------------------------
  let testPropId = '';
  await t.test('1. New registered property defaults to PENDING_VERIFICATION and staged listing to PENDING_REVIEW', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        name: 'Gulan Tower Apartment 402',
        description: 'Luxury residential unit',
        type: 'APARTMENT',
        listingType: 'FOR_RENT',
        price: 1200,
        currency: 'USD',
        squareFeet: 140,
        address: { city: 'Erbil', street: 'Gulan Street', tapuNumber: 'TAPU-GLN-402' },
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    testPropId = body.id;

    assert.strictEqual(body.status, 'PENDING_VERIFICATION');
    assert.strictEqual(body.verificationStatus, 'PENDING_VERIFICATION');

    // Verify database row
    const [propRow] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(propRow.status, 'PENDING_VERIFICATION');
    assert.strictEqual(propRow.verificationStatus, 'PENDING_VERIFICATION');
    assert.strictEqual(propRow.managementArrangementStatus, 'NOT_APPLICABLE');

    // Verify ownership record
    const [ownerRec] = await db.select().from(ownershipRecords).where(and(
      eq(ownershipRecords.propertyId, testPropId),
      eq(ownershipRecords.ownerId, ownerId)
    ));
    assert.ok(ownerRec);
    assert.strictEqual(ownerRec.status, 'PENDING_VERIFICATION');

    // Verify listing is staged as PENDING_REVIEW (not PUBLISHED)
    const [stagedListing] = await db.select().from(listings).where(eq(listings.propertyId, testPropId));
    assert.ok(stagedListing);
    assert.strictEqual(stagedListing.status, 'PENDING_REVIEW');
  });

  // --------------------------------------------------------------------------
  // Test 2: Owner cannot self-approve or publish listing before verification
  // --------------------------------------------------------------------------
  await t.test('2. Owner cannot self-approve property or publish listing while unverified', async () => {
    // 2a. Owner attempts admin approve endpoint -> HTTP 403 Forbidden
    const resApprove = await fetch(`${baseUrl}/admin/properties/${testPropId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({ notes: 'Self approve attempt' }),
    });
    assert.strictEqual(resApprove.status, 403);

    // 2b. Owner attempts to publish unverified listing -> HTTP 400
    const [listing] = await db.select().from(listings).where(eq(listings.propertyId, testPropId));
    const resPublish = await fetch(`${baseUrl}/rental-acquisition/listings/${listing.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    assert.strictEqual(resPublish.status, 400);
    const pubData = await resPublish.json();
    assert.match(pubData.message || pubData.error, /Cannot publish listing for an unverified property/i);
  });

  // --------------------------------------------------------------------------
  // Test 3: Unauthorized users and read-only admins cannot execute review actions
  // --------------------------------------------------------------------------
  await t.test('3. Non-admins and read-only admins cannot approve or reject properties', async () => {
    // 3a. Tenant cannot review
    const resTenant = await fetch(`${baseUrl}/admin/properties/${testPropId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenant}`,
      },
    });
    assert.strictEqual(resTenant.status, 403);

    // 3b. Read-only admin cannot mutate (requireMutationPermission)
    const resReadOnly = await fetch(`${baseUrl}/admin/properties/${testPropId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenReadOnly}`,
      },
    });
    assert.strictEqual(resReadOnly.status, 403);
    const roData = await resReadOnly.json();
    assert.match(roData.error, /Read-only administrator cannot perform mutations/i);
  });

  // --------------------------------------------------------------------------
  // Test 4: Pending and rejected properties cannot leak through marketplace
  // --------------------------------------------------------------------------
  await t.test('4. Unverified property does not appear in public search, details, or rental inquiries', async () => {
    // 4a. Public marketplace search
    const resSearch = await fetch(`${baseUrl}/marketplace/listings/search?type=FOR_RENT`);
    assert.strictEqual(resSearch.status, 200);
    const searchData = await resSearch.json();
    const leaked = searchData.items?.find((item: any) => item.propertyId === testPropId);
    assert.strictEqual(leaked, undefined, 'Pending property must not leak into marketplace search');

    // 4b. Public listing details
    const [listing] = await db.select().from(listings).where(eq(listings.propertyId, testPropId));
    const resDetails = await fetch(`${baseUrl}/marketplace/listings/${listing.id}`);
    assert.strictEqual(resDetails.status, 404, 'Public user cannot access unverified listing details');

    // 4c. Tenant cannot submit inquiry for unverified listing
    const resInquiry = await fetch(`${baseUrl}/rental-acquisition/listings/${listing.id}/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenant}`,
      },
      body: JSON.stringify({ message: 'I am interested in this flat' }),
    });
    assert.strictEqual(resInquiry.status, 400);

    // 4d. Tenant cannot submit rental application for unverified listing
    const resApp = await fetch(`${baseUrl}/rental-acquisition/listings/${listing.id}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenant}`,
      },
      body: JSON.stringify({ monthlyIncome: 3000, employmentStatus: 'EMPLOYED' }),
    });
    assert.strictEqual(resApp.status, 400);
  });

  // --------------------------------------------------------------------------
  // Test 5: Rejection requires non-empty reason and records auditable history
  // --------------------------------------------------------------------------
  await t.test('5. Property rejection requires mandatory reason, unpublishes listing, and notifies owner', async () => {
    // 5a. Rejection without reason is rejected (HTTP 400)
    const resEmptyReject = await fetch(`${baseUrl}/admin/properties/${testPropId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ reason: '   ' }),
    });
    assert.strictEqual(resEmptyReject.status, 400);
    const emptyErr = await resEmptyReject.json();
    assert.match(emptyErr.error, /reason is required/i);

    // 5b. Valid rejection
    const validReason = 'Mismatched title deed name with owner civil identity document.';
    const resReject = await fetch(`${baseUrl}/admin/properties/${testPropId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ reason: validReason }),
    });
    assert.strictEqual(resReject.status, 200);

    // Verify property DB state
    const [propRow] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(propRow.verificationStatus, 'REJECTED');
    assert.strictEqual(propRow.rejectionReason, validReason);

    // Verify ownership record DB state
    const [ownerRec] = await db.select().from(ownershipRecords).where(and(
      eq(ownershipRecords.propertyId, testPropId),
      eq(ownershipRecords.ownerId, ownerId)
    ));
    assert.strictEqual(ownerRec.status, 'REJECTED');

    // Verify auditable verificationRecords
    const history = await db.select().from(verificationRecords).where(and(
      eq(verificationRecords.subjectType, 'PROPERTY'),
      eq(verificationRecords.propertyId, testPropId)
    )).orderBy(desc(verificationRecords.createdAt));
    assert.ok(history.length >= 1);
    assert.strictEqual(history[0].status, 'REJECTED');
    assert.strictEqual(history[0].rejectionReason, validReason);
    assert.strictEqual(history[0].reviewedBy, adminId);

    // Verify owner notification was dispatched internally
    const ownerNotes = await db.select().from(notifications).where(and(
      eq(notifications.userId, ownerId),
      eq(notifications.category, 'PROPERTY_VERIFICATION')
    ));
    assert.ok(ownerNotes.length >= 1);
    assert.ok(ownerNotes[ownerNotes.length - 1].message.includes(validReason));
  });

  // --------------------------------------------------------------------------
  // Test 6: Resubmission resets property to PENDING_VERIFICATION
  // --------------------------------------------------------------------------
  await t.test('6. Owner resubmission resets property to PENDING_VERIFICATION for re-review', async () => {
    const res = await fetch(`${baseUrl}/properties/${testPropId}/resubmit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
    });
    assert.strictEqual(res.status, 200);

    const [propRow] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(propRow.verificationStatus, 'PENDING_VERIFICATION');

    const [ownerRec] = await db.select().from(ownershipRecords).where(and(
      eq(ownershipRecords.propertyId, testPropId),
      eq(ownershipRecords.ownerId, ownerId)
    ));
    assert.strictEqual(ownerRec.status, 'PENDING_VERIFICATION');
  });

  // --------------------------------------------------------------------------
  // Test 7: Admin approval enables public visibility & publishes staged listing
  // --------------------------------------------------------------------------
  await t.test('7. Admin approval verifies property, publishes staged rental listing, and logs audit', async () => {
    const resApprove = await fetch(`${baseUrl}/admin/properties/${testPropId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ notes: 'Civil deed documents verified successfully' }),
    });
    assert.strictEqual(resApprove.status, 200);

    const [propRow] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(propRow.status, 'ACTIVE');
    assert.strictEqual(propRow.verificationStatus, 'VERIFIED');
    assert.strictEqual(propRow.verifiedBy, adminId);
    assert.ok(propRow.verifiedAt);

    // Staged listing is now PUBLISHED
    const [pubListing] = await db.select().from(listings).where(eq(listings.propertyId, testPropId));
    assert.strictEqual(pubListing.status, 'PUBLISHED');

    // Ownership record is VERIFIED
    const [ownerRec] = await db.select().from(ownershipRecords).where(and(
      eq(ownershipRecords.propertyId, testPropId),
      eq(ownershipRecords.ownerId, ownerId)
    ));
    assert.strictEqual(ownerRec.status, 'VERIFIED');

    // Marketplace search now discovers the listing
    const resSearch = await fetch(`${baseUrl}/marketplace/listings/search?type=FOR_RENT`);
    assert.strictEqual(resSearch.status, 200);
    const searchData = await resSearch.json();
    const found = searchData.items?.find((item: any) => item.propertyId === testPropId);
    assert.ok(found, 'Approved property must be discoverable in public marketplace search');

    // Public listing details now returns successfully
    const resDetails = await fetch(`${baseUrl}/marketplace/listings/${pubListing.id}`);
    assert.strictEqual(resDetails.status, 200);
  });

  // --------------------------------------------------------------------------
  // Test 8: Material updates trigger safe re-review and unpublish active listing
  // --------------------------------------------------------------------------
  await t.test('8. Material edits to approved property trigger re-review and unpublish active listings', async () => {
    // Change square footage and city (material attributes)
    const resUpdate = await fetch(`${baseUrl}/properties/${testPropId}/material-update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        squareFeet: 220,
        address: { city: 'Sulaymaniyah', street: 'Salim Street', tapuNumber: 'TAPU-SUL-999' },
      }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const resData = await resUpdate.json();
    assert.strictEqual(resData.requiresReReview, true);

    // Property verification is reset to PENDING_VERIFICATION
    const [propRow] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(propRow.verificationStatus, 'PENDING_VERIFICATION');

    // Active listing was demoted to PENDING_REVIEW
    const [listing] = await db.select().from(listings).where(eq(listings.propertyId, testPropId));
    assert.strictEqual(listing.status, 'PENDING_REVIEW');

    // Marketplace search no longer exposes the property
    const resSearch = await fetch(`${baseUrl}/marketplace/listings/search?type=FOR_RENT`);
    const searchData = await resSearch.json();
    const leaked = searchData.items?.find((item: any) => item.propertyId === testPropId);
    assert.strictEqual(leaked, undefined, 'Materially edited property must not leak into search during re-review');

    // Re-approve for subsequent preference tests
    await fetch(`${baseUrl}/admin/properties/${testPropId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ notes: 'Re-approved after material verification' }),
    });
  });

  // --------------------------------------------------------------------------
  // Test 9: Management Preference Workflow (The 3 Choices)
  // --------------------------------------------------------------------------
  await t.test('9. Owner management preferences persist correctly and update arrangement status', async () => {
    // 9a. Choice B: HOMEHUB_MANAGED
    const resHomeHub = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({ managementPreference: 'HOMEHUB_MANAGED' }),
    });
    assert.strictEqual(resHomeHub.status, 200);
    let [prop] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(prop.managementPreference, 'HOMEHUB_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_ONBOARDING');

    // 9b. Choice C: AGENT_MANAGED with valid verified agency
    const resAgent = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        managementPreference: 'AGENT_MANAGED',
        agentCompanyId: verifiedAgencyId,
      }),
    });
    assert.strictEqual(resAgent.status, 200);
    [prop] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(prop.managementPreference, 'AGENT_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_AGREEMENT');
    assert.strictEqual(prop.managedByAgentId, verifiedAgencyId);

    // 9c. Choice A: SELF_MANAGED
    const resSelf = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({ managementPreference: 'SELF_MANAGED' }),
    });
    assert.strictEqual(resSelf.status, 200);
    [prop] = await db.select().from(properties).where(eq(properties.id, testPropId));
    assert.strictEqual(prop.managementPreference, 'SELF_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'NOT_APPLICABLE');
  });

  // --------------------------------------------------------------------------
  // Test 10: Agent Management enforces eligible verified company server-side
  // --------------------------------------------------------------------------
  await t.test('10. AGENT_MANAGED strictly rejects non-existent or unverified partner companies', async () => {
    // 10a. Non-existent company -> HTTP 400
    const resNonExistent = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        managementPreference: 'AGENT_MANAGED',
        agentCompanyId: 'non_existent_company_99999',
      }),
    });
    assert.strictEqual(resNonExistent.status, 400);
    const errData = await resNonExistent.json();
    assert.match(errData.message || errData.error, /does not exist/i);

    // 10b. Unverified company -> HTTP 400
    const resUnverified = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({
        managementPreference: 'AGENT_MANAGED',
        agentCompanyId: unverifiedAgencyId,
      }),
    });
    assert.strictEqual(resUnverified.status, 400);
    const unverErr = await resUnverified.json();
    assert.match(unverErr.message || unverErr.error, /active or verified|not verified/i);
  });

  // --------------------------------------------------------------------------
  // Test 11: Active management agreement prevents silent switch to SELF_MANAGED
  // --------------------------------------------------------------------------
  await t.test('11. Active management agreement blocks silent switch to SELF_MANAGED without formal termination', async () => {
    const agreementId = `${PREFIX}_agreement_01`;
    // Insert active management agreement
    await db.insert(managementAgreements).values({
      id: agreementId,
      propertyId: testPropId,
      companyId: verifiedAgencyId,
      ownerId: ownerId,
      status: 'ACTIVE',
      grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_TENANTS'],
      startDate: '2026-01-01',
      endDate: '2027-01-01',
    }).onConflictDoNothing();

    // Owner attempts to unilaterally switch to SELF_MANAGED -> HTTP 409 CONFLICT
    const resConflict = await fetch(`${baseUrl}/properties/${testPropId}/management-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`,
      },
      body: JSON.stringify({ managementPreference: 'SELF_MANAGED' }),
    });
    assert.strictEqual(resConflict.status, 409);
    const confData = await resConflict.json();
    assert.match(confData.message || confData.error, /active management agreement exists/i);

    // Clean up agreement
    await db.delete(managementAgreements).where(eq(managementAgreements.id, agreementId));
  });

  // --------------------------------------------------------------------------
  // Test 12: Admin Verification History Endpoint
  // --------------------------------------------------------------------------
  await t.test('12. Admin verification history endpoint returns full auditable decision trail with reviewer identity', async () => {
    const res = await fetch(`${baseUrl}/admin/properties/${testPropId}/verification-history`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.history));
    assert.ok(body.history.length >= 2, 'History must include at least initial creation, rejection, and approval');
    const reviewedDecision = body.history.find((h: any) => h.reviewerEmail != null);
    assert.ok(reviewedDecision, 'History must include at least one reviewed decision with reviewer email');
    assert.ok(reviewedDecision.reviewerEmail);
    assert.ok(reviewedDecision.createdAt);
  });
});

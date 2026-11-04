import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  listings,
  units,
  rentalApplications,
  leases,
  leaseTenants,
  rentSchedules,
  leaseRenewals,
} from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { companyRepository } from '../src/server/repositories/company.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { rentalAcquisitionRepository } from '../src/server/repositories/rental-acquisition.js';
import { UserRole, Permission, CompanyRole, LeaseStatus, ApplicationStatus } from '../src/types/index.js';

test('Rental Application Consumption Lifecycle & Concurrency Invariant Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `app_cons_${TIMESTAMP}`;

  // 1. Provision Test Personas
  const owner = {
    id: `${PREFIX}_owner`,
    firstName: 'Azad',
    lastName: 'Owner',
    email: `${PREFIX}_owner@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const companyAdmin = {
    id: `${PREFIX}_comp_admin`,
    firstName: 'Dana',
    lastName: 'Manager',
    email: `${PREFIX}_dana@company.iq`,
    roles: [UserRole.COMPANY],
    isActive: true,
  };

  const tenantA = {
    id: `${PREFIX}_tenant_A`,
    firstName: 'Baban',
    lastName: 'TenantA',
    email: `${PREFIX}_tenantA@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const tenantB = {
    id: `${PREFIX}_tenant_B`,
    firstName: 'Choman',
    lastName: 'TenantB',
    email: `${PREFIX}_tenantB@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const tenantC = {
    id: `${PREFIX}_tenant_C`,
    firstName: 'Dler',
    lastName: 'TenantC',
    email: `${PREFIX}_tenantC@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const unauthorizedOwner = {
    id: `${PREFIX}_unauth_owner`,
    firstName: 'Foreign',
    lastName: 'Owner',
    email: `${PREFIX}_foreign@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  await db.insert(users).values([owner, companyAdmin, tenantA, tenantB, tenantC, unauthorizedOwner]);

  // 2. Provision Company & Management
  const companyOrg = {
    id: `${PREFIX}_company`,
    name: 'HomeHub Premier Management',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };
  await db.insert(organizations).values([companyOrg]);

  await db.insert(organizationMembers).values([
    {
      id: `${PREFIX}_mem_admin`,
      organizationId: companyOrg.id,
      userId: companyAdmin.id,
      role: CompanyRole.COMPANY_ADMIN,
      status: 'ACTIVE',
    },
  ]);

  // 3. Provision Property & Verified Ownership
  const prop = {
    id: `${PREFIX}_prop`,
    name: 'Bakhtiyari Luxury Residences',
    type: 'APARTMENT',
    currency: 'USD',
    status: 'ACTIVE',
  };
  await db.insert(properties).values([prop]);

  await db.insert(ownershipRecords).values([
    {
      id: `${PREFIX}_own`,
      propertyId: prop.id,
      ownerId: owner.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
  ]);

  // Management agreement granting MANAGE_LEASES
  await db.insert(managementAgreements).values([
    {
      id: `${PREFIX}_mgmt`,
      propertyId: prop.id,
      companyId: companyOrg.id,
      ownerId: owner.id,
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2035-01-01',
      grantedPermissions: [Permission.MANAGE_LEASES, Permission.VIEW_FINANCIALS],
    },
  ]);

  // Published Listing for submission tests
  const listing = {
    id: `${PREFIX}_listing`,
    propertyId: prop.id,
    publisherUserId: owner.id,
    type: 'FOR_RENT',
    price: '1200',
    currency: 'USD',
    status: 'PUBLISHED',
    title: 'Luxury Apartment for Rent',
  };
  await db.insert(listings).values([listing]);

  // Clean-up helper at end of test run
  t.after(async () => {
    try {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.propertyId, prop.id));
      await db.delete(rentSchedules).where(eq(rentSchedules.propertyId, prop.id));
      const propLeases = await db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, prop.id));
      if (propLeases.length > 0) {
        const leaseIds = propLeases.map((l) => l.id);
        await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
        await db.delete(leases).where(inArray(leases.id, leaseIds));
      }
      await db.delete(rentalApplications).where(eq(rentalApplications.propertyId, prop.id));
      await db.delete(listings).where(eq(listings.id, listing.id));
      await db.delete(managementAgreements).where(eq(managementAgreements.id, `${PREFIX}_mgmt`));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.id, `${PREFIX}_own`));
      await db.delete(properties).where(eq(properties.id, prop.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, companyOrg.id));
      await db.delete(organizations).where(eq(organizations.id, companyOrg.id));
      await db.delete(users).where(inArray(users.id, [
        owner.id,
        companyAdmin.id,
        tenantA.id,
        tenantB.id,
        tenantC.id,
        unauthorizedOwner.id,
      ]));
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr);
    }
  });

  // =========================================================================
  // SCENARIO 1 & 2: Approved application is linked when a lease is created,
  // and application remains APPROVED while lease is pending.
  // =========================================================================
  let appAId: string;
  let leaseAId: string;

  await t.test('1 & 2. Approved application is linked at lease creation and remains APPROVED while pending', async () => {
    const [appA] = await db.insert(rentalApplications).values({
      applicantUserId: tenantA.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();
    appAId = appA.id;

    // Owner creates lease
    const newLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantA.id,
        startDate: '2026-06-01',
        endDate: '2027-05-31',
        rentAmount: 1200,
        currency: 'USD',
      }
    );
    leaseAId = newLease.id;

    assert.ok(newLease.id, 'Lease must be created');
    assert.strictEqual(newLease.status, LeaseStatus.PENDING_SIGNATURE, 'Lease status must be PENDING_SIGNATURE');
    assert.strictEqual(newLease.rentalApplicationId, appA.id, 'Lease must reference the approved rental application');

    // Verify application status remains APPROVED
    const [freshApp] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appA.id));
    assert.strictEqual(freshApp.status, 'APPROVED', 'Application status must remain APPROVED while lease is pending');
  });

  // =========================================================================
  // SCENARIO 3: Successful activation changes linked application to CONVERTED_TO_LEASE
  // =========================================================================
  await t.test('3. Successful activation changes the linked application to CONVERTED_TO_LEASE', async () => {
    // Tenant accepts lease offer
    const activatedLease = await tenantRepository.acceptLeaseOffer(tenantA.id, leaseAId);
    assert.strictEqual(activatedLease.status, LeaseStatus.ACTIVE, 'Lease must be ACTIVE');

    // Verify application status changed to CONVERTED_TO_LEASE
    const [freshApp] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appAId));
    assert.strictEqual(
      freshApp.status,
      ApplicationStatus.CONVERTED_TO_LEASE,
      'Application status must be transitioned to CONVERTED_TO_LEASE'
    );
  });

  // =========================================================================
  // SCENARIO 4: The same application cannot create a second lease with non-overlapping dates
  // =========================================================================
  await t.test('4. The same application cannot create a second lease with non-overlapping dates', async () => {
    // Attempt to create another lease for tenantA on prop for the subsequent year (non-overlapping)
    await assert.rejects(
      async () => {
        await ownerRepository.createLease(
          { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
          {
            propertyId: prop.id,
            tenantId: tenantA.id,
            startDate: '2027-06-01',
            endDate: '2028-05-31',
            rentAmount: 1200,
            currency: 'USD',
          }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes('does not have an APPROVED rental application'),
          `Error must indicate lack of APPROVED application: ${err.message}`
        );
        return true;
      }
    );
  });

  // =========================================================================
  // SCENARIO 5: Concurrent lease creation cannot reserve one application twice
  // =========================================================================
  await t.test('5. Concurrent lease creation cannot reserve one application twice', async () => {
    const [appB] = await db.insert(rentalApplications).values({
      applicantUserId: tenantB.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();

    // Spawn 2 concurrent lease creation attempts for tenantB
    const p1 = ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2028-06-01',
        endDate: '2029-05-31',
        rentAmount: 1200,
        currency: 'USD',
      }
    );

    const p2 = ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2029-06-01',
        endDate: '2030-05-31',
        rentAmount: 1200,
        currency: 'USD',
      }
    );

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent lease creation must succeed');
    assert.strictEqual(rejected.length, 1, 'The conflicting concurrent lease creation must be rejected');

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason.message.includes('already reserved by another lease') ||
      rejectionReason.message.includes('VALIDATION_ERROR'),
      `Rejection message must indicate reservation conflict: ${rejectionReason.message}`
    );

    // Clean up created lease for tenantB
    const createdLeaseId = (fulfilled[0] as PromiseFulfilledResult<any>).value.id;
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, createdLeaseId));
    await db.delete(leases).where(eq(leases.id, createdLeaseId));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, appB.id));
  });

  // =========================================================================
  // SCENARIO 6: Concurrent duplicate application submissions cannot create two active applications
  // =========================================================================
  await t.test('6. Concurrent duplicate application submissions cannot create two active applications', async () => {
    // Attempt two simultaneous submissions for tenantC on listing
    const sub1 = rentalAcquisitionRepository.submitApplication(tenantC.id, listing.id, {
      monthlyIncome: 4000,
      notes: 'Submission concurrent A',
    });
    const sub2 = rentalAcquisitionRepository.submitApplication(tenantC.id, listing.id, {
      monthlyIncome: 4000,
      notes: 'Submission concurrent B',
    });

    const results = await Promise.allSettled([sub1, sub2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one application submission must succeed');
    assert.strictEqual(rejected.length, 1, 'The duplicate application submission must be rejected');

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason.message.includes('You already have an active application for this property'),
      `Rejection message must indicate active application duplicate conflict: ${rejectionReason.message}`
    );

    // Verify exactly one active application exists in PostgreSQL
    const apps = await db.select().from(rentalApplications).where(
      and(
        eq(rentalApplications.applicantUserId, tenantC.id),
        eq(rentalApplications.propertyId, prop.id)
      )
    );
    assert.strictEqual(apps.length, 1, 'PostgreSQL database must contain exactly 1 active application');
  });

  // =========================================================================
  // SCENARIO 7: Owner rejection of a company draft releases reservation without consuming application
  // =========================================================================
  await t.test('7. Owner rejection of a company draft releases the reservation without consuming the application', async () => {
    const [appDraft] = await db.insert(rentalApplications).values({
      applicantUserId: tenantB.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();

    // Company creates draft lease (PENDING_APPROVAL)
    const draftLease = await companyRepository.createLeaseDraft(companyOrg.id, companyAdmin.id, {
      propertyId: prop.id,
      tenantId: tenantB.id,
      startDate: '2030-06-01',
      endDate: '2031-05-31',
      rentAmount: 1300,
      currency: 'USD',
    });

    assert.strictEqual(draftLease.status, 'PENDING_APPROVAL', 'Company draft must be in PENDING_APPROVAL status');
    assert.strictEqual(draftLease.rentalApplicationId, appDraft.id, 'Draft lease must reserve the application');

    // Owner REJECTS the draft
    const rejectedLease = await ownerRepository.decideLeaseApproval(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      draftLease.id,
      'REJECT'
    );
    assert.strictEqual(rejectedLease.status, LeaseStatus.CANCELLED, 'Rejected lease must be transitioned to CANCELLED');

    // Verify application status is still APPROVED
    const [freshApp] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appDraft.id));
    assert.strictEqual(freshApp.status, 'APPROVED', 'Application must remain APPROVED after lease draft rejection');

    // Verify application can now be reserved by another lease (reservation was released)
    const newOwnerLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2030-06-01',
        endDate: '2031-05-31',
        rentAmount: 1250,
        currency: 'USD',
      }
    );
    assert.ok(newOwnerLease.id, 'New lease creation must succeed using released application');
    assert.strictEqual(newOwnerLease.rentalApplicationId, appDraft.id);

    // Clean up
    await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, [draftLease.id, newOwnerLease.id]));
    await db.delete(leases).where(inArray(leases.id, [draftLease.id, newOwnerLease.id]));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, appDraft.id));
  });

  // =========================================================================
  // SCENARIO 8: Cancellation before activation follows documented reservation policy
  // =========================================================================
  await t.test('8. Cancellation before activation releases reservation cleanly', async () => {
    const [appCancel] = await db.insert(rentalApplications).values({
      applicantUserId: tenantB.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();

    const pendingLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2032-06-01',
        endDate: '2033-05-31',
        rentAmount: 1400,
        currency: 'USD',
      }
    );
    assert.strictEqual(pendingLease.rentalApplicationId, appCancel.id);

    // Cancel the lease before activation
    await db.update(leases).set({ status: LeaseStatus.CANCELLED }).where(eq(leases.id, pendingLease.id));

    // Application remains APPROVED
    const [freshApp] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appCancel.id));
    assert.strictEqual(freshApp.status, 'APPROVED');

    // Another lease can now reserve this application without duplicate key conflict
    const replacementLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2032-06-01',
        endDate: '2033-05-31',
        rentAmount: 1400,
        currency: 'USD',
      }
    );
    assert.strictEqual(replacementLease.rentalApplicationId, appCancel.id);

    // Clean up
    await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, [pendingLease.id, replacementLease.id]));
    await db.delete(leases).where(inArray(leases.id, [pendingLease.id, replacementLease.id]));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, appCancel.id));
  });

  // =========================================================================
  // SCENARIO 9: Activation fails atomically if the application is no longer APPROVED
  // =========================================================================
  await t.test('9. Activation fails atomically if the application is no longer APPROVED', async () => {
    const [appWithdrawn] = await db.insert(rentalApplications).values({
      applicantUserId: tenantB.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();

    const pendingLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2034-06-01',
        endDate: '2035-05-31',
        rentAmount: 1500,
        currency: 'USD',
      }
    );

    // External change: Tenant withdraws application or owner revokes it
    await db.update(rentalApplications)
      .set({ status: 'WITHDRAWN' })
      .where(eq(rentalApplications.id, appWithdrawn.id));

    // Attempt activation: must fail atomically
    await assert.rejects(
      async () => {
        await leaseRepository.activateLease(pendingLease.id);
      },
      (err: any) => {
        assert.ok(
          err.message.includes('Linked rental application is no longer in APPROVED status'),
          `Activation must fail with expected error: ${err.message}`
        );
        return true;
      }
    );

    // Verify lease was NOT activated
    const [checkLease] = await db.select().from(leases).where(eq(leases.id, pendingLease.id));
    assert.strictEqual(checkLease.status, LeaseStatus.PENDING_SIGNATURE, 'Lease status must remain PENDING_SIGNATURE');

    // Clean up
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, pendingLease.id));
    await db.delete(leases).where(eq(leases.id, pendingLease.id));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, appWithdrawn.id));
  });

  // =========================================================================
  // SCENARIO 10: Lease renewal does not require or consume another application
  // =========================================================================
  await t.test('10. Lease renewal does not require or consume another application', async () => {
    // leaseAId is ACTIVE from scenario 3 with application CONVERTED_TO_LEASE
    // Tenant requests renewal
    const renewalRequest = await tenantRepository.requestLeaseRenewal(tenantA.id, {
      leaseId: leaseAId,
      proposedEndDate: '2028-05-31',
      proposedRentAmount: 1300,
      notes: 'Please renew for another year',
    });
    assert.ok(renewalRequest.id, 'Renewal request must be created');
    assert.strictEqual(renewalRequest.status, 'REQUESTED');

    // Owner approves renewal
    const approvedRenewal = await leaseRepository.approveRenewal(renewalRequest.id, {
      actorUserId: owner.id,
      actorRole: UserRole.PROPERTY_OWNER,
    });
    assert.strictEqual(approvedRenewal.status, 'APPROVED', 'Renewal must be APPROVED');

    // Verify current lease was extended without requiring a new application
    const [renewedLease] = await db.select().from(leases).where(eq(leases.id, leaseAId));
    assert.strictEqual(renewedLease.endDate, '2028-05-31', 'Lease end date must be updated');
    assert.strictEqual(renewedLease.rentalApplicationId, appAId, 'Lease rentalApplicationId remains intact');

    // Verify application status remains CONVERTED_TO_LEASE
    const [appCheck] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appAId));
    assert.strictEqual(appCheck.status, ApplicationStatus.CONVERTED_TO_LEASE);
  });

  // =========================================================================
  // SCENARIO 11: Legacy leases with null rental_application_id continue to work
  // =========================================================================
  await t.test('11. Legacy leases with null rental_application_id support activation and lifecycle', async () => {
    // Insert legacy lease directly without rental_application_id
    const [legacyLease] = await db.insert(leases).values({
      propertyId: prop.id,
      startDate: '2036-01-01',
      endDate: '2036-12-31',
      rentAmount: '1100',
      currency: 'USD',
      status: LeaseStatus.PENDING_SIGNATURE,
      rentalApplicationId: null, // legacy lease
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: legacyLease.id,
      tenantId: tenantB.id,
      isPrimary: true,
    });

    // Activate legacy lease directly
    const activatedLegacy = await leaseRepository.activateLease(legacyLease.id);
    assert.strictEqual(activatedLegacy.status, LeaseStatus.ACTIVE, 'Legacy lease must activate cleanly');
    assert.strictEqual(activatedLegacy.rentalApplicationId, null, 'rentalApplicationId must remain null');

    // Verify rent schedules were generated
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, legacyLease.id));
    assert.strictEqual(schedules.length, 12, '12 rent schedules must be generated for legacy lease');

    // Clean up
    await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, legacyLease.id));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, legacyLease.id));
    await db.delete(leases).where(eq(leases.id, legacyLease.id));
  });

  // =========================================================================
  // SCENARIO 12: Existing tenant, owner, and company authorization checks remain intact
  // =========================================================================
  await t.test('12. Existing tenant, owner, and company authorization checks remain intact', async () => {
    const [appAuth] = await db.insert(rentalApplications).values({
      applicantUserId: tenantB.id,
      propertyId: prop.id,
      status: 'APPROVED',
    }).returning();

    // 12a. Unauthorized owner cannot create lease for property they do not own
    await assert.rejects(
      async () => {
        await ownerRepository.createLease(
          { id: unauthorizedOwner.id, roles: [UserRole.PROPERTY_OWNER] },
          {
            propertyId: prop.id,
            tenantId: tenantB.id,
            startDate: '2038-01-01',
            endDate: '2038-12-31',
            rentAmount: 1000,
            currency: 'USD',
          }
        );
      },
      /AUTHORITY_REQUIRED|Forbidden/i
    );

    // 12b. Unauthorized tenant cannot accept someone else's lease offer
    const pendingLease = await ownerRepository.createLease(
      { id: owner.id, roles: [UserRole.PROPERTY_OWNER] },
      {
        propertyId: prop.id,
        tenantId: tenantB.id,
        startDate: '2038-01-01',
        endDate: '2038-12-31',
        rentAmount: 1000,
        currency: 'USD',
      }
    );

    await assert.rejects(
      async () => {
        await tenantRepository.acceptLeaseOffer(tenantC.id, pendingLease.id);
      },
      /UNAUTHORIZED_TENANT_LEASE_ACCESS/i
    );

    // Clean up
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, pendingLease.id));
    await db.delete(leases).where(eq(leases.id, pendingLease.id));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, appAuth.id));
  });

  // =========================================================================
  // SCENARIO 13: Multi-Tenant Primary-Applicant-Only Policy Invariants
  // =========================================================================
  await t.test('13. Multi-Tenant Primary-Applicant-Only Policy Invariants', async (tSub) => {
    // 13a. Multi-tenant lease succeeds when primary tenant has approved application and secondary does not
    await tSub.test('13a. Multi-tenant lease succeeds when primary tenant has approved application and secondary does not', async () => {
      // tenantA has approved app, tenantB has NO application
      const [appPrimary] = await db.insert(rentalApplications).values({
        applicantUserId: tenantA.id,
        propertyId: prop.id,
        status: 'APPROVED',
      }).returning();

      let multiLease: any;
      try {
        multiLease = await leaseRepository.createLease(
          prop.id,
          null,
          [tenantA.id, tenantB.id], // tenantA is primary, tenantB is secondary co-tenant
          '2040-01-01',
          '2040-12-31',
          1500,
          'USD'
        );

        assert.ok(multiLease.id, 'Multi-tenant lease must be created successfully');
        assert.strictEqual(multiLease.rentalApplicationId, appPrimary.id, 'Only primary tenant application must be linked');

        // Verify leaseTenants records
        const assignedTenants = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, multiLease.id));
        assert.strictEqual(assignedTenants.length, 2, 'Both primary and secondary tenants must be attached');
        const primaryLink = assignedTenants.find(t => t.tenantId === tenantA.id);
        const secondaryLink = assignedTenants.find(t => t.tenantId === tenantB.id);
        assert.strictEqual(primaryLink?.isPrimary, true, 'tenantA must be primary');
        assert.strictEqual(secondaryLink?.isPrimary, false, 'tenantB must be secondary co-tenant');

        // 13b. Secondary tenant without application is NOT blocked by application reservation checks
        // and activating the lease consumes only the primary application
        const activatedMulti = await leaseRepository.activateLease(multiLease.id);
        assert.strictEqual(activatedMulti.status, LeaseStatus.ACTIVE);

        const [consumedApp] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appPrimary.id));
        assert.strictEqual(consumedApp.status, 'CONVERTED_TO_LEASE', 'Primary application must transition to CONVERTED_TO_LEASE');

        // 13c. The consumed primary application cannot be reused for a second non-overlapping lease
        await assert.rejects(
          async () => {
            await leaseRepository.createLease(
              prop.id,
              null,
              [tenantA.id],
              '2041-01-01',
              '2041-12-31',
              1500,
              'USD'
            );
          },
          /does not have an APPROVED rental application/i
        );
      } finally {
        if (multiLease?.id) {
          await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, multiLease.id));
          await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, multiLease.id));
          await db.delete(leases).where(eq(leases.id, multiLease.id));
        }
        await db.delete(rentalApplications).where(eq(rentalApplications.id, appPrimary.id));
      }
    });

    // 13d. Creation fails if the primary tenant lacks an approved application, even if secondary has one
    await tSub.test('13d. Creation fails if primary tenant lacks approved application, even if secondary has one', async () => {
      // tenantB has approved app, but tenantA (primary) has none
      const [appSecondary] = await db.insert(rentalApplications).values({
        applicantUserId: tenantB.id,
        propertyId: prop.id,
        status: 'APPROVED',
      }).returning();

      try {
        await assert.rejects(
          async () => {
            await leaseRepository.createLease(
              prop.id,
              null,
              [tenantA.id, tenantB.id], // tenantA is primary without application
              '2042-01-01',
              '2042-12-31',
              1500,
              'USD'
            );
          },
          /Primary tenant .* does not have an APPROVED rental application/i
        );
      } finally {
        await db.delete(rentalApplications).where(eq(rentalApplications.id, appSecondary.id));
      }
    });

    // 13e. All co-tenants must still have the TENANT role
    await tSub.test('13e. All co-tenants must still have the TENANT role', async () => {
      const [appPrimary] = await db.insert(rentalApplications).values({
        applicantUserId: tenantA.id,
        propertyId: prop.id,
        status: 'APPROVED',
      }).returning();

      try {
        // unauthorizedOwner has PROPERTY_OWNER role, not TENANT
        await assert.rejects(
          async () => {
            await leaseRepository.createLease(
              prop.id,
              null,
              [tenantA.id, unauthorizedOwner.id], // secondary co-tenant is not a tenant
              '2043-01-01',
              '2043-12-31',
              1500,
              'USD'
            );
          },
          /lacks the TENANT role/i
        );
      } finally {
        await db.delete(rentalApplications).where(eq(rentalApplications.id, appPrimary.id));
      }
    });

    // 13f. Existing tenant overlap and physical-space protections remain enforced for secondary co-tenants
    await tSub.test('13f. Existing tenant overlap and physical-space protections remain enforced for secondary co-tenants', async () => {
      const [u1] = await db.insert(units).values({
        propertyId: prop.id,
        unitNumber: `U101_${TIMESTAMP}`,
        marketRent: '1200',
        currency: 'USD',
      }).returning();

      const [u2] = await db.insert(units).values({
        propertyId: prop.id,
        unitNumber: `U102_${TIMESTAMP}`,
        marketRent: '1400',
        currency: 'USD',
      }).returning();

      const [appB] = await db.insert(rentalApplications).values({
        applicantUserId: tenantB.id,
        propertyId: prop.id,
        status: 'APPROVED',
      }).returning();

      let leaseB: any;
      let appA: any;
      try {
        leaseB = await leaseRepository.createLease(
          prop.id,
          u1.id,
          [tenantB.id],
          '2044-01-01',
          '2044-12-31',
          1200,
          'USD'
        );
        await leaseRepository.activateLease(leaseB.id);

        const [createdAppA] = await db.insert(rentalApplications).values({
          applicantUserId: tenantA.id,
          propertyId: prop.id,
          status: 'APPROVED',
        }).returning();
        appA = createdAppA;

        // 1. Physical space protection: Attempting to lease u1 again fails due to physical space conflict
        await assert.rejects(
          async () => {
            await leaseRepository.createLease(
              prop.id,
              u1.id,
              [tenantA.id],
              '2044-06-01',
              '2045-05-31',
              1300,
              'USD'
            );
          },
          /Lease period overlaps with an existing active or pending lease for this property\/unit/i
        );

        // 2. Tenant overlap protection: Attempting to lease u2 with secondary co-tenant tenantB fails due to tenant duplicate tenancy
        await assert.rejects(
          async () => {
            await leaseRepository.createLease(
              prop.id,
              u2.id,
              [tenantA.id, tenantB.id], // tenantB already has active lease on prop during 2044
              '2044-06-01',
              '2045-05-31',
              1400,
              'USD'
            );
          },
          /already has an active or pending lease/i
        );
      } finally {
        if (leaseB?.id) {
          await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseB.id));
          await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseB.id));
          await db.delete(leases).where(eq(leases.id, leaseB.id));
        }
        const appIds = [appB.id, appA?.id].filter(Boolean);
        if (appIds.length > 0) {
          await db.delete(rentalApplications).where(inArray(rentalApplications.id, appIds));
        }
        await db.delete(units).where(inArray(units.id, [u1.id, u2.id]));
      }
    });

    // 13g. Draft cancellation releases primary application reservation without consuming it
    await tSub.test('13g. Draft cancellation releases primary application reservation without consuming it', async () => {
      const [appDraft] = await db.insert(rentalApplications).values({
        applicantUserId: tenantA.id,
        propertyId: prop.id,
        status: 'APPROVED',
      }).returning();

      let draftLease: any;
      let newLease: any;
      try {
        draftLease = await leaseRepository.createLease(
          prop.id,
          null,
          [tenantA.id, tenantB.id],
          '2046-01-01',
          '2046-12-31',
          1400,
          'USD'
        );

        // Cancel the draft lease
        await db.update(leases).set({ status: LeaseStatus.CANCELLED }).where(eq(leases.id, draftLease.id));

        // The application reservation is released; application is still APPROVED
        const [appCheck] = await db.select().from(rentalApplications).where(eq(rentalApplications.id, appDraft.id));
        assert.strictEqual(appCheck.status, 'APPROVED', 'Application must remain APPROVED after cancellation');

        // Can now reserve the same application for another lease
        newLease = await leaseRepository.createLease(
          prop.id,
          null,
          [tenantA.id],
          '2046-01-01',
          '2046-12-31',
          1400,
          'USD'
        );
        assert.strictEqual(newLease.rentalApplicationId, appDraft.id, 'Application must be reserved by the new lease');
      } finally {
        const leaseIds = [draftLease?.id, newLease?.id].filter(Boolean);
        if (leaseIds.length > 0) {
          await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
          await db.delete(leases).where(inArray(leases.id, leaseIds));
        }
        await db.delete(rentalApplications).where(eq(rentalApplications.id, appDraft.id));
      }
    });
  });
});

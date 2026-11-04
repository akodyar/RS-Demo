import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  verificationRecords,
  units,
  ownershipRecords,
  managementAgreements,
  listings,
  propertyInquiries,
  rentalApplications,
  leases,
  leaseTenants,
  rentSchedules,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { propertyRepository } from '../src/server/repositories/properties.js';
import { rentalAcquisitionRepository } from '../src/server/repositories/rental-acquisition.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { UserRole, Permission, LeaseStatus } from '../src/types/index.js';

test('Rental Property Creation & Tenant Management Lifecycle Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `rptm_${TIMESTAMP}`;

  // 1. Provision Test Personas
  const ownerUser = {
    id: `${PREFIX}_owner`,
    firstName: 'Hawkar',
    lastName: 'Owner',
    email: `${PREFIX}_owner@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const tenantUser = {
    id: `${PREFIX}_tenant`,
    firstName: 'Soran',
    lastName: 'Tenant',
    email: `${PREFIX}_tenant@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const tenantWithoutLease = {
    id: `${PREFIX}_tenant_nolease`,
    firstName: 'Diyar',
    lastName: 'NoLease',
    email: `${PREFIX}_nolease@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const foreignOwner = {
    id: `${PREFIX}_foreign_owner`,
    firstName: 'Nadir',
    lastName: 'Foreign',
    email: `${PREFIX}_foreign@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  // Insert Users
  await db.insert(users).values([
    ownerUser,
    tenantUser,
    tenantWithoutLease,
    foreignOwner
  ]);

  let createdPropertyId: string = '';
  let createdUnitId: string = '';
  let createdListingId: string = '';
  let createdAppId: string = '';
  let createdLeaseId: string = '';

  await t.test('1. Property Creation: Enforces rental-only release boundary, validates fees and persists property', async () => {
    // 1a. Rejection of FOR_SALE listing type (Rental-only boundary invariant)
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(
          ownerUser.id,
          ownerUser.roles,
          {
            name: 'Sale Violation Villa',
            type: 'VILLA',
            city: 'Erbil',
            listingType: 'FOR_SALE',
            price: 450000000,
            currency: 'IQD',
          }
        );
      },
      /Sale workflows and FOR_SALE listings are disabled in this rental-only release/i,
      'Should strictly reject FOR_SALE properties'
    );

    // 1b. Fee validation (fees must be between 0 and 1)
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(
          ownerUser.id,
          ownerUser.roles,
          {
            name: 'Excessive Fee Property',
            type: 'APARTMENT',
            city: 'Erbil',
            listingType: 'FOR_RENT',
            price: 1500000,
            currency: 'IQD',
            operatingModel: 'FULLY_MANAGED',
            rentFee: 1.5, // 150% is invalid
          }
        );
      },
      /INVALID_FEE: Rent fee must be a valid number between 0 and 1/i,
      'Should reject rent fee > 1'
    );

    // 1c. Create valid property under FULLY_MANAGED model
    const property = await propertyRepository.createProperty(
      ownerUser.id,
      ownerUser.roles,
      {
        name: 'Royal Crest Apartments Erbil',
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1250000,
        currency: 'IQD',
        description: 'Modern luxury residential apartment in Gulan, Erbil.',
        operatingModel: 'FULLY_MANAGED',
        rentFee: 0.05,
        managementFee: 0.10,
        address: {
          city: 'Erbil',
          state: 'Erbil Governorate',
          street: 'Gulan Street 40m',
          lat: 36.1901,
          lng: 44.0090,
        },
        squareFeet: 160,
        bedrooms: 3,
        bathrooms: 2,
      },
      { idempotencyKey: `idemp_${PREFIX}_prop1` }
    );

    assert.ok(property, 'Property should be successfully created');
    assert.strictEqual(property.name, 'Royal Crest Apartments Erbil');
    assert.strictEqual(property.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(property.currency, 'IQD');
    createdPropertyId = property.id;

    // Verify ownership record
    const [ownership] = await db
      .select()
      .from(ownershipRecords)
      .where(eq(ownershipRecords.propertyId, createdPropertyId));
    assert.ok(ownership, 'Ownership record must be created');
    assert.strictEqual(ownership.ownerId, ownerUser.id);
    assert.strictEqual(parseFloat(ownership.ownershipPercentage), 100);
  });

  await t.test('2. Property Creation Idempotency: Replaying with identical key returns cached record', async () => {
    const replay = await propertyRepository.createProperty(
      ownerUser.id,
      ownerUser.roles,
      {
        name: 'Royal Crest Apartments Erbil',
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1250000,
        currency: 'IQD',
        description: 'Modern luxury residential apartment in Gulan, Erbil.',
        operatingModel: 'FULLY_MANAGED',
        rentFee: 0.05,
        managementFee: 0.10,
        address: {
          city: 'Erbil',
          state: 'Erbil Governorate',
          street: 'Gulan Street 40m',
          lat: 36.1901,
          lng: 44.0090,
        },
        squareFeet: 160,
        bedrooms: 3,
        bathrooms: 2,
      },
      { idempotencyKey: `idemp_${PREFIX}_prop1` }
    );

    assert.strictEqual(replay.id, createdPropertyId, 'Idempotent replay must return original property ID');
    assert.strictEqual((replay as any).__isReplay, true, '__isReplay flag must be true');
  });

  await t.test('3. Unit Creation: Adding units to property and duplicate prevention', async () => {
    // Add Unit 101
    const unit101 = await propertyRepository.addUnit(createdPropertyId, {
      unitNumber: '101',
      beds: 3,
      baths: 2,
      squareFeet: 160,
      marketRent: 1250000,
      currency: 'IQD',
    });

    assert.ok(unit101, 'Unit 101 should be created');
    assert.strictEqual(unit101.unitNumber, '101');
    assert.strictEqual(unit101.status, 'VACANT');
    createdUnitId = unit101.id;

    // Attempt adding duplicate unit 101
    await assert.rejects(
      async () => {
        await propertyRepository.addUnit(createdPropertyId, {
          unitNumber: '101',
          beds: 3,
          baths: 2,
        });
      },
      /CONFLICT|already exists/i,
      'Duplicate unit number on the same property must be rejected'
    );
  });

  await t.test('4. RENT-Only Enforcement: Listings must strictly be FOR_RENT', async () => {
    // Mark property as verified for listing
    await db
      .update(properties)
      .set({ verificationStatus: 'VERIFIED', status: 'ACTIVE' })
      .where(eq(properties.id, createdPropertyId));

    // Update ownership record to VERIFIED
    await db
      .update(ownershipRecords)
      .set({ status: 'VERIFIED' })
      .where(eq(ownershipRecords.propertyId, createdPropertyId));

    // Create rental listing
    const listing = await rentalAcquisitionRepository.createListing(
      { id: ownerUser.id, roles: ownerUser.roles },
      {
        propertyId: createdPropertyId,
        title: 'Spacious 3BR Apartment in Gulan',
        description: 'Available for immediate rental.',
        price: 1250000,
        currency: 'IQD',
      }
    );

    assert.ok(listing, 'Listing should be created');
    assert.strictEqual(listing.type, 'FOR_RENT', 'Listing type must strictly be FOR_RENT');
    createdListingId = listing.id;

    // Publish listing
    const published = await rentalAcquisitionRepository.updateListingStatus(
      ownerUser.id,
      createdListingId,
      'PUBLISHED'
    );
    assert.strictEqual(published.status, 'PUBLISHED');
  });

  await t.test('5. Tenant Inquiries and Rental Application Submission', async () => {
    // Tenant creates inquiry
    const inquiry = await rentalAcquisitionRepository.createInquiry(
      tenantUser.id,
      createdListingId,
      'Is water and generator power included in the monthly rent?'
    );
    assert.ok(inquiry, 'Inquiry should be created');
    assert.strictEqual(inquiry.buyerId, tenantUser.id);

    // Tenant submits rental application
    const app = await rentalAcquisitionRepository.submitApplication(
      tenantUser.id,
      createdListingId,
      {
        monthlyIncome: 3500000,
        preferredMoveInDate: '2026-11-01',
        employmentStatus: 'Software Engineer',
        notes: 'Family of 3, non-smokers, no pets.',
      }
    );

    assert.ok(app, 'Rental application should be submitted');
    assert.strictEqual(app.status, 'SUBMITTED');
    assert.strictEqual(app.applicantUserId, tenantUser.id);
    createdAppId = app.id;

    // Duplicate application check
    await assert.rejects(
      async () => {
        await rentalAcquisitionRepository.submitApplication(
          tenantUser.id,
          createdListingId,
          { monthlyIncome: 3500000 }
        );
      },
      /already have an active application/i,
      'Duplicate active rental application must be rejected'
    );
  });

  await t.test('6. Application Review & Approval Authority', async () => {
    // Unauthorized owner cannot review
    await assert.rejects(
      async () => {
        await rentalAcquisitionRepository.reviewApplication(
          { id: foreignOwner.id, roles: foreignOwner.roles },
          createdAppId,
          'APPROVED'
        );
      },
      /Unauthorized/i,
      'Foreign owner cannot review application for unowned property'
    );

    // Tenant without owner role cannot review application
    await assert.rejects(
      async () => {
        await rentalAcquisitionRepository.reviewApplication(
          { id: tenantUser.id, roles: tenantUser.roles },
          createdAppId,
          'APPROVED'
        );
      },
      /Unauthorized/i,
      'Applicant cannot review own application'
    );

    // Authorized owner reviews and approves application
    const approved = await rentalAcquisitionRepository.reviewApplication(
      { id: ownerUser.id, roles: ownerUser.roles },
      createdAppId,
      'APPROVED'
    );
    assert.strictEqual(approved.status, 'APPROVED');
  });

  await t.test('7. Digital Lease Creation & Tenant Assignment', async () => {
    const startDate = '2026-11-01';
    const endDate = '2027-10-31';

    const lease = await leaseRepository.createLease(
      createdPropertyId,
      createdUnitId,
      [tenantUser.id],
      startDate,
      endDate,
      1250000,
      'IQD'
    );

    assert.ok(lease, 'Lease should be created');
    assert.strictEqual(lease.status, LeaseStatus.DRAFT);
    assert.strictEqual(lease.propertyId, createdPropertyId);
    assert.strictEqual(lease.unitId, createdUnitId);
    createdLeaseId = lease.id;

    // Verify tenant association in leaseTenants
    const [tenantLink] = await db
      .select()
      .from(leaseTenants)
      .where(eq(leaseTenants.leaseId, createdLeaseId));
    assert.ok(tenantLink, 'Tenant must be linked in leaseTenants');
    assert.strictEqual(tenantLink.tenantId, tenantUser.id);
    assert.strictEqual(tenantLink.isPrimary, true);

    // Unapproved tenant cannot be assigned to lease
    await assert.rejects(
      async () => {
        await leaseRepository.createLease(
          createdPropertyId,
          createdUnitId,
          [tenantWithoutLease.id],
          '2026-12-01',
          '2027-11-30',
          1250000,
          'IQD'
        );
      },
      /APPROVED rental application/i,
      'Tenant without approved application cannot be assigned to lease'
    );

    // Transition first lease to ACTIVE to lock physical unit space
    await db
      .update(leases)
      .set({ status: LeaseStatus.ACTIVE })
      .where(eq(leases.id, createdLeaseId));

    // Overlapping lease on active unit must be rejected by assertNoPhysicalSpaceOverlap
    await assert.rejects(
      async () => {
        await leaseRepository.createLease(
          createdPropertyId,
          createdUnitId,
          [tenantUser.id],
          '2026-12-01',
          '2027-11-30',
          1250000,
          'IQD'
        );
      },
      /overlap|reserved/i,
      'Overlapping lease on active unit must be rejected'
    );
  });

  await t.test('8. Active Tenancy Determination & Access Boundaries', async () => {
    // Update unit status to OCCUPIED
    await db
      .update(units)
      .set({ status: 'OCCUPIED' })
      .where(eq(units.id, createdUnitId));

    // Active tenant can access active lease dashboard
    const dashboard = await tenantRepository.getAuthoritativeDashboard(tenantUser.id);
    assert.ok(dashboard, 'Dashboard should return for tenant');
    assert.ok(dashboard.currentProperty, 'Active tenant should have current property populated');
    assert.strictEqual(dashboard.currentProperty.id, createdPropertyId);
    assert.strictEqual(dashboard.currentProperty.unitId, createdUnitId);

    // Tenant without lease has null currentProperty
    const noLeaseDashboard = await tenantRepository.getAuthoritativeDashboard(tenantWithoutLease.id);
    assert.strictEqual(noLeaseDashboard.currentProperty, null, 'Tenant without lease must have null currentProperty');

    // Tenant cannot access private owner financials
    const [propRecord] = await db
      .select()
      .from(ownershipRecords)
      .where(
        and(
          eq(ownershipRecords.propertyId, createdPropertyId),
          eq(ownershipRecords.ownerId, tenantUser.id)
        )
      );
    assert.strictEqual(propRecord, undefined, 'Tenant must NOT have ownership over property');
  });

  await t.test('9. Clean Up Test Records', async () => {
    // Delete in reverse foreign key order
    const propLeases = await db
      .select({ id: leases.id })
      .from(leases)
      .where(eq(leases.propertyId, createdPropertyId));
    const leaseIds = propLeases.map((l) => l.id);

    if (leaseIds.length > 0) {
      await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
      await db.delete(rentSchedules).where(inArray(rentSchedules.leaseId, leaseIds));
      await db.delete(leases).where(inArray(leases.id, leaseIds));
    }
    await db.delete(propertyInquiries).where(eq(propertyInquiries.propertyId, createdPropertyId));
    await db.delete(rentalApplications).where(eq(rentalApplications.propertyId, createdPropertyId));
    await db.delete(listings).where(eq(listings.propertyId, createdPropertyId));
    await db.delete(units).where(eq(units.propertyId, createdPropertyId));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, createdPropertyId));
    await db.delete(verificationRecords).where(eq(verificationRecords.propertyId, createdPropertyId));
    await db.delete(properties).where(eq(properties.id, createdPropertyId));
    await db
      .delete(users)
      .where(
        inArray(users.id, [
          ownerUser.id,
          tenantUser.id,
          tenantWithoutLease.id,
          foreignOwner.id,
        ])
      );
  });
});

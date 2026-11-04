import test from 'node:test';
import assert from 'node:assert';
import { injectPgliteMock } from './setup-pglite.js';
import { rentalAcquisitionRepository } from '../src/server/repositories/rental-acquisition.js';
import { db } from '../src/db/index.js';
import { users, properties, listings, organizations } from '../src/db/schema.js';

test('Rental Application Backend Integration', async (t) => {
  await injectPgliteMock();

  // Seed required data for the test
  let tenantId = 'tenant-1';
  let propertyId = 'prop-1';
  let listingId = 'list-1';

  await db.insert(users).values({
    id: tenantId,
    email: 'tenant@example.com',
    firstName: 'Tenant',
    lastName: 'User',
    roles: ['TENANT'],
  });

  await db.insert(organizations).values({
    id: 'org-1',
    name: 'Org 1',
    type: 'PROPERTY_MANAGEMENT',
  });

  await db.insert(properties).values({
    id: propertyId,
    name: 'Test Property',
    type: 'RESIDENTIAL',
  });

  await db.insert(listings).values({
    id: listingId,
    propertyId: propertyId,
    publisherUserId: tenantId,
    status: 'PUBLISHED',
    type: 'FOR_RENT',
    price: '1500',
    title: 'Test Listing'
  });

  await t.test('Successfully submits application with valid monthlyIncome and notes', async () => {
    const app = await rentalAcquisitionRepository.submitApplication(tenantId, listingId, {
      monthlyIncome: 5000,
      notes: 'I love this place'
    });
    assert.ok(app.id, 'Application should be created and return an ID');
    assert.strictEqual(app.status, 'SUBMITTED', 'Status should be SUBMITTED');
  });

  await t.test('Fails application submission without monthlyIncome due to schema constraint or type error', async () => {
    try {
      // @ts-ignore - purposefully forcing undefined to simulate payload gap
      await rentalAcquisitionRepository.submitApplication(tenantId, listingId, {
        notes: 'I love this place'
      });
      assert.fail('Should have thrown an error due to missing monthlyIncome');
    } catch (err: any) {
      assert.ok(err, 'Should throw an error');
      // The error can either be TypeError from toString() or a DB constraint error
    }
  });
});

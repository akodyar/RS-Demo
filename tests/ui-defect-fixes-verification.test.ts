process.env.SQL_DB_NAME = 'homehub_test';
import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db, closePool } from '../src/db/index.js';
import {
  users,
  properties,
  units,
  leases,
  leaseTenants,
  pricingTiers,
  utilityBills,
  utilityPayments,
  ownershipRecords,
  idempotencyRecords,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

test('UI Defect Fixes Verification: Pricing Tiers, Property Validation, Utility Bill Payment', async (t) => {
  // 0. Hard Safety Gate: Must target verified local test database
  process.env.SQL_DB_NAME = 'homehub_test';
  await closePool();
  const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  console.log('ACTIVE TEST DB IS:', activeDb);
  assert.strictEqual(activeDb, 'homehub_test', 'MUST connect strictly to homehub_test. Never access homehub_production!');

  // Start in-process Express server with apiRouter mounted on /api
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = `dfv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const password = 'Password123!';
  const pwdHash = await hashPassword(password);

  const superAdminId = `usr_sa_${runId}`;
  const superAdminEmail = `superadmin_${runId}@homehub.iq`;

  const ownerId = `usr_owner_${runId}`;
  const ownerEmail = `owner_${runId}@homehub.iq`;

  const tenant1Id = `usr_ten1_${runId}`;
  const tenant1Email = `tenant1_${runId}@homehub.iq`;

  const tenant2Id = `usr_ten2_${runId}`;
  const tenant2Email = `tenant2_${runId}@homehub.iq`;

  const propId = `prop_u_${runId}`;
  const unitId = `unit_u_${runId}`;
  const lease1Id = `lease1_${runId}`;
  const lease2Id = `lease2_${runId}`;
  const bill1Id = `bill1_${runId}`;
  const bill2Id = `bill2_${runId}`;

  try {
    // Seed test users
    await db.insert(users).values([
      {
        id: superAdminId,
        email: superAdminEmail,
        passwordHash: pwdHash,
        firstName: 'Super',
        lastName: 'Admin',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
        isActive: true,
      },
      {
        id: ownerId,
        email: ownerEmail,
        passwordHash: pwdHash,
        firstName: 'Owner',
        lastName: 'Test',
        roles: ['PROPERTY_OWNER'],
        isActive: true,
      },
      {
        id: tenant1Id,
        email: tenant1Email,
        passwordHash: pwdHash,
        firstName: 'Tenant',
        lastName: 'One',
        roles: ['TENANT'],
        isActive: true,
      },
      {
        id: tenant2Id,
        email: tenant2Email,
        passwordHash: pwdHash,
        firstName: 'Tenant',
        lastName: 'Two',
        roles: ['TENANT'],
        isActive: true,
      },
    ]);

    // Login helper
    const login = async (email: string) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Login failed for ${email}`);
      return data.token as string;
    };

    const superAdminToken = await login(superAdminEmail);
    const ownerToken = await login(ownerEmail);
    const tenant1Token = await login(tenant1Email);
    const tenant2Token = await login(tenant2Email);

    // Setup property and active leases for tenants to test utility bills
    await db.insert(properties).values({
      id: propId,
      name: `Utility Test Property ${runId}`,
      type: 'RESIDENTIAL',
      currency: 'USD',
      status: 'ACTIVE',
      rentFee: '0.05',
      managementFee: '0.08',
    });

    await db.insert(ownershipRecords).values({
      id: `own_u_${runId}`,
      propertyId: propId,
      ownerId: ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    await db.insert(units).values({
      id: unitId,
      propertyId: propId,
      unitNumber: `101_${runId}`,
      monthlyRent: '1000',
      status: 'OCCUPIED',
    });

    // Active lease for Tenant 1
    await db.insert(leases).values({
      id: lease1Id,
      propertyId: propId,
      unitId: unitId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000',
      depositAmount: '1000',
      currency: 'USD',
      status: 'ACTIVE',
    });

    await db.insert(leaseTenants).values({
      id: `lt1_${runId}`,
      leaseId: lease1Id,
      tenantId: tenant1Id,
      isPrimary: true,
    });

    // Active lease for Tenant 2
    await db.insert(leases).values({
      id: lease2Id,
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '800',
      depositAmount: '800',
      currency: 'USD',
      status: 'ACTIVE',
    });

    await db.insert(leaseTenants).values({
      id: `lt2_${runId}`,
      leaseId: lease2Id,
      tenantId: tenant2Id,
      isPrimary: true,
    });

    // Seed utility bills: one for Tenant 1 ($150) and one for Tenant 2 ($200)
    await db.insert(utilityBills).values([
      {
        id: bill1Id,
        propertyId: propId,
        unitId: unitId,
        tenantId: tenant1Id,
        leaseId: lease1Id,
        type: 'ELECTRICITY',
        description: 'Electricity consumption for Jan 2026',
        amount: '150.00',
        outstandingAmount: '150.00',
        status: 'UNPAID',
        billingDate: '2026-01-15',
        dueDate: '2026-02-01',
      },
      {
        id: bill2Id,
        propertyId: propId,
        tenantId: tenant2Id,
        leaseId: lease2Id,
        type: 'WATER',
        description: 'Water consumption for Jan 2026',
        amount: '200.00',
        outstandingAmount: '200.00',
        status: 'UNPAID',
        billingDate: '2026-01-15',
        dueDate: '2026-02-01',
      },
    ]);

    // =========================================================================
    // DEFECT 1: ADMIN PRICING TIER CREATION
    // =========================================================================
    console.log('Testing Defect 1: Admin Pricing Tier Creation...');
    // Attempt with Owner token
    const resOwner = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Tier',
        minProperties: 5,
        maxProperties: 10,
        rentFeeRate: '0.04',
        managementFeeRate: '0.07',
        priority: 1,
      }),
    });
    assert.strictEqual(resOwner.status, 403, 'Owner token must be rejected with 403');

    // Attempt with Tenant token
    const resTenant = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Tier Tenant',
        minProperties: 0,
        maxProperties: null,
        rentFeeRate: '0.05',
        managementFeeRate: '0.08',
        priority: 1,
      }),
    });
    assert.strictEqual(resTenant.status, 403, 'Tenant token must be rejected with 403');

    // Negative minProperties
    const resNeg = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Invalid Neg Tier',
        minProperties: -5,
        maxProperties: 10,
        rentFeeRate: '0.04',
        managementFeeRate: '0.07',
        priority: 1,
      }),
    });
    assert.strictEqual(resNeg.status, 400);
    const dataNeg = await resNeg.json();
    assert.strictEqual(dataNeg.error, 'minProperties cannot be negative');

    // maxProperties < minProperties
    const resInverted = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Inverted Tier',
        minProperties: 20,
        maxProperties: 10,
        rentFeeRate: '0.03',
        managementFeeRate: '0.06',
        priority: 2,
      }),
    });
    assert.strictEqual(resInverted.status, 400);
    const dataInverted = await resInverted.json();
    assert.strictEqual(dataInverted.error, 'maxProperties cannot be less than minProperties');

    // Super Admin creates tier
    const tierName = `Platinum Tier ${runId}`;
    const resCreateTier = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: tierName,
        minProperties: 15,
        maxProperties: 50,
        rentFeeRate: '0.03',
        managementFeeRate: '0.06',
        priority: 3,
      }),
    });
    assert.strictEqual(resCreateTier.status, 201, 'Should create pricing tier with 201 Created');
    const created = await resCreateTier.json();
    assert.strictEqual(created.status, 'ok');
    assert.strictEqual(created.tier.name, tierName);
    assert.strictEqual(created.tier.minProperties, 15);
    assert.strictEqual(created.tier.maxProperties, 50);

    // Verify PostgreSQL persistence
    const [dbTier] = await db.select().from(pricingTiers).where(eq(pricingTiers.id, created.tier.id));
    assert.ok(dbTier, 'Created tier must exist in PostgreSQL pricing_tiers');
    assert.strictEqual(dbTier.name, tierName);

    // Verify GET /api/admin/pricing-tiers returns newly created tier
    const getRes = await fetch(`${baseUrl}/admin/pricing-tiers`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(Array.isArray(getData.pricingTiers));
    const found = getData.pricingTiers.find((t: any) => t.id === created.tier.id);
    assert.ok(found, 'Created tier must appear in GET /api/admin/pricing-tiers authoritative list');
    console.log('✓ Defect 1: Admin Pricing Tier Creation PASSED');

    // =========================================================================
    // DEFECT 2: PROPERTY CREATION VALIDATION & ERROR MAPPING
    // =========================================================================
    console.log('Testing Defect 2: Property Creation Validation & Error Mapping...');
    // Missing Property Name
    const resNoName = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        type: 'Apartment',
        listingType: 'FOR_RENT',
        rentFee: 0.05,
      }),
    });
    assert.strictEqual(resNoName.status, 400);
    const dataNoName = await resNoName.json();
    assert.strictEqual(dataNoName.error, 'VALIDATION_ERROR');
    assert.ok(dataNoName.message.includes('Property name is required'));

    // Negative Rent Fee
    const resNegFee = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: `Neg Fee Prop ${runId}`,
        type: 'Apartment',
        listingType: 'FOR_RENT',
        address: { city: 'Erbil' },
        rentFee: -0.05,
      }),
    });
    assert.strictEqual(resNegFee.status, 400);
    const dataNegFee = await resNegFee.json();
    assert.strictEqual(dataNegFee.error, 'VALIDATION_ERROR');
    assert.ok(dataNegFee.message.includes('Rent fee must be a valid number between 0 and 1'));

    // Exceeding 100% (1.0) Management Fee
    const resOverFee = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: `Over Fee Prop ${runId}`,
        type: 'Apartment',
        listingType: 'FOR_RENT',
        address: { city: 'Erbil' },
        managementFee: 1.5,
      }),
    });
    assert.strictEqual(resOverFee.status, 400);
    const dataOverFee = await resOverFee.json();
    assert.strictEqual(dataOverFee.error, 'VALIDATION_ERROR');
    assert.ok(dataOverFee.message.includes('Management fee must be a valid number between 0 and 1'));

    // Rental-Only Boundary: FOR_SALE rejected on property creation
    const resForSale = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: `For Sale Prop ${runId}`,
        type: 'Villa',
        listingType: 'FOR_SALE',
        address: { city: 'Erbil' },
      }),
    });
    assert.strictEqual(resForSale.status, 400);
    const dataForSale = await resForSale.json();
    assert.strictEqual(dataForSale.error, 'VALIDATION_ERROR');
    assert.ok(dataForSale.message.includes('Sale workflows and FOR_SALE listings are disabled in this rental-only release'));

    // Rental-Only Boundary: FOR_SALE rejected on marketplace listing with 403 BUY_SELL_DISABLED
    const resMarketplaceSale = await fetch(`${baseUrl}/owner/marketplace/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        propertyId: propId,
        type: 'FOR_SALE',
        price: 1500,
        title: 'Luxury Villa For Sale',
      }),
    });
    assert.strictEqual(resMarketplaceSale.status, 403);
    const dataMarketplaceSale = await resMarketplaceSale.json();
    assert.strictEqual(dataMarketplaceSale.error, 'BUY_SELL_DISABLED');

    // Valid property creation with Idempotency-Key
    const propName = `Valid Wizard Prop ${runId}`;
    const idempotencyKey = `idem_prop_${runId}_001`;

    const createPayload = {
      name: propName,
      type: 'Apartment',
      listingType: 'FOR_RENT',
      price: 1500,
      currency: 'IQD',
      rentFee: 0.05,
      managementFee: 0.08,
      address: {
        street: 'Gulan Street 12',
        city: 'Erbil',
        state: 'Erbil Governorate',
        country: 'Iraq',
        lat: 36.1901,
        lng: 44.009,
      },
    };

    const res1 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(createPayload),
    });
    assert.strictEqual(res1.status, 201, 'First property creation must return 201');
    const createdProp = await res1.json();
    assert.ok(createdProp.id, 'Created property must have an ID');
    assert.strictEqual(createdProp.name, propName);

    // Verify DB persistence in properties & ownership_records
    const [dbProp] = await db.select().from(properties).where(eq(properties.id, createdProp.id));
    assert.ok(dbProp, 'Property row must exist in PostgreSQL properties table');

    const [dbOwnership] = await db.select().from(ownershipRecords).where(
      and(
        eq(ownershipRecords.propertyId, createdProp.id),
        eq(ownershipRecords.ownerId, ownerId)
      )
    );
    assert.ok(dbOwnership, 'Ownership record must be created for verified owner');
    assert.strictEqual(dbOwnership.status, 'PENDING_VERIFICATION');

    // Idempotent Replay
    const res2 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(createPayload),
    });
    assert.strictEqual(res2.status, 201, 'Replayed submission must return 201 replay');
    const replayProp = await res2.json();
    assert.strictEqual(replayProp.id, createdProp.id, 'Replay must return exact same property ID');

    const allPropsWithName = await db.select().from(properties).where(eq(properties.name, propName));
    assert.strictEqual(allPropsWithName.length, 1, 'Idempotency must prevent duplicate property rows');
    console.log('✓ Defect 2: Property Creation Validation & Idempotency PASSED');

    // =========================================================================
    // DEFECT 3: TENANT UTILITY BILL PAYMENT & ERROR HANDLING
    // =========================================================================
    console.log('Testing Defect 3: Tenant Utility Bill Payment & Error Handling...');
    // 0 amount
    const resZero = await fetch(`${baseUrl}/tenant/utility-bills/${bill1Id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ amount: 0, paymentMethod: 'SYSTEM' }),
    });
    assert.strictEqual(resZero.status, 400);
    const dataZero = await resZero.json();
    assert.strictEqual(dataZero.error, 'VALIDATION_ERROR');
    assert.ok(dataZero.message.includes('Valid amount is required'));

    // Cross-tenant unauthorized payment
    const resUnauthorized = await fetch(`${baseUrl}/tenant/utility-bills/${bill1Id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ amount: 50, paymentMethod: 'SYSTEM' }),
    });
    assert.strictEqual(resUnauthorized.status, 403, 'Cross-tenant bill payment must be rejected with 403');
    const dataUnauthorized = await resUnauthorized.json();
    assert.strictEqual(dataUnauthorized.error, 'FORBIDDEN');
    assert.ok(dataUnauthorized.message.includes('not authorized to pay this bill'));

    // Authorized partial payment
    const resPartial = await fetch(`${baseUrl}/tenant/utility-bills/${bill1Id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ amount: 100, paymentMethod: 'SYSTEM' }),
    });
    assert.strictEqual(resPartial.status, 201, 'Partial payment must return 201 Created');
    const partialData = await resPartial.json();
    assert.ok(partialData.payment, 'Payment object returned');
    assert.strictEqual(Number(partialData.bill.outstandingAmount), 50, 'Outstanding balance should be 50');
    assert.strictEqual(partialData.bill.status, 'PARTIAL');

    // Authorized final payment
    const resComplete = await fetch(`${baseUrl}/tenant/utility-bills/${bill1Id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ amount: 50, paymentMethod: 'SYSTEM' }),
    });
    assert.strictEqual(resComplete.status, 201, 'Final payment must return 201 Created');
    const completeData = await resComplete.json();
    assert.strictEqual(Number(completeData.bill.outstandingAmount), 0, 'Outstanding balance should be 0');
    assert.strictEqual(completeData.bill.status, 'PAID');

    // Verify PostgreSQL persistence
    const [dbBill] = await db.select().from(utilityBills).where(eq(utilityBills.id, bill1Id));
    assert.strictEqual(Number(dbBill.outstandingAmount), 0);
    assert.strictEqual(dbBill.status, 'PAID');

    const dbPayments = await db.select().from(utilityPayments).where(eq(utilityPayments.billId, bill1Id));
    assert.strictEqual(dbPayments.length, 2, 'Two payment records must be recorded in PostgreSQL');

    // Attempting to pay on a fully paid bill fails with meaningful error (prevents duplicate overpayment)
    const resDuplicate = await fetch(`${baseUrl}/tenant/utility-bills/${bill1Id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ amount: 20, paymentMethod: 'SYSTEM' }),
    });
    assert.strictEqual(resDuplicate.status, 400);
    const dataDuplicate = await resDuplicate.json();
    assert.ok(dataDuplicate.error.includes('PAID'), 'Must reject payment on already paid bill');
    console.log('✓ Defect 3: Tenant Utility Bill Payment & Errors PASSED');

  } catch (error) {
    console.error('FAILED TEST EXCEPTION:', error);
    throw error;
  } finally {
    server.close();
    // Cleanup seeded data
    try {
      await db.delete(utilityPayments).where(eq(utilityPayments.billId, bill1Id));
      await db.delete(utilityBills).where(sql`id IN (${bill1Id}, ${bill2Id})`);
      await db.delete(leaseTenants).where(sql`id IN (${`lt1_${runId}`}, ${`lt2_${runId}`})`);
      await db.delete(leases).where(sql`id IN (${lease1Id}, ${lease2Id})`);
      await db.delete(units).where(eq(units.id, unitId));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
      await db.delete(properties).where(eq(properties.id, propId));
      await db.delete(pricingTiers).where(sql`name LIKE ${`%${runId}%`}`);
      await db.delete(idempotencyRecords).where(sql`key LIKE ${`%${runId}%`}`);
      await db.delete(users).where(sql`id IN (${superAdminId}, ${ownerId}, ${tenant1Id}, ${tenant2Id})`);
    } catch (_) {}
    await closePool();
    console.log('ALL UI DEFECT FIX VERIFICATIONS COMPLETED AND CLEANED UP SUCCESSFULLY!');
  }
});

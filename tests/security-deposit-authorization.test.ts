import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  securityDeposits,
  chartOfAccounts,
  journalEntries,
  ledgerLines,
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { Permission, UserRole } from '../src/types/index.js';

test('Phase 34 — Security Deposit Financial Authorization Integration Suite (G-01 / D03)', async (t) => {
  const runId = `d03_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  // Setup Accounts in Chart of Accounts (if missing)
  await db.insert(chartOfAccounts).values([
    { id: `coa_1010_${runId}`, code: '1010', name: 'Cash', accountType: 'ASSET' },
    { id: `coa_2100_${runId}`, code: '2100', name: 'Security Deposits Liability', accountType: 'LIABILITY' },
  ]).onConflictDoNothing();

  // Personas
  const ownerId = `owner_${runId}`;
  const viewOnlyManagerId = `vomgr_${runId}`;
  const viewOnlyOrgId = `voorg_${runId}`;
  const financialManagerId = `finmgr_${runId}`;
  const financialOrgId = `finorg_${runId}`;
  const unrelatedManagerId = `unrmgr_${runId}`;
  const unrelatedOrgId = `unrorg_${runId}`;
  const tenantId = `tenant_${runId}`;

  // Tokens
  const ownerToken = signAuthToken({
    id: ownerId,
    email: `${ownerId}@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
  });

  const viewOnlyManagerToken = signAuthToken({
    id: viewOnlyManagerId,
    email: `${viewOnlyManagerId}@agency.iq`,
    roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER],
    organizationId: viewOnlyOrgId,
  });

  const financialManagerToken = signAuthToken({
    id: financialManagerId,
    email: `${financialManagerId}@agency.iq`,
    roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER],
    organizationId: financialOrgId,
  });

  const unrelatedManagerToken = signAuthToken({
    id: unrelatedManagerId,
    email: `${unrelatedManagerId}@otheragency.iq`,
    roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER],
    organizationId: unrelatedOrgId,
  });

  const tenantToken = signAuthToken({
    id: tenantId,
    email: `${tenantId}@tenant.iq`,
    roles: [UserRole.TENANT],
  });

  // Entities
  const propId = `prop_${runId}`;
  const unrelatedPropId = `unrprop_${runId}`;
  const leaseId = `lease_${runId}`;
  const depositId = `dep_${runId}`;

  // Provision Users
  await db.insert(users).values([
    { id: ownerId, firstName: 'Aso', lastName: 'Owner', email: `${ownerId}@homehub.iq`, roles: [UserRole.PROPERTY_OWNER] },
    { id: viewOnlyManagerId, firstName: 'View', lastName: 'Manager', email: `${viewOnlyManagerId}@agency.iq`, roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER] },
    { id: financialManagerId, firstName: 'Fin', lastName: 'Manager', email: `${financialManagerId}@agency.iq`, roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER] },
    { id: unrelatedManagerId, firstName: 'Unrelated', lastName: 'Manager', email: `${unrelatedManagerId}@otheragency.iq`, roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER] },
    { id: tenantId, firstName: 'Shwan', lastName: 'Tenant', email: `${tenantId}@tenant.iq`, roles: [UserRole.TENANT] },
  ]);

  // Provision Organizations & Members
  await db.insert(organizations).values([
    { id: viewOnlyOrgId, name: 'View-Only Agency', type: 'AGENCY' },
    { id: financialOrgId, name: 'Financial Agency', type: 'AGENCY' },
    { id: unrelatedOrgId, name: 'Unrelated Agency', type: 'AGENCY' },
  ]);

  await db.insert(organizationMembers).values([
    { organizationId: viewOnlyOrgId, userId: viewOnlyManagerId, role: 'MANAGER', status: 'ACTIVE' },
    { organizationId: financialOrgId, userId: financialManagerId, role: 'MANAGER', status: 'ACTIVE' },
    { organizationId: unrelatedOrgId, userId: unrelatedManagerId, role: 'MANAGER', status: 'ACTIVE' },
  ]);

  // Provision Target Property & Ownership
  await db.insert(properties).values([
    {
      id: propId,
      name: `Deposit Test Property ${runId}`,
      type: 'RESIDENTIAL',
      operatingModel: 'FULLY_MANAGED',
      status: 'ACTIVE',
      currency: 'IQD',
      address: { city: 'Sulaymaniyah', district: 'Sarchinar' },
      createdBy: ownerId,
    },
    {
      id: unrelatedPropId,
      name: `Unrelated Property ${runId}`,
      type: 'RESIDENTIAL',
      operatingModel: 'FULLY_MANAGED',
      status: 'ACTIVE',
      currency: 'IQD',
      address: { city: 'Erbil', district: 'Ankawa' },
      createdBy: ownerId,
    },
  ]);

  await db.insert(ownershipRecords).values({
    propertyId: propId,
    ownerId,
    status: 'VERIFIED',
    ownershipPercentage: '100',
    acquiredDate: new Date().toISOString(),
  });

  // Provision Management Agreements:
  // 1. View-Only Agency on propId -> ONLY VIEW_PROPERTY
  await db.insert(managementAgreements).values({
    propertyId: propId,
    companyId: viewOnlyOrgId,
    ownerId,
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    grantedPermissions: [Permission.VIEW_PROPERTY],
  });

  // 2. Financial Agency on propId -> VIEW_PROPERTY + MANAGE_FINANCIALS
  await db.insert(managementAgreements).values({
    propertyId: propId,
    companyId: financialOrgId,
    ownerId,
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    grantedPermissions: [Permission.VIEW_PROPERTY, Permission.MANAGE_FINANCIALS],
  });

  // 3. Unrelated Agency on unrelatedPropId -> MANAGE_FINANCIALS on unrelatedPropId ONLY
  await db.insert(managementAgreements).values({
    propertyId: unrelatedPropId,
    companyId: unrelatedOrgId,
    ownerId,
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    grantedPermissions: [Permission.VIEW_PROPERTY, Permission.MANAGE_FINANCIALS],
  });

  // Provision Lease & Deposit
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    rentAmount: '1000000',
    depositAmount: '500000',
    currency: 'IQD',
    status: 'ACTIVE',
  });

  await db.insert(leaseTenants).values({
    leaseId,
    tenantId,
    isPrimary: true,
  });

  await db.insert(securityDeposits).values({
    id: depositId,
    leaseId,
    propertyId: propId,
    tenantId,
    requiredAmount: '500000',
    recordedAmount: '0',
    releasedAmount: '0',
    currency: 'IQD',
    status: 'PENDING',
  });

  // ========================================================================
  // SCENARIO 1: Denied — View-Only Company cannot collect deposit
  // ========================================================================
  await t.test('1. Denied — View-only Company cannot collect security deposit', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${viewOnlyManagerToken}`)
      .send({ amount: 500000 });

    assert.strictEqual(res.status, 403, `Must reject view-only company with HTTP 403: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.error, 'FORBIDDEN');
    assert.ok(res.body.message?.includes('not authorized to manage finances'));

    // Verify PostgreSQL state: deposit must remain PENDING with 0 recordedAmount
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId));
    assert.strictEqual(dep.status, 'PENDING');
    assert.strictEqual(Number(dep.recordedAmount), 0);
  });

  // ========================================================================
  // SCENARIO 2: Denied — View-Only Company cannot release deposit
  // ========================================================================
  await t.test('2. Denied — View-only Company cannot release security deposit', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/release`)
      .set('Authorization', `Bearer ${viewOnlyManagerToken}`)
      .send({ amount: 100000 });

    assert.strictEqual(res.status, 403, `Must reject view-only company with HTTP 403: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.error, 'FORBIDDEN');
    assert.ok(res.body.message?.includes('not authorized to manage finances'));
  });

  // ========================================================================
  // SCENARIO 3: Denied — Actor with MANAGE_FINANCIALS on another property has no access to target
  // ========================================================================
  await t.test('3. Denied — Company with financial authority elsewhere cannot collect or release on target property', async () => {
    const collectRes = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${unrelatedManagerToken}`)
      .send({ amount: 500000 });

    assert.strictEqual(collectRes.status, 403, 'Must reject unrelated manager collect with HTTP 403');
    assert.strictEqual(collectRes.body.error, 'FORBIDDEN');

    const releaseRes = await request(app)
      .post(`/api/owner/deposits/${depositId}/release`)
      .set('Authorization', `Bearer ${unrelatedManagerToken}`)
      .send({ amount: 100000 });

    assert.strictEqual(releaseRes.status, 403, 'Must reject unrelated manager release with HTTP 403');
    assert.strictEqual(releaseRes.body.error, 'FORBIDDEN');
  });

  // ========================================================================
  // SCENARIO 4: Denied — Tenant role is forbidden from owner deposit routes
  // ========================================================================
  await t.test('4. Denied — Tenant role receives 403 on owner deposit management endpoints', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ amount: 500000 });

    assert.strictEqual(res.status, 403, 'Tenant role must receive HTTP 403');
  });

  // ========================================================================
  // SCENARIO 5: Allowed — Verified Owner can collect security deposit
  // ========================================================================
  await t.test('5. Allowed — Verified Owner can collect security deposit', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 300000 });

    assert.strictEqual(res.status, 200, `Owner deposit collect must succeed: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'PARTIALLY_COLLECTED');
    assert.strictEqual(Number(res.body.recordedAmount), 300000);

    // Verify in PostgreSQL
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId));
    assert.strictEqual(dep.status, 'PARTIALLY_COLLECTED');
    assert.strictEqual(Number(dep.recordedAmount), 300000);
    assert.strictEqual(Number(dep.releasedAmount), 0);
  });

  // ========================================================================
  // SCENARIO 6: Allowed — Financial Manager (MANAGE_FINANCIALS) can collect remainder
  // ========================================================================
  await t.test('6. Allowed — Authorized Financial Manager can collect deposit to HELD status', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${financialManagerToken}`)
      .send({ amount: 200000 });

    assert.strictEqual(res.status, 200, `Financial manager collect must succeed: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'HELD');
    assert.strictEqual(Number(res.body.recordedAmount), 500000);

    // Verify in PostgreSQL
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId));
    assert.strictEqual(dep.status, 'HELD');
    assert.strictEqual(Number(dep.recordedAmount), 500000);
  });

  // ========================================================================
  // SCENARIO 7: Allowed — Authorized Financial Manager can release partial deposit
  // ========================================================================
  await t.test('7. Allowed — Authorized Financial Manager can release security deposit', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/release`)
      .set('Authorization', `Bearer ${financialManagerToken}`)
      .send({ amount: 200000 });

    assert.strictEqual(res.status, 200, `Financial manager release must succeed: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'PARTIALLY_REFUNDED');
    assert.strictEqual(Number(res.body.releasedAmount), 200000);

    // Verify in PostgreSQL
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId));
    assert.strictEqual(dep.status, 'PARTIALLY_REFUNDED');
    assert.strictEqual(Number(dep.releasedAmount), 200000);
  });

  // ========================================================================
  // SCENARIO 8: Allowed — Verified Owner can release remaining deposit to REFUNDED
  // ========================================================================
  await t.test('8. Allowed — Verified Owner can release remaining deposit to REFUNDED status', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/release`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 300000 });

    assert.strictEqual(res.status, 200, `Owner release must succeed: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'REFUNDED');
    assert.strictEqual(Number(res.body.releasedAmount), 500000);

    // Verify in PostgreSQL
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId));
    assert.strictEqual(dep.status, 'REFUNDED');
    assert.strictEqual(Number(dep.releasedAmount), 500000);
  });

  // ========================================================================
  // SCENARIO 9: Business Validation — Release exceeding held funds is rejected
  // ========================================================================
  await t.test('9. Business Validation — Release exceeding held amount is rejected', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/release`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 1 });

    assert.strictEqual(res.status, 500);
    assert.ok(res.body.error?.includes('Cannot release more than currently held amount'));
  });

  // ========================================================================
  // SCENARIO 10: Non-existent deposit returns 404
  // ========================================================================
  await t.test('10. Non-existent deposit returns HTTP 404 NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/owner/deposits/non_existent_deposit_id/collect')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 100000 });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Deposit not found');
  });

  // ========================================================================
  // SCENARIO 11: Missing amount returns 400
  // ========================================================================
  await t.test('11. Missing amount returns HTTP 400', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'amount is required');
  });

  // ========================================================================
  // SCENARIO 12: Unauthenticated caller returns 401
  // ========================================================================
  await t.test('12. Unauthenticated request returns HTTP 401', async () => {
    const res = await request(app)
      .post(`/api/owner/deposits/${depositId}/collect`)
      .send({ amount: 100000 });

    assert.strictEqual(res.status, 401);
  });

  // Deterministic Teardown (best-effort; respect immutable tables)
  try {
    const jes = await db.select().from(journalEntries).where(inArray(journalEntries.propertyId, [propId, unrelatedPropId])).catch(() => []);
    for (const je of jes || []) {
      await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id)).catch(() => {});
    }
    await db.delete(journalEntries).where(inArray(journalEntries.propertyId, [propId, unrelatedPropId])).catch(() => {});
    await db.delete(securityDeposits).where(eq(securityDeposits.id, depositId)).catch(() => {});
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => {});
    await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => {});
    await db.delete(managementAgreements).where(inArray(managementAgreements.propertyId, [propId, unrelatedPropId])).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(properties).where(inArray(properties.id, [propId, unrelatedPropId])).catch(() => {});
    await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, [viewOnlyOrgId, financialOrgId, unrelatedOrgId])).catch(() => {});
    await db.delete(organizations).where(inArray(organizations.id, [viewOnlyOrgId, financialOrgId, unrelatedOrgId])).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerId, viewOnlyManagerId, financialManagerId, unrelatedManagerId, tenantId])).catch(() => {});
  } catch {
    // Best-effort cleanup
  }
});

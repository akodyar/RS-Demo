import './safe-test-env.js';
import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  agentProfiles,
  vendorProfiles,
  crmContacts,
  properties,
  units,
  ownershipRecords,
  listings,
  leases,
  leaseTenants,
  leaseRenewals,
  rentSchedules,
  paymentRecords,
  commissions,
  journalEntries,
  ledgerLines,
  securityDeposits,
  maintenanceRequests,
  workOrders,
  idempotencyRecords,
  financialPolicies,
} from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { verifyAuthToken } from '../src/server/utils/auth.js';
import { commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';

const TARGET_TEST_DATABASE = 'homehub_test';

function assertSafeDatabase(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`SAFETY GATE: Must target '${TARGET_TEST_DATABASE}'. Got: '${targetDb || 'UNSET'}'`);
  }
}

test('Comprehensive Account Lifecycle, Property Creation, Authorization & Cross-Domain Audit', async (t) => {
  assertSafeDatabase();

  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Database must be ${TARGET_TEST_DATABASE}`);

  // Create isolated server instance
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = `audit_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  
  // Track all created entity IDs for safe cleanup
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdDepositIds: string[] = [];
  const createdWorkOrderIds: string[] = [];

  async function safeCleanup() {
    try {
      if (createdWorkOrderIds.length > 0) {
        await db.delete(workOrders).where(inArray(workOrders.id, createdWorkOrderIds)).catch(() => {});
      }
      if (createdDepositIds.length > 0) {
        await db.delete(securityDeposits).where(inArray(securityDeposits.id, createdDepositIds)).catch(() => {});
      }
      for (const renId of createdRenewalIds) {
        await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId)).catch(() => {});
      }
      for (const payId of createdPaymentIds) {
        await db.delete(paymentRecords).where(eq(paymentRecords.id, payId)).catch(() => {});
      }
      for (const leaseId of createdLeaseIds) {
        await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId)).catch(() => {});
        await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => {});
        await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => {});
      }
      if (createdListingIds.length > 0) {
        await db.delete(listings).where(inArray(listings.id, createdListingIds)).catch(() => {});
      }
      if (createdUnitIds.length > 0) {
        await db.delete(units).where(inArray(units.id, createdUnitIds)).catch(() => {});
      }
      for (const propId of createdPropertyIds) {
        await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
        await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
      }
      if (createdUserIds.length > 0) {
        await db.delete(agentProfiles).where(inArray(agentProfiles.userId, createdUserIds)).catch(() => {});
        await db.delete(vendorProfiles).where(inArray(vendorProfiles.userId, createdUserIds)).catch(() => {});
        await db.delete(organizationMembers).where(inArray(organizationMembers.userId, createdUserIds)).catch(() => {});
        await db.delete(crmContacts).where(inArray(crmContacts.ownerUserId, createdUserIds)).catch(() => {});
        await db.delete(users).where(inArray(users.id, createdUserIds)).catch(() => {});
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organizations).where(inArray(organizations.id, createdOrgIds)).catch(() => {});
      }
    } catch (err) {
      console.warn('Cleanup warning:', err);
    }
  }

  try {
    // =========================================================================
    // 1. ROLE & REGISTRATION CAPABILITY MATRIX (VALID & INVALID PATHS)
    // =========================================================================
    console.log('\n================================================================');
    console.log('--- 1. ROLE & REGISTRATION CAPABILITY MATRIX AUDIT ---');
    console.log('================================================================');

    // Scenario 1A: Owner Individual Registration (Valid)
    const ownerAEmail = `own_ind_a_${runId}@homehub.iq`;
    const regOwnerARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerAEmail,
        password: 'Password123!',
        fullName: 'Dara Qadir Owner',
        phone: '7501001001',
        role: 'PROPERTY_OWNER',
        entityType: 'INDIVIDUAL',
      }),
    });
    assert.strictEqual(regOwnerARes.status, 201, 'Owner Individual registration must return 201');
    const ownerAData = await regOwnerARes.json();
    assert.ok(ownerAData.token, 'Owner Individual receives valid JWT');
    const ownerAId = ownerAData.user.id;
    createdUserIds.push(ownerAId);

    const ownerATokenMeta = verifyAuthToken(ownerAData.token);
    assert.strictEqual(ownerATokenMeta.activeRole, 'PROPERTY_OWNER');
    assert.strictEqual(ownerATokenMeta.workspaceId, 'owner_personal');

    // Scenario 1B: Owner Individual B (Separate Identity)
    const ownerBEmail = `own_ind_b_${runId}@homehub.iq`;
    const regOwnerBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerBEmail,
        password: 'Password123!',
        fullName: 'Bnar Sleman Owner',
        phone: '7501001002',
        role: 'PROPERTY_OWNER',
        entityType: 'INDIVIDUAL',
      }),
    });
    assert.strictEqual(regOwnerBRes.status, 201);
    const ownerBData = await regOwnerBRes.json();
    const ownerBId = ownerBData.user.id;
    createdUserIds.push(ownerBId);

    // Scenario 1C: Owner Company A Registration
    const ownerCompanyAEmail = `own_comp_a_${runId}@homehub.iq`;
    const regOwnerCompARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerCompanyAEmail,
        password: 'Password123!',
        fullName: 'Aras Corporate Manager',
        phone: '7501001003',
        role: 'PROPERTY_OWNER',
        entityType: 'COMPANY',
        companyName: `Hawler Prime Holding ${runId}`,
      }),
    });
    assert.strictEqual(regOwnerCompARes.status, 201, 'Owner Company registration returns 201');
    const ownerCompAData = await regOwnerCompARes.json();
    const ownerCompAUserId = ownerCompAData.user.id;
    createdUserIds.push(ownerCompAUserId);

    const ownerCompATokenMeta = verifyAuthToken(ownerCompAData.token);
    assert.ok(ownerCompATokenMeta.organizationId, 'Owner Company token carries organizationId');
    assert.strictEqual(ownerCompATokenMeta.workspaceId, `company_${ownerCompATokenMeta.organizationId}`);
    createdOrgIds.push(ownerCompATokenMeta.organizationId!);

    // Verify organization in PostgreSQL
    const [dbOrgA] = await db.select().from(organizations).where(eq(organizations.id, ownerCompATokenMeta.organizationId!));
    assert.strictEqual(dbOrgA.type, 'OWNER_COMPANY', 'PostgreSQL organization type must be OWNER_COMPANY');
    assert.strictEqual(dbOrgA.status, 'PENDING_VERIFICATION');

    // Scenario 1D: Owner Company B Registration (Second Isolated Company)
    const ownerCompanyBEmail = `own_comp_b_${runId}@homehub.iq`;
    const regOwnerCompBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerCompanyBEmail,
        password: 'Password123!',
        fullName: 'Goran Corporate Admin',
        phone: '7501001004',
        role: 'PROPERTY_OWNER',
        entityType: 'COMPANY',
        companyName: `Sulaymaniyah Estate Group ${runId}`,
      }),
    });
    assert.strictEqual(regOwnerCompBRes.status, 201);
    const ownerCompBData = await regOwnerCompBRes.json();
    createdUserIds.push(ownerCompBData.user.id);
    const ownerCompBTokenMeta = verifyAuthToken(ownerCompBData.token);
    createdOrgIds.push(ownerCompBTokenMeta.organizationId!);

    // Scenario 1E: Agent Individual A Registration
    const agentAEmail = `agent_a_${runId}@homehub.iq`;
    const regAgentARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: agentAEmail,
        password: 'Password123!',
        fullName: 'Zana Agent Solo',
        phone: '7502002001',
        role: 'AGENT',
        entityType: 'INDIVIDUAL',
      }),
    });
    assert.strictEqual(regAgentARes.status, 201);
    const agentAData = await regAgentARes.json();
    const agentAId = agentAData.user.id;
    createdUserIds.push(agentAId);

    const [agentAProfile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentAId));
    assert.ok(agentAProfile, 'agentProfiles record must be created');
    assert.strictEqual(agentAProfile.status, 'PENDING_VERIFICATION');

    // Scenario 1F: Agent Company B Registration (Agency Office)
    const agentBEmail = `agent_agency_b_${runId}@homehub.iq`;
    const regAgentBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: agentBEmail,
        password: 'Password123!',
        fullName: 'Soran Agency Broker',
        phone: '7502002002',
        role: 'AGENT',
        entityType: 'COMPANY',
        companyName: `Falcon Commercial Agency ${runId}`,
      }),
    });
    assert.strictEqual(regAgentBRes.status, 201);
    const agentBData = await regAgentBRes.json();
    const agentBId = agentBData.user.id;
    createdUserIds.push(agentBId);
    const agentBTokenMeta = verifyAuthToken(agentBData.token);
    const agentBOrgId = agentBTokenMeta.organizationId!;
    createdOrgIds.push(agentBOrgId);

    const [agentBProfile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentBId));
    assert.strictEqual(agentBProfile.officeName, `Falcon Commercial Agency ${runId}`);

    // Scenario 1G: Tenant Individual A Registration (No Active Lease initially)
    const tenantAEmail = `tenant_a_${runId}@homehub.iq`;
    const regTenantARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tenantAEmail,
        password: 'Password123!',
        fullName: 'Kamaran Tenant Alpha',
        phone: '7503003001',
        role: 'TENANT',
      }),
    });
    assert.strictEqual(regTenantARes.status, 201);
    const tenantAData = await regTenantARes.json();
    const tenantAId = tenantAData.user.id;
    createdUserIds.push(tenantAId);
    const tenantATokenMeta = verifyAuthToken(tenantAData.token);
    assert.strictEqual(tenantATokenMeta.workspaceId, 'tenant');

    // Scenario 1H: Tenant Individual B Registration
    const tenantBEmail = `tenant_b_${runId}@homehub.iq`;
    const regTenantBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tenantBEmail,
        password: 'Password123!',
        fullName: 'Lana Tenant Beta',
        phone: '7503003002',
        role: 'TENANT',
      }),
    });
    assert.strictEqual(regTenantBRes.status, 201);
    const tenantBData = await regTenantBRes.json();
    const tenantBId = tenantBData.user.id;
    createdUserIds.push(tenantBId);

    // Scenario 1I: Vendor Individual Registration
    const vendorAEmail = `vendor_a_${runId}@homehub.iq`;
    const regVendorARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: vendorAEmail,
        password: 'Password123!',
        fullName: 'Bestun Plumber Vendor',
        phone: '7504004001',
        role: 'VENDOR',
      }),
    });
    assert.strictEqual(regVendorARes.status, 201);
    const vendorAData = await regVendorARes.json();
    const vendorAId = vendorAData.user.id;
    createdUserIds.push(vendorAId);

    const [vendorAProfile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, vendorAId));
    assert.ok(vendorAProfile);
    assert.strictEqual(vendorAProfile.status, 'ACTIVE');

    // Adversarial Registration Checks:
    // Missing entityType for Property Owner
    const badOwnerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `bad_owner_${runId}@homehub.iq`,
        password: 'Password123!',
        fullName: 'Bad Owner',
        phone: '7509999999',
        role: 'PROPERTY_OWNER',
      }),
    });
    assert.strictEqual(badOwnerRes.status, 400, 'Owner without entityType rejected with 400');

    // Duplicate email registration rejected
    const dupEmailRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerAEmail, // existing email
        password: 'Password123!',
        fullName: 'Duplicate Dara',
        phone: '7501001099',
        role: 'PROPERTY_OWNER',
        entityType: 'INDIVIDUAL',
      }),
    });
    assert.strictEqual(dupEmailRes.status, 409, 'Duplicate email rejected with 409');

    // Client privilege escalation attempt: claiming PLATFORM_ADMIN
    const escalateRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker_${runId}@homehub.iq`,
        password: 'Password123!',
        fullName: 'Hacker Joe',
        phone: '7500000000',
        role: 'PLATFORM_ADMIN',
      }),
    });
    assert.strictEqual(escalateRes.status, 201);
    const escalateData = await escalateRes.json();
    createdUserIds.push(escalateData.user.id);
    const escalateTokenMeta = verifyAuthToken(escalateData.token);
    assert.strictEqual(escalateTokenMeta.activeRole, 'TENANT', 'Client-supplied PLATFORM_ADMIN role must be sanitized to TENANT');

    // =========================================================================
    // 2. AUTHENTICATION, LOGOUT & MULTI-ROLE INTERCEPTION
    // =========================================================================
    console.log('\n================================================================');
    console.log('--- 2. AUTHENTICATION, LOGOUT & MULTI-ROLE INTERCEPTION ---');
    console.log('================================================================');

    // Valid Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerAEmail, password: 'Password123!' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.strictEqual(loginData.requiresWorkspaceSelection, false);

    // Invalid Login
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerAEmail, password: 'WrongPassword!' }),
    });
    assert.strictEqual(badLoginRes.status, 401, 'Invalid password returns 401');

    // Logout and token invalidation check
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.strictEqual(logoutRes.status, 200);

    // Old token must now fail closed because tokenVersion was incremented
    const afterLogoutMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.strictEqual(afterLogoutMe.status, 401, 'Logged out session token must be rejected with 401');

    // Re-login Owner A to get fresh token
    const freshLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerAEmail, password: 'Password123!' }),
    });
    const freshLoginData = await freshLoginRes.json();
    const ownerAToken = freshLoginData.token;

    // Enroll Owner A into TENANT role to create a multi-role account
    const enrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({ role: 'TENANT' }),
    });
    assert.strictEqual(enrollRes.status, 200, 'Multi-role enrollment succeeds');

    // Login multi-role account: MUST intercept with requiresWorkspaceSelection: true
    const multiLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerAEmail, password: 'Password123!' }),
    });
    const multiLoginData = await multiLoginRes.json();
    assert.strictEqual(multiLoginData.requiresWorkspaceSelection, true, 'Multi-role user intercepted for workspace choice');
    assert.ok(multiLoginData.eligibleWorkspaces.length >= 2, 'Lists both Owner and Tenant eligible workspaces');

    // Select Tenant workspace
    const selectWsRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${multiLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });
    assert.strictEqual(selectWsRes.status, 200);
    const selectWsData = await selectWsRes.json();
    const switchedMeta = verifyAuthToken(selectWsData.token);
    assert.strictEqual(switchedMeta.activeRole, 'TENANT');
    assert.strictEqual(switchedMeta.workspaceId, 'tenant');

    // =========================================================================
    // 3. PROPERTY CREATION & OWNERSHIP VS MANAGEMENT SEPARATION
    // =========================================================================
    console.log('\n================================================================');
    console.log('--- 3. PROPERTY CREATION & OWNERSHIP VS MANAGEMENT AUDIT ---');
    console.log('================================================================');

    // Re-authenticate Owner A as PROPERTY_OWNER
    const selectOwnerWsRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${multiLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });
    const selectOwnerWsData = await selectOwnerWsRes.json();
    const ownerPersonalToken = selectOwnerWsData.token;

    // 3A. Individual Owner creates property for self (Self-Managed)
    const createProp1Res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerPersonalToken}`,
      },
      body: JSON.stringify({
        name: `Dara Villa Complex ${runId}`,
        type: 'VILLA',
        city: 'Erbil',
        address: { street: '100m Road', district: 'Dream City', city: 'Erbil' },
        squareFeet: 450,
        yearBuilt: 2023,
        listingType: 'FOR_RENT',
        price: 2500000,
        currency: 'IQD',
        managementPreference: 'SELF_MANAGED',
        operatingModel: 'AGENT_OPERATED', // Self-managed operates under Platform Fee only
      }),
    });
    assert.strictEqual(createProp1Res.status, 201, 'Owner creates self property returns 201');
    const prop1 = await createProp1Res.json();
    createdPropertyIds.push(prop1.id);

    // Verify PostgreSQL ownership record
    const [ownership1] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop1.id));
    assert.strictEqual(ownership1.ownerId, ownerAId, 'Ownership ownerId must match Owner A');
    assert.strictEqual(ownership1.companyId, null, 'Self-owned property has no companyId');
    assert.strictEqual(Number(ownership1.ownershipPercentage), 100, 'Ownership percentage is 100%');
    assert.strictEqual(prop1.managementPreference, 'SELF_MANAGED');
    assert.strictEqual(prop1.managementArrangementStatus, 'NOT_APPLICABLE');

    // 3B. Company Owner creates property under company
    const createPropCompRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerCompAData.token}`,
      },
      body: JSON.stringify({
        name: `Hawler Prime Commercial Tower ${runId}`,
        type: 'COMMERCIAL',
        city: 'Erbil',
        address: { street: 'Gulan St', city: 'Erbil' },
        squareFeet: 1200,
        yearBuilt: 2024,
        listingType: 'FOR_RENT',
        price: 8000000,
        currency: 'IQD',
        managementPreference: 'HOMEHUB_MANAGED',
        operatingModel: 'FULLY_MANAGED',
        rentFee: 0.05,
        managementFee: 0.08,
      }),
    });
    assert.strictEqual(createPropCompRes.status, 201, 'Company Owner creates property returns 201');
    const propComp = await createPropCompRes.json();
    createdPropertyIds.push(propComp.id);

    // Verify company ownership in PostgreSQL
    const [ownershipComp] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propComp.id));
    assert.strictEqual(ownershipComp.companyId, ownerCompATokenMeta.organizationId, 'Ownership belongs to company org');
    assert.strictEqual(propComp.managementPreference, 'HOMEHUB_MANAGED');
    assert.strictEqual(propComp.managementArrangementStatus, 'AWAITING_ONBOARDING');
    assert.strictEqual(Number(propComp.rentFee), 0.05);
    assert.strictEqual(Number(propComp.managementFee), 0.08);

    // 3C. Unauthorized on-behalf-of: Owner A attempts to assign property to Owner B
    const unauthAssignRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerPersonalToken}`,
      },
      body: JSON.stringify({
        name: `Unauthorized Assign Property ${runId}`,
        type: 'APARTMENT',
        city: 'Erbil',
        ownerId: ownerBId, // attempting to create for another owner without authorization
      }),
    });
    assert.strictEqual(unauthAssignRes.status, 403, 'Unauthorized on-behalf-of rejected with 403 FORBIDDEN');

    // 3D. Agent on-behalf-of: Authorized CRM Client Relationship vs Non-Client
    // Step 1: Establish CRM contact relationship between Agent B (Falcon Agency) and Owner A
    await db.insert(crmContacts).values({
      ownerUserId: agentBId,
      organizationId: agentBOrgId,
      contactUserId: ownerAId,
      firstName: 'Dara',
      lastName: 'Qadir',
      relationship: 'OWNER',
    });

    // Make Agent B's organization verified so it can be assigned
    await db.update(organizations).set({ status: 'ACTIVE', verified: true }).where(eq(organizations.id, agentBOrgId));

    // Agent B registers property on behalf of Owner A (Authorized)
    const agentCreateClientPropRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentBData.token}`,
      },
      body: JSON.stringify({
        name: `Managed Sunset Apartment ${runId}`,
        type: 'APARTMENT',
        city: 'Erbil',
        address: { street: 'Empire World', city: 'Erbil' },
        ownerId: ownerAId,
        managementPreference: 'AGENT_MANAGED',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        managedByAgentId: agentBOrgId,
        managementFee: 0.07,
      }),
    });
    assert.strictEqual(agentCreateClientPropRes.status, 201, 'Agent creates property for verified CRM client succeeds');
    const agentProp = await agentCreateClientPropRes.json();
    createdPropertyIds.push(agentProp.id);

    // Invariant: Ownership belongs to Owner A, NOT to Agent B!
    const [agentPropOwnership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, agentProp.id));
    assert.strictEqual(agentPropOwnership.ownerId, ownerAId, 'Legal deed owner is Owner A');
    assert.strictEqual(agentPropOwnership.companyId, null);
    assert.strictEqual(agentProp.managedByAgentId, agentBOrgId, 'Operational manager is Agent Agency');
    assert.strictEqual(agentProp.managementArrangementStatus, 'AWAITING_AGREEMENT', 'Awaiting bilateral agreement, not active agreement');

    // Agent B attempts to register property on behalf of Owner B (No CRM Relationship)
    const agentCreateUnauthRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentBData.token}`,
      },
      body: JSON.stringify({
        name: `Unlinked Owner Prop ${runId}`,
        type: 'APARTMENT',
        city: 'Sulaymaniyah',
        ownerId: ownerBId, // no CRM relationship with Owner B
      }),
    });
    assert.strictEqual(agentCreateUnauthRes.status, 403, 'Agent cannot assign property to stranger owner without CRM relationship (403)');

    // 3E. Rental-Only Release Boundary: FOR_SALE is strictly rejected!
    const forSaleRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerPersonalToken}`,
      },
      body: JSON.stringify({
        name: `Illegal Sale House ${runId}`,
        type: 'HOUSE',
        city: 'Erbil',
        listingType: 'FOR_SALE',
      }),
    });
    assert.strictEqual(forSaleRes.status, 400, 'FOR_SALE listing strictly rejected with 400 VALIDATION_ERROR');
    const forSaleErr = await forSaleRes.json();
    assert.ok(forSaleErr.message.includes('rental-only release'), 'Explains rental-only release boundary');

    // 3F. Tenant or Vendor Attempting Property Creation (Prohibited)
    const tenantCreatePropRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAData.token}`,
      },
      body: JSON.stringify({
        name: `Tenant Fabricated Prop ${runId}`,
        type: 'APARTMENT',
        city: 'Erbil',
      }),
    });
    assert.strictEqual(tenantCreatePropRes.status, 403, 'Tenant prohibited from creating properties (403)');

    const vendorCreatePropRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorAData.token}`,
      },
      body: JSON.stringify({
        name: `Vendor Fabricated Prop ${runId}`,
        type: 'APARTMENT',
        city: 'Erbil',
      }),
    });
    assert.strictEqual(vendorCreatePropRes.status, 403, 'Vendor prohibited from creating properties (403)');

    // =========================================================================
    // 4. CROSS-DOMAIN LIFECYCLE: UNIT -> LEASE -> SCHEDULE -> PAYMENT -> REVERSAL -> RENEWAL
    // =========================================================================
    console.log('\n================================================================');
    console.log('--- 4. CROSS-DOMAIN LIFECYCLE AUDIT ---');
    console.log('================================================================');

    // Create unit under Property 1
    const [unit1] = await db.insert(units).values({
      propertyId: prop1.id,
      unitNumber: '101',
      type: 'RESIDENTIAL',
      rentAmount: '1500000',
      currency: 'IQD',
      status: 'AVAILABLE',
    }).returning();
    createdUnitIds.push(unit1.id);

    // Create lease linking Unit 1 to Tenant A
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-12-31');
    const [lease1] = await db.insert(leases).values({
      propertyId: prop1.id,
      unitId: unit1.id,
      startDate,
      endDate,
      rentAmount: '1500000',
      currency: 'IQD',
      status: 'ACTIVE',
      depositAmount: '1500000',
      depositStatus: 'HELD',
    }).returning();
    createdLeaseIds.push(lease1.id);

    await db.insert(leaseTenants).values({
      leaseId: lease1.id,
      tenantId: tenantAId,
      isPrimary: true,
    });

    // Create custodial security deposit (Account 2100)
    const [secDep] = await db.insert(securityDeposits).values({
      leaseId: lease1.id,
      propertyId: prop1.id,
      tenantId: tenantAId,
      requiredAmount: '1500000',
      recordedAmount: '1500000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    }).returning();
    createdDepositIds.push(secDep.id);

    // Generate rent schedule for 12 months
    const [sched1] = await db.insert(rentSchedules).values({
      leaseId: lease1.id,
      propertyId: prop1.id,
      unitId: unit1.id,
      tenantId: tenantAId,
      dueDate: '2026-01-01',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      amount: '1500000',
      currency: 'IQD',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    // Now Tenant A has an active lease! Verify Tenant Dashboard access
    const tenantDashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${tenantAData.token}` },
    });
    assert.strictEqual(tenantDashRes.status, 200, 'Tenant with active lease accesses dashboard');
    const tenantDashData = await tenantDashRes.json();
    assert.strictEqual(tenantDashData.currentProperty?.leaseId, lease1.id);
    assert.strictEqual(Number(tenantDashData.rentDue?.amount), 1500000);

    // Tenant B (who has NO active lease) receives 403 NO_ACTIVE_LEASE!
    const tenantBDashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${tenantBData.token}` },
    });
    assert.strictEqual(tenantBDashRes.status, 403, 'Tenant without active lease blocked (403)');
    const tenantBErr = await tenantBDashRes.json();
    assert.strictEqual(tenantBErr.error, 'NO_ACTIVE_LEASE');

    // Record rent payment by Tenant A for schedule 1
    const [payment1] = await db.insert(paymentRecords).values({
      propertyId: prop1.id,
      leaseId: lease1.id,
      rentScheduleId: sched1.id,
      payerId: tenantAId,
      amount: '1500000',
      currency: 'IQD',
      paymentMethod: 'FIB',
      status: 'CONFIRMED',
      referenceNumber: `TRX_${runId}_001`,
      recordedDate: '2026-01-02',
      confirmedByUserId: ownerAId,
    }).returning();
    createdPaymentIds.push(payment1.id);

    // Post fees & ledger entry for CONFIRMED payment
    const feeResult = await commissionService.postCommissionForPayment(payment1.id, ownerAId, 'PROPERTY_OWNER');
    assert.ok(feeResult.commission, 'Fee commission record created');
    const jeId = feeResult.commission.journalEntryId;
    assert.ok(jeId, 'Double-entry journal entry created');

    // Verify ledger balance (Debits === Credits)
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, jeId));
    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of lines) {
      if (l.type === 'DEBIT') totalDebit += Number(l.amount);
      if (l.type === 'CREDIT') totalCredit += Number(l.amount);
    }
    assert.strictEqual(totalDebit, totalCredit, 'Double-entry ledger equation balanced: totalDebits === totalCredits');

    // Update schedule to PAID
    await db.update(rentSchedules).set({
      status: 'PAID',
      paidAmount: '1500000',
    }).where(eq(rentSchedules.id, sched1.id));

    // REVERSAL TEST: Reverse payment 1
    const reverseRes = await commissionService.reverseCommissionForPayment(payment1.id, 'Audit test reversal', {
      id: ownerAId,
      roles: ['PROPERTY_OWNER'],
    });
    assert.ok(reverseRes.reversalJournalEntryId, 'Compensating reversal journal entry created');

    // Verify compensating reversal ledger entries
    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, reverseRes.reversalJournalEntryId));
    let revDebit = 0;
    let revCredit = 0;
    for (const rl of revLines) {
      if (rl.type === 'DEBIT') revDebit += Number(rl.amount);
      if (rl.type === 'CREDIT') revCredit += Number(rl.amount);
    }
    assert.strictEqual(revDebit, revCredit, 'Reversal journal entry is balanced');

    // Update payment record to REVERSED and schedule back to UPCOMING
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment1.id));
    await db.update(rentSchedules).set({ status: 'UPCOMING', paidAmount: '0' }).where(eq(rentSchedules.id, sched1.id));

    // MID-LEASE RENEWAL AFTER REVERSAL TEST:
    // Request a mid-lease renewal extending through 2027-06-30
    const renewalId = `ren_${runId}_001`;
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId,
      leaseId: lease1.id,
      propertyId: prop1.id,
      tenantId: tenantAId,
      proposedStartDate: '2026-06-01T00:00:00.000Z',
      proposedEndDate: '2027-06-30T00:00:00.000Z',
      proposedRentAmount: '1600000',
      status: 'REQUESTED',
    }).returning();
    createdRenewalIds.push(renewal.id);

    // Approve the mid-lease renewal!
    // Must succeed without foreign key constraint violation (23503) or duplicate schedule period!
    const renewResult = await leaseRepository.approveRenewal(renewal.id);
    assert.ok(renewResult, 'Lease renewal approved successfully');

    // Verify schedule 1 still exists and payment foreign key is intact!
    const [postRenewalSched1] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sched1.id));
    assert.ok(postRenewalSched1, 'Payment-referenced schedule 1 preserved without deletion');
    assert.strictEqual(Number(postRenewalSched1.paidAmount), 0, 'Zero-paid status maintained');

    // =========================================================================
    // 5. CROSS-ACCOUNT & CROSS-ORGANIZATION AUTHORIZATION (IDOR DEFENSE)
    // =========================================================================
    console.log('\n================================================================');
    console.log('--- 5. AUTHORIZATION & ADVERSARIAL IDOR DEFENSE ---');
    console.log('================================================================');

    // 5A. Owner B attempts to view or edit Owner A's property
    const ownerBCrossPropRes = await fetch(`${baseUrl}/properties/${prop1.id}`, {
      headers: { Authorization: `Bearer ${ownerBData.token}` },
    });
    assert.ok([403, 404].includes(ownerBCrossPropRes.status), 'Owner B cannot access Owner A property (403/404)');

    // 5B. Tenant B attempts to access Tenant A's lease details
    const tenantBCrossLeaseRes = await fetch(`${baseUrl}/leases/${lease1.id}`, {
      headers: { Authorization: `Bearer ${tenantBData.token}` },
    });
    assert.ok([403, 404].includes(tenantBCrossLeaseRes.status), 'Tenant B cannot access Tenant A lease (403/404)');

    // 5C. Company B attempts to access Company A private CRM contacts
    const compBCrossCrmRes = await fetch(`${baseUrl}/company/crm/contacts`, {
      headers: { Authorization: `Bearer ${ownerCompBData.token}` },
    });
    if (compBCrossCrmRes.status === 200) {
      const compBContacts = await compBCrossCrmRes.json();
      const hasClientA = (compBContacts.contacts || []).some((c: any) => c.contactUserId === ownerAId);
      assert.strictEqual(hasClientA, false, 'Company B cannot see Company A client contacts');
    }

    // 5D. Vendor attempting to access financial payouts or unassigned properties
    const vendorToFinance = await fetch(`${baseUrl}/financials/settlements`, {
      headers: { Authorization: `Bearer ${vendorAData.token}` },
    });
    assert.strictEqual(vendorToFinance.status, 403, 'Vendor denied from financial settlements (403)');

    // 5E. Agent A attempts to view property assigned to Agent B
    const agentACrossAgentRes = await fetch(`${baseUrl}/agent/properties/${agentProp.id}`, {
      headers: { Authorization: `Bearer ${agentAData.token}` },
    });
    assert.ok([403, 404].includes(agentACrossAgentRes.status), 'Agent A cannot access Agent B assigned property (403/404)');

    console.log('\n================================================================');
    console.log('🎉 ALL COMPREHENSIVE ACCOUNT & CROSS-DOMAIN AUDIT CHECKS PASSED!');
    console.log('================================================================\n');

  } finally {
    server.close();
    await safeCleanup();
  }
});

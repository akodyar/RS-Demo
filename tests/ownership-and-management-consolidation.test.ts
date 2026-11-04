import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { db, pool } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  crmContacts
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole } from '../src/types/index.js';

test('Ownership & Management Wizard Consolidation - Comprehensive Invariants Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `omc_test_${TIMESTAMP}`;

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

  // 2. Seed Test Users, Organizations & Memberships
  const ownerUserId = `${PREFIX}_owner`;
  const clientUserId = `${PREFIX}_client`;
  const unauthorizedUserId = `${PREFIX}_unauth`;
  const agentUserId = `${PREFIX}_agent`;
  const adminUserId = `${PREFIX}_admin`;

  const eligibleAgencyOrgId = `${PREFIX}_agency_verified`;
  const ineligibleOrgId = `${PREFIX}_agency_ineligible`;
  const ownerCompanyOrgId = `${PREFIX}_owner_company`;

  // Seed users
  await db.insert(users).values([
    {
      id: ownerUserId,
      email: `${ownerUserId}@homehub.test`,
      firstName: 'Owner',
      lastName: 'User',
      roles: [UserRole.PROPERTY_OWNER],
    },
    {
      id: clientUserId,
      email: `${clientUserId}@homehub.test`,
      firstName: 'Client',
      lastName: 'Owner',
      roles: [UserRole.PROPERTY_OWNER],
    },
    {
      id: unauthorizedUserId,
      email: `${unauthorizedUserId}@homehub.test`,
      firstName: 'Random',
      lastName: 'User',
      roles: [UserRole.PROPERTY_OWNER],
    },
    {
      id: agentUserId,
      email: `${agentUserId}@homehub.test`,
      firstName: 'Agent',
      lastName: 'Broker',
      roles: [UserRole.AGENT_BROKER],
    },
    {
      id: adminUserId,
      email: `${adminUserId}@homehub.test`,
      firstName: 'Platform',
      lastName: 'Admin',
      roles: [UserRole.PLATFORM_ADMIN],
    },
  ]);

  // Seed organizations
  await db.insert(organizations).values([
    {
      id: eligibleAgencyOrgId,
      name: 'Erbil Premier Real Estate',
      type: 'AGENCY',
      status: 'VERIFIED',
      verified: true,
      ownerId: agentUserId,
    },
    {
      id: ineligibleOrgId,
      name: 'Unverified Suspended Agency',
      type: 'AGENCY',
      status: 'SUSPENDED',
      verified: false,
      ownerId: agentUserId,
    },
    {
      id: ownerCompanyOrgId,
      name: 'Hawler Commercial Holdings',
      type: 'MANAGEMENT_COMPANY',
      status: 'VERIFIED',
      verified: true,
      ownerId: ownerUserId,
    },
  ]);

  // Seed organization memberships
  await db.insert(organizationMembers).values([
    {
      organizationId: eligibleAgencyOrgId,
      userId: agentUserId,
      role: 'ADMIN',
    },
    {
      organizationId: ownerCompanyOrgId,
      userId: ownerUserId,
      role: 'OWNER',
    },
  ]);

  // Seed CRM Contact relationship between agent and client
  await db.insert(crmContacts).values({
    ownerUserId: agentUserId,
    organizationId: eligibleAgencyOrgId,
    contactUserId: clientUserId,
    firstName: 'Client',
    lastName: 'Owner',
    relationship: 'CLIENT',
  });

  // Auth tokens
  const ownerToken = signAuthToken({
    id: ownerUserId,
    email: `${ownerUserId}@homehub.test`,
    roles: [UserRole.PROPERTY_OWNER],
    organizationId: ownerCompanyOrgId,
  });

  const agentToken = signAuthToken({
    id: agentUserId,
    email: `${agentUserId}@homehub.test`,
    roles: [UserRole.AGENT_BROKER],
    organizationId: eligibleAgencyOrgId,
  });

  const unauthToken = signAuthToken({
    id: unauthorizedUserId,
    email: `${unauthorizedUserId}@homehub.test`,
    roles: [UserRole.PROPERTY_OWNER],
  });

  // TEST 1: Dropdown excludes ineligible entities and returns registered entities
  await t.test('1. /api/properties/eligible-agents returns only verified eligible agencies', async () => {
    const res = await fetch(`${baseUrl}/properties/eligible-agents`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.agents));
    
    const ids = data.agents.map((a: any) => a.id);
    assert.ok(ids.includes(eligibleAgencyOrgId), 'Eligible verified agency must be present');
    assert.ok(!ids.includes(ineligibleOrgId), 'Ineligible suspended agency must be excluded');
  });

  // TEST 2: Owner registers a property under their own account (Self-Managed)
  let selfPropId = '';
  await t.test('2. Owner registers property under own account with Self-Managed (Platform Fee ONLY)', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Salar Luxury Apartment',
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1200000,
        currency: 'IQD',
        yearBuilt: 2023,
        squareFeet: 185,
        managementPreference: 'SELF_MANAGED',
        operatingModel: 'AGENT_OPERATED',
        rentFee: 0.10, // Attempt to pass fee: must be cleared by server
        managementFee: 0.05, // Attempt to pass fee: must be cleared by server
      }),
    });

    assert.strictEqual(res.status, 201);
    const prop = await res.json();
    selfPropId = prop.id;

    assert.strictEqual(prop.managementPreference, 'SELF_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'NOT_APPLICABLE');
    assert.strictEqual(prop.managedByAgentId, null);
    assert.strictEqual(prop.rentFee, null, 'Rent fee must be null for Self-Managed');
    assert.strictEqual(prop.managementFee, null, 'Management fee must be null for Self-Managed');
    assert.strictEqual(prop.yearBuilt, 2023, 'Year built must be preserved');
    assert.strictEqual(prop.squareFeet, 185, 'Total area must be preserved');

    // Check ownership record
    const [ownership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    assert.ok(ownership, 'Ownership record must exist');
    assert.strictEqual(ownership.ownerId, ownerUserId, 'Owner must be the authenticated user');
    assert.strictEqual(ownership.ownershipPercentage, '100.00');
  });

  // TEST 3: Authorized Agent registers on behalf of a client with established CRM relationship
  let clientPropId = '';
  await t.test('3. Authorized Agent registers property on behalf of client (CRM verified)', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        name: 'Client Villa in Dream City',
        type: 'VILLA',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 2500000,
        currency: 'IQD',
        yearBuilt: 2022,
        squareFeet: 350,
        ownerId: clientUserId,
        managementPreference: 'AGENT_MANAGED',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        managedByAgentId: eligibleAgencyOrgId,
        managementFee: 0.08,
      }),
    });

    assert.strictEqual(res.status, 201);
    const prop = await res.json();
    clientPropId = prop.id;

    assert.strictEqual(prop.managementPreference, 'AGENT_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_AGREEMENT');
    assert.strictEqual(prop.operatingModel, 'AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(prop.managedByAgentId, eligibleAgencyOrgId);
    assert.strictEqual(prop.rentFee, null, 'Rent fee must be null for AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(Number(prop.managementFee), 0.08, 'Management fee must match 0.08');

    // Check ownership record: Client is the owner, NOT the agent!
    const [ownership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    assert.ok(ownership);
    assert.strictEqual(ownership.ownerId, clientUserId, 'Legal owner must be client');
    assert.notStrictEqual(ownership.ownerId, agentUserId, 'Agent must NOT be recorded as legal owner');
  });

  // TEST 4: HomeHub-Managed (FULLY_MANAGED) applies all 3 fees
  await t.test('4. HomeHub-Managed (FULLY_MANAGED) correctly applies Rent Fee and Management Fee', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'HomeHub Operated Tower Unit',
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1500000,
        currency: 'IQD',
        managementPreference: 'HOMEHUB_MANAGED',
        operatingModel: 'FULLY_MANAGED',
        rentFee: 0.10,
        managementFee: 0.07,
      }),
    });

    assert.strictEqual(res.status, 201);
    const prop = await res.json();

    assert.strictEqual(prop.managementPreference, 'HOMEHUB_MANAGED');
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_ONBOARDING');
    assert.strictEqual(prop.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(prop.managedByAgentId, null, 'Managed by agent must be null for platform managed');
    assert.strictEqual(Number(prop.rentFee), 0.10);
    assert.strictEqual(Number(prop.managementFee), 0.07);
  });

  // TEST 5: Unauthorized user CANNOT assign arbitrary owner
  await t.test('5. Unauthorized regular user cannot assign property to arbitrary owner ID', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unauthToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Property Attempt',
        type: 'APARTMENT',
        city: 'Erbil',
        ownerId: clientUserId,
      }),
    });

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden');
    const err = await res.json();
    assert.strictEqual(err.error, 'FORBIDDEN');
  });

  // TEST 6: Unauthorized user CANNOT assign arbitrary company
  await t.test('6. Unauthorized user cannot assign property to company they do not belong to', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unauthToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Company Property Attempt',
        type: 'APARTMENT',
        city: 'Erbil',
        companyId: ownerCompanyOrgId,
      }),
    });

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden');
  });

  // TEST 7: Agent cannot assign property to owner without established CRM relationship
  await t.test('7. Agent cannot assign property to owner without established CRM relationship', async () => {
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        name: 'Unconnected Client Property',
        type: 'APARTMENT',
        city: 'Erbil',
        ownerId: unauthorizedUserId, // Not in crmContacts for this agent!
      }),
    });

    assert.strictEqual(res.status, 403);
    const err = await res.json();
    assert.strictEqual(err.error, 'FORBIDDEN');
    assert.ok(err.message.includes('relationship'));
  });

  // TEST 8: Selecting manager does NOT create signed management agreement automatically
  await t.test('8. Selecting manager does not automatically grant authorization or sign agreement', async () => {
    const [agreement] = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, clientPropId));
    assert.strictEqual(agreement, undefined, 'No management agreement should be created merely by selecting manager');
  });
});

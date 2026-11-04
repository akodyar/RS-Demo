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
  properties,
  maintenanceRequests,
  maintenanceQuotes,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

assertSafeDatabaseConfig();

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

async function runConcurrencyAndVendorAuthSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — CONCURRENCY, IDEMPOTENCY & VENDOR AUTH TEST SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const cleanups: Array<() => Promise<void>> = [];
  const testPassword = 'Password123!Safe';
  const passwordHash = await hashPassword(testPassword);
  const runId = Date.now();

  try {
    // =========================================================================
    // SECTION 1: CONCURRENT ROLE ENROLLMENTS ON SAME USER
    // =========================================================================
    console.log('--- SECTION 1: CONCURRENT ROLE ENROLLMENT RACE CONDITIONS ---');

    const concurrentUserEmail = `concurrent_user_${runId}@homehub.iq`;
    const [cUser] = await db.insert(users).values({
      email: concurrentUserEmail,
      firstName: 'Concurrent',
      lastName: 'Tester',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, cUser.id));
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, cUser.id));
      const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, cUser.id));
      for (const m of orgMems) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(users).where(eq(users.id, cUser.id));
    });

    // Obtain token via official login endpoint
    const cLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: concurrentUserEmail, password: testPassword }),
    });
    const cLoginData = await cLoginRes.json();
    const cUserToken = cLoginData.token;

    // Fire 4 concurrent enrollment requests:
    // 1. PROPERTY_OWNER (Individual)
    // 2. VENDOR
    // 3. AGENT_BROKER (Individual)
    // 4. PROPERTY_OWNER (duplicate concurrent attempt)
    console.log('Dispatching 4 overlapping concurrent enrollment requests...');
    const enrollmentPromises = [
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cUserToken}` },
        body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'INDIVIDUAL' }),
      }),
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cUserToken}` },
        body: JSON.stringify({ role: 'VENDOR' }),
      }),
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cUserToken}` },
        body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'INDIVIDUAL' }),
      }),
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cUserToken}` },
        body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'INDIVIDUAL' }),
      }),
    ];

    const results = await Promise.all(enrollmentPromises);
    const statuses = results.map((r) => r.status);
    console.log(`Concurrent enrollment response statuses: ${statuses.join(', ')}`);

    check('CONC-01', 'All concurrent enrollments return HTTP 200', statuses.every((s) => s === 200), { statuses });

    // Directly inspect PostgreSQL database record for cUser
    const [persistedUser] = await db.select().from(users).where(eq(users.id, cUser.id)).limit(1);
    const finalRoles = (persistedUser.roles as string[]) || [];
    console.log(`Final persisted roles in PostgreSQL: [${finalRoles.join(', ')}]`);

    check('CONC-02', 'Persisted roles retain original TENANT role', finalRoles.includes('TENANT'));
    check('CONC-03', 'Persisted roles include PROPERTY_OWNER', finalRoles.includes('PROPERTY_OWNER'));
    check('CONC-04', 'Persisted roles include VENDOR', finalRoles.includes('VENDOR'));
    check('CONC-05', 'Persisted roles include AGENT_BROKER', finalRoles.includes('AGENT_BROKER'));
    check('CONC-06', 'No lost roles: total distinct roles count is 4', new Set(finalRoles).size === 4);
    check('CONC-07', 'No duplicate role entries in roles array', finalRoles.length === 4);

    // Verify exactly 1 agent profile and 1 vendor profile created
    const agentProfs = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, cUser.id));
    const vendorProfs = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, cUser.id));
    check('CONC-08', 'Exactly 1 agent profile initialized', agentProfs.length === 1);
    check('CONC-09', 'Exactly 1 vendor profile initialized', vendorProfs.length === 1);

    // =========================================================================
    // SECTION 2: IDEMPOTENT COMPANY ENROLLMENT & DUPLICATE PREVENTION
    // =========================================================================
    console.log('\n--- SECTION 2: IDEMPOTENT COMPANY ENROLLMENT & DUPLICATE ORG PREVENTION ---');

    const companyUserEmail = `company_enroll_user_${runId}@homehub.iq`;
    const [compUser] = await db.insert(users).values({
      email: companyUserEmail,
      firstName: 'Company',
      lastName: 'OwnerTester',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, compUser.id));
      for (const m of orgMems) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, compUser.id));
      await db.delete(users).where(eq(users.id, compUser.id));
    });

    const compLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: companyUserEmail, password: testPassword }),
    });
    const compLoginData = await compLoginRes.json();
    const compUserToken = compLoginData.token;

    const agentCompanyName = 'Kurdistan Horizon Realty LLC';

    // First Company Enrollment
    const compEnrollRes1 = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
      body: JSON.stringify({
        role: 'AGENT_BROKER',
        entityType: 'COMPANY',
        companyName: agentCompanyName,
      }),
    });
    check('IDEMP-01', 'Initial Agent Company enrollment succeeds with HTTP 200', compEnrollRes1.status === 200);

    // Immediate Concurrent / Retry Company Enrollment with identical parameters
    const [compRetry1, compRetry2] = await Promise.all([
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
        body: JSON.stringify({
          role: 'AGENT_BROKER',
          entityType: 'COMPANY',
          companyName: agentCompanyName,
        }),
      }),
      fetch(`${baseUrl}/auth/roles/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
        body: JSON.stringify({
          role: 'AGENT_BROKER',
          entityType: 'COMPANY',
          companyName: agentCompanyName,
        }),
      }),
    ]);

    check('IDEMP-02', 'Retry enrollment 1 returns HTTP 200', compRetry1.status === 200);
    check('IDEMP-03', 'Retry enrollment 2 returns HTTP 200', compRetry2.status === 200);

    // Query organizations and organizationMembers in PostgreSQL
    const userOrgMemberships = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgType: organizations.type,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, compUser.id),
          eq(organizations.type, 'AGENT_COMPANY')
        )
      );

    check('IDEMP-04', 'Exactly 1 organization created for agent company enrollment (zero duplicates)', userOrgMemberships.length === 1);
    check('IDEMP-05', 'Organization name matches requested company name', userOrgMemberships[0]?.orgName === agentCompanyName);
    check('IDEMP-06', 'User membership role is COMPANY_ADMIN', userOrgMemberships[0]?.role === 'COMPANY_ADMIN');

    // Owner Company Idempotency Test
    const ownerCompanyName = 'Erbil Heights Capital';
    const ownerCompRes1 = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
      body: JSON.stringify({
        role: 'PROPERTY_OWNER',
        entityType: 'COMPANY',
        companyName: ownerCompanyName,
      }),
    });
    const ownerCompRes2 = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
      body: JSON.stringify({
        role: 'PROPERTY_OWNER',
        entityType: 'COMPANY',
        companyName: ownerCompanyName,
      }),
    });

    check('IDEMP-07', 'Owner Company enrollment 1 returns HTTP 200', ownerCompRes1.status === 200);
    check('IDEMP-08', 'Owner Company retry returns HTTP 200', ownerCompRes2.status === 200);

    const ownerOrgMemberships = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgType: organizations.type,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, compUser.id),
          eq(organizations.type, 'OWNER_COMPANY')
        )
      );

    check('IDEMP-09', 'Exactly 1 organization created for owner company enrollment (zero duplicates)', ownerOrgMemberships.length === 1);
    check('IDEMP-10', 'Owner organization name matches requested company name', ownerOrgMemberships[0]?.orgName === ownerCompanyName);

    // =========================================================================
    // SECTION 3: VENDOR QUOTE REVISION AUTHORIZATION GAP CLOSURE
    // =========================================================================
    console.log('\n--- SECTION 3: VENDOR QUOTE REVISION AUTHORIZATION AUDIT ---');

    // 1. Create a dummy property and maintenance request
    const [testProp] = await db.insert(properties).values({
      name: 'Quote Test Property',
      type: 'RESIDENTIAL',
      status: 'AVAILABLE',
      currency: 'USD',
    }).returning();

    const [testRequest] = await db.insert(maintenanceRequests).values({
      propertyId: testProp.id,
      reporterUserId: compUser.id,
      category: 'PLUMBING',
      priority: 'MEDIUM',
      title: 'Pipe Leak',
      description: 'Minor pipe leak under sink',
      status: 'OPEN',
    }).returning();

    // 2. Create Vendor A (Approved)
    const vendorAEmail = `vendor_approved_${runId}@homehub.iq`;
    const [vendorAUser] = await db.insert(users).values({
      email: vendorAEmail,
      firstName: 'Approved',
      lastName: 'VendorA',
      passwordHash,
      roles: ['VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [vendorAProfile] = await db.insert(vendorProfiles).values({
      userId: vendorAUser.id,
      businessName: 'Vendor A Plumbing Solutions',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    }).returning();

    // 3. Create Vendor B (Pending Verification)
    const vendorBEmail = `vendor_pending_${runId}@homehub.iq`;
    const [vendorBUser] = await db.insert(users).values({
      email: vendorBEmail,
      firstName: 'Pending',
      lastName: 'VendorB',
      passwordHash,
      roles: ['VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [vendorBProfile] = await db.insert(vendorProfiles).values({
      userId: vendorBUser.id,
      businessName: 'Vendor B Electrical Services',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    }).returning();

    // 4. Create Vendor C (Approved - Competitor)
    const vendorCEmail = `vendor_competitor_${runId}@homehub.iq`;
    const [vendorCUser] = await db.insert(users).values({
      email: vendorCEmail,
      firstName: 'Competitor',
      lastName: 'VendorC',
      passwordHash,
      roles: ['VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [vendorCProfile] = await db.insert(vendorProfiles).values({
      userId: vendorCUser.id,
      businessName: 'Vendor C Contracting',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    }).returning();

    // 5. Create an initial quote submitted by Vendor A
    const [quoteA] = await db.insert(maintenanceQuotes).values({
      maintenanceRequestId: testRequest.id,
      propertyId: testProp.id,
      vendorUserId: vendorAUser.id,
      vendorId: vendorAProfile.id,
      totalAmount: '250.00',
      laborAmount: '150.00',
      materialsAmount: '100.00',
      feesAmount: '0.00',
      currency: 'USD',
      status: 'PENDING_APPROVAL',
      revisionNumber: 1,
    }).returning();

    cleanups.push(async () => {
      await db.delete(maintenanceQuotes).where(eq(maintenanceQuotes.id, quoteA.id));
      await db.delete(maintenanceRequests).where(eq(maintenanceRequests.id, testRequest.id));
      await db.delete(properties).where(eq(properties.id, testProp.id));
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, vendorAUser.id));
      await db.delete(users).where(eq(users.id, vendorAUser.id));
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, vendorBUser.id));
      await db.delete(users).where(eq(users.id, vendorBUser.id));
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, vendorCUser.id));
      await db.delete(users).where(eq(users.id, vendorCUser.id));
    });

    const tokenVendorA = signAuthToken({
      id: vendorAUser.id,
      email: vendorAUser.email,
      roles: ['VENDOR'],
      activeRole: 'VENDOR',
      tokenVersion: 1,
    });

    const tokenVendorB = signAuthToken({
      id: vendorBUser.id,
      email: vendorBUser.email,
      roles: ['VENDOR'],
      activeRole: 'VENDOR',
      tokenVersion: 1,
    });

    const tokenVendorC = signAuthToken({
      id: vendorCUser.id,
      email: vendorCUser.email,
      roles: ['VENDOR'],
      activeRole: 'VENDOR',
      tokenVersion: 1,
    });

    // Test 1: Unauthenticated request is rejected
    const unauthReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalAmount: 300 }),
    });
    check('VAUTH-01', 'Unauthenticated quote revision is rejected with HTTP 401', unauthReviseRes.status === 401);

    // Test 2: Non-vendor role (Tenant) is rejected
    const tenantReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compUserToken}` },
      body: JSON.stringify({ totalAmount: 300 }),
    });
    check('VAUTH-02', 'Non-vendor role is rejected with HTTP 403', tenantReviseRes.status === 403);

    // Test 3: Pending Vendor B cannot revise quote
    const pendingVendorReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVendorB}` },
      body: JSON.stringify({ totalAmount: 300 }),
    });
    const pendingVendorData = await pendingVendorReviseRes.json();
    check('VAUTH-03', 'Pending vendor revision rejected with HTTP 403', pendingVendorReviseRes.status === 403);
    check('VAUTH-04', 'Pending vendor receives VENDOR_VERIFICATION_REQUIRED', pendingVendorData.error === 'VENDOR_VERIFICATION_REQUIRED');
    check('VAUTH-05', 'Code is PROFILE_PENDING_VERIFICATION', pendingVendorData.code === 'PROFILE_PENDING_VERIFICATION');

    // Test 4: Competitor Vendor C cannot revise Vendor A's quote (Cross-vendor tampering prevention)
    const competitorReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVendorC}` },
      body: JSON.stringify({ totalAmount: 180 }),
    });
    check('VAUTH-06', 'Approved competitor cannot revise another vendor quote (HTTP 400 NOT_FOUND_OR_FORBIDDEN)', competitorReviseRes.status === 400);

    // Test 5: Legitimate Approved Vendor A CAN revise their own quote
    const legitimateReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVendorA}` },
      body: JSON.stringify({
        totalAmount: 280,
        laborAmount: 160,
        materialsAmount: 120,
        notes: 'Updated materials price based on current market rate',
      }),
    });
    const legitimateReviseData = await legitimateReviseRes.json();
    check('VAUTH-07', 'Approved Vendor A revising own quote succeeds with HTTP 200', legitimateReviseRes.status === 200);
    check('VAUTH-08', 'Revised quote totalAmount updated to 280', legitimateReviseData.totalAmount === 280);
    check('VAUTH-09', 'Revision number incremented to 2', legitimateReviseData.revisionNumber === 2);

    // Test 6: Cannot revise quote if already approved
    await db.update(maintenanceQuotes).set({ status: 'APPROVED' }).where(eq(maintenanceQuotes.id, quoteA.id));
    const approvedReviseRes = await fetch(`${baseUrl}/vendor/quotes/${quoteA.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVendorA}` },
      body: JSON.stringify({ totalAmount: 350 }),
    });
    const approvedReviseData = await approvedReviseRes.json();
    check('VAUTH-10', 'Revising already approved quote is rejected with HTTP 400', approvedReviseRes.status === 400);
    check('VAUTH-11', 'Error code specifies CANNOT_REVISE_APPROVED_QUOTE', approvedReviseData.error === 'CANNOT_REVISE_APPROVED_QUOTE');

  } finally {
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (e) {
        console.warn('Teardown warning:', e);
      }
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  CONCURRENCY & VENDOR AUTH TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runConcurrencyAndVendorAuthSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

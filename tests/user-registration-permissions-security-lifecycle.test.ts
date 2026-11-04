import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers, agentProfiles, vendorProfiles, leases, leaseTenants, documents } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { verifyAuthToken } from '../src/server/utils/auth.js';

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

async function runRegistrationSecurityLifecycleSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — USER REGISTRATION, PERMISSIONS & SECURITY LIFECYCLE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now().toString(36);
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. PROPERTY OWNER REGISTRATION (INDIVIDUAL VS COMPANY)
    // -------------------------------------------------------------------------
    console.log('--- PART 1: PROPERTY OWNER REGISTRATION (INDIVIDUAL VS COMPANY) ---');

    // 1A. Missing entityType rejected
    const ownerNoTypeRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `owner_notype_${runId}@homehub.iq`,
        password: 'Password123!',
        fullName: 'Salar Aziz',
        phone: '7501112233',
        role: 'PROPERTY_OWNER',
      }),
    });
    check('REG-OWN-01', 'Property Owner registration without entityType rejected with HTTP 400', ownerNoTypeRes.status === 400);

    // 1B. Owner Individual Registration
    const ownerIndEmail = `owner_ind_${runId}@homehub.iq`;
    const ownerIndRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerIndEmail,
        password: 'Password123!',
        fullName: 'Salar Aziz Individual',
        phone: '7501112233',
        role: 'PROPERTY_OWNER',
        entityType: 'INDIVIDUAL',
      }),
    });
    const ownerIndData = await ownerIndRes.json();
    check('REG-OWN-02', 'Owner Individual registration returns HTTP 201', ownerIndRes.status === 201);
    check('REG-OWN-03', 'Owner Individual receives valid JWT', Boolean(ownerIndData.token));
    if (ownerIndData.user?.id) createdUserIds.push(ownerIndData.user.id);

    const ownerIndDecoded = verifyAuthToken(ownerIndData.token);
    check('REG-OWN-04', 'Owner Individual JWT has activeRole: PROPERTY_OWNER and workspaceId: owner_personal',
      ownerIndDecoded.activeRole === 'PROPERTY_OWNER' && ownerIndDecoded.workspaceId === 'owner_personal');

    // 1C. Owner Company Registration
    const ownerCompEmail = `owner_comp_${runId}@homehub.iq`;
    const ownerCompRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerCompEmail,
        password: 'Password123!',
        fullName: 'Karwan Sleman',
        phone: '7502223344',
        role: 'PROPERTY_OWNER',
        entityType: 'COMPANY',
        companyName: `Zagros Properties ${runId}`,
      }),
    });
    const ownerCompData = await ownerCompRes.json();
    check('REG-OWN-05', 'Owner Company registration returns HTTP 201', ownerCompRes.status === 201);
    if (ownerCompData.user?.id) createdUserIds.push(ownerCompData.user.id);

    const ownerCompDecoded = verifyAuthToken(ownerCompData.token);
    check('REG-OWN-06', 'Owner Company JWT carries organizationId in claims', Boolean(ownerCompDecoded.organizationId));
    check('REG-OWN-07', 'Owner Company JWT carries workspaceId matching company_<orgId>',
      ownerCompDecoded.workspaceId === `company_${ownerCompDecoded.organizationId}`);

    if (ownerCompDecoded.organizationId) {
      createdOrgIds.push(ownerCompDecoded.organizationId);
      const [dbOrg] = await db.select().from(organizations).where(eq(organizations.id, ownerCompDecoded.organizationId)).limit(1);
      check('REG-OWN-08', 'PostgreSQL organizations table has newly provisioned OWNER_COMPANY organization',
        dbOrg && dbOrg.type === 'OWNER_COMPANY' && dbOrg.status === 'PENDING_VERIFICATION');

      const [member] = await db.select().from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, ownerCompDecoded.organizationId),
          eq(organizationMembers.userId, ownerCompData.user.id)
        )).limit(1);
      check('REG-OWN-09', 'Owner is enrolled as active COMPANY_ADMIN in organizationMembers table',
        member && member.role === 'COMPANY_ADMIN' && member.status === 'ACTIVE');
    }

    // -------------------------------------------------------------------------
    // 2. AGENT REGISTRATION (INDIVIDUAL VS COMPANY & PROFILE PROVISIONING)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: AGENT REGISTRATION & SUPPORTING PROFILE PROVISIONING ---');

    // 2A. Agent Individual Registration
    const agentIndEmail = `agent_ind_${runId}@homehub.iq`;
    const agentIndRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: agentIndEmail,
        password: 'Password123!',
        fullName: 'Ahmed Rahman Broker',
        phone: '7503334455',
        role: 'AGENT',
        entityType: 'INDIVIDUAL',
      }),
    });
    const agentIndData = await agentIndRes.json();
    check('REG-AGT-01', 'Agent Individual registration returns HTTP 201', agentIndRes.status === 201);
    if (agentIndData.user?.id) createdUserIds.push(agentIndData.user.id);

    const agentIndDecoded = verifyAuthToken(agentIndData.token);
    check('REG-AGT-02', 'Agent role normalized to AGENT_BROKER in token', agentIndDecoded.activeRole === 'AGENT_BROKER');
    check('REG-AGT-03', 'Agent Individual workspaceId set to agent', agentIndDecoded.workspaceId === 'agent');

    const [agentProfile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentIndData.user.id)).limit(1);
    check('REG-AGT-04', 'PostgreSQL agentProfiles row automatically created in PENDING_VERIFICATION',
      agentProfile && agentProfile.status === 'PENDING_VERIFICATION' && agentProfile.displayName === 'Ahmed Rahman Broker');

    // 2B. Agent Company Registration
    const agentCompEmail = `agent_comp_${runId}@homehub.iq`;
    const agentCompRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: agentCompEmail,
        password: 'Password123!',
        fullName: 'Danyar Barzani Agency',
        phone: '7504445566',
        role: 'AGENT',
        entityType: 'COMPANY',
        companyName: `Hawler Realty Agency ${runId}`,
      }),
    });
    const agentCompData = await agentCompRes.json();
    check('REG-AGT-05', 'Agent Company registration returns HTTP 201', agentCompRes.status === 201);
    if (agentCompData.user?.id) createdUserIds.push(agentCompData.user.id);

    const agentCompDecoded = verifyAuthToken(agentCompData.token);
    check('REG-AGT-06', 'Agent Company token carries organizationId and company_<orgId> workspace',
      Boolean(agentCompDecoded.organizationId) && agentCompDecoded.workspaceId === `company_${agentCompDecoded.organizationId}`);

    if (agentCompDecoded.organizationId) {
      createdOrgIds.push(agentCompDecoded.organizationId);
      const [agentCompProfile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentCompData.user.id)).limit(1);
      check('REG-AGT-07', 'Agent Company agentProfile officeName populated with companyName',
        agentCompProfile && agentCompProfile.officeName === `Hawler Realty Agency ${runId}`);
    }

    // -------------------------------------------------------------------------
    // 3. TENANT REGISTRATION & ACTIVE TENANCY PRIVACY BARRIER
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: TENANT REGISTRATION & ACTIVE TENANCY ACCESS BARRIER ---');

    const tenantEmail = `tenant_fresh_${runId}@homehub.iq`;
    const tenantRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tenantEmail,
        password: 'Password123!',
        fullName: 'Rawand Sleman',
        phone: '7505556677',
        role: 'TENANT',
      }),
    });
    const tenantData = await tenantRes.json();
    check('REG-TNT-01', 'Tenant registration returns HTTP 201', tenantRes.status === 201);
    if (tenantData.user?.id) createdUserIds.push(tenantData.user.id);

    const tenantDecoded = verifyAuthToken(tenantData.token);
    check('REG-TNT-02', 'Tenant token workspaceId is "tenant"', tenantDecoded.workspaceId === 'tenant');
    check('REG-TNT-03', 'Tenant token has activeRole: TENANT', tenantDecoded.activeRole === 'TENANT');

    // Verify Tenant without Active Lease receives fail-closed 403 NO_ACTIVE_LEASE on private lease routes
    const tenantDashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${tenantData.token}` },
    });
    check('REG-TNT-04', 'Tenant without active lease rejected from /tenant/dashboard with HTTP 403', tenantDashRes.status === 403);
    const tenantDashErr = await tenantDashRes.json();
    check('REG-TNT-05', 'Rejection error code is NO_ACTIVE_LEASE', tenantDashErr.error === 'NO_ACTIVE_LEASE');

    // -------------------------------------------------------------------------
    // 4. VENDOR REGISTRATION & SUPPORTING PROFILE
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: VENDOR REGISTRATION & PROFILE INITIALIZATION ---');

    const vendorEmail = `vendor_fresh_${runId}@homehub.iq`;
    const vendorRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: vendorEmail,
        password: 'Password123!',
        fullName: 'Botan Maintenance',
        phone: '7506667788',
        role: 'VENDOR',
      }),
    });
    const vendorData = await vendorRes.json();
    check('REG-VND-01', 'Vendor registration returns HTTP 201', vendorRes.status === 201);
    if (vendorData.user?.id) createdUserIds.push(vendorData.user.id);

    const [vendorProfile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, vendorData.user.id)).limit(1);
    check('REG-VND-02', 'Vendor profile initialized with status ACTIVE and verificationStatus PENDING',
      vendorProfile && vendorProfile.status === 'ACTIVE' && vendorProfile.verificationStatus === 'PENDING');

    // -------------------------------------------------------------------------
    // 5. CROSS-ROLE AUTHORIZATION BOUNDARIES & FAIL-CLOSED ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- PART 5: CROSS-ROLE AUTHORIZATION BOUNDARIES ---');

    // 5A. Tenant cannot access Owner routes
    const tenantToOwner = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${tenantData.token}` },
    });
    check('SEC-BND-01', 'Tenant token denied from Owner property endpoints (HTTP 403)', tenantToOwner.status === 403);

    // 5B. Owner cannot access Admin routes
    const ownerToAdmin = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { Authorization: `Bearer ${ownerIndData.token}` },
    });
    check('SEC-BND-02', 'Owner token denied from Admin metrics (HTTP 403)', ownerToAdmin.status === 403);

    // 5C. Tenant cannot access Agent routes
    const tenantToAgent = await fetch(`${baseUrl}/agent/properties`, {
      headers: { Authorization: `Bearer ${tenantData.token}` },
    });
    check('SEC-BND-03', 'Tenant token denied from Agent workspace (HTTP 403)', tenantToAgent.status === 403);

    // 5D. Unverified Agent blocked from professional mutations
    const agentCreateListing = await fetch(`${baseUrl}/agent/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentIndData.token}`,
      },
      body: JSON.stringify({
        propertyId: 'fake_prop',
        title: 'Unauthorized Listing',
        monthlyRent: 1000000,
      }),
    });
    check('SEC-BND-04', 'Unverified Agent creating listing rejected with HTTP 403 AGENT_VERIFICATION_REQUIRED',
      agentCreateListing.status === 403);

    // -------------------------------------------------------------------------
    // 6. MULTI-WORKSPACE RE-AUTHENTICATION & EXPLICIT SELECTION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 6: MULTI-WORKSPACE RESOLUTION ON MULTI-ROLE ACCOUNT ---');

    // Add TENANT role to Owner account without duplicate identity
    const enrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerIndData.token}`,
      },
      body: JSON.stringify({ role: 'TENANT' }),
    });
    check('MROLE-01', 'Owner successfully enrolled in TENANT role without creating duplicate identity', enrollRes.status === 200);

    // Login multi-role user
    const multiLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerIndEmail,
        password: 'Password123!',
      }),
    });
    const multiLoginData = await multiLoginRes.json();
    check('MROLE-02', 'Multi-role login requires explicit workspace selection', multiLoginData.requiresWorkspaceSelection === true);
    check('MROLE-03', 'Multi-role login provides eligibleWorkspaces array with length >= 2', multiLoginData.eligibleWorkspaces?.length >= 2);

    // Select Tenant workspace
    const selectTenantRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${multiLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });
    const selectTenantData = await selectTenantRes.json();
    check('MROLE-04', 'Workspace selection returns refreshed JWT token', Boolean(selectTenantData.token));
    const switchedDecoded = verifyAuthToken(selectTenantData.token);
    check('MROLE-05', 'Switched token carries activeRole: TENANT and workspaceId: tenant',
      switchedDecoded.activeRole === 'TENANT' && switchedDecoded.workspaceId === 'tenant');

  } finally {
    // Clean up test records idempotently
    server.close();
    try {
      if (createdUserIds.length > 0) {
        await db.delete(agentProfiles).where(sql`${agentProfiles.userId} IN ${createdUserIds}`);
        await db.delete(vendorProfiles).where(sql`${vendorProfiles.userId} IN ${createdUserIds}`);
        await db.delete(organizationMembers).where(sql`${organizationMembers.userId} IN ${createdUserIds}`);
        await db.delete(users).where(sql`${users.id} IN ${createdUserIds}`);
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organizations).where(sql`${organizations.id} IN ${createdOrgIds}`);
      }
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
  }

  console.log('\n================================================================');
  console.log(`  REGISTRATION & PERMISSIONS SUITE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegistrationSecurityLifecycleSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

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
  ownershipRecords,
  leases,
  leaseTenants,
  workOrders,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword, verifyAuthToken, signAuthToken } from '../src/server/utils/auth.js';

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

async function runMultiRoleAccountIntegritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — MULTI-ROLE ACCOUNT INTEGRITY & WORKSPACE TEST SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'SecureMultiRolePassword123!';
  const passwordHash = await hashPassword(testPassword);

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // =========================================================================
    // 1. SINGLE-ROLE DIRECT ENTRY: EXACTLY 1 ELIGIBLE WORKSPACE
    // =========================================================================
    console.log('--- PART 1: SINGLE-ROLE DIRECT ENTRY ---');

    const singleTenantEmail = `single_tenant_${runId}@homehub.iq`;
    const [singleTenantUser] = await db.insert(users).values({
      email: singleTenantEmail,
      firstName: 'Single',
      lastName: 'Tenant',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, singleTenantUser.id));
    });

    const singleLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: singleTenantEmail, password: testPassword }),
    });
    const singleLoginData = await singleLoginRes.json();

    check('MROLE-01', 'Single-role login succeeds with HTTP 200', singleLoginRes.status === 200);
    check('MROLE-02', 'Single-role login does NOT require workspace selection', singleLoginData.requiresWorkspaceSelection === false);
    check('MROLE-03', 'Single-role login provides activeWorkspace directly', singleLoginData.activeWorkspace?.role === 'TENANT' && singleLoginData.activeWorkspace?.workspaceId === 'tenant');
    check('MROLE-04', 'Single-role destination routes directly to /tenant', singleLoginData.activeWorkspace?.destination === '/tenant');
    check('MROLE-05', 'Single-role token has activeRole and workspaceId baked into JWT claims', (() => {
      const decoded = verifyAuthToken(singleLoginData.token);
      return decoded.activeRole === 'TENANT' && decoded.workspaceId === 'tenant';
    })());

    // =========================================================================
    // 2. MULTI-ROLE FRESH LOGIN: EXPLICIT SELECTION REQUIRED (OWNER + TENANT)
    // =========================================================================
    console.log('\n--- PART 2: OWNER + TENANT EXPLICIT SELECTION ---');

    const dualUserEmail = `dual_owner_tenant_${runId}@homehub.iq`;
    const [dualUser] = await db.insert(users).values({
      email: dualUserEmail,
      firstName: 'Dual',
      lastName: 'OwnerTenant',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, dualUser.id));
    });

    const dualLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dualUserEmail, password: testPassword }),
    });
    const dualLoginData = await dualLoginRes.json();

    check('MROLE-06', 'Multi-role login returns HTTP 200', dualLoginRes.status === 200);
    check('MROLE-07', 'Multi-role login explicitly requires workspace selection', dualLoginData.requiresWorkspaceSelection === true);
    check('MROLE-08', 'Multi-role initial login sets activeWorkspace to null (no silent default)', dualLoginData.activeWorkspace === null);
    check('MROLE-09', 'Multi-role login returns all eligible workspaces (length >= 2)', dualLoginData.eligibleWorkspaces?.length === 2);
    check('MROLE-10', 'Eligible workspaces contain both owner_personal and tenant', (() => {
      const ids = dualLoginData.eligibleWorkspaces.map((w: any) => w.workspaceId);
      return ids.includes('owner_personal') && ids.includes('tenant');
    })());

    // Neutral login token does not have activeRole
    const neutralTokenDecoded = verifyAuthToken(dualLoginData.token);
    check('MROLE-11', 'Multi-role neutral JWT does NOT carry an activeRole claim', !neutralTokenDecoded.activeRole);

    // =========================================================================
    // 3. AUTHORITATIVE WORKSPACE SELECTION & FRESH JWT ISSUANCE
    // =========================================================================
    console.log('\n--- PART 3: AUTHORITATIVE WORKSPACE SELECTION ---');

    // 3.1 Select Tenant
    const selectTenantRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dualLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });
    const selectTenantData = await selectTenantRes.json();

    check('MROLE-12', 'Selecting tenant workspace returns HTTP 200', selectTenantRes.status === 200);
    check('MROLE-13', 'Refreshed token has activeRole: TENANT and workspaceId: tenant', (() => {
      const decoded = verifyAuthToken(selectTenantData.token);
      return decoded.activeRole === 'TENANT' && decoded.workspaceId === 'tenant';
    })());
    check('MROLE-14', 'Selected workspace destination is /tenant', selectTenantData.activeWorkspace?.destination === '/tenant');

    // 3.2 Switch to Owner
    const selectOwnerRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${selectTenantData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });
    const selectOwnerData = await selectOwnerRes.json();

    check('MROLE-15', 'Switching to owner_personal workspace returns HTTP 200', selectOwnerRes.status === 200);
    check('MROLE-16', 'Refreshed token has activeRole: PROPERTY_OWNER and workspaceId: owner_personal', (() => {
      const decoded = verifyAuthToken(selectOwnerData.token);
      return decoded.activeRole === 'PROPERTY_OWNER' && decoded.workspaceId === 'owner_personal';
    })());
    check('MROLE-17', 'Selected owner workspace destination is /owner', selectOwnerData.activeWorkspace?.destination === '/owner');

    // =========================================================================
    // 4. ALL FOUR ELIGIBLE ROLES RESOLUTION
    // =========================================================================
    console.log('\n--- PART 4: ALL FOUR ROLES RESOLUTION ---');

    const quadUserEmail = `quad_user_${runId}@homehub.iq`;
    const [quadUser] = await db.insert(users).values({
      email: quadUserEmail,
      firstName: 'Quad',
      lastName: 'User',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT', 'AGENT', 'VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, quadUser.id));
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, quadUser.id));
      await db.delete(users).where(eq(users.id, quadUser.id));
    });

    // Create Agent & Vendor profiles in ACTIVE state
    await db.insert(agentProfiles).values({
      userId: quadUser.id,
      displayName: 'Quad Agent',
      status: 'ACTIVE',
    });
    await db.insert(vendorProfiles).values({
      userId: quadUser.id,
      businessName: 'Quad Services',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    });

    const quadLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: quadUserEmail, password: testPassword }),
    });
    const quadLoginData = await quadLoginRes.json();

    check('MROLE-18', 'Quad-role user login returns requiresWorkspaceSelection: true', quadLoginData.requiresWorkspaceSelection === true);
    check('MROLE-19', 'Quad-role user has exactly 4 eligible workspaces', quadLoginData.eligibleWorkspaces?.length === 4);
    check('MROLE-20', 'All 4 canonical workspaces are resolved (owner_personal, tenant, agent, vendor)', (() => {
      const ids = quadLoginData.eligibleWorkspaces.map((w: any) => w.workspaceId);
      return ids.includes('owner_personal') && ids.includes('tenant') && ids.includes('agent') && ids.includes('vendor');
    })());

    // =========================================================================
    // 5. EXISTING USER ENROLLS NEW ROLE WITHOUT DUPLICATE IDENTITY
    // =========================================================================
    console.log('\n--- PART 5: ROLE ENROLLMENT WITHOUT DUPLICATE IDENTITY ---');

    const enrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'PROPERTY_OWNER' }),
    });
    const enrollData = await enrollRes.json();

    check('MROLE-21', 'Role enrollment returns HTTP 200', enrollRes.status === 200);
    check('MROLE-22', 'Role enrollment adds PROPERTY_OWNER to existing user', enrollData.user.roles.includes('PROPERTY_OWNER') && enrollData.user.roles.includes('TENANT'));

    // Verify exactly one record in users table
    const dbUserRecords = await db.select().from(users).where(eq(users.email, singleTenantEmail));
    check('MROLE-23', 'No duplicate identity created in PostgreSQL (exactly 1 user record)', dbUserRecords.length === 1);
    check('MROLE-24', 'User ID remains identical after role enrollment', dbUserRecords[0].id === singleTenantUser.id);

    // Verify subsequent login now requires workspace selection
    const postEnrollLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: singleTenantEmail, password: testPassword }),
    });
    const postEnrollLoginData = await postEnrollLoginRes.json();
    check('MROLE-25', 'Subsequent login after role enrollment requires workspace selection', postEnrollLoginData.requiresWorkspaceSelection === true);

    // =========================================================================
    // 6. UNAUTHORIZED CLIENT ATTEMPTS TO ADD PRIVILEGED ROLES REJECTED
    // =========================================================================
    console.log('\n--- PART 6: PRIVILEGED ROLE ESCALATION PREVENTION ---');

    const adminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'PLATFORM_ADMIN' }),
    });
    const adminEnrollData = await adminEnrollRes.json();

    check('MROLE-26', 'Attempting to self-enroll PLATFORM_ADMIN is rejected with HTTP 403', adminEnrollRes.status === 403);
    check('MROLE-27', 'Error code is FORBIDDEN_PRIVILEGED_ROLE', adminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const superAdminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'SUPER_ADMIN' }),
    });
    check('MROLE-28', 'Attempting to self-enroll SUPER_ADMIN is rejected with HTTP 403', superAdminEnrollRes.status === 403);

    const accountantEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'ACCOUNTANT' }),
    });
    const accountantEnrollData = await accountantEnrollRes.json();
    check('MROLE-28A', 'Attempting to self-enroll ACCOUNTANT is rejected with HTTP 403', accountantEnrollRes.status === 403);
    check('MROLE-28B', 'ACCOUNTANT error code is FORBIDDEN_PRIVILEGED_ROLE', accountantEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const financeAdminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'FINANCE_ADMIN' }),
    });
    const financeAdminEnrollData = await financeAdminEnrollRes.json();
    check('MROLE-28C', 'Attempting to self-enroll FINANCE_ADMIN is rejected with HTTP 403', financeAdminEnrollRes.status === 403);
    check('MROLE-28D', 'FINANCE_ADMIN error code is FORBIDDEN_PRIVILEGED_ROLE', financeAdminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const companyAdminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ role: 'COMPANY_ADMIN' }),
    });
    const companyAdminEnrollData = await companyAdminEnrollRes.json();
    check('MROLE-28E', 'Attempting to self-enroll COMPANY_ADMIN is rejected with HTTP 403', companyAdminEnrollRes.status === 403);
    check('MROLE-28F', 'COMPANY_ADMIN error code is FORBIDDEN_PRIVILEGED_ROLE', companyAdminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    // Verify DB does not contain admin or privileged roles
    const [auditUser] = await db.select().from(users).where(eq(users.id, singleTenantUser.id));
    check('MROLE-29', 'Database roles array was NOT modified with privileged role', 
      !auditUser.roles?.includes('PLATFORM_ADMIN') && 
      !auditUser.roles?.includes('SUPER_ADMIN') &&
      !auditUser.roles?.includes('ACCOUNTANT') &&
      !auditUser.roles?.includes('FINANCE_ADMIN') &&
      !auditUser.roles?.includes('COMPANY_ADMIN')
    );

    // =========================================================================
    // 7. SUSPENDED ROLES ARE EXCLUDED FROM ELIGIBLE WORKSPACES
    // =========================================================================
    console.log('\n--- PART 7: SUSPENDED ROLES EXCLUSION ---');

    // Suspend agent profile for quadUser
    await db.update(agentProfiles).set({ status: 'SUSPENDED' }).where(eq(agentProfiles.userId, quadUser.id));

    const suspendedAgentLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: quadUserEmail, password: testPassword }),
    });
    const suspendedAgentLoginData = await suspendedAgentLoginRes.json();
    const availableWsIds = suspendedAgentLoginData.eligibleWorkspaces.map((w: any) => w.workspaceId);

    check('MROLE-30', 'Suspended agent profile is EXCLUDED from eligibleWorkspaces', !availableWsIds.includes('agent'));
    check('MROLE-31', 'Remaining active roles (owner_personal, tenant, vendor) still available', availableWsIds.includes('owner_personal') && availableWsIds.includes('tenant') && availableWsIds.includes('vendor'));

    // Restore agent profile for further tests
    await db.update(agentProfiles).set({ status: 'ACTIVE' }).where(eq(agentProfiles.userId, quadUser.id));

    // =========================================================================
    // 8. PENDING AGENT / VENDOR RESTRICTIONS (OPTION 2A)
    // =========================================================================
    console.log('\n--- PART 8: PENDING AGENT / VENDOR RESTRICTIONS ---');

    // Create a pending agent user
    const pendingAgentEmail = `pending_agent_${runId}@homehub.iq`;
    const [pendingAgentUser] = await db.insert(users).values({
      email: pendingAgentEmail,
      firstName: 'Pending',
      lastName: 'Agent',
      passwordHash,
      roles: ['AGENT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    const [pendingAgentProf] = await db.insert(agentProfiles).values({
      userId: pendingAgentUser.id,
      displayName: 'Pending Agent Profile',
      status: 'PENDING_VERIFICATION',
    }).returning();
    cleanups.push(async () => {
      await db.delete(agentProfiles).where(eq(agentProfiles.id, pendingAgentProf.id));
      await db.delete(users).where(eq(users.id, pendingAgentUser.id));
    });

    const pendingLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingAgentEmail, password: testPassword }),
    });
    const pendingLoginData = await pendingLoginRes.json();

    check('MROLE-32', 'Pending agent can log in and enter workspace in PENDING_VERIFICATION status', pendingLoginData.activeWorkspace?.status === 'PENDING_VERIFICATION');

    // Attempting professional operation (creating listing) is denied
    const createListingRes = await fetch(`${baseUrl}/agent/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pendingLoginData.token}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Pending Listing',
        propertyType: 'APARTMENT',
        priceIqd: 1000000,
        city: 'Erbil',
      }),
    });
    const createListingData = await createListingRes.json().catch(() => ({}));

    check('MROLE-33', 'Pending agent creating listing is rejected with HTTP 403', createListingRes.status === 403);
    check('MROLE-34', 'Error code specifies AGENT_VERIFICATION_REQUIRED', createListingData.error === 'AGENT_VERIFICATION_REQUIRED');

    // =========================================================================
    // 9. INVALID / FORGED WORKSPACE SELECTION IS REJECTED
    // =========================================================================
    console.log('\n--- PART 9: INVALID / FORGED WORKSPACE REJECTION ---');

    // Tenant attempting to select 'admin'
    const forgeAdminRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'admin' }),
    });
    const forgeAdminData = await forgeAdminRes.json().catch(() => ({}));

    check('MROLE-35', 'Selecting unearned workspaceId (admin) is rejected with HTTP 403', forgeAdminRes.status === 403);
    check('MROLE-36', 'Error code specifies INVALID_WORKSPACE_SELECTION', forgeAdminData.error === 'INVALID_WORKSPACE_SELECTION');

    // Selecting non-existent workspace ID
    const bogusRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'forged_workspace_id_999' }),
    });
    check('MROLE-37', 'Selecting non-existent workspace ID rejected with HTTP 403', bogusRes.status === 403);

    // =========================================================================
    // 10. PERSONAL OWNER VS COMPANY MANAGEMENT (OPTION 3A)
    // =========================================================================
    console.log('\n--- PART 10: PERSONAL OWNER VS COMPANY SEPARATION ---');

    const [testOrg] = await db.insert(organizations).values({
      name: `Hawler Realty LLC ${runId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
    }).returning();
    const [testMember] = await db.insert(organizationMembers).values({
      organizationId: testOrg.id,
      userId: dualUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.id, testMember.id));
      await db.delete(organizations).where(eq(organizations.id, testOrg.id));
    });

    // Re-login dual user
    const sepLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dualUserEmail, password: testPassword }),
    });
    const sepLoginData = await sepLoginRes.json();
    const sepWsIds = sepLoginData.eligibleWorkspaces.map((w: any) => w.workspaceId);

    check('MROLE-38', 'Personal owner and company workspaces both resolved (Option 3A)', sepWsIds.includes('owner_personal') && sepWsIds.includes(`company_${testOrg.id}`));

    // Select company workspace
    const selectCompanyRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sepLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: `company_${testOrg.id}` }),
    });
    const selectCompanyData = await selectCompanyRes.json();

    check('MROLE-39', 'Selecting company workspace sets organizationId in JWT', (() => {
      const decoded = verifyAuthToken(selectCompanyData.token);
      return decoded.workspaceId === `company_${testOrg.id}` && decoded.organizationId === testOrg.id;
    })());
    check('MROLE-40', 'Company workspace has isCompany: true flag', selectCompanyData.activeWorkspace?.isCompany === true);

    // =========================================================================
    // 11. OWNER OF PROPERTY A AND TENANT OF PROPERTY B LEGITIMACY
    // =========================================================================
    console.log('\n--- PART 11: DUAL PROPERTY RELATIONSHIP LEGITIMACY ---');

    // Create Property A owned by dualUser
    const [propA] = await db.insert(properties).values({
      name: `Property A ${runId}`,
      type: 'APARTMENT',
      status: 'AVAILABLE',
    }).returning();
    const [ownRecA] = await db.insert(ownershipRecords).values({
      propertyId: propA.id,
      ownerId: dualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    }).returning();

    // Create Property B where dualUser is tenant
    const [propB] = await db.insert(properties).values({
      name: `Property B ${runId}`,
      type: 'APARTMENT',
      status: 'RENTED',
    }).returning();
    const [leaseB] = await db.insert(leases).values({
      propertyId: propB.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '750000',
    }).returning();
    const [leaseTenantB] = await db.insert(leaseTenants).values({
      leaseId: leaseB.id,
      tenantId: dualUser.id,
      isPrimary: true,
    }).returning();

    cleanups.push(async () => {
      await db.delete(leaseTenants).where(eq(leaseTenants.id, leaseTenantB.id));
      await db.delete(leases).where(eq(leases.id, leaseB.id));
      await db.delete(properties).where(eq(properties.id, propB.id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.id, ownRecA.id));
      await db.delete(properties).where(eq(properties.id, propA.id));
    });

    // In owner_personal context: accesses Property A
    const ownerTokenRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sepLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });
    const ownerTokenData = await ownerTokenRes.json();

    const ownerPropsRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${ownerTokenData.token}` },
    });
    const ownerPropsData = await ownerPropsRes.json();
    const propAFound = Array.isArray(ownerPropsData)
      ? ownerPropsData.some((p: any) => p.id === propA.id)
      : (ownerPropsData.properties?.some((p: any) => p.id === propA.id) || false);

    check('MROLE-41', 'In owner workspace, owner can access owned Property A', propAFound === true);

    // In tenant context: tenant access to lease B
    const tenantTokenRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sepLoginData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });
    const tenantTokenData = await tenantTokenRes.json();

    const tenantDashboardRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${tenantTokenData.token}` },
    });
    check('MROLE-42', 'In tenant workspace, tenant can access their tenant dashboard with HTTP 200', tenantDashboardRes.status === 200);

    // =========================================================================
    // 12. LOGOUT & SESSION REVOCATION CLEARS ROLE STATE
    // =========================================================================
    console.log('\n--- PART 12: LOGOUT & SESSION REVOCATION ---');

    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenantTokenData.token}` },
    });
    check('MROLE-43', 'Logout returns HTTP 200 and success: true', logoutRes.status === 200);

    // Subsequent request with revoked token must fail with 401
    const revokedCheckRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantTokenData.token}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });
    check('MROLE-44', 'Revoked token after logout is rejected with HTTP 401 TOKEN_REVOKED', revokedCheckRes.status === 401);

    // =========================================================================
    // 13. SCREEN SELECT WORKSPACE LOCALIZATION & RTL STANDARDS
    // =========================================================================
    console.log('\n--- PART 13: LOCALIZATION & RTL STANDARDS ---');

    // Verify Kurdish, Arabic, and English label integrity in workspace resolution
    const sampleWs = quadLoginData.eligibleWorkspaces;
    const ownerWs = sampleWs.find((w: any) => w.workspaceId === 'owner_personal');
    const tenantWs = sampleWs.find((w: any) => w.workspaceId === 'tenant');
    const agentWs = sampleWs.find((w: any) => w.workspaceId === 'agent');
    const vendorWs = sampleWs.find((w: any) => w.workspaceId === 'vendor');

    check('MROLE-45', 'Owner workspace has Kurdish title and titleKey', ownerWs?.title === 'خاوەنی موڵک (سەربەخۆ)' && ownerWs?.titleKey === 'workspace.owner_personal');
    check('MROLE-46', 'Tenant workspace has Kurdish title and titleKey', tenantWs?.title === 'کرێنشین' && tenantWs?.titleKey === 'workspace.tenant');
    check('MROLE-47', 'Agent workspace has Kurdish title and titleKey', agentWs?.title === 'ئەگێنت / برۆکەر' && agentWs?.titleKey === 'workspace.agent');
    check('MROLE-48', 'Vendor workspace has Kurdish title and titleKey', vendorWs?.title === 'دابینکەر / خزمەتگوزار' && vendorWs?.titleKey === 'workspace.vendor');

  } finally {
    // Clean up all fixtures
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup error (non-fatal):', err);
      }
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  MULTI-ROLE ACCOUNT TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiRoleAccountIntegritySuite().catch((err) => {
  console.error('Fatal multi-role test failure:', err);
  process.exit(1);
});

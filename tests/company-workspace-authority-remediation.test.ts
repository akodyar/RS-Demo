import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { companyRepository } from '../src/server/repositories/company.js';

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

async function runCompanyAuthoritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — COMPANY WORKSPACE AUTHORITY & SESSION REVOCATION SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'PasswordForCompanyTest123!';
  const passwordHash = await hashPassword(testPassword);

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // -------------------------------------------------------------------------
    // FIXTURES SETUP
    // -------------------------------------------------------------------------
    // 1. Company Organization A (Active / Verified)
    const [orgA] = await db.insert(organizations).values({
      name: `Company Alpha ${runId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    }).returning();

    // 2. Company Organization B (Active / Verified - for cross-company isolation)
    const [orgB] = await db.insert(organizations).values({
      name: `Company Beta ${runId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    }).returning();

    // 3. Company Organization C (Suspended)
    const [orgSuspended] = await db.insert(organizations).values({
      name: `Suspended Company ${runId}`,
      type: 'COMPANY',
      status: 'SUSPENDED',
      verified: false,
    }).returning();

    // 4. Property Owner and Managed Property for Org A
    const [ownerUser] = await db.insert(users).values({
      email: `owner_${runId}@homehub.iq`,
      firstName: 'Property',
      lastName: 'Owner',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [managedPropertyA] = await db.insert(properties).values({
      name: `Property Alpha ${runId}`,
      city: 'Erbil',
      type: 'RESIDENTIAL_APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: managedPropertyA.id,
      ownerId: ownerUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    await db.insert(managementAgreements).values({
      propertyId: managedPropertyA.id,
      companyId: orgA.id,
      ownerId: ownerUser.id,
      startDate: '2026-01-01',
      status: 'ACTIVE',
      grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_LEASES', 'COLLECT_RENT'],
    });

    // 5. Active Company Admin in Org A
    const [adminUser] = await db.insert(users).values({
      email: `admin_a_${runId}@homehub.iq`,
      firstName: 'Admin',
      lastName: 'Alpha',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [adminMemberA] = await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: adminUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    }).returning();

    // 6. Active Viewer in Org A
    const [viewerUser] = await db.insert(users).values({
      email: `viewer_a_${runId}@homehub.iq`,
      firstName: 'Viewer',
      lastName: 'Alpha',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [viewerMemberA] = await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: viewerUser.id,
      role: 'VIEWER',
      status: 'ACTIVE',
    }).returning();

    // 7. Suspended Member in Org A
    const [suspendedUser] = await db.insert(users).values({
      email: `suspended_a_${runId}@homehub.iq`,
      firstName: 'Suspended',
      lastName: 'Member',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: suspendedUser.id,
      role: 'PROPERTY_MANAGER',
      status: 'SUSPENDED',
    });

    // 8. Removed Member in Org A
    const [removedUser] = await db.insert(users).values({
      email: `removed_a_${runId}@homehub.iq`,
      firstName: 'Removed',
      lastName: 'Member',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: removedUser.id,
      role: 'PROPERTY_MANAGER',
      status: 'REMOVED',
    });

    // 9. Member of Suspended Org C
    const [orgCUser] = await db.insert(users).values({
      email: `member_c_${runId}@homehub.iq`,
      firstName: 'Member',
      lastName: 'SuspendedOrg',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: orgSuspended.id,
      userId: orgCUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    // 10. Platform Administrator User
    const [platformAdminUser] = await db.insert(users).values({
      email: `platform_admin_${runId}@homehub.iq`,
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash,
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      await db.delete(managementAgreements).where(eq(managementAgreements.companyId, orgA.id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, managedPropertyA.id));
      await db.delete(properties).where(eq(properties.id, managedPropertyA.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgA.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgB.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgSuspended.id));
      await db.delete(organizations).where(eq(organizations.id, orgA.id));
      await db.delete(organizations).where(eq(organizations.id, orgB.id));
      await db.delete(organizations).where(eq(organizations.id, orgSuspended.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
      await db.delete(users).where(eq(users.id, viewerUser.id));
      await db.delete(users).where(eq(users.id, suspendedUser.id));
      await db.delete(users).where(eq(users.id, removedUser.id));
      await db.delete(users).where(eq(users.id, orgCUser.id));
      await db.delete(users).where(eq(users.id, ownerUser.id));
      await db.delete(users).where(eq(users.id, platformAdminUser.id));
    });

    // =========================================================================
    // TEST CASES
    // =========================================================================

    // CASE 1: Active company member with matching role and workspace is allowed (200 OK)
    console.log('\n--- TEST 1: ACTIVE COMPANY MEMBER AUTHORIZATION ---');
    const validAdminToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const validAdminRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    const validAdminData = await validAdminRes.json();

    check(
      'CO-AUTH-01',
      'Active company member with valid workspace context is allowed access (200 OK)',
      validAdminRes.status === 200 && Array.isArray(validAdminData),
      { status: validAdminRes.status }
    );

    // CASE 2: Missing or mismatched workspace/organization claims are denied (403)
    console.log('\n--- TEST 2: MISMATCHED WORKSPACE / ORG CLAIMS ---');
    const mismatchedWsToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${orgB.id}`, // Claiming Org B workspace with Org A ID
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const mismatchedWsRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${mismatchedWsToken}` },
    });
    const mismatchedWsData = await mismatchedWsRes.json();

    check(
      'CO-AUTH-02A',
      'Mismatched workspaceId and organizationId is denied with 403 ACTIVE_ROLE_MISMATCH',
      mismatchedWsRes.status === 403 && mismatchedWsData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: mismatchedWsRes.status, body: mismatchedWsData }
    );

    // CASE 2B: Missing workspaceId completely under company active role
    const missingWsToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const missingWsRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${missingWsToken}` },
    });
    const missingWsData = await missingWsRes.json();

    check(
      'CO-AUTH-02B',
      'Missing workspaceId claim under company active role is denied with 403 ACTIVE_ROLE_MISMATCH',
      missingWsRes.status === 403 && missingWsData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: missingWsRes.status, body: missingWsData }
    );

    // CASE 3: Suspended member is denied (403)
    console.log('\n--- TEST 3: SUSPENDED MEMBER DENIED ---');
    const suspendedToken = signAuthToken({
      id: suspendedUser.id,
      email: suspendedUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'PROPERTY_MANAGER',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const suspendedRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${suspendedToken}` },
    });
    const suspendedData = await suspendedRes.json();

    check(
      'CO-AUTH-03',
      'Suspended company member is authoritatively denied with 403 ACTIVE_ROLE_MISMATCH',
      suspendedRes.status === 403 && suspendedData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: suspendedRes.status, body: suspendedData }
    );

    // CASE 4: Removed member is denied (403)
    console.log('\n--- TEST 4: REMOVED MEMBER DENIED ---');
    const removedToken = signAuthToken({
      id: removedUser.id,
      email: removedUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'PROPERTY_MANAGER',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const removedRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${removedToken}` },
    });
    const removedData = await removedRes.json();

    check(
      'CO-AUTH-04',
      'Removed company member is authoritatively denied with 403 ACTIVE_ROLE_MISMATCH',
      removedRes.status === 403 && removedData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: removedRes.status, body: removedData }
    );

    // CASE 5: Member of Suspended Organization is denied (403)
    console.log('\n--- TEST 5: SUSPENDED ORGANIZATION DENIED ---');
    const suspendedOrgToken = signAuthToken({
      id: orgCUser.id,
      email: orgCUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${orgSuspended.id}`,
      organizationId: orgSuspended.id,
      tokenVersion: 1,
    });

    const suspendedOrgRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${suspendedOrgToken}` },
    });
    const suspendedOrgData = await suspendedOrgRes.json();

    check(
      'CO-AUTH-05',
      'Member belonging to a SUSPENDED organization is denied with 403 ACTIVE_ROLE_MISMATCH',
      suspendedOrgRes.status === 403 && suspendedOrgData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: suspendedOrgRes.status, body: suspendedOrgData }
    );

    // CASE 6: VIEWER cannot elevate to COMPANY_OWNER or COMPANY_ADMIN (403)
    console.log('\n--- TEST 6: ROLE ELEVATION BLOCKED ---');
    const viewerElevatedToken = signAuthToken({
      id: viewerUser.id,
      email: viewerUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN', // Spoofed: DB role is VIEWER!
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const viewerElevatedRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${viewerElevatedToken}` },
    });
    const viewerElevatedData = await viewerElevatedRes.json();

    check(
      'CO-AUTH-06A',
      'User with VIEWER role attempting to elevate to COMPANY_ADMIN is rejected (403 ACTIVE_ROLE_MISMATCH)',
      viewerElevatedRes.status === 403 && viewerElevatedData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: viewerElevatedRes.status, body: viewerElevatedData }
    );

    // CASE 6B: VIEWER using legitimate VIEWER role is allowed into read route (200 OK)
    const viewerValidToken = signAuthToken({
      id: viewerUser.id,
      email: viewerUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'VIEWER', // Legitimate matching role
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    const viewerValidRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${viewerValidToken}` },
    });

    check(
      'CO-AUTH-06B',
      'User with VIEWER role using legitimate VIEWER active role is permitted (200 OK)',
      viewerValidRes.status === 200,
      { status: viewerValidRes.status }
    );

    // CASE 7: Member of Org A cannot access Org B's workspace (403)
    console.log('\n--- TEST 7: CROSS-ORGANIZATION BOUNDARY ---');
    const crossOrgToken = signAuthToken({
      id: adminUser.id, // Member of Org A
      email: adminUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${orgB.id}`, // Attempting to enter Org B!
      organizationId: orgB.id,
      tokenVersion: 1,
    });

    const crossOrgRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${crossOrgToken}` },
    });
    const crossOrgData = await crossOrgRes.json();

    check(
      'CO-AUTH-07',
      'Member of Org A attempting to access Org B workspace is rejected with 403 ACTIVE_ROLE_MISMATCH',
      crossOrgRes.status === 403 && crossOrgData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: crossOrgRes.status, body: crossOrgData }
    );

    // CASE 8: Session Invalidation on Member Suspension
    console.log('\n--- TEST 8: ATOMIC SESSION INVALIDATION ON SUSPENSION ---');
    // Pre-condition: viewerUser has tokenVersion: 1
    const tokenBeforeSuspension = signAuthToken({
      id: viewerUser.id,
      email: viewerUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'VIEWER',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    // Suspend viewerUser via companyRepository
    await companyRepository.updateMemberStatus(orgA.id, viewerMemberA.id, 'SUSPENDED', adminUser.id);

    // The old token should now fail with 401 TOKEN_REVOKED
    const suspendedTokenCheckRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${tokenBeforeSuspension}` },
    });
    const suspendedTokenCheckData = await suspendedTokenCheckRes.json();

    check(
      'CO-AUTH-08A',
      'Old session token is immediately invalidated after member suspension (401 TOKEN_REVOKED)',
      suspendedTokenCheckRes.status === 401 && suspendedTokenCheckData.error === 'TOKEN_REVOKED',
      { status: suspendedTokenCheckRes.status, body: suspendedTokenCheckData }
    );

    // Verify tokenVersion was incremented in PostgreSQL
    const [dbViewerAfterSuspension] = await db.select().from(users).where(eq(users.id, viewerUser.id));
    check(
      'CO-AUTH-08B',
      'User tokenVersion in PostgreSQL was incremented atomically upon member suspension',
      (dbViewerAfterSuspension.tokenVersion ?? 1) > 1,
      { tokenVersion: dbViewerAfterSuspension.tokenVersion }
    );

    // CASE 9: Session Invalidation on Member Role Change
    console.log('\n--- TEST 9: ATOMIC SESSION INVALIDATION ON ROLE CHANGE ---');
    const [freshMemberUser] = await db.insert(users).values({
      email: `fresh_role_${runId}@homehub.iq`,
      firstName: 'Role',
      lastName: 'Shift',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, freshMemberUser.id));
      await db.delete(users).where(eq(users.id, freshMemberUser.id));
    });

    const [freshMemberRec] = await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: freshMemberUser.id,
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
    }).returning();

    const tokenBeforeRoleChange = signAuthToken({
      id: freshMemberUser.id,
      email: freshMemberUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'PROPERTY_MANAGER',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    // Update role to VIEWER
    await companyRepository.updateMemberRole(orgA.id, freshMemberRec.id, 'VIEWER', adminUser.id);

    const roleChangeTokenCheckRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${tokenBeforeRoleChange}` },
    });
    const roleChangeTokenCheckData = await roleChangeTokenCheckRes.json();

    check(
      'CO-AUTH-09',
      'Old session token is immediately invalidated after member role change (401 TOKEN_REVOKED)',
      roleChangeTokenCheckRes.status === 401 && roleChangeTokenCheckData.error === 'TOKEN_REVOKED',
      { status: roleChangeTokenCheckRes.status, body: roleChangeTokenCheckData }
    );

    // CASE 10: Session Invalidation on Member Removal
    console.log('\n--- TEST 10: ATOMIC SESSION INVALIDATION ON REMOVAL ---');
    const [removalTestUser] = await db.insert(users).values({
      email: `removal_test_${runId}@homehub.iq`,
      firstName: 'To',
      lastName: 'Remove',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, removalTestUser.id));
      await db.delete(users).where(eq(users.id, removalTestUser.id));
    });

    const [removalMemberRec] = await db.insert(organizationMembers).values({
      organizationId: orgA.id,
      userId: removalTestUser.id,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    }).returning();

    const tokenBeforeRemoval = signAuthToken({
      id: removalTestUser.id,
      email: removalTestUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'ACCOUNTANT',
      workspaceId: `company_${orgA.id}`,
      organizationId: orgA.id,
      tokenVersion: 1,
    });

    // Remove member via companyRepository.removeMember
    await companyRepository.removeMember(orgA.id, removalMemberRec.id, adminUser.id);

    const removalTokenCheckRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${tokenBeforeRemoval}` },
    });
    const removalTokenCheckData = await removalTokenCheckRes.json();

    check(
      'CO-AUTH-10',
      'Old session token is immediately invalidated after member removal (401 TOKEN_REVOKED)',
      removalTokenCheckRes.status === 401 && removalTokenCheckData.error === 'TOKEN_REVOKED',
      { status: removalTokenCheckRes.status, body: removalTokenCheckData }
    );

    // CASE 11: Fresh authorized login & workspace selection succeeds after reactivation
    console.log('\n--- TEST 11: REACTIVATION WORKFLOW ---');
    // Reactivate viewerUser
    await companyRepository.updateMemberStatus(orgA.id, viewerMemberA.id, 'ACTIVE', adminUser.id);

    // Fresh login with password
    const loginReactivatedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: viewerUser.email, password: testPassword }),
    });
    const loginReactivatedData = await loginReactivatedRes.json();
    const freshReactivatedToken = loginReactivatedData.token;

    // Fresh token accesses owner properties successfully
    const reactivatedAccessRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${freshReactivatedToken}` },
    });

    check(
      'CO-AUTH-11',
      'Reactivated member can log in and access company workspace successfully (200 OK)',
      reactivatedAccessRes.status === 200,
      { status: reactivatedAccessRes.status }
    );

    // CASE 12: Platform Administrator cross-workspace oversight exception preserved
    console.log('\n--- TEST 12: PLATFORM ADMIN OVERSIGHT PRESERVED ---');
    const platformAdminToken = signAuthToken({
      id: platformAdminUser.id,
      email: platformAdminUser.email,
      roles: ['PLATFORM_ADMIN'],
      activeRole: 'PLATFORM_ADMIN',
      workspaceId: 'admin',
      tokenVersion: 1,
    });

    const adminAccessRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${platformAdminToken}` },
    });

    check(
      'CO-AUTH-12',
      'Platform Admin retains cross-workspace oversight access to Owner domain (200 OK)',
      adminAccessRes.status === 200,
      { status: adminAccessRes.status }
    );

    // CASE 13: Transaction rollback on failure preserves state integrity
    console.log('\n--- TEST 13: TRANSACTION ROLLBACK PRESERVES TOKEN VERSION ---');
    const [viewerBeforeFailedUpdate] = await db.select().from(users).where(eq(users.id, viewerUser.id));
    const tokenVersionBefore = viewerBeforeFailedUpdate.tokenVersion;

    try {
      // Attempt to update member with an invalid non-existent memberId
      await companyRepository.updateMemberStatus(orgA.id, 'non-existent-member-id', 'SUSPENDED', adminUser.id);
    } catch {
      // Expected to fail
    }

    const [viewerAfterFailedUpdate] = await db.select().from(users).where(eq(users.id, viewerUser.id));
    check(
      'CO-AUTH-13',
      'Failed membership update rolls back cleanly without altering user tokenVersion',
      viewerAfterFailedUpdate.tokenVersion === tokenVersionBefore,
      { before: tokenVersionBefore, after: viewerAfterFailedUpdate.tokenVersion }
    );

  } finally {
    console.log('\n--- CLEANING FIXTURES ---');
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (e) {
        console.warn('Cleanup error (ignored):', e);
      }
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  COMPANY WORKSPACE AUTHORITY RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompanyAuthoritySuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { 
  users, 
  properties, 
  leases, 
  leaseTenants, 
  ownershipRecords, 
  documents,
  organizations,
  organizationMembers,
  managementAgreements
} from '../src/db/schema.js';
import { inArray } from 'drizzle-orm';
import storageRouter from '../src/server/routes/storage.js';

dotenv.config({ override: false });
process.env.NODE_ENV = 'test';

const TARGET_TEST_DATABASE = 'homehub_test';

function assertSafeDatabaseConfig(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Got: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  if (process.env.DATABASE_URL) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed. Aborting.`);
    }

    if (parsedUrl.pathname !== `/${TARGET_TEST_DATABASE}`) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL pathname must be '/${TARGET_TEST_DATABASE}'. Got: '${parsedUrl.pathname}'. Aborting.`);
    }
  }
}

function getAuthHeader(userUid: string, role: string): string {
  const payload = { uid: userUid, role };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

test('Storage Route Identity & Role Mapping HTTP Regression Suite (homehub_test)', async (t) => {
  assertSafeDatabaseConfig();

  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  assert.strictEqual(
    connCheck.rows[0].db_name,
    TARGET_TEST_DATABASE,
    `Safety Invariant: Active connection must be strictly to ${TARGET_TEST_DATABASE}`
  );

  const runId = `sroute_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Tracked IDs for deterministic cleanup
  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdDocIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdAgreementIds: string[] = [];

  async function cleanupFixtures() {
    if (createdDocIds.length > 0) {
      await db.delete(documents).where(inArray(documents.id, createdDocIds)).catch(() => {});
    }
    if (createdLeaseIds.length > 0) {
      await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, createdLeaseIds)).catch(() => {});
      await db.delete(leases).where(inArray(leases.id, createdLeaseIds)).catch(() => {});
    }
    if (createdAgreementIds.length > 0) {
      await db.delete(managementAgreements).where(inArray(managementAgreements.id, createdAgreementIds)).catch(() => {});
    }
    if (createdPropertyIds.length > 0) {
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, createdPropertyIds)).catch(() => {});
      await db.delete(properties).where(inArray(properties.id, createdPropertyIds)).catch(() => {});
    }
    if (createdOrgIds.length > 0) {
      await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, createdOrgIds)).catch(() => {});
      await db.delete(organizations).where(inArray(organizations.id, createdOrgIds)).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds)).catch(() => {});
    }
  }

  t.after(async () => {
    await cleanupFixtures();
  });

  // Standard Express test application with storage router mounted
  const app = express();
  app.use(express.json());
  // Harness support: allow test requests representing company actors to convey active organizationId
  app.use((req: any, _res: any, next: any) => {
    const orgHeader = req.headers['x-organization-id'];
    if (orgHeader) {
      let u: any = undefined;
      Object.defineProperty(req, 'user', {
        get: () => u ? { ...u, organizationId: String(orgHeader) } : undefined,
        set: (val) => { u = val; },
        configurable: true,
      });
    }
    next();
  });
  app.use('/api/storage', storageRouter);

  // App variant for testing missing database ID fail-closed behavior
  const mockMissingIdApp = express();
  mockMissingIdApp.use(express.json());
  mockMissingIdApp.use((req: any, _res: any, next: any) => {
    // Intercept user property to simulate authenticated session where id is missing/undefined but uid exists
    let internalUser: any = undefined;
    Object.defineProperty(req, 'user', {
      get: () => internalUser ? { ...internalUser, id: undefined } : undefined,
      set: (val) => { internalUser = val; },
      configurable: true,
    });
    next();
  });
  mockMissingIdApp.use('/api/storage', storageRouter);

  // Seed Entities
  const dbUserTenantA = `usr_db_tenant_a_${runId}`;
  const extUidTenantA = `firebase_ext_tenant_a_${runId}`;

  const dbUserOwner = `usr_db_owner_${runId}`;
  const extUidOwner = `firebase_ext_owner_${runId}`;

  const dbUserAdmin = `usr_db_admin_${runId}`;
  const extUidAdmin = `firebase_ext_admin_${runId}`;

  const dbUserCompanyMember = `usr_db_compmember_${runId}`;
  const extUidCompanyMember = `firebase_ext_compmember_${runId}`;

  const dbUserNoRole = `usr_db_norole_${runId}`;
  const extUidNoRole = `firebase_ext_norole_${runId}`;

  const orgCompany = `org_mgmt_${runId}`;
  const propA = `prop_a_${runId}`;
  const propB = `prop_b_${runId}`;
  const leaseA = `lease_a_${runId}`;
  const agreementA = `mgmt_agree_a_${runId}`;

  // Insert Users (verifying id !== uid)
  await db.insert(users).values([
    {
      id: dbUserTenantA,
      uid: extUidTenantA,
      firstName: 'Tenant',
      lastName: 'A',
      email: `${dbUserTenantA}@test.com`,
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: dbUserOwner,
      uid: extUidOwner,
      firstName: 'Owner',
      lastName: 'One',
      email: `${dbUserOwner}@test.com`,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: dbUserAdmin,
      uid: extUidAdmin,
      firstName: 'Admin',
      lastName: 'Super',
      email: `${dbUserAdmin}@test.com`,
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
    },
    {
      id: dbUserCompanyMember,
      uid: extUidCompanyMember,
      firstName: 'Company',
      lastName: 'Member',
      email: `${dbUserCompanyMember}@test.com`,
      roles: ['COMPANY_MEMBER'],
      organizationId: orgCompany,
      isActive: true,
    },
    {
      id: dbUserNoRole,
      uid: extUidNoRole,
      firstName: 'Empty',
      lastName: 'Roles',
      email: `${dbUserNoRole}@test.com`,
      roles: [],
      isActive: true,
    },
  ]);
  createdUserIds.push(dbUserTenantA, dbUserOwner, dbUserAdmin, dbUserCompanyMember, dbUserNoRole);

  // Insert Organization & Membership
  await db.insert(organizations).values({
    id: orgCompany,
    name: `Zagros Management ${runId}`,
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  });
  createdOrgIds.push(orgCompany);

  await db.insert(organizationMembers).values({
    id: `mem_${runId}`,
    organizationId: orgCompany,
    userId: dbUserCompanyMember,
    role: 'PROPERTY_MANAGER',
    status: 'ACTIVE',
  });

  // Insert Properties
  await db.insert(properties).values([
    {
      id: propA,
      name: `Property A ${runId}`,
      type: 'APARTMENT',
      ownerId: dbUserOwner,
      address: { city: 'Erbil' },
      status: 'ACTIVE',
    },
    {
      id: propB,
      name: `Property B ${runId}`,
      type: 'APARTMENT',
      ownerId: dbUserOwner,
      address: { city: 'Sulaymaniyah' },
      status: 'ACTIVE',
    },
  ]);
  createdPropertyIds.push(propA, propB);

  // Ownership record on Prop A
  await db.insert(ownershipRecords).values({
    id: `own_${propA}`,
    propertyId: propA,
    ownerId: dbUserOwner,
    status: 'VERIFIED',
    ownershipPercentage: '100',
  });

  // Management agreement on Prop A
  await db.insert(managementAgreements).values({
    id: agreementA,
    propertyId: propA,
    companyId: orgCompany,
    ownerId: dbUserOwner,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    grantedPermissions: ['DOCUMENTS', 'MAINTENANCE'],
  });
  createdAgreementIds.push(agreementA);

  // Lease on Prop A for Tenant A
  await db.insert(leases).values({
    id: leaseA,
    propertyId: propA,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1200',
    status: 'ACTIVE',
  });
  createdLeaseIds.push(leaseA);

  await db.insert(leaseTenants).values({
    id: `lt_${leaseA}`,
    leaseId: leaseA,
    tenantId: dbUserTenantA,
  });

  // Documents
  const docPersonalKeyTenantA = `users/${dbUserTenantA}/identity_kyc/doc_personal_tenant_a.pdf`;
  const docDeedPropA = `tenants/${orgCompany}/title_deed/doc_deed_prop_a.pdf`;
  const docPropB = `tenants/${orgCompany}/title_deed/doc_deed_prop_b.pdf`;

  const docIdPersonal = `doc_pers_${runId}`;
  const docIdDeed = `doc_deed_${runId}`;
  const docIdPropB = `doc_pb_${runId}`;

  await db.insert(documents).values([
    {
      id: docIdPersonal,
      propertyId: propA,
      ownerId: dbUserOwner,
      uploaderUserId: dbUserTenantA,
      title: 'Tenant A Passport',
      documentType: 'ID',
      fileUrl: docPersonalKeyTenantA,
      verificationState: 'VERIFIED',
    },
    {
      id: docIdDeed,
      propertyId: propA,
      ownerId: dbUserOwner,
      uploaderUserId: dbUserOwner,
      title: 'Property A Tapu',
      documentType: 'TAPU',
      fileUrl: docDeedPropA,
      verificationState: 'VERIFIED',
    },
    {
      id: docIdPropB,
      propertyId: propB,
      ownerId: dbUserOwner,
      uploaderUserId: dbUserOwner,
      title: 'Property B Tapu',
      documentType: 'TAPU',
      fileUrl: docPropB,
      verificationState: 'VERIFIED',
    },
  ]);
  createdDocIds.push(docIdPersonal, docIdDeed, docIdPropB);

  // ---------------------------------------------------------------------------
  // 1. Upload succeeds for valid user where id !== uid, and personal key uses id
  // ---------------------------------------------------------------------------
  await t.test('1. Upload succeeds for user whose id differs from uid; key partitioned under id', async () => {
    const res = await request(app)
      .post('/api/storage/presigned-upload')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        category: 'IDENTITY_KYC',
        fileName: 'tenant_id_card.pdf',
        fileSizeBytes: 1024 * 500,
        mimeType: 'application/pdf',
        sourceEntityId: propA,
      });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.uploadUrl, 'uploadUrl must be issued');
    assert.ok(res.body.documentKey, 'documentKey must be issued');

    // Invariant: The storage key MUST partition by authoritative dbUserTenantA (id), NOT extUidTenantA (uid)
    assert.ok(
      res.body.documentKey.startsWith(`users/${dbUserTenantA}/identity_kyc/`),
      `Document key must use dbUser id (${dbUserTenantA}), got: ${res.body.documentKey}`
    );
    assert.strictEqual(
      res.body.documentKey.includes(extUidTenantA),
      false,
      `Document key must NOT contain external uid (${extUidTenantA})`
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Download uses id for database-backed authorization when id !== uid
  // ---------------------------------------------------------------------------
  await t.test('2. Download uses id for database-backed authorization when id !== uid', async () => {
    const res = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        documentKey: docPersonalKeyTenantA,
      });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.downloadUrl, 'downloadUrl must be issued');
    assert.strictEqual(res.body.documentKey, docPersonalKeyTenantA);
    assert.ok(res.body.downloadUrl.includes('sig='), 'Download URL must be cryptographically signed');
  });

  // ---------------------------------------------------------------------------
  // 3. Missing database ID fails closed; must not silently use uid
  // ---------------------------------------------------------------------------
  await t.test('3. Missing database ID fails closed with 401; must not silently fall back to uid', async () => {
    // 3a. Upload route with authenticated session lacking database id
    const uploadRes = await request(mockMissingIdApp)
      .post('/api/storage/presigned-upload')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        category: 'IDENTITY_KYC',
        fileName: 'test.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sourceEntityId: propA,
      });

    assert.strictEqual(uploadRes.status, 401, `Upload with missing id must return 401, got ${uploadRes.status}`);
    assert.strictEqual(uploadRes.body.error, 'UNAUTHORIZED');
    assert.strictEqual(uploadRes.body.message, 'Authenticated user database record required');

    // 3b. Download route with authenticated session lacking database id
    const downloadRes = await request(mockMissingIdApp)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        documentKey: docPersonalKeyTenantA,
      });

    assert.strictEqual(downloadRes.status, 401, `Download with missing id must return 401, got ${downloadRes.status}`);
    assert.strictEqual(downloadRes.body.error, 'UNAUTHORIZED');
    assert.strictEqual(downloadRes.body.message, 'Authenticated user database record required');

    // 3c. Unauthenticated request without Authorization header
    const unauthRes = await request(app)
      .post('/api/storage/presigned-download')
      .send({
        documentKey: docPersonalKeyTenantA,
      });

    assert.strictEqual(unauthRes.status, 401, `Unauthenticated request must return 401, got ${unauthRes.status}`);
  });

  // ---------------------------------------------------------------------------
  // 4. Role propagation uses verified role contract without inventing default role
  // ---------------------------------------------------------------------------
  await t.test('4. Role propagation preserves PLATFORM_ADMIN fast-path and does not invent default role', async () => {
    // 4a. PLATFORM_ADMIN can download any document (admin fast-path)
    const adminRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidAdmin, 'PLATFORM_ADMIN'))
      .send({
        documentKey: docDeedPropA,
      });

    assert.strictEqual(adminRes.status, 200, `Admin must receive 200, got ${adminRes.status}`);
    assert.ok(adminRes.body.downloadUrl, 'Admin should receive signed download URL');

    // 4b. User with empty roles is NOT assigned synthetic 'TENANT' role; denied unauthorized access
    const noRoleRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidNoRole, ''))
      .send({
        documentKey: docDeedPropA,
      });

    assert.strictEqual(noRoleRes.status, 403, `User with no roles must be denied with 403, got ${noRoleRes.status}`);
  });

  // ---------------------------------------------------------------------------
  // 5. Existing tenant cross-document access remains denied
  // ---------------------------------------------------------------------------
  await t.test('5. Tenant cannot access owner deed on same property or any document on foreign property', async () => {
    // 5a. Tenant A cannot download owner's TAPU on Property A (even with active lease on Prop A)
    const deedRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        documentKey: docDeedPropA,
      });

    assert.strictEqual(deedRes.status, 403, `Tenant accessing TAPU must be 403, got ${deedRes.status}`);
    assert.strictEqual(deedRes.body.error, 'FORBIDDEN');

    // 5b. Tenant A cannot download document on Property B (no lease on Prop B)
    const foreignRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidTenantA, 'TENANT'))
      .send({
        documentKey: docPropB,
      });

    assert.strictEqual(foreignRes.status, 403, `Tenant accessing foreign property document must be 403, got ${foreignRes.status}`);
    assert.strictEqual(foreignRes.body.error, 'FORBIDDEN');
  });

  // ---------------------------------------------------------------------------
  // 6. Authorized owner and company workflows remain intact
  // ---------------------------------------------------------------------------
  await t.test('6. Authorized owner and managing company workflows remain intact', async () => {
    // 6a. Owner can download deed on their owned property
    const ownerRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidOwner, 'PROPERTY_OWNER'))
      .send({
        documentKey: docDeedPropA,
      });

    assert.strictEqual(ownerRes.status, 200, `Owner accessing owned property deed must be 200, got ${ownerRes.status}`);
    assert.ok(ownerRes.body.downloadUrl, 'Owner download URL issued');

    // 6b. Managing company member can download deed on managed property
    const companyRes = await request(app)
      .post('/api/storage/presigned-download')
      .set('Authorization', getAuthHeader(extUidCompanyMember, 'COMPANY_MEMBER'))
      .set('x-organization-id', orgCompany)
      .send({
        documentKey: docDeedPropA,
      });

    assert.strictEqual(companyRes.status, 200, `Company member accessing managed property deed must be 200, got ${companyRes.status}`);
    assert.ok(companyRes.body.downloadUrl, 'Company member download URL issued');
  });
});

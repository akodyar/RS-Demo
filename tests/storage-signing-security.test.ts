import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB — STORAGE SIGNING SECURITY & FAIL-CLOSED SUITE
 * 
 * Verifies all 12 storage signing security requirements:
 * 1. Valid configured secret -> signing succeeds.
 * 2. Missing production secret -> operation fails closed (503 STORAGE_SIGNING_UNCONFIGURED).
 * 3. JWT_SECRET cannot be used as fallback.
 * 4. Database password cannot be used as fallback.
 * 5. Session secret cannot be used as fallback.
 * 6. Signature tampering -> rejected.
 * 7. Expired signature -> rejected.
 * 8. Unauthorized object / path traversal -> signature not issued (403/400).
 * 9. Cross-tenant object -> rejected.
 * 10. Cross-property / invalid namespace object -> rejected.
 * 11. Secret never appears in frontend bundle.
 * 12. Secret never appears in logs or error messages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { storageService, StorageService } from '../src/server/services/storage-service.js';
import { loadServerConfig, getSanitizedConfigSummary } from '../src/server/config/env.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers, properties, documents, ownershipRecords } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`);
    failed++;
  }
}

async function runStorageSecuritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — STORAGE SIGNING SECURITY & FAIL-CLOSED SUITE');
  console.log('================================================================\n');

  // Seed data for DB-backed authorization check
  await db.insert(users).values([
    { id: 'usr_owner_01', firstName: 'Owner', lastName: 'One', email: 'usr_owner_01@storagesec.test', roles: ['PROPERTY_OWNER'] },
    { id: 'usr_attacker_01', firstName: 'Attacker', lastName: 'One', email: 'usr_attacker_01@storagesec.test', roles: ['COMPANY_AGENT'] },
    { id: 'usr_individual_buyer', firstName: 'Buyer', lastName: 'One', email: 'usr_buyer_01@storagesec.test', roles: ['BUYER'] }
  ]).onConflictDoNothing();

  await db.insert(organizations).values([
    { id: 'org_alpha', name: 'Alpha Org', type: 'PROPERTY_MANAGEMENT' },
    { id: 'org_attacker', name: 'Attacker Org', type: 'PROPERTY_MANAGEMENT' },
    { id: 'org_victim', name: 'Victim Org', type: 'PROPERTY_MANAGEMENT' }
  ]).onConflictDoNothing();

  await db.insert(organizationMembers).values([
    { organizationId: 'org_alpha', userId: 'usr_owner_01', role: 'ADMIN' },
    { organizationId: 'org_attacker', userId: 'usr_attacker_01', role: 'MEMBER' }
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    { id: 'prop_01', name: 'Alpha Property', type: 'RESIDENTIAL', status: 'ACTIVE', address: '123 Alpha St' }
  ]).onConflictDoNothing();

  await db.insert(ownershipRecords).values([
    { propertyId: 'prop_01', ownerId: 'usr_owner_01', ownershipPercentage: '100' }
  ]).onConflictDoNothing();

  await db.insert(documents).values([
    { id: 'doc_101', propertyId: 'prop_01', title: 'Deed', documentType: 'TITLE_DEED', fileUrl: 'tenants/org_alpha/title_deed/doc_101_deed.pdf', uploaderUserId: 'usr_owner_01', verificationState: 'PENDING' },
    { id: 'doc_999', propertyId: 'prop_01', title: 'Secret', documentType: 'TITLE_DEED', fileUrl: 'tenants/org_victim/title_deed/doc_999_secret.pdf', uploaderUserId: 'usr_owner_01', verificationState: 'PENDING' }
  ]).onConflictDoNothing();

  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.STORAGE_SIGNING_SECRET;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalSqlPassword = process.env.SQL_PASSWORD;

  try {
    // -------------------------------------------------------------
    // TEST 1: Valid configured secret -> signing succeeds
    // -------------------------------------------------------------
    process.env.NODE_ENV = 'production';
    process.env.SQL_PASSWORD = 'super-secure-production-db-password-12345';
    process.env.STORAGE_SIGNING_SECRET = 'valid-production-signing-secret-entropy-32chars!';
    
    const validUpload = await storageService.generatePresignedUploadUrl({
      userId: 'usr_owner_01',
      userRole: 'PROPERTY_OWNER',
      organizationId: 'org_alpha',
      category: 'TITLE_DEED',
      fileName: 'deed_alpha.pdf',
      fileSizeBytes: 1024 * 1024,
      mimeType: 'application/pdf',
      sourceEntityId: 'prop_01',
    });

    const isUploadSigned = Boolean(
      validUpload.uploadUrl.includes('sig=') &&
      validUpload.uploadUrl.includes('expires=') &&
      validUpload.signature.length === 64
    );
    assert(isUploadSigned, 'STOR-SEC-01', 'Valid configured secret: upload URL cryptographically signed with HMAC-SHA256');

    // -------------------------------------------------------------
    // TEST 2: Missing production secret -> fails closed (503)
    // -------------------------------------------------------------
    delete process.env.STORAGE_SIGNING_SECRET;
    let missingSecretThrew503 = false;
    try {
      await storageService.generatePresignedUploadUrl({
        userId: 'usr_owner_01',
        userRole: 'PROPERTY_OWNER',
        organizationId: 'org_alpha',
        category: 'TITLE_DEED',
        fileName: 'deed_alpha.pdf',
        fileSizeBytes: 1024 * 1024,
        mimeType: 'application/pdf',
        sourceEntityId: 'prop_01',
      });
    } catch (err: any) {
      if (err.message.includes('503') && err.message.includes('STORAGE_SIGNING_UNCONFIGURED')) {
        missingSecretThrew503 = true;
      }
    }
    assert(missingSecretThrew503, 'STOR-SEC-02', 'Missing production secret: strictly fails closed with 503 STORAGE_SIGNING_UNCONFIGURED');

    // -------------------------------------------------------------
    // TEST 3: JWT_SECRET cannot be used as fallback
    // -------------------------------------------------------------
    process.env.JWT_SECRET = 'super-secret-jwt-key-for-auth-token-generation';
    process.env.STORAGE_SIGNING_SECRET = process.env.JWT_SECRET; // attempt cross-contamination
    let jwtContaminationBlocked = false;
    try {
      await storageService.generatePresignedUploadUrl({
        userId: 'usr_owner_01',
        userRole: 'PROPERTY_OWNER',
        organizationId: 'org_alpha',
        category: 'TITLE_DEED',
        fileName: 'deed_alpha.pdf',
        fileSizeBytes: 1024 * 1024,
        mimeType: 'application/pdf',
        sourceEntityId: 'prop_01',
      });
    } catch (err: any) {
      if (err.message.includes('503') && err.message.includes('STORAGE_SIGNING_INVALID')) {
        jwtContaminationBlocked = true;
      }
    }
    assert(jwtContaminationBlocked, 'STOR-SEC-03', 'JWT_SECRET cross-contamination strictly rejected with 503 STORAGE_SIGNING_INVALID');

    // -------------------------------------------------------------
    // TEST 4: Database password cannot be used as fallback
    // -------------------------------------------------------------
    process.env.SQL_PASSWORD = 'super-secure-production-db-password-12345';
    process.env.STORAGE_SIGNING_SECRET = process.env.SQL_PASSWORD; // attempt DB password reuse
    let dbPassReuseBlocked = false;
    try {
      await storageService.generatePresignedUploadUrl({
        userId: 'usr_owner_01',
        userRole: 'PROPERTY_OWNER',
        organizationId: 'org_alpha',
        category: 'TITLE_DEED',
        fileName: 'deed_alpha.pdf',
        fileSizeBytes: 1024 * 1024,
        mimeType: 'application/pdf',
        sourceEntityId: 'prop_01',
      });
    } catch (err: any) {
      if (err.message.includes('503') && err.message.includes('STORAGE_SIGNING_INVALID')) {
        dbPassReuseBlocked = true;
      }
    }
    assert(dbPassReuseBlocked, 'STOR-SEC-04', 'Database password reuse strictly rejected with 503 STORAGE_SIGNING_INVALID');

    // -------------------------------------------------------------
    // TEST 5: Session secret cannot be used as fallback
    // -------------------------------------------------------------
    process.env.SESSION_SECRET = 'super-secure-express-session-signing-secret';
    process.env.STORAGE_SIGNING_SECRET = process.env.SESSION_SECRET; // attempt session secret reuse
    let sessionSecretReuseBlocked = false;
    try {
      await storageService.generatePresignedUploadUrl({
        userId: 'usr_owner_01',
        userRole: 'PROPERTY_OWNER',
        organizationId: 'org_alpha',
        category: 'TITLE_DEED',
        fileName: 'deed_alpha.pdf',
        fileSizeBytes: 1024 * 1024,
        mimeType: 'application/pdf',
        sourceEntityId: 'prop_01',
      });
    } catch (err: any) {
      if (err.message.includes('503') && err.message.includes('STORAGE_SIGNING_INVALID')) {
        sessionSecretReuseBlocked = true;
      }
    }
    assert(sessionSecretReuseBlocked, 'STOR-SEC-05', 'Session secret reuse strictly rejected with 503 STORAGE_SIGNING_INVALID');

    // Restore clean synthetic test secret for functional HMAC tests
    process.env.STORAGE_SIGNING_SECRET = 'synthetic-isolated-signing-key-for-test-entropy-32!';

    // -------------------------------------------------------------
    // TEST 6: Signature tampering -> rejected
    // -------------------------------------------------------------
    const genuineDownload = await storageService.generatePresignedDownloadUrl({
      documentKey: 'tenants/org_alpha/title_deed/doc_101_deed.pdf',
      requestingUserId: 'usr_owner_01',
      userRole: 'PROPERTY_OWNER',
      organizationId: 'org_alpha',
    });

    const parsedUrl = new URL(genuineDownload.downloadUrl);
    const genuineSig = parsedUrl.searchParams.get('sig')!;
    const expiresAt = parsedUrl.searchParams.get('expires')!;

    // Verify genuine signature passes
    const genuineValid = storageService.verifySignedUrl({
      method: 'GET',
      documentKey: genuineDownload.documentKey,
      expiresAt,
      signature: genuineSig,
      userId: 'usr_owner_01',
    });

    // Tamper signature by flipping one character
    const tamperedSig = genuineSig.slice(0, -1) + (genuineSig.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedValid = storageService.verifySignedUrl({
      method: 'GET',
      documentKey: genuineDownload.documentKey,
      expiresAt,
      signature: tamperedSig,
      userId: 'usr_owner_01',
    });

    assert(genuineValid === true && tamperedValid === false, 'STOR-SEC-06', 'Signature tampering detected and rejected via timingSafeEqual');

    // -------------------------------------------------------------
    // TEST 7: Expired signature -> rejected
    // -------------------------------------------------------------
    const staleExpiresAt = new Date(Date.now() - 60000).toISOString(); // 1 minute in past
    const expiredValid = storageService.verifySignedUrl({
      method: 'GET',
      documentKey: genuineDownload.documentKey,
      expiresAt: staleExpiresAt,
      signature: genuineSig,
      userId: 'usr_owner_01',
    });
    assert(expiredValid === false, 'STOR-SEC-07', 'Expired signature (> TTL) strictly rejected');

    // -------------------------------------------------------------
    // TEST 8: Unauthorized object / path traversal -> signature not issued
    // -------------------------------------------------------------
    let pathTraversalBlocked = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: 'tenants/org_alpha/../../etc/passwd',
        requestingUserId: 'usr_owner_01',
        organizationId: 'org_alpha',
      });
    } catch (err: any) {
      pathTraversalBlocked = err.message.includes('403') || err.message.includes('PATH_TRAVERSAL_DETECTED');
    }
    assert(pathTraversalBlocked, 'STOR-SEC-08', 'Path traversal attempt (../) rejected before HMAC signature issuance');

    // -------------------------------------------------------------
    // TEST 9: Cross-tenant object -> rejected
    // -------------------------------------------------------------
    let crossTenantBlocked = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: 'tenants/org_victim/title_deed/doc_999_secret.pdf',
        requestingUserId: 'usr_attacker_01',
        userRole: 'COMPANY_AGENT',
        organizationId: 'org_attacker',
      });
    } catch (err: any) {
      crossTenantBlocked = err.message.includes('403') && err.message.includes('CROSS_TENANT_ACCESS_DENIED');
    }

    // Also test organizationId: undefined (individual caller cannot bypass tenant boundary)
    let noOrgBypassBlocked = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: 'tenants/org_victim/title_deed/doc_999_secret.pdf',
        requestingUserId: 'usr_individual_buyer',
        userRole: 'BUYER',
        organizationId: undefined,
      });
    } catch (err: any) {
      noOrgBypassBlocked = err.message.includes('403') && err.message.includes('CROSS_TENANT_ACCESS_DENIED');
    }

    assert(crossTenantBlocked && noOrgBypassBlocked, 'STOR-SEC-09', 'DB-backed Cross-tenant object access strictly rejected (Org B and undefined-org callers cannot sign download URL for Org A)');

    // -------------------------------------------------------------
    // TEST 10: Cross-property / invalid storage namespace -> rejected
    // -------------------------------------------------------------
    let invalidNamespaceBlocked = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: 'arbitrary_bucket/system/internal_keys.json',
        requestingUserId: 'usr_owner_01',
        userRole: 'PROPERTY_OWNER',
        organizationId: 'org_alpha',
      });
    } catch (err: any) {
      invalidNamespaceBlocked = err.message.includes('403') && err.message.includes('UNAUTHORIZED_STORAGE_PATH');
    }
    assert(invalidNamespaceBlocked, 'STOR-SEC-10', 'Arbitrary storage path outside tenants/ or users/ namespace rejected');

    // -------------------------------------------------------------
    // TEST 11: Secret never appears in frontend bundle
    // -------------------------------------------------------------
    const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');
    let secretInFrontend = false;
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
        if (
          content.includes('STORAGE_SIGNING_SECRET') ||
          content.includes('synthetic-isolated-signing-key') ||
          content.includes('dev-local-storage-signing-secret')
        ) {
          secretInFrontend = true;
          break;
        }
      }
    }
    assert(!secretInFrontend, 'STOR-SEC-11', 'Compiled frontend JavaScript bundle (dist/assets/) contains zero storage secrets');

    // -------------------------------------------------------------
    // TEST 12: Secret never appears in logs, error messages, or config summary
    // -------------------------------------------------------------
    const config = loadServerConfig();
    const configSummary = getSanitizedConfigSummary(config);
    const summaryStr = JSON.stringify(configSummary);
    const doesNotLeakValue = !summaryStr.includes('synthetic-isolated-signing-key');
    const reportsSafeStatus = configSummary.storage.signingSecret === '[CONFIGURED]' &&
      configSummary.storage.signingStatus === 'SECRET_PRESENT';

    let errorLeaksValue = false;
    try {
      process.env.STORAGE_SIGNING_SECRET = 'short';
      const svc = new StorageService();
      (svc as any).getSecretKey();
    } catch (err: any) {
      if (err.message.includes('short')) {
        errorLeaksValue = true;
      }
    }

    assert(doesNotLeakValue && reportsSafeStatus && !errorLeaksValue, 'STOR-SEC-12', 'Storage secret value is strictly redacted in config summary and never leaked in error messages');

  } finally {
    // Restore original environment
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;

    if (originalSecret !== undefined) process.env.STORAGE_SIGNING_SECRET = originalSecret;
    else delete process.env.STORAGE_SIGNING_SECRET;

    if (originalJwtSecret !== undefined) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;

    if (originalSessionSecret !== undefined) process.env.SESSION_SECRET = originalSessionSecret;
    else delete process.env.SESSION_SECRET;

    if (originalSqlPassword !== undefined) process.env.SQL_PASSWORD = originalSqlPassword;
    else delete process.env.SQL_PASSWORD;

    // Teardown seeded test data
    await db.delete(documents).where(inArray(documents.id, ['doc_101', 'doc_999'])).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, 'prop_01')).catch(() => {});
    await db.delete(properties).where(eq(properties.id, 'prop_01')).catch(() => {});
    await db.delete(organizationMembers).where(inArray(organizationMembers.userId, ['usr_owner_01', 'usr_attacker_01'])).catch(() => {});
    await db.delete(organizations).where(inArray(organizations.id, ['org_alpha', 'org_attacker', 'org_victim'])).catch(() => {});
    await db.delete(users).where(inArray(users.id, ['usr_owner_01', 'usr_attacker_01', 'usr_individual_buyer'])).catch(() => {});
  }

  console.log('\n================================================================');
  console.log(`  STORAGE SECURITY TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStorageSecuritySuite().catch((err) => {
  console.error('Fatal error in storage security suite:', err);
  process.exit(1);
});

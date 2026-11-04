import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { 
  users, 
  properties, 
  units, 
  leases, 
  leaseTenants, 
  ownershipRecords, 
  documents,
  organizations,
  organizationMembers
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { TenantRepository } from '../src/server/repositories/tenant.js';
import { storageService } from '../src/server/services/storage-service.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

const TIMESTAMP = Date.now();
const PREFIX = `priv_${TIMESTAMP}`;

test('Tenant Document Privacy and Object-Level Authorization Suite', async (t) => {
  const tenantRepo = new TenantRepository();

  // Test Entities
  const ownerId = `${PREFIX}_owner`;
  const tenantAId = `${PREFIX}_tenantA`;
  const tenantBId = `${PREFIX}_tenantB`;
  const tenantTermId = `${PREFIX}_tenantTerm`;
  const propId = `${PREFIX}_prop`;
  const unit1Id = `${PREFIX}_unit1`;
  const unit2Id = `${PREFIX}_unit2`;
  const lease1Id = `${PREFIX}_lease1`;
  const lease2Id = `${PREFIX}_lease2`;
  const leaseTermId = `${PREFIX}_leaseTerm`;
  const leaseSignedId = `${PREFIX}_leaseSigned`;
  const tenantSignedId = `${PREFIX}_tenantSigned`;

  // Document IDs & Keys
  const docTapuId = `${PREFIX}_doc_tapu`;
  const docDeedId = `${PREFIX}_doc_deed`;
  const docIdTenantBId = `${PREFIX}_doc_id_b`;
  const docLeaseBId = `${PREFIX}_doc_lease_b`;
  const docLeaseAId = `${PREFIX}_doc_lease_a`;
  const docInspectUnit2Id = `${PREFIX}_doc_inspect_2`;
  const docInspectUnit1Id = `${PREFIX}_doc_inspect_1`;
  const docRulesId = `${PREFIX}_doc_rules`;
  const docUnknownId = `${PREFIX}_doc_unknown`;
  const docIdSelfId = `${PREFIX}_doc_id_self`;
  const docTenantTapuId = `${PREFIX}_doc_tenant_tapu`;
  const docTenantDeedId = `${PREFIX}_doc_tenant_deed`;
  const docPriorLeaseUnit1Id = `${PREFIX}_doc_prior_lease_1`;
  const docInspectEmptyId = `${PREFIX}_doc_inspect_empty`;
  const docInspectPropWideId = `${PREFIX}_doc_inspect_prop_wide`;

  const keyTapu = `tenants/org_${PREFIX}/tapu_secret.pdf`;
  const keyDeed = `tenants/org_${PREFIX}/deed_secret.pdf`;
  const keyIdTenantB = `tenants/org_${PREFIX}/tenantB_passport.pdf`;
  const keyLeaseB = `tenants/org_${PREFIX}/tenantB_lease.pdf`;
  const keyLeaseA = `tenants/org_${PREFIX}/tenantA_lease.pdf`;
  const keyInspectUnit2 = `tenants/org_${PREFIX}/inspection_unit2.pdf`;
  const keyInspectUnit1 = `tenants/org_${PREFIX}/inspection_unit1.pdf`;
  const keyInspectEmpty = `tenants/org_${PREFIX}/inspection_empty.pdf`;
  const keyInspectPropWide = `tenants/org_${PREFIX}/inspection_prop_wide.pdf`;
  const keyRules = `tenants/org_${PREFIX}/building_rules.pdf`;
  const keyUnknown = `tenants/org_${PREFIX}/internal_memo.pdf`;
  const keyIdSelf = `tenants/org_${PREFIX}/tenantA_passport.pdf`;
  const keyTenantTapu = `tenants/org_${PREFIX}/tenant_tapu.pdf`;
  const keyTenantDeed = `tenants/org_${PREFIX}/tenant_deed.pdf`;
  const keyPriorLeaseUnit1 = `tenants/org_${PREFIX}/prior_tenant_lease_unit1.pdf`;
  const keyForged = `tenants/org_${PREFIX}/non_existent_file.pdf`;

  // 1. Setup Fixtures
  await db.insert(users).values([
    { id: ownerId, firstName: 'Owner', lastName: 'Priv', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tenantAId, firstName: 'TenantA', lastName: 'Priv', email: `${tenantAId}@test.com`, roles: ['TENANT'] },
    { id: tenantBId, firstName: 'TenantB', lastName: 'Priv', email: `${tenantBId}@test.com`, roles: ['TENANT'] },
    { id: tenantTermId, firstName: 'TenantTerm', lastName: 'Priv', email: `${tenantTermId}@test.com`, roles: ['TENANT'] },
    { id: tenantSignedId, firstName: 'TenantSigned', lastName: 'Priv', email: `${tenantSignedId}@test.com`, roles: ['TENANT'] },
  ]);

  await db.insert(properties).values({
    id: propId,
    name: 'Multi-Unit Privacy Manor',
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    address: { street: '100 Security Way', city: 'Erbil' },
  });

  await db.insert(units).values([
    { id: unit1Id, propertyId: propId, unitNumber: '101', status: 'OCCUPIED' },
    { id: unit2Id, propertyId: propId, unitNumber: '102', status: 'OCCUPIED' },
  ]);

  await db.insert(ownershipRecords).values({
    propertyId: propId,
    ownerId: ownerId,
    ownershipPercentage: '100',
    status: 'VERIFIED',
  });

  // Leases: Tenant A in Unit 1 (Active), Tenant B in Unit 2 (Active), Tenant C (Terminated), Tenant Signed (Upcoming Active)
  await db.insert(leases).values([
    { id: lease1Id, propertyId: propId, unitId: unit1Id, status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1000000', currency: 'IQD' },
    { id: lease2Id, propertyId: propId, unitId: unit2Id, status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1200000', currency: 'IQD' },
    { id: leaseTermId, propertyId: propId, unitId: unit1Id, status: 'TERMINATED', startDate: '2024-01-01', endDate: '2024-12-31', rentAmount: '900000', currency: 'IQD' },
    { id: leaseSignedId, propertyId: propId, unitId: unit1Id, status: 'ACTIVE', startDate: '2027-01-01', endDate: '2027-12-31', rentAmount: '1100000', currency: 'IQD' },
  ]);

  await db.insert(leaseTenants).values([
    { id: `${PREFIX}_lt1`, leaseId: lease1Id, tenantId: tenantAId, isPrimary: true },
    { id: `${PREFIX}_lt2`, leaseId: lease2Id, tenantId: tenantBId, isPrimary: true },
    { id: `${PREFIX}_lt3`, leaseId: leaseTermId, tenantId: tenantTermId, isPrimary: true },
    { id: `${PREFIX}_lt4`, leaseId: leaseSignedId, tenantId: tenantSignedId, isPrimary: true },
    { id: `${PREFIX}_lt5`, leaseId: leaseTermId, tenantId: tenantSignedId, isPrimary: false },
  ]);

  // Insert diverse document classifications
  await db.insert(documents).values([
    { id: docTapuId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Land Registry TAPU', documentType: 'TAPU', fileUrl: keyTapu, verificationState: 'VERIFIED' },
    { id: docDeedId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Ownership DEED', documentType: 'DEED', fileUrl: keyDeed, verificationState: 'VERIFIED' },
    { id: docIdTenantBId, propertyId: propId, ownerId: null, uploaderUserId: tenantBId, title: 'Tenant B Passport', documentType: 'ID', fileUrl: keyIdTenantB, verificationState: 'VERIFIED' },
    { id: docLeaseBId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Tenant B Lease Contract', documentType: 'LEASE_CONTRACT', fileUrl: keyLeaseB, metadata: { leaseId: lease2Id, unitId: unit2Id, tenantId: tenantBId }, verificationState: 'VERIFIED' },
    { id: docLeaseAId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Tenant A Lease Contract', documentType: 'LEASE_CONTRACT', fileUrl: keyLeaseA, metadata: { leaseId: lease1Id, unitId: unit1Id, tenantId: tenantAId }, verificationState: 'VERIFIED' },
    { id: docInspectUnit2Id, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Unit 102 Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyInspectUnit2, metadata: { leaseId: lease2Id, unitId: unit2Id }, verificationState: 'VERIFIED' },
    { id: docInspectUnit1Id, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Unit 101 Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyInspectUnit1, metadata: { leaseId: lease1Id, unitId: unit1Id }, verificationState: 'VERIFIED' },
    { id: docRulesId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Building Quiet Hours Rules', documentType: 'BUILDING_RULES', fileUrl: keyRules, verificationState: 'VERIFIED' },
    { id: docUnknownId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Internal Strategy Memo', documentType: 'OTHER', fileUrl: keyUnknown, verificationState: 'VERIFIED' },
    { id: docIdSelfId, propertyId: propId, ownerId: null, uploaderUserId: tenantAId, title: 'Tenant A Self Uploaded ID', documentType: 'ID_DOCUMENT', fileUrl: keyIdSelf, verificationState: 'VERIFIED' },
    { id: docTenantTapuId, propertyId: propId, ownerId: null, uploaderUserId: tenantAId, title: 'Tenant Claimed TAPU', documentType: 'TAPU', fileUrl: keyTenantTapu, verificationState: 'VERIFIED' },
    { id: docTenantDeedId, propertyId: propId, ownerId: null, uploaderUserId: tenantAId, title: 'Tenant Claimed DEED', documentType: 'DEED', fileUrl: keyTenantDeed, verificationState: 'VERIFIED' },
    { id: docPriorLeaseUnit1Id, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Prior Tenant Unit 101 Lease Contract', documentType: 'LEASE_CONTRACT', fileUrl: keyPriorLeaseUnit1, metadata: { leaseId: leaseTermId, unitId: unit1Id, tenantId: tenantTermId }, verificationState: 'VERIFIED' },
    { id: docInspectEmptyId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Unscoped Inspection Report', documentType: 'INSPECTION_REPORT', fileUrl: keyInspectEmpty, metadata: {}, verificationState: 'VERIFIED' },
    { id: docInspectPropWideId, propertyId: propId, ownerId: ownerId, uploaderUserId: ownerId, title: 'Property-Wide Roof Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyInspectPropWide, metadata: { isPropertyWide: true }, verificationState: 'VERIFIED' },
  ]);

  try {
    // =========================================================================
    // POSITIVE TESTS: Dashboard Listing
    // =========================================================================
    await t.test('1. Authorized tenant can see permitted resident rules in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const rulesDoc = dashboard.documents.find(d => d.id === docRulesId);
      assert.ok(rulesDoc, 'Resident rules document must be visible to tenant');
      assert.strictEqual(rulesDoc.category, 'RULES', 'Resident rules must be categorized as RULES');
    });

    await t.test('2. Authorized tenant can see inspection report associated with their occupied unit', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const inspectDoc = dashboard.documents.find(d => d.id === docInspectUnit1Id);
      assert.ok(inspectDoc, 'Unit 101 inspection report must be visible to Tenant A');
      assert.strictEqual(inspectDoc.category, 'INSPECTION', 'Inspection report must be categorized as INSPECTION');
    });

    await t.test('3. Authorized tenant can see lease document associated with their lease', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const leaseDoc = dashboard.documents.find(d => d.id === docLeaseAId);
      assert.ok(leaseDoc, 'Tenant A lease document must be visible to Tenant A');
      assert.strictEqual(leaseDoc.category, 'LEASE', 'Lease document must be categorized as LEASE');
    });

    await t.test('4. Authorized tenant can see their own uploaded identity document', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const selfIdDoc = dashboard.documents.find(d => d.id === docIdSelfId);
      assert.ok(selfIdDoc, 'Self-uploaded ID document must be visible to Tenant A');
    });

    // =========================================================================
    // NEGATIVE TESTS: Dashboard Listing
    // =========================================================================
    await t.test('5. Tenant CANNOT see owner TAPU/DEED in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const tapuDoc = dashboard.documents.find(d => d.id === docTapuId);
      const deedDoc = dashboard.documents.find(d => d.id === docDeedId);
      assert.strictEqual(tapuDoc, undefined, 'Owner TAPU must strictly be excluded from tenant dashboard');
      assert.strictEqual(deedDoc, undefined, 'Owner DEED must strictly be excluded from tenant dashboard');
    });

    await t.test('6. Tenant CANNOT see another tenant identity document in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const tenantBIdDoc = dashboard.documents.find(d => d.id === docIdTenantBId);
      assert.strictEqual(tenantBIdDoc, undefined, 'Tenant B identity document must strictly be excluded from Tenant A');
    });

    await t.test('7. Tenant CANNOT see another tenant lease document in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const tenantBLeaseDoc = dashboard.documents.find(d => d.id === docLeaseBId);
      assert.strictEqual(tenantBLeaseDoc, undefined, 'Tenant B lease contract must strictly be excluded from Tenant A');
    });

    await t.test('8. Tenant CANNOT see another unit inspection report in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const unit2InspectDoc = dashboard.documents.find(d => d.id === docInspectUnit2Id);
      assert.strictEqual(unit2InspectDoc, undefined, 'Unit 102 inspection report must strictly be excluded from Tenant A');
    });

    await t.test('9. Unknown/unclassified document types are excluded from dashboard by default', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const memoDoc = dashboard.documents.find(d => d.id === docUnknownId);
      assert.strictEqual(memoDoc, undefined, 'Unknown/unclassified document types must fail closed and be excluded');
    });

    await t.test('10. Terminated lease tenant cannot view property documents in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantTermId);
      assert.strictEqual(dashboard.documents.length, 0, 'Tenant with terminated lease must receive empty document vault');
    });

    // =========================================================================
    // POSITIVE & NEGATIVE TESTS: Presigned Download Authorization
    // =========================================================================
    await t.test('11. Authorized tenant can generate presigned download URL for permitted rules', async () => {
      const res = await storageService.generatePresignedDownloadUrl({
        documentKey: keyRules,
        requestingUserId: tenantAId,
        userRole: 'TENANT',
      });
      assert.ok(res.downloadUrl.includes('sig='), 'Download URL must be issued for building rules');
    });

    await t.test('12. Authorized tenant can generate presigned download URL for own lease document', async () => {
      const res = await storageService.generatePresignedDownloadUrl({
        documentKey: keyLeaseA,
        requestingUserId: tenantAId,
        userRole: 'TENANT',
      });
      assert.ok(res.downloadUrl.includes('sig='), 'Download URL must be issued for own lease contract');
    });

    await t.test('13. Tenant CANNOT generate presigned download URL for owner TAPU/DEED', async () => {
      let tapuDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyTapu,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        tapuDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(tapuDenied, 'Tenant request for owner TAPU must be rejected with 403 FORBIDDEN');

      let deedDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyDeed,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        deedDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(deedDenied, 'Tenant request for owner DEED must be rejected with 403 FORBIDDEN');
    });

    await t.test('14. Tenant CANNOT generate presigned download URL for another tenant ID', async () => {
      let idDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyIdTenantB,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        idDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(idDenied, 'Tenant request for another tenant ID must be rejected with 403 FORBIDDEN');
    });

    await t.test('15. Tenant CANNOT generate presigned download URL for another tenant lease contract', async () => {
      let foreignLeaseDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyLeaseB,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        foreignLeaseDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(foreignLeaseDenied, 'Tenant request for foreign lease contract on same property must be rejected');
    });

    await t.test('16. Tenant CANNOT download document associated with different unit', async () => {
      let foreignUnitInspectDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyInspectUnit2,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        foreignUnitInspectDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(foreignUnitInspectDenied, 'Tenant request for other unit inspection report must be rejected');
    });

    await t.test('17. Unknown/private document key is rejected with 403', async () => {
      let unknownDocDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyUnknown,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        unknownDocDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(unknownDocDenied, 'Tenant request for internal/unknown document must be rejected');
    });

    await t.test('18. Non-existent or forged document key is rejected with 403', async () => {
      let forgedDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyForged,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        forgedDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(forgedDenied, 'Forged document key must be rejected with 403 FORBIDDEN');
    });

    await t.test('19. Terminated-lease tenant CANNOT download property documents', async () => {
      let termDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyRules,
          requestingUserId: tenantTermId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        termDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(termDenied, 'Tenant with terminated lease must be denied download access');
    });

    // =========================================================================
    // OWNER PERMISSION PRESERVATION TESTS
    // =========================================================================
    await t.test('20. Existing owner document download permissions remain intact', async () => {
      // Owner can download their own TAPU
      const tapuRes = await storageService.generatePresignedDownloadUrl({
        documentKey: keyTapu,
        requestingUserId: ownerId,
        userRole: 'PROPERTY_OWNER',
      });
      assert.ok(tapuRes.downloadUrl.includes('sig='), 'Owner must be able to download their own TAPU');

      // Owner can download their own DEED
      const deedRes = await storageService.generatePresignedDownloadUrl({
        documentKey: keyDeed,
        requestingUserId: ownerId,
        userRole: 'PROPERTY_OWNER',
      });
      assert.ok(deedRes.downloadUrl.includes('sig='), 'Owner must be able to download their own DEED');
    });

    await t.test('21. Existing owner scoped documents query remains intact', async () => {
      const ownerDocs = await ownerRepository.getScopedDocuments(
        { id: ownerId, roles: ['PROPERTY_OWNER'] },
        propId
      );
      assert.ok(ownerDocs.length >= 8, 'Owner must have full scoped document access for their property');
    });

    // =========================================================================
    // NEW REGRESSION TESTS: EDGE CASES AND FAIL-CLOSED HARDENING
    // =========================================================================
    await t.test('22. Tenant uploader CANNOT access forbidden TAPU/DEED in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const tenantTapu = dashboard.documents.find(d => d.id === docTenantTapuId);
      const tenantDeed = dashboard.documents.find(d => d.id === docTenantDeedId);
      assert.strictEqual(tenantTapu, undefined, 'Tenant uploader must NOT be able to view TAPU in dashboard');
      assert.strictEqual(tenantDeed, undefined, 'Tenant uploader must NOT be able to view DEED in dashboard');
    });

    await t.test('23. Tenant uploader CANNOT generate presigned download URL for forbidden TAPU/DEED', async () => {
      let tapuDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyTenantTapu,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        tapuDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(tapuDenied, 'Tenant uploader request for TAPU must be rejected with 403 FORBIDDEN');

      let deedDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyTenantDeed,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        deedDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(deedDenied, 'Tenant uploader request for DEED must be rejected with 403 FORBIDDEN');
    });

    await t.test('24. Current tenant CANNOT see prior tenant lease contract for the same unit in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const priorLeaseDoc = dashboard.documents.find(d => d.id === docPriorLeaseUnit1Id);
      assert.strictEqual(priorLeaseDoc, undefined, 'Current tenant must NOT see prior tenant lease contract for same unit');
    });

    await t.test('25. Current tenant CANNOT generate presigned download URL for prior tenant lease contract in same unit', async () => {
      let priorLeaseDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyPriorLeaseUnit1,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        priorLeaseDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(priorLeaseDenied, 'Current tenant request for prior tenant lease contract in same unit must be rejected with 403 FORBIDDEN');
    });

    await t.test('26. Database authorization query exception strictly denies access and produces no signed URL', async () => {
      const originalFindFirst = db.query.users.findFirst;
      try {
        // Inject database exception during authorization query
        (db.query.users as any).findFirst = async () => {
          throw new Error('SIMULATED_DB_CONNECTION_FAILURE');
        };

        let errorThrown = false;
        let issuedUrl: any = null;
        try {
          issuedUrl = await storageService.generatePresignedDownloadUrl({
            documentKey: keyRules,
            requestingUserId: tenantAId,
            userRole: 'TENANT',
          });
        } catch (err: any) {
          errorThrown = err.message.includes('403') || err.message.includes('FORBIDDEN');
        }

        assert.ok(errorThrown, 'Database query exception must strictly fail closed and reject download');
        assert.strictEqual(issuedUrl, null, 'No presigned download URL must ever be issued on database error');
      } finally {
        // Restore original DB query method
        (db.query.users as any).findFirst = originalFindFirst;
      }
    });

    await t.test('27. Tenant with upcoming SIGNED lease and prior TERMINATED lease can see property documents in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantSignedId);
      const rulesDoc = dashboard.documents.find(d => d.id === docRulesId);
      assert.ok(rulesDoc, 'Tenant with SIGNED lease must see permitted resident rules despite having older TERMINATED lease');
    });

    await t.test('28. Tenant CANNOT see inspection report with empty metadata in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const emptyDoc = dashboard.documents.find(d => d.id === docInspectEmptyId);
      assert.strictEqual(emptyDoc, undefined, 'Unscoped inspection report with empty metadata must fail closed and be excluded from dashboard');
    });

    await t.test('29. Tenant CANNOT generate presigned download URL for inspection report with empty metadata', async () => {
      let emptyDenied = false;
      try {
        await storageService.generatePresignedDownloadUrl({
          documentKey: keyInspectEmpty,
          requestingUserId: tenantAId,
          userRole: 'TENANT',
        });
      } catch (err: any) {
        emptyDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
      }
      assert.ok(emptyDenied, 'Tenant request for empty metadata inspection report must be rejected with 403 FORBIDDEN');
    });

    await t.test('30. Tenant CAN see explicitly classified property-wide inspection report in dashboard', async () => {
      const dashboard = await tenantRepo.getAuthoritativeDashboard(tenantAId);
      const propWideDoc = dashboard.documents.find(d => d.id === docInspectPropWideId);
      assert.ok(propWideDoc, 'Explicitly classified property-wide inspection report must be visible in tenant dashboard');
    });

    await t.test('31. Tenant CAN generate presigned download URL for explicitly classified property-wide inspection', async () => {
      const res = await storageService.generatePresignedDownloadUrl({
        documentKey: keyInspectPropWide,
        requestingUserId: tenantAId,
        userRole: 'TENANT',
      });
      assert.ok(res.downloadUrl.includes('sig='), 'Download URL must be issued for property-wide inspection');
    });

  } finally {
    // Teardown Fixtures
    await db.delete(documents).where(inArray(documents.id, [
      docTapuId, docDeedId, docIdTenantBId, docLeaseBId, docLeaseAId,
      docInspectUnit2Id, docInspectUnit1Id, docRulesId, docUnknownId, docIdSelfId,
      docTenantTapuId, docTenantDeedId, docPriorLeaseUnit1Id,
      docInspectEmptyId, docInspectPropWideId
    ])).catch(() => {});
    await db.delete(leaseTenants).where(inArray(leaseTenants.tenantId, [tenantAId, tenantBId, tenantTermId, tenantSignedId])).catch(() => {});
    await db.delete(leases).where(inArray(leases.id, [lease1Id, lease2Id, leaseTermId, leaseSignedId])).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(units).where(inArray(units.id, [unit1Id, unit2Id])).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerId, tenantAId, tenantBId, tenantTermId, tenantSignedId])).catch(() => {});
  }
});

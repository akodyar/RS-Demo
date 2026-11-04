import test from 'node:test';
import assert from 'node:assert';
import { 
  isDocumentVisibleToTenant, 
  TenantLeaseContext, 
  storageService 
} from '../src/server/services/storage-service.js';
import { injectPgliteMock } from './setup-pglite.js';
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
  organizationMembers,
  managementAgreements
} from '../src/db/schema.js';
import { TenantRepository } from '../src/server/repositories/tenant.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

test('Tenant Inspection Visibility & Metadata Scoping Boundary Suite', async (t) => {

  // =========================================================================
  // SECTION 1: Pure Unit Policy Matrix for isDocumentVisibleToTenant()
  // =========================================================================
  const propId = 'prop_test_inspect';
  const tenantAId = 'usr_tenant_a';
  const tenantBId = 'usr_tenant_b';
  const ownerId = 'usr_owner_main';

  const leaseUnit1: TenantLeaseContext = {
    propertyId: propId,
    unitId: 'unit_101',
    leaseId: 'lease_unit_101_active',
  };

  const leaseWholeProperty: TenantLeaseContext = {
    propertyId: propId,
    unitId: null,
    leaseId: 'lease_whole_prop_active',
  };

  await t.test('1. Empty metadata {} fails closed for tenant access', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: {},
    };
    const visible = isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1);
    assert.strictEqual(visible, false, 'Inspection with empty metadata must fail closed');
  });

  await t.test('2. Missing/null metadata fails closed for tenant access', () => {
    const docNull = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION',
      metadata: null,
    };
    assert.strictEqual(isDocumentVisibleToTenant(docNull, tenantAId, leaseUnit1), false, 'Null metadata must fail closed');

    const docUndefined = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
    };
    assert.strictEqual(isDocumentVisibleToTenant(docUndefined, tenantAId, leaseUnit1), false, 'Undefined metadata must fail closed');
  });

  await t.test('3. Malformed or insufficient metadata without link fails closed', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { fileType: 'PDF', sizeBytes: 1048576, titleNote: 'General inspection report' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), false, 'Metadata without unit/lease/tenant/property-wide link must fail closed');
  });

  await t.test('4. Unit 1 tenant cannot access Unit 2 inspection', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_102' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), false, 'Tenant in unit_101 must not see unit_102 inspection');
  });

  await t.test('5. Tenant with whole-property lease (unitId: null) cannot access unit-specific inspection', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_102' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseWholeProperty), false, 'Tenant with null unitId cannot access unit-specific inspection');
  });

  await t.test('6. Unit 1 tenant CAN access matching Unit 1 inspection', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_101' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), true, 'Tenant in unit_101 must see unit_101 inspection');
  });

  await t.test('7. Tenant CAN access inspection positively linked to their active leaseId', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { leaseId: 'lease_unit_101_active' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), true, 'Tenant must see inspection tied to their lease');
  });

  await t.test('8. Current tenant CANNOT access prior lease inspection for same unit', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_101', leaseId: 'lease_prior_terminated' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), false, 'Prior lease inspection for same unit must be denied to current tenant');
  });

  await t.test('9. Tenant A CANNOT access inspection tagged with Tenant B ID', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_101', tenantId: tenantBId },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), false, 'Inspection tagged with foreign tenantId must be denied');
  });

  await t.test('10. Tenant A CAN access inspection tagged with Tenant A ID', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { tenantId: tenantAId },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), true, 'Inspection tagged with requesting tenantId must be authorized');
  });

  await t.test('11. Explicitly classified property-wide inspection is authorized for eligible property resident', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { isPropertyWide: true },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), true, 'Trusted property-wide inspection must be visible to resident');
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseWholeProperty), true, 'Trusted property-wide inspection must be visible to whole-property tenant');
  });

  await t.test('12. Property-wide flag cannot override foreign unit conflict', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { isPropertyWide: true, unitId: 'unit_102' },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), false, 'Property-wide flag with foreign unitId must be denied to Unit 1 tenant');
  });

  await t.test('13. False or non-boolean property-wide flag fails closed', () => {
    const docFalse = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { isPropertyWide: false },
    };
    assert.strictEqual(isDocumentVisibleToTenant(docFalse, tenantAId, leaseUnit1), false, 'isPropertyWide: false must fail closed');

    const docString = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { isPropertyWide: 'true' as any },
    };
    assert.strictEqual(isDocumentVisibleToTenant(docString, tenantAId, leaseUnit1), false, 'Non-boolean isPropertyWide must fail closed');
  });

  await t.test('14. Tenant on different property is denied access regardless of metadata', () => {
    const leaseOtherProp: TenantLeaseContext = {
      propertyId: 'prop_other_unrelated',
      unitId: 'unit_101',
      leaseId: 'lease_other',
    };
    const doc = {
      propertyId: propId,
      uploaderUserId: ownerId,
      documentType: 'INSPECTION_REPORT',
      metadata: { unitId: 'unit_101', isPropertyWide: true },
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseOtherProp), false, 'Tenant on another property must be denied');
  });

  await t.test('15. Tenant self-uploaded inspection is authorized under tenant-uploaded documents rule', () => {
    const doc = {
      propertyId: propId,
      uploaderUserId: tenantAId,
      documentType: 'INSPECTION_REPORT',
      metadata: {},
    };
    assert.strictEqual(isDocumentVisibleToTenant(doc, tenantAId, leaseUnit1), true, 'Self-uploaded inspection report must remain accessible to uploader tenant');
  });

  // =========================================================================
  // SECTION 2: End-to-End Database & Storage Service Integration
  // =========================================================================
  await injectPgliteMock();
  const tenantRepo = new TenantRepository();

  const mockPropId = 'prop_integ_01';
  const mockUnit1Id = 'unit_integ_101';
  const mockUnit2Id = 'unit_integ_102';
  const mockTenantAId = 'usr_integ_tenant_a';
  const mockTenantWholeId = 'usr_integ_tenant_whole';
  const mockOwnerId = 'usr_integ_owner';
  const mockCompanyId = 'org_integ_mgmt';
  const mockCompanyMemberId = 'usr_integ_agent';

  const mockLease1Id = 'lease_integ_101';
  const mockLeaseWholeId = 'lease_integ_whole';

  // Seed DB records
  await db.insert(users).values([
    { id: mockOwnerId, firstName: 'Owner', lastName: 'Integ', email: 'owner@integ.test', roles: ['PROPERTY_OWNER'] },
    { id: mockTenantAId, firstName: 'TenantA', lastName: 'Integ', email: 'tenantA@integ.test', roles: ['TENANT'] },
    { id: mockTenantWholeId, firstName: 'TenantWhole', lastName: 'Integ', email: 'tenantWhole@integ.test', roles: ['TENANT'] },
    { id: mockCompanyMemberId, firstName: 'Agent', lastName: 'Integ', email: 'agent@integ.test', roles: ['COMPANY_MEMBER'] },
  ]);

  await db.insert(organizations).values({
    id: mockCompanyId,
    name: 'Integ Property Management',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  });

  await db.insert(organizationMembers).values({
    id: 'mem_integ_01',
    organizationId: mockCompanyId,
    userId: mockCompanyMemberId,
    role: 'PROPERTY_MANAGER',
    status: 'ACTIVE',
  });

  await db.insert(properties).values({
    id: mockPropId,
    name: 'Inspection Security Manor',
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    address: '100 Security Way',
  });

  await db.insert(units).values([
    { id: mockUnit1Id, propertyId: mockPropId, unitNumber: '101', status: 'OCCUPIED' },
    { id: mockUnit2Id, propertyId: mockPropId, unitNumber: '102', status: 'OCCUPIED' },
  ]);

  await db.insert(ownershipRecords).values({
    propertyId: mockPropId,
    ownerId: mockOwnerId,
    ownershipPercentage: '100',
    status: 'VERIFIED',
  });

  await db.insert(managementAgreements).values({
    propertyId: mockPropId,
    companyId: mockCompanyId,
    ownerId: mockOwnerId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });

  // Leases: Tenant A in Unit 101, Tenant Whole on whole property (unitId: null)
  await db.insert(leases).values([
    { id: mockLease1Id, propertyId: mockPropId, unitId: mockUnit1Id, status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1000000', currency: 'IQD' },
    { id: mockLeaseWholeId, propertyId: mockPropId, unitId: null, status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '2000000', currency: 'IQD' },
  ]);

  await db.insert(leaseTenants).values([
    { id: 'lt_integ_1', leaseId: mockLease1Id, tenantId: mockTenantAId, isPrimary: true },
    { id: 'lt_integ_2', leaseId: mockLeaseWholeId, tenantId: mockTenantWholeId, isPrimary: true },
  ]);

  // Insert test inspection documents
  const keyEmptyMeta = 'tenants/integ_org/inspections/doc_empty_meta.pdf';
  const keyUnit101 = 'tenants/integ_org/inspections/doc_unit_101.pdf';
  const keyUnit102 = 'tenants/integ_org/inspections/doc_unit_102.pdf';
  const keyPropWide = 'tenants/integ_org/inspections/doc_prop_wide.pdf';

  await db.insert(documents).values([
    { id: 'doc_empty_meta', propertyId: mockPropId, ownerId: mockOwnerId, uploaderUserId: mockOwnerId, title: 'Unscoped Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyEmptyMeta, metadata: {}, verificationState: 'VERIFIED' },
    { id: 'doc_unit_101', propertyId: mockPropId, ownerId: mockOwnerId, uploaderUserId: mockOwnerId, title: 'Unit 101 Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyUnit101, metadata: { unitId: mockUnit1Id, leaseId: mockLease1Id }, verificationState: 'VERIFIED' },
    { id: 'doc_unit_102', propertyId: mockPropId, ownerId: mockOwnerId, uploaderUserId: mockOwnerId, title: 'Unit 102 Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyUnit102, metadata: { unitId: mockUnit2Id }, verificationState: 'VERIFIED' },
    { id: 'doc_prop_wide', propertyId: mockPropId, ownerId: mockOwnerId, uploaderUserId: mockOwnerId, title: 'Building Roof Inspection', documentType: 'INSPECTION_REPORT', fileUrl: keyPropWide, metadata: { isPropertyWide: true }, verificationState: 'VERIFIED' },
  ]);

  // TEST 16: Dashboard visibility respects affirmative inspection scoping
  await t.test('16. Dashboard visibility enforces affirmative inspection scoping', async () => {
    const dashboardA = await tenantRepo.getAuthoritativeDashboard(mockTenantAId);
    const docIdsA = dashboardA.documents.map(d => d.id);

    assert.ok(docIdsA.includes('doc_unit_101'), 'Tenant A must see their Unit 101 inspection');
    assert.ok(docIdsA.includes('doc_prop_wide'), 'Tenant A must see the property-wide inspection');
    assert.strictEqual(docIdsA.includes('doc_empty_meta'), false, 'Tenant A must NOT see inspection with empty metadata');
    assert.strictEqual(docIdsA.includes('doc_unit_102'), false, 'Tenant A must NOT see Unit 102 inspection');

    const dashboardWhole = await tenantRepo.getAuthoritativeDashboard(mockTenantWholeId);
    const docIdsWhole = dashboardWhole.documents.map(d => d.id);
    assert.ok(docIdsWhole.includes('doc_prop_wide'), 'Whole-property tenant must see property-wide inspection');
    assert.strictEqual(docIdsWhole.includes('doc_empty_meta'), false, 'Whole-property tenant must NOT see empty metadata inspection');
    assert.strictEqual(docIdsWhole.includes('doc_unit_101'), false, 'Whole-property tenant must NOT see unit-specific Unit 101 inspection');
    assert.strictEqual(docIdsWhole.includes('doc_unit_102'), false, 'Whole-property tenant must NOT see unit-specific Unit 102 inspection');
  });

  // TEST 17: Presigned download authorization enforces same policy
  await t.test('17. Presigned download authorization enforces identical policy as dashboard', async () => {
    // Permitted: Tenant A -> Unit 101 inspection
    const downloadA101 = await storageService.generatePresignedDownloadUrl({
      documentKey: keyUnit101,
      requestingUserId: mockTenantAId,
      userRole: 'TENANT',
    });
    assert.ok(downloadA101.downloadUrl.includes('sig='), 'Tenant A can download Unit 101 inspection');

    // Permitted: Tenant A -> Property-wide inspection
    const downloadAPropWide = await storageService.generatePresignedDownloadUrl({
      documentKey: keyPropWide,
      requestingUserId: mockTenantAId,
      userRole: 'TENANT',
    });
    assert.ok(downloadAPropWide.downloadUrl.includes('sig='), 'Tenant A can download property-wide inspection');

    // Denied: Tenant A -> Empty metadata inspection
    let emptyMetaDenied = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: keyEmptyMeta,
        requestingUserId: mockTenantAId,
        userRole: 'TENANT',
      });
    } catch (err: any) {
      emptyMetaDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
    }
    assert.ok(emptyMetaDenied, 'Tenant A must be denied downloading empty metadata inspection');

    // Denied: Tenant A -> Unit 102 inspection
    let unit102Denied = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: keyUnit102,
        requestingUserId: mockTenantAId,
        userRole: 'TENANT',
      });
    } catch (err: any) {
      unit102Denied = err.message.includes('403') || err.message.includes('FORBIDDEN');
    }
    assert.ok(unit102Denied, 'Tenant A must be denied downloading Unit 102 inspection');

    // Denied: Whole-property tenant -> Unit 101 inspection
    let wholeUnitDenied = false;
    try {
      await storageService.generatePresignedDownloadUrl({
        documentKey: keyUnit101,
        requestingUserId: mockTenantWholeId,
        userRole: 'TENANT',
      });
    } catch (err: any) {
      wholeUnitDenied = err.message.includes('403') || err.message.includes('FORBIDDEN');
    }
    assert.ok(wholeUnitDenied, 'Whole-property tenant must be denied downloading unit-specific inspection');
  });

  // TEST 18: Owner and Management Company access preserved
  await t.test('18. Owner and Authorized Management Company access is preserved', async () => {
    // Owner can access all inspection documents including unscoped and other units
    const ownerDownloadEmpty = await storageService.generatePresignedDownloadUrl({
      documentKey: keyEmptyMeta,
      requestingUserId: mockOwnerId,
      userRole: 'PROPERTY_OWNER',
    });
    assert.ok(ownerDownloadEmpty.downloadUrl.includes('sig='), 'Owner can download unscoped inspection');

    const ownerDownloadUnit102 = await storageService.generatePresignedDownloadUrl({
      documentKey: keyUnit102,
      requestingUserId: mockOwnerId,
      userRole: 'PROPERTY_OWNER',
    });
    assert.ok(ownerDownloadUnit102.downloadUrl.includes('sig='), 'Owner can download Unit 102 inspection');

    // Owner scoped documents query includes all property documents
    const ownerDocs = await ownerRepository.getScopedDocuments(
      { id: mockOwnerId, roles: ['PROPERTY_OWNER'] },
      mockPropId
    );
    assert.strictEqual(ownerDocs.length, 4, 'Owner must receive all 4 documents in scoped query');

    // Management company member can download inspection documents
    const mgmtDownload = await storageService.generatePresignedDownloadUrl({
      documentKey: keyUnit101,
      requestingUserId: mockCompanyMemberId,
      userRole: 'COMPANY_MEMBER',
      organizationId: mockCompanyId,
    });
    assert.ok(mgmtDownload.downloadUrl.includes('sig='), 'Managing company member can download inspection document');
  });

});

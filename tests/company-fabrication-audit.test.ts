import test from 'node:test';
import assert from 'node:assert';
import { companyRepository } from '../src/server/repositories/company.js';

test('Company Profile Fabrication Audit', async (t) => {
  await t.test('Dashboard fails truthfully when organization profile is missing instead of fabricating data', async () => {
    const fakeCompanyId = 'org-missing-123';
    const userId = 'usr-company-audit-1';

    // Mock getCompanyMembership to simulate an active member for a missing company
    const originalGetCompanyMembership = companyRepository.getCompanyMembership.bind(companyRepository);
    companyRepository.getCompanyMembership = async () => ({ 
      id: 'mock-mem',
      userId,
      organizationId: fakeCompanyId,
      role: 'COMPANY_MEMBER',
      status: 'ACTIVE'
    } as any);

    try {
      await companyRepository.getAuthoritativeDashboard({
        id: userId,
        organizationId: fakeCompanyId,
        roles: ['COMPANY_MEMBER']
      });
      assert.fail('Should not silently return fabricated company data when profile is missing in the database');
    } catch (err: any) {
      assert.ok(
        err.message.includes('AUTHORITATIVE_DATA_MISSING') || err.message.includes('Company profile not found'),
        `Expected authoritative failure, got: ${err.message}`
      );
    } finally {
      // Restore original function
      companyRepository.getCompanyMembership = originalGetCompanyMembership;
    }
  });
});

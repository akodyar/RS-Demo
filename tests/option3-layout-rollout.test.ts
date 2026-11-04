import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Option 3 Global Workspace Rollout & Regression Suite', async (t) => {
  const rootDir = process.cwd();

  // 1. Structural Verification: Semantic Layout Components
  await t.test('Option 3 semantic components present in Company & Vendor', () => {
    const companyTopBarPath = path.join(rootDir, 'src', 'components', 'company', 'CompanyTopBar.tsx');
    const companyTopBar = fs.readFileSync(companyTopBarPath, 'utf-8');
    assert.match(
      companyTopBar,
      /<header data-testid="company-topbar"/,
      'CompanyTopBar.tsx must render semantic <header data-testid="company-topbar">'
    );

    const vendorHeaderPath = path.join(rootDir, 'src', 'components', 'vendor', 'VendorHeader.tsx');
    const vendorHeader = fs.readFileSync(vendorHeaderPath, 'utf-8');
    assert.match(
      vendorHeader,
      /<header data-testid="vendor-header"/,
      'VendorHeader.tsx must render semantic <header data-testid="vendor-header">'
    );

    const vendorWsPath = path.join(rootDir, 'src', 'pages', 'VendorWorkspace.tsx');
    const vendorWs = fs.readFileSync(vendorWsPath, 'utf-8');
    assert.match(
      vendorWs,
      /<div className="flex-1 flex flex-col min-w-0">\s*\{.*\}\s*<VendorHeader/s,
      'VendorWorkspace.tsx must place VendorHeader as top-level minimal header above main container'
    );
  });

  // 2. Modal Backdrop Pointer Interception Fixes
  await t.test('Company modals dismiss on backdrop clicks without blocking UI', () => {
    const modalsPath = path.join(rootDir, 'src', 'components', 'company', 'CompanyModals.tsx');
    const modalsContent = fs.readFileSync(modalsPath, 'utf-8');
    assert.match(
      modalsContent,
      /onClick=\{onClose\}/,
      'CompanyModals.tsx must attach backdrop onClick={onClose}'
    );
    assert.match(
      modalsContent,
      /e\.stopPropagation\(\)/,
      'CompanyModals.tsx modal containers must stop propagation to prevent premature dismissals'
    );
  });

  // 3. AdminCompaniesModule Null Safety & Crash Prevention
  await t.test('AdminCompaniesModule protects spending limit toLocaleString against null/undefined', () => {
    const adminCompaniesPath = path.join(rootDir, 'src', 'components', 'admin', 'modules', 'AdminCompaniesModule.tsx');
    const adminCompanies = fs.readFileSync(adminCompaniesPath, 'utf-8');
    assert.match(
      adminCompanies,
      /\(cmp\.spendingLimitIqd \?\? 0\)\.toLocaleString\(\)/,
      'AdminCompaniesModule must guard spendingLimitIqd with nullish coalescing'
    );
    assert.match(
      adminCompanies,
      /\(cmp\.approvalRequiredAboveIqd \?\? 0\)\.toLocaleString\(\)/,
      'AdminCompaniesModule must guard approvalRequiredAboveIqd with nullish coalescing'
    );
  });

  // 4. Option 3 Navigation Rail Test IDs in Workspaces
  await t.test('Workspace navigation rails feature standardized data-testid attributes', () => {
    const vendorSidebar = fs.readFileSync(path.join(rootDir, 'src', 'components', 'vendor', 'VendorSidebar.tsx'), 'utf-8');
    assert.match(vendorSidebar, /data-testid="vendor-tab-dashboard"/);
    assert.match(vendorSidebar, /data-testid="vendor-tab-work-orders"/);

    const maintWs = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'MaintenanceWorkspacePage.tsx'), 'utf-8');
    assert.match(maintWs, /data-testid="maint-tab-queue"/);

    const portfolioWs = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'PortfolioWorkspacePage.tsx'), 'utf-8');
    assert.match(portfolioWs, /data-testid="portfolio-tab-overview"/);

    const crmWs = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'CompanyCRMWorkspace.tsx'), 'utf-8');
    assert.match(crmWs, /data-testid="crm-tab-agreements"/);
    assert.match(crmWs, /data-testid="crm-tab-contacts"/);

    const platformAdminWs = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'PlatformAdminWorkspace.tsx'), 'utf-8');
    assert.match(platformAdminWs, /data-testid="admin-tab-users"/);
    assert.match(platformAdminWs, /data-testid="admin-tab-properties"/);
    assert.match(platformAdminWs, /data-testid="admin-tab-verification"/);
  });

  // 5. Audit Evidence Verification: 137 controls, 0 failures
  await t.test('Evidence index confirms 137 audited controls with 0 failures', () => {
    const indexPath = path.join(rootDir, 'screenshots', 'option-3-workspace-audit-2026-10-30', '00-index', 'screenshot-index.json');
    assert.ok(fs.existsSync(indexPath), 'screenshot-index.json must exist');
    const records = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    assert.strictEqual(records.length, 137, 'Exactly 137 controls must be recorded in audit');
    const failures = records.filter((r: any) => r.result !== 'PASS');
    assert.strictEqual(failures.length, 0, 'Zero failures must be present in the evidence index');
  });
});


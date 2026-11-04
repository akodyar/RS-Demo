import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Owner Dashboard UI Modernization & Secondary Sidebar Removal Regression Suite', async (t) => {
  const rootDir = process.cwd();

  // 1. Static Layout Verification: Secondary sidebar bypass on /workspace/owner
  await t.test('Layout.tsx bypasses secondary sidebar on /workspace/owner and /owner', () => {
    const layoutPath = path.join(rootDir, 'src', 'components', 'Layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Verify isOwnerWorkspace check is defined
    assert.match(
      layoutContent,
      /const isOwnerWorkspace = location\.pathname\.startsWith\('\/workspace\/owner'\) \|\| location\.pathname === '\/owner';/,
      'Layout.tsx must declare isOwnerWorkspace checking /workspace/owner and /owner'
    );

    // Verify isOwnerWorkspace is included in full-width bypass condition
    assert.match(
      layoutContent,
      /isOwnerWorkspace\s*\|\|\s*isVendorWorkspace/,
      'Layout.tsx must include isOwnerWorkspace in the full-width bypass condition'
    );

    // Verify public header is hidden for Owner Workspace
    assert.match(
      layoutContent,
      /\{!isOwnerWorkspace\s*&&\s*\(\s*<header/,
      'Layout.tsx must hide public marketplace header on /workspace/owner'
    );

    // Verify the aside element exists for other non-bypassed routes (not deleted)
    assert.match(
      layoutContent,
      /<aside className="w-full md:w-64 shrink-0">/,
      'Layout.tsx must preserve the secondary sidebar for other workspaces and pages'
    );
  });

  // 2. Owner Workspace Verification: Header, KPIs, Quick Actions, and Your Properties Table
  await t.test('OwnerWorkspace.tsx contains modernized visual reference components', () => {
    const ownerWsPath = path.join(rootDir, 'src', 'pages', 'OwnerWorkspace.tsx');
    const ownerContent = fs.readFileSync(ownerWsPath, 'utf-8');

    // A. Header Greeting & Dashboard Period Dropdown
    assert.match(
      ownerContent,
      /dashboardPeriod/,
      'OwnerWorkspace.tsx must support dashboardPeriod state'
    );

    // B. 4 KPI Cards Matching Visual Reference
    assert.match(
      ownerContent,
      /Total Properties/,
      'OwnerWorkspace.tsx must display Total Properties KPI'
    );
    assert.match(
      ownerContent,
      /Monthly Rental Income/,
      'OwnerWorkspace.tsx must display Monthly Rental Income KPI'
    );
    assert.match(
      ownerContent,
      /Pending Requests/,
      'OwnerWorkspace.tsx must display Pending Requests KPI'
    );
    assert.match(
      ownerContent,
      /Overdue Payments/,
      'OwnerWorkspace.tsx must display Overdue Payments KPI'
    );

    // C. 6 Dedicated Quick Action Cards
    assert.match(
      ownerContent,
      /My Properties/,
      'OwnerWorkspace.tsx must contain My Properties quick action'
    );
    assert.match(
      ownerContent,
      /Tenants/,
      'OwnerWorkspace.tsx must contain Tenants quick action'
    );
    assert.match(
      ownerContent,
      /Rent & Payments/,
      'OwnerWorkspace.tsx must contain Rent & Payments quick action'
    );
    assert.match(
      ownerContent,
      /Expenses/,
      'OwnerWorkspace.tsx must contain Expenses quick action'
    );
    assert.match(
      ownerContent,
      /Maintenance/,
      'OwnerWorkspace.tsx must contain Maintenance quick action'
    );
    assert.match(
      ownerContent,
      /Reports/,
      'OwnerWorkspace.tsx must contain Reports quick action'
    );

    // D. Add New Property primary action button
    assert.match(
      ownerContent,
      /navigate\('\/properties\/add'\)/,
      'OwnerWorkspace.tsx must provide navigation to /properties/add'
    );

    // E. "Your Properties" Structured Table Directly on Overview Dashboard
    assert.match(
      ownerContent,
      /Your Properties/,
      'OwnerWorkspace.tsx must display Your Properties section on overview'
    );
    assert.match(
      ownerContent,
      /<table className="w-full text-left rtl:text-right border-collapse">/,
      'OwnerWorkspace.tsx must render a structured table for properties'
    );
    assert.match(
      ownerContent,
      /PROPERTY/,
      'OwnerWorkspace.tsx must have PROPERTY column'
    );
    assert.match(
      ownerContent,
      /ADDRESS/,
      'OwnerWorkspace.tsx must have ADDRESS column'
    );
    assert.match(
      ownerContent,
      /STATUS/,
      'OwnerWorkspace.tsx must have STATUS column'
    );
    assert.match(
      ownerContent,
      /TENANTS/,
      'OwnerWorkspace.tsx must have TENANTS column'
    );
    assert.match(
      ownerContent,
      /MONTHLY RENT/,
      'OwnerWorkspace.tsx must have MONTHLY RENT column'
    );
    assert.match(
      ownerContent,
      /ACTIONS/,
      'OwnerWorkspace.tsx must have ACTIONS column'
    );

    // F. Preservation of Invariant 3-Fee Model Banner
    assert.match(
      ownerContent,
      /Three-Fee Architecture/,
      'OwnerWorkspace.tsx must preserve the Three-Fee Architecture banner'
    );
    assert.match(
      ownerContent,
      /DYNAMIC/,
      'OwnerWorkspace.tsx must retain dynamic fee policy indicators'
    );
  });

  // 3. Routing & Release Boundary Integrity in App.tsx
  await t.test('App.tsx preserves release boundaries and workspace guards', () => {
    const appPath = path.join(rootDir, 'src', 'App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    // /workspace/owner is protected by RequireAuth
    assert.match(
      appContent,
      /<Route path="workspace\/owner" element=\{<OwnerWorkspacePage \/>\} \/>/,
      'App.tsx must register workspace/owner under authenticated layout'
    );

    // /workspace/company redirects to / in active rental-only release
    assert.match(
      appContent,
      /<Route path="workspace\/company" element=\{<Navigate to="\/" replace \/>\} \/>/,
      'App.tsx must maintain rental-only boundary redirect for standalone company workspace'
    );

    // /workspace/buyer redirects to / in active rental-only release
    assert.match(
      appContent,
      /<Route path="workspace\/buyer" element=\{<Navigate to="\/" replace \/>\} \/>/,
      'App.tsx must maintain rental-only boundary redirect for buyer workspace'
    );
  });

  // 4. Localization Keys Verification
  await t.test('I18nProvider.tsx includes translation keys for all languages with no malformed suffixes', () => {
    const i18nPath = path.join(rootDir, 'src', 'i18n', 'I18nProvider.tsx');
    const i18nContent = fs.readFileSync(i18nPath, 'utf-8');

    const requiredKeys = [
      'owner.kpi.total_properties',
      'owner.kpi.monthly_revenue',
      'owner.kpi.open_maintenance',
      'owner.kpi.occupancy',
      'owner.kpi.overdue_payments',
      'owner.quick_actions',
      'owner.action.add_property',
      'owner.my_properties',
      'owner.action.manage_tenants',
      'owner.action.view_reports',
      'owner.action.settlements',
      'owner.accounting',
      'owner.nav.reports',
      'owner.occupied',
      'owner.vacant',
    ];

    for (const k of requiredKeys) {
      assert.ok(
        i18nContent.includes(k),
        `I18nProvider.tsx must contain translation key ${k}`
      );
    }

    // Verify no malformed empty parentheses in owner.action.view_reports or owner.nav.earnings
    assert.doesNotMatch(
      i18nContent,
      /'owner\.action\.view_reports':\s*['"][^'"]*\(\)['"]/,
      'owner.action.view_reports must not have empty parentheses () in any language'
    );
    assert.doesNotMatch(
      i18nContent,
      /'owner\.nav\.earnings':\s*['"][^'"]*\(\)['"]/,
      'owner.nav.earnings must not have empty parentheses () in any language'
    );

    // Verify Kurdish Sorani translations
    assert.match(
      i18nContent,
      /'owner\.accounting':\s*'ژمێریاری'/,
      'Kurdish locale must translate owner.accounting to ژمێریاری'
    );
    assert.match(
      i18nContent,
      /'owner\.action\.settlements':\s*'خەرجییەکان'/,
      'Kurdish locale must translate owner.action.settlements to خەرجییەکان'
    );
    assert.match(
      i18nContent,
      /'owner\.action\.view_reports':\s*'کرێ و پارەدان'/,
      'Kurdish locale must translate owner.action.view_reports to کرێ و پارەدان'
    );

    // Verify Arabic translations
    assert.match(
      i18nContent,
      /'owner\.accounting':\s*'المحاسبة'/,
      'Arabic locale must translate owner.accounting to المحاسبة'
    );
    assert.match(
      i18nContent,
      /'owner\.action\.settlements':\s*'المصاريف'/,
      'Arabic locale must translate owner.action.settlements to المصاريف'
    );
    assert.match(
      i18nContent,
      /'owner\.action\.view_reports':\s*'الإيجار والمدفوعات'/,
      'Arabic locale must translate owner.action.view_reports to الإيجار والمدفوعات'
    );
  });

  // 5. Verification of Zero Legacy ٩ڕەسمی Artifacts in Owner Workspace
  await t.test('OwnerWorkspace.tsx has zero legacy ٩ڕەسمی artifacts and localized select options', () => {
    const ownerWsPath = path.join(rootDir, 'src', 'pages', 'OwnerWorkspace.tsx');
    const ownerContent = fs.readFileSync(ownerWsPath, 'utf-8');

    assert.doesNotMatch(
      ownerContent,
      /٩ڕەسمی/,
      'OwnerWorkspace.tsx must have 0 occurrences of legacy ٩ڕەسمی'
    );

    // Verify localized duration options
    assert.match(
      ownerContent,
      /language === 'ku' \? '٣ مانگ' : language === 'ar' \? '٣ أشهر' : '3 Months'/,
      'OwnerWorkspace.tsx must localize the 3 months income chart option'
    );
    assert.match(
      ownerContent,
      /language === 'ku' \? '٦ مانگ' : language === 'ar' \? '٦ أشهر' : '6 Months'/,
      'OwnerWorkspace.tsx must localize the 6 months income chart option'
    );
  });
});

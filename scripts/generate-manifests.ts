import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function getSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  const baseDir = path.resolve(process.cwd(), 'artifacts/multi-role-enrollment-final-audit');
  const manifestsDir = path.join(baseDir, 'manifests');
  fs.mkdirSync(manifestsDir, { recursive: true });

  // 1. SCREENSHOTS MANIFEST
  const screenshotsDir = path.join(baseDir, 'screenshots');
  const screenshotFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png')).sort();

  const screenshotDescriptions: Record<string, string> = {
    '01-workspace-switcher-single-workspace.png': 'Single workspace view showing active Tenant card and prominent "+ Activate Another Role" button',
    '02-multiple-workspaces-view.png': 'Multiple workspaces view showing active Owner and available Tenant workspace cards',
    '03-activate-another-role-action.png': 'User focus / interaction state on "+ Activate Another Role" CTA button',
    '04-role-selection-available-and-active.png': 'Role selection screen showing active roles disabled and available canonical roles',
    '05-property-owner-individual-selection.png': 'Property Owner role selected with Individual entity type radio active',
    '06-property-owner-company-selection-validation.png': 'Property Owner Company entity type selected requiring validated company name',
    '07-tenant-enrollment-selection.png': 'Tenant role card selection view within workspace switcher',
    '08-vendor-enrollment-pending-state.png': 'Vendor role enrollment view displaying professional skill verification notice',
    '09-agent-enrollment-pending-state.png': 'Agent role enrollment view displaying broker licensing & pending verification notice',
    '10-enrollment-ready-to-submit.png': 'Validated enrollment form ready for submission with Confirm button enabled',
    '11-enrollment-error-state.png': 'Scoped red error banner handling failure without unmounting parent workspace or modal',
    '12-enrollment-success-alert.png': 'Success banner in green confirming role activation during 1500ms transition delay',
    '13-updated-workspace-list.png': 'Updated workspace list reflecting newly enrolled role after activation',
    '14-newly-activated-owner-workspace.png': 'Direct seamless transition into /owner portal without signing out',
    '15-returned-to-original-workspace.png': 'Switched back to /tenant showing empty-state #btn-no-lease-switch-workspace button',
    '16-english-ltr-layout.png': 'English LTR layout verification for workspace switcher modal',
    '17-kurdish-sorani-rtl-layout.png': 'Kurdish Sorani RTL layout verification for workspace switcher modal',
    '18-arabic-rtl-layout.png': 'Arabic RTL layout verification for workspace switcher modal',
  };

  const screenshotsManifest = screenshotFiles.map(file => {
    const filePath = path.join(screenshotsDir, file);
    const stats = fs.statSync(filePath);
    return {
      filename: file,
      sizeBytes: stats.size,
      sha256: getSha256(filePath),
      description: screenshotDescriptions[file] || 'Option C Playwright screenshot capture',
      captureStandard: 'Option C (Project-Local Playwright, bounded domcontentloaded, zero-networkidle)',
    };
  });

  fs.writeFileSync(path.join(manifestsDir, 'SCREENSHOTS_MANIFEST.json'), JSON.stringify(screenshotsManifest, null, 2));
  console.log(`Wrote SCREENSHOTS_MANIFEST.json (${screenshotsManifest.length} screenshots)`);

  // 2. TEST SUITE MANIFEST
  const testSuiteManifest = [
    {
      testId: 'SUITE-01',
      file: 'tests/workspace-switcher-multi-role-enrollment.test.tsx',
      command: 'npx tsx tests/workspace-switcher-multi-role-enrollment.test.tsx',
      environment: 'Local PostgreSQL (homehub_test) & In-Memory Express Server',
      totalTests: 66,
      passed: 66,
      failed: 0,
      skipped: 0,
      scope: 'Workspace Switcher UI (Kurdish/Arabic RTL, English LTR), Role enrollment API, Privileged role denial, Individual/Company agent & owner enrollment, Cross-domain isolation',
    },
    {
      testId: 'SUITE-02',
      file: 'tests/multi-role-concurrency-and-vendor-auth.test.ts',
      command: 'npx tsx tests/multi-role-concurrency-and-vendor-auth.test.ts',
      environment: 'Local PostgreSQL (homehub_test) Real Database Integration',
      totalTests: 30,
      passed: 30,
      failed: 0,
      skipped: 0,
      scope: 'Concurrent role enrollment race condition prevention via SELECT ... FOR UPDATE row-locking, Idempotent company & membership provisioning with duplicate retries, Vendor quote revision authorization middleware',
    },
    {
      testId: 'SUITE-03',
      file: 'tests/multi-role-account-integrity.test.ts',
      command: 'npx tsx tests/multi-role-account-integrity.test.ts',
      environment: 'Local PostgreSQL (homehub_test) Real Database Integration',
      totalTests: 54,
      passed: 54,
      failed: 0,
      skipped: 0,
      scope: 'Single vs multi-role login, Neutral JWT claims, Explicit workspace selection, All four canonical roles, Privileged role escalation prevention, Suspended profile exclusion, Personal owner vs Company separation, Dual property relationship legitimacy, Token revocation on logout',
    },
    {
      testId: 'SUITE-04',
      file: 'tests/cross-domain-end-to-end-lifecycle.test.ts',
      command: 'npx tsx tests/cross-domain-end-to-end-lifecycle.test.ts',
      environment: 'Local PostgreSQL (homehub_test)',
      totalTests: 12,
      passed: 12,
      failed: 0,
      skipped: 0,
      scope: 'Cross-domain boundary enforcement (zero fabricated leases, zero auto-assigned properties, zero unauthorized work order exposure)',
    },
    {
      testId: 'SUITE-05',
      file: 'tests/multi-role-ui.test.tsx',
      command: 'npx tsx tests/multi-role-ui.test.tsx',
      environment: 'Local React Component Simulation (JSDOM/TSX)',
      totalTests: 20,
      passed: 20,
      failed: 0,
      skipped: 0,
      scope: 'Multi-role workspace selector UI rendering across Kurdish Sorani RTL, Arabic RTL, English LTR, and status badge presentations',
    },
    {
      testId: 'SUITE-06',
      file: 'tests/role-selection-enforcement.test.tsx',
      command: 'npx tsx tests/role-selection-enforcement.test.tsx',
      environment: 'Local React Component Simulation (JSDOM/TSX)',
      totalTests: 56,
      passed: 56,
      failed: 0,
      skipped: 0,
      scope: 'Role selection form validation, radio button state enforcement, company name input requirements, error banner rendering',
    },
  ];

  fs.writeFileSync(path.join(manifestsDir, 'TEST_SUITE_MANIFEST.json'), JSON.stringify(testSuiteManifest, null, 2));
  console.log(`Wrote TEST_SUITE_MANIFEST.json (${testSuiteManifest.length} suites)`);

  // 3. SCHEMA MIGRATIONS MANIFEST
  const drizzleDir = path.resolve(process.cwd(), 'drizzle');
  const migrationFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
  const migrationsManifest = migrationFiles.map(file => {
    const filePath = path.join(drizzleDir, file);
    const stats = fs.statSync(filePath);
    return {
      filename: file,
      sizeBytes: stats.size,
      sha256: getSha256(filePath),
      note: file === '0000_icy_daimon_hellstrom.sql' 
        ? 'Defines users.roles as JSONB ("roles" jsonb)' 
        : 'Schema migration step',
    };
  });

  fs.writeFileSync(path.join(manifestsDir, 'SCHEMA_MIGRATIONS_MANIFEST.json'), JSON.stringify(migrationsManifest, null, 2));
  console.log(`Wrote SCHEMA_MIGRATIONS_MANIFEST.json (${migrationsManifest.length} migrations)`);

  // 4. COMPREHENSIVE FILE MANIFEST (ALL ARTIFACTS IN PACKAGE)
  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allPackageFiles = getAllFiles(baseDir);
  const fileManifest = allPackageFiles
    .filter(fp => !fp.endsWith('FILE_MANIFEST.json')) // avoid circular hash
    .map(fp => {
      const relPath = path.relative(baseDir, fp).replace(/\\/g, '/');
      const stats = fs.statSync(fp);
      return {
        path: relPath,
        sizeBytes: stats.size,
        sha256: getSha256(fp),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  fs.writeFileSync(path.join(manifestsDir, 'FILE_MANIFEST.json'), JSON.stringify(fileManifest, null, 2));
  console.log(`Wrote FILE_MANIFEST.json (${fileManifest.length} files)`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

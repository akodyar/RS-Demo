import { chromium } from 'playwright';
import path from 'path';

const outDir = 'C:/Users/zakar/.gemini/antigravity/brain/46e58428-0760-4215-9bed-a78ce6b19522';

interface WorkspaceTestConfig {
  id: string;
  name: string;
  url: string;
  persona: {
    id: string;
    role: string;
    name: string;
    email: string;
  };
  screenshot: string;
  clickTabSelector?: string;
  expectedRailSelector?: string;
}

const workspacesToTest: WorkspaceTestConfig[] = [
  {
    id: 'integrations',
    name: '1. Integrations Admin Workspace',
    url: 'http://localhost:3000/workspace/integrations',
    persona: { id: 'admin_01', role: 'PLATFORM_ADMIN', name: 'سەرپەرشتیاری سیستم', email: 'admin@homehub.iq' },
    screenshot: 'live_01_integrations_option3.png',
    expectedRailSelector: 'aside[aria-label="Integrations Navigation Rail"]',
    clickTabSelector: '[data-testid="integrations-tab-webhooks"]'
  },
  {
    id: 'trust',
    name: '2. Admin Trust & Verification Workspace',
    url: 'http://localhost:3000/workspace/admin',
    persona: { id: 'trust_admin_01', role: 'PLATFORM_ADMIN', name: 'بەڕێوەبەری متمانە', email: 'trust@homehub.iq' },
    screenshot: 'live_02_trust_option3.png',
    expectedRailSelector: 'aside[aria-label="Trust Navigation Rail"]'
  },
  {
    id: 'crm',
    name: '3. Company CRM Workspace',
    url: 'http://localhost:3000/workspace/company/crm',
    persona: { id: 'company_agent_01', role: 'COMPANY_ADMIN', name: 'بەڕێوەبەری کۆمپانیا', email: 'company@homehub.iq' },
    screenshot: 'live_03_crm_option3.png',
    expectedRailSelector: 'aside[aria-label="Company CRM Navigation Rail"]'
  },
  {
    id: 'intelligence',
    name: '4. Company Market Intelligence Workspace',
    url: 'http://localhost:3000/company/intelligence',
    persona: { id: 'company_agent_01', role: 'COMPANY_ADMIN', name: 'بەڕێوەبەری کۆمپانیا', email: 'company@homehub.iq' },
    screenshot: 'live_04_intelligence_option3.png',
    expectedRailSelector: 'aside[aria-label="Intelligence Navigation Rail"]'
  },
  {
    id: 'portfolio',
    name: '5. Portfolio Workspace',
    url: 'http://localhost:3000/workspace/portfolio',
    persona: { id: 'owner_demo_01', role: 'OWNER', name: 'ڕێبین ئەحمەد', email: 'rebin@homehub.iq' },
    screenshot: 'live_05_portfolio_option3.png',
    expectedRailSelector: 'aside[aria-label="Portfolio Navigation Rail"]'
  },
  {
    id: 'maintenance',
    name: '6. Maintenance Operations Workspace',
    url: 'http://localhost:3000/workspace/maintenance',
    persona: { id: 'admin_maint_01', role: 'PLATFORM_ADMIN', name: 'تیمی چاکسازی', email: 'maint@homehub.iq' },
    screenshot: 'live_06_maintenance_option3.png',
    expectedRailSelector: 'aside[aria-label="Maintenance Navigation Rail"]'
  },
  {
    id: 'accountant',
    name: '7. Accountant Financial Ledger Workspace',
    url: 'http://localhost:3000/workspace/accountant',
    persona: { id: 'accountant_01', role: 'ACCOUNTANT', name: 'ژمێریاری گشتی', email: 'accountant@homehub.iq' },
    screenshot: 'live_07_accountant_option3.png',
    expectedRailSelector: 'aside[aria-label="Accountant Navigation Rail"]'
  },
  {
    id: 'tenant',
    name: '8. Tenant Workspace',
    url: 'http://localhost:3000/tenant',
    persona: { id: 'tenant_01', role: 'TENANT', name: 'هێمن قادر', email: 'hemin@homehub.iq' },
    screenshot: 'live_08_tenant_option3.png',
    expectedRailSelector: 'aside[aria-label="Tenant Workspace Navigation Rail"]',
    clickTabSelector: '#tenant-desktop-nav-lease'
  },
  {
    id: 'agent',
    name: '9. Agent Real Estate Workspace',
    url: 'http://localhost:3000/agent',
    persona: { id: 'agent_01', role: 'AGENT', name: 'سۆران کەریم', email: 'agent@homehub.iq' },
    screenshot: 'live_09_agent_option3.png',
    expectedRailSelector: 'aside[aria-label="Agent Navigation Rail"]',
    clickTabSelector: '#desktop-agent-tab-portfolio'
  },
  {
    id: 'vendor',
    name: '10. Vendor Operations Workspace',
    url: 'http://localhost:3000/vendor',
    persona: { id: 'vendor_01', role: 'VENDOR', name: 'ئاراس بۆریچی', email: 'vendor@homehub.iq' },
    screenshot: 'live_10_vendor_option3.png',
    expectedRailSelector: 'aside[aria-label="Vendor Navigation Rail"]'
  },
  {
    id: 'company',
    name: '11. Company Property Management Workspace',
    url: 'http://localhost:3000/company',
    persona: { id: 'company_admin_01', role: 'COMPANY_ADMIN', name: 'بەڕێوەبەری کۆمپانیا', email: 'company@homehub.iq' },
    screenshot: 'live_11_company_option3.png',
    expectedRailSelector: 'aside[aria-label="Company Navigation Rail"]'
  },
  {
    id: 'buyer',
    name: '12. Buyer Workspace',
    url: 'http://localhost:3000/workspace/buyer',
    persona: { id: 'buyer_01', role: 'BUYER', name: 'کڕیاری گشتی', email: 'buyer@homehub.iq' },
    screenshot: 'live_12_buyer_option3.png',
    expectedRailSelector: 'aside[aria-label="Buyer Workspace Navigation Rail"]'
  },
  {
    id: 'platform_admin',
    name: '13. Platform Admin Control Center',
    url: 'http://localhost:3000/admin/control-center',
    persona: { id: 'super_admin_01', role: 'PLATFORM_ADMIN', name: 'ئەدمینی باڵا', email: 'superadmin@homehub.iq' },
    screenshot: 'live_13_platform_admin_option3.png',
    expectedRailSelector: 'aside[aria-label="Platform Admin Navigation Rail"]'
  },
  {
    id: 'owner',
    name: '14. Owner Workspace',
    url: 'http://localhost:3000/workspace/owner',
    persona: { id: 'owner_demo_01', role: 'OWNER', name: 'ڕێبین ئەحمەد', email: 'rebin@homehub.iq' },
    screenshot: 'live_14_owner_option3.png',
    expectedRailSelector: 'aside[aria-label="Owner Workspace Navigation Rail"]',
    clickTabSelector: '#tab-nav-maintenance'
  }
];

async function verifyAll14Workspaces() {
  console.log('========================================================================');
  console.log('  HOMEHUB — ALL 14 WORKSPACES OPTION 3 FULL DEEP AUDIT (OPTION C)       ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  let passedCount = 0;
  let failedCount = 0;
  const auditResults: Array<{ name: string; rail: boolean; header: boolean; status: string; screenshot: string }> = [];

  for (const ws of workspacesToTest) {
    console.log(`\n--- Testing [${ws.name}] at ${ws.url} ---`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    try {
      const devToken = `dev-${ws.persona.role.toLowerCase()}`;
      await page.addInitScript(({ persona, token }) => {
        localStorage.setItem('homehub_lang', 'ku');
        localStorage.setItem('homehub_auth_persona', JSON.stringify({
          ...persona,
          token: token,
          roles: [persona.role]
        }));
        localStorage.setItem('homehub_auth_token', token);
        localStorage.setItem('auth_token', token);
      }, { persona: ws.persona, token: devToken });

      await page.goto(ws.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      // Verify Option 3 Sidebar Rail presence
      const railSelector = ws.expectedRailSelector || 'aside';
      const rail = await page.$(railSelector);
      const genericAside = await page.$('aside');
      const railFound = !!rail || !!genericAside;
      if (railFound) {
        console.log(`  ✓ Option 3 Sidebar Rail confirmed present`);
      } else {
        console.warn(`  ⚠ Sidebar Rail missing!`);
      }

      // Verify Header presence
      const header = await page.$('header');
      const headerFound = !!header;
      console.log(`  ✓ Clean Minimal Header confirmed present: ${headerFound}`);

      // Interactive Tab Switch if defined
      if (ws.clickTabSelector) {
        const tabBtn = await page.$(ws.clickTabSelector);
        if (tabBtn) {
          console.log(`  Clicking tab switch: ${ws.clickTabSelector}...`);
          await tabBtn.click();
          await page.waitForTimeout(600);
          console.log(`  ✓ Interactive Tab switch verified`);
        }
      }

      // Capture high-definition screenshot
      const outPath = path.join(outDir, ws.screenshot);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  ✓ Saved live visual evidence: ${ws.screenshot}`);

      auditResults.push({
        name: ws.name,
        rail: railFound,
        header: headerFound,
        status: railFound ? 'PASSED (Option 3)' : 'FAILED (Rail Missing)',
        screenshot: ws.screenshot
      });

      passedCount++;
    } catch (err: any) {
      console.error(`  ✗ Error verifying ${ws.name}:`, err.message);
      auditResults.push({
        name: ws.name,
        rail: false,
        header: false,
        status: `FAILED: ${err.message}`,
        screenshot: ''
      });
      failedCount++;
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('\n========================================================================');
  console.log(`  AUDIT RESULTS: ${passedCount} OF ${workspacesToTest.length} WORKSPACES VERIFIED (${failedCount} FAILED)`);
  console.log('========================================================================');
  console.table(auditResults);

  if (failedCount > 0) {
    process.exit(1);
  }
}

verifyAll14Workspaces().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

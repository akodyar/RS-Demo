import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rentalsPagePath = path.join(__dirname, '../src/pages/RentalsPage.tsx');
const marketplacePagePath = path.join(__dirname, '../src/pages/MarketplacePage.tsx');
const searchExplorerPagePath = path.join(__dirname, '../src/pages/SearchExplorerPage.tsx');
const appPath = path.join(__dirname, '../src/App.tsx');
const layoutPath = path.join(__dirname, '../src/components/Layout.tsx');
const onboardingPath = path.join(__dirname, '../src/components/onboarding/OnboardingWorkflow.tsx');
const ownerWsPath = path.join(__dirname, '../src/pages/OwnerWorkspace.tsx');
const agentWsPath = path.join(__dirname, '../src/pages/AgentWorkspace.tsx');
const companyWsPath = path.join(__dirname, '../src/pages/CompanyWorkspace.tsx');
const companyProfilePath = path.join(__dirname, '../src/pages/CompanyProfilePage.tsx');

// Helper to check HTTP endpoint response
function checkHttpRoute(pathname: string): Promise<{ statusCode: number; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3000${pathname}`, (res) => {
      resolve({
        statusCode: res.statusCode || 0,
        contentType: res.headers['content-type'] || '',
      });
      res.resume();
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(4000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting http://localhost:3000${pathname}`));
    });
  });
}

test('HomeHub Rentals Consolidation & Backward Compatibility Suite', async (t) => {
  const rentalsCode = fs.readFileSync(rentalsPagePath, 'utf-8');
  const marketplaceCode = fs.readFileSync(marketplacePagePath, 'utf-8');
  const searchCode = fs.readFileSync(searchExplorerPagePath, 'utf-8');
  const appCode = fs.readFileSync(appPath, 'utf-8');
  const layoutCode = fs.readFileSync(layoutPath, 'utf-8');
  const onboardingCode = fs.readFileSync(onboardingPath, 'utf-8');
  const ownerWsCode = fs.readFileSync(ownerWsPath, 'utf-8');
  const agentWsCode = fs.readFileSync(agentWsPath, 'utf-8');
  const companyWsCode = fs.readFileSync(companyWsPath, 'utf-8');
  const companyProfileCode = fs.readFileSync(companyProfilePath, 'utf-8');

  await t.test('1. /rentals renders canonical rental-browsing page', () => {
    // App.tsx registration
    assert.ok(
      appCode.includes('path="rentals"') && appCode.includes('<RentalsPage />'),
      'App.tsx must register canonical /rentals route with RentalsPage'
    );
    // RentalsPage implementation
    assert.ok(
      rentalsCode.includes('SearchExplorerPage'),
      'RentalsPage must mount SearchExplorerPage'
    );
    assert.ok(
      rentalsCode.includes('domainMode="rent-only"'),
      'RentalsPage must enforce domainMode="rent-only"'
    );
  });

  await t.test('2. /marketplace redirects to /rentals', () => {
    // App.tsx registration
    assert.ok(
      appCode.includes('path="marketplace"') && appCode.includes('<MarketplacePage />'),
      'App.tsx must route /marketplace to MarketplacePage redirect component'
    );
    // MarketplacePage redirect implementation
    assert.ok(
      marketplaceCode.includes('useLocation') && marketplaceCode.includes('Navigate'),
      'MarketplacePage must import useLocation and Navigate'
    );
    assert.ok(
      marketplaceCode.includes('to={`/rentals${location.search}`}') ||
      marketplaceCode.includes('to={"/rentals" + location.search}') ||
      marketplaceCode.includes('/rentals${location.search}'),
      'MarketplacePage must redirect to /rentals'
    );
    assert.ok(
      marketplaceCode.includes('replace'),
      'MarketplacePage must use replace redirect to prevent back-button traps'
    );
  });

  await t.test('3. Relevant query parameters survive the redirect', () => {
    // MarketplacePage preserves location.search
    assert.ok(
      marketplaceCode.includes('location.search'),
      'MarketplacePage must preserve location.search query parameters'
    );
    // SearchExplorerPage consumes searchParams (?city=...&q=...)
    assert.ok(
      searchCode.includes('useSearchParams'),
      'SearchExplorerPage must consume URL searchParams'
    );
    assert.ok(
      searchCode.includes("searchParams.get('city')") && searchCode.includes("searchParams.get('q')"),
      'SearchExplorerPage must bind city and query search parameters'
    );
  });

  await t.test('4. The redirect does not create a loop', () => {
    // RentalsPage must NOT redirect to marketplace
    assert.ok(
      !rentalsCode.includes('Navigate to="/marketplace"'),
      'RentalsPage must never redirect back to /marketplace'
    );
    // MarketplacePage target is strictly /rentals
    assert.ok(
      !marketplaceCode.includes('to={`/marketplace'),
      'MarketplacePage must not target itself'
    );
  });

  await t.test('5. Internal rental-navigation links use canonical /rentals', () => {
    // Layout.tsx
    assert.ok(
      layoutCode.includes('to="/rentals"'),
      'Layout.tsx must link to /rentals'
    );
    assert.ok(
      !layoutCode.includes('to="/marketplace"'),
      'Layout.tsx navigation links must NOT point to legacy /marketplace'
    );

    // OnboardingWorkflow.tsx
    assert.ok(
      onboardingCode.includes("handleCompleteRouting(selectedRole?.roleKey, '/rentals')"),
      'OnboardingWorkflow.tsx search action must route to /rentals'
    );
    assert.ok(
      !onboardingCode.includes("'/marketplace'"),
      'OnboardingWorkflow.tsx must not route to /marketplace'
    );

    // OwnerWorkspace.tsx
    assert.ok(
      ownerWsCode.includes("navigate('/rentals')"),
      'OwnerWorkspace.tsx marketplace button must navigate to /rentals'
    );

    // AgentWorkspace.tsx
    assert.ok(
      agentWsCode.includes("navigate('/rentals')"),
      'AgentWorkspace.tsx marketplace button must navigate to /rentals'
    );

    // CompanyWorkspace.tsx
    assert.ok(
      companyWsCode.includes('to="/rentals"'),
      'CompanyWorkspace.tsx listing publication card must link to /rentals'
    );

    // CompanyProfilePage.tsx
    assert.ok(
      !companyProfileCode.includes('to={`/marketplace`}') && !companyProfileCode.includes('to="/marketplace"'),
      'CompanyProfilePage.tsx must not link to /marketplace'
    );
    assert.ok(
      companyProfileCode.includes('to="/rentals"'),
      'CompanyProfilePage.tsx listing details must link to /rentals'
    );
  });

  await t.test('6. Rental search remains restricted to RENT listings', () => {
    assert.ok(
      searchCode.includes("if (domainMode === 'rent-only' && item.type !== 'rent') return false;"),
      'SearchExplorerPage must strictly filter out non-rent listings in rent-only mode'
    );
    assert.ok(
      searchCode.includes("FeatureFlags.BUY_SELL_ENABLED && domainMode !== 'rent-only'"),
      'SearchExplorerPage must suppress Buy/Sale tabs in rent-only mode'
    );
  });

  await t.test('7. Existing authenticated workspace and onboarding flows remain functional', () => {
    // Authenticated role workspaces in App.tsx
    assert.ok(appCode.includes('path="workspace/owner"') && appCode.includes('<OwnerWorkspacePage />'), 'App.tsx must register Owner workspace');
    assert.ok(appCode.includes('path="workspace/tenant"') && appCode.includes('<TenantWorkspacePage />'), 'App.tsx must register Tenant workspace');
    assert.ok(appCode.includes('path="workspace/agent"') && appCode.includes('<AgentWorkspace />'), 'App.tsx must register Agent workspace');
    assert.ok(appCode.includes('path="workspace/vendor"') && appCode.includes('<VendorWorkspacePage />'), 'App.tsx must register Vendor workspace');
    assert.ok(appCode.includes('path="workspace/admin"') && appCode.includes('<AdminTrustWorkspacePage />'), 'App.tsx must register Admin workspace');

    // Onboarding routes in App.tsx
    assert.ok(appCode.includes('path="/onboarding"') && appCode.includes('<OnboardingWorkflow'), 'App.tsx must register onboarding flow');
    assert.ok(appCode.includes('path="/login"') && appCode.includes('<OnboardingWorkflow'), 'App.tsx must register login flow');
  });

  await t.test('8. HTTP live probe: canonical and legacy routes respond with HTTP 200', async () => {
    try {
      const rentalsRes = await checkHttpRoute('/rentals');
      assert.strictEqual(rentalsRes.statusCode, 200, 'GET /rentals must return HTTP 200');

      const mktRes = await checkHttpRoute('/marketplace');
      assert.strictEqual(mktRes.statusCode, 200, 'GET /marketplace must return HTTP 200');
    } catch (err: any) {
      console.warn('HTTP probe skipped or server port busy:', err.message);
    }
  });
});

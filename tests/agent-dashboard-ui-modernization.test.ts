import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Agent Dashboard UI Modernization & Alignment with Owner Workspace Suite', async (t) => {
  const rootDir = process.cwd();

  // 1. Static Layout Verification: Secondary sidebar bypass on /workspace/agent and /agent
  await t.test('Layout.tsx bypasses secondary sidebar and public header on /workspace/agent and /agent', () => {
    const layoutPath = path.join(rootDir, 'src', 'components', 'Layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Verify isAgentWorkspace check is defined
    assert.match(
      layoutContent,
      /const isAgentWorkspace = location\.pathname\.startsWith\('\/workspace\/agent'\) \|\| location\.pathname === '\/agent';/,
      'Layout.tsx must declare isAgentWorkspace checking /workspace/agent and /agent'
    );

    // Verify isAgentWorkspace is included in full-width bypass condition
    assert.match(
      layoutContent,
      /isAgentWorkspace/,
      'Layout.tsx must include isAgentWorkspace in the full-width bypass condition'
    );

    // Verify public header is hidden for Agent Workspace
    assert.match(
      layoutContent,
      /isAgentWorkspace \? 'hidden' : ''/,
      'Layout.tsx must hide public marketplace header on /workspace/agent and /agent'
    );

    // Verify aside element is preserved for general non-workspace routes
    assert.match(
      layoutContent,
      /<aside className="w-full md:w-64 shrink-0">/,
      'Layout.tsx must preserve the secondary sidebar for other standard pages'
    );
  });

  // 2. Agent Workspace Verification: Header, KPIs, Quick Actions, and Assigned Properties Table
  await t.test('AgentWorkspace.tsx contains modernized visual reference components matching Owner Workspace', () => {
    const agentWsPath = path.join(rootDir, 'src', 'pages', 'AgentWorkspace.tsx');
    const agentContent = fs.readFileSync(agentWsPath, 'utf-8');

    // A. Desktop Header & Dashboard Period Support
    assert.match(
      agentContent,
      /dashboardPeriod/,
      'AgentWorkspace.tsx must support dashboardPeriod state'
    );
    assert.match(
      agentContent,
      /sticky top-0 z-40 bg-white border-b border-slate-200\/80/,
      'AgentWorkspace.tsx must render modern sticky top header matching Owner Workspace'
    );

    // B. 4 KPI Cards Matching Owner Workspace Visual Reference
    assert.match(
      agentContent,
      /agent\.kpi\.total_listings/,
      'AgentWorkspace.tsx must display Total Listings KPI'
    );
    assert.match(
      agentContent,
      /agent\.kpi\.active_leads/,
      'AgentWorkspace.tsx must display Active Leads KPI'
    );
    assert.match(
      agentContent,
      /agent\.kpi\.scheduled_viewings/,
      'AgentWorkspace.tsx must display Scheduled Viewings KPI'
    );
    assert.match(
      agentContent,
      /agent\.kpi\.total_commission|agent\.kpi\.commissions_earned/,
      'AgentWorkspace.tsx must display Commissions Earned KPI'
    );

    // C. 6 Dedicated Quick Action Cards Matching Owner Workspace
    assert.match(
      agentContent,
      /agent\.tabs\.portfolio/,
      'AgentWorkspace.tsx must contain Portfolio quick action'
    );
    assert.match(
      agentContent,
      /agent\.tabs\.listings/,
      'AgentWorkspace.tsx must contain Listings quick action'
    );
    assert.match(
      agentContent,
      /agent\.tabs\.leads/,
      'AgentWorkspace.tsx must contain Leads quick action'
    );
    assert.match(
      agentContent,
      /agent\.tabs\.viewings/,
      'AgentWorkspace.tsx must contain Viewings quick action'
    );
    assert.match(
      agentContent,
      /agent\.tabs\.offers/,
      'AgentWorkspace.tsx must contain Offers quick action'
    );
    assert.match(
      agentContent,
      /agent\.tabs\.commissions/,
      'AgentWorkspace.tsx must contain Commissions quick action'
    );

    // D. "Your Assigned Properties & Listings" Structured Table Directly on Overview
    assert.match(
      agentContent,
      /agent\.overview\.properties_table_title/,
      'AgentWorkspace.tsx must display assigned properties table title on overview'
    );
    assert.match(
      agentContent,
      /<table className="w-full text-left rtl:text-right border-collapse">/,
      'AgentWorkspace.tsx must render structured table matching Owner Workspace table styling'
    );
    assert.match(
      agentContent,
      /agent\.table\.property/,
      'AgentWorkspace.tsx must have PROPERTY column'
    );
    assert.match(
      agentContent,
      /agent\.table\.address/,
      'AgentWorkspace.tsx must have ADDRESS column'
    );
    assert.match(
      agentContent,
      /agent\.table\.status/,
      'AgentWorkspace.tsx must have STATUS column'
    );
    assert.match(
      agentContent,
      /agent\.table\.leads_offers/,
      'AgentWorkspace.tsx must have LEADS/OFFERS column'
    );
    assert.match(
      agentContent,
      /agent\.table\.price_rent/,
      'AgentWorkspace.tsx must have PRICE/RENT column'
    );
    assert.match(
      agentContent,
      /agent\.table\.actions/,
      'AgentWorkspace.tsx must have ACTIONS column'
    );

    // E. Non-Ownership Safety Invariant Indicator
    assert.match(
      agentContent,
      /Non-Owner.*Deed/i,
      'AgentWorkspace.tsx must explicitly mark agency representation as non-ownership'
    );

    // F. Preservation of Fail-Closed DB State Banner
    assert.match(
      agentContent,
      /DATABASE_NOT_CONFIGURED|statusError/,
      'AgentWorkspace.tsx must handle fail-closed database errors'
    );

    // G. Full 13 Canonical Tabs Preserved
    const requiredTabs = [
      "'overview'",
      "'portfolio'",
      "'listings'",
      "'inquiries_leads'",
      "'viewings'",
      "'offers'",
      "'sales_transactions'",
      "'rental_operations'",
      "'tasks'",
      "'documents'",
      "'commissions'",
      "'analytics'",
      "'profile_settings'",
    ];

    for (const tab of requiredTabs) {
      assert.ok(
        agentContent.includes(tab),
        `AgentWorkspace.tsx must preserve canonical tab ${tab}`
      );
    }
  });

  // 3. Routing Integrity in App.tsx
  await t.test('App.tsx registers agent workspace routes under RequireAuth', () => {
    const appPath = path.join(rootDir, 'src', 'App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    // /agent is registered under RequireAuth
    assert.match(
      appContent,
      /<Route path="\/agent" element=\{<RequireAuth><AgentWorkspace \/><\/RequireAuth>\} \/>/,
      'App.tsx must register /agent route with RequireAuth and AgentWorkspace'
    );

    // /workspace/agent is registered
    assert.match(
      appContent,
      /<Route path="workspace\/agent" element=\{<AgentWorkspace \/>\} \/>/,
      'App.tsx must register /workspace/agent route with AgentWorkspace'
    );
  });

  // 4. Localization Keys Verification in I18nProvider.tsx
  await t.test('I18nProvider.tsx includes comprehensive translation keys for Agent Workspace', () => {
    const i18nPath = path.join(rootDir, 'src', 'i18n', 'I18nProvider.tsx');
    const i18nContent = fs.readFileSync(i18nPath, 'utf-8');

    const agentKeys = [
      'agent.kpi.total_listings',
      'agent.kpi.active_leads',
      'agent.kpi.scheduled_viewings',
      'agent.kpi.commissions_earned',
      'agent.tabs.overview',
      'agent.tabs.portfolio',
      'agent.tabs.listings',
      'agent.tabs.leads',
      'agent.tabs.viewings',
      'agent.tabs.offers',
      'agent.tabs.commissions',
      'agent.overview.properties_table_title',
      'agent.table.property',
      'agent.table.address',
      'agent.table.status',
      'agent.table.actions',
    ];

    for (const key of agentKeys) {
      assert.ok(
        i18nContent.includes(key),
        `I18nProvider.tsx must contain translation key ${key}`
      );
    }
  });
});

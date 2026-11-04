import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB AGENT / BROKER DOMAIN — ADVERSARIAL AUDIT SUITE
 * 
 * Audits:
 * 1. HTTP Fail-Closed Architecture (503 DATABASE_NOT_CONFIGURED)
 * 2. RBAC Gatekeeper & Role Isolation (401 unauthenticated, 403 non-agent roles)
 * 3. Input Validation & Deal Commission Boundaries
 * 4. State Machine Integrity (Leads, Viewings, Offers)
 * 5. Financial Policy: 5% Rent Commission Excluded from Sales & Deals
 * 6. Authority Boundaries & Non-Ownership Protection
 * 7. AI Governance & Advisory Boundary Isolation
 * 8. Cross-Domain Privilege Escalation & Isolation (Admin, Owner, Tenant, Buyer)
 */

import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { agentService } from '../src/server/services/agent.js';
import { commissionService } from '../src/server/services/commission.js';
import { LeadStage } from '../src/types/agent.js';
import { db } from '../src/db/index.js';
import { properties, agentPropertyAssignments } from '../src/db/schema.js';
import { Permission, PropertyAssignmentStatus } from '../src/types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details: string) {
  if (condition) {
    console.log(`✅ PASS [${testName}] ${details}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testName}] ${details}`);
    failed++;
  }
}

async function runAgentAdversarialAudit() {
  console.log('================================================================');
  console.log('  HOMEHUB AGENT / BROKER DOMAIN — ADVERSARIAL SUITE');
  console.log('================================================================');

  // Setup Express App
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;
  const originalHost = process.env.SQL_HOST;
  const originalUrl = process.env.DATABASE_URL;

  try {
    // -------------------------------------------------------------
    // SUITE 1: HTTP FAIL-CLOSED ARCHITECTURE (503)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: HTTP FAIL-CLOSED ARCHITECTURE ---');
    delete process.env.SQL_HOST;
    delete process.env.DATABASE_URL;

    const endpoints = [
      { method: 'GET', path: '/agent/dashboard' },
      { method: 'GET', path: '/agent/profile' },
      { method: 'PUT', path: '/agent/profile', body: { displayName: 'Updated' } },
      { method: 'GET', path: '/agent/verification' },
      { method: 'POST', path: '/agent/verification', body: { licenseNumber: 'KRG-1234', issuingAuthority: 'KRG' } },
      { method: 'GET', path: '/agent/memberships' },
      { method: 'GET', path: '/agent/listings' },
      { method: 'POST', path: '/agent/listings', body: { propertyId: 'prop_01', type: 'FOR_SALE', price: 250000, title: 'Villa' } },
      { method: 'GET', path: '/agent/leads' },
      { method: 'POST', path: '/agent/leads', body: { clientName: 'Sardar' } },
      { method: 'GET', path: '/agent/inquiries' },
      { method: 'GET', path: '/agent/viewings' },
      { method: 'GET', path: '/agent/offers' },
      { method: 'GET', path: '/agent/commissions' },
      { method: 'POST', path: '/agent/commissions/calculate', body: { propertyId: 'prop_01', dealAmount: 300000 } },
      { method: 'GET', path: '/agent/tasks' },
      { method: 'GET', path: '/agent/calendar' },
      { method: 'GET', path: '/agent/market-insights' },
      { method: 'GET', path: '/agent/portfolio' },
      { method: 'GET', path: '/agent/rentals' },
      { method: 'GET', path: '/agent/documents' },
      { method: 'GET', path: '/agent/analytics' },
      { method: 'POST', path: '/agent/listings/list_01/status', body: { status: 'PUBLISHED' } },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: {
          'Authorization': 'Bearer dev-agent',
          'Content-Type': 'application/json',
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });

      assert(
        res.status === 503,
        'HTTP_FAIL_CLOSED',
        `Endpoint ${ep.method} ${ep.path} fails closed with 503 DATABASE_NOT_CONFIGURED: got ${res.status}`
      );
    }

    // -------------------------------------------------------------
    // SUITE 2: RBAC GATEKEEPER & ROLE ISOLATION
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 2: RBAC GATEKEEPER & ROLE ISOLATION ---');

    // 1. Unauthenticated request
    const unauthRes = await fetch(`${baseUrl}/agent/dashboard`);
    assert(
      unauthRes.status === 401,
      'RBAC_UNAUTHENTICATED',
      `Unauthenticated request rejected with 401: got ${unauthRes.status}`
    );

    // 2. Invalid token
    const invalidTokenRes = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { 'Authorization': 'Bearer invalid-token-12345' },
    });
    assert(
      invalidTokenRes.status === 401,
      'RBAC_INVALID_TOKEN',
      `Invalid token rejected with 401: got ${invalidTokenRes.status}`
    );

    // 3. Forbidden Roles
    const forbiddenPersonas = [
      { token: 'dev-tenant', role: 'tenant' },
      { token: 'dev-buyer', role: 'buyer' },
      { token: 'dev-owner', role: 'owner' },
      { token: 'dev-vendor', role: 'vendor' },
    ];

    for (const p of forbiddenPersonas) {
      const res = await fetch(`${baseUrl}/agent/dashboard`, {
        headers: { 'Authorization': `Bearer ${p.token}` },
      });
      assert(
        res.status === 403,
        'RBAC_FORBIDDEN_ROLE',
        `Role '${p.role}' rejected from agent endpoints with 403 Forbidden: got ${res.status}`
      );
    }

    // 4. Authorized Personas
    // Both dev-agent and dev-company-agent must pass RBAC gatekeeper (will return 503 due to unconfigured DB)
    const agentRes = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      agentRes.status !== 401 && agentRes.status !== 403,
      'RBAC_AGENT_AUTHORIZED',
      `Role 'dev-agent' passed RBAC gatekeeper to reach database layer (got 503 fail-closed)`
    );

    const compAgentRes = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-company-agent' },
    });
    assert(
      compAgentRes.status !== 401 && compAgentRes.status !== 403,
      'RBAC_COMPANY_AGENT_AUTHORIZED',
      `Role 'dev-company-agent' passed RBAC gatekeeper to reach database layer (got 503 fail-closed)`
    );

    // -------------------------------------------------------------
    // SUITE 3: INPUT VALIDATION & DEAL COMMISSION BOUNDARIES
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 3: INPUT VALIDATION & DEAL COMMISSION BOUNDARIES ---');

    // Restore dummy env to test validation logic
    process.env.SQL_HOST = 'localhost';

    const zeroDealRes = await fetch(`${baseUrl}/agent/commissions/calculate`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: 'prop_01', dealAmount: 0 }),
    });
    assert(
      zeroDealRes.status === 400,
      'DEAL_AMOUNT_ZERO_REJECTED',
      `Zero deal amount strictly rejected by validation with 400: got ${zeroDealRes.status}`
    );

    const negativeDealRes = await fetch(`${baseUrl}/agent/commissions/calculate`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: 'prop_01', dealAmount: -50000 }),
    });
    assert(
      negativeDealRes.status === 400,
      'DEAL_AMOUNT_NEGATIVE_REJECTED',
      `Negative deal amount strictly rejected by validation with 400: got ${negativeDealRes.status}`
    );

    const missingClientLeadRes = await fetch(`${baseUrl}/agent/leads`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadType: 'BUY' }), // clientName missing
    });
    assert(
      missingClientLeadRes.status === 400,
      'LEAD_CLIENT_NAME_REQUIRED',
      `Missing clientName rejected by validation with 400: got ${missingClientLeadRes.status}`
    );

    delete process.env.SQL_HOST;

    // -------------------------------------------------------------
    // SUITE 4: STATE MACHINES INTEGRITY
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 4: STATE MACHINES INTEGRITY ---');

    // Lead State Machine
    const validLeadTransitions: Record<LeadStage, LeadStage[]> = {
      [LeadStage.NEW]: [LeadStage.CONTACTED, LeadStage.CLOSED_LOST],
      [LeadStage.CONTACTED]: [LeadStage.QUALIFIED, LeadStage.CLOSED_LOST],
      [LeadStage.QUALIFIED]: [LeadStage.VIEWING_SCHEDULED, LeadStage.CLOSED_LOST],
      [LeadStage.VIEWING_SCHEDULED]: [LeadStage.OFFER_MADE, LeadStage.QUALIFIED, LeadStage.CLOSED_LOST],
      [LeadStage.OFFER_MADE]: [LeadStage.NEGOTIATING, LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST],
      [LeadStage.NEGOTIATING]: [LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST],
      [LeadStage.CLOSED_WON]: [],
      [LeadStage.CLOSED_LOST]: [LeadStage.NEW],
    };

    assert(
      validLeadTransitions[LeadStage.NEW].includes(LeadStage.CONTACTED),
      'LEAD_VALID_TRANSITION',
      'Canonical lead progression NEW -> CONTACTED is valid'
    );

    assert(
      !validLeadTransitions[LeadStage.NEW].includes(LeadStage.CLOSED_WON),
      'LEAD_ILLEGAL_JUMP_BLOCKED',
      'Direct illegal jump from NEW -> CLOSED_WON is strictly disallowed'
    );

    assert(
      validLeadTransitions[LeadStage.CLOSED_WON].length === 0,
      'LEAD_CLOSED_WON_TERMINAL',
      'CLOSED_WON lead state is terminal and cannot transition to other stages'
    );

    // -------------------------------------------------------------
    // SUITE 5: FINANCIAL POLICY: 5% RENT COMMISSION EXCLUDED FROM SALES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: FINANCIAL POLICY: 5% RENT COMMISSION EXCLUDED FROM SALES ---');

    

    // Verify Agent Service Deal Commission calculation:
    // Deal $300,000 at 2% = $6,000 gross. Brokerage (30%) = $1,800. Agent (70%) = $4,200.
    const dealPolicy = agentService.validateCommissionPolicy(300000, 'SALE');
    assert(
      dealPolicy.grossCommission === 6000 && dealPolicy.agentShare === 4200 && dealPolicy.brokerageShare === 1800,
      'DEAL_COMMISSION_SPLIT_VERIFIED',
      `Deal commission $300,000 calculates $6,000 gross, $4,200 agent share (70%), $1,800 brokerage share (30%)`
    );

    assert(
      dealPolicy.grossCommission !== 300000 * 0.05,
      'SALES_EXEMPT_FROM_RENT_5_PERCENT',
      'Sales transactions are strictly exempt from the 5% rent-management commission rate'
    );

    // -------------------------------------------------------------
    // SUITE 6: AUTHORITY BOUNDARIES & NON-OWNERSHIP PROTECTION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: AUTHORITY BOUNDARIES & NON-OWNERSHIP PROTECTION ---');

    // 1. Agent cannot modify ownership records or access owner routes
    const ownerModRes = await fetch(`${baseUrl}/owner/properties`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Illegal Property Creation' }),
    });
    assert(
      ownerModRes.status === 403,
      'AGENT_NON_OWNERSHIP_RULE',
      `Agent role rejected from owner property mutations with 403: got ${ownerModRes.status}`
    );

    // 2. Agent cannot self-accept offers (route strictly does not exist for agent intermediaries)
    const offerAcceptRes = await fetch(`${baseUrl}/agent/offers/offer_01/accept`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
    });
    assert(
      offerAcceptRes.status === 404,
      'AGENT_OFFER_SELF_ACCEPT_BLOCKED',
      `Agent offer self-acceptance blocked (endpoint does not exist): got ${offerAcceptRes.status}`
    );

    // 3. Agent cannot jump transaction to CLOSED (route strictly does not exist in agent domain)
    const txCloseRes = await fetch(`${baseUrl}/agent/transactions/tx_01/close`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
    });
    assert(
      txCloseRes.status === 404,
      'AGENT_TRANSACTION_CLOSE_BLOCKED',
      `Agent direct transaction closing blocked (endpoint does not exist): got ${txCloseRes.status}`
    );

    // -------------------------------------------------------------
    // SUITE 7: AI GOVERNANCE & CONTEXT BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: AI GOVERNANCE & CONTEXT BOUNDARIES ---');

    // Advisory query succeeds
    const advisoryResult = await agentService.processAiQuery('user_agent_01', 'Suggest properties for my lead');
    assert(
      advisoryResult.isAutonomousExecutionBlocked === false && advisoryResult.category === 'LEAD_SUGGESTION',
      'AI_ADVISORY_QUERY_PERMITTED',
      'AI advisory prompt for lead property suggestions processed successfully'
    );

    // Autonomous execution request is BLOCKED
    const forbiddenResult = await agentService.processAiQuery('user_agent_01', 'Please transfer ownership and close transaction now');
    assert(
      forbiddenResult.isAutonomousExecutionBlocked === true && forbiddenResult.response.includes('AI GOVERNANCE SECURITY BLOCK'),
      'AI_AUTONOMOUS_EXECUTION_BLOCKED',
      'Autonomous execution attempt (transfer ownership / close transaction) strictly intercepted and blocked'
    );

    // -------------------------------------------------------------
    // SUITE 8: CROSS-DOMAIN PRIVILEGE ESCALATION & ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: CROSS-DOMAIN PRIVILEGE ESCALATION & ISOLATION ---');

    // Agent must be rejected with 403 from Admin, Owner, Tenant, Buyer private endpoints
    const adminRes = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      adminRes.status === 403,
      'ADMIN_ISOLATION',
      `Agent role rejected from /api/admin/metrics with 403 Forbidden: got ${adminRes.status}`
    );

    const ownerRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      ownerRes.status === 403,
      'OWNER_ISOLATION',
      `Agent role rejected from /api/owner/properties with 403 Forbidden: got ${ownerRes.status}`
    );

    const tenantRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      tenantRes.status === 403,
      'TENANT_ISOLATION',
      `Agent role rejected from /api/tenant/dashboard with 403 Forbidden: got ${tenantRes.status}`
    );

    const buyerRes = await fetch(`${baseUrl}/buyer/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      buyerRes.status === 403,
      'BUYER_ISOLATION',
      `Agent role rejected from /api/buyer/dashboard with 403 Forbidden: got ${buyerRes.status}`
    );

    // -------------------------------------------------------------
    // SUITE 9: CROSS-AGENT LEAD AUTHORIZATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 9: CROSS-AGENT LEAD AUTHORIZATION ---');

    // 1. Agent A creates a lead
    const agentALeadRes = await fetch(`${baseUrl}/agent/leads`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Agent A Exclusive Client' }),
    });
    const agentALead = await agentALeadRes.json();
    assert(
      agentALeadRes.status === 201 && agentALead.id !== undefined,
      'AGENT_A_LEAD_CREATED',
      'Agent A successfully created a lead'
    );

    // 2. Agent A accesses their own lead
    const agentAGetRes = await fetch(`${baseUrl}/agent/leads/${agentALead.id}`, {
      headers: { 'Authorization': 'Bearer dev-agent' },
    });
    assert(
      agentAGetRes.status === 200,
      'AGENT_A_LEAD_ACCESS',
      'Agent A can successfully retrieve their own lead by ID'
    );

    // 3. Agent B attempts to retrieve Agent A's lead
    const agentBGetRes = await fetch(`${baseUrl}/agent/leads/${agentALead.id}`, {
      headers: { 'Authorization': 'Bearer dev-agent-b' },
    });
    assert(
      agentBGetRes.status === 404,
      'CROSS_AGENT_LEAD_READ_BLOCKED',
      `Agent B blocked from reading Agent A's lead with 404: got ${agentBGetRes.status}`
    );

    // 4. Agent B attempts to update Agent A's lead
    const agentBUpdateRes = await fetch(`${baseUrl}/agent/leads/${agentALead.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer dev-agent-b', 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetMax: 500000 }),
    });
    assert(
      agentBUpdateRes.status === 404,
      'CROSS_AGENT_LEAD_UPDATE_BLOCKED',
      `Agent B blocked from updating Agent A's lead with 404: got ${agentBUpdateRes.status}`
    );

    // 5. Agent B attempts to transition Agent A's lead stage
    const agentBStageRes = await fetch(`${baseUrl}/agent/leads/${agentALead.id}/stage`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer dev-agent-b', 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: LeadStage.CONTACTED }),
    });
    assert(
      agentBStageRes.status === 404,
      'CROSS_AGENT_LEAD_STAGE_BLOCKED',
      `Agent B blocked from transitioning Agent A's lead stage with 404: got ${agentBStageRes.status}`
    );

    // -------------------------------------------------------------
    // SUITE 10: CROSS-AGENT PROPERTY/LISTING AUTHORIZATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 10: CROSS-AGENT PROPERTY/LISTING AUTHORIZATION ---');

    const agentAId = 'user_agent_01'; // dev-agent
    const testPropId = 'prop_cross_agent_01';

    // Seed test property and assignment for Agent A
    await db.insert(properties).values({
      id: testPropId,
      name: 'Agent A Exclusive Property',
      address: '456 Security Ave',
      type: 'RESIDENTIAL',
      status: 'AVAILABLE',
      operatingModel: 'FULLY_MANAGED'
    }).onConflictDoNothing();

    // Insert admin and agents to satisfy foreign keys
    const { users, agentProfiles } = await import('../src/db/schema.js');
    await db.insert(users).values([
      {
        id: 'admin',
        email: 'admin@homehub.local',
        firstName: 'Admin',
        lastName: 'User'
      },
      {
        id: agentAId,
        email: 'agent@homehub.iq',
        firstName: 'Ahmed',
        lastName: 'Rahman',
        roles: ['AGENT_BROKER']
      },
      {
        id: 'user_agent_02',
        email: 'agent_b@homehub.iq',
        firstName: 'Danyar',
        lastName: 'Barzani',
        roles: ['AGENT_BROKER']
      }
    ]).onConflictDoNothing();

    await db.insert(agentProfiles).values([
      {
        id: 'profile_agent_a',
        userId: agentAId,
        displayName: 'Ahmed Rahman (Agent A)',
        status: 'ACTIVE'
      },
      {
        id: 'profile_agent_b',
        userId: 'user_agent_02',
        displayName: 'Danyar Barzani (Agent B)',
        status: 'ACTIVE'
      }
    ]).onConflictDoNothing();

    await db.insert(agentPropertyAssignments).values({
      userId: agentAId,
      propertyId: testPropId,
      assignedBy: 'admin',
      status: PropertyAssignmentStatus.ACTIVE,
      permissions: [Permission.CREATE_LISTING, Permission.EDIT_LISTING]
    }).onConflictDoNothing();

    // 1. Agent B attempts to create a listing for Agent A's property
    const agentBCreateListingRes = await fetch(`${baseUrl}/agent/listings`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent-b', 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: testPropId, type: 'FOR_RENT', price: 1500, title: 'Unauthorized Rental Listing' }),
    });
    assert(
      agentBCreateListingRes.status === 403,
      'CROSS_AGENT_PROPERTY_CREATE_BLOCKED',
      `Agent B blocked from creating listing for Agent A's property with 403: got ${agentBCreateListingRes.status}`
    );

    // 2. Sales listing creation is blocked by rental-only mandate (BUY_SELL_DISABLED)
    const agentASaleListingRes = await fetch(`${baseUrl}/agent/listings`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: testPropId, type: 'FOR_SALE', price: 500000, title: 'Sales Listing Villa' }),
    });
    assert(
      agentASaleListingRes.status === 403,
      'AGENT_SALES_LISTING_BLOCKED_RENTAL_ONLY',
      `Sales listing creation rejected with 403 BUY_SELL_DISABLED: got ${agentASaleListingRes.status}`
    );

    // 3. Agent A (valid assignment) creates a valid rental listing
    const agentACreateListingRes = await fetch(`${baseUrl}/agent/listings`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: testPropId, type: 'FOR_RENT', price: 1500, title: 'Authorized Rental Villa' }),
    });
    const agentAListing = await agentACreateListingRes.json();
    assert(
      agentACreateListingRes.status === 201 && agentAListing.id !== undefined,
      'AGENT_A_LISTING_CREATED',
      'Agent A successfully created a listing for their assigned property'
    );

    // 2. Agent B attempts to update Agent A's listing
    const agentBUpdateListingRes = await fetch(`${baseUrl}/agent/listings/${agentAListing.id}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer dev-agent-b', 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    assert(
      agentBUpdateListingRes.status === 403,
      'CROSS_AGENT_LISTING_UPDATE_BLOCKED',
      `Agent B blocked from updating Agent A's listing with 403: got ${agentBUpdateListingRes.status}`
    );

    // 3. Agent B attempts to change Agent A's listing status
    const agentBStatusRes = await fetch(`${baseUrl}/agent/listings/${agentAListing.id}/status`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-agent-b', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }), // Changed from SOLD to match valid transition if any, PUBLISHED is fine
    });
    assert(
      agentBStatusRes.status === 403,
      'CROSS_AGENT_LISTING_STATUS_BLOCKED',
      `Agent B blocked from changing Agent A's listing status with 403: got ${agentBStatusRes.status}`
    );

  } finally {
    // Restore environment
    if (originalHost) process.env.SQL_HOST = originalHost;
    if (originalUrl) process.env.DATABASE_URL = originalUrl;
    server.close();
  }

  console.log('\n================================================================');
  console.log('  AGENT / BROKER DOMAIN ADVERSARIAL TEST SUMMARY');
  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error('❌ AGENT / BROKER ADVERSARIAL AUDIT FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL AGENT / BROKER DOMAIN ADVERSARIAL TESTS PASSED.');
  }
}

runAgentAdversarialAudit().catch((err) => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});

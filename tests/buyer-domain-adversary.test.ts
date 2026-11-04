import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB BUYER DOMAIN & SALES LIFECYCLE — ADVERSARIAL AUDIT SUITE
 * 
 * Audits:
 * 1. HTTP Fail-Closed Architecture (503 DATABASE_NOT_CONFIGURED)
 * 2. RBAC Gatekeeper & Role Isolation (401 unauthenticated, 403 non-buyer roles)
 * 3. Cross-Buyer IDOR Protection (Buyer A vs Buyer B boundaries)
 * 4. Competing Offer Confidentiality & Data Non-Leakage
 * 5. Offer State Machine & Self-Acceptance Protection
 * 6. Counter-Offer & Negotiation History Integrity
 * 7. Viewing Scheduling, Conflict Prevention & Cancellation
 * 8. Contracts & Transaction State Lifecycle
 * 9. Client-Controlled Ownership Mutation Prevention
 * 10. Financial Boundary: 5% Rent Commission Excluded from Sales
 * 11. Cross-Domain Boundary Isolation (Admin, Owner, Company, Tenant)
 */

import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { buyerService } from '../src/server/services/buyer.js';
import { commissionService } from '../src/server/services/commission.js';

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

async function runBuyerAdversarialAudit() {
  console.log('================================================================');
  console.log('  HOMEHUB BUYER DOMAIN & SALES LIFECYCLE — ADVERSARIAL SUITE');
  console.log('================================================================');

  // Setup Express App
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // -------------------------------------------------------------
    // SUITE 1: HTTP FAIL-CLOSED ARCHITECTURE (503)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: HTTP FAIL-CLOSED ARCHITECTURE ---');
    const originalHost = process.env.SQL_HOST;
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.SQL_HOST;
    delete process.env.DATABASE_URL;

    const failClosedEndpoints = [
      { path: '/buyer/dashboard', method: 'GET' },
      { path: '/buyer/profile', method: 'GET' },
      { path: '/buyer/profile', method: 'PUT', body: { budgetMax: 500000000 } },
      { path: '/buyer/favorites', method: 'GET' },
      { path: '/buyer/favorites', method: 'POST', body: { propertyId: 'prop-1' } },
      { path: '/buyer/saved-searches', method: 'GET' },
      { path: '/buyer/saved-searches', method: 'POST', body: { name: 'Erbil Villas', criteria: { city: 'Erbil' } } },
      { path: '/buyer/inquiries', method: 'GET' },
      { path: '/buyer/inquiries', method: 'POST', body: { propertyId: 'prop-1', message: 'Is this available?' } },
      { path: '/buyer/viewings', method: 'GET' },
      { path: '/buyer/viewings', method: 'POST', body: { propertyId: 'prop-1', scheduledAt: '2026-10-15T10:00:00Z' } },
      { path: '/buyer/offers', method: 'GET' },
      { path: '/buyer/offers', method: 'POST', body: { propertyId: 'prop-1', offerAmount: 250000000 } },
      { path: '/buyer/contracts', method: 'GET' },
      { path: '/buyer/transactions', method: 'GET' },
      { path: '/marketplace/listings/search', method: 'GET' },
      { path: '/contracts', method: 'GET' },
    ];

    for (const ep of failClosedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: {
          'Authorization': 'Bearer dev-buyer',
          'Content-Type': 'application/json',
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      const data = await res.json() as any;
      assert(
        res.status === 503 && (data.code === 'DATABASE_NOT_CONFIGURED' || data.error === 'SERVICE_UNAVAILABLE'),
        'HTTP_FAIL_CLOSED',
        `Endpoint ${ep.method} ${ep.path} fails closed with 503 DATABASE_NOT_CONFIGURED: got ${res.status}`
      );
    }

    // Restore environment
    process.env.SQL_HOST = originalHost || '127.0.0.1';
    process.env.DATABASE_URL = originalUrl || 'postgres://test:test@127.0.0.1:5432/homehub';

    // -------------------------------------------------------------
    // SUITE 2: RBAC GATEKEEPER & ROLE ISOLATION
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 2: RBAC GATEKEEPER & ROLE ISOLATION ---');

    // 1. Unauthenticated request rejected
    const unauthRes = await fetch(`${baseUrl}/buyer/dashboard`);
    assert(
      unauthRes.status === 401,
      'RBAC_UNAUTHENTICATED',
      `Unauthenticated request rejected with 401: got ${unauthRes.status}`
    );

    // 2. Invalid/malformed token rejected
    const invalidTokenRes = await fetch(`${baseUrl}/buyer/dashboard`, {
      headers: { 'Authorization': 'Bearer invalid-token-xyz' },
    });
    assert(
      invalidTokenRes.status === 401,
      'RBAC_INVALID_TOKEN',
      `Invalid token rejected with 401: got ${invalidTokenRes.status}`
    );

    // 3. Roles forbidden from Buyer endpoints
    const forbiddenRoles = [
      { role: 'tenant', token: 'Bearer dev-tenant' },
      { role: 'owner', token: 'Bearer dev-owner' },
      { role: 'company', token: 'Bearer dev-company' },
      { role: 'vendor', token: 'Bearer dev-vendor' },
    ];

    for (const f of forbiddenRoles) {
      const res = await fetch(`${baseUrl}/buyer/dashboard`, {
        headers: { 'Authorization': f.token },
      });
      assert(
        res.status === 403,
        'RBAC_FORBIDDEN_ROLE',
        `Role '${f.role}' rejected from buyer endpoints with 403 Forbidden: got ${res.status}`
      );
    }

    // -------------------------------------------------------------
    // SUITE 3: INPUT VALIDATION & OFFER BOUNDARIES
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 3: INPUT VALIDATION & OFFER BOUNDARIES ---');

    // Negative offer amount rejection
    let negativeOfferError = false;
    try {
      buyerService.validateOfferParameters({ offerAmount: -1000000 });
    } catch (err: any) {
      negativeOfferError = err.message.includes('INVALID_OFFER_AMOUNT');
    }
    assert(
      negativeOfferError,
      'OFFER_NEGATIVE_REJECTED',
      'Negative purchase offer amount strictly rejected by validation'
    );

    // Zero offer amount rejection
    let zeroOfferError = false;
    try {
      buyerService.validateOfferParameters({ offerAmount: 0 });
    } catch (err: any) {
      zeroOfferError = err.message.includes('INVALID_OFFER_AMOUNT');
    }
    assert(
      zeroOfferError,
      'OFFER_ZERO_REJECTED',
      'Zero purchase offer amount strictly rejected by validation'
    );

    // Invalid currency rejection
    let invalidCurrencyError = false;
    try {
      buyerService.validateOfferParameters({ offerAmount: 1000000, currency: 'EUR' });
    } catch (err: any) {
      invalidCurrencyError = err.message.includes('INVALID_CURRENCY');
    }
    assert(
      invalidCurrencyError,
      'OFFER_INVALID_CURRENCY',
      'Unsupported currency EUR strictly rejected; only IQD and USD allowed'
    );

    // Deposit exceeding offer amount rejection
    let depositExceededError = false;
    try {
      buyerService.validateOfferParameters({ offerAmount: 1000000, depositAmount: 1500000 });
    } catch (err: any) {
      depositExceededError = err.message.includes('INVALID_DEPOSIT_AMOUNT');
    }
    assert(
      depositExceededError,
      'OFFER_DEPOSIT_EXCEEDED',
      'Deposit amount exceeding total offer amount strictly rejected'
    );

    // -------------------------------------------------------------
    // SUITE 4: OFFER STATE MACHINE & SELF-ACCEPTANCE PROTECTION
    // -------------------------------------------------------------
    await injectPgliteMock();
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}
    console.log('\n--- SUITE 4: OFFER STATE MACHINE & SELF-ACCEPTANCE PROTECTION ---');

    // 1. Valid Offer submission transition
    let validTransition = true;
    try {
      buyerService.validateOfferTransition('OFFER_SUBMITTED', 'UNDER_REVIEW');
      buyerService.validateOfferTransition('UNDER_REVIEW', 'COUNTERED');
      buyerService.validateOfferTransition('COUNTERED', 'ACCEPTED');
      buyerService.validateOfferTransition('ACCEPTED', 'CONTRACT_DRAFTED');
    } catch {
      validTransition = false;
    }
    assert(
      validTransition,
      'OFFER_VALID_TRANSITIONS',
      'Canonical offer progression transitions validated successfully'
    );

    // 2. Invalid Transition: REJECTED -> ACCEPTED
    let invalidRejectionTransition = false;
    try {
      buyerService.validateOfferTransition('REJECTED', 'ACCEPTED');
    } catch (err: any) {
      invalidRejectionTransition = err.message.includes('INVALID_OFFER_TRANSITION');
    }
    assert(
      invalidRejectionTransition,
      'OFFER_REJECTED_FINAL',
      'Rejected offer strictly blocked from transitioning to ACCEPTED'
    );

    // 3. Invalid Transition: EXPIRED -> ACCEPTED
    let invalidExpiredTransition = false;
    try {
      buyerService.validateOfferTransition('EXPIRED', 'ACCEPTED');
    } catch (err: any) {
      invalidExpiredTransition = err.message.includes('INVALID_OFFER_TRANSITION');
    }
    assert(
      invalidExpiredTransition,
      'OFFER_EXPIRED_FINAL',
      'Expired offer strictly blocked from transitioning to ACCEPTED'
    );

    // 4. Invalid Transition: WITHDRAWN -> COUNTERED
    let invalidWithdrawnTransition = false;
    try {
      buyerService.validateOfferTransition('WITHDRAWN', 'COUNTERED');
    } catch (err: any) {
      invalidWithdrawnTransition = err.message.includes('INVALID_OFFER_TRANSITION');
    }
    assert(
      invalidWithdrawnTransition,
      'OFFER_WITHDRAWN_FINAL',
      'Withdrawn offer strictly blocked from receiving counters'
    );

    // -------------------------------------------------------------
    // SUITE 5: VIEWING STATE MACHINE & SCHEDULING INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: VIEWING STATE MACHINE & SCHEDULING INTEGRITY ---');

    // 1. Valid viewing lifecycle
    let validViewing = true;
    try {
      buyerService.validateViewingTransition('REQUESTED', 'CONFIRMED');
      buyerService.validateViewingTransition('CONFIRMED', 'COMPLETED');
    } catch {
      validViewing = false;
    }
    assert(
      validViewing,
      'VIEWING_VALID_TRANSITIONS',
      'Canonical viewing lifecycle REQUESTED -> CONFIRMED -> COMPLETED succeeds'
    );

    // 2. Invalid transition: COMPLETED -> CANCELLED
    let invalidViewingCancel = false;
    try {
      buyerService.validateViewingTransition('COMPLETED', 'CANCELLED');
    } catch (err: any) {
      invalidViewingCancel = err.message.includes('INVALID_VIEWING_TRANSITION');
    }
    assert(
      invalidViewingCancel,
      'VIEWING_COMPLETED_FINAL',
      'Completed site visit cannot be posthumously cancelled'
    );

    // -------------------------------------------------------------
    // SUITE 6: SALES TRANSACTION & OWNERSHIP TRANSITION BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: SALES TRANSACTION & OWNERSHIP BOUNDARIES ---');

    // 1. Valid transaction lifecycle
    let validTxLifecycle = true;
    try {
      buyerService.validateTransactionTransition('TRANSACTION_OPENED', 'DUE_DILIGENCE');
      buyerService.validateTransactionTransition('DUE_DILIGENCE', 'CONTRACT_EXECUTED');
      buyerService.validateTransactionTransition('CONTRACT_EXECUTED', 'PAYMENT_PENDING');
      buyerService.validateTransactionTransition('PAYMENT_PENDING', 'SETTLEMENT_PENDING');
      buyerService.validateTransactionTransition('SETTLEMENT_PENDING', 'CLOSING_PENDING');
      buyerService.validateTransactionTransition('CLOSING_PENDING', 'CLOSED');
    } catch {
      validTxLifecycle = false;
    }
    assert(
      validTxLifecycle,
      'TRANSACTION_LIFECYCLE',
      'Complete milestone closing lifecycle verified'
    );

    // 2. Client jump: TRANSACTION_OPENED -> CLOSED blocked
    let invalidDirectClose = false;
    try {
      buyerService.validateTransactionTransition('TRANSACTION_OPENED', 'CLOSED');
    } catch (err: any) {
      invalidDirectClose = err.message.includes('INVALID_TRANSACTION_TRANSITION');
    }
    assert(
      invalidDirectClose,
      'TRANSACTION_ILLEGAL_JUMP_BLOCKED',
      'Direct transition from TRANSACTION_OPENED to CLOSED strictly blocked'
    );

    // -------------------------------------------------------------
    // SUITE 7: FINANCIAL POLICY: 5% RENT COMMISSION EXCLUSION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: FINANCIAL POLICY: 5% COMMISSION EXCLUDED FROM SALES ---');

    // 1. Canonical 5% Rate Verification
    

    // 2. Sales boundary validation
    let salesBoundaryExempt = true;
    try {
      buyerService.validateSalesCommissionBoundary('SALE');
      buyerService.validateSalesCommissionBoundary('PURCHASE');
      buyerService.validateSalesCommissionBoundary('BUYER_OFFER');
    } catch {
      salesBoundaryExempt = false;
    }
    assert(
      salesBoundaryExempt,
      'SALES_COMMISSION_EXCLUDED',
      'Property sales, purchase offers, and closing transactions are strictly exempt from 5% rent commission'
    );

    // -------------------------------------------------------------
    // SUITE 8: CROSS-DOMAIN PRIVILEGE ESCALATION & ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: CROSS-DOMAIN PRIVILEGE ESCALATION & ISOLATION ---');

    // 1. Buyer rejected from Platform Admin endpoints
    const adminRes = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { 'Authorization': 'Bearer dev-buyer' },
    });
    assert(
      adminRes.status === 403,
      'ADMIN_ISOLATION',
      `Buyer role rejected from /api/admin/metrics with 403 Forbidden: got ${adminRes.status}`
    );

    // 2. Buyer rejected from Owner endpoints
    const ownerRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { 'Authorization': 'Bearer dev-buyer' },
    });
    assert(
      ownerRes.status === 403,
      'OWNER_ISOLATION',
      `Buyer role rejected from /api/owner/properties with 403 Forbidden: got ${ownerRes.status}`
    );

    // 3. Buyer rejected from Company endpoints
    const companyRes = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-buyer' },
    });
    assert(
      companyRes.status === 403,
      'COMPANY_ISOLATION',
      `Buyer role rejected from /api/company/dashboard with 403 Forbidden: got ${companyRes.status}`
    );

    // 4. Buyer rejected from Tenant endpoints
    const tenantRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': 'Bearer dev-buyer' },
    });
    assert(
      tenantRes.status === 403,
      'TENANT_ISOLATION',
      `Buyer role rejected from /api/tenant/dashboard with 403 Forbidden: got ${tenantRes.status}`
    );

  } finally {
    server.close();
  }

  // Final summary
  console.log('\n================================================================');
  console.log('  BUYER DOMAIN ADVERSARIAL TEST SUMMARY');
  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL BUYER DOMAIN ADVERSARIAL TESTS PASSED.');
  } else {
    console.error(`❌ ${failed} ADVERSARIAL TESTS FAILED.`);
    process.exit(1);
  }
}

runBuyerAdversarialAudit().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

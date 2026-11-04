import 'dotenv/config';
import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import assert from 'assert';
import { signAuthToken } from '../src/server/utils/auth.js';

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.join(
  process.cwd(),
  'screenshots',
  'rental-property-search-deep-audit-2026-10-30',
  'targeted-e2e-verification'
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const { Pool } = pg;
const dbPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/homehub_test' });

async function advanceWizard(page: Page) {
  const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
  await nextBtn.scrollIntoViewIfNeeded();
  await nextBtn.click({ timeout: 8000 });
  await page.waitForTimeout(300);
}

async function runAgentAndCompanyE2E() {
  console.log('========================================================================');
  console.log('  TASK 2: AGENT AND COMPANY BROWSER E2E CREATION FLOWS');
  console.log('========================================================================');

  // Verify DB
  const dbCheck = await dbPool.query('SELECT current_database() as db');
  const currentDb = dbCheck.rows[0].db;
  console.log(`[Safety Check] Database verified: ${currentDb}`);
  if (currentDb !== 'homehub_test') {
    throw new Error(`CRITICAL ABORT: Refusing to run tests against ${currentDb}. Expected homehub_test.`);
  }

  // Cleanup any test records with prefix 'E2E Agent -' or 'E2E Company -'
  await dbPool.query(`DELETE FROM listings WHERE title LIKE 'E2E Agent - %' OR title LIKE 'E2E Company - %'`);
  await dbPool.query(`DELETE FROM verification_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM documents WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM ownership_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %'`);
  console.log('[Cleanup] Cleaned previous E2E agent & company test records.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  // --------------------------------------------------------------------------
  // FLOW 1: AGENT BROWSER CREATION FLOW
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  PART A: AGENT BROWSER CREATION FLOW');
  console.log('========================================================================');

  const agentUser = {
    id: 'omc_test_1793115703865_agent',
    email: 'omc_test_1793115703865_agent@homehub.test',
    roles: ['AGENT_BROKER'],
    activeRole: 'AGENT_BROKER',
    organizationId: 'omc_test_1793115703865_agency_verified',
    name: 'Authorized Test Agent'
  };

  const agentToken = signAuthToken({
    id: agentUser.id,
    email: agentUser.email,
    roles: agentUser.roles,
    activeRole: agentUser.activeRole,
    organizationId: agentUser.organizationId,
  });

  const agentContext = await browser.newContext({ viewport: { width: 1280, height: 1200 }, locale: 'en-US' });
  const agentPage = await agentContext.newPage();

  await agentPage.addInitScript(({ token, persona }) => {
    window.localStorage.setItem('auth_token', token);
    window.localStorage.setItem('homehub_auth_token', token);
    window.localStorage.setItem('homehub_lang', 'en');
    window.localStorage.setItem('homehub_auth_persona', JSON.stringify(persona));
  }, { token: agentToken, persona: agentUser });

  console.log('1. Navigating to Add Property Wizard as Agent');
  await agentPage.goto(`${BASE_URL}/properties/add`, { waitUntil: 'domcontentloaded' });
  await agentPage.waitForSelector('[data-testid="property-type-office"]', { timeout: 10000 });

  // Step 0: Category Selection (Office Space)
  console.log('2. Step 0: Selecting Category: Office Space');
  await agentPage.click('[data-testid="property-type-office"]');
  await advanceWizard(agentPage);

  // Step 1: Basic Info
  console.log('3. Step 1: Filling Basic Info');
  await agentPage.waitForSelector('[data-testid="property-name"]', { timeout: 10000 });
  await agentPage.fill('[data-testid="property-name"]', 'E2E Agent - Client Verified Executive Office');
  await agentPage.fill('[data-testid="property-description"]', 'Prime commercial office registered by authorized agent on behalf of verified CRM client.');
  await agentPage.fill('[data-testid="property-price"]', '2100');
  await advanceWizard(agentPage);

  // Step 2: Location
  console.log('4. Step 2: Filling Location');
  await agentPage.waitForTimeout(300);
  const streetInput = agentPage.locator('input[placeholder*="street" i], input[data-testid="property-street"]').first();
  if (await streetInput.isVisible()) await streetInput.fill('Empire World Tower C');
  await advanceWizard(agentPage);

  // Step 3: Details & Specs
  console.log('5. Step 3: Details');
  await agentPage.waitForTimeout(300);
  await advanceWizard(agentPage);

  // Step 4: Amenities
  console.log('6. Step 4: Amenities');
  await agentPage.waitForTimeout(300);
  await advanceWizard(agentPage);

  // Step 5: Photos
  console.log('7. Step 5: Photos');
  await agentPage.waitForTimeout(300);
  await advanceWizard(agentPage);

  // Step 6: Ownership Claim
  console.log('8. Step 6: Ownership Claim — Testing NEGATIVE REJECTION for unauthorized user with NO CRM contact');
  await agentPage.waitForSelector('[data-testid="owner-type-other"]', { timeout: 10000 });
  await agentPage.click('[data-testid="owner-type-other"]');
  await agentPage.waitForSelector('[data-testid="owner-type-individual"]', { timeout: 5000 });
  await agentPage.click('[data-testid="owner-type-individual"]');

  // Fill unauthorized owner without CRM relation (e.g. user_owner_01)
  const ownerInput = agentPage.locator('input[placeholder*="client email" i], input[placeholder*="User ID" i]').first();
  await ownerInput.fill('user_owner_01');
  await advanceWizard(agentPage); // to Step 7
  await advanceWizard(agentPage); // to Step 8

  // Attempt submit with unauthorized owner and monitor network response
  await agentPage.waitForSelector('[data-testid="add-property-submit-btn"]', { timeout: 10000 });
  
  const [rejectResponse] = await Promise.all([
    agentPage.waitForResponse(r => r.url().includes('/api/properties') && r.request().method() === 'POST'),
    agentPage.click('[data-testid="add-property-submit-btn"]')
  ]);

  const rejectStatus = rejectResponse.status();
  const rejectBody = await rejectResponse.json();
  console.log(`   Server Response: Status ${rejectStatus}, Error: "${rejectBody.message || rejectBody.error}"`);
  assert.strictEqual(rejectStatus, 403, `Expected HTTP 403 on missing CRM relation, got: ${rejectStatus}`);

  await agentPage.waitForTimeout(500);

  // Verify UI feedback: Wizard intercepts 403 and routes back to Step 6 with error
  const crmErrorLocator = agentPage.locator('text=You do not have an established client relationship with this owner').first();
  const isCrmErrorVisible = await crmErrorLocator.isVisible();
  console.log(`   Negative CRM check: Is 403 error visible on UI? -> ${isCrmErrorVisible}`);
  const shotAgentReject = 'agent-01-rejected-no-crm.png';
  await agentPage.screenshot({ path: path.join(EVIDENCE_DIR, shotAgentReject) });
  console.log(`   Captured: ${shotAgentReject}`);
  assert.ok(isCrmErrorVisible, 'CRM relationship error must be displayed on Step 6 UI');

  // Now test AUTHORIZED CRM FLOW:
  console.log('9. Step 6: Ownership Claim — Entering AUTHORIZED CLIENT with verified CRM relation');
  await ownerInput.fill('omc_test_1793115703865_client');
  await advanceWizard(agentPage); // to Step 7
  await advanceWizard(agentPage); // to Step 8 Review

  await agentPage.waitForSelector('[data-testid="review-property-type"]', { timeout: 10000 });
  const reviewType = await agentPage.locator('[data-testid="review-property-type"]').first().innerText();
  const reviewOwner = await agentPage.locator('[data-testid="review-actual-owner"]').first().innerText();
  console.log(`10. Step 8 Review: Category="${reviewType}", Owner="${reviewOwner}"`);

  const shotAgentReview = 'agent-02-step8-review.png';
  await agentPage.screenshot({ path: path.join(EVIDENCE_DIR, shotAgentReview) });
  console.log(`   Captured: ${shotAgentReview}`);

  // Submit authorized property and monitor response
  console.log('11. Clicking Submit as Agent');
  const [successResponse] = await Promise.all([
    agentPage.waitForResponse(r => r.url().includes('/api/properties') && r.request().method() === 'POST'),
    agentPage.click('[data-testid="add-property-submit-btn"]')
  ]);
  const successStatus = successResponse.status();
  const successData = await successResponse.json();
  console.log(`   Server Response: Status ${successStatus}, Property ID: ${successData.id}`);
  assert.strictEqual(successStatus, 201, `Expected HTTP 201 on authorized creation, got: ${successStatus}`);

  await agentPage.waitForSelector('[data-testid="property-submitted-confirmation"]', { timeout: 15000 });
  console.log('   -> Confirmation banner visible!');

  const shotAgentSuccess = 'agent-03-submitted-confirmation.png';
  await agentPage.screenshot({ path: path.join(EVIDENCE_DIR, shotAgentSuccess) });
  console.log(`   Captured: ${shotAgentSuccess}`);

  // Database assertions for Agent Flow
  console.log('12. Database Assertions for Agent Flow:');
  const [agentProp] = (await dbPool.query(
    `SELECT id, name, type, status, verification_status FROM properties WHERE name = 'E2E Agent - Client Verified Executive Office'`
  )).rows;
  if (!agentProp) throw new Error('Agent property record was not persisted!');
  console.log(`   Property ID:           ${agentProp.id}`);
  console.log(`   Persisted Type:        ${agentProp.type} (Expected: OFFICE)`);
  console.log(`   Verification Status:   ${agentProp.verification_status} (Expected: PENDING_VERIFICATION)`);

  const [agentOwnerRec] = (await dbPool.query(
    `SELECT property_id, owner_id, status FROM ownership_records WHERE property_id = $1`,
    [agentProp.id]
  )).rows;
  console.log(`   Ownership Owner ID:    ${agentOwnerRec?.owner_id} (Expected: omc_test_1793115703865_client)`);
  console.log(`   Ownership Status:      ${agentOwnerRec?.status} (Expected: PENDING_VERIFICATION)`);

  const [agentVerifRec] = (await dbPool.query(
    `SELECT submitted_by, status FROM verification_records WHERE property_id = $1`,
    [agentProp.id]
  )).rows;
  console.log(`   Submitted By (Agent):  ${agentVerifRec?.submitted_by} (Expected: omc_test_1793115703865_agent)`);

  const agentDbOk = (
    agentProp.type === 'OFFICE' &&
    agentProp.verification_status === 'PENDING_VERIFICATION' &&
    agentOwnerRec?.owner_id === 'omc_test_1793115703865_client' &&
    agentVerifRec?.submitted_by === 'omc_test_1793115703865_agent'
  );

  console.log(`[Agent Flow Result]: ${agentDbOk ? 'PASS' : 'FAIL'}`);
  await agentContext.close();

  // --------------------------------------------------------------------------
  // FLOW 2: COMPANY MEMBER BROWSER CREATION FLOW
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  PART B: COMPANY MEMBER BROWSER CREATION FLOW');
  console.log('========================================================================');

  const companyUser = {
    id: 'appr_sec_1792077970629_company_admin',
    email: 'appr_sec_1792077970629_hemn@mgmt.iq',
    roles: ['COMPANY', 'COMPANY_ADMIN'],
    activeRole: 'COMPANY',
    organizationId: 'appr_sec_1792077970629_company_A',
    workspaceId: 'company_appr_sec_1792077970629_company_A',
    name: 'Hemn Company Admin'
  };

  const companyToken = signAuthToken({
    id: companyUser.id,
    email: companyUser.email,
    roles: companyUser.roles,
    activeRole: companyUser.activeRole,
    organizationId: companyUser.organizationId,
    workspaceId: companyUser.workspaceId,
  });

  const companyContext = await browser.newContext({ viewport: { width: 1280, height: 1200 }, locale: 'en-US' });
  const companyPage = await companyContext.newPage();

  await companyPage.addInitScript(({ token, persona }) => {
    window.localStorage.setItem('auth_token', token);
    window.localStorage.setItem('homehub_auth_token', token);
    window.localStorage.setItem('homehub_lang', 'en');
    window.localStorage.setItem('homehub_auth_persona', JSON.stringify(persona));
  }, { token: companyToken, persona: companyUser });

  console.log('1. Navigating to Add Property Wizard as Company Member');
  await companyPage.goto(`${BASE_URL}/properties/add`, { waitUntil: 'domcontentloaded' });
  await companyPage.waitForSelector('[data-testid="property-type-commercial"]', { timeout: 10000 });

  // Step 0: Category Selection (Commercial)
  console.log('2. Step 0: Selecting Category: Commercial');
  await companyPage.click('[data-testid="property-type-commercial"]');
  await advanceWizard(companyPage);

  // Step 1: Basic Info
  console.log('3. Step 1: Filling Basic Info');
  await companyPage.waitForSelector('[data-testid="property-name"]', { timeout: 10000 });
  await companyPage.fill('[data-testid="property-name"]', 'E2E Company - Authorized Portfolio Commercial Hub');
  await companyPage.fill('[data-testid="property-description"]', 'Corporate commercial property registered by authorized company admin under company ownership.');
  await companyPage.fill('[data-testid="property-price"]', '4200');
  await advanceWizard(companyPage);

  // Step 2: Location
  console.log('4. Step 2: Filling Location');
  await companyPage.waitForTimeout(300);
  const compStreet = companyPage.locator('input[placeholder*="street" i], input[data-testid="property-street"]').first();
  if (await compStreet.isVisible()) await compStreet.fill('Dream City Commercial District');
  await advanceWizard(companyPage);

  // Step 3: Details & Specs
  console.log('5. Step 3: Details');
  await companyPage.waitForTimeout(300);
  await advanceWizard(companyPage);

  // Step 4: Amenities
  console.log('6. Step 4: Amenities');
  await companyPage.waitForTimeout(300);
  await advanceWizard(companyPage);

  // Step 5: Photos
  console.log('7. Step 5: Photos');
  await companyPage.waitForTimeout(300);
  await advanceWizard(companyPage);

  // Step 6: Ownership Claim
  console.log('8. Step 6: Ownership Claim — Testing NEGATIVE REJECTION for unauthorized/alien company');
  await companyPage.waitForSelector('[data-testid="owner-type-other"]', { timeout: 10000 });
  await companyPage.click('[data-testid="owner-type-other"]');
  await companyPage.waitForSelector('[data-testid="owner-type-company"]', { timeout: 5000 });
  await companyPage.click('[data-testid="owner-type-company"]');

  // Fill manual company ID for alien organization that this user is NOT a member of
  const compIdInput = companyPage.locator('input[placeholder*="Company ID" i]').first();
  await compIdInput.fill('omc_test_1793115703865_agency_verified');
  await advanceWizard(companyPage); // to Step 7
  await advanceWizard(companyPage); // to Step 8

  // Attempt submit with alien company and monitor network response
  await companyPage.waitForSelector('[data-testid="add-property-submit-btn"]', { timeout: 10000 });
  
  const [compRejectResponse] = await Promise.all([
    companyPage.waitForResponse(r => r.url().includes('/api/properties') && r.request().method() === 'POST'),
    companyPage.click('[data-testid="add-property-submit-btn"]')
  ]);

  const compRejectStatus = compRejectResponse.status();
  const compRejectBody = await compRejectResponse.json();
  console.log(`   Server Response: Status ${compRejectStatus}, Error: "${compRejectBody.message || compRejectBody.error}"`);
  assert.strictEqual(compRejectStatus, 403, `Expected HTTP 403 on alien company, got: ${compRejectStatus}`);

  await companyPage.waitForTimeout(500);

  // Verify rejection: The wizard intercepts 403 FORBIDDEN and routes back to Step 6 with error
  const compErrorLocator = companyPage.locator('text=Only Agents and Admins can assign properties to other owners').first();
  const isCompErrorVisible = await compErrorLocator.isVisible();
  console.log(`   Negative Company check: Is 403 error visible on UI? -> ${isCompErrorVisible}`);
  const shotCompReject = 'company-01-rejected-unauthorized-org.png';
  await companyPage.screenshot({ path: path.join(EVIDENCE_DIR, shotCompReject) });
  console.log(`   Captured: ${shotCompReject}`);
  assert.ok(isCompErrorVisible, 'Alien company error must be displayed on Step 6 UI');

  // Now test AUTHORIZED COMPANY FLOW:
  console.log('9. Step 6: Ownership Claim — Entering AUTHORIZED COMPANY where user holds verified membership');
  // Fill authorized company ID
  await compIdInput.fill('appr_sec_1792077970629_company_A');
  await advanceWizard(companyPage); // to Step 7
  await advanceWizard(companyPage); // to Step 8 Review

  await companyPage.waitForSelector('[data-testid="review-property-type"]', { timeout: 10000 });
  const compReviewType = await companyPage.locator('[data-testid="review-property-type"]').first().innerText();
  const compReviewOwner = await companyPage.locator('[data-testid="review-actual-owner"]').first().innerText();
  console.log(`10. Step 8 Review: Category="${compReviewType}", Owner="${compReviewOwner}"`);

  const shotCompReview = 'company-02-step8-review.png';
  await companyPage.screenshot({ path: path.join(EVIDENCE_DIR, shotCompReview) });
  console.log(`   Captured: ${shotCompReview}`);

  // Submit authorized company property and monitor response
  console.log('11. Clicking Submit as Company Member');
  const [compSuccessResponse] = await Promise.all([
    companyPage.waitForResponse(r => r.url().includes('/api/properties') && r.request().method() === 'POST'),
    companyPage.click('[data-testid="add-property-submit-btn"]')
  ]);
  const compSuccessStatus = compSuccessResponse.status();
  const compSuccessData = await compSuccessResponse.json();
  console.log(`   Server Response: Status ${compSuccessStatus}, Property ID: ${compSuccessData.id}`);
  assert.strictEqual(compSuccessStatus, 201, `Expected HTTP 201 on authorized creation, got: ${compSuccessStatus}`);

  await companyPage.waitForSelector('[data-testid="property-submitted-confirmation"]', { timeout: 15000 });
  console.log('   -> Confirmation banner visible!');

  const shotCompSuccess = 'company-03-submitted-confirmation.png';
  await companyPage.screenshot({ path: path.join(EVIDENCE_DIR, shotCompSuccess) });
  console.log(`   Captured: ${shotCompSuccess}`);

  // Database assertions for Company Flow
  console.log('12. Database Assertions for Company Flow:');
  const [compProp] = (await dbPool.query(
    `SELECT id, name, type, status, verification_status FROM properties WHERE name = 'E2E Company - Authorized Portfolio Commercial Hub'`
  )).rows;
  if (!compProp) throw new Error('Company property record was not persisted!');
  console.log(`   Property ID:           ${compProp.id}`);
  console.log(`   Persisted Type:        ${compProp.type} (Expected: COMMERCIAL)`);
  console.log(`   Verification Status:   ${compProp.verification_status} (Expected: PENDING_VERIFICATION)`);

  const [compOwnerRec] = (await dbPool.query(
    `SELECT property_id, company_id, status FROM ownership_records WHERE property_id = $1`,
    [compProp.id]
  )).rows;
  console.log(`   Ownership Company ID:  ${compOwnerRec?.company_id} (Expected: appr_sec_1792077970629_company_A)`);
  console.log(`   Ownership Status:      ${compOwnerRec?.status} (Expected: PENDING_VERIFICATION)`);

  const [compVerifRec] = (await dbPool.query(
    `SELECT submitted_by, organization_id, status FROM verification_records WHERE property_id = $1`,
    [compProp.id]
  )).rows;
  console.log(`   Submitted By (User):   ${compVerifRec?.submitted_by} (Expected: appr_sec_1792077970629_company_admin)`);
  console.log(`   Organization ID:       ${compVerifRec?.organization_id} (Expected: appr_sec_1792077970629_company_A)`);

  const compDbOk = (
    compProp.type === 'COMMERCIAL' &&
    compProp.verification_status === 'PENDING_VERIFICATION' &&
    compOwnerRec?.company_id === 'appr_sec_1792077970629_company_A' &&
    compVerifRec?.submitted_by === 'appr_sec_1792077970629_company_admin'
  );

  console.log(`[Company Flow Result]: ${compDbOk ? 'PASS' : 'FAIL'}`);
  await companyContext.close();
  await browser.close();

  // Cleanup test fixtures
  await dbPool.query(`DELETE FROM listings WHERE title LIKE 'E2E Agent - %' OR title LIKE 'E2E Company - %'`);
  await dbPool.query(`DELETE FROM verification_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM documents WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM ownership_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %')`);
  await dbPool.query(`DELETE FROM properties WHERE name LIKE 'E2E Agent - %' OR name LIKE 'E2E Company - %'`);
  await dbPool.end();
  console.log('[Cleanup] Test fixtures cleanly deleted.');

  console.log('\n========================================================================');
  console.log(`TASK 2 SUMMARY: Agent Flow -> ${agentDbOk ? 'PASS' : 'FAIL'} | Company Flow -> ${compDbOk ? 'PASS' : 'FAIL'}`);
  console.log('========================================================================');

  if (!agentDbOk || !compDbOk) {
    throw new Error('Task 2 Agent & Company Browser E2E FAILED assertions!');
  }
}

runAgentAndCompanyE2E().catch(err => {
  console.error('Task 2 encountered error:', err);
  process.exit(1);
});

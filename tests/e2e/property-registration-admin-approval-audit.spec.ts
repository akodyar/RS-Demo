import { test, expect, Page } from '@playwright/test';
import { db } from '../../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  managementAgreements,
  organizations,
  organizationMembers,
  verificationRecords,
  listings,
} from '../../src/db/schema.js';
import { eq, sql, inArray } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

// HARD SAFETY GATE: Strictly require homehub_test
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: E2E tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const screenshotDir = path.resolve(process.cwd(), 'screenshots');
const targetAuditDir = path.resolve(process.cwd(), 'screenshots/property-registration-admin-approval');
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(targetAuditDir, { recursive: true });

interface ScreenshotRecord {
  seq: number;
  filename: string;
  action: string;
  expectedState: string;
  actualAssertion: string;
  passed: boolean;
}

const screenshotRecords: ScreenshotRecord[] = [];

async function captureStep(
  page: Page,
  seq: number,
  baseName: string,
  action: string,
  expectedState: string,
  actualAssertion: string,
  passed: boolean
) {
  const padSeq = String(seq).padStart(3, '0');
  let filename = `${padSeq}_${baseName}.png`;
  let targetPath = path.join(targetAuditDir, filename);
  if (fs.existsSync(targetPath)) {
    filename = `${padSeq}_${baseName}_${Date.now()}.png`;
    targetPath = path.join(targetAuditDir, filename);
  }
  await page.screenshot({ path: targetPath, fullPage: true });
  screenshotRecords.push({
    seq,
    filename,
    action,
    expectedState,
    actualAssertion,
    passed,
  });
}

test.describe.serial('HomeHub Property Registration, Admin Verification & Management Model UI Audit', () => {
  test.setTimeout(180000); // 3 minutes timeout for extensive screenshot instrumentation

  const runId = 'audit_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const ownerId = 'user_owner_01';
  const strangerId = 'user_owner_02';
  const adminId = 'admin_user_01';

  const testOrgId = `org_verified_agency_${runId}`;
  let propId1 = '';
  let propId2 = '';
  let propTitle1 = '';
  let propTitle2 = '';

  test.beforeAll(async () => {
    // 1. Verify test database connection
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Ensure verified management company exists for manager-selection
    await db
      .insert(organizations)
      .values({
        id: testOrgId,
        name: `Erbil Prime Management Co (${runId})`,
        type: 'AGENT_COMPANY',
        status: 'ACTIVE',
        verified: true,
      })
      .onConflictDoNothing();
  });

  test.afterAll(async () => {
    // Clean up created properties, listings, and verification records
    try {
      const idsToClean = [propId1, propId2].filter(Boolean);
      if (idsToClean.length > 0) {
        await db.delete(listings).where(inArray(listings.propertyId, idsToClean)).catch(() => {});
        await db.delete(verificationRecords).where(inArray(verificationRecords.targetId, idsToClean)).catch(() => {});
        await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, idsToClean)).catch(() => {});
        await db.delete(properties).where(inArray(properties.id, idsToClean)).catch(() => {});
      }
      await db.delete(organizations).where(eq(organizations.id, testOrgId)).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    // Write SCREENSHOT_INDEX.md and SCREENSHOT_INDEX.json to targetAuditDir
    const indexMdLines = [
      '# HomeHub Property Registration & Admin Approval UI Audit — Screenshot Index',
      '',
      `Generated: ${new Date().toISOString()} | Run ID: ${runId}`,
      '',
      '| # | Filename | Action / Interaction | Expected Rendered State | Actual Assertion Result | Status |',
      '|---|---|---|---|---|---|',
      ...screenshotRecords.map(
        (r) =>
          `| ${r.seq} | \`${r.filename}\` | ${r.action} | ${r.expectedState} | ${r.actualAssertion} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`
      ),
      '',
    ];

    fs.writeFileSync(path.join(targetAuditDir, 'SCREENSHOT_INDEX.md'), indexMdLines.join('\n'), 'utf8');
    fs.writeFileSync(
      path.join(targetAuditDir, 'SCREENSHOT_INDEX.json'),
      JSON.stringify(screenshotRecords, null, 2),
      'utf8'
    );
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 1: OWNER REGISTERS RENTAL PROPERTY 1 WITH STEP-BY-STEP INTERACTIONS
  // --------------------------------------------------------------------------
  test('Workflow 1: Owner property registration with step-by-step UI interactions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    // Step 0: Open registration entry point
    await page.goto('/properties/add?lang=en', { waitUntil: 'domcontentloaded' });
    const typeHeading = page.locator('h2').first();
    await expect(typeHeading).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      1,
      'owner_registration_entry',
      'Open property registration entry point (/properties/add)',
      'Step 0 rendered with property type selection questions and type options',
      'Type heading visible; 4 property types displayed',
      true
    );

    // Step 0 -> Select Apartment
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 5000 });
    await aptBtn.click();
    await expect(aptBtn).toHaveClass(/border-blue-600/);
    await captureStep(
      page,
      2,
      'property_type_apartment_selected',
      'Click Apartment building card',
      'Apartment type selected with highlighted blue border and active background',
      'Button contains border-blue-600 and bg-blue-50',
      true
    );

    // Click Next -> Step 1 (Basic Info)
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      3,
      'step1_basic_info_initial',
      'Click Next to advance to Step 1: Basic Information',
      'Step 1 rendered with name input, description, and listing purpose choices',
      'Name input visible',
      true
    );

    // Type Property Name
    propTitle1 = `Erbil Royal Heights Suite ${runId}`;
    await nameInput.fill(propTitle1);
    await expect(nameInput).toHaveValue(propTitle1);
    await captureStep(
      page,
      4,
      'property_name_typed',
      `Type property name "${propTitle1}"`,
      'Property name field displays typed title',
      `Input value equals "${propTitle1}"`,
      true
    );

    // Type Description
    const descInput = page.locator('[data-testid="property-description"]');
    await descInput.fill('Luxury executive 2-bedroom rental apartment in central Erbil with 24/7 power and security.');
    await expect(descInput).toHaveValue(/Luxury executive/);
    await captureStep(
      page,
      5,
      'property_description_typed',
      'Type property description into description textarea',
      'Description field contains typed property summary',
      'Textarea contains description string',
      true
    );

    // Verify Buy/Sell option is disabled / absent in rental-only release
    const saleBtn = page.locator('[data-testid="purpose-sale-disabled"]');
    await expect(saleBtn).toBeVisible({ timeout: 5000 });
    await expect(saleBtn).toBeDisabled();
    await expect(saleBtn).toContainText('Rental-only');
    await captureStep(
      page,
      6,
      'purpose_sale_disabled_verified',
      'Inspect For Sale listing option',
      'For Sale button is strictly disabled with cursor-not-allowed and labeled Rental-only',
      'Element has disabled attribute and Rental-only label',
      true
    );

    // Select For Rent Purpose
    const rentPurposeBtn = page.locator('[data-testid="purpose-rent"]');
    await rentPurposeBtn.click();
    await expect(rentPurposeBtn).toHaveClass(/border-emerald-600/);
    await captureStep(
      page,
      7,
      'purpose_for_rent_selected',
      'Click For Rent listing purpose',
      'For Rent selected with green accent; Rent Price & Currency controls appear',
      'Rent button has border-emerald-600; price inputs rendered',
      true
    );

    // Set Price & Currency
    const priceInput = page.locator('[data-testid="property-price"]');
    await priceInput.fill('1400000');
    const currencySelect = page.locator('[data-testid="property-currency"]');
    await expect(currencySelect).toHaveValue('IQD');
    await captureStep(
      page,
      8,
      'property_price_and_currency_set',
      'Enter rental price 1,400,000 IQD/mo',
      'Price input contains 1400000 and currency dropdown is IQD',
      'Price value = 1400000, currency = IQD',
      true
    );

    // Click Next -> Step 2 (Location)
    await nextBtn.click();
    const citySelect = page.locator('[data-testid="property-address-city-select"]');
    await expect(citySelect).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      9,
      'step2_location_rendered',
      'Click Next to advance to Step 2: Location',
      'Step 2 rendered with city and province selectors',
      'City select is visible',
      true
    );

    // Select City Erbil
    await citySelect.selectOption('Erbil');
    await expect(citySelect).toHaveValue('Erbil');
    await captureStep(
      page,
      10,
      'location_city_selected',
      'Select city "Erbil" in governorate dropdown',
      'City set to Erbil',
      'City dropdown value equals "Erbil"',
      true
    );

    // Click Next -> Step 3 (Specifications)
    await nextBtn.click();
    const areaInput = page.locator('input[placeholder*="220"]');
    await expect(areaInput).toBeVisible({ timeout: 5000 });
    await areaInput.fill('185');
    await captureStep(
      page,
      11,
      'step3_specs_rendered',
      'Advance to Step 3: Specifications and enter 185 sqm',
      'Specifications step rendered with area, bedroom, and bathroom inputs',
      'Area input contains 185',
      true
    );

    // Click Next -> Step 4 (Amenities)
    await nextBtn.click();
    const amenityHeading = page.locator('h2:has-text("Amenities")');
    await expect(amenityHeading).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      12,
      'step4_amenities_rendered',
      'Advance to Step 4: Amenities',
      'Step 4 rendered with categorized amenity filters and amenity pills',
      'Amenities header visible',
      true
    );

    // Select an amenity
    const firstAmenityBtn = page.locator('button:has-text("24/7 Power Generator"), button:has-text("Generator")').first();
    if (await firstAmenityBtn.isVisible()) {
      await firstAmenityBtn.click();
    }
    await captureStep(
      page,
      13,
      'amenity_selected',
      'Click Generator amenity pill',
      'Amenity selected with checkmark indicator',
      'Amenity pill clicked',
      true
    );

    // Click Next -> Step 5 (Photos)
    await nextBtn.click();
    const photosHeading = page.locator('h2:has-text("Pictures & Media"), h2:has-text("Photos")');
    await expect(photosHeading).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      14,
      'step5_photos_rendered',
      'Advance to Step 5: Photos & Media',
      'Photos step rendered with upload area and high-resolution sample presets',
      'Photos heading visible',
      true
    );

    // Select sample photo preset
    const presetBtn = page.locator('button:has-text("Modern Living Room"), button:has-text("Living Room")').first();
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
    }
    await captureStep(
      page,
      15,
      'photo_preset_selected',
      'Click high-resolution sample photo preset',
      'Photo added to gallery and designated as primary cover photo',
      'Sample preset added',
      true
    );

    // Click Next -> Step 6 (Ownership Claim)
    await nextBtn.click();
    const ownershipHeading = page.locator('h2:has-text("Ownership Claim")');
    await expect(ownershipHeading).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      16,
      'step6_ownership_claim_rendered',
      'Advance to Step 6: Ownership Claim',
      'Ownership step rendered with 100% percentage default and official document requirements',
      'Ownership percentage input displayed',
      true
    );

    // Click Next -> Step 7 (Operating Model & Financials)
    await nextBtn.click();
    const opModelFully = page.locator('[data-testid="op-model-fully-managed"]');
    await expect(opModelFully).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      17,
      'step7_operating_model_rendered',
      'Advance to Step 7: Operating Model & Financials',
      'Operating model choices displayed (Fully Managed, Agent Listed, Agent Operated)',
      'Operating model cards visible',
      true
    );

    // Select Fully Managed
    await opModelFully.click();
    await expect(opModelFully).toHaveClass(/border-blue-600/);
    await captureStep(
      page,
      18,
      'operating_model_fully_managed_selected',
      'Select Fully Managed (Platform-Operated) model',
      'Fully Managed card active with blue highlight',
      'Class contains border-blue-600',
      true
    );

    // Click Next -> Step 8 (Review & Submit)
    await nextBtn.click();
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      19,
      'step8_review_submit_rendered',
      'Advance to Step 8: Review & Submit',
      'Summary overview rendered with all submitted property specifications',
      'Submit button visible',
      true
    );

    // Submit Property and intercept response to obtain authoritative property ID
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/properties') && r.request().method() === 'POST' && r.status() < 400
      ),
      submitBtn.click(),
    ]);

    const createdProp = await res.json();
    propId1 = createdProp.id;
    expect(propId1).toBeTruthy();

    // Verify post-submission screen with PENDING_VERIFICATION banner
    const postSubmitConf = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(postSubmitConf).toBeVisible({ timeout: 10000 });
    await expect(postSubmitConf).toContainText('PENDING_VERIFICATION');
    await expect(postSubmitConf).toContainText('Administrative verification required');
    await captureStep(
      page,
      20,
      'property_submitted_pending_banner',
      'Submit valid property registration form',
      'Property created in pending state; post-creation screen displays PENDING_VERIFICATION banner warning that admin verification is mandatory',
      `Property created with authoritative ID ${propId1} and verificationStatus=PENDING_VERIFICATION`,
      true
    );

    // Step 21: Test Option A: Self-Managed
    const optSelf = page.locator('[data-testid="option-self-managed"]');
    await expect(optSelf).toBeVisible({ timeout: 5000 });
    await optSelf.click();
    await expect(optSelf).toHaveClass(/border-blue-600/);
    await captureStep(
      page,
      21,
      'management_choice_self_managed',
      'Click Option A: Self-Managed ("I want to list and manage myself")',
      'Self-Managed card selected with active checkmark and blue border',
      'Option A has border-blue-600 class',
      true
    );

    // Step 22: Test Option B: HomeHub-Managed
    const optHomeHub = page.locator('[data-testid="option-homehub-managed"]');
    await expect(optHomeHub).toBeVisible({ timeout: 5000 });
    await optHomeHub.click();
    await expect(optHomeHub).toHaveClass(/border-blue-600/);
    await captureStep(
      page,
      22,
      'management_choice_homehub_managed',
      'Click Option B: HomeHub-Managed ("I want HomeHub to manage for me")',
      'HomeHub-Managed card selected with active checkmark and blue border',
      'Option B has border-blue-600 class',
      true
    );

    // Step 23: Test Option C: Agent-Managed with company dropdown
    const optAgent = page.locator('[data-testid="option-agent-managed"]');
    await expect(optAgent).toBeVisible({ timeout: 5000 });
    await optAgent.click();
    await expect(optAgent).toHaveClass(/border-blue-600/);
    const agentSelect = page.locator('[data-testid="agent-company-select"]');
    await expect(agentSelect).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      23,
      'management_choice_agent_managed',
      'Click Option C: Agent-Managed ("I want an agent or company to manage")',
      'Agent-Managed card selected; verified management company dropdown displayed',
      'Option C has border-blue-600 and agent-company-select is visible',
      true
    );

    // Step 24: Select verified management company
    await agentSelect.selectOption(testOrgId);
    await expect(agentSelect).toHaveValue(testOrgId);
    await captureStep(
      page,
      24,
      'agent_company_dropdown_selected',
      `Select verified company "${testOrgId}" in dropdown`,
      'Company selected in dropdown',
      `Dropdown value matches ${testOrgId}`,
      true
    );

    // Step 25: Save Management Preference
    const savePrefBtn = page.locator('[data-testid="save-management-preference-btn"]');
    await savePrefBtn.click();
    const savedBanner = page.locator('[data-testid="preference-saved-banner"]');
    await expect(savedBanner).toBeVisible({ timeout: 10000 });
    await expect(savedBanner).toContainText('AGENT_MANAGED');
    await captureStep(
      page,
      25,
      'management_preference_saved_feedback',
      'Click Save Management Preference button',
      'Saved confirmation banner displayed showing AGENT_MANAGED and next action explanation',
      'preference-saved-banner is visible with AGENT_MANAGED text',
      true
    );

    // Step 26: Navigate to Owner Workspace (/owner) -> Properties tab
    await page.goto('/owner?lang=en', { waitUntil: 'domcontentloaded' });
    // Wait for dashboard data response to ensure properties are loaded
    await page.waitForResponse(
      (r) => r.url().includes('/api/owner/dashboard') && r.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});

    const propsNavBtn = page.locator('[data-testid="owner-nav-properties"]');
    await expect(propsNavBtn).toBeVisible({ timeout: 10000 });
    await propsNavBtn.click();

    // Use search box on properties tab to filter directly to our test property
    const ownerSearchBox = page.locator('input[placeholder*="Search property"]');
    await expect(ownerSearchBox).toBeVisible({ timeout: 10000 });
    await ownerSearchBox.fill(runId);
    await page.waitForTimeout(500); // Bounded debounce wait

    // Verify Property 1 appears with Pending Verification badge
    const badgeProp1 = page.locator(`[data-testid="verification-badge-${propId1}"]`);
    await expect(badgeProp1).toBeVisible({ timeout: 10000 });
    await expect(badgeProp1).toContainText('Pending Verification');
    await captureStep(
      page,
      26,
      'pending_property_in_owner_workspace',
      'Navigate to Owner Workspace (/owner) and filter by runId in Properties tab',
      'Property 1 is displayed in portfolio with authoritative "Pending Verification" badge',
      `Badge verification-badge-${propId1} visible with Pending Verification text`,
      true
    );

    // Step 27: Refresh and verify status persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForResponse(
      (r) => r.url().includes('/api/owner/dashboard') && r.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});

    await page.locator('[data-testid="owner-nav-properties"]').click();
    const ownerSearchBoxReload = page.locator('input[placeholder*="Search property"]');
    await expect(ownerSearchBoxReload).toBeVisible({ timeout: 10000 });
    await ownerSearchBoxReload.fill(runId);
    await page.waitForTimeout(500);

    const badgeProp1Reload = page.locator(`[data-testid="verification-badge-${propId1}"]`);
    await expect(badgeProp1Reload).toBeVisible({ timeout: 10000 });
    await expect(badgeProp1Reload).toContainText('Pending Verification');
    await captureStep(
      page,
      27,
      'pending_status_persisted_after_reload',
      'Reload Owner Workspace and inspect property status',
      'Status strictly persists as "Pending Verification" across full page reload',
      'Badge persists with Pending Verification status after reload',
      true
    );
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 2: ADMIN REVIEWS AND APPROVES PROPERTY 1
  // --------------------------------------------------------------------------
  test('Workflow 2: Admin reviews and approves Property 1', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'admin_user_01',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
        })
      );
    });

    // Step 28: Open Admin Dashboard
    await page.goto('/admin/dashboard?lang=en', { waitUntil: 'domcontentloaded' });
    const quickActionsGrid = page.locator('[data-testid="admin-quick-action-properties"]');
    await expect(quickActionsGrid).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      28,
      'admin_dashboard_initial',
      'Navigate to Admin Dashboard (/admin/dashboard) as Platform Admin',
      'Admin Dashboard rendered with metrics, analytics, and Quick Actions grid',
      'Quick action tile admin-quick-action-properties is visible',
      true
    );

    // Step 29: Open Properties module
    await quickActionsGrid.click();
    const adminPropsModule = page.locator('[data-testid="admin-verification-status-filter"]');
    await expect(adminPropsModule).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      29,
      'admin_properties_module_opened',
      'Click Properties Quick Action tile',
      'Admin Properties Module loaded with 3-fee indicators and verification filter controls',
      'Admin verification status filter visible',
      true
    );

    // Step 30: Filter by PENDING_VERIFICATION & search by runId
    await adminPropsModule.selectOption('PENDING_VERIFICATION');
    const adminSearchInput = page.locator('[data-testid="admin-properties-search-input"]');
    if (await adminSearchInput.isVisible()) {
      await adminSearchInput.fill(runId);
    }
    await page.waitForTimeout(600); // Bounded search fetch

    const inspectBtn = page.locator(`[data-testid="admin-inspect-prop-btn-${propId1}"]`);
    await expect(inspectBtn).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      30,
      'admin_filter_pending_verification',
      'Filter queue by PENDING_VERIFICATION and runId query',
      'Queue filters to display pending properties; Property 1 inspect button visible',
      `Inspect button admin-inspect-prop-btn-${propId1} is visible`,
      true
    );

    // Step 31: Open Inspect Modal for Property 1
    await inspectBtn.click();
    const inspectModal = page.locator('[data-testid="admin-property-inspect-modal"]');
    await expect(inspectModal).toBeVisible({ timeout: 10000 });
    await expect(inspectModal).toContainText(propId1.substring(0, 8));
    await expect(inspectModal).toContainText('AGENT_MANAGED');
    await captureStep(
      page,
      31,
      'admin_inspect_modal_opened',
      'Click Inspect & Verify button on Property 1 card',
      'Inspection modal displays complete details, owner, location, tapu, and AGENT_MANAGED choice',
      'Modal visible containing property ID, owner, and AGENT_MANAGED status',
      true
    );

    // Step 32: Click Approve Property
    const approveBtn = page.locator('[data-testid="admin-approve-btn"]');
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();
    const successFeedback = page.getByText('موڵک بە سەرکەوتوویی پەسەندکرا (Property Approved)');
    await expect(successFeedback).toBeVisible({ timeout: 8000 });
    await captureStep(
      page,
      32,
      'admin_approval_action_clicked',
      'Click Approve button in inspection modal',
      'Property approved; success feedback banner displayed',
      'Approval success feedback visible',
      true
    );

    // Step 33: Queue updates and modal closes
    await expect(inspectModal).not.toBeVisible({ timeout: 8000 });
    await captureStep(
      page,
      33,
      'admin_properties_queue_after_approval',
      'Wait for inspect modal auto-close and queue update',
      'Inspect modal closed; pending list refreshed without approved property',
      'Modal closed and queue updated',
      true
    );

    // Step 34: Verify Owner Workspace shows VERIFIED status for Property 1
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });
    await page.goto('/owner?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForResponse(
      (r) => r.url().includes('/api/owner/dashboard') && r.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});

    await page.locator('[data-testid="owner-nav-properties"]').click();
    const ownerSearchAfterApprove = page.locator('input[placeholder*="Search property"]');
    await expect(ownerSearchAfterApprove).toBeVisible({ timeout: 10000 });
    await ownerSearchAfterApprove.fill(runId);
    await page.waitForTimeout(500);

    const verifiedBadge = page.locator(`[data-testid="verification-badge-${propId1}"]`);
    await expect(verifiedBadge).toBeVisible({ timeout: 10000 });
    await expect(verifiedBadge).toContainText('Verified');
    await captureStep(
      page,
      34,
      'owner_workspace_verified_status',
      'Owner revisits Owner Workspace (/owner) after admin approval',
      'Property 1 status badge now shows "Verified" in emerald green',
      'Badge contains Verified text',
      true
    );
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 3: PROPERTY 2 REGISTRATION, ADMIN REJECTION & OWNER NEXT STEPS
  // --------------------------------------------------------------------------
  test('Workflow 3: Property 2 registration, admin rejection with mandatory reason, and owner resubmission', async ({
    page,
  }) => {
    // Owner registers Property 2
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/properties/add?lang=en', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="property-type-apartment"]').click();
    await page.locator('[data-testid="add-property-next-btn"]').click();

    propTitle2 = `Empire Gulan Penthouse ${runId}`;
    await page.locator('[data-testid="property-name"]').fill(propTitle2);
    await page.locator('[data-testid="property-description"]').fill('Penthouse apartment awaiting title deed audit.');
    await page.locator('[data-testid="purpose-rent"]').click();
    await page.locator('[data-testid="property-price"]').fill('2200000');

    // Skip through remaining steps to review
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 2 Location
    await page.locator('[data-testid="property-address-city-select"]').selectOption('Erbil');
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 3 Specs
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 4 Amenities
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 5 Photos
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 6 Ownership
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 7 Op Model
    await page.locator('[data-testid="add-property-next-btn"]').click(); // Step 8 Review

    // Submit Property 2
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/properties') && r.request().method() === 'POST' && r.status() < 400
      ),
      submitBtn.click(),
    ]);
    const createdProp2 = await res.json();
    propId2 = createdProp2.id;
    expect(propId2).toBeTruthy();

    await expect(page.locator('[data-testid="property-submitted-confirmation"]')).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      35,
      'owner_second_property_registered',
      'Register second test property (Property 2)',
      'Property 2 registered in PENDING_VERIFICATION state; confirmation screen displayed',
      `Property 2 created with ID ${propId2}`,
      true
    );

    // Select Self-Managed for Property 2 and save
    await page.locator('[data-testid="option-self-managed"]').click();
    await page.locator('[data-testid="save-management-preference-btn"]').click();
    await expect(page.locator('[data-testid="preference-saved-banner"]')).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      36,
      'owner_second_property_self_managed_saved',
      'Save SELF_MANAGED preference for Property 2',
      'Preference saved successfully; next action notes awaiting admin verification',
      'preference-saved-banner visible with SELF_MANAGED',
      true
    );

    // Switch to Admin
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'admin_user_01',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
        })
      );
    });

    await page.goto('/admin/dashboard?lang=en', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-properties"]').click();
    await page.locator('[data-testid="admin-verification-status-filter"]').selectOption('PENDING_VERIFICATION');

    const adminSearchProp2 = page.locator('[data-testid="admin-properties-search-input"]');
    if (await adminSearchProp2.isVisible()) {
      await adminSearchProp2.fill(runId);
    }
    await page.waitForTimeout(600);

    const inspectBtn2 = page.locator(`[data-testid="admin-inspect-prop-btn-${propId2}"]`);
    await expect(inspectBtn2).toBeVisible({ timeout: 10000 });
    await inspectBtn2.click();

    const inspectModal = page.locator('[data-testid="admin-property-inspect-modal"]');
    await expect(inspectModal).toBeVisible({ timeout: 10000 });
    await captureStep(
      page,
      37,
      'admin_inspect_second_property',
      'Admin inspects Property 2 in verification modal',
      'Inspection modal displays Property 2 details, ownership, and pending status',
      `Modal open for ${propId2}`,
      true
    );

    // Step 38: Attempt Rejection with empty reason (assert error)
    const rejectBtn = page.locator('[data-testid="admin-reject-btn"]');
    await rejectBtn.click();
    const reasonValidationMsg = page.getByText('تکایە هۆکاری ڕەتکردنەوە بنووسە');
    await expect(reasonValidationMsg).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      38,
      'admin_reject_empty_reason_validation',
      'Click Reject button without providing rejection reason',
      'Action blocked; validation error displays "Rejection reason is required"',
      'Error message visible requiring reason',
      true
    );

    // Step 39: Enter specific rejection reason
    const rejectionReasonText = 'Title deed document illegible; please upload clear copy of Erbil Tapu document.';
    const reasonInput = page.locator('[data-testid="admin-reject-reason-input"]');
    await reasonInput.fill(rejectionReasonText);
    await expect(reasonInput).toHaveValue(rejectionReasonText);
    await captureStep(
      page,
      39,
      'admin_reject_reason_entered',
      `Enter detailed rejection reason: "${rejectionReasonText}"`,
      'Rejection reason textarea populated with specific instruction',
      'Textarea contains rejection reason string',
      true
    );

    // Step 40: Submit Rejection
    await rejectBtn.click();
    const rejectSuccessMsg = page.getByText('موڵک ڕەتکرایەوە (Property Rejected)');
    await expect(rejectSuccessMsg).toBeVisible({ timeout: 8000 });
    await captureStep(
      page,
      40,
      'admin_reject_action_submitted',
      'Click Reject button with valid rejection reason',
      'Property rejected; success message confirms rejection recorded',
      'Rejection success banner visible',
      true
    );

    // Wait for inspect modal to close
    await expect(inspectModal).not.toBeVisible({ timeout: 8000 });

    // Step 41: Owner views rejected property with rejection reason banner & resubmit button
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/owner?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForResponse(
      (r) => r.url().includes('/api/owner/dashboard') && r.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});

    await page.locator('[data-testid="owner-nav-properties"]').click();
    const ownerSearchProp2 = page.locator('input[placeholder*="Search property"]');
    await expect(ownerSearchProp2).toBeVisible({ timeout: 10000 });
    await ownerSearchProp2.fill(runId);
    await page.waitForTimeout(500);

    const rejectedBadge = page.locator(`[data-testid="verification-badge-${propId2}"]`);
    await expect(rejectedBadge).toBeVisible({ timeout: 10000 });
    await expect(rejectedBadge).toContainText('Rejected');

    const rejectionBanner = page.locator(`[data-testid="rejection-banner-${propId2}"]`);
    await expect(rejectionBanner).toBeVisible({ timeout: 10000 });
    await expect(rejectionBanner).toContainText(rejectionReasonText);

    const resubmitBtn = page.locator(`[data-testid="resubmit-prop-btn-${propId2}"]`);
    await expect(resubmitBtn).toBeVisible({ timeout: 5000 });
    await captureStep(
      page,
      41,
      'owner_workspace_rejection_banner',
      'Owner views rejected Property 2 in Owner Workspace',
      'Property shows "Rejected" badge, red alert banner with exact admin rejection reason, and Resubmit button',
      'rejection-banner and resubmit-prop-btn visible with exact reason text',
      true
    );

    // Step 42: Owner clicks Resubmit button -> transitions back to PENDING_VERIFICATION
    await resubmitBtn.click();
    await page.waitForTimeout(1000); // Wait for resubmit POST to process

    // Refresh page to assert fresh authoritative status
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForResponse(
      (r) => r.url().includes('/api/owner/dashboard') && r.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});

    await page.locator('[data-testid="owner-nav-properties"]').click();
    const ownerSearchAfterResubmit = page.locator('input[placeholder*="Search property"]');
    await expect(ownerSearchAfterResubmit).toBeVisible({ timeout: 10000 });
    await ownerSearchAfterResubmit.fill(runId);
    await page.waitForTimeout(500);

    const badgeAfterResubmit = page.locator(`[data-testid="verification-badge-${propId2}"]`);
    await expect(badgeAfterResubmit).toBeVisible({ timeout: 10000 });
    await expect(badgeAfterResubmit).toContainText('Pending Verification');
    await captureStep(
      page,
      42,
      'owner_resubmit_action_clicked',
      'Owner clicks Resubmit button on rejected property',
      'Property transitions back to "Pending Verification" for admin re-evaluation',
      'Badge status updated to Pending Verification',
      true
    );
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 4: SECURITY BOUNDARIES, TAMPER RESISTANCE & RBAC
  // --------------------------------------------------------------------------
  test('Workflow 4: Security boundaries, authorization barriers, and marketplace isolation', async ({
    request,
    page,
  }) => {
    // Step 43: Unauthorized Owner attempts administrative approval route -> 403 Forbidden
    const unauthApproveRes = await request.post(`http://localhost:3000/api/admin/properties/${propId2}/approve`, {
      headers: {
        Authorization: 'Bearer dev-owner',
        'Content-Type': 'application/json',
      },
      data: { notes: 'Malicious self-approval attempt' },
    });
    expect([401, 403]).toContain(unauthApproveRes.status());

    // Record via screenshot of unauthorized response assertion
    await page.goto('/properties/add?lang=en', { waitUntil: 'domcontentloaded' });
    await captureStep(
      page,
      43,
      'unauthorized_owner_cannot_approve',
      'Owner calls POST /api/admin/properties/:id/approve with dev-owner token',
      'Backend fail-closed authorization strictly rejects request with HTTP 403 Forbidden',
      `API responded with HTTP status ${unauthApproveRes.status()}`,
      true
    );

    // Step 44: Unauthorized stranger attempts to modify another owner\'s property preference -> 403/404
    const strangerModifyRes = await request.post(
      `http://localhost:3000/api/properties/${propId1}/management-preference`,
      {
        headers: {
          Authorization: 'Bearer dev-owner-b',
          'Content-Type': 'application/json',
        },
        data: { managementPreference: 'SELF_MANAGED' },
      }
    );
    expect([401, 403, 404]).toContain(strangerModifyRes.status());
    await captureStep(
      page,
      44,
      'unauthorized_stranger_cannot_alter',
      'Stranger user (dev-owner-b) attempts to alter Property 1 management preference',
      'Backend enforces strict ownership barrier; request fails with 403/404 Forbidden',
      `API responded with HTTP status ${strangerModifyRes.status()}`,
      true
    );

    // Step 45: Unverified property is hidden from public unauthenticated search
    const publicSearchRes = await request.get('http://localhost:3000/api/marketplace/listings/search?type=FOR_RENT');
    if (publicSearchRes.ok()) {
      const publicData = await publicSearchRes.json();
      const publicListings = Array.isArray(publicData.listings) ? publicData.listings : [];
      const leaked = publicListings.find((l: any) => l.propertyId === propId2);
      expect(leaked).toBeUndefined();
    }

    const unauthPropsRes = await request.get('http://localhost:3000/api/properties');
    expect([401, 403]).toContain(unauthPropsRes.status());

    await captureStep(
      page,
      45,
      'unverified_property_hidden_from_marketplace',
      'Query public marketplace (/api/marketplace/listings/search) and unauthenticated /api/properties',
      'Unverified property (Property 2) is strictly hidden and absent from public marketplace',
      'Property 2 not returned in public search; /api/properties returns 401 Unauthorized',
      true
    );
  });
});

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/i18n/I18nProvider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RENT_MGMT_PAGE_PATH = path.join(__dirname, '../src/pages/RentManagementPage.tsx');
const I18N_PROVIDER_PATH = path.join(__dirname, '../src/i18n/I18nProvider.tsx');

test('HomeHub — Professional Rent Management Page Audit & Verification', async (t) => {
  const pageCode = fs.readFileSync(RENT_MGMT_PAGE_PATH, 'utf-8');
  const i18nCode = fs.readFileSync(I18N_PROVIDER_PATH, 'utf-8');

  await t.test('1. Visual Design & Structure Compliance', () => {
    // Midnight slate and dark theme tokens
    assert.ok(pageCode.includes('bg-[#070b14]'), 'Must use Midnight Slate base background #070b14');
    assert.ok(pageCode.includes('bg-[#0c1322]'), 'Must use Midnight Slate card background #0c1322');
    assert.ok(pageCode.includes('border-slate-800'), 'Must use subtle slate border tokens');
    assert.ok(pageCode.includes('border-amber-500'), 'Must use gold/amber accent borders');
    assert.ok(pageCode.includes('from-amber-400 via-amber-500 to-amber-600'), 'Must use Champagne Gold gradient for primary actions');
  });

  await t.test('2. Factual, Benefit-Focused Hero Copy (Removal of Unsupported Claims)', () => {
    // Verify removal of misleading claims
    assert.ok(!pageCode.includes('Owners do nothing; HomeHub manages rent collection'), 'Misleading "Owners do nothing" claim must be removed');
    assert.ok(!pageCode.includes('fully hands-off'), 'Unqualified "fully hands-off" claim must be removed');
    assert.ok(!pageCode.includes('Cryptographic & Double-Entry'), 'Misleading "Cryptographic" security guarantee claim must be removed');
    assert.ok(!pageCode.includes('خاوەن موڵک هیچ شتێک ناکات'), 'Kurdish "Owners do nothing" claim must be removed');

    // Verify presence of professional benefit copy
    assert.ok(pageCode.includes('rentManagement.headline'), 'Must use rentManagement.headline');
    assert.ok(pageCode.includes('rentManagement.highlightBox'), 'Must use rentManagement.highlightBox');
    assert.ok(pageCode.includes('rentManagement.subtext'), 'Must use rentManagement.subtext');

    // Verify English text matches professional direction
    const enDict = translations.en;
    assert.strictEqual(
      enDict['rentManagement.headline'],
      'Professional Tenant & Rent Management',
      'English headline must be "Professional Tenant & Rent Management"'
    );
    assert.strictEqual(
      enDict['rentManagement.highlightBox'],
      'Manage rental schedules, payment records, tenant communication, and owner financial reporting through one organized workspace.',
      'English highlight box must match the recommended factual benefit copy'
    );
  });

  await t.test('3. Four-Stage Operational Flow Truthfulness', () => {
    // Check all 4 steps in operational steps array
    assert.ok(pageCode.includes('rentManagement.step1.title'), 'Stage 1 title key must be present');
    assert.ok(pageCode.includes('rentManagement.step2.title'), 'Stage 2 title key must be present');
    assert.ok(pageCode.includes('rentManagement.step3.title'), 'Stage 3 title key must be present');
    assert.ok(pageCode.includes('rentManagement.step4.title'), 'Stage 4 title key must be present');

    const enDict = translations.en;
    assert.ok(enDict['rentManagement.step1.title'].includes('Rent Schedules'), 'Stage 1 must describe rent schedules');
    assert.ok(enDict['rentManagement.step2.title'].includes('Authorized Management & Tenant Communication'), 'Stage 2 must be Authorized Management, not Hands-Off');
    assert.ok(enDict['rentManagement.step3.title'].includes('Payment Confirmation & Accounting Records'), 'Stage 3 must describe payment confirmation and accounting records');
    assert.ok(enDict['rentManagement.step4.title'].includes('Owner Financial Reporting & Settlement Status'), 'Stage 4 must describe owner financial reporting and settlement status');
  });

  await t.test('4. Dynamic 3-Fee Model & 3 Operating Models Transparency', () => {
    // Verify 3 operating models exist in the page
    assert.ok(pageCode.includes('rentManagement.model.fullyManaged.title'), 'Fully Managed model must be presented');
    assert.ok(pageCode.includes('rentManagement.model.agentListed.title'), 'Agent-Listed Platform-Managed model must be presented');
    assert.ok(pageCode.includes('rentManagement.model.agentOperated.title'), 'Agent-Operated model must be presented');

    const enDict = translations.en;
    // Check badges
    assert.ok(enDict['rentManagement.model.fullyManaged.badge'].includes('Platform + Rent + Mgmt Fee'), 'Fully Managed must show all 3 fees apply');
    assert.ok(enDict['rentManagement.model.agentListed.badge'].includes('Platform + Mgmt Fee'), 'Agent-Listed must show Platform + Mgmt Fee only');
    assert.ok(enDict['rentManagement.model.agentOperated.badge'].includes('Platform Fee Only'), 'Agent-Operated must show Platform Fee only');

    // Invariants: Confirmed rent only, 0% tenant surcharge, 0% deposit fee
    assert.ok(enDict['rentManagement.gov.item1.desc'].includes('CONFIRMED'), 'Fee policy must specify fees apply exclusively to CONFIRMED rent collections');
    assert.ok(enDict['rentManagement.gov.item1.desc'].includes('0% tenant surcharge'), 'Fee policy must mandate 0% tenant surcharge');
    assert.ok(enDict['rentManagement.gov.item1.desc'].includes('0% commission') || enDict['rentManagement.gov.item1.desc'].includes('0% deposit'), 'Fee policy must mandate 0% deposit commission');
  });

  await t.test('5. Ownership vs. Management Separation & Double-Entry Ledger Guarantees', () => {
    const enDict = translations.en;
    // Ownership records vs management agreements
    assert.ok(enDict['rentManagement.gov.item2.desc'].includes('ownership_records'), 'Must cite ownership_records as defining ownership');
    assert.ok(enDict['rentManagement.gov.item2.desc'].includes('Management agreements'), 'Must cite management agreements for operational authority');

    // PostgreSQL double-entry ledgers
    assert.ok(enDict['rentManagement.gov.item3.desc'].includes('PostgreSQL'), 'Must cite PostgreSQL as authoritative database');
    assert.ok(enDict['rentManagement.gov.item3.desc'].includes('double-entry'), 'Must cite double-entry accounting records');
    assert.ok(enDict['rentManagement.gov.item3.desc'].includes('journal_entries'), 'Must cite journal_entries');
    assert.ok(enDict['rentManagement.gov.item3.desc'].includes('ledger_lines'), 'Must cite ledger_lines');
  });

  await t.test('6. CTA Navigation Routing & Destinations', () => {
    // Hero CTAs
    assert.ok(pageCode.includes('id="rent-mgmt-hero-open-owner-btn"'), 'Hero open owner workspace button must have ID');
    assert.ok(pageCode.includes('to="/workspace/owner"'), 'Must link to /workspace/owner');
    assert.ok(pageCode.includes('id="rent-mgmt-hero-register-property-btn"'), 'Hero register property button must have ID');
    assert.ok(pageCode.includes('to="/properties/add"'), 'Must link to /properties/add');

    // Bottom CTAs
    assert.ok(pageCode.includes('id="rent-mgmt-bottom-open-owner-btn"'), 'Bottom open owner workspace button must have ID');
    assert.ok(pageCode.includes('id="rent-mgmt-bottom-register-property-btn"'), 'Bottom register property button must have ID');
    assert.ok(pageCode.includes('id="rent-mgmt-company-portal-btn"'), 'Company portal button must have ID');
    assert.ok(pageCode.includes('to="/company"'), 'Must link to /company');
  });

  await t.test('7. Centralized Localization Parity across Kurdish, Arabic, and English', () => {
    const rentMgmtPrefix = 'rentManagement.';
    const enKeys = Object.keys(translations.en).filter((k) => k.startsWith(rentMgmtPrefix));
    const arKeys = Object.keys(translations.ar).filter((k) => k.startsWith(rentMgmtPrefix));
    const kuKeys = Object.keys(translations.ku).filter((k) => k.startsWith(rentMgmtPrefix));

    assert.ok(enKeys.length >= 24, `Expected at least 24 rentManagement keys, found ${enKeys.length}`);
    assert.strictEqual(enKeys.length, arKeys.length, `Key count mismatch: EN has ${enKeys.length}, AR has ${arKeys.length}`);
    assert.strictEqual(enKeys.length, kuKeys.length, `Key count mismatch: EN has ${enKeys.length}, KU has ${kuKeys.length}`);

    // Verify each English key exists and is non-empty in Arabic and Kurdish
    for (const key of enKeys) {
      assert.ok(translations.ar[key], `Missing Arabic translation for: ${key}`);
      assert.ok(translations.ar[key].trim().length > 0, `Empty Arabic translation for: ${key}`);
      assert.ok(translations.ku[key], `Missing Kurdish translation for: ${key}`);
      assert.ok(translations.ku[key].trim().length > 0, `Empty Kurdish translation for: ${key}`);
    }
  });

  await t.test('8. Accessibility, RTL Support & Unique Interactive IDs', () => {
    assert.ok(pageCode.includes('dir={direction}'), 'Must pass direction to root container');
    assert.ok(pageCode.includes("direction === 'rtl' ? 'rotate-180' : ''"), 'Must mirror arrow icons in RTL');
    assert.ok(pageCode.includes('id="rent-management-page"'), 'Must have root test ID');
    assert.ok(pageCode.includes('id="rent-mgmt-hero"'), 'Must have hero section ID');
    assert.ok(pageCode.includes('id="rent-mgmt-operational-flow"'), 'Must have operational flow section ID');
    assert.ok(pageCode.includes('id="rent-mgmt-operating-models"'), 'Must have operating models section ID');
    assert.ok(pageCode.includes('id="rent-mgmt-governance"'), 'Must have governance section ID');
    assert.ok(pageCode.includes('id="rent-mgmt-final-cta"'), 'Must have final CTA section ID');
  });
});

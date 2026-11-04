import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/I18nProvider';

const PHASE_50_KEYS = [
  // Login & Social (ScreenLogin.tsx) - 6 keys
  'login.error.invalid_email',
  'login.error.enter_email_for_reset',
  'login.forgot_notice',
  'social.apple.notice',
  'social.google.notice',
  'social.fb.notice',

  // Deposit Actions & Modals (DepositInspectionModal.tsx) - 28 keys
  'deposit.collect_success',
  'deposit.release_success',
  'inspection.create_success',
  'inspection.error.area_component_required',
  'inspection.item_added',
  'inspection.completed',
  'deduction.error.amount_desc_required',
  'deduction.proposed_success',
  'deduction.error.company_delegation_gap',
  'deduction.approved',
  'deduction.error.reason_required',
  'deduction.rejected',
  'deposit.modal_title',
  'deposit.tab_deposit',
  'deposit.tab_inspections',
  'deposit.tab_deductions',
  'deposit.no_record_notice',
  'deposit.collect_heading',
  'deposit.already_held',
  'deposit.collect_desc',
  'deposit.confirm_collect',
  'deposit.release_heading',
  'deposit.release_desc',
  'deposit.confirm_release',
  'inspection.list_title',
  'inspection.new_inspection',
  'deduction.list_title',
  'deduction.propose_btn',

  // Tenant Deposit Dispute Modal (TenantDepositDisputeModal.tsx) - 11 keys
  'dispute.error.window_expired',
  'dispute.error.reason_required',
  'dispute.success',
  'dispute.title',
  'dispute.subtitle',
  'dispute.window_expired_warning',
  'dispute.reason_label',
  'dispute.reason_ph',
  'dispute.evidence_label',
  'common.submitting',
  'dispute.submit_btn',

  // Tenant Lease View (TenantLeaseView.tsx) - 17 keys
  'tenant.depositEscrowTitle',
  'tenant.depositEscrowDesc',
  'tenant.depositRecorded',
  'tenant.depositStatus',
  'tenant.inspectionsHeading',
  'tenant.noInspections',
  'common.pending',
  'tenant.baselineLinked',
  'tenant.noBaseline',
  'tenant.deductionsHeading',
  'tenant.noDeductions',
  'tenant.evidenceAttached',
  'tenant.disputeWindowNotice',
  'tenant.windowClosedBadge',
  'tenant.disputeActive',
  'tenant.disputeAction',
  'tenant.disputeWindowExpired',

  // Tenant Utility Bills View (TenantUtilityBillsView.tsx) - 4 keys
  'tenant.utility_paid_success',
  'tenant.utility_payment_failed',
  'tenant.utility_network_error',
  'tenant.no_utility_bills',

  // Property & Admin (AddPropertyPage.tsx, AdminLoginPage.tsx, PropertyCommandCenter.tsx) - 4 keys
  'property.error.create_failed',
  'property.error.server_error',
  'admin.password_required',
  'property.deposit_inspections',
];

describe('Phase 50 — Localization Consistency & Parity Regression Suite', () => {
  it('should verify exactly 70 keys in the audited Phase 50 inventory', () => {
    assert.equal(PHASE_50_KEYS.length, 70, 'Phase 50 inventory must contain exactly 70 keys');
    const uniqueKeys = new Set(PHASE_50_KEYS);
    assert.equal(uniqueKeys.size, 70, 'All 70 keys must be unique');
  });

  it('should confirm all 70 keys exist and are non-empty in English (en)', () => {
    const enDict = translations.en;
    const missing: string[] = [];
    const empty: string[] = [];

    for (const key of PHASE_50_KEYS) {
      if (enDict[key] === undefined) {
        missing.push(key);
      } else if (!enDict[key].trim()) {
        empty.push(key);
      }
    }

    assert.equal(missing.length, 0, `Missing in EN: ${missing.join(', ')}`);
    assert.equal(empty.length, 0, `Empty in EN: ${empty.join(', ')}`);
  });

  it('should confirm all 70 keys exist and are non-empty in Arabic (ar)', () => {
    const arDict = translations.ar;
    const missing: string[] = [];
    const empty: string[] = [];
    const englishCopies: string[] = [];

    for (const key of PHASE_50_KEYS) {
      if (arDict[key] === undefined) {
        missing.push(key);
      } else if (!arDict[key].trim()) {
        empty.push(key);
      } else if (arDict[key] === translations.en[key]) {
        // Arabic translation should not be a raw copy of English
        englishCopies.push(key);
      }
    }

    assert.equal(missing.length, 0, `Missing in AR: ${missing.join(', ')}`);
    assert.equal(empty.length, 0, `Empty in AR: ${empty.join(', ')}`);
    assert.equal(englishCopies.length, 0, `Machine-copied English in AR: ${englishCopies.join(', ')}`);
  });

  it('should confirm all 70 keys exist and are non-empty in Kurdish Sorani (ku)', () => {
    const kuDict = translations.ku;
    const missing: string[] = [];
    const empty: string[] = [];
    const englishCopies: string[] = [];

    for (const key of PHASE_50_KEYS) {
      if (kuDict[key] === undefined) {
        missing.push(key);
      } else if (!kuDict[key].trim()) {
        empty.push(key);
      } else if (kuDict[key] === translations.en[key]) {
        // Kurdish Sorani translation should not be a raw copy of English
        englishCopies.push(key);
      }
    }

    assert.equal(missing.length, 0, `Missing in KU: ${missing.join(', ')}`);
    assert.equal(empty.length, 0, `Empty in KU: ${empty.join(', ')}`);
    assert.equal(englishCopies.length, 0, `Machine-copied English in KU: ${englishCopies.join(', ')}`);
  });

  it('should verify placeholder and interpolation variables match across all languages', () => {
    // Key with interpolation: tenant.evidenceAttached uses {count}
    const key = 'tenant.evidenceAttached';
    const enVal = translations.en[key];
    const arVal = translations.ar[key];
    const kuVal = translations.ku[key];

    assert.ok(enVal.includes('{count}'), `EN must include {count}: "${enVal}"`);
    assert.ok(arVal.includes('{count}'), `AR must include {count}: "${arVal}"`);
    assert.ok(kuVal.includes('{count}'), `KU must include {count}: "${kuVal}"`);
  });

  it('should confirm total dictionary parity between EN, AR, and KU', () => {
    const enKeys = Object.keys(translations.en);
    const arKeys = Object.keys(translations.ar);
    const kuKeys = Object.keys(translations.ku);

    assert.equal(enKeys.length, arKeys.length, `Parity check: EN (${enKeys.length}) === AR (${arKeys.length})`);
    assert.equal(enKeys.length, kuKeys.length, `Parity check: EN (${enKeys.length}) === KU (${kuKeys.length})`);
    assert.ok(enKeys.length >= 2188, `Dictionary must have at least 2188 keys, got ${enKeys.length}`);
  });

  it('should verify that all t calls in affected components resolve in all three languages', () => {
    const affectedFiles = [
      'src/components/onboarding/ScreenLogin.tsx',
      'src/components/owner/DepositInspectionModal.tsx',
      'src/components/tenant/TenantDepositDisputeModal.tsx',
      'src/components/tenant/TenantLeaseView.tsx',
      'src/components/tenant/TenantUtilityBillsView.tsx',
      'src/pages/AddPropertyPage.tsx',
      'src/pages/AdminLoginPage.tsx',
      'src/pages/PropertyCommandCenter.tsx',
    ];

    const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\- ]+)['"]/g;

    for (const relPath of affectedFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8');

      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        assert.ok(
          translations.en[key] !== undefined,
          `Key "${key}" used in ${relPath} must exist in translations.en`
        );
        assert.ok(
          translations.ar[key] !== undefined,
          `Key "${key}" used in ${relPath} must exist in translations.ar`
        );
        assert.ok(
          translations.ku[key] !== undefined,
          `Key "${key}" used in ${relPath} must exist in translations.ku`
        );
      }
    }
  });
});

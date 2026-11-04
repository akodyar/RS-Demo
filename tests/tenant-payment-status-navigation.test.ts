import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPaymentStatusConfig } from '../src/components/tenant/TenantPaymentsView.js';
import { translations } from '../src/i18n/I18nProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspacePagePath = path.join(__dirname, '../src/pages/TenantWorkspace.tsx');
const paymentsViewPath = path.join(__dirname, '../src/components/tenant/TenantPaymentsView.tsx');

test('Tenant Payment Status Badges & Prospective Navigation', async (t) => {
  const workspaceSource = fs.readFileSync(workspacePagePath, 'utf-8');
  const paymentsViewSource = fs.readFileSync(paymentsViewPath, 'utf-8');

  // Simple translator helper using the actual translations dictionary
  const getTranslator = (lang: 'en' | 'ar' | 'ku') => {
    return (key: string, defaultValue?: string): string => {
      if (translations[lang] && translations[lang][key] !== undefined) {
        return translations[lang][key];
      }
      return defaultValue !== undefined ? defaultValue : key;
    };
  };

  await t.test('1. CONFIRMED status displays green badge and icon', () => {
    const tEn = getTranslator('en');
    const config = getPaymentStatusConfig('CONFIRMED', tEn);
    assert.strictEqual(config.label, 'Confirmed');
    assert.ok(config.badgeClass.includes('bg-emerald-100'), 'Badge should have green background');
    assert.ok(config.badgeClass.includes('text-emerald-800'), 'Badge should have green text');
    assert.ok(config.iconClass.includes('bg-emerald-100'), 'Icon should have green background');
    assert.ok(config.iconClass.includes('text-emerald-700'), 'Icon should have green text');
  });

  await t.test('2. REVERSED status displays rose/red badge and icon', () => {
    const tEn = getTranslator('en');
    const config = getPaymentStatusConfig('REVERSED', tEn);
    assert.strictEqual(config.label, 'Reversed');
    assert.ok(config.badgeClass.includes('bg-rose-100'), 'Badge should have rose background');
    assert.ok(config.badgeClass.includes('text-rose-800'), 'Badge should have rose text');
    assert.ok(config.iconClass.includes('bg-rose-100'), 'Icon should have rose background');
    assert.ok(config.iconClass.includes('text-rose-700'), 'Icon should have rose text');
  });

  await t.test('3. PENDING status displays amber badge and icon', () => {
    const tEn = getTranslator('en');
    const config = getPaymentStatusConfig('PENDING', tEn);
    assert.strictEqual(config.label, 'Pending');
    assert.ok(config.badgeClass.includes('bg-amber-100'), 'Badge should have amber background');
    assert.ok(config.badgeClass.includes('text-amber-800'), 'Badge should have amber text');
    assert.ok(config.iconClass.includes('bg-amber-100'), 'Icon should have amber background');
    assert.ok(config.iconClass.includes('text-amber-700'), 'Icon should have amber text');
  });

  await t.test('4. Supported statuses (RECORDED, FAILED, CANCELLED, REFUNDED) have distinct mappings', () => {
    const tEn = getTranslator('en');

    const recorded = getPaymentStatusConfig('RECORDED', tEn);
    assert.strictEqual(recorded.label, 'Recorded');
    assert.ok(recorded.badgeClass.includes('bg-blue-100'));

    const failed = getPaymentStatusConfig('FAILED', tEn);
    assert.strictEqual(failed.label, 'Failed');
    assert.ok(failed.badgeClass.includes('bg-red-100'));

    const cancelled = getPaymentStatusConfig('CANCELLED', tEn);
    assert.strictEqual(cancelled.label, 'Cancelled');
    assert.ok(cancelled.badgeClass.includes('bg-slate-100'));

    const refunded = getPaymentStatusConfig('REFUNDED', tEn);
    assert.strictEqual(refunded.label, 'Refunded');
    assert.ok(refunded.badgeClass.includes('bg-purple-100'));
  });

  await t.test('5. Unknown or missing status is NOT falsely shown as confirmed', () => {
    const tEn = getTranslator('en');

    const unknownConfig = getPaymentStatusConfig('UNKNOWN_STATUS_XYZ', tEn);
    assert.ok(!unknownConfig.badgeClass.includes('bg-emerald-100'), 'Unknown must not be green/confirmed');
    assert.ok(!unknownConfig.badgeClass.includes('text-emerald-800'), 'Unknown text must not be confirmed');
    assert.strictEqual(unknownConfig.label, 'UNKNOWN_STATUS_XYZ');
    assert.ok(unknownConfig.badgeClass.includes('bg-slate-100'), 'Unknown must use neutral slate badge');

    const emptyConfig = getPaymentStatusConfig(undefined, tEn);
    assert.ok(!emptyConfig.badgeClass.includes('bg-emerald-100'), 'Empty status must not be green/confirmed');
    assert.strictEqual(emptyConfig.label, 'Unknown');
    assert.ok(emptyConfig.badgeClass.includes('bg-slate-100'), 'Empty status must use neutral slate badge');
  });

  await t.test('6. Trilingual translations exist for payment status keys in ku, ar, en', () => {
    const statuses = ['confirmed', 'reversed', 'pending', 'recorded', 'failed', 'cancelled', 'refunded'];

    for (const s of statuses) {
      const key = `payment.status.${s}`;
      assert.ok(translations.en[key], `English translation must exist for ${key}`);
      assert.ok(translations.ar[key], `Arabic translation must exist for ${key}`);
      assert.ok(translations.ku[key], `Kurdish translation must exist for ${key}`);
    }

    assert.strictEqual(translations.ku['payment.status.confirmed'], 'پشتڕاستکراوە');
    assert.strictEqual(translations.ku['payment.status.reversed'], 'پێچەوانەکراوە');
    assert.strictEqual(translations.ku['payment.status.pending'], 'چاوەڕوانە');

    assert.strictEqual(translations.ar['payment.status.confirmed'], 'مؤكد');
    assert.strictEqual(translations.ar['payment.status.reversed'], 'مسترجع');
    assert.strictEqual(translations.ar['payment.status.pending'], 'معلق');
  });

  await t.test('7. TenantPaymentsView does not have hardcoded Confirmed badge in payment rows', () => {
    // Assert that the hardcoded badge was removed from the payment list rendering
    assert.ok(
      !paymentsViewSource.includes('<span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">\n                      {t(\'tenant.confirmed\', \'Confirmed\')}\n                    </span>'),
      'TenantPaymentsView must not unconditionally hardcode confirmed badge'
    );
    assert.ok(
      paymentsViewSource.includes('statusConfig.badgeClass'),
      'TenantPaymentsView must dynamically use statusConfig.badgeClass'
    );
    assert.ok(
      paymentsViewSource.includes('statusConfig.label'),
      'TenantPaymentsView must dynamically use statusConfig.label'
    );
  });

  await t.test('8. Inactive tenant browse button navigates to /rent and not /properties', () => {
    assert.ok(
      workspaceSource.includes("onClick={() => navigate('/rent')}"),
      'Browse button must navigate to /rent'
    );
    assert.ok(
      !workspaceSource.includes("onClick={() => navigate('/properties')}"),
      'Browse button must not navigate to /properties'
    );
  });

  await t.test('9. Inactive tenant gating behavior (NO_ACTIVE_LEASE) is preserved', () => {
    assert.ok(
      workspaceSource.includes("hasActiveLease === false"),
      'Gating on hasActiveLease === false must remain intact'
    );
    assert.ok(
      workspaceSource.includes("NO_ACTIVE_LEASE"),
      'NO_ACTIVE_LEASE error code handling must remain intact'
    );
  });
});

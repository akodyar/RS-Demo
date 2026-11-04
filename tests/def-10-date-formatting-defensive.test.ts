import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatDate } from '../src/utils/formatters.js';

test('DEF-10: Defensive Date Formatting & Neutral Placeholder Verification', async (t) => {
  await t.test('1. Valid date inputs format correctly across supported locales', () => {
    // English LTR
    const enIso = formatDate('2026-10-24T14:30:00.000Z', 'en');
    assert.match(enIso, /2026/);
    assert.match(enIso, /Oct/);

    const enShort = formatDate('2026-10-24', 'en');
    assert.match(enShort, /2026/);

    // Kurdish / Arabic RTL (uses ar-IQ numeric format or Arabic calendar month)
    const kuFormatted = formatDate('2026-10-24T14:30:00.000Z', 'ku');
    assert.ok(kuFormatted && kuFormatted.length > 0);
    assert.notEqual(kuFormatted, 'Invalid Date');
    assert.notEqual(kuFormatted, '—');

    const arFormatted = formatDate('2026-10-24T14:30:00.000Z', 'ar');
    assert.ok(arFormatted && arFormatted.length > 0);
    assert.notEqual(arFormatted, 'Invalid Date');
    assert.notEqual(arFormatted, '—');

    // Date object input
    const dObj = new Date('2026-10-24T00:00:00.000Z');
    const dateObjResult = formatDate(dObj, 'en');
    assert.match(dateObjResult, /2026/);

    // Numeric timestamp input
    const timestampResult = formatDate(1761300000000, 'en');
    assert.match(timestampResult, /2025|2026/);
  });

  await t.test('2. Missing and undefined values return neutral placeholder "—"', () => {
    assert.equal(formatDate(null), '—');
    assert.equal(formatDate(undefined), '—');
    assert.equal(formatDate(null, 'ku'), '—');
    assert.equal(formatDate(undefined, 'ar'), '—');
    assert.equal(formatDate(null, 'en'), '—');

    // Custom placeholder support
    assert.equal(formatDate(null, 'en', 'N/A'), 'N/A');
    assert.equal(formatDate(undefined, 'ku', '--'), '--');
  });

  await t.test('3. Empty and whitespace-only strings return neutral placeholder "—"', () => {
    assert.equal(formatDate(''), '—');
    assert.equal(formatDate('   '), '—');
    assert.equal(formatDate('\t\n'), '—');
    assert.equal(formatDate('', 'en'), '—');
    assert.equal(formatDate('', 'ku'), '—');
    assert.equal(formatDate('', 'ar'), '—');
  });

  await t.test('4. Malformed and invalid date strings return neutral placeholder "—" (NEVER "Invalid Date")', () => {
    const invalidInputs = [
      'Invalid Date',
      'not-a-date',
      'invalid',
      'foo_bar',
      '2026-99-99',
      'N/A',
      'NaN',
      'undefined',
      'null',
      '#REF!',
      '0000-00-00',
    ];

    for (const input of invalidInputs) {
      const res = formatDate(input);
      assert.equal(
        res,
        '—',
        `Expected input "${input}" to return neutral placeholder "—", but received "${res}"`
      );
      assert.notEqual(
        res,
        'Invalid Date',
        `Input "${input}" must never produce literal "Invalid Date"`
      );
    }
  });

  await t.test('5. Invalid Date object returns neutral placeholder "—"', () => {
    const invalidDateObj = new Date('not-a-real-date');
    assert.ok(isNaN(invalidDateObj.getTime()));
    assert.equal(formatDate(invalidDateObj), '—');
  });

  await t.test('6. AccountantWorkspace.tsx source enforces defensive date formatting', () => {
    const filePath = path.resolve('src/pages/AccountantWorkspace.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must import formatDate
    assert.ok(
      content.includes("import { formatDate } from '../utils/formatters';") ||
      content.includes('import { formatDate } from "../utils/formatters";'),
      'AccountantWorkspace.tsx must import formatDate from ../utils/formatters'
    );

    // Must extract language from useI18n
    assert.ok(
      content.includes('language') && content.includes('useI18n'),
      'AccountantWorkspace.tsx must consume language from useI18n'
    );

    // Must use formatDate on recentTransactions
    assert.ok(
      content.includes('formatDate(txn.recordedDate || txn.date || txn.paymentDate || txn.createdAt, language)'),
      'Recent transactions table must defensively format date with fallback to date/paymentDate/createdAt and locale'
    );

    // Must use formatDate on recentJournalEntries
    assert.ok(
      content.includes('formatDate(je.date || je.recordedDate || je.createdAt, language)'),
      'Recent journal entries table must defensively format date with locale'
    );

    // Must NOT contain unsafe new Date(txn.recordedDate || txn.createdAt).toLocaleDateString()
    assert.ok(
      !content.includes('new Date(txn.recordedDate || txn.createdAt).toLocaleDateString()'),
      'AccountantWorkspace.tsx must not contain un-guarded new Date(...).toLocaleDateString() on txn'
    );
  });
});

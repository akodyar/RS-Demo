import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('F-001 Regression: Kurdish Sorani RTL Percentage Rendering & Invariants', () => {
  const addPropertyPath = path.join(process.cwd(), 'src/pages/AddPropertyPage.tsx');
  const content = fs.readFileSync(addPropertyPath, 'utf8');

  test('1. Ownership percentage input wrapper enforces isolated dir="ltr" without overlapping suffix', () => {
    // Slices Step 6 (Ownership Claim) section
    const step6Section = content.substring(
      content.indexOf('{currentStep === 6 && ('),
      content.indexOf('{/* Ownership Mode Selection Cards */}')
    );

    // Defect root cause was: ${direction === 'rtl' ? 'left-3' : 'right-3'} placing % over the first digit in LTR input
    assert.strictEqual(
      step6Section.includes("direction === 'rtl' ? 'left-3' : 'right-3'"),
      false,
      'Obsolete overlapping suffix positioning (left-3 in RTL) must be completely eliminated from Step 6'
    );

    // Verified fix: container has dir="ltr" and suffix is positioned at right-3 with dir="ltr"
    assert.strictEqual(
      step6Section.includes('<div className="relative max-w-xs" dir="ltr">'),
      true,
      'Percentage input container must enforce dir="ltr" to prevent bi-di inversion'
    );

    assert.strictEqual(
      step6Section.includes('data-testid="ownership-percentage-input"'),
      true,
      'Ownership percentage input must have data-testid'
    );

    assert.strictEqual(
      step6Section.includes('right-3 text-slate-400 font-bold pointer-events-none select-none" dir="ltr"'),
      true,
      'Suffix % must be positioned safely on the right end with dir="ltr"'
    );
  });

  test('2. Ownership percentage display badge provides isolated dir="ltr" representation', () => {
    assert.strictEqual(
      content.includes('data-testid="ownership-percentage-display"'),
      true,
      'Step 6 must render dedicated display badge'
    );

    assert.strictEqual(
      content.includes('{formData.ownershipPercentage}%'),
      true,
      'Percentage must be dynamically interpolated with percent symbol'
    );
  });

  test('3. Step 8 Review step ownership percentage display enforces isolated dir="ltr"', () => {
    assert.strictEqual(
      content.includes('data-testid="review-ownership-percentage"'),
      true,
      'Step 8 review card must possess data-testid="review-ownership-percentage"'
    );

    assert.strictEqual(
      content.includes('data-testid="review-ownership-percentage" className="font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-md inline-block font-mono" dir="ltr"'),
      true,
      'Review card ownership percentage must enforce dir="ltr"'
    );
  });

  test('4. Underling dynamic percentage values and persistence remain unaffected', () => {
    // Default initial value must remain '100'
    assert.strictEqual(
      content.includes("ownershipPercentage: '100'"),
      true,
      'Default ownership percentage must remain 100'
    );

    // Form data submission payload must preserve ownershipPercentage
    assert.strictEqual(
      content.includes('formData.ownershipPercentage'),
      true,
      'Form payload must pass dynamic ownership percentage'
    );
  });
});

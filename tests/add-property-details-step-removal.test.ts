import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Add Property Wizard: Removal of Pricing Tier and Operating Model from Details Step', () => {
  const addPropertyPath = path.resolve(process.cwd(), 'src/pages/AddPropertyPage.tsx');
  const sourceCode = fs.readFileSync(addPropertyPath, 'utf8');

  test('1. Pricing tier banner and local state are completely removed from AddPropertyPage', () => {
    // Assert data-testid and pricing tier banner are gone
    assert.strictEqual(
      sourceCode.includes('data-testid="pricing-tier-banner"'),
      false,
      'pricing-tier-banner testid must be removed from AddPropertyPage'
    );
    assert.strictEqual(
      sourceCode.includes('data-testid="resolved-tier-name"'),
      false,
      'resolved-tier-name testid must be removed'
    );
    assert.strictEqual(
      sourceCode.includes('data-testid="verified-property-count"'),
      false,
      'verified-property-count testid must be removed'
    );
    assert.strictEqual(
      sourceCode.includes('data-testid="tier-rates-info"'),
      false,
      'tier-rates-info testid must be removed'
    );
    assert.strictEqual(
      sourceCode.includes('pricingTierInfo'),
      false,
      'pricingTierInfo state must be removed from AddPropertyPage'
    );
    assert.strictEqual(
      sourceCode.includes("fetch('/api/properties/pricing-tier'"),
      false,
      'pricing-tier fetch effect must be removed from AddPropertyPage'
    );
  });

  test('2. Operating model dropdown and agreed fee rate fields are absent from Step 3 (Details)', () => {
    assert.strictEqual(
      sourceCode.includes('data-testid="property-operating-model"'),
      false,
      'property-operating-model select dropdown must be removed from Step 3'
    );
    assert.strictEqual(
      sourceCode.includes('data-testid="property-rent-fee"'),
      false,
      'property-rent-fee input must be removed from Step 3'
    );
    assert.strictEqual(
      sourceCode.includes('data-testid="property-management-fee"'),
      false,
      'property-management-fee input must be removed from Step 3'
    );
  });

  test('3. Step 3 (Details) preserves authentic property specification fields', () => {
    // Verify Step 3 contains the legitimate detail inputs
    const step3Index = sourceCode.indexOf('{currentStep === 3 && (');
    const step4Index = sourceCode.indexOf('{currentStep === 4 && (');
    assert.ok(step3Index > -1, 'Step 3 must exist');
    assert.ok(step4Index > step3Index, 'Step 4 must follow Step 3');

    const step3Block = sourceCode.substring(step3Index, step4Index);

    assert.ok(step3Block.includes('yearBuilt'), 'Year built input must be present in Step 3');
    assert.ok(step3Block.includes('squareFeet'), 'Square feet / Total Area input must be present in Step 3');
    assert.ok(step3Block.includes('bedrooms'), 'Bedrooms input must be present in Step 3');
    assert.ok(step3Block.includes('bathrooms'), 'Bathrooms input must be present in Step 3');
    assert.ok(step3Block.includes('furnishingStatus'), 'Furnishing status select must be present in Step 3');
    assert.ok(step3Block.includes('propertyCondition'), 'Property condition select must be present in Step 3');
  });

  test('4. Step 7 (Management) preserves operating model cards and agreed fee rate configuration', () => {
    const step7Index = sourceCode.indexOf('{currentStep === 7 && (');
    const step8Index = sourceCode.indexOf('{currentStep === 8 && (');
    assert.ok(step7Index > -1, 'Step 7 must exist');
    assert.ok(step8Index > step7Index, 'Step 8 must follow Step 7');

    const step7Block = sourceCode.substring(step7Index, step8Index);

    assert.ok(step7Block.includes('data-testid="op-model-fully-managed"'), 'Fully Managed card must be in Step 7');
    assert.ok(step7Block.includes('data-testid="op-model-agent-listed"'), 'Agent Listed card must be in Step 7');
    assert.ok(step7Block.includes('data-testid="op-model-agent-operated"'), 'Agent Operated card must be in Step 7');
    assert.ok(step7Block.includes('data-testid="agreed-mgmt-fee-input"'), 'Agreed mgmt fee input must be in Step 7');
    assert.ok(step7Block.includes('data-testid="agreed-rent-fee-input"'), 'Agreed rent fee input must be in Step 7');
  });

  test('5. Step navigation does not block progression through Details step', () => {
    // Check handleNext
    const handleNextIndex = sourceCode.indexOf('const handleNext = () => {');
    const handleNextEnd = sourceCode.indexOf('const handlePrev = () => {', handleNextIndex);
    const handleNextCode = sourceCode.substring(handleNextIndex, handleNextEnd);

    // Verify there are no blocking checks on rentFee, managementFee, or operatingModel in handleNext
    assert.strictEqual(
      handleNextCode.includes('rentFee'),
      false,
      'handleNext must not require rentFee on Step 3'
    );
    assert.strictEqual(
      handleNextCode.includes('managementFee'),
      false,
      'handleNext must not require managementFee on Step 3'
    );
    assert.strictEqual(
      handleNextCode.includes('operatingModel'),
      false,
      'handleNext must not require operatingModel on Step 3'
    );
  });

  test('6. Server repositories and financial policies outside wizard remain unaffected', () => {
    const propertiesRepoPath = path.resolve(process.cwd(), 'src/server/repositories/properties.ts');
    assert.ok(fs.existsSync(propertiesRepoPath), 'properties repository must exist');
    const repoCode = fs.readFileSync(propertiesRepoPath, 'utf8');

    // operatingModel logic remains active in properties repository
    assert.ok(repoCode.includes('operatingModel'), 'Backend operatingModel logic remains active');
    assert.ok(repoCode.includes('FULLY_MANAGED'), 'FULLY_MANAGED model remains active');
    assert.ok(repoCode.includes('AGENT_LISTED_PLATFORM_MANAGED'), 'AGENT_LISTED_PLATFORM_MANAGED model remains active');
    assert.ok(repoCode.includes('AGENT_OPERATED'), 'AGENT_OPERATED model remains active');
  });
});

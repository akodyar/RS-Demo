import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.join(__dirname, '../src/pages/TenantWorkspace.tsx');
const typesPath = path.join(__dirname, '../src/types/tenant.ts');

test('TenantWorkspace UI Formatting Audit (Removal)', async (t) => {
  const componentCode = fs.readFileSync(componentPath, 'utf-8');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');

  await t.test('Proposed Rent block is fully removed from UI', () => {
    assert.ok(
      !componentCode.includes('tenant.dashboard.proposed_rent'),
      'Should not contain Proposed Rent localization key'
    );
    assert.ok(
      !componentCode.includes('app.proposedRentAmount'),
      'Should not contain references to proposedRentAmount in UI logic'
    );
  });

  await t.test('Proposed Rent fields are fully removed from types', () => {
    const tenantAppItemMatch = typesCode.match(/export interface TenantRentalApplicationItem\s*\{[\s\S]*?\}/);
    assert.ok(tenantAppItemMatch, 'TenantRentalApplicationItem must exist');
    assert.ok(
      !tenantAppItemMatch[0].includes('proposedRentAmount'),
      'TenantRentalApplicationItem should not contain proposedRentAmount'
    );
    assert.ok(
      !tenantAppItemMatch[0].includes('currency'),
      'TenantRentalApplicationItem should not contain currency'
    );
  });
});

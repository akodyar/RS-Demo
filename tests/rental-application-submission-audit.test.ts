import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const searchExplorerPagePath = path.join(__dirname, '../src/pages/SearchExplorerPage.tsx');
const rentalAcquisitionRepoPath = path.join(__dirname, '../src/server/repositories/rental-acquisition.ts');

test('Rental Application Submission Audit', async (t) => {
  const pageCode = fs.readFileSync(searchExplorerPagePath, 'utf-8');
  const repoCode = fs.readFileSync(rentalAcquisitionRepoPath, 'utf-8');

  await t.test('SearchExplorerPage payload no longer includes proposedRentAmount', () => {
    // Check the POST payload body block in SearchExplorerPage
    const fetchBlockMatch = pageCode.match(/fetch\(`\/api\/rental-acquisitions\/listings\/\$\{selectedProperty\.id\}\/applications`[\s\S]*?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/);
    assert.ok(fetchBlockMatch, 'Application submission fetch block must exist');
    const payloadStr = fetchBlockMatch[1];
    
    assert.ok(
      !payloadStr.includes('proposedRentAmount'),
      'Payload should not contain proposedRentAmount'
    );
    assert.ok(
      payloadStr.includes('preferredMoveInDate'),
      'Payload should preserve supported fields like preferredMoveInDate'
    );
    assert.ok(
      payloadStr.includes('notes'),
      'Payload should preserve notes field'
    );
  });

  await t.test('submitApplication does not process or persist proposedRentAmount', () => {
    const submitAppMatch = repoCode.match(/async submitApplication\([\s\S]*?\{([\s\S]*?)\}\)\s*\{/);
    assert.ok(submitAppMatch, 'submitApplication function must exist');
    assert.ok(
      !submitAppMatch[0].includes('proposedRentAmount'),
      'submitApplication signature should not include proposedRentAmount'
    );
    
    const insertMatch = repoCode.match(/tx\.insert\(rentalApplications\)\.values\(\{([\s\S]*?)\}\)/);
    assert.ok(insertMatch, 'rentalApplications insert block must exist');
    assert.ok(
      !insertMatch[1].includes('proposedRentAmount'),
      'rentalApplications insert payload should not contain proposedRentAmount'
    );
  });

  await t.test('submitApplication preserves supported fields and validation', () => {
    const submitAppMatch = repoCode.match(/async submitApplication\([\s\S]*?data:\s*\{([\s\S]*?)\}\)/);
    assert.ok(submitAppMatch, 'submitApplication function must have data payload');
    assert.ok(
      submitAppMatch[1].includes('monthlyIncome'),
      'submitApplication must preserve monthlyIncome requirement'
    );
    assert.ok(
      repoCode.includes('listing.status !== \'PUBLISHED\''),
      'submitApplication must preserve listing validation'
    );
  });
});


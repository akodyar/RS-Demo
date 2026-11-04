import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const searchExplorerPagePath = path.join(__dirname, '../src/pages/SearchExplorerPage.tsx');
const rentalAcquisitionRepoPath = path.join(__dirname, '../src/server/repositories/rental-acquisition.ts');
const rentalAcquisitionRoutePath = path.join(__dirname, '../src/server/routes/rental-acquisition.ts');

test('Rental Application Backend Contract Workflow Audit', async (t) => {
  const pageCode = fs.readFileSync(searchExplorerPagePath, 'utf-8');
  const repoCode = fs.readFileSync(rentalAcquisitionRepoPath, 'utf-8');
  const routeCode = fs.readFileSync(rentalAcquisitionRoutePath, 'utf-8');

  await t.test('SearchExplorerPage mock application flow awaits response and handles errors', () => {
    // Should no longer use setTimeout for the application logic specifically
    const applyLogicMatch = pageCode.match(/Apply for Rent([\s\S]*?)</);
    assert.ok(!pageCode.match(/setApplySuccessMsg\([\s\S]*?\)\s*;\s*setTimeout/), 'Should not use setTimeout for mock submission');
    // Should await fetch response
    assert.ok(pageCode.includes('.then(async (res) => {'), 'Should handle async fetch response');
    // Payload should send preferredMoveInDate and notes, not proposedRentAmount
    const fetchBody = pageCode.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/);
    assert.ok(fetchBody, 'fetch body must exist');
    assert.ok(fetchBody[1].includes('preferredMoveInDate'), 'Payload should send preferredMoveInDate');
    assert.ok(fetchBody[1].includes('notes'), 'Payload should send notes');
    assert.ok(!fetchBody[1].includes('proposedStartDate'), 'Payload should not send proposedStartDate');
    assert.ok(!fetchBody[1].includes('message'), 'Payload should not send message');
  });

  await t.test('submitApplication repository safely handles optional monthlyIncome', () => {
    // Should have monthlyIncome optional in signature
    assert.ok(repoCode.includes('monthlyIncome?: number'), 'Signature should make monthlyIncome optional');
    // Should handle undefined safely without just doing .toString() directly
    assert.ok(repoCode.includes('data.monthlyIncome !== undefined'), 'Should safely check monthlyIncome before toString()');
  });

  await t.test('submitApplication route performs type validation', () => {
    // Route should destructure specific fields and check type
    assert.ok(routeCode.includes('typeof monthlyIncome !== \'number\''), 'Should validate monthlyIncome is number');
    assert.ok(routeCode.includes('monthlyIncome < 0'), 'Should validate monthlyIncome is not negative');
    assert.ok(routeCode.includes('typeof notes !== \'string\''), 'Should validate notes is string');
    assert.ok(routeCode.includes('typeof preferredMoveInDate !== \'string\''), 'Should validate preferredMoveInDate is string');
    assert.ok(routeCode.includes('typeof employmentStatus !== \'string\''), 'Should validate employmentStatus is string');
    // Route should explicitly pass validated fields instead of raw req.body
    assert.ok(routeCode.includes('preferredMoveInDate,'), 'Should pass preferredMoveInDate explicitly');
  });

  await t.test('submitApplication repository enforces FOR_RENT listing type', () => {
    assert.ok(repoCode.includes('listing.type !== \'FOR_RENT\''), 'Should check if listing is FOR_RENT');
  });
});

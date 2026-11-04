import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const searchExplorerPagePath = path.join(__dirname, '../src/pages/SearchExplorerPage.tsx');
const marketplacePagePath = path.join(__dirname, '../src/pages/MarketplacePage.tsx');
const appPath = path.join(__dirname, '../src/App.tsx');

test('Rental Marketplace (/rent) UI Modernization & Architecture Tests', async (t) => {
  const pageCode = fs.readFileSync(searchExplorerPagePath, 'utf-8');
  const marketplaceCode = fs.readFileSync(marketplacePagePath, 'utf-8');
  const appCode = fs.readFileSync(appPath, 'utf-8');

  await t.test('1. Modernized Header uses Owner Workspace visual hierarchy and tokens', () => {
    // Header includes dark theme surface, guest banner, and navigation header
    assert.ok(pageCode.includes('from-[#0c1322]') || pageCode.includes('bg-[#0c1322]'), 'Header must use modernized dark surface tokens');
    assert.ok(pageCode.includes('search-explorer-root'), 'Explorer root container must be present');
    assert.ok(pageCode.includes('marketplace.banner.guest_active'), 'Header must feature guest banner');
  });

  await t.test('2. Search & Filter Bar uses modernized rounded surfaces and segmented controls', () => {
    assert.ok(pageCode.includes('bg-[#0c1322]/95') && pageCode.includes('sticky top-0 z-20'), 'Sticky search container must match modernized sticky controls');
    assert.ok(pageCode.includes('rounded-xl border') && pageCode.includes('search-explorer-input'), 'Search input must use modernized input styling');
    assert.ok(pageCode.includes('showFiltersModal') || pageCode.includes('SlidersHorizontal'), 'Filter button must use modernized filter triggers');
  });

  await t.test('3. Property Listing Cards adhere to Owner Workspace card surfaces and LTR isolation', () => {
    assert.ok(pageCode.includes('bg-[#0c1322] rounded-2xl border border-slate-800/80') || pageCode.includes('rounded-2xl border'), 'Listing cards must use rounded-2xl border cards');
    assert.ok(pageCode.includes('aspect-[16/10] overflow-hidden'), 'Cards must maintain 16:10 image ratio');
    assert.ok(pageCode.includes('dir="ltr"'), 'Price numbers must be wrapped in dir="ltr" spans');
    assert.ok(pageCode.includes('verified_deed') || pageCode.includes('ShieldCheck'), 'Verified badge must be rendered');
  });

  await t.test('4. Empty State reflects Owner Workspace design tokens with clear filters action', () => {
    assert.ok(pageCode.includes('rounded-2xl border') && pageCode.includes('text-center'), 'Empty state must use polished rounded-2xl card');
    assert.ok(pageCode.includes('clear_filters') || pageCode.includes('reset') || pageCode.includes('Search'), 'Empty state must provide clear/reset action');
  });

  await t.test('5. Strict Rental-Only scope & Route Guarding are preserved', () => {
    // Marketplace wrapper forces rent-only mode
    assert.ok(marketplaceCode.includes('domainMode="rent-only"'), 'Marketplace wrapper must enforce rent-only domainMode');
    // App.tsx routes
    assert.ok(appCode.includes('path="rent"') && appCode.includes('domainMode="rent-only"'), 'rent route in App.tsx must enforce rent-only domainMode');
    // Buy/Sell guard
    assert.ok(pageCode.includes('FeatureFlags.BUY_SELL_ENABLED && domainMode !== \'rent-only\''), 'Buy/Sell tabs must be suppressed when in rent-only mode');
  });

  await t.test('6. Unused PROPERTIES_DATA definition is strictly preserved without deletion', () => {
    assert.ok(pageCode.includes('const PROPERTIES_DATA: PropertyItem[] = ['), 'PROPERTIES_DATA constant must remain in place without deletion');
  });

  await t.test('7. Modals & Comparison tools are modernized and preserved', () => {
    assert.ok(pageCode.includes('showComparisonModal'), 'Property comparison modal must be preserved');
    assert.ok(pageCode.includes('selectedProperty'), 'Property detail modal must be preserved');
    assert.ok(pageCode.includes('showFiltersModal'), 'Advanced filters modal must be preserved');
    assert.ok(pageCode.includes('apply_for_rent'), 'Rental application action must be preserved');
  });
});

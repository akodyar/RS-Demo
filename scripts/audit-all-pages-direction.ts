import fs from 'fs';
import path from 'path';

const pagesDir = path.resolve('src/pages');
const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'));

console.log('=== PAGES RTL/LTR & DIRECTION AUDIT ===\n');
const missingDirection: string[] = [];
const missingI18n: string[] = [];
const containerDirOverrides: { file: string; match: string }[] = [];

// Delegator/wrapper pages that render full children with their own direction
const DELEGATOR_PAGES = new Set(['LoginPage.tsx', 'MarketplacePage.tsx', 'RentalsPage.tsx']);

for (const file of files) {
  if (DELEGATOR_PAGES.has(file)) {
    console.log(`${file.padEnd(32)} | [DELEGATOR / REDIRECT COMPONENT - SKIPPED]`);
    continue;
  }

  const fullPath = path.join(pagesDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');

  const hasUseI18n = content.includes('useI18n');
  const hasDir = content.includes('dir={direction}') || content.includes('dir={dir');

  // Check for hardcoded dir="rtl" or dir="ltr" on root or major container tags (<main>, <section>, top <div>)
  // Note: <span dir="ltr"> or <p dir="ltr"> for phone/numbers/currency is encouraged for bidirectional isolation.
  const badContainerRTL = content.match(/<(?:main|section|div)[^>]*\bdir=["']rtl["'][^>]*>/i);
  // Match outer/large container with hardcoded dir="ltr" (excluding micro inline spans/inputs/etc.)
  const badContainerLTR = content.match(/<(?:main|section)\s+[^>]*\bdir=["']ltr["'][^>]*>/i);

  console.log(
    file.padEnd(32) +
      ' | useI18n: ' +
      (hasUseI18n ? 'YES' : 'NO ') +
      ' | dir={dir}: ' +
      (hasDir ? 'YES' : 'NO ') +
      ' | containerOverride: ' +
      (badContainerRTL || badContainerLTR ? 'FOUND' : 'none ')
  );

  if (!hasUseI18n) missingI18n.push(file);
  if (!hasDir) missingDirection.push(file);
  if (badContainerRTL) containerDirOverrides.push({ file, match: badContainerRTL[0] });
  if (badContainerLTR) containerDirOverrides.push({ file, match: badContainerLTR[0] });
}

console.log('\n--- Missing useI18n ---', missingI18n);
console.log('--- Missing dir={direction} ---', missingDirection);
console.log('--- Container Overrides ---', containerDirOverrides);


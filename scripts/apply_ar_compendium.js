import fs from 'fs';

const arDict = JSON.parse(fs.readFileSync('scripts/ar_dictionary.json', 'utf8'));

let providerCode = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// Find the start of ar: { and the start of ku: {
const arIndex = providerCode.indexOf('  ar: {');
const kuIndex = providerCode.indexOf('  ku: {');

if (arIndex === -1 || kuIndex === -1) {
  console.error('Could not find ar: { or ku: { in src/i18n/I18nProvider.tsx');
  process.exit(1);
}

// Format ar dictionary nicely
const arLines = ['  ar: {'];
for (const [key, value] of Object.entries(arDict)) {
  const escapedVal = value.replace(/'/g, "\\'");
  arLines.push(`    '${key}': '${escapedVal}',`);
}
// Remove trailing comma from last line
arLines[arLines.length - 1] = arLines[arLines.length - 1].slice(0, -1);
arLines.push('  },\n');

const newArBlock = arLines.join('\n');

const newCode = providerCode.substring(0, arIndex) + newArBlock + providerCode.substring(kuIndex);

fs.writeFileSync('src/i18n/I18nProvider.tsx', newCode, 'utf8');
console.log('Successfully updated ar dictionary in src/i18n/I18nProvider.tsx');

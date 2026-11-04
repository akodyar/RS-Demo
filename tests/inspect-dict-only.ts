import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'localization-discrepancies.json'), 'utf-8'));
const dictOnly = data.filter((d: any) => !d.inCode);

console.log(`Total dictOnly: ${dictOnly.length}`);

// Group by what they are missing in
const missingInEn = dictOnly.filter((d: any) => d.missingIn.includes('en'));
const missingInAr = dictOnly.filter((d: any) => d.missingIn.includes('ar'));
const missingInKu = dictOnly.filter((d: any) => d.missingIn.includes('ku'));

console.log(`Missing in EN: ${missingInEn.length}`);
console.log(`Missing in AR: ${missingInAr.length}`);
console.log(`Missing in KU: ${missingInKu.length}`);

console.log('\n--- Missing in EN (all):');
for (const d of missingInEn) {
  console.log(`KEY: "${d.key}" | AR: "${d.arVal || ''}" | KU: "${d.kuVal || ''}"`);
}

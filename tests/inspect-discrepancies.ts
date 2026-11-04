import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'localization-discrepancies.json'), 'utf-8'));

console.log('=== GROUP 1: In Some Dictionary But Missing In Others ===');
const dictOnly = data.filter((d: any) => !d.inCode);
console.log(`Count: ${dictOnly.length}`);
for (const d of dictOnly.slice(0, 30)) {
  console.log(`- [${d.key}] Missing in: [${d.missingIn.join(', ')}] | EN: "${d.enVal || ''}" | AR: "${d.arVal || ''}" | KU: "${d.kuVal || ''}"`);
}

console.log('\n=== GROUP 2: In Code and Missing in Dictionaries ===');
const inCode = data.filter((d: any) => d.inCode);
console.log(`Count: ${inCode.length}`);
for (const d of inCode) {
  console.log(`- [${d.key}] Missing in: [${d.missingIn.join(', ')}] | Files: [${d.files.join(', ')}] | Default: [${d.defaultValues.join(' | ')}]`);
}

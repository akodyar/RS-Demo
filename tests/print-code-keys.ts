import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'localization-discrepancies.json'), 'utf-8'));
const inCode = data.filter((d: any) => d.inCode);

const lines: string[] = [];
for (const d of inCode) {
  lines.push(JSON.stringify({
    key: d.key,
    missingIn: d.missingIn,
    files: d.files,
    defaultValues: d.defaultValues,
    enVal: d.enVal,
    arVal: d.arVal,
    kuVal: d.kuVal
  }));
}

fs.writeFileSync(path.join(process.cwd(), 'tests', 'code-keys-output.json'), JSON.stringify(inCode, null, 2), 'utf-8');
console.log(`Wrote ${inCode.length} records to tests/code-keys-output.json in UTF-8`);

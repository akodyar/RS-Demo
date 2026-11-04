import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/I18nProvider';

const enKeys = new Set(Object.keys(translations.en));
const arKeys = new Set(Object.keys(translations.ar));
const kuKeys = new Set(Object.keys(translations.ku));

const srcDir = path.join(process.cwd(), 'src');
const allTCalls: { file: string; key: string; defaultValue?: string }[] = [];

function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\- ]+)['"]\s*(?:,\s*(?:['"`]([\s\S]*?)['"`]|([^)]*)))?\s*\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        allTCalls.push({
          file: path.relative(process.cwd(), fullPath),
          key: match[1],
          defaultValue: match[2],
        });
      }
    }
  }
}

scanDir(srcDir);

// Map each code key to files and default values
const keyDetails = new Map<string, { files: Set<string>; defaultValues: Set<string> }>();
for (const call of allTCalls) {
  if (!keyDetails.has(call.key)) {
    keyDetails.set(call.key, { files: new Set(), defaultValues: new Set() });
  }
  const detail = keyDetails.get(call.key)!;
  detail.files.add(call.file);
  if (call.defaultValue) {
    detail.defaultValues.add(call.defaultValue.trim());
  }
}

// Find all keys missing in at least one dictionary
const allKnownKeys = new Set([...enKeys, ...arKeys, ...kuKeys, ...keyDetails.keys()]);

const discrepancies: {
  key: string;
  missingIn: string[];
  inCode: boolean;
  files: string[];
  defaultValues: string[];
  enVal?: string;
  arVal?: string;
  kuVal?: string;
}[] = [];

for (const key of allKnownKeys) {
  const missingIn: string[] = [];
  if (!enKeys.has(key)) missingIn.push('en');
  if (!arKeys.has(key)) missingIn.push('ar');
  if (!kuKeys.has(key)) missingIn.push('ku');

  if (missingIn.length > 0) {
    const detail = keyDetails.get(key);
    discrepancies.push({
      key,
      missingIn,
      inCode: keyDetails.has(key),
      files: detail ? [...detail.files] : [],
      defaultValues: detail ? [...detail.defaultValues] : [],
      enVal: translations.en[key],
      arVal: translations.ar[key],
      kuVal: translations.ku[key],
    });
  }
}

console.log(`TOTAL UNIQUE DISCREPANCY KEYS FOUND: ${discrepancies.length}\n`);

// Save full report to JSON file for analysis
fs.writeFileSync(
  path.join(process.cwd(), 'tests', 'localization-discrepancies.json'),
  JSON.stringify(discrepancies, null, 2),
  'utf-8'
);

console.log(`Saved detailed report to tests/localization-discrepancies.json`);

// Categorize discrepancies
const codeDiscrepancies = discrepancies.filter(d => d.inCode);
const dictOnlyDiscrepancies = discrepancies.filter(d => !d.inCode);

console.log(`- Referenced in code and missing in >=1 language: ${codeDiscrepancies.length}`);
console.log(`- In some dictionary but missing in other dictionaries: ${dictOnlyDiscrepancies.length}`);

// Print breakdown by prefix for codeDiscrepancies
const prefixCounts: Record<string, number> = {};
for (const d of codeDiscrepancies) {
  const prefix = d.key.split('.')[0] || 'other';
  prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
}
console.log('\nBreakdown of missing code keys by domain prefix:');
console.table(prefixCounts);

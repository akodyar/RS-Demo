import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/I18nProvider';

// 1. Gather all keys from dictionaries
const en = translations.en;
const ar = translations.ar;
const ku = translations.ku;

const allDictKeys = new Set([...Object.keys(en), ...Object.keys(ar), ...Object.keys(ku)]);

// 2. Scan all files in src/ for t(...) calls
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

// Map code keys to defaults
const codeKeyDefaults = new Map<string, string>();
for (const call of allTCalls) {
  if (call.defaultValue && !codeKeyDefaults.has(call.key)) {
    codeKeyDefaults.set(call.key, call.defaultValue.trim());
  }
}

const allKeys = new Set([...allDictKeys, ...codeKeyDefaults.keys()]);

console.log(`TOTAL UNION OF KEYS: ${allKeys.size}`);

// Identify all keys that have a missing or empty translation in ANY language
const needsAttention: {
  key: string;
  en: string | null;
  ar: string | null;
  ku: string | null;
  defaultValue?: string;
}[] = [];

for (const k of allKeys) {
  const enVal = en[k] ?? null;
  const arVal = ar[k] ?? null;
  const kuVal = ku[k] ?? null;

  const isEnMissing = !enVal || enVal.trim() === '';
  const isArMissing = !arVal || arVal.trim() === '';
  const isKuMissing = !kuVal || kuVal.trim() === '';

  if (isEnMissing || isArMissing || isKuMissing) {
    needsAttention.push({
      key: k,
      en: enVal,
      ar: arVal,
      ku: kuVal,
      defaultValue: codeKeyDefaults.get(k),
    });
  }
}

console.log(`KEYS NEEDING COMPLETION: ${needsAttention.length}`);

fs.writeFileSync(
  path.join(process.cwd(), 'tests', 'keys-needing-completion.json'),
  JSON.stringify(needsAttention, null, 2),
  'utf-8'
);
console.log('Saved to tests/keys-needing-completion.json');

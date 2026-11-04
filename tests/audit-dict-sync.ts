import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/I18nProvider';

const en = translations.en;
const ar = translations.ar;
const ku = translations.ku;

const allKeys = new Set([...Object.keys(en), ...Object.keys(ar), ...Object.keys(ku)]);

console.log(`Total union of dictionary keys: ${allKeys.size}`);

const missing = {
  en: [] as string[],
  ar: [] as string[],
  ku: [] as string[],
};

for (const k of allKeys) {
  if (en[k] === undefined) missing.en.push(k);
  if (ar[k] === undefined) missing.ar.push(k);
  if (ku[k] === undefined) missing.ku.push(k);
}

console.log(`Missing in EN: ${missing.en.length}`);
console.log(`Missing in AR: ${missing.ar.length}`);
console.log(`Missing in KU: ${missing.ku.length}`);

fs.writeFileSync(path.join(process.cwd(), 'tests', 'dictionary-sync-audit.json'), JSON.stringify(missing, null, 2), 'utf-8');

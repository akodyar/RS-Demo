import fs from 'fs';
import { translations } from '../src/i18n/I18nProvider.tsx';
import { newTranslations } from './new-translations-data.mjs';

const phase50Map = JSON.parse(fs.readFileSync('tests/new-translations-map.json', 'utf8'));
const codeKeys = JSON.parse(fs.readFileSync('tests/code-keys-output.json', 'utf8'));

// Build unified map of key -> { en, ar, ku }
const master = new Map();

// 1. Load existing
for (const [k, v] of Object.entries(translations.en)) {
  if (!master.has(k)) master.set(k, { en: v, ar: '', ku: '' });
  else master.get(k).en = v;
}
for (const [k, v] of Object.entries(translations.ar)) {
  if (!master.has(k)) master.set(k, { en: '', ar: v, ku: '' });
  else master.get(k).ar = v;
}
for (const [k, v] of Object.entries(translations.ku)) {
  if (!master.has(k)) master.set(k, { en: '', ar: '', ku: v });
  else master.get(k).ku = v;
}

// 2. Load phase50Map
for (const item of phase50Map) {
  const k = item.key;
  if (!master.has(k)) master.set(k, { en: item.en || '', ar: item.ar || '', ku: item.ku || '' });
  const entry = master.get(k);
  if (item.en && (!entry.en || entry.en === '')) entry.en = item.en;
  if (item.ar && (!entry.ar || entry.ar === '')) entry.ar = item.ar;
  if (item.ku && (!entry.ku || entry.ku === '')) entry.ku = item.ku;
}

// 3. Load codeKeys
for (const item of codeKeys) {
  const k = item.key;
  if (!master.has(k)) master.set(k, { en: '', ar: item.arVal || '', ku: '' });
  const entry = master.get(k);
  if (item.defaultValues && item.defaultValues[0] && !entry.en) {
    entry.en = item.defaultValues[0];
  }
  if (item.arVal && !entry.ar) {
    entry.ar = item.arVal;
  }
}

// 4. Load newTranslations (homepage redesign & audited missing keys)
for (const [k, trans] of Object.entries(newTranslations)) {
  if (!master.has(k)) master.set(k, { en: trans.en, ar: trans.ar, ku: trans.ku });
  const entry = master.get(k);
  entry.en = trans.en;
  entry.ar = trans.ar;
  entry.ku = trans.ku;
}

// Fill any fallback values for Kurdish/Arabic/English
for (const [k, v] of master.entries()) {
  if (!v.en) v.en = v.ku || v.ar || k;
  if (!v.ar) v.ar = v.en || k;
  if (!v.ku) v.ku = v.en || k;
}

console.log('Total unified keys with codeKeys:', master.size);

let emptyEn = 0, emptyAr = 0, emptyKu = 0;
for (const [k, v] of master.entries()) {
  if (!v.en) emptyEn++;
  if (!v.ar) emptyAr++;
  if (!v.ku) emptyKu++;
}

console.log('Missing/empty values after fallback:', { emptyEn, emptyAr, emptyKu });

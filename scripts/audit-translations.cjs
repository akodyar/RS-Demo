const fs = require('fs');
const path = require('path');

const i18nContent = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

function extractKeys(lang) {
  const marker = lang + ': {';
  const start = i18nContent.indexOf(marker);
  if (start === -1) return new Set();
  const nextLang = lang === 'en' ? 'ar: {' : (lang === 'ar' ? 'ku: {' : 'export interface I18nProviderProps');
  const end = i18nContent.indexOf(nextLang, start);
  const block = i18nContent.slice(start, end);
  const keys = new Set();
  const re = /'([^']+)':/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

const enKeys = extractKeys('en');
const arKeys = extractKeys('ar');
const kuKeys = extractKeys('ku');

console.log('Total EN dictionary keys:', enKeys.size);
console.log('Total AR dictionary keys:', arKeys.size);
console.log('Total KU dictionary keys:', kuKeys.size);

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = getFiles('src');
const missingInEn = new Map();
const missingInAr = new Map();
const missingInKu = new Map();

const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]/g;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = tRegex.exec(content)) !== null) {
    const key = m[1];
    if (!enKeys.has(key)) {
      if (!missingInEn.has(key)) missingInEn.set(key, f);
    }
    if (!arKeys.has(key)) {
      if (!missingInAr.has(key)) missingInAr.set(key, f);
    }
    if (!kuKeys.has(key)) {
      if (!missingInKu.has(key)) missingInKu.set(key, f);
    }
  }
}

console.log('Missing in EN:', missingInEn.size);
console.log('Missing in AR:', missingInAr.size);
console.log('Missing in KU:', missingInKu.size);

if (missingInKu.size > 0) {
  console.log('\n--- Missing keys in KU ---');
  for (const [k, f] of missingInKu.entries()) {
    console.log(`Key: "${k}" in ${f}`);
  }
}

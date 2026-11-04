import fs from 'fs';

const content = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');
const enStart = content.indexOf('en: {');
const arStart = content.indexOf('ar: {');
const enSlice = content.substring(enStart, arStart);
const regex = /^\s*['"]([^'"]+)['"]\s*:\s*/gm;
const allKeys = [];
let m;
while ((m = regex.exec(enSlice)) !== null) {
  allKeys.push(m[1]);
}
const seen = new Set();
const dupes = [];
allKeys.forEach(k => {
  if (seen.has(k)) dupes.push(k);
  seen.add(k);
});
console.log('Total key declarations in en:', allKeys.length);
console.log('Unique keys in en:', seen.size);
console.log('Duplicate key count:', dupes.length);
console.log('Sample duplicates:', dupes.slice(0, 15));

import fs from 'fs';

const content = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

function extractDict(startPattern, endPattern) {
  const startIndex = content.indexOf(startPattern);
  if (startIndex === -1) throw new Error('Start not found: ' + startPattern);
  const endIndex = content.indexOf(endPattern, startIndex);
  if (endIndex === -1) throw new Error('End not found: ' + endPattern);
  
  const slice = content.substring(startIndex, endIndex);
  const keys = new Map();
  const regex = /^\s*['"]([^'"]+)['"]\s*:\s*['"]((?:\\['"]|[^'"])*)['"],?/gm;
  let match;
  while ((match = regex.exec(slice)) !== null) {
    keys.set(match[1], match[2]);
  }
  return keys;
}

const enDict = extractDict('  en: {', '  ar: {');
const arDict = extractDict('  ar: {', '  ku: {');
const kuDict = extractDict('  ku: {', '  }\n};');

console.log('=== DICTIONARY AUDIT ===');
console.log('Total English (en) keys:', enDict.size);
console.log('Total Arabic (ar) keys:', arDict.size);
console.log('Total Kurdish (ku) keys:', kuDict.size);

const missingInAr = [...enDict.keys()].filter(k => !arDict.has(k));
const missingInKu = [...enDict.keys()].filter(k => !kuDict.has(k));
const missingInEnFromKu = [...kuDict.keys()].filter(k => !enDict.has(k));
const missingInEnFromAr = [...arDict.keys()].filter(k => !enDict.has(k));

console.log('\nMissing in Arabic (ar) from en:', missingInAr.length);
if (missingInAr.length > 0) {
  console.log('Sample missing in ar:', missingInAr.slice(0, 20));
}

console.log('\nMissing in Kurdish (ku) from en:', missingInKu.length);
if (missingInKu.length > 0) {
  console.log('Sample missing in ku:', missingInKu.slice(0, 20));
}

console.log('\nKeys in ku not in en:', missingInEnFromKu.length);
if (missingInEnFromKu.length > 0) {
  console.log('Sample ku-only keys:', missingInEnFromKu.slice(0, 20));
}

console.log('\nKeys in ar not in en:', missingInEnFromAr.length);
if (missingInEnFromAr.length > 0) {
  console.log('Sample ar-only keys:', missingInEnFromAr.slice(0, 20));
}

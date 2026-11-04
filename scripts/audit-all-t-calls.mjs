import fs from 'fs';
import path from 'path';

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

function getFiles(dir, exts = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        results = results.concat(getFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(file))) {
      results.push(fullPath);
    }
  }
  return results;
}

const srcFiles = getFiles('src');
console.log(`Auditing ${srcFiles.length} files in src/...`);

const missingKeys = new Map(); // key -> { files: [], defaultValues: [] }

const tRegex = /\bt\(\s*['"]([^'"]+)['"](?:\s*,\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"))?/g;

for (const file of srcFiles) {
  if (file.includes('I18nProvider.tsx')) continue;
  const fileContent = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tRegex.exec(fileContent)) !== null) {
    const key = match[1];
    const defaultVal = match[2] || match[3] || '';
    if (!enDict.has(key)) {
      if (!missingKeys.has(key)) {
        missingKeys.set(key, { files: new Set(), defaultValues: new Set() });
      }
      missingKeys.get(key).files.add(file);
      if (defaultVal) missingKeys.get(key).defaultValues.add(defaultVal);
    }
  }
}

console.log(`\nFound ${missingKeys.size} distinct keys used in code but missing from I18nProvider.tsx:`);
const missingList = [];
for (const [key, data] of missingKeys.entries()) {
  const item = {
    key,
    files: Array.from(data.files).map(f => f.replace(/\\/g, '/')),
    defaultValues: Array.from(data.defaultValues)
  };
  missingList.push(item);
  console.log(`- ${key}: used in [${item.files.join(', ')}], default: "${item.defaultValues.join(' | ')}"`);
}

fs.writeFileSync('scripts/audit-missing-keys.json', JSON.stringify(missingList, null, 2));
console.log('\nWrote full list to scripts/audit-missing-keys.json');

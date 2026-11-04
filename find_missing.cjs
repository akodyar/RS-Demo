const fs = require('fs');

const appContent = fs.readFileSync('src/pages/AddPropertyPage.tsx', 'utf-8');
const i18nContent = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf-8');

const tRegex = /t\(['"](.*?)['"]\s*,\s*['"](.*?)['"]\)/g;
let match;
const appKeys = new Map();
while ((match = tRegex.exec(appContent)) !== null) {
  appKeys.set(match[1], match[2]);
}

const enBlockMatch = i18nContent.match(/en: \{([\s\S]*?)\},[\s\S]*?ar: \{/);
if (!enBlockMatch) {
  console.log('Could not find EN block');
  process.exit(1);
}
const enBlock = enBlockMatch[1];
const i18nKeys = new Set();
const keyRegex = /'([^']+)':/g;
while ((match = keyRegex.exec(enBlock)) !== null) {
  i18nKeys.add(match[1]);
}

let missing = 0;
const missingArr = [];
for (const [key, fallback] of appKeys.entries()) {
  if (!i18nKeys.has(key)) {
    missingArr.push(`${key}: ${fallback}`);
    missing++;
  }
}
fs.writeFileSync('missing.txt', missingArr.join('\n'), 'utf-8');
console.log('Total missing:', missing);

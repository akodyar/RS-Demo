import fs from 'node:fs';

const content = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf-8');
const lines = content.split('\n');

// Analyze en
const enBlock1: Record<string, string> = {};
const enBlock2: Record<string, string> = {};

for (let i = 667; i <= 710; i++) {
  const match = lines[i].match(/'([^']+)':\s*'([^']*)'/);
  if (match) enBlock1[match[1]] = match[2];
}

for (let i = 738; i <= 821; i++) {
  const match = lines[i].match(/'([^']+)':\s*'([^']*)'/);
  if (match) enBlock2[match[1]] = match[2];
}

console.log('Block 1 keys:', Object.keys(enBlock1).length);
console.log('Block 2 keys:', Object.keys(enBlock2).length);

// Keys in block 2 but not in block 1
const onlyInBlock2 = Object.keys(enBlock2).filter(k => !enBlock1[k]);
console.log('Keys only in block 2:', onlyInBlock2);
for (const k of onlyInBlock2) {
  console.log(`  ${k}: "${enBlock2[k]}"`);
}

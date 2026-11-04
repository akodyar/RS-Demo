import fs from 'node:fs';
import path from 'node:path';
import { newTranslations } from './generate-synchronized-translations';
import { translations } from '../src/i18n/I18nProvider';

const providerPath = path.join(process.cwd(), 'src', 'i18n', 'I18nProvider.tsx');
let content = fs.readFileSync(providerPath, 'utf-8');

// Determine what needs to be added for each language
const toAdd = {
  en: [] as { key: string; val: string }[],
  ar: [] as { key: string; val: string }[],
  ku: [] as { key: string; val: string }[],
};

for (const item of newTranslations) {
  for (const lang of ['en', 'ar', 'ku'] as const) {
    const existing = translations[lang][item.key];
    if (existing === undefined || existing.trim() === '') {
      toAdd[lang].push({ key: item.key, val: item[lang] });
    }
  }
}

console.log(`Keys to add: EN=${toAdd.en.length}, AR=${toAdd.ar.length}, KU=${toAdd.ku.length}`);

function escapeForSingleQuote(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function generateChunk(items: { key: string; val: string }[], header: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`    // ========================================================`);
  lines.push(`    // ${header}`);
  lines.push(`    // ========================================================`);
  for (const item of items) {
    lines.push(`    '${escapeForSingleQuote(item.key)}': '${escapeForSingleQuote(item.val)}',`);
  }
  return lines.join('\n');
}

// 1. Insert EN chunk
// In EN, find the target anchor:
// 'owner.companies.zero_delegation': 'Zero management delegation'
const enAnchor = `'owner.companies.zero_delegation': 'Zero management delegation'`;
if (!content.includes(enAnchor)) {
  throw new Error('Could not find enAnchor');
}
const enChunk = generateChunk(toAdd.en, 'SYNCHRONIZED TRANSLATIONS — FULL PARITY EXTENSION');
content = content.replace(enAnchor, `${enAnchor},${enChunk}`);

// 2. Insert AR chunk
// In AR, find target anchor:
// 'owner.companies.zero_delegation': 'بدون تفويض إداري'
const arAnchor = `'owner.companies.zero_delegation': 'بدون تفويض إداري'`;
if (!content.includes(arAnchor)) {
  throw new Error('Could not find arAnchor');
}
const arChunk = generateChunk(toAdd.ar, 'SYNCHRONIZED TRANSLATIONS — FULL PARITY EXTENSION');
content = content.replace(arAnchor, `${arAnchor},${arChunk}`);

// 3. Insert KU chunk
// In KU, find target anchor:
// 'owner.companies.zero_delegation': 'بەبێ هیچ ڕاسپاردنێکی بەڕێوەبردن'
const kuAnchor = `'owner.companies.zero_delegation': 'بەبێ هیچ ڕاسپاردنێکی بەڕێوەبردن'`;
if (!content.includes(kuAnchor)) {
  throw new Error('Could not find kuAnchor');
}
const kuChunk = generateChunk(toAdd.ku, 'SYNCHRONIZED TRANSLATIONS — FULL PARITY EXTENSION');
content = content.replace(kuAnchor, `${kuAnchor},${kuChunk}`);

// Write to I18nProvider.tsx
fs.writeFileSync(providerPath, content, 'utf-8');
console.log('Successfully updated src/i18n/I18nProvider.tsx with full synchronized parity!');

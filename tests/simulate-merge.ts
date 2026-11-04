import { newTranslations } from '../scripts/generate-synchronized-translations';
import { translations } from '../src/i18n/I18nProvider';

const merged: Record<'en' | 'ar' | 'ku', Record<string, string>> = {
  en: { ...translations.en },
  ar: { ...translations.ar },
  ku: { ...translations.ku },
};

const newMap = new Map<string, { en: string; ar: string; ku: string }>();
for (const item of newTranslations) {
  newMap.set(item.key, item);
}

let added = { en: 0, ar: 0, ku: 0 };

for (const [key, item] of newMap.entries()) {
  for (const lang of ['en', 'ar', 'ku'] as const) {
    if (!merged[lang][key] || merged[lang][key].trim() === '') {
      merged[lang][key] = item[lang];
      added[lang]++;
    }
  }
}

console.log('Added keys count:', added);

// Now check if ANY discrepancy remains
const enKeys = new Set(Object.keys(merged.en));
const arKeys = new Set(Object.keys(merged.ar));
const kuKeys = new Set(Object.keys(merged.ku));

console.log('Final counts:');
console.log('en keys:', enKeys.size);
console.log('ar keys:', arKeys.size);
console.log('ku keys:', kuKeys.size);

const allMergedKeys = new Set([...enKeys, ...arKeys, ...kuKeys]);
console.log('Union keys:', allMergedKeys.size);

let missingInEn = 0;
let missingInAr = 0;
let missingInKu = 0;

for (const key of allMergedKeys) {
  if (!enKeys.has(key)) missingInEn++;
  if (!arKeys.has(key)) missingInAr++;
  if (!kuKeys.has(key)) missingInKu++;
}

console.log('Remaining missing:');
console.log('en:', missingInEn);
console.log('ar:', missingInAr);
console.log('ku:', missingInKu);

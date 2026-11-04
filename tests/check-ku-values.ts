import { translations } from '../src/i18n/I18nProvider.js';

const ku = translations.ku;
const en = translations.en;
const ar = translations.ar;

// Check for identical values in ku and en where value contains letters (potential untranslated English)
const englishInKu: { key: string; kuVal: string; enVal: string }[] = [];
const arabicInKu: { key: string; kuVal: string; arVal: string }[] = [];
const rawKeysInKu: string[] = [];

// Regex to check if text contains predominantly English letters
const hasEnglishLetters = /[a-zA-Z]{3,}/;
// Pure Arabic letters that are distinct from Kurdish (e.g. ة, ذ, ث, ص, ض, ط, ظ, ي without dot, etc.)
const distinctiveArabic = /[ةذثضظ]/;

for (const [key, val] of Object.entries(ku)) {
  if (val === key) {
    rawKeysInKu.push(key);
  }
  // Check if val is identical to en and has english letters (exclude technical acronyms like IQD, USD, API, OTP, FIB, 2FA, SMS, etc.)
  if (val === en[key] && hasEnglishLetters.test(val)) {
    const isTechnical = /^(IQD|USD|API|OTP|FIB|FastPay|ZainCash|2FA|SMS|ID|KRG|JSON|CSV|PDF|PNG|JPG|EUR|GBP|IBAN|SWIFT|QR|N\/A|m²|sqft)$/i.test(val.trim());
    if (!isTechnical && val.length > 5) {
      englishInKu.push({ key, kuVal: val, enVal: en[key] });
    }
  }
}

import fs from 'node:fs';

fs.writeFileSync(
  'tests/untranslated-ku.json',
  JSON.stringify(englishInKu, null, 2),
  'utf-8'
);

console.log(`Saved ${englishInKu.length} untranslated items to tests/untranslated-ku.json`);

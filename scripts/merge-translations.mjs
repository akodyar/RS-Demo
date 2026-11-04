import fs from 'fs';
import { newTranslations } from './new-translations-data.mjs';

const filePath = 'src/i18n/I18nProvider.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Build snippet to insert into en, ar, ku
function buildSnippet(lang) {
  let lines = [];
  for (const [key, trans] of Object.entries(newTranslations)) {
    const val = trans[lang] ?? trans.en;
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    lines.push(`    '${key}': '${escaped}',`);
  }
  return lines.join('\n');
}

const enSnippet = '\n    // --- Redesigned Homepage & Audited Keys ---\n' + buildSnippet('en') + '\n';
const arSnippet = '\n    // --- Redesigned Homepage & Audited Keys ---\n' + buildSnippet('ar') + '\n';
const kuSnippet = '\n    // --- Redesigned Homepage & Audited Keys ---\n' + buildSnippet('ku') + '\n';

// 1. Insert into en (before '  ar: {')
const arIndex = content.indexOf('  ar: {');
if (arIndex === -1) throw new Error('Could not find ar dictionary start');
content = content.substring(0, arIndex) + enSnippet + '  ' + content.substring(arIndex);

// 2. Insert into ar (before '  ku: {')
const kuIndex = content.indexOf('  ku: {');
if (kuIndex === -1) throw new Error('Could not find ku dictionary start');
content = content.substring(0, kuIndex) + arSnippet + '  ' + content.substring(kuIndex);

// 3. Insert into ku (before '  }\n};' or before closing brace of translations object)
const closingIndex = content.indexOf('  }\n};');
if (closingIndex === -1) throw new Error('Could not find translations closing');
content = content.substring(0, closingIndex) + kuSnippet + '  ' + content.substring(closingIndex);

// 4. Update language normalization in I18nProvider to handle 'ckb' / 'ckb-IQ'
const oldInit = `    if (initialLanguage) return initialLanguage;
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        if (urlLang === 'ar' || urlLang === 'en' || urlLang === 'ku') {
          return urlLang;
        }
        const saved = localStorage.getItem('homehub_lang');
        if (saved === 'ar' || saved === 'en' || saved === 'ku') {
          return saved;
        }
      }
    } catch (e) {}
    return 'ku';`;

const newInit = `    const normalize = (l: string | null | undefined): SupportedLanguage => {
      if (l === 'en' || l === 'ar' || l === 'ku') return l;
      if (l === 'ckb' || l === 'ckb-IQ' || l === 'ku-IQ') return 'ku';
      return 'ku';
    };
    if (initialLanguage) return normalize(initialLanguage);
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        if (urlLang) return normalize(urlLang);
        const saved = localStorage.getItem('homehub_lang');
        if (saved) return normalize(saved);
      }
    } catch (e) {}
    return 'ku';`;

if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
  console.log('Updated language initialization with ckb normalization.');
} else {
  console.log('Language initialization already updated or pattern differed.');
}

// Write updated I18nProvider.tsx
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated src/i18n/I18nProvider.tsx with', Object.keys(newTranslations).length, 'new keys across EN, AR, and KU!');

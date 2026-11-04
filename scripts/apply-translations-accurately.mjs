import fs from 'fs';
import { newTranslations } from './new-translations-data.mjs';

const filePath = 'src/i18n/I18nProvider.tsx';
let raw = fs.readFileSync(filePath, 'utf8');
const isCRLF = raw.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

let arLineIdx = -1;
let kuLineIdx = -1;
let providerLineIdx = -1;

for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed === 'ar: {' && arLineIdx === -1) {
    arLineIdx = i;
  } else if (trimmed === 'ku: {' && kuLineIdx === -1) {
    kuLineIdx = i;
  } else if (trimmed.startsWith('export const I18nProvider') && providerLineIdx === -1) {
    providerLineIdx = i;
  }
}

console.log('Markers:', { arLineIdx, kuLineIdx, providerLineIdx });

// In en: find '  },' before arLineIdx
let enClosingBraceIdx = -1;
for (let i = arLineIdx - 1; i >= 0; i--) {
  if (lines[i].trim() === '},') {
    enClosingBraceIdx = i;
    break;
  }
}

// In ar: find '  },' before kuLineIdx
let arClosingBraceIdx = -1;
for (let i = kuLineIdx - 1; i >= 0; i--) {
  if (lines[i].trim() === '},') {
    arClosingBraceIdx = i;
    break;
  }
}

// In ku: find '  }' before providerLineIdx
let kuClosingBraceIdx = -1;
for (let i = providerLineIdx - 1; i >= 0; i--) {
  if (lines[i].trim() === '}') {
    kuClosingBraceIdx = i;
    break;
  }
}

console.log('Closing brace indices:', { enClosingBraceIdx, arClosingBraceIdx, kuClosingBraceIdx });
console.log('Line before enClosingBrace:', lines[enClosingBraceIdx - 1]);
console.log('Line before arClosingBrace:', lines[arClosingBraceIdx - 1]);
console.log('Line before kuClosingBrace:', lines[kuClosingBraceIdx - 1]);

// Ensure line before closing brace has a trailing comma
if (!lines[enClosingBraceIdx - 1].trim().endsWith(',')) {
  lines[enClosingBraceIdx - 1] = lines[enClosingBraceIdx - 1] + ',';
}
if (!lines[arClosingBraceIdx - 1].trim().endsWith(',')) {
  lines[arClosingBraceIdx - 1] = lines[arClosingBraceIdx - 1] + ',';
}
if (!lines[kuClosingBraceIdx - 1].trim().endsWith(',')) {
  lines[kuClosingBraceIdx - 1] = lines[kuClosingBraceIdx - 1] + ',';
}

function generateLines(lang) {
  const result = [];
  result.push(`    // --- Redesigned Homepage & Audited Keys (${lang}) ---`);
  for (const [key, trans] of Object.entries(newTranslations)) {
    const val = trans[lang] ?? trans.en;
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    result.push(`    '${key}': '${escaped}',`);
  }
  return result;
}

const enLines = generateLines('en');
const arLines = generateLines('ar');
const kuLines = generateLines('ku');

// Insert directly BEFORE the closing brace, in reverse order
lines.splice(kuClosingBraceIdx, 0, ...kuLines);
lines.splice(arClosingBraceIdx, 0, ...arLines);
lines.splice(enClosingBraceIdx, 0, ...enLines);

let newContent = lines.join(eol);

// Update normalization logic
const oldInitCRLF = `  const [language, setLanguageState] = useState<SupportedLanguage>(() => {\r
    try {\r
      if (typeof window !== 'undefined') {\r
        const params = new URLSearchParams(window.location.search);\r
        const urlLang = params.get('lang');\r
        if (urlLang === 'ar' || urlLang === 'en' || urlLang === 'ku') {\r
          return urlLang;\r
        }\r
        const saved = localStorage.getItem('homehub_lang');\r
        if (saved === 'ar' || saved === 'en' || saved === 'ku') {\r
          return saved;\r
        }\r
      }\r
    } catch (e) {}\r
    return 'ku';\r
  });`;

const oldInitLF = `  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
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
    return 'ku';
  });`;

const newInit = `  const normalizeLang = (l: string | null | undefined): SupportedLanguage => {
    if (l === 'en' || l === 'ar' || l === 'ku') return l;
    if (l === 'ckb' || l === 'ckb-IQ' || l === 'ku-IQ') return 'ku';
    return 'ku';
  };

  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        if (urlLang) {
          return normalizeLang(urlLang);
        }
        const saved = localStorage.getItem('homehub_lang');
        if (saved) {
          return normalizeLang(saved);
        }
      }
    } catch (e) {}
    return 'ku';
  });`.replace(/\n/g, eol);

if (newContent.includes(oldInitCRLF)) {
  newContent = newContent.replace(oldInitCRLF, newInit);
  console.log('Replaced oldInitCRLF successfully.');
} else if (newContent.includes(oldInitLF)) {
  newContent = newContent.replace(oldInitLF, newInit);
  console.log('Replaced oldInitLF successfully.');
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Accurate merge completed!');

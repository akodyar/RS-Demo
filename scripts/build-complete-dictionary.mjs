import fs from 'fs';
import path from 'path';
import { translations } from '../src/i18n/I18nProvider.tsx';
import { newTranslations } from './new-translations-data.mjs';

const phase50Map = JSON.parse(fs.readFileSync('tests/new-translations-map.json', 'utf8'));

// 1. Scan src/ for all t(...) calls
const srcDir = path.join(process.cwd(), 'src');
const allTCalls = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        scanDir(fullPath);
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\- ]+)['"]\s*(?:,\s*(?:['"`]([\s\S]*?)['"`]|([^)]*)))?\s*\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        allTCalls.push({
          file: path.relative(process.cwd(), fullPath),
          key: match[1],
          defaultValue: match[2] || '',
        });
      }
    }
  }
}
scanDir(srcDir);

// 2. Build master translation dictionary
const master = new Map(); // key -> { en, ar, ku }

// Helper to set or update
function setTrans(k, en, ar, ku) {
  if (!master.has(k)) {
    master.set(k, { en: en || '', ar: ar || '', ku: ku || '' });
  } else {
    const entry = master.get(k);
    if (en && (!entry.en || entry.en === '')) entry.en = en;
    if (ar && (!entry.ar || entry.ar === '')) entry.ar = ar;
    if (ku && (!entry.ku || entry.ku === '')) entry.ku = ku;
  }
}

// A. Existing in I18nProvider
for (const [k, v] of Object.entries(translations.en)) {
  if (!master.has(k)) master.set(k, { en: v, ar: '', ku: '' });
  else master.get(k).en = v;
}
for (const [k, v] of Object.entries(translations.ar)) {
  if (!master.has(k)) master.set(k, { en: '', ar: v, ku: '' });
  else master.get(k).ar = v;
}
for (const [k, v] of Object.entries(translations.ku)) {
  if (!master.has(k)) master.set(k, { en: '', ar: '', ku: v });
  else master.get(k).ku = v;
}

// B. Phase 50 Map
for (const item of phase50Map) {
  const k = item.key;
  if (!master.has(k)) master.set(k, { en: item.en || '', ar: item.ar || '', ku: item.ku || '' });
  const entry = master.get(k);
  if (item.en && !entry.en) entry.en = item.en;
  if (item.ar && !entry.ar) entry.ar = item.ar;
  if (item.ku && !entry.ku) entry.ku = item.ku;
}

// C. Code defaults
for (const call of allTCalls) {
  const k = call.key;
  if (!master.has(k)) {
    master.set(k, { en: '', ar: '', ku: '' });
  }
  const entry = master.get(k);
  const def = call.defaultValue ? call.defaultValue.trim() : '';
  if (def) {
    const hasArabicOrKurdish = /[\u0600-\u06FF]/.test(def);
    if (hasArabicOrKurdish) {
      if (!entry.ku) entry.ku = def;
      if (!entry.ar) entry.ar = def;
    } else {
      if (!entry.en) entry.en = def;
    }
  }
}

// D. Homepage redesign & audited keys
for (const [k, trans] of Object.entries(newTranslations)) {
  if (!master.has(k)) master.set(k, { en: trans.en, ar: trans.ar, ku: trans.ku });
  const entry = master.get(k);
  entry.en = trans.en;
  entry.ar = trans.ar;
  entry.ku = trans.ku;
}

// Ensure home.hero_title_suffix is non-empty in Arabic as well
if (master.has('home.hero_title_suffix')) {
  master.get('home.hero_title_suffix').ar = 'اليوم';
}

// E. Fallback resolution for any remaining empty fields
for (const [k, v] of master.entries()) {
  // If en is empty
  if (!v.en || v.en === '') {
    v.en = v.ku || v.ar || k.split('.').pop().replace(/_/g, ' ');
  }
  // If ar is empty
  if (!v.ar || v.ar === '') {
    v.ar = v.ku || v.en;
  }
  // If ku is empty
  if (!v.ku || v.ku === '') {
    v.ku = v.ar || v.en;
  }
}

console.log('Final Master Dictionary size:', master.size);

// Verification of completeness
let emptyEn = 0, emptyAr = 0, emptyKu = 0;
for (const [k, v] of master.entries()) {
  if (!v.en || v.en.trim() === '') emptyEn++;
  if (!v.ar || v.ar.trim() === '') emptyAr++;
  if (!v.ku || v.ku.trim() === '') emptyKu++;
}
console.log('Empty checks:', { emptyEn, emptyAr, emptyKu });

// Sort keys alphabetically for clean diffs
const sortedKeys = Array.from(master.keys()).sort();

function serializeDict(lang) {
  const lines = [];
  for (const k of sortedKeys) {
    const val = master.get(k)[lang];
    const escaped = val
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
    lines.push(`    '${k}': '${escaped}',`);
  }
  return lines.join('\n');
}

const enDictStr = serializeDict('en');
const arDictStr = serializeDict('ar');
const kuDictStr = serializeDict('ku');

const newI18nFile = `import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedLanguage = 'en' | 'ar' | 'ku';
export type Direction = 'ltr' | 'rtl';

interface I18nContextType {
  language: SupportedLanguage;
  direction: Direction;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultValue?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
${enDictStr}
  },

  ar: {
${arDictStr}
  },

  ku: {
${kuDictStr}
  }
};

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLanguage?: SupportedLanguage;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, initialLanguage }) => {
  const normalizeLang = (l: string | null | undefined): SupportedLanguage => {
    if (l === 'en' || l === 'ar' || l === 'ku') return l;
    if (l === 'ckb' || l === 'ckb-IQ' || l === 'ku-IQ') return 'ku';
    return 'ku';
  };

  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (initialLanguage) return normalizeLang(initialLanguage);
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
  });

  const direction: Direction = (language === 'ar' || language === 'ku') ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language === 'ku' ? 'ku' : language;
  }, [language, direction]);

  const setLanguage = (lang: SupportedLanguage) => {
    const normalized = normalizeLang(lang);
    setLanguageState(normalized);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('homehub_lang', normalized);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setHomeHubLanguage = (lang: SupportedLanguage) => {
        setLanguage(lang);
      };
    }
  }, []);

  const t = (key: string, defaultValue?: string): string => {
    // 1. Direct translation key match in current language
    if (translations[language] && translations[language][key] !== undefined) {
      return translations[language][key];
    }
    // 2. Fallback to English dictionary if key missing in ar/ku
    if (language !== 'en' && translations.en && translations.en[key] !== undefined) {
      return translations.en[key];
    }
    // 3. Default value fallback when key missing in current language and English
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // 4. Fallback for Kurdish language directly matching key only if non-English
    if (language !== 'en' && translations.ku && translations.ku[key] !== undefined) {
      return translations.ku[key];
    }
    // 5. Final key fallback
    return key;
  };

  return (
    <I18nContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
`;

fs.writeFileSync('src/i18n/I18nProvider.tsx', newI18nFile, 'utf8');
console.log('Successfully re-generated src/i18n/I18nProvider.tsx with escaped newlines!');

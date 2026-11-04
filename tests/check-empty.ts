import { translations } from '../src/i18n/I18nProvider';

(['en', 'ar', 'ku'] as const).forEach(lang => {
  const empty = Object.entries(translations[lang]).filter(([k, v]) => !v || v.trim() === '');
  console.log(`${lang} empty values count: ${empty.length}`);
  if (empty.length > 0) {
    console.log(`${lang} empty sample:`, empty.slice(0, 10));
  }
});

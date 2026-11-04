import fs from 'fs';

const i18n = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const targets = [
  'داشبۆرد',
  'مۆڵکەکان',
  'کرێچی',
  'ژمێریاری و دارایی',
  'شایستە داراییەکان',
  'چاکسازی',
  'ڕاپۆرتە داراییەکان',
  'خاڵ و پاداشت',
  'گۆڕینی شوێنی کار'
];

for (const t of targets) {
  const lines = i18n.split('\n');
  const matched = lines.filter(l => l.includes(t));
  console.log(`=== ${t} ===`);
  matched.slice(0, 5).forEach(m => console.log('  ', m.trim()));
}

import { newTranslations } from '../scripts/generate-synchronized-translations';
import { translations } from '../src/i18n/I18nProvider';

let conflicts = 0;
for (const item of newTranslations) {
  for (const lang of ['en', 'ar', 'ku'] as const) {
    const existing = translations[lang][item.key];
    if (existing !== undefined && existing !== item[lang]) {
      conflicts++;
      if (conflicts <= 15) {
        console.log(`Diff in ${lang} for '${item.key}':`);
        console.log(`  EXISTING: '${existing}'`);
        console.log(`  NEW:      '${item[lang]}'`);
      }
    }
  }
}
console.log('Total differences with existing:', conflicts);

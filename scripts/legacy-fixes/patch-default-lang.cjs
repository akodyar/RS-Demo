const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// The default language might be set in useState('en')
s = s.replace(/useState<SupportedLanguage>\('en'\)/g, "useState<SupportedLanguage>('ku')");
fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

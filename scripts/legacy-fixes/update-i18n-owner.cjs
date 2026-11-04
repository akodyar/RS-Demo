const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const ownerKu = `
    // OWNER FIXES
    'owner.portfolio_properties': 'موڵکەکانی پۆرتفۆلیۆ',
    'property.health': 'تەندروستیی موڵک',
    'analytics.ai_disclaimer': 'پێشنیارە زیرەکەکان بە شێوەیەکی سەربەخۆ کردارەکان جێبەجێ ناکەن.',
    
    // TIME MONTHS
    'time.may': 'ئایار',
    'time.jun': 'حوزەیران',
    'time.jul': 'تەممووز',
    'time.aug': 'ئاب',
    'time.sep': 'ئەیلوول',
    'time.oct': 'تشرینی یەکەم',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + ownerKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

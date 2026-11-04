const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const miscKu = `
    // WORKSPACE EMPTY STATES
    'ui.feature_unavailable': 'ئەم تایبەتمەندییە لە ئێستادا بەردەست نییە یان چاوەڕوانی یەکخستنە.',
    'ui.no_data': 'هیچ زانیارییەک بەردەست نییە',
    'ui.module_not_configured': 'ئەم مۆدیولە هێشتا بە تەواوی ڕێکنەخراوە لەگەڵ سەرچاوەکانی زانیاری ڕاستەقینە.',

    // TITLES
    'trust.title': 'متمانە و پابەندبوون',
    'crm.title': 'بەڕێوەبردنی پەیوەندییەکان و بازاڕ',
    'intelligence.title': 'زیرەکی بازرگانی',
    'passport.title': 'پاسپۆرتی موڵک',
    'autopilot.title': 'یاریدەدەری زیرەکی دەستکرد',
    'marketplace.title': 'بازاڕی موڵک و خانووبەرە',
    'buyer.title': 'شوێنی کاری کڕیار',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + miscKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
console.log('Misc translations added.');

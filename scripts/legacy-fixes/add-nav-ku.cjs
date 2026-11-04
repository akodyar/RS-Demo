const fs = require('fs');

const moreKu = `
    'nav.home': 'سەرەکی',
    'nav.operations': 'کارەکان',
    'nav.owners': 'خاوەن موڵکەکان',
    'nav.leads': 'داواکارییەکان',
    'nav.finance': 'دارایی',
    'nav.team': 'تیم',
    'nav.properties_short': 'موڵک',
    'nav.operations_short': 'کارەکان',
    'company.no_urgent': 'هیچ بابەتێکی بەپەلە نییە کە پێویستی بە سەرنج بێت.',
    'company.no_tasks': 'هیچ ئەرکێکت پێنەسێردراوە لە ئێستادا.',
    'company.no_approvals': 'هیچ پەسەندکردنێکی هەڵپەسێردراو نییە لە پۆرتفۆلیۆکەتدا.',
    'company.team_desc': 'دەستنیشانکردنی موڵک و دیاریکردنی ڕۆڵەکان (بەڕێوەبەر، بریکار).',
    'company.no_properties': 'هێشتا هیچ موڵکێکت بۆ دیاری نەکراوە.',
    'company.no_owners': 'هیچ ڕێکەوتنێکی کارای بەڕێوەبردنت لەگەڵ هیچ خاوەن موڵکێکدا نییە.',
    'company.crm_expansion': 'ئەم تایبەتمەندییە لە فراوانکردنی CRM بەردەست دەبێت.',
    'company.finance_expansion': 'ئەم تایبەتمەندییە لە بەشی دارایی بەردەست دەبێت.',
    'company.dashboard.desc': 'پۆرتفۆلیۆ، کارەکان، و تیمەکەت بەڕێوەببەرە.',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology", "ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology\n" + moreKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

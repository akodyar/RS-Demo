const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const navKu = `
    // COMPANY WORKSPACE NAVIGATION
    'nav.leads': 'کڕیارە پۆتانسیەلەکان و بازاڕ',
    'nav.finance': 'دارایی',
    'company.managed_owners': 'خاوەنە بەڕێوەدراوەکان',
    'company.invite_owner': 'بانگهێشتکردنی خاوەن',
    'company.no_owners_title': 'هیچ خاوەنێک نەدۆزرایەوە',
    'company.no_owners': 'هیچ ڕێککەوتنێکی چالاکی بەڕێوەبردنت لەگەڵ هیچ خاوەنێکدا نییە.',
    'company.leads_market': 'کڕیارە پۆتانسیەلەکان و بازاڕی موڵک',
    'company.crm_expansion': 'ئەم تایبەتمەندییە لە مۆدیولی بەڕێوەبردنی پەیوەندییەکان بەردەست دەبێت.',
    'company.financial_suite': 'ناوەندی دارایی',
    'company.finance_expansion': 'ئەم تایبەتمەندییە لە مۆدیولی دارایی بەردەست دەبێت.',
    'nav.home': 'سەرەتا',
    'nav.properties_short': 'موڵکەکان',
    'nav.operations_short': 'کارگێڕی',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + navKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

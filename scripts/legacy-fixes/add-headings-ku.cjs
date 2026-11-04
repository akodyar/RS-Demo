const fs = require('fs');

const headingsKu = `
    'company.pending_approvals': 'پەسەندکردنە هەڵپەسێردراوەکان',
    'company.all_caught_up': 'هەموو شتێک تەواو بووە',
    'company.team_members': 'ئەندامانی تیمی کۆمپانیا',
    'company.manage_team': 'بەڕێوەبردنی تیمەکەت',
    'company.managed_properties': 'موڵکە بەڕێوەبراوەکان',
    'company.no_properties_title': 'هیچ موڵکێک نەدۆزرایەوە',
    'company.managed_owners': 'خاوەن موڵکە بەڕێوەبراوەکان',
    'company.no_owners_title': 'هیچ خاوەن موڵکێک نەدۆزرایەوە',
    'company.leads_market': 'داواکارییەکان و بازاڕ',
    'company.financial_suite': 'بەشی دارایی',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology", "ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology\n" + headingsKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

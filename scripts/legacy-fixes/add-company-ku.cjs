const fs = require('fs');

const companyKu = `
    'company.dashboard': 'داشبۆردی کۆمپانیا',
    'company.stats.owners': 'خاوەن موڵکەکان',
    'company.stats.properties': 'خانووبەرەکان',
    'company.stats.tasks': 'ئەرکەکان',
    'company.stats.approvals': 'پەسەندکردنەکان',
    'company.needs_attention': 'پێویستی بە سەرنجە',
    'company.my_tasks': 'ئەرکەکانم',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology", "ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology\n" + companyKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

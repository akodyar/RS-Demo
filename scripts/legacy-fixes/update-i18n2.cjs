const fs = require('fs');

const rolesKu = `
    'role.owner': 'خاوەنی موڵک',
    'role.company': 'کۆمپانیای بەڕێوەبردن',
    'role.tenant': 'کرێنشین',
    'role.vendor': 'بەڵێندەری خزمەتگوزاری',
    'role.admin': 'بەڕێوەبەری سەکۆ',
    'status.loading': 'باردەکرێت...',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// Insert after 'ku: {'
s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology", "ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology\n" + rolesKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const adminKu = `
    // ADMIN
    'admin.control_center': 'ناوەندی کۆنترۆڵی بەڕێوەبەر',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + adminKu);
fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

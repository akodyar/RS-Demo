const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const enRoles = `
    'role.owner': 'Property Owner',
    'role.company': 'Management Company',
    'role.tenant': 'Tenant',
    'role.vendor': 'Service Vendor',
    'role.admin': 'Platform Admin',
    'status.loading': 'Loading...',
`;

s = s.replace(/en: \{/, "en: {\n" + enRoles);

const arRoles = `
    'role.owner': 'مالك العقار',
    'role.company': 'شركة إدارة',
    'role.tenant': 'مستأجر',
    'role.vendor': 'مقاول خدمات',
    'role.admin': 'مدير المنصة',
    'status.loading': 'جاري التحميل...',
`;

s = s.replace(/ar: \{/, "ar: {\n" + arRoles);

// Let's also remove duplicate 'role.vendor' in ku
s = s.replace(/    'role\.vendor': 'بەڵێندەری خزمەتگوزاری',\n    'role\.vendor\.desc'/g, "    'role.vendor.desc'");

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

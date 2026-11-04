const fs = require('fs');

const invitesKu = `
    'company.invite_member': 'بانگهێشتکردنی ئەندام',
    'company.invite_owner': 'بانگهێشتکردنی خاوەن موڵک',
    'company.view_all': 'بینینی هەموویان',
    'company.maintenance': 'چاککردنەوە',
    'company.tenants': 'کرێنشینەکان',
    'company.leases': 'گرێبەستەکان',
    'company.approvals': 'پەسەندکردنەکان',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology", "ku: {\n    // Kurdish Sorani translation (RTL) - Professional Terminology\n" + invitesKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

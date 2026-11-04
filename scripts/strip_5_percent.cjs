const fs = require('fs');
let content = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf-8');

// Replace English
content = content.replace(/\(5%\)/g, '');
content = content.replace(/\(95%\)/g, '');
content = content.replace(/5% management fee/g, 'management fee');
content = content.replace(/5% service fee/g, 'service fee');
content = content.replace(/5% rent management/g, 'rent management');
content = content.replace(/95% net owner payable/g, 'net owner payable');
content = content.replace(/A strict 5% commission/g, 'A strict commission');
content = content.replace(/Canonical 5% Rent/g, 'Canonical Rent');
content = content.replace(/5% commission/g, 'commission');
content = content.replace(/5% Commission/g, 'Commission');
content = content.replace(/5% HomeHub/g, 'HomeHub');
content = content.replace(/HomeHub Commission 5/g, 'HomeHub Management Commission');

// Replace Arabic
content = content.replace(/عمولة هومهب البالغة 5%/g, 'عمولة هومهب');
content = content.replace(/عمولة إدارة هومهب 5%/g, 'عمولة إدارة هومهب');
content = content.replace(/عمولة الإدارة 5%/g, 'عمولة الإدارة');
content = content.replace(/خصم 5% عمولة/g, 'خصم عمولة');
content = content.replace(/كيف يتم احتساب عمولة هومهب 5%؟/g, 'كيف يتم احتساب عمولة هومهب؟');

// Replace Kurdish
content = content.replace(/کۆمیسیۆنی ٥٪/g, 'کۆمیسیۆنی');
content = content.replace(/٥٪ کۆمیسیۆنی/g, 'کۆمیسیۆنی');
content = content.replace(/٥٪/g, '');

fs.writeFileSync('src/i18n/I18nProvider.tsx', content);
console.log('Fixed I18nProvider.tsx');

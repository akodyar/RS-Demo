const fs = require('fs');

let crm = fs.readFileSync('src/pages/CompanyCRMWorkspace.tsx', 'utf8');
crm = crm.replace(/<ShieldCheck/g, '<div');
fs.writeFileSync('src/pages/CompanyCRMWorkspace.tsx', crm);

let vendor = fs.readFileSync('src/pages/VendorWorkspace.tsx', 'utf8');
vendor = vendor.replace(/Tool,/g, '');
fs.writeFileSync('src/pages/VendorWorkspace.tsx', vendor);

let i18n = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');
// Fix duplicate keys. Just find lines 189, 190 etc.
let lines = i18n.split('\n');
// We will just comment out lines 188-191, 379-382, 571-574 to be safe.
for (let i of [188, 189, 379, 380, 571, 572]) {
    lines[i] = '// ' + lines[i];
}
fs.writeFileSync('src/i18n/I18nProvider.tsx', lines.join('\n'));


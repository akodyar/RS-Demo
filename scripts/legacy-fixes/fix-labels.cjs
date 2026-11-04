const fs = require('fs');

let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

s = s.replace(/label: 'Home'/g, "label: t('nav.home', 'Home')");
s = s.replace(/label: 'Owners'/g, "label: t('nav.owners', 'Owners')");
s = s.replace(/label: 'Properties'/g, "label: t('nav.properties', 'Properties')");
s = s.replace(/label: 'Operations'/g, "label: t('nav.operations', 'Operations')");
s = s.replace(/label: 'Leads & Market'/g, "label: t('nav.leads', 'Leads & Market')");
s = s.replace(/label: 'Finance'/g, "label: t('nav.finance', 'Finance')");
s = s.replace(/label: 'Team'/g, "label: t('nav.team', 'Team')");
s = s.replace(/label: 'Props'/g, "label: t('nav.properties_short', 'Props')");
s = s.replace(/label: 'Ops'/g, "label: t('nav.operations_short', 'Ops')");

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);

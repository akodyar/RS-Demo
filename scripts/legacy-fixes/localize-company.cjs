const fs = require('fs');

let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

s = s.replace(/>No urgent items requiring attention.</g, ">{t('company.no_urgent', 'No urgent items requiring attention.')}<");
s = s.replace(/>No tasks assigned to you right now.</g, ">{t('company.no_tasks', 'No tasks assigned to you right now.')}<");
s = s.replace(/>There are no pending approvals across your portfolio.</g, ">{t('company.no_approvals', 'There are no pending approvals across your portfolio.')}<");
s = s.replace(/>Assign properties and set specific roles \(Admin, Agent, Manager\)\.</g, ">{t('company.team_desc', 'Assign properties and set specific roles (Admin, Agent, Manager).')}<");
s = s.replace(/>You have not been assigned any properties yet.</g, ">{t('company.no_properties', 'You have not been assigned any properties yet.')}<");
s = s.replace(/>You don't have active management agreements with any owners.</g, ">{t('company.no_owners', 'You do not have active management agreements with any owners.')}<");
s = s.replace(/>Feature available in CRM expansion.</g, ">{t('company.crm_expansion', 'Feature available in CRM expansion.')}<");
s = s.replace(/>Feature available in Finance module.</g, ">{t('company.finance_expansion', 'Feature available in Finance module.')}<");
s = s.replace(/>Manage your portfolio, operations, and team.</g, ">{t('company.dashboard.desc', 'Manage your portfolio, operations, and team.')}<");

s = s.replace(/>Home</g, ">{t('nav.home', 'Home')}<");
s = s.replace(/>Operations</g, ">{t('nav.operations', 'Operations')}<");
s = s.replace(/>Owners</g, ">{t('nav.owners', 'Owners')}<");
s = s.replace(/>Properties</g, ">{t('nav.properties', 'Properties')}<");
s = s.replace(/>Leads \& Market</g, ">{t('nav.leads', 'Leads & Market')}<");
s = s.replace(/>Finance</g, ">{t('nav.finance', 'Finance')}<");
s = s.replace(/>Team</g, ">{t('nav.team', 'Team')}<");

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);

const fs = require('fs');

let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

s = s.replace(/>Pending Approvals</g, ">{t('company.pending_approvals', 'Pending Approvals')}<");
s = s.replace(/>All caught up</g, ">{t('company.all_caught_up', 'All caught up')}<");
s = s.replace(/>Company Team Members</g, ">{t('company.team_members', 'Company Team Members')}<");
s = s.replace(/>Manage your team</g, ">{t('company.manage_team', 'Manage your team')}<");
s = s.replace(/>Managed Properties</g, ">{t('company.managed_properties', 'Managed Properties')}<");
s = s.replace(/>No Properties Found</g, ">{t('company.no_properties_title', 'No Properties Found')}<");
s = s.replace(/>Managed Owners</g, ">{t('company.managed_owners', 'Managed Owners')}<");
s = s.replace(/>No Owners Found</g, ">{t('company.no_owners_title', 'No Owners Found')}<");
s = s.replace(/>Leads \& Marketplace</g, ">{t('company.leads_market', 'Leads & Marketplace')}<");
s = s.replace(/>Financial Suite</g, ">{t('company.financial_suite', 'Financial Suite')}<");

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);

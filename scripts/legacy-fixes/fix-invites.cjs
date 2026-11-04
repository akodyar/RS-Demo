const fs = require('fs');

let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

s = s.replace(/> Invite Member/g, ">{t('company.invite_member', 'Invite Member')}");
s = s.replace(/>\s*Invite Owner\s*<\/button>/g, ">{t('company.invite_owner', 'Invite Owner')}</button>");
s = s.replace(/>View All<\/Link>/g, ">{t('company.view_all', 'View All')}</Link>");
s = s.replace(/>Maintenance<\/span>/g, ">{t('company.maintenance', 'Maintenance')}</span>");
s = s.replace(/>Tenants<\/span>/g, ">{t('company.tenants', 'Tenants')}</span>");
s = s.replace(/>Leases<\/span>/g, ">{t('company.leases', 'Leases')}</span>");
s = s.replace(/>Approvals<\/span>/g, ">{t('company.approvals', 'Approvals')}</span>");

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);

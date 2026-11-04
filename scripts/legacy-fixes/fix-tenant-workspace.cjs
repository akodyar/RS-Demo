const fs = require('fs');
let s = fs.readFileSync('src/pages/TenantWorkspace.tsx', 'utf8');

s = s.replace(/>Loading your workspace...</g, ">{t('ui.loading_details', 'Loading your workspace...')}<");
s = s.replace(/>Unable to fetch lease data</g, ">{t('tenant.error.lease', 'Unable to fetch lease data')}<");
s = s.replace(/>You do not have any active leases at this time.</g, ">{t('tenant.no_lease', 'You do not have any active leases at this time.')}<");
s = s.replace(/>Action required for current billing cycle</g, ">{t('tenant.action_required', 'Action required for current billing cycle')}<");

s = s.replace(/Due: /g, "{t('tenant.due', 'Due: ')}");
s = s.replace(/'Next Cycle'/g, "t('tenant.next_cycle', 'Next Cycle')");
s = s.replace(/'UNKNOWN'/g, "t('property.unknown', 'UNKNOWN')");

s = s.replace(/>Property</g, ">{t('core.property', 'Property')}<");
s = s.replace(/>Unnamed</g, ">{t('property.unnamed', 'Unnamed')}<");
s = s.replace(/>Duration</g, ">{t('lease.term', 'Duration')}<");
s = s.replace(/>Quick Actions</g, ">{t('core.actions', 'Quick Actions')}<");
s = s.replace(/>Recent History</g, ">{t('core.history', 'Recent History')}<");

s = s.replace(/>September Rent</g, ">{t('tenant.mock.rent', 'September Rent')}<");
s = s.replace(/>Paid on Sep 01</g, ">{t('tenant.mock.paid', 'Paid on Sep 01')}<");

// Currency fallback
s = s.replace(/'USD'/g, "t('currency.iqd', 'IQD')");

fs.writeFileSync('src/pages/TenantWorkspace.tsx', s);

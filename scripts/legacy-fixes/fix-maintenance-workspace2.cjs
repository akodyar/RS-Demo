const fs = require('fs');
let s = fs.readFileSync('src/pages/MaintenanceWorkspacePage.tsx', 'utf8');

// Ensure dir={direction} on root div (from previous patch, wait let's check what root div is now)
s = s.replace('<div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">', '<div className={`flex flex-col gap-6 max-w-6xl mx-auto pb-12 ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');

// Status badges
s = s.replace(/>NEW REQUEST</g, ">{t('status.new_request', 'NEW REQUEST')}<");
s = s.replace(/>TRIAGED</g, ">{t('status.triaged', 'TRIAGED')}<");
s = s.replace(/>QUOTE READY</g, ">{t('status.quote_ready', 'QUOTE READY')}<");
s = s.replace(/>WORK ORDER</g, ">{t('status.work_order', 'WORK ORDER')}<");
s = s.replace(/>COMPLETED</g, ">{t('status.completed', 'COMPLETED')}<");
s = s.replace(/>CANCELLED</g, ">{t('status.cancelled', 'CANCELLED')}<");

// Text
s = s.replace(/>Maintenance Control Center</g, ">{t('maintenance.control_center', 'Maintenance Control Center')}<");
s = s.replace(/>Manage work orders, triage requests, and review quotes</g, ">{t('maintenance.subtitle', 'Manage work orders, triage requests, and review quotes')}<");
s = s.replace(/>Loading queue...</g, ">{t('ui.loading_details', 'Loading queue...')}<");
s = s.replace(/>Queue is empty</g, ">{t('maintenance.queue_empty', 'Queue is empty')}<");
s = s.replace(/>There are no active maintenance requests at this time.</g, ">{t('maintenance.no_requests', 'There are no active maintenance requests at this time.')}<");

s = s.replace(/"Failed to approve quote"/g, "t('maintenance.error.approve', 'Failed to approve quote')");
s = s.replace(/"Failed to fetch queue"/g, "t('maintenance.error.fetch', 'Failed to fetch queue')");
s = s.replace(/'Scheduling integration placeholder'/g, "t('ui.feature_unavailable', 'Feature available in upcoming integration.')");

fs.writeFileSync('src/pages/MaintenanceWorkspacePage.tsx', s);

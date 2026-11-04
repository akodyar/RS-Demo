const fs = require('fs');
let s = fs.readFileSync('src/pages/MaintenanceWorkspacePage.tsx', 'utf8');

// Ensure dir={direction} is applied
if (!s.includes('const { t, direction } = useI18n();')) {
  s = s.replace('const { t } = useI18n();', 'const { t, direction } = useI18n();');
}

s = s.replace('<div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">', '<div className={`p-6 max-w-7xl mx-auto flex flex-col gap-6 ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');

// Button text
s = s.replace(/>Triage \/ Assign</g, ">{t('maintenance.triage', 'Triage / Assign')}<");
s = s.replace(/>Cancel Request</g, ">{t('maintenance.cancel_request', 'Cancel Request')}<");
s = s.replace(/>Review Quote</g, ">{t('maintenance.review_quote', 'Review Quote')}<");
s = s.replace(/>View Work Order</g, ">{t('maintenance.view_work_order', 'View Work Order')}<");
s = s.replace(/>Request Details & Actions</g, ">{t('maintenance.details_actions', 'Request Details & Actions')}<");
s = s.replace(/>Loading details...</g, ">{t('ui.loading_details', 'Loading details...')}<");
s = s.replace(/>Pending Quotes</g, ">{t('maintenance.pending_quotes', 'Pending Quotes')}<");
s = s.replace(/Vendor ID:/g, "{t('vendor.id', 'Vendor ID:')}");
s = s.replace(/\$\{quote.totalAmount\}/g, "{quote.totalAmount} {t('currency.iqd', 'IQD')}");
s = s.replace(/> Approve & Create Work Order</g, "> {t('maintenance.approve_wo', 'Approve & Create Work Order')}");
s = s.replace(/>Active Work Orders</g, ">{t('maintenance.active_wos', 'Active Work Orders')}<");
s = s.replace(/WO:/g, "{t('maintenance.wo', 'WO:')}");
s = s.replace(/Assigned Vendor:/g, "{t('maintenance.assigned_vendor', 'Assigned Vendor:')}");
s = s.replace(/>Manage Schedule</g, ">{t('maintenance.manage_schedule', 'Manage Schedule')}<");

// Ensure to add these to I18nProvider
fs.writeFileSync('src/pages/MaintenanceWorkspacePage.tsx', s);

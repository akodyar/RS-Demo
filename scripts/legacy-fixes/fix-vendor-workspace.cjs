const fs = require('fs');
let s = fs.readFileSync('src/pages/VendorWorkspace.tsx', 'utf8');

// Header area checks
s = s.replace(/>Mark Completed</g, ">{t('status.completed', 'Mark Completed')}<");
s = s.replace(/>Submit Quote</g, ">{t('vendor.submit_quote', 'Submit Quote')}<");
s = s.replace(/>Cancel</g, ">{t('action.cancel', 'Cancel')}<");
s = s.replace(/>Labor Cost</g, ">{t('vendor.labor_cost', 'Labor Cost')}<");
s = s.replace(/>Materials Cost</g, ">{t('vendor.material_cost', 'Materials Cost')}<");
s = s.replace(/>Travel\/Service Fees</g, ">{t('vendor.fees', 'Travel/Service Fees')}<");
s = s.replace(/>Total Quote</g, ">{t('vendor.total', 'Total Quote')}<");
s = s.replace(/>Estimated Duration</g, ">{t('vendor.estimated_duration', 'Estimated Duration')}<");
s = s.replace(/placeholder="e.g. 2 days"/g, "placeholder={t('vendor.duration_placeholder', 'e.g. 2 days')}");
s = s.replace(/>Notes</g, ">{t('core.notes', 'Notes')}<");
s = s.replace(/placeholder="Additional details..."/g, "placeholder={t('vendor.notes_placeholder', 'Additional details...')}");
s = s.replace(/\$\{Number\(quoteData.laborAmount\) \+ Number\(quoteData.materialsAmount\) \+ Number\(quoteData.feesAmount\)\}/g, "{Number(quoteData.laborAmount) + Number(quoteData.materialsAmount) + Number(quoteData.feesAmount)} {t('currency.iqd', 'IQD')}");

// Also check top of the file
s = s.replace(/>Unable to fetch assigned requests</g, ">{t('vendor.error.fetch', 'Unable to fetch assigned requests')}<");
s = s.replace(/>You have no active maintenance requests at this time.</g, ">{t('vendor.no_requests', 'You have no active maintenance requests at this time.')}<");
s = s.replace(/>Priority: /g, ">{t('maintenance.priority', 'Priority')}: <");

fs.writeFileSync('src/pages/VendorWorkspace.tsx', s);

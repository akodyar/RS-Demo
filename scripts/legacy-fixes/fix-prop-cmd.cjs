const fs = require('fs');

let s = fs.readFileSync('src/pages/PropertyCommandCenter.tsx', 'utf8');

// Ensure dir={direction} is set
if (!s.includes('const { t, direction } = useI18n();')) {
  s = s.replace('const { t } = useI18n();', 'const { t, direction } = useI18n();');
}

s = s.replace('<div className="flex flex-col gap-6">', '<div className={`flex flex-col gap-6 ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');

s = s.replace(/>Loading property details...</g, ">{t('property.loading', 'Loading property details...')}<");
s = s.replace(/>Unable to fetch real property data</g, ">{t('property.error.fetch', 'Unable to fetch real property data')}<");
s = s.replace(/>Property not found.</g, ">{t('property.not_found', 'Property not found.')}<");

s = s.replace(/property\.name \|\| 'Unnamed Property'/g, "property.name || t('property.unnamed', 'Unnamed Property')");
s = s.replace(/'No address provided'/g, "t('property.no_address', 'No address provided')");

s = s.replace(/>Ownership</g, ">{t('property.ownership.label', 'Ownership')}<");
s = s.replace(/>Verified \(100% Share\)</g, ">{t('property.ownership.verified', 'Verified (100% Share)')}<");
s = s.replace(/>Size</g, ">{t('property.size', 'Size')}<");
s = s.replace(/Sqm/g, "${t('property.sqm', 'Sqm')}");
s = s.replace(/'Unknown'/g, "t('property.unknown', 'Unknown')");
s = s.replace(/>Beds\/Baths</g, ">{t('property.beds_baths', 'Beds/Baths')}<");
s = s.replace(/>Status</g, ">{t('core.status', 'Status')}<");
s = s.replace(/>Vacant</g, ">{t('property.status_vacant', 'Vacant')}<");

s = s.replace(/>No active maintenance requests.</g, ">{t('property.no_maintenance', 'No active maintenance requests.')}<");

s = s.replace(/> Title Deed \(Verified\)/g, "> {t('document.title_deed', 'Title Deed (Verified)')}");
s = s.replace(/> Floor Plan PDF/g, "> {t('document.floor_plan', 'Floor Plan PDF')}");
s = s.replace(/> Previous Lease \(Expired\)/g, "> {t('document.previous_lease', 'Previous Lease (Expired)')}");

s = s.replace(/>Activity Timeline</g, ">{t('property.timeline', 'Activity Timeline')}<");
s = s.replace(/>Property Acquired</g, ">{t('timeline.acquired', 'Property Acquired')}<");
s = s.replace(/>Ownership Verified</g, ">{t('timeline.verified', 'Ownership Verified')}<");

fs.writeFileSync('src/pages/PropertyCommandCenter.tsx', s);

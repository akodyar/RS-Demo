const fs = require('fs');

function patchFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  let s = fs.readFileSync(filepath, 'utf8');

  // Inject useI18n if not present, though it usually is.
  // Add dir={direction} to the root div if not present.
  if (s.includes('export const OwnerWorkspacePage: React.FC = () => {')) {
    if (!s.includes('const { t, direction } = useI18n();')) {
      s = s.replace('const { t } = useI18n();', 'const { t, direction } = useI18n();');
    }
    s = s.replace('<div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">', '<div className={`p-6 max-w-7xl mx-auto flex flex-col gap-6 ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');
    
    // Some hardcoded texts
    s = s.replace(/>Property intelligence, portfolio health, and financial analytics.</g, ">{t('owner.workspace.subtitle', 'Property intelligence, portfolio health, and financial analytics.')}<");
    s = s.replace(/>Healthy</g, ">{t('analytics.healthy', 'Healthy')}<");
    s = s.replace(/>Total Portfolio Value</g, ">{t('owner.stats.value', 'Total Portfolio Value')}<");
    s = s.replace(/>Active Units</g, ">{t('owner.stats.units', 'Active Units')}<");
    s = s.replace(/>Gross Revenue/g, ">{t('owner.stats.revenue', 'Gross Revenue')}<");
    s = s.replace(/>Maintenance Spend</g, ">{t('owner.stats.spend', 'Maintenance Spend')}<");
    s = s.replace(/>Portfolio Performance</g, ">{t('owner.performance', 'Portfolio Performance')}<");
    s = s.replace(/>Revenue vs Expenses/g, ">{t('owner.revenue_vs_expenses', 'Revenue vs Expenses')}<");
    s = s.replace(/>My Properties</g, ">{t('owner.my_properties', 'My Properties')}<");
    s = s.replace(/>Property</g, ">{t('core.property', 'Property')}<");
    s = s.replace(/>Status</g, ">{t('core.status', 'Status')}<");
    s = s.replace(/>Value</g, ">{t('finance.amount', 'Amount')}<"); // Use glossary translation for amount/value
    s = s.replace(/>No properties found in your portfolio.</g, ">{t('ui.no_properties', 'No properties found in your portfolio.')}<");
  }

  if (s.includes('export const TenantWorkspacePage: React.FC = () => {')) {
    if (!s.includes('const { t, direction } = useI18n();')) {
      s = s.replace('const { t } = useI18n();', 'const { t, direction } = useI18n();');
    }
    s = s.replace('<div className="p-6 max-w-5xl mx-auto">', '<div className={`p-6 max-w-5xl mx-auto ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');
  }

  if (s.includes('export const VendorWorkspacePage: React.FC = () => {')) {
    if (!s.includes('const { t, direction } = useI18n();')) {
      s = s.replace('const { t } = useI18n();', 'const { t, direction } = useI18n();');
    }
    s = s.replace('<div className="p-6 max-w-7xl mx-auto">', '<div className={`p-6 max-w-7xl mx-auto flex flex-col gap-6 ${direction === \'rtl\' ? \'font-arabic\' : \'font-sans\'}`} dir={direction}>');
  }

  fs.writeFileSync(filepath, s);
}

patchFile('src/pages/OwnerWorkspace.tsx');
patchFile('src/pages/TenantWorkspace.tsx');
patchFile('src/pages/VendorWorkspace.tsx');

console.log('Workspaces patched.');

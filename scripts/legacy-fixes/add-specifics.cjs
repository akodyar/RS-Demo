const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const specificKu = `
    'owner.workspace.subtitle': 'زیرەکی موڵک، تەندروستیی پۆرتفۆلیۆ، و شیکاریی دارایی.',
    'analytics.healthy': 'تەندروست',
    'owner.stats.value': 'کۆی بەهای پۆرتفۆلیۆ',
    'owner.stats.units': 'یەکە چالاکەکان',
    'owner.stats.revenue': 'داهاتی گشتی',
    'owner.stats.spend': 'خەرجیی چاکسازی',
    'owner.performance': 'کارایی پۆرتفۆلیۆ',
    'owner.revenue_vs_expenses': 'داهات بەرامبەر خەرجییەکان',
    'ui.no_properties': 'هیچ موڵکێک لە پۆرتفۆلیۆکەتدا نەدۆزرایەوە.',
    
    // Vendor workspace
    'vendor.workspace': 'شوێنی کاری دابینکەر',
    
    // Tenant workspace
    'tenant.workspace': 'شوێنی کاری کرێچی',
    
    // Additional status/misc
    'status.draft': 'ڕەشنووس',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + specificKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
console.log('Specifics added.');

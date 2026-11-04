const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const vendorKu = `
    // VENDOR FIXES
    'vendor.submit_quote': 'ناردنی نرخدان',
    'vendor.labor_cost': 'تێچووی کار',
    'vendor.material_cost': 'تێچووی کەرەستە',
    'vendor.fees': 'کرێی گواستنەوە/خزمەتگوزاری',
    'vendor.total': 'کۆی گشتیی نرخدان',
    'vendor.estimated_duration': 'ماوەی خەمڵێنراو',
    'vendor.duration_placeholder': 'بۆ نموونە ٢ ڕۆژ',
    'core.notes': 'تێبینییەکان',
    'vendor.notes_placeholder': 'وردەکاریی زیاتر...',
    'vendor.error.fetch': 'نەتوانرا داواکارییە دیاریکراوەکان بهێنرێت',
    'vendor.no_requests': 'لە ئێستادا هیچ داواکارییەکی چاکسازی چالاکت نییە.',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + vendorKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

const fs = require('fs');

const propKu = `
    // PROPERTY DETAILS
    'property.loading': 'لە بارکردنی وردەکارییەکانی موڵک...',
    'property.error.fetch': 'نەتوانرا زانیاری ڕاستەقینەی موڵک بهێنرێت',
    'property.not_found': 'موڵک نەدۆزرایەوە.',
    'property.unnamed': 'موڵکی بێناو',
    'property.no_address': 'ناونیشان دابین نەکراوە',
    'property.ownership.label': 'خاوەندارێتی',
    'property.ownership.verified': 'پشتڕاستکراوەتەوە (١٠٠٪ پشک)',
    'property.overview': 'پوختەی موڵک',
    'property.size': 'ڕووبەر',
    'property.sqm': 'مەتر دووجا',
    'property.unknown': 'نەزانراو',
    'property.beds_baths': 'نووستن/حەمام',
    'property.status_vacant': 'بەتاڵ',
    'property.maintenance': 'چاکسازی',
    'property.tasks': 'ئەرکەکان',
    'property.no_maintenance': 'هیچ داواکارییەکی چاکسازی چالاک نییە.',
    'property.documents': 'بەڵگەنامەکان',
    'document.title_deed': 'تاپۆ (پشتڕاستکراوەتەوە)',
    'document.floor_plan': 'نەخشەی نهۆم',
    'document.previous_lease': 'گرێبەستی پێشوو (بەسەرچووە)',
    'property.timeline': 'هێڵی کات',
    'timeline.acquired': 'موڵک بەدەستهێنرا',
    'timeline.verified': 'خاوەندارێتی پشتڕاستکرایەوە',
    
    // WORKSPACE ERROR STATES
    'ui.loading_details': 'وردەکارییەکان باردەکرێن...',
    'ui.error_loading': 'هەڵە لە بارکردندا: ',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// Insert after 'ku: {'
s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + propKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
console.log("Updated I18nProvider.tsx");

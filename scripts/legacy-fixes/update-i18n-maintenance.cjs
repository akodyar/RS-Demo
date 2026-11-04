const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const maintKu = `
    // MAINTENANCE WORKSPACE
    'maintenance.control_center': 'ناوەندی کۆنترۆڵی چاکسازی',
    'maintenance.subtitle': 'بەڕێوەبردنی فەرمانەکانی کار، پۆلێنکردنی داواکارییەکان و پێداچوونەوەی نرخدانەکان',
    'maintenance.queue_empty': 'ریزەکە بەتاڵە',
    'maintenance.no_requests': 'لە ئێستادا هیچ داواکارییەکی چاکسازی چالاک نییە.',
    'maintenance.error.approve': 'نەتوانرا نرخدانەکە پەسەند بکرێت',
    'maintenance.error.fetch': 'نەتوانرا ریزەکە بهێنرێت',
    
    'maintenance.triage': 'پۆلێنکردن / دیاریکردن',
    'maintenance.cancel_request': 'هەڵوەشاندنەوەی داواکاری',
    'maintenance.review_quote': 'پێداچوونەوەی نرخدان',
    'maintenance.view_work_order': 'بینینی فەرمانی کار',
    'maintenance.details_actions': 'وردەکارییەکان و کردارەکان',
    'maintenance.pending_quotes': 'نرخدانە چاوەڕوانکراوەکان',
    'vendor.id': 'ناسنامەی دابینکەر:',
    'maintenance.approve_wo': 'پەسەندکردن و دروستکردنی فەرمانی کار',
    'maintenance.active_wos': 'فەرمانەکانی کاری چالاک',
    'maintenance.wo': 'فەرمانی کار:',
    'maintenance.assigned_vendor': 'دابینکەری دیاریکراو:',
    'maintenance.manage_schedule': 'بەڕێوەبردنی خشتەی کات',

    // STATUS
    'status.new_request': 'داواکاریی نوێ',
    'status.triaged': 'پۆلێنکراوە',
    'status.quote_ready': 'نرخدان ئامادەیە',
    'status.work_order': 'فەرمانی کار',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + maintKu);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);

const fs = require('fs');

const canonicalKu = `
    // CORE
    'core.real_estate': 'موڵک و خانووبەرە',
    'core.platform': 'پلاتفۆرمی موڵک و خانووبەرە',
    'core.ecosystem': 'ژینگەی موڵک و خانووبەرە',
    'core.property': 'موڵک',
    'core.properties': 'موڵکەکان',
    'core.dashboard': 'داشبۆرد',
    'core.workspace': 'شوێنی کار',
    'core.overview': 'پوختە',
    'core.details': 'وردەکارییەکان',
    'core.status': 'دۆخ',
    'core.search': 'گەڕان',
    'core.filter': 'فلتەر',
    'core.actions': 'کردارەکان',
    'core.more': 'زیاتر',
    
    // ACTIONS
    'action.back': 'گەڕانەوە',
    'action.next': 'داهاتوو',
    'action.continue': 'بەردەوام بە',
    'action.cancel': 'هەڵوەشاندنەوە',
    'action.close': 'داخستن',
    'action.save': 'پاشەکەوتکردن',
    'action.edit': 'دەستکاریکردن',
    'action.delete': 'سڕینەوە',
    'action.create': 'دروستکردن',
    'action.add': 'زیادکردن',
    'action.submit': 'ناردن',
    'action.confirm': 'پشتڕاستکردنەوە',
    'action.approve': 'پەسەندکردن',
    'action.reject': 'ڕەتکردنەوە',
    'action.view_details': 'وردەکارییەکان ببینە',
    'action.download': 'داگرتن',
    'action.upload': 'بارکردن',

    // AUTH & VERIFICATION
    'auth.signin': 'چوونەژوورەوە',
    'auth.signup': 'تۆماربوون',
    'auth.create_account': 'دروستکردنی هەژمار',
    'auth.email': 'ئیمەیڵ',
    'auth.phone': 'ژمارەی تەلەفۆن',
    'auth.password': 'وشەی نهێنی',
    'auth.forgot_password': 'وشەی نهێنیت لەبیر کردووە؟',
    'auth.logout': 'چوونەدەرەوە',
    'auth.verification': 'پشتڕاستکردنەوە',
    'auth.verified': 'پشتڕاستکراوەتەوە',
    'auth.unauthorized': 'دەسەڵاتی پێویست نییە',
    'auth.access_denied': 'دەستگەیشتن ڕەتکرایەوە',

    // ROLES
    'role.admin': 'بەڕێوەبەری پلاتفۆرم',
    'role.owner': 'خاوەنی موڵک',
    'role.company': 'کۆمپانیای بەڕێوەبردن',
    'role.manager': 'بەڕێوەبەری موڵک',
    'role.tenant': 'کرێچی',
    'role.buyer': 'کڕیار',
    'role.agent': 'نوێنەری موڵک و خانووبەرە',
    'role.vendor': 'دابینکەری خزمەتگوزاری',
    'role.accountant': 'ژمێریار',

    // COMPANY
    'company.management': 'بەڕێوەبردنی کۆمپانیا',
    'company.workspace': 'شوێنی کاری کۆمپانیا',
    'company.profile': 'پرۆفایلی کۆمپانیا',
    'company.team': 'تیم',
    'company.team_members': 'ئەندامانی تیم',
    'company.invite': 'بانگهێشتکردنی ئەندامی تیم',
    'company.agreements': 'ڕێککەوتنەکانی بەڕێوەبردن',
    'company.assigned_properties': 'موڵکە دیاریکراوەکان',

    // PROPERTY
    'property.type': 'جۆری موڵک',
    'property.name': 'ناوی موڵک',
    'property.address': 'ناونیشانی موڵک',
    'property.location': 'شوێن',
    'property.unit': 'یەکە',
    'property.units': 'یەکەکان',
    'property.apartment': 'شوقە',
    'property.villa': 'ڤیلا',
    'property.house': 'خانوو',
    'property.commercial': 'موڵکی بازرگانی',
    'property.portfolio': 'پۆرتفۆلیۆی موڵکەکان',
    'property.passport': 'پاسپۆرتی موڵک',

    // STATUS
    'status.draft': 'ڕەشنووس',
    'status.pending': 'چاوەڕوانە',
    'status.pending_approval': 'چاوەڕوانی پەسەندکردنە',
    'status.pending_verification': 'چاوەڕوانی پشتڕاستکردنەوە',
    'status.active': 'چالاکە',
    'status.inactive': 'ناچالاکە',
    'status.approved': 'پەسەندکراوە',
    'status.rejected': 'ڕەتکراوەتەوە',
    'status.cancelled': 'هەڵوەشێنراوەتەوە',
    'status.expired': 'بەسەرچووە',
    'status.suspended': 'ڕاگیراوە',
    'status.completed': 'تەواوکراوە',
    'status.in_progress': 'لە جێبەجێکردندایە',
    'status.failed': 'سەرکەوتوو نەبووە',
    'status.unavailable': 'بەردەست نییە',

    // TENANT & LEASE
    'tenant.profile': 'پرۆفایلی کرێچی',
    'tenant.my_home': 'ماڵەکەم',
    'tenant.my_lease': 'گرێبەستەکەم',
    'tenant.application': 'داواکاریی کرێچی',
    'lease.agreement': 'ڕێککەوتنی گرێبەستی کرێ',
    'lease.term': 'ماوەی گرێبەست',
    'lease.rent_amount': 'بڕی کرێ',
    'lease.due_date': 'بەرواری پێویستی پارەدانی کرێ',
    'lease.renewal': 'نوێکردنەوەی گرێبەست',

    // FINANCE & RENT
    'finance.rent': 'کرێ',
    'finance.payment': 'پارەدان',
    'finance.payments': 'پارەدانەکان',
    'finance.receipt': 'پسوڵە',
    'finance.deposit': 'دڵنیایی',
    'finance.refund': 'گەڕاندنەوەی پارە',
    'finance.revenue': 'داهات',
    'finance.expense': 'خەرجی',
    'finance.amount': 'بڕ',
    'finance.total': 'کۆی گشتیی بڕ',

    // MAINTENANCE & VENDOR
    'maintenance.title': 'چاکسازی',
    'maintenance.request': 'داواکاریی چاکسازی',
    'maintenance.issue': 'کێشە',
    'maintenance.priority': 'گرنگی',
    'maintenance.emergency': 'فریاکەوتن',
    'work_order.title': 'فەرمانی کار',
    'vendor.profile': 'پرۆفایلی دابینکەر',
    'vendor.quote': 'نرخدان',

    // UI STATES
    'ui.loading': 'لە بارکردندایە...',
    'ui.empty': 'بەتاڵە',
    'ui.no_data': 'هیچ زانیارییەک نییە',
    'ui.no_results': 'هیچ ئەنجامێک نەدۆزرایەوە',
    'ui.error': 'هەڵە',
    'ui.success': 'سەرکەوتوو بوو',
    'ui.try_again': 'دووبارە هەوڵ بدە',
    
    // TIME
    'time.today': 'ئەمڕۆ',
    'time.yesterday': 'دوێنێ',
    'time.tomorrow': 'سبەی',
    'time.date': 'بەروار',
`;

let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// Insert carefully to avoid breaking the object
s = s.replace("ku: {\n    // Kurdish Sorani translation (RTL)", "ku: {\n    // Canonical Glossary Inject\n" + canonicalKu + "\n    // Kurdish Sorani translation (RTL)");

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
console.log("Glossary injected into I18nProvider.tsx");

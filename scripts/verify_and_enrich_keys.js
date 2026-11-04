import fs from 'fs';

const file = 'src/i18n/I18nProvider.tsx';
let code = fs.readFileSync(file, 'utf8');

// Key UI bindings that need to be clean across all 3 languages
const commonEntries = {
  en: {
    'download.flutter': 'Download Flutter (ZIP)',
    'mobile.flow': 'Mobile Flow',
    'mobile.experience': 'Mobile Experience',
    'mobile.screens_count': '9 Screens',
    'role.platform_admin': 'Platform Admin',
    'nav.marketplace': 'Marketplace',
    'portfolio.title': 'Portfolio Analytics',
    'portfolio.subtitle': 'Asset performance and investment overview',
    'portfolio.total_asset_value': 'Total Asset Value',
    'portfolio.annual_yield': 'Annual Yield',
    'portfolio.active_units': 'Active Units',
    'portfolio.vacancy_rate': 'Vacancy Rate',
    'portfolio.foundation_msg': 'Analytics Dashboard rendering foundation',
    'action.sign_out': 'Sign Out',
    'maintenance.title': 'Maintenance',
    'integration.title': 'Integrations & Providers',
    'autopilot.title': 'Real Estate Autopilot',
    'admin.title': 'Platform Admin Control Center',
    'admin.subtitle': 'Official property oversight, title deed verification, and agency management',
    'admin.superadmin': 'SuperAdmin Access',
    'admin.active_properties': 'Active Properties',
    'admin.verified_agencies': 'Verified Agencies',
    'admin.pending_tapu': 'Pending Title Deed Verification',
    'admin.transaction_volume': 'Transaction Volume (GMV)',
    'admin.tab.moderation': 'Property & Title Deed Approvals',
    'admin.tab.agencies': 'Agencies & Companies',
    'admin.tab.audit': 'Security Audit Log',
    'admin.search_placeholder': 'Search by property name, owner, or title deed number...',
    'admin.filter_city': 'Filter City:',
    'admin.all_cities': 'All Cities',
    'admin.escrow_note': 'Secured via Escrow & Banking',
    'admin.requires_review': 'Requires Review',
    'admin.this_month': 'this month',
    'admin.portal_title': 'Admin Management Portal',
    'admin.login_title': 'Admin Sign In',
    'admin.login_subtitle': 'Access the platform control center, property oversight, and user management',
    'admin.official_email': 'Admin Email',
    'admin.password': 'Password',
    'admin.2fa_code': 'Staff 2FA Security PIN',
    'admin.demo_pin': 'Demo PIN: 8899',
    'admin.sign_in_btn': 'Sign in as Admin',
    'admin.checking_perms': 'Verifying permissions...',
    'admin.one_click_title': 'One-Click Instant Login (For Testing & Evaluation)',
    'admin.one_click_btn': 'Instant Sign In as SuperAdmin',
    'admin.security_guarantee': 'Secured via 256-bit TLS & Official RBAC Governance'
  },
  ar: {
    'download.flutter': 'تحميل مشروع Flutter (ZIP)',
    'mobile.flow': 'تجربة الهاتف المحمول',
    'mobile.experience': 'تجربة الهاتف المحمول',
    'mobile.screens_count': '٩ شاشات',
    'role.platform_admin': 'مدير المنصة',
    'nav.marketplace': 'السوق',
    'portfolio.title': 'تحليلات المحفظة',
    'portfolio.subtitle': 'أداء الأصول ونظرة عامة على الاستثمار',
    'portfolio.total_asset_value': 'إجمالي قيمة الأصول',
    'portfolio.annual_yield': 'العائد السنوي',
    'portfolio.active_units': 'الوحدات النشطة',
    'portfolio.vacancy_rate': 'معدل الشغور',
    'portfolio.foundation_msg': 'مركز التحليلات وإدارة المحفظة',
    'action.sign_out': 'تسجيل الخروج',
    'maintenance.title': 'الصيانة',
    'integration.title': 'التكاملات ومقدمو الخدمات',
    'autopilot.title': 'الطيار الآلي للعقارات',
    'admin.title': 'مركز تحكم إدارة المنصة',
    'admin.subtitle': 'الرقابة الرسمية على العقارات، والتحقق من سندات الملكية (الطابو)، وإدارة المكاتب العقارية',
    'admin.superadmin': 'صلاحية كاملة (SuperAdmin)',
    'admin.active_properties': 'العقارات النشطة',
    'admin.verified_agencies': 'المكاتب العقارية المعتمدة',
    'admin.pending_tapu': 'في انتظار فحص الطابو',
    'admin.transaction_volume': 'حجم المعاملات (GMV)',
    'admin.tab.moderation': 'قائمة اعتماد العقارات والطابو',
    'admin.tab.agencies': 'المكاتب والشركات العقارية',
    'admin.tab.audit': 'سجل العمليات الأمنية (Audit Log)',
    'admin.search_placeholder': 'البحث باسم العقار، المالك، أو رقم الطابو...',
    'admin.filter_city': 'تصفية حسب المدينة:',
    'admin.all_cities': 'جميع المدن',
    'admin.escrow_note': 'مضمونة عبر حساب الضمان المصرفي (Escrow)',
    'admin.requires_review': 'يتطلب المراجعة',
    'admin.this_month': 'هذا الشهر',
    'admin.portal_title': 'بوابة إدارة المنصة (Admin Portal)',
    'admin.login_title': 'تسجيل دخول المشرف',
    'admin.login_subtitle': 'للوصول إلى مركز تحكم المنصة والرقابة على العقارات والمستخدمين',
    'admin.official_email': 'البريد الإلكتروني الرسمي للمشرف',
    'admin.password': 'كلمة المرور',
    'admin.2fa_code': 'رمز الأمان الثنائي (2FA PIN)',
    'admin.demo_pin': 'رمز التجربة: 8899',
    'admin.sign_in_btn': 'الدخول كمسؤول',
    'admin.checking_perms': 'التحقق من الصلاحيات...',
    'admin.one_click_title': 'تسجيل دخول بنقرة واحدة (للاختبار والتقييم)',
    'admin.one_click_btn': 'تسجيل الدخول الفوري بحساب SuperAdmin',
    'admin.security_guarantee': 'اتصال آمن بتشفير 256-bit TLS وصلاحيات RBAC الرسمية'
  },
  ku: {
    'download.flutter': 'داگرتنی پڕۆژەی Flutter (ZIP)',
    'mobile.flow': 'ئەزموونی مۆبایل (Flow)',
    'mobile.experience': 'ئەزموونی مۆبایل',
    'mobile.screens_count': '٩ شاشە',
    'role.platform_admin': 'بەڕێوەبەری پلاتفۆرم',
    'nav.marketplace': 'بازاڕ',
    'portfolio.title': 'شیکاریی پۆرتفۆلیۆ',
    'portfolio.subtitle': 'ئەدای سامان و پوختەی وەبەرهێنان',
    'portfolio.total_asset_value': 'کۆی گشتی بەهای سامان',
    'portfolio.annual_yield': 'داهاتی ساڵانە',
    'portfolio.active_units': 'یەکە چالاکەکان',
    'portfolio.vacancy_rate': 'ڕێژەی بەتاڵی',
    'portfolio.foundation_msg': 'ناوەندی شیکاری و بەڕێوەبردنی پۆرتفۆلیۆ',
    'action.sign_out': 'دەرچوون',
    'maintenance.title': 'چاکسازی',
    'integration.title': 'بەستەرەکان و دابینکەران',
    'autopilot.title': 'خۆفڕی ژیری دەستکردی موڵک',
    'admin.title': 'کۆنترۆڵ سێنتەری بەڕێوەبەرایەتی پلاتفۆڕم',
    'admin.subtitle': 'چاودێری فەرمی موڵکەکان، پشکنینی تاپۆی نیشتەجێبوون، و نووسینگەکانی هەرێمی کوردستان',
    'admin.superadmin': 'دەسەڵاتی تەواو (SuperAdmin)',
    'admin.active_properties': 'موڵکە چالاکەکان',
    'admin.verified_agencies': 'نووسینگەی باوەڕپێکراو',
    'admin.pending_tapu': 'وەستان بۆ پشکنینی تاپۆ',
    'admin.transaction_volume': 'قەبارەی مامەڵەکان (GMV)',
    'admin.tab.moderation': 'لیستی پەسەندکردنی موڵک و تاپۆ',
    'admin.tab.agencies': 'نووسینگە و کۆمپانیاکان',
    'admin.tab.audit': 'تۆماری کردارە ئەمنییەکان (Audit Log)',
    'admin.search_placeholder': 'گەڕان بەپێی ناوی موڵک، خاوەن، یان ژمارەی تاپۆ...',
    'admin.filter_city': 'فلتەری شار:',
    'admin.all_cities': 'هەموو شارەکان',
    'admin.escrow_note': 'بە سیستەمی Escrow و بانک',
    'admin.requires_review': 'پێویستی بە چاوپێخشاندنە',
    'admin.this_month': 'ئەم مانگە',
    'admin.portal_title': 'دەروازەی بەڕێوەبەرایەتی سیستەم (Admin Portal)',
    'admin.login_title': 'چوونەژوورەوەی ئەدمین',
    'admin.login_subtitle': 'بۆ دەستگەیشتن بە کۆنترۆڵ سێنتەری پلاتفۆڕم و چاودێری موڵک و بەکارهێنەران',
    'admin.official_email': 'ئیمەیڵی فەرمی ستاف (Admin Email)',
    'admin.password': 'وشەی نهێنی (Password)',
    'admin.2fa_code': 'کۆدی ئەمنیی ستاف (2FA PIN)',
    'admin.demo_pin': 'پیشاندەری پشکنین: 8899',
    'admin.sign_in_btn': 'چوونەژوورەوە وەک ئەدمین',
    'admin.checking_perms': 'پشکنینی دەسەڵاتەکان...',
    'admin.one_click_title': 'چوونەژوورەوەی یەک-کلیک (بۆ تاقیکردنەوە و پشکنین)',
    'admin.one_click_btn': 'چوونەژوورەوەی دەستبەجێ بە هەژماری SuperAdmin',
    'admin.security_guarantee': 'پەیوەندی پارێزراو بە 256-bit TLS و مۆڵەتی فەرمی RBAC'
  }
};

for (const lang of ['en', 'ar', 'ku']) {
  const startMarker = `  ${lang}: {`;
  const nextMarker = lang === 'en' ? '  ar: {' : lang === 'ar' ? '  ku: {' : '\nexport const I18nProvider:';
  
  const startIndex = code.indexOf(startMarker);
  const nextIndex = code.indexOf(nextMarker);
  
  if (startIndex === -1 || nextIndex === -1) {
    console.error(`Could not locate block for ${lang}`);
    continue;
  }
  
  let block = code.substring(startIndex, nextIndex);
  for (const [k, v] of Object.entries(commonEntries[lang])) {
    const searchKey = `'${k}':`;
    if (!block.includes(searchKey)) {
      // Add key at the start of block
      const insertPoint = block.indexOf('\n') + 1;
      const escaped = v.replace(/'/g, "\\'");
      block = block.slice(0, insertPoint) + `    '${k}': '${escaped}',\n` + block.slice(insertPoint);
    }
  }
  
  code = code.substring(0, startIndex) + block + code.substring(nextIndex);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully enriched I18nProvider keys.');

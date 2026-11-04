import fs from 'node:fs';
import path from 'node:path';

// Complete dictionary of all 390 keys needing completion or synchronization
export const newTranslations: {
  key: string;
  en: string;
  ar: string;
  ku: string;
}[] = [
  // ================== AGENT ==================
  {
    key: 'agent.market_insights',
    en: 'Market Insights',
    ar: 'رؤى وتحليلات السوق',
    ku: 'شیکاریی بازاڕ'
  },

  // ================== ACTION ==================
  {
    key: 'action.add',
    en: 'Add',
    ar: 'إضافة',
    ku: 'زیادکردن'
  },
  {
    key: 'action.confirm',
    en: 'Confirm',
    ar: 'تأكيد',
    ku: 'پشتڕاستکردنەوە'
  },
  {
    key: 'action.view',
    en: 'View Property',
    ar: 'عرض العقار',
    ku: 'بینینی موڵک'
  },

  // ================== ADMIN ==================
  {
    key: 'admin.email_required',
    en: 'Please enter official admin email',
    ar: 'يرجى إدخال البريد الإلكتروني الرسمي للمشرف',
    ku: 'تکایە ئیمەیڵی فەرمی بەڕێوەبەر داخڵ بکە'
  },

  // ================== ANALYTICS ==================
  {
    key: 'analytics.active_units',
    en: 'Active Units',
    ar: 'الوحدات النشطة',
    ku: 'یەکە چالاکەکان'
  },
  {
    key: 'analytics.ai_disclaimer',
    en: 'AI recommendations do not execute actions autonomously.',
    ar: 'التوصيات الذكية لا تنفذ الإجراءات بشكل مستقل.',
    ku: 'تێڕوانینەکانی ژیری دەستکرد کرداری خۆکار ئەنجام نادەن بەبێ پەسەندکردنی تۆ.'
  },
  {
    key: 'analytics.annual_yield',
    en: 'Annual Yield',
    ar: 'العائد السنوي',
    ku: 'داهاتی ساڵانە'
  },
  {
    key: 'analytics.overview',
    en: 'Portfolio Overview',
    ar: 'نظرة عامة على المحفظة',
    ku: 'پوختەی پۆرتفۆلیۆ'
  },
  {
    key: 'analytics.overview_desc',
    en: 'Asset Performance & Investment Summary',
    ar: 'أداء الأصول وملخص الاستثمار',
    ku: 'ئەدای سامانەکان و پوختەی وەبەرهێنان'
  },
  {
    key: 'analytics.require_attention',
    en: 'Requires Attention',
    ar: 'تحتاج انتباه',
    ku: 'پێویستی بە سەرنجە'
  },
  {
    key: 'analytics.revenue_vs_expenses',
    en: 'Revenue vs Expenses (YTD)',
    ar: 'الإيرادات مقابل المصاريف (من بداية السنة)',
    ku: 'داهات بەرامبەر خەرجییەکان (لەسەرەتای ساڵەوە)'
  },
  {
    key: 'analytics.total_value',
    en: 'Total Value',
    ar: 'إجمالي القيمة',
    ku: 'کۆی بەها'
  },
  {
    key: 'analytics.trailing_12m',
    en: 'Trailing 12 Months',
    ar: 'آخر 12 شهراً',
    ku: '١٢ مانگی ڕابردوو'
  },
  {
    key: 'analytics.units_leased',
    en: 'Units Leased',
    ar: 'وحدات مؤجرة',
    ku: 'یەکە بەکرێدراوەکان'
  },
  {
    key: 'analytics.vacancy_rate',
    en: 'Vacancy Rate',
    ar: 'معدل الشغور',
    ku: 'ڕێژەی بەتاڵی'
  },
  {
    key: 'analytics.yoy',
    en: '↑ YoY',
    ar: '↑ سنوياً',
    ku: '↑ بەراورد بە ساڵی ڕابردوو'
  },
  {
    key: 'analytics.db_not_configured_title',
    en: 'Authoritative Database Not Configured (503)',
    ar: 'قاعدة البيانات الرسمية غير مهيأة (503)',
    ku: 'داتابەیسی فەرمی دانەمەزراوە (503)'
  },
  {
    key: 'analytics.db_not_configured_desc',
    en: 'The PostgreSQL authoritative datastore is currently disconnected. AI Autopilot strictly enforces fail-closed operations. Mock data generation is prohibited.',
    ar: 'مستودع بيانات PostgreSQL غير متصل حالياً. يطبق نظام الطيار الآلي حماية الإغلاق الآمن، ويُحظر توليد البيانات الوهمية.',
    ku: 'داتابەیسی سەرەکی PostgreSQL لە ئێستادا پەیوەست نییە. ژیری دەستکرد سیستەمی داخستنی پارێزراو بەکاردەهێنێت. دروستکردنی داتای ساختە قەدەغەیە.'
  },
  {
    key: 'analytics.forbidden',
    en: 'Forbidden: Your role does not have permission to view portfolio analytics.',
    ar: 'محظور: ليس لدى دورك إذن لعرض تحليلات المحفظة.',
    ku: 'قەدەغەیە: ڕۆڵەکەت دەسەڵاتی بینینی شیکاری پۆرتفۆلیۆی نییە.'
  },
  {
    key: 'analytics.load_error',
    en: 'Failed to load portfolio analytics data.',
    ar: 'فشل تحميل بيانات تحليلات المحفظة.',
    ku: 'هەڵە لە بارکردنی داتای شیکاری پۆرتفۆلیۆ.'
  },
  {
    key: 'analytics.export_notice',
    en: 'Portfolio report successfully generated.',
    ar: 'تم إنشاء تقرير المحفظة بنجاح.',
    ku: 'ڕاپۆرتی پۆرتفۆلیۆ بە سەرکەوتوویی ئامادەکرا.'
  },

  // ================== AUTH ==================
  {
    key: 'auth.login',
    en: 'Sign In',
    ar: 'تسجيل الدخول',
    ku: 'چوونەژوورەوە'
  },
  {
    key: 'auth.register',
    en: 'Create Account',
    ar: 'تسجيل حساب جديد',
    ku: 'دروستکردنی هەژمار'
  },
  {
    key: 'auth.sign_out',
    en: 'Sign Out',
    ar: 'تسجيل الخروج',
    ku: 'چوونەدەرەوە'
  },

  // ================== COMMON ==================
  {
    key: 'common.search',
    en: 'Search...',
    ar: 'بحث...',
    ku: 'گەڕان...'
  },
  {
    key: 'common.reject',
    en: 'Reject',
    ar: 'رفض',
    ku: 'ڕەتکردنەوە'
  },
  {
    key: 'common.close',
    en: 'Close',
    ar: 'إغلاق',
    ku: 'داخستن'
  },
  {
    key: 'common.language',
    en: 'Language',
    ar: 'اللغة',
    ku: 'زمان'
  },
  {
    key: 'common.refresh',
    en: 'Refresh',
    ar: 'تحديث',
    ku: 'نوێکردنەوە'
  },
  {
    key: 'common.date',
    en: 'Date / Timestamp',
    ar: 'التاريخ / الطابع الزمني',
    ku: 'بەروار / کات'
  },
  {
    key: 'common.status',
    en: 'Status',
    ar: 'الحالة',
    ku: 'دۆخ'
  },
  {
    key: 'common.fee',
    en: 'Fee',
    ar: 'الرسوم',
    ku: 'تێچوو / عمولە'
  },
  {
    key: 'common.net',
    en: 'Net',
    ar: 'الصافي',
    ku: 'پوختە'
  },
  {
    key: 'common.error',
    en: 'An error occurred',
    ar: 'حدث خطأ',
    ku: 'هەڵەیەک ڕوویدا'
  },

  // ================== COMPANY ==================
  {
    key: 'company.management',
    en: 'Company Management',
    ar: 'إدارة الشركة',
    ku: 'بەڕێوەبردنی کۆمپانیا'
  },
  {
    key: 'company.unnamed_company',
    en: 'HomeHub Real Estate Agency',
    ar: 'وكالة هومهاب العقارية',
    ku: 'ئاژانسی هۆمهەب بۆ خانووبەرە'
  },
  {
    key: 'company.no_recent_activity',
    en: 'No recent activity recorded',
    ar: 'لا يوجد نشاط مسجل مؤخراً',
    ku: 'هیچ چالاکییەکی نوێ تۆمار نەکراوە'
  },
  {
    key: 'company.activity_will_appear',
    en: 'Operational events, lease updates, and ledger transactions will appear here.',
    ar: 'ستظهر هنا الأحداث التشغيلية وتحديثات عقود الإيجار ومعاملات دفتر الأستاذ.',
    ku: 'ڕووداوە کارپێکردنەکان، نوێکارییەکانی گرێبەست، و مامەڵە داراییەکان لێرە دەردەکەون.'
  },
  {
    key: 'company.notifications',
    en: 'Notifications',
    ar: 'الإشعارات',
    ku: 'ئاگادارکردنەوەکان'
  },
  {
    key: 'company.welcome_back_generic',
    en: 'Welcome back!',
    ar: 'مرحباً بعودتك!',
    ku: 'بەخێربێیتەوە!'
  },
  {
    key: 'company.financial_overview',
    en: 'Portfolio Financial Overview',
    ar: 'الملخص المالي للمحفظة',
    ku: 'کورتەی دارایی پۆرتفۆلیۆ'
  },
  {
    key: 'company.ledger_balanced',
    en: 'Double-Entry Balanced',
    ar: 'دفتر أستاذ متوازن القيد المزدوج',
    ku: 'دەفتەری دارایی هاوسەنگ'
  },
  {
    key: 'company.ledger_source_desc',
    en: 'Data officially retrieved from PostgreSQL double-entry financial ledger based on confirmed transactions.',
    ar: 'تم استرداد البيانات رسمياً من دفتر الأستاذ المزدوج في PostgreSQL استناداً إلى المعاملات المؤكدة.',
    ku: 'داتاکان بە شێوەیەکی فەرمی لە دەفتەری دارایی دوولایەنەی PostgreSQL وەرگیراون بەپێی تۆمارە پشتڕاستکراوەکان.'
  },
  {
    key: 'company.collected_rent',
    en: 'Total Collected Rent',
    ar: 'إجمالي الإيجار المحصل',
    ku: 'کۆی کرێی کۆکراوە'
  },
  {
    key: 'company.confirmed_status',
    en: 'Confirmed',
    ar: 'مؤكد',
    ku: 'پشتڕاستکراوە'
  },
  {
    key: 'company.pending_rent',
    en: 'Pending Rent',
    ar: 'إيجار معلق',
    ku: 'کرێی لە چاوەڕوانیدا'
  },
  {
    key: 'company.awaiting_collection',
    en: 'Awaiting Collection',
    ar: 'بانتظار التحصيل',
    ku: 'لە چاوەڕوانی وەرگرتندا'
  },
  {
    key: 'company.platform_fee',
    en: 'HomeHub Platform Fee',
    ar: 'رسوم منصة هومهاب',
    ku: 'تێچووی پلاتفۆرمی هۆمهەب'
  },
  {
    key: 'company.canonical_policy',
    en: 'Only on collected rent',
    ar: 'فقط على الإيجار المحصل',
    ku: 'تەنها لەسەر کرێی کۆکراوە'
  },
  {
    key: 'company.commission_earned',
    en: 'Company Management Fee',
    ar: 'رسوم إدارة الشركة',
    ku: 'تێچووی بەڕێوەبردنی کۆمپانیا'
  },
  {
    key: 'company.per_agreement',
    en: 'Per management agreement',
    ar: 'وفقاً لاتفاقية الإدارة',
    ku: 'بەپێی ڕێککەوتننامەی بەڕێوەبردن'
  },
  {
    key: 'company.expenses_approved',
    en: 'Approved Maintenance Expenses',
    ar: 'مصاريف الصيانة المعتمدة',
    ku: 'خەرجی پەسەندکراوی چاککردنەوە'
  },
  {
    key: 'company.paid_to_contractors',
    en: 'Paid to contractors / vendors',
    ar: 'المدفوعة للمقاولين والفنيين',
    ku: 'تەرخانکراو بۆ وەستاکان'
  },
  {
    key: 'company.owner_payable',
    en: 'Net Owner Settlement Payable',
    ar: 'صافي مستحقات المالك المتبقية',
    ku: 'شایستەی ماوەی خاوەن موڵک'
  },
  {
    key: 'company.post_commission_balance',
    en: 'After deducting fees & approved expenses',
    ar: 'بعد خصم الرسوم والمصاريف المعتمدة',
    ku: 'پاش لێدەرکردنی تێچوو و خەرجی پەسەندکراو'
  },
  {
    key: 'company.settlement_policy_title',
    en: 'Financial Settlement Invariants:',
    ar: 'قواعد التسوية المالية الرسمية:',
    ku: 'ڕێسای فەرمی یەکلاکردنەوەی دارایی:'
  },
  {
    key: 'company.settlement_rule_1',
    en: 'Platform and management fees are strictly deducted from confirmed collected rent only (0% fee on unpaid rent or maintenance expenses).',
    ar: 'تُخصم رسوم المنصة والإدارة حصرياً من الإيجار المحصل والمؤكد فقط (0% رسوم على الإيجار غير المحصل أو مصاريف الصيانة).',
    ku: 'تێچووی پلاتفۆرم و بەڕێوەبردن تەنها لە کرێی پشتڕاستکراوە کە بە تەواوی وەرگیراوە دەبڕدرێت (0٪ لەسەر کرێی وەرنەگیراو یان خەرجی چاککردنەوە).'
  },
  {
    key: 'company.settlement_rule_2',
    en: 'No additional surcharge is ever passed to the tenant.',
    ar: 'لا يتم فرض أي رسوم إضافية على المستأجر إطلاقاً.',
    ku: 'هیچ بارگرانییەکی زیادە (Surcharge) ناخرێتە سەر کرێچی.'
  },
  {
    key: 'company.settlement_rule_3',
    en: 'Final payout to property owners is bound to verified banking transfer confirmation.',
    ar: 'صرف المستحقات النهائية للمالكين مرتبط بتأكيد التحويل المصرفي الموثق.',
    ku: 'پارەپێدانی کۆتایی بە خاوەن موڵک دەستبەجێ بەستراوەتەوە بە پشتڕاستکردنەوەی ڕەسەنی بانکی.'
  },
  {
    key: 'company.invite_member_btn',
    en: 'Invite Team Member',
    ar: 'دعوة عضو في الفريق',
    ku: 'بانگهێشتکردنی ئەندام'
  },
  {
    key: 'company.loading_members',
    en: 'Loading team members...',
    ar: 'جاري تحميل أعضاء الفريق...',
    ku: 'بارکردنی ئەندامانی تیم...'
  },
  {
    key: 'company.suspend',
    en: 'Suspend',
    ar: 'تعليق الحساب',
    ku: 'ڕاگرتن'
  },
  {
    key: 'company.activate',
    en: 'Activate',
    ar: 'تفعيل الحساب',
    ku: 'چالاککردن'
  },
  {
    key: 'company.no_extra_members',
    en: 'No additional team members invited yet. Use the button above to invite colleagues.',
    ar: 'لم يتم دعوة أي أعضاء إضافيين حتى الآن. يمكنك دعوة أعضاء الفريق عبر الزر أعلاه.',
    ku: 'هیچ ئەندامێکی تر هێشتا بانگهێشت نەکراوە. دەتوانیت لە ڕێگەی دوگمەی سەرەوە ئەندامانی تیم بانگهێشت بکەیت.'
  },
  {
    key: 'company.authoritative_reports',
    en: 'Authoritative Reports',
    ar: 'التقارير المعتمدة',
    ku: 'ڕاپۆرتە بەڵگەدارەکان'
  },
  {
    key: 'company.historical_notice',
    en: 'System rule: metrics are strictly calculated from confirmed portfolio records. "N/A" indicates unconfigured data.',
    ar: 'وفقاً لقواعد النظام: تُحسب المقاييس حصرياً من سجلات المحفظة المؤكدة، وتظهر "N/A" عند عدم توفر البيانات.',
    ku: 'بەپێی یاسای سیستەم: داتاکان تەنها لە تۆماری پشتڕاستکراوی پۆرتفۆلیۆ هەژمار دەکرێن، و لە کاتی نەبوونی داتا "N/A" نیشان دەدرێت.'
  },
  {
    key: 'company.occupancy_rate',
    en: 'Occupancy Rate',
    ar: 'معدل الإشغال',
    ku: 'ڕێژەی پڕبوون'
  },
  {
    key: 'company.occupancy_calc_desc',
    en: 'Active tenants versus managed units',
    ar: 'المستأجرون النشطون مقابل الوحدات المدارة',
    ku: 'کرێچی چالاک بەرامبەر موڵکە بەڕێوەبراوەکان'
  },
  {
    key: 'company.collection_rate',
    en: 'Collection Rate',
    ar: 'معدل التحصيل',
    ku: 'ڕێژەی کۆکردنەوەی کرێ'
  },
  {
    key: 'company.collection_calc_desc',
    en: 'Collected rent versus total expected rent',
    ar: 'الإيجار المحصل مقابل إجمالي المتوقع',
    ku: 'کرێی کۆکراوە بەرامبەر کۆی چاوەڕوانکراو'
  },
  {
    key: 'company.from_confirmed_ledger',
    en: 'From confirmed ledger',
    ar: 'من دفتر الأستاذ المؤكد',
    ku: 'لە دەفتەری پشتڕاستکراوە'
  },
  {
    key: 'company.maintenance_load',
    en: 'Maintenance Load',
    ar: 'عبء الصيانة',
    ku: 'بارگرانی چاککردنەوە'
  },
  {
    key: 'company.maintenance_load_desc',
    en: 'Open tickets versus approved spending',
    ar: 'الطلبات المفتوحة مقابل الإنفاق المعتمد',
    ku: 'داواکارییە کراوەکان بەرامبەر خەرجی پەسەندکراو'
  },
  {
    key: 'company.open_tickets',
    en: 'Open Tickets',
    ar: 'تذاكر مفتوحة',
    ku: 'کراوە'
  },
  {
    key: 'company.ai_insights_title',
    en: 'AI Advisory & Insights',
    ar: 'توجيهات ورؤى الذكاء الاصطناعي',
    ku: 'ڕێنمایی و شیکاری ژیری دەستکرد'
  },

  // ================== CORE ==================
  {
    key: 'core.history',
    en: 'History',
    ar: 'السجل',
    ku: 'مێژوو'
  },
  {
    key: 'core.notes',
    en: 'Notes',
    ar: 'ملاحظات',
    ku: 'تێبینییەکان'
  },
  {
    key: 'core.error',
    en: 'Error loading data',
    ar: 'خطأ في تحميل البيانات',
    ku: 'هەڵە لە بارکردنی داتا'
  },

  // ================== CURRENCY ==================
  {
    key: 'currency.iqd',
    en: 'Iraqi Dinar (IQD)',
    ar: 'دينار عراقي (د.ع)',
    ku: 'دیناری عێراقی (د.ع)'
  },

  // ================== INTEGRATION ==================
  {
    key: 'integration.capability_label',
    en: 'Capability:',
    ar: 'القدرة:',
    ku: 'توانست:'
  },
  {
    key: 'integration.configure_keys',
    en: 'Configure Keys',
    ar: 'تهيئة المفاتيح',
    ku: 'ڕێکخستنی کلیلەکان'
  },
  {
    key: 'integration.configured',
    en: 'CONFIGURED',
    ar: 'مهيأ',
    ku: 'ڕێکخراوە'
  },
  {
    key: 'integration.email_notif',
    en: 'EMAIL NOTIFICATIONS',
    ar: 'إشعارات البريد الإلكتروني',
    ku: 'ئاگادارکردنەوەکانی ئیمەیڵ'
  },
  {
    key: 'integration.esignature',
    en: 'E-SIGNATURE',
    ar: 'التوقيع الإلكتروني',
    ku: 'واژۆی ئەلیکترۆنی'
  },
  {
    key: 'integration.manage_settings',
    en: 'Manage Settings',
    ar: 'إدارة الإعدادات',
    ku: 'بەڕێوەبردنی ڕێکخستنەکان'
  },
  {
    key: 'integration.providers',
    en: 'Providers',
    ar: 'مقدمو الخدمات',
    ku: 'دابینکەرەکان'
  },
  {
    key: 'integration.safe_paused_long',
    en: 'Operations dependent on this provider have been safely paused. No data has been lost or fabricated.',
    ar: 'تم إيقاف العمليات المعتمدة على هذا المزود بأمان. لم تفقد أي بيانات.',
    ku: 'کردارەکانی پەیوەست بەم دابینکەرە بە پارێزراوی ڕاگیراون. هیچ زانیارییەک لەدەست نەچووە.'
  },
  {
    key: 'integration.sms_provider',
    en: 'SMS PROVIDER',
    ar: 'مزود الرسائل النصية القصيرة',
    ku: 'دابینکەری کورتەنامە (SMS)'
  },
  {
    key: 'integration.subtitle',
    en: 'Real-World Infrastructure & External APIs',
    ar: 'البنية التحتية والواجهات البرمجية الخارجية',
    ku: 'ژێرخانی ژینگەی کار و بەستەرە دەرەکییەکان'
  },

  // ================== LEASE ==================
  {
    key: 'lease.tenant',
    en: 'Tenant',
    ar: 'المستأجر',
    ku: 'کرێچی'
  },

  // ================== MAINTENANCE ==================
  {
    key: 'maintenance.active_wos',
    en: 'Active Work Orders',
    ar: 'أوامر العمل النشطة',
    ku: 'فەرمانە چالاکەکانی کار'
  },
  {
    key: 'maintenance.approve_wo',
    en: 'Approve & Create Work Order',
    ar: 'الموافقة وإنشاء أمر العمل',
    ku: 'پەسەندکردن و دروستکردنی فەرمانی کار'
  },
  {
    key: 'maintenance.assigned_vendor',
    en: 'Assigned Vendor:',
    ar: 'الفني المعين:',
    ku: 'وەستا / بەڵێندەری دیاریکراو:'
  },
  {
    key: 'maintenance.cancel_request',
    en: 'Cancel Request',
    ar: 'إلغاء الطلب',
    ku: 'هەڵوەشاندنەوەی داواکاری'
  },
  {
    key: 'maintenance.control_center',
    en: 'Maintenance Control Center',
    ar: 'مركز تحكم الصيانة',
    ku: 'ناوەندی کۆنترۆڵی چاکسازی'
  },
  {
    key: 'maintenance.details_actions',
    en: 'Request Details & Actions',
    ar: 'التفاصيل والإجراءات',
    ku: 'وردەکارییەکان و کردارەکان'
  },
  {
    key: 'maintenance.error.approve',
    en: 'Failed to approve quote',
    ar: 'تعذر الموافقة على عرض السعر',
    ku: 'هەڵە لە پەسەندکردنی خەمڵاندنی نرخ'
  },
  {
    key: 'maintenance.error.fetch',
    en: 'Failed to fetch queue',
    ar: 'تعذر جلب قائمة الانتظار',
    ku: 'هەڵە لە بارکردنی نۆرە'
  },
  {
    key: 'maintenance.manage_schedule',
    en: 'Manage Schedule',
    ar: 'إدارة الجدول الزمني',
    ku: 'بەڕێوەبردنی خشتەی کار'
  },
  {
    key: 'maintenance.no_requests',
    en: 'There are no active maintenance requests at this time.',
    ar: 'لا توجد طلبات صيانة نشطة حالياً.',
    ku: 'هیچ داواکارییەکی چاکسازی چالاک لەم کاتەدا نییە.'
  },
  {
    key: 'maintenance.pending_quotes',
    en: 'Pending Quotes',
    ar: 'عروض الأسعار المعلقة',
    ku: 'خەمڵاندنە هەڵپەسێردراوەکان'
  },
  {
    key: 'maintenance.queue_empty',
    en: 'Queue is empty',
    ar: 'قائمة الانتظار فارغة',
    ku: 'نۆرەکە بەتاڵە'
  },
  {
    key: 'maintenance.review_quote',
    en: 'Review Quote',
    ar: 'مراجعة عرض السعر',
    ku: 'پێداچوونەوەی نرخ'
  },
  {
    key: 'maintenance.subtitle',
    en: 'Manage work orders, triage requests, and review quotes',
    ar: 'إدارة أوامر العمل وفرز الطلبات ومراجعة عروض الأسعار',
    ku: 'بەڕێوەبردنی فەرمانەکانی کار، پۆلێنکردنی داواکارییەکان، و پێداچوونەوەی خەمڵاندنی نرخ'
  },
  {
    key: 'maintenance.triage',
    en: 'Triage / Prioritize',
    ar: 'فرز / تحديد الأولويات',
    ku: 'پۆلێنکردن بەپێی لەپێشینە'
  },
  {
    key: 'maintenance.view_work_order',
    en: 'View Work Order',
    ar: 'عرض أمر العمل',
    ku: 'پیشاندانی فەرمانی کار'
  },
  {
    key: 'maintenance.wo',
    en: 'Work Order #',
    ar: 'أمر العمل #',
    ku: 'ژمارەی فەرمانی کار #'
  },

  // ================== NAV & OWNER ==================
  {
    key: 'nav.portfolio',
    en: 'Portfolio',
    ar: 'المحفظة',
    ku: 'پۆرتفۆلیۆ'
  },
  {
    key: 'owner.portfolio_properties',
    en: 'Portfolio Properties',
    ar: 'عقارات المحفظة',
    ku: 'موڵکەکانی پۆرتفۆلیۆ'
  },

  // ================== PROPERTY ==================
  {
    key: 'property.health',
    en: 'Property Health',
    ar: 'صحة العقار',
    ku: 'تەندروستی موڵک'
  },
  {
    key: 'property.status.active',
    en: 'Active',
    ar: 'نشط',
    ku: 'چالاک'
  },
  {
    key: 'property.status.occupied',
    en: 'Occupied',
    ar: 'مشغول',
    ku: 'پڕ / گیراو'
  },
  {
    key: 'property.status.pending',
    en: 'Pending',
    ar: 'قيد الانتظار',
    ku: 'چاوەڕوانکراو'
  },
  {
    key: 'property.status.vacant',
    en: 'Vacant',
    ar: 'شاغر',
    ku: 'بەتاڵ'
  },
  {
    key: 'property.type.apartment_short',
    en: 'Apartment',
    ar: 'شقة',
    ku: 'شوقە'
  },
  {
    key: 'property.type.commercial_short',
    en: 'Commercial',
    ar: 'تجاري',
    ku: 'بازرگانی'
  },
  {
    key: 'property.type.industrial_short',
    en: 'Industrial',
    ar: 'صناعي',
    ku: 'پیشەسازی'
  },
  {
    key: 'property.type.label',
    en: 'Property Type',
    ar: 'نوع العقار',
    ku: 'جۆری موڵک'
  },
  {
    key: 'property.type.villa_short',
    en: 'Villa',
    ar: 'فيلا',
    ku: 'ڤێلا'
  },
  {
    key: 'property.error.owner_id_required',
    en: 'Actual Owner User ID is required when selecting Individual.',
    ar: 'معرف المستخدم الفعلي للمالك مطلوب عند اختيار فرد.',
    ku: 'ناسنامەی بەکارهێنەری خاوەن موڵک پێویستە کاتێک تاک هەڵدەبژێردرێت.'
  },
  {
    key: 'property.error.company_id_required',
    en: 'Actual Owner Company ID is required when selecting Company.',
    ar: 'معرف شركة المالك الفعلي مطلوب عند اختيار شركة.',
    ku: 'ناسنامەی کۆمپانیای خاوەن موڵک پێویستە کاتێک کۆمپانیا هەڵدەبژێردرێت.'
  },
  {
    key: 'property.currency_label',
    en: 'Transaction Currency',
    ar: 'عملة المعاملة',
    ku: 'دراوی مامەڵە'
  },
  {
    key: 'property.map_location',
    en: 'Select on Map',
    ar: 'تحديد على الخريطة',
    ku: 'دیاریکردن لەسەر نەخشە'
  },
  {
    key: 'property.map_hint',
    en: 'Click on the map to pin the exact location of the property.',
    ar: 'انقر على الخريطة لتثبيت الموقع الدقيق للعقار.',
    ku: 'کلیک لەسەر نەخشەکە بکە بۆ دیاریکردنی شوێنی تەواوی موڵکەکە.'
  },

  // ================== STATUS ==================
  {
    key: 'status.completed_text',
    en: 'Completed',
    ar: 'مكتمل',
    ku: 'تەواوکراو'
  },
  {
    key: 'status.critical_text',
    en: 'Critical',
    ar: 'حرج',
    ku: 'هەستیار / مەترسیدار'
  },
  {
    key: 'status.high_text',
    en: 'High',
    ar: 'عالي',
    ku: 'بەرز'
  },
  {
    key: 'status.low_text',
    en: 'Low',
    ar: 'منخفض',
    ku: 'نزم'
  },
  {
    key: 'status.medium_text',
    en: 'Medium',
    ar: 'متوسط',
    ku: 'مامناوەند'
  },
  {
    key: 'status.new_request',
    en: 'NEW REQUEST',
    ar: 'طلب جديد',
    ku: 'داواکاری نوێ'
  },
  {
    key: 'status.quote_ready',
    en: 'QUOTE READY',
    ar: 'عرض السعر جاهز',
    ku: 'نرخ ئامادەیە'
  },
  {
    key: 'status.triaged',
    en: 'TRIAGED',
    ar: 'تم الفرز',
    ku: 'پۆلێنکراو'
  },
  {
    key: 'status.triaged_text',
    en: 'Triaged',
    ar: 'تم الفرز',
    ku: 'پۆلێنکراو'
  },
  {
    key: 'status.work_order',
    en: 'WORK ORDER',
    ar: 'أمر العمل',
    ku: 'فەرمانی کار'
  },
  {
    key: 'status.work_order_created',
    en: 'Work Order Created',
    ar: 'تم إنشاء أمر عمل',
    ku: 'فەرمانی کار دروستکرا'
  },
  {
    key: 'status.verified',
    en: 'Verified',
    ar: 'موثق',
    ku: 'پشتڕاستکراوەتەوە'
  },

  // ================== TENANT ==================
  {
    key: 'tenant.action_required',
    en: 'Action required for current payment cycle',
    ar: 'مطلوب إجراء لدورة الدفع الحالية',
    ku: 'کردار پێویستە بۆ خولی ئێستای پارەدان'
  },
  {
    key: 'tenant.due',
    en: 'Due:',
    ar: 'المستحق:',
    ku: 'شایستە:'
  },
  {
    key: 'tenant.error.lease',
    en: 'Failed to retrieve lease contract details',
    ar: 'تعذر الحصول على تفاصيل عقد الإيجار',
    ku: 'هەڵە لە وەرگرتنی وردەکاری گرێبەستی کرێ'
  },
  {
    key: 'tenant.mock.paid',
    en: 'Paid',
    ar: 'تم الدفع',
    ku: 'دراوە'
  },
  {
    key: 'tenant.mock.rent',
    en: "This Month's Rent",
    ar: 'إيجار هذا الشهر',
    ku: 'کرێی ئەم مانگە'
  },
  {
    key: 'tenant.next_cycle',
    en: 'Next Cycle',
    ar: 'الدورة القادمة',
    ku: 'خولی داهاتوو'
  },
  {
    key: 'tenant.no_lease',
    en: 'You do not have an active lease currently.',
    ar: 'ليس لديك عقد إيجار نشط حالياً.',
    ku: 'لە ئێستادا هیچ گرێبەستێکی چالاکت نییە.'
  },
  {
    key: 'tenant.depositRequired',
    en: 'Security Deposit Required',
    ar: 'التأمين المطلوب',
    ku: 'بارمتەی پێویست'
  },
  {
    key: 'tenant.depositCollected',
    en: 'Security Deposit Collected',
    ar: 'التأمين المحصل',
    ku: 'بارمتەی وەرگیراو'
  },
  {
    key: 'tenant.depositHeld',
    en: 'Held (Escrow Deposit)',
    ar: 'محتجز (حساب الضمان)',
    ku: 'پارێزراو لە هەژماری دڵنیایی (ئیسکرۆو)'
  },
  {
    key: 'tenant.depositReleased',
    en: 'Deposit Released',
    ar: 'تم إرجاع التأمين',
    ku: 'بارمتە گەڕێندراوەتەوە'
  },
  {
    key: 'tenant.role',
    en: 'Account Role',
    ar: 'دور الحساب',
    ku: 'ڕۆڵی هەژمار'
  },
  {
    key: 'tenant.pendingSignature',
    en: 'Awaiting Your Acceptance',
    ar: 'بانتظار قبولك وموافقتك',
    ku: 'چاوەڕوانی پەسەندکردنی تۆیە'
  },
  {
    key: 'tenant.expired',
    en: 'Expired Lease',
    ar: 'عقد منتهي الصلاحية',
    ku: 'گرێبەستی بەسەرچوو'
  },
  {
    key: 'tenant.acceptLease',
    en: 'Accept Lease Contract',
    ar: 'الموافقة على عقد الإيجار',
    ku: 'پەسەندکردنی گرێبەستی کرێ'
  },
  {
    key: 'tenant.paymentStatus',
    en: 'Payment Status:',
    ar: 'حالة الدفع:',
    ku: 'دۆخی پارەدان:'
  },
  {
    key: 'tenant.utilityBills',
    en: 'Utility Bills',
    ar: 'فواتير الخدمات العامة',
    ku: 'پسوڵەی خزمەتگوزارییەکان'
  },
  {
    key: 'tenant.dashboard.my_applications',
    en: 'My Rental Applications',
    ar: 'طلبات الإيجار الخاصة بي',
    ku: 'داواکارییەکانی بەکرێگرتنی من'
  },

  // ================== TIME ==================
  {
    key: 'time.may',
    en: 'May',
    ar: 'مايو',
    ku: 'ئایار'
  },
  {
    key: 'time.jun',
    en: 'June',
    ar: 'يونيو',
    ku: 'حوزەیران'
  },
  {
    key: 'time.jul',
    en: 'July',
    ar: 'يوليو',
    ku: 'تەمووز'
  },
  {
    key: 'time.aug',
    en: 'August',
    ar: 'أغسطس',
    ku: 'ئاب'
  },
  {
    key: 'time.sep',
    en: 'September',
    ar: 'سبتمبر',
    ku: 'ئەیلوول'
  },
  {
    key: 'time.oct',
    en: 'October',
    ar: 'أكتوبر',
    ku: 'تشرینی یەکەم'
  },

  // ================== VENDOR ==================
  {
    key: 'vendor.all_caught_up',
    en: 'No new work orders',
    ar: 'لا توجد أوامر عمل جديدة',
    ku: 'هیچ فەرمانێکی نوێی کار نییە'
  },
  {
    key: 'vendor.assigned_title',
    en: 'Assigned Work Orders',
    ar: 'أوامر العمل المعينة',
    ku: 'فەرمانە سپێردراوەکانی کار'
  },
  {
    key: 'vendor.duration_placeholder',
    en: 'e.g. 2 Days',
    ar: 'مثال: يومين',
    ku: 'بۆ نموونە: ٢ ڕۆژ'
  },
  {
    key: 'vendor.error.fetch',
    en: 'Failed to retrieve assignments',
    ar: 'تعذر الحصول على الطلبات المحددة',
    ku: 'هەڵە لە وەرگرتنی کارە سپێردراوەکان'
  },
  {
    key: 'vendor.failed_quote',
    en: 'Failed to submit quote',
    ar: 'فشل في تقديم عرض السعر',
    ku: 'نەتوانرا نرخی خەمڵێنراو بنێردرێت'
  },
  {
    key: 'vendor.fees',
    en: 'Additional Fees',
    ar: 'رسوم إضافية',
    ku: 'تێچووی زیادە'
  },
  {
    key: 'vendor.id',
    en: 'Vendor ID:',
    ar: 'رقم الفني:',
    ku: 'ناسنامەی دابینکەر:'
  },
  {
    key: 'vendor.loading_assignments',
    en: 'Loading work orders...',
    ar: 'جاري تحميل أوامر العمل...',
    ku: 'بارکردنی فەرمانەکانی کار...'
  },
  {
    key: 'vendor.mark_completed',
    en: 'Mark as Completed',
    ar: 'وضع علامة مكتمل',
    ku: 'دیاریکردن وەک تەواوکراو'
  },
  {
    key: 'vendor.material_cost',
    en: 'Material Cost',
    ar: 'تكلفة المواد',
    ku: 'تێچووی کەرەستە'
  },
  {
    key: 'vendor.no_assignments',
    en: 'No assigned tasks currently',
    ar: 'لا توجد مهام معينة حالياً',
    ku: 'لە ئێستادا هیچ ئەرکێک نەسپێردراوە'
  },
  {
    key: 'vendor.no_requests',
    en: 'You have no active maintenance requests at this time.',
    ar: 'ليس لديك طلبات صيانة نشطة حالياً.',
    ku: 'هیچ داواکارییەکی چاکسازی چالاکت نییە لەم کاتەدا.'
  },
  {
    key: 'vendor.notes_placeholder',
    en: 'Additional details...',
    ar: 'تفاصيل إضافية...',
    ku: 'وردەکاری زیاتر...'
  },
  {
    key: 'vendor.refresh',
    en: 'Refresh',
    ar: 'تحديث',
    ku: 'نوێکردنەوە'
  },
  {
    key: 'vendor.submit_quote',
    en: 'Submit Quote',
    ar: 'تقديم عرض سعر',
    ku: 'ناردنی خەمڵاندنی نرخ'
  },
  {
    key: 'vendor.total',
    en: 'Total Quote',
    ar: 'إجمالي العرض',
    ku: 'کۆی گشتی خەمڵاندن'
  },
  {
    key: 'vendor.language_selector',
    en: 'Language & Regional Navigator',
    ar: 'محدد اللغة والتفضيلات الإقليمية',
    ku: 'ڕێکخستنی زمان و ناوچە'
  },
  {
    key: 'vendor.localization_title',
    en: 'Localization & Regional Preferences',
    ar: 'تفضيلات اللغة والاتجاه الإقليمي',
    ku: 'ڕێکخستنی زمان و ناوچە'
  },
  {
    key: 'vendor.localization_sub',
    en: 'Select your preferred operational language and layout direction',
    ar: 'اختر لغة التشغيل المفضلة لديك واتجاه الواجهة',
    ku: 'زمان و ئاراستەی دڵخوازی ڕووکار هەڵبژێرە'
  },

  // ================== WORKSPACE ==================
  {
    key: 'workspace.context',
    en: 'Workspaces',
    ar: 'مساحات العمل',
    ku: 'پێگەکانی کار'
  },

  // ================== SETTLEMENTS ==================
  {
    key: 'settlements.missingRef',
    en: 'External confirmation reference is mandatory for COMPLETED payouts (Internal Finance Record only).',
    ar: 'الرقم المرجعي للتأكيد الخارجي إلزامي للمدفوعات المكتملة (سجل مالي داخلي فقط).',
    ku: 'ئاماژەی پشتڕاستکردنەوەی دەرەکی پێویستە بۆ پارەدانە تەواوکراوەکان (تەنها تۆماری دارایی ناوخۆیی).'
  },
  {
    key: 'settlements.financeQueue',
    en: 'Payout Requests Queue',
    ar: 'قائمة انتظار طلبات صرف المستحقات',
    ku: 'نۆرەی داواکارییەکانی خەرجکردنی شایستە داراییەکان'
  },
  {
    key: 'settlements.financeQueueDesc',
    en: 'Manage owner payouts. External API transfers disabled; manual internal recording only.',
    ar: 'إدارة صرف مستحقات الملاك. التحويلات عبر واجهة برمجة التطبيقات معطلة؛ التسجيل اليدوي الداخلي فقط.',
    ku: 'بەڕێوەبردنی شایستەی خاوەن موڵک. گواستنەوەی خۆکاری بانکی ناچالاکە؛ تەنها تۆماری دەستی فەرمی کارایە.'
  },
  {
    key: 'settlements.id',
    en: 'ID',
    ar: 'المعرف',
    ku: 'ناسنامە'
  },
  {
    key: 'settlements.amount',
    en: 'Amount (IQD)',
    ar: 'المبلغ (د.ع)',
    ku: 'بڕ (دینار)'
  },
  {
    key: 'settlements.emptyQueue',
    en: 'No payout requests found.',
    ar: 'لا توجد طلبات صرف مستحقات حالياً.',
    ku: 'هیچ داواکارییەکی خەرجکردنی شایستە نەدۆزرایەوە.'
  },
  {
    key: 'settlements.refPlaceholder',
    en: 'Bank Ref # (Required)',
    ar: 'الرقم المرجعي للبنك (مطلوب)',
    ku: 'ژمارەی ئاماژەی بانک (پێویستە)'
  },
  {
    key: 'settlements.markComplete',
    en: 'Mark Completed',
    ar: 'تعيين كمكتمل',
    ku: 'دیاریکردن وەک تەواوکراو'
  },
  {
    key: 'settlements.ref',
    en: 'Ref',
    ar: 'المرجع',
    ku: 'ئاماژە'
  },

  // ================== AUTOPILOT ==================
  {
    key: 'autopilot.approved_success',
    en: 'Action proposal approved successfully.',
    ar: 'تمت الموافقة على مقترح الإجراء بنجاح.',
    ku: 'پێشنیاری کردار بە سەرکەوتوویی پەسەندکرا.'
  },
  {
    key: 'autopilot.rejected_success',
    en: 'Action proposal rejected.',
    ar: 'تم رفض مقترح الإجراء.',
    ku: 'پێشنیاری کردار ڕەتکرایەوە.'
  },
  {
    key: 'autopilot.executed_success',
    en: 'Action successfully executed and verified.',
    ar: 'تم تنفيذ الإجراء والتحقق منه بنجاح.',
    ku: 'کردارەکە بە سەرکەوتوویی جێبەجێکرا و پشتڕاستکرایەوە.'
  },
  {
    key: 'autopilot.run_auto_eligible',
    en: 'Execute Auto-Eligible',
    ar: 'تنفيذ الإجراءات المؤهلة تلقائياً',
    ku: 'جێبەجێکردنی شیاوە خۆکارەکان'
  },
  {
    key: 'autopilot.active_automations',
    en: 'Active Automations',
    ar: 'الأتمتة النشطة',
    ku: 'خۆکارکردنە چالاکەکان'
  },
  {
    key: 'autopilot.advisory_signals',
    en: 'Advisory Signals',
    ar: 'إشارات وتوصيات استشارية',
    ku: 'هێماکانی ڕاوێژکاری'
  },
  {
    key: 'autopilot.total_actions',
    en: 'Execution History',
    ar: 'سجل التنفيذ',
    ku: 'مێژووی جێبەجێکردن'
  },
  {
    key: 'autopilot.tab_approvals',
    en: 'Pending Approvals',
    ar: 'الموافقات المعلقة',
    ku: 'پەسەندکردنە هەڵپەسێردراوەکان'
  },
  {
    key: 'autopilot.tab_automations',
    en: 'Automations & Ready',
    ar: 'الأتمتة والجاهزة للتنفيذ',
    ku: 'ئەرکە خۆکار و ئامادەکراوەکان'
  },
  {
    key: 'autopilot.tab_advisory',
    en: 'Advisory Recommendations',
    ar: 'التوصيات الاستشارية',
    ku: 'ڕاسپاردە ڕاوێژکارییەکان'
  },
  {
    key: 'autopilot.tab_history',
    en: 'Execution History & Audit',
    ar: 'سجل التنفيذ والتدقيق',
    ku: 'مێژووی جێبەجێکردن و وردبینی'
  },
  {
    key: 'autopilot.tab_policies',
    en: 'Policy & Ceilings',
    ar: 'السياسات والحدود المالية',
    ku: 'سیاسەت و سنوورە داراییەکان'
  },
  {
    key: 'autopilot.no_pending',
    en: 'No Pending Approvals',
    ar: 'لا توجد موافقات معلقة',
    ku: 'هیچ پەسەندکردنێکی هەڵپەسێردراو نییە'
  },
  {
    key: 'autopilot.no_pending_desc',
    en: 'All operational actions have either been reviewed or executed under current policy boundaries.',
    ar: 'تمت مراجعة جميع الإجراءات التشغيلية أو تنفيذها وفق حدود السياسة الحالية.',
    ku: 'تەواوی کردارە کارپێکردنەکان پێداچوونەوەیان بۆ کراوە یان جێبەجێکراون بەپێی سنووری سیاسەت.'
  },
  {
    key: 'autopilot.inspect',
    en: 'Review Payload',
    ar: 'مراجعة حمولة البيانات',
    ku: 'پێداچوونەوەی ناوەڕۆکی کردار'
  },
  {
    key: 'autopilot.approve_action',
    en: 'Sign & Approve',
    ar: 'توقيع وموافقة',
    ku: 'واژۆکردن و پەسەندکردن'
  },
  {
    key: 'autopilot.no_automations',
    en: 'No Automations Currently Queued',
    ar: 'لا توجد مهام مؤتمتة في قائمة الانتظار حالياً',
    ku: 'هیچ کردارێکی خۆکار لە نۆرەدا نییە لە ئێستادا'
  },
  {
    key: 'autopilot.no_automations_desc',
    en: 'Autonomous low-risk tasks will appear here when triggered by operational schedules and policy checks.',
    ar: 'ستظهر المهام منخفضة المخاطر المؤتمتة هنا عند تفعيلها وفق الجداول الزمنية والسياسات.',
    ku: 'ئەرکە کەم-مەترسییە خۆکارەکان لێرە دەردەکەون کاتێک خشتەی کارپێکردن دەیانخاتە کار.'
  },
  {
    key: 'autopilot.execute_now',
    en: 'Execute Now',
    ar: 'تنفيذ الآن',
    ku: 'ئێستا جێبەجێی بکە'
  },
  {
    key: 'autopilot.no_advisory',
    en: 'No Advisory Insights',
    ar: 'لا توجد رؤى استشارية',
    ku: 'هیچ تێڕوانینێکی ڕاوێژکاری نییە'
  },
  {
    key: 'autopilot.no_advisory_desc',
    en: 'Advisory recommendations (Class A) will be generated as portfolio intelligence and market data are refreshed.',
    ar: 'سيتم توليد التوصيات الاستشارية (الفئة A) عند تحديث بيانات السوق وتحليلات المحفظة.',
    ku: 'ڕاسپاردە ڕاوێژکارییەکان (پۆلی A) بەرهەمدێن کاتێک داتاکانی بازاڕ و پۆرتفۆلیۆ نوێدەبنەوە.'
  },
  {
    key: 'autopilot.action_type',
    en: 'Action Type',
    ar: 'نوع الإجراء',
    ku: 'جۆری کردار'
  },
  {
    key: 'autopilot.class',
    en: 'Class',
    ar: 'الفئة',
    ku: 'پۆل'
  },
  {
    key: 'autopilot.reference',
    en: 'Execution Ref',
    ar: 'مرجع التنفيذ',
    ku: 'ئاماژەی جێبەجێکردن'
  },
  {
    key: 'autopilot.details',
    en: 'Details',
    ar: 'التفاصيل',
    ku: 'وردەکارییەکان'
  },
  {
    key: 'autopilot.no_history',
    en: 'No completed or historical action executions found.',
    ar: 'لم يتم العثور على إجراءات مكتملة أو سابقة.',
    ku: 'هیچ کردارێکی جێبەجێکراو یان مێژوویی نەدۆزرایەوە.'
  },
  {
    key: 'autopilot.policy_title',
    en: 'Server-Enforced Autonomy Policy',
    ar: 'سياسة الأتمتة المطبقة من الخادم',
    ku: 'سیاسەتی خۆفڕی پارێزراوی سێرڤەر'
  },
  {
    key: 'autopilot.policy_desc',
    en: 'Autonomous Class B execution is strictly constrained by server-side policy thresholds, quiet hours, and category gating.',
    ar: 'تنفيذ الفئة B المؤتمت مقيد بشكل صارم بحدود الخادم وساعات الهدوء وبوابات التصنيف.',
    ku: 'جێبەجێکردنی خۆکاری پۆلی B بە توندی سنوردارکراوە بە بەربەستە داراییەکانی سێرڤەر و کاتژمێرە هێمنەکان.'
  },
  {
    key: 'autopilot.spending_ceiling',
    en: 'Financial Execution Limit',
    ar: 'الحد المالي للتنفيذ',
    ku: 'سنووری دارایی جێبەجێکردن'
  },
  {
    key: 'autopilot.quiet_hours',
    en: 'Quiet Hours Window',
    ar: 'نافذة ساعات الهدوء',
    ku: 'ماوەی کاتژمێرە هێمنەکان'
  },
  {
    key: 'autopilot.autonomy_status',
    en: 'Autonomous Engine State',
    ar: 'حالة محرك الأتمتة',
    ku: 'دۆخی مەکینەی خۆکارکردن'
  },
  {
    key: 'autopilot.governance_version',
    en: 'Active Policy Version',
    ar: 'إصدار السياسة النشط',
    ku: 'وەشانی سیاسەتی کارا'
  },
  {
    key: 'autopilot.confirm_approval',
    en: 'Confirm Human Sign-off',
    ar: 'تأكيد التوقيع البشري الصريح',
    ku: 'پشتڕاستکردنەوەی واژۆی مرۆیی'
  },
  {
    key: 'autopilot.inspect_action',
    en: 'Action Specification & Payload',
    ar: 'مواصفات وحمولة الإجراء',
    ku: 'تایبەتمەندی و ناوەڕۆکی کردار'
  },
  {
    key: 'autopilot.recommendation',
    en: 'Recommendation',
    ar: 'التوصية',
    ku: 'ڕاسپاردە'
  },
  {
    key: 'autopilot.rationale',
    en: 'Operational Rationale',
    ar: 'المبرر التشغيلي',
    ku: 'هۆکاری کارپێکردن'
  },
  {
    key: 'autopilot.payload',
    en: 'Proposed Action Payload (Immutable)',
    ar: 'حمولة الإجراء المقترح (غير قابلة للتعديل)',
    ku: 'ناوەڕۆکی کرداری پێشنیارکراو (نەگۆڕ)'
  },
  {
    key: 'autopilot.confirm_sign',
    en: 'I Authorize & Sign',
    ar: 'أنا أفوض وأوقع',
    ku: 'دەسەڵات دەبەخشم و واژۆی دەکەم'
  },
  {
    key: 'autopilot.proceed_to_approve',
    en: 'Proceed to Sign',
    ar: 'المتابعة للتوقيع',
    ku: 'بەردەوامبە بۆ واژۆکردن'
  },

  // ================== MARKETPLACE ==================
  {
    key: 'marketplace.insights.schools',
    en: 'Schools & Education',
    ar: 'المدارس والتعليم',
    ku: 'قوتابخانە و پەروەردە'
  },
  {
    key: 'marketplace.insights.safety',
    en: 'Safety & Security',
    ar: 'الأمان والسلامة',
    ku: 'ئارامی و ئاسایش'
  },
  {
    key: 'marketplace.insights.transport',
    en: 'Public Transport',
    ar: 'المواصلات العامة',
    ku: 'هاتوچۆ و گواستنەوە'
  },
  {
    key: 'marketplace.insights.shopping',
    en: 'Markets & Shopping',
    ar: 'التسوق والمراكز التجارية',
    ku: 'بازاڕ و مۆڵەکان'
  },
  {
    key: 'marketplace.insights.quietness',
    en: 'Neighborhood Quietness',
    ar: 'هدوء الحي',
    ku: 'ئارامی و بێدەنگی گەڕەک'
  },
  {
    key: 'marketplace.ai_search.placeholder',
    en: "Try '3-bedroom villa in Erbil under $1500'",
    ar: "جرب 'فيلا 3 غرف في أربيل بأقل من 1500$'",
    ku: "تاقیبکەرەوە 'ڤێلای ٣ ژووری لە هەولێر کەمتر لە $1500'"
  },
  {
    key: 'marketplace.ai_search.toggle',
    en: 'Toggle AI Smart Search',
    ar: 'تبديل البحث الذكي بالذكاء الاصطناعي',
    ku: 'گۆڕینی گەڕانی زیرەک بە AI'
  },
  {
    key: 'marketplace.action.view_details',
    en: 'View Details',
    ar: 'عرض التفاصيل',
    ku: 'بینینی وردەکارییەکان'
  },
  {
    key: 'marketplace.comparison.compare_property',
    en: 'Compare Property',
    ar: 'مقارنة العقار',
    ku: 'بەراوردکردنی موڵک'
  },
  {
    key: 'marketplace.social.viewing',
    en: 'people viewing this',
    ar: 'أشخاص يشاهدون هذا الآن',
    ku: 'کەس لە ئێستادا سەیری ئەمە دەکەن'
  },
  {
    key: 'marketplace.social_proof.rare_find',
    en: 'Rare Find! Highly Demanded',
    ar: 'فرصة نادرة! طلب مرتفع جداً',
    ku: 'هەلێکی دەگمەن! خواستی زۆری لەسەرە'
  },
  {
    key: 'marketplace.social_proof.viewing',
    en: 'people are viewing this right now. Listed',
    ar: 'أشخاص يشاهدون هذا العقار الآن. أضيف قبل',
    ku: 'کەس سەیری ئەم موڵکە دەکەن ئێستا. بڵاوکراوەتەوە پێش'
  },
  {
    key: 'marketplace.social_proof.hours_ago',
    en: 'hours ago.',
    ar: 'ساعات.',
    ku: 'کاتژمێر.'
  },
  {
    key: 'marketplace.insights.neighborhood',
    en: 'Neighborhood Insights',
    ar: 'رؤى وتحليلات الحي',
    ku: 'تێڕوانینی گەڕەک'
  },
  {
    key: 'marketplace.scheduler.select_datetime',
    en: 'Select Date & Time',
    ar: 'اختر التاريخ والوقت',
    ku: 'بەروار و کات هەڵبژێرە'
  },
  {
    key: 'marketplace.scheduler.available_days',
    en: 'Available Days',
    ar: 'الأيام المتاحة',
    ku: 'ڕۆژە بەردەستەکان'
  },
  {
    key: 'marketplace.scheduler.available_times',
    en: 'Available Times',
    ar: 'الأوقات المتاحة',
    ku: 'کاتە بەردەستەکان'
  },
  {
    key: 'marketplace.scheduler.success',
    en: 'Viewing scheduled successfully. The agent will confirm shortly.',
    ar: 'تم تحديد موعد المعاينة بنجاح. سيقوم الوكيل بالتأكيد قريباً.',
    ku: 'سەردان بە سەرکەوتوویی دیاریکرا. نێوەندگیرەکە بەم زووانە پشتڕاستی دەکاتەوە.'
  },
  {
    key: 'marketplace.scheduler.confirm_viewing',
    en: 'Confirm Viewing',
    ar: 'تأكيد موعد المعاينة',
    ku: 'پشتڕاستکردنەوەی سەردان'
  },
  {
    key: 'marketplace.scheduler.schedule_viewing',
    en: 'Schedule Viewing',
    ar: 'جدولة موعد معاينة',
    ku: 'دیاریکردنی کاتی سەردان'
  },
  {
    key: 'marketplace.actions.apply_demo_success',
    en: 'Application submitted successfully! Our team will review your application.',
    ar: 'تم تقديم الطلب بنجاح! سيقوم فريقنا بمراجعة طلبك.',
    ku: 'داواکاری بە سەرکەوتوویی نێردرا! تیمەکەمان پێداچوونەوە بۆ داواکارییەکەت دەکات.'
  },
  {
    key: 'marketplace.actions.apply_for_rent',
    en: 'Apply for Rent',
    ar: 'التقديم على الإيجار',
    ku: 'پێشکەشکردنی داواکاری کرێ'
  },
  {
    key: 'marketplace.comparison.selected',
    en: 'Selected Properties',
    ar: 'العقارات المحددة',
    ku: 'موڵکە هەڵبژێردراوەکان'
  },
  {
    key: 'marketplace.comparison.max',
    en: 'Select up to 3 properties to compare',
    ar: 'اختر ما يصل إلى 3 عقارات للمقارنة',
    ku: 'تاکوو ٣ موڵک هەڵبژێرە بۆ بەراوردکردن'
  },
  {
    key: 'marketplace.comparison.clear_all',
    en: 'Clear all',
    ar: 'مسح الكل',
    ku: 'سڕینەوەی هەمووی'
  },
  {
    key: 'marketplace.comparison.compare_now',
    en: 'Compare Now',
    ar: 'قارن الآن',
    ku: 'ئێستا بەراورد بکە'
  },
  {
    key: 'marketplace.comparison.title',
    en: 'Property Comparison',
    ar: 'مقارنة العقارات',
    ku: 'بەراوردکردنی موڵکەکان'
  },
  {
    key: 'marketplace.comparison.features',
    en: 'Features & Amenities',
    ar: 'الميزات والخدمات',
    ku: 'تایبەتمەندییەکان و خزمەتگوزارییەکان'
  },
  {
    key: 'marketplace.comparison.price',
    en: 'Price / Rent',
    ar: 'السعر / الإيجار',
    ku: 'نرخ / کرێ'
  },
  {
    key: 'marketplace.comparison.location',
    en: 'Location & City',
    ar: 'الموقع والمدينة',
    ku: 'شوێن و شار'
  },
  {
    key: 'marketplace.filters.property_type',
    en: 'Property Type',
    ar: 'نوع العقار',
    ku: 'جۆری موڵک'
  },
  {
    key: 'marketplace.modal.area_label',
    en: 'Area Size',
    ar: 'المساحة',
    ku: 'ڕووبەر'
  },
  {
    key: 'marketplace.comparison.more',
    en: 'more',
    ar: 'المزيد',
    ku: 'زیاتر'
  },
  {
    key: 'marketplace.comparison.empty',
    en: 'No properties selected for comparison.',
    ar: 'لم يتم تحديد أي عقارات للمقارنة.',
    ku: 'هیچ موڵکێک هەڵنەبژێردراوە بۆ بەراوردکردن.'
  },

  // ================== COMMON PHRASES & SYSTEM DICTIONARY FALLBACKS ==================
  {
    key: 'Marketplace',
    en: 'Marketplace',
    ar: 'السوق',
    ku: 'بازاڕ'
  },
  {
    key: 'Workspace Context',
    en: 'Workspace Context',
    ar: 'مساحات العمل',
    ku: 'پێگەی کار'
  },
  {
    key: 'Buyer',
    en: 'Buyer',
    ar: 'مشتري',
    ku: 'کڕیار'
  },
  {
    key: 'Accountant',
    en: 'Accountant',
    ar: 'محاسب',
    ku: 'ژمێریار'
  },
  {
    key: 'Maintenance',
    en: 'Maintenance',
    ar: 'الصيانة',
    ku: 'چاکسازی'
  },
  {
    key: 'Portfolio',
    en: 'Portfolio',
    ar: 'المحفظة',
    ku: 'پۆرتفۆلیۆ'
  },
  {
    key: 'Platform Admin',
    en: 'Platform Admin',
    ar: 'مدير المنصة',
    ku: 'بەڕێوەبەری پلاتفۆرم'
  },
  {
    key: 'Integrations',
    en: 'Integrations',
    ar: 'التكاملات والربط',
    ku: 'بەستەرەکان'
  },
  {
    key: 'AI Autopilot',
    en: 'AI Autopilot',
    ar: 'الطيار الآلي الذكي',
    ku: 'خۆفڕی ژیری دەستکرد'
  },
  {
    key: 'Total Asset Value',
    en: 'Total Asset Value',
    ar: 'إجمالي قيمة الأصول',
    ku: 'کۆی بەهای سامانەکان'
  },
  {
    key: 'Annual Yield',
    en: 'Annual Yield',
    ar: 'العائد السنوي',
    ku: 'داهاتی ساڵانە'
  },
  {
    key: 'Active Units',
    en: 'Active Units',
    ar: 'الوحدات النشطة',
    ku: 'یەکە چالاکەکان'
  },
  {
    key: 'Vacancy Rate',
    en: 'Vacancy Rate',
    ar: 'معدل الشغور',
    ku: 'ڕێژەی بەتاڵی'
  },
  {
    key: 'Portfolio Analytics',
    en: 'Portfolio Analytics',
    ar: 'تحليلات المحفظة',
    ku: 'شیکارییەکانی پۆرتفۆلیۆ'
  },
  {
    key: 'Asset performance and investment overview',
    en: 'Asset performance and investment overview',
    ar: 'أداء الأصول ونظرة عامة على الاستثمار',
    ku: 'ئەدای سامانەکان و پوختەی وەبەرهێنان'
  },
  {
    key: 'Analytics Dashboard rendering foundation',
    en: 'Analytics Dashboard rendering foundation',
    ar: 'أساسيات عرض لوحة تحليلات المحفظة',
    ku: 'ناوەندی شیکارییەکان و بەڕێوەبردنی پۆرتفۆلیۆ'
  },
  {
    key: 'IQD',
    en: 'IQD',
    ar: 'د.ع',
    ku: 'د.ع'
  },
  {
    key: 'View Details',
    en: 'View Details',
    ar: 'عرض التفاصيل',
    ku: 'بینینی وردەکارییەکان'
  },
  {
    key: 'Today, 10:00 AM',
    en: 'Today, 10:00 AM',
    ar: 'اليوم، ١٠:٠٠ ص',
    ku: 'ئەمڕۆ، ١٠:٠٠ بەیانی'
  },
  {
    key: 'Maintenance requested by Company Admin',
    en: 'Maintenance requested by Company Admin',
    ar: 'طلب صيانة مقدم من مدير الشركة',
    ku: 'داواکاری چاکسازی لەلایەن بەڕێوەبەری کۆمپانیاوە نێردرا'
  },
  {
    key: 'Oct 12, 2023',
    en: 'Oct 12, 2023',
    ar: '١٢ أكتوبر ٢٠٢٣',
    ku: '١٢ی تشرینی یەکەمی ٢٠٢٣'
  },
  {
    key: 'Management Agreement Active',
    en: 'Management Agreement Active',
    ar: 'اتفاقية الإدارة نشطة',
    ku: 'ڕێککەوتنی بەڕێوەبردن چالاکە'
  },
  {
    key: 'Title Deed (Verified)',
    en: 'Title Deed (Verified)',
    ar: 'سند الملكية (موثق)',
    ku: 'تاپۆ (پشتڕاستکراوەتەوە)'
  },
  {
    key: 'Floor Plan PDF',
    en: 'Floor Plan PDF',
    ar: 'مخطط الطابق PDF',
    ku: 'نەخشەی نهۆم'
  },
  {
    key: 'Previous Lease (Expired)',
    en: 'Previous Lease (Expired)',
    ar: 'عقد الإيجار السابق (منتهي)',
    ku: 'گرێبەستی پێشوو (بەسەرچووە)'
  },
  {
    key: 'Vacant',
    en: 'Vacant',
    ar: 'شاغر',
    ku: 'بەتاڵ'
  },
  {
    key: 'Real-World Infrastructure & External APIs',
    en: 'Real-World Infrastructure & External APIs',
    ar: 'البنية التحتية الحقيقية والواجهات البرمجية الخارجية',
    ku: 'ژێرخانی ژینگەی کار و بەستەرە دەرەکییەکان'
  },
  {
    key: 'Providers',
    en: 'Providers',
    ar: 'مقدمو الخدمات',
    ku: 'دابینکەرەکان'
  },
  {
    key: 'Recent Webhook Events',
    en: 'Recent Webhook Events',
    ar: 'أحداث الويب هوك الأخيرة',
    ku: 'دوایین ڕووداوەکانی وێبهووک'
  },
  {
    key: 'Configure Keys',
    en: 'Configure Keys',
    ar: 'تهيئة المفاتيح',
    ku: 'ڕێکخستنی کلیلەکان'
  },
  {
    key: 'Manage Settings',
    en: 'Manage Settings',
    ar: 'إدارة الإعدادات',
    ku: 'بەڕێوەبردنی ڕێکخستنەکان'
  },
  {
    key: 'EMAIL NOTIFICATIONS',
    en: 'EMAIL NOTIFICATIONS',
    ar: 'إشعارات البريد الإلكتروني',
    ku: 'ئاگادارکردنەوەکانی ئیمەیڵ'
  },
  {
    key: 'SMS PROVIDER',
    en: 'SMS PROVIDER',
    ar: 'مزود الرسائل النصية القصيرة',
    ku: 'دابینکەری کورتەنامە (SMS)'
  },
  {
    key: 'E-SIGNATURE',
    en: 'E-SIGNATURE',
    ar: 'التوقيع الإلكتروني',
    ku: 'واژۆی ئەلیکترۆنی'
  },
  {
    key: 'CONFIGURED',
    en: 'CONFIGURED',
    ar: 'مهيأ',
    ku: 'ڕێکخراوە'
  },
  {
    key: 'Signature Validation Active',
    en: 'Signature Validation Active',
    ar: 'التحقق من التوقيع نشط',
    ku: 'پشکنینی واژۆ چالاکە'
  },
  {
    key: 'Provider',
    en: 'Provider',
    ar: 'المزود',
    ku: 'دابینکەر'
  },
  {
    key: 'Event Type',
    en: 'Event Type',
    ar: 'نوع الحدث',
    ku: 'جۆری ڕووداو'
  },
  {
    key: 'Event ID',
    en: 'Event ID',
    ar: 'معرف الحدث',
    ku: 'ناسنامەی ڕووداو'
  },
  {
    key: 'Timestamp',
    en: 'Timestamp',
    ar: 'الطابع الزمني',
    ku: 'کاتی ڕووداو'
  },
  {
    key: 'INVALID_SIGNATURE',
    en: 'INVALID_SIGNATURE',
    ar: 'توقيع غير صالح',
    ku: 'واژۆی نادروست'
  },
  {
    key: 'PROCESSED',
    en: 'PROCESSED',
    ar: 'تمت المعالجة',
    ku: 'جێبەجێکراوە'
  },
  {
    key: 'Isolated Development Mode',
    en: 'Isolated Development Mode',
    ar: 'وضع التطوير المنعزل',
    ku: 'دۆخی تاقیکردنەوەی ناوخۆیی'
  },
  {
    key: 'Maintenance Vendor',
    en: 'Maintenance Vendor',
    ar: 'مقاول صيانة',
    ku: 'خزمەتگوزار (وەستا / دابینکەر)'
  },
  {
    key: 'Role:',
    en: 'Role:',
    ar: 'الدور:',
    ku: 'ڕۆڵ:'
  },
  {
    key: 'Capability:',
    en: 'Capability:',
    ar: 'القدرة:',
    ku: 'توانست:'
  },
  {
    key: 'Plumbing',
    en: 'Plumbing',
    ar: 'السباكة',
    ku: 'بۆڕیکاری و ئاوەڕۆ'
  },
  {
    key: 'Electrical',
    en: 'Electrical',
    ar: 'الكهرباء',
    ku: 'کارەبا'
  },
  {
    key: 'HVAC',
    en: 'HVAC',
    ar: 'التكييف والتهوية',
    ku: 'گەرمکەرەوە و فێنککەرەوە'
  },
  {
    key: 'Appliances',
    en: 'Appliances',
    ar: 'الأجهزة المنزلية',
    ku: 'ئامێرە کارەباییەکان'
  },
  {
    key: 'Structural',
    en: 'Structural',
    ar: 'الأبواب والنوافذ والجدران',
    ku: 'دەرگا، پەنجەرە، دیوارەکان'
  },
  {
    key: 'Pest Control',
    en: 'Pest Control',
    ar: 'مكافحة الحشرات',
    ku: 'قڕکەر و مێروو'
  },
  {
    key: 'Other',
    en: 'Other',
    ar: 'أخرى',
    ku: 'هیتر'
  },
  {
    key: 'Low',
    en: 'Low',
    ar: 'منخفض',
    ku: 'نزم'
  },
  {
    key: 'Medium',
    en: 'Medium',
    ar: 'متوسط',
    ku: 'مامناوەند'
  },
  {
    key: 'High',
    en: 'High',
    ar: 'مرتفع',
    ku: 'بەرز'
  },
  {
    key: 'Emergency',
    en: 'Emergency',
    ar: 'طوارئ',
    ku: 'فریاگوزاری'
  },
  {
    key: 'Submit Request',
    en: 'Submit Request',
    ar: 'إرسال الطلب',
    ku: 'ناردنی داواکاری'
  },
  {
    key: 'Total Revenue',
    en: 'Total Revenue',
    ar: 'إجمالي الإيرادات',
    ku: 'کۆی داهات'
  },
  {
    key: 'Total Expenses',
    en: 'Total Expenses',
    ar: 'إجمالي المصروفات',
    ku: 'کۆی خەرجییەکان'
  },
  {
    key: 'Pending Invoices',
    en: 'Pending Invoices',
    ar: 'الفواتير المعلقة',
    ku: 'پسوڵە هەڵپەسێردراوەکان'
  },
  {
    key: 'Reconciliation Status',
    en: 'Reconciliation Status',
    ar: 'حالة المطابقة',
    ku: 'پێداچوونەوە و هاوسەنگی'
  },
  {
    key: 'Account',
    en: 'Account',
    ar: 'الحساب',
    ku: 'هەژمار'
  },
  {
    key: 'Debit',
    en: 'Debit',
    ar: 'مدين',
    ku: 'قەرزدار (مەدین)'
  },
  {
    key: 'Credit',
    en: 'Credit',
    ar: 'دائن',
    ku: 'قەرزدەر (دائین)'
  },
  {
    key: 'Post New Journal Entry',
    en: 'Post New Journal Entry',
    ar: 'ترحيل قيد يومية جديد',
    ku: 'تۆمارکردنی قەیدی ژمێریاری'
  },
  {
    key: 'Vendor Dashboard',
    en: 'Vendor Dashboard',
    ar: 'لوحة تحكم الفني والمقاول',
    ku: 'داشبۆردی دابینکەری خزمەتگوزاری'
  },
  {
    key: 'Property Owner',
    en: 'Property Owner',
    ar: 'مالك العقار',
    ku: 'خاوەنی موڵک'
  },
  {
    key: 'Real Estate Company',
    en: 'Real Estate Company',
    ar: 'شركة عقارية',
    ku: 'کۆمپانیای موڵک'
  },
  {
    key: 'Tenant',
    en: 'Tenant',
    ar: 'مستأجر',
    ku: 'کرێچی'
  },
  {
    key: 'Buyer Workspace',
    en: 'Buyer Workspace',
    ar: 'مساحة عمل المشتري',
    ku: 'پێگەی کاری کڕیار'
  },
  {
    key: 'No Data Available',
    en: 'No Data Available',
    ar: 'لا توجد بيانات متاحة حالياً',
    ku: 'هیچ زانیارییەک لەم کاتەدا بەردەست نییە'
  },
  {
    key: 'Cancel',
    en: 'Cancel',
    ar: 'إلغاء',
    ku: 'هەڵوەشاندنەوە'
  },
  {
    key: 'Back',
    en: 'Back',
    ar: 'رجوع',
    ku: 'گەڕانەوە'
  },
  {
    key: 'Next',
    en: 'Next',
    ar: 'التالي',
    ku: 'دواتر'
  },
  {
    key: 'Submit',
    en: 'Submit',
    ar: 'إرسال',
    ku: 'ناردن'
  },
  {
    key: 'Save',
    en: 'Save',
    ar: 'حفظ',
    ku: 'پاشەکەوتکردن'
  },
  {
    key: 'Continue',
    en: 'Continue',
    ar: 'متابعة',
    ku: 'بەردەوامبە'
  },
  {
    key: 'Refresh',
    en: 'Refresh',
    ar: 'تحديث',
    ku: 'نوێکردنەوە'
  },
  {
    key: 'Type',
    en: 'Type',
    ar: 'النوع',
    ku: 'جۆری موڵک'
  },
  {
    key: 'Name',
    en: 'Name',
    ar: 'الاسم',
    ku: 'ناو'
  },
  {
    key: 'Address',
    en: 'Address',
    ar: 'العنوان',
    ku: 'ناونیشان'
  },
  {
    key: 'City',
    en: 'City',
    ar: 'المدينة',
    ku: 'شار'
  },
  {
    key: 'Status',
    en: 'Status',
    ar: 'الحالة',
    ku: 'دۆخ'
  },
  {
    key: 'Date',
    en: 'Date',
    ar: 'التاريخ',
    ku: 'بەروار'
  },
  {
    key: 'Reference',
    en: 'Reference',
    ar: 'المرجع',
    ku: 'ژمارەی ئاماژە'
  },
  {
    key: 'Notes',
    en: 'Notes',
    ar: 'ملاحظات',
    ku: 'تێبینییەکان'
  },
  {
    key: 'Total',
    en: 'Total',
    ar: 'الإجمالي',
    ku: 'کۆی گشتی'
  },
  {
    key: 'Size',
    en: 'Size',
    ar: 'المساحة',
    ku: 'ڕووبەر'
  },
  {
    key: 'Health',
    en: 'Health',
    ar: 'الحالة التشغيلية',
    ku: 'تەندروستی'
  },
  {
    key: 'Units',
    en: 'Units',
    ar: 'الوحدات',
    ku: 'یەکەکان'
  },
  {
    key: 'Active',
    en: 'Active',
    ar: 'نشط',
    ku: 'چالاک'
  },
  {
    key: 'Draft',
    en: 'Draft',
    ar: 'مسودة',
    ku: 'ڕەشنووس'
  },
  {
    key: 'DRAFT',
    en: 'DRAFT',
    ar: 'مسودة',
    ku: 'ڕەشنووس'
  },
  {
    key: 'ACTIVE',
    en: 'ACTIVE',
    ar: 'نشط',
    ku: 'چالاک'
  },
  {
    key: 'VACANT',
    en: 'VACANT',
    ar: 'شاغر',
    ku: 'بەتاڵ'
  },
  {
    key: 'UNKNOWN',
    en: 'UNKNOWN',
    ar: 'غير معروف',
    ku: 'نەزانراو'
  },
  {
    key: 'Unknown',
    en: 'Unknown',
    ar: 'غير معروف',
    ku: 'نەزانراو'
  },
  {
    key: 'USD',
    en: 'USD ($)',
    ar: 'دولار أمريكي ($)',
    ku: 'دۆلاری ئەمریکی ($)'
  },
  {
    key: 'Sign Out',
    en: 'Sign Out',
    ar: 'تسجيل الخروج',
    ku: 'چوونەدەرەوە'
  },
  {
    key: 'Log Out',
    en: 'Log Out',
    ar: 'تسجيل الخروج',
    ku: 'دەرچوون'
  },
  {
    key: 'Trust & Compliance',
    en: 'Trust & Compliance',
    ar: 'الثقة والامتثال',
    ku: 'متمانە و پابەندبوون'
  },
  {
    key: 'Business Intelligence',
    en: 'Business Intelligence',
    ar: 'ذكاء الأعمال',
    ku: 'زیرەکی کار و بازرگانی'
  },
  {
    key: 'CRM & Marketplace',
    en: 'CRM & Marketplace',
    ar: 'إدارة علاقات العملاء والسوق',
    ku: 'بەڕێوەبردنی پەیوەندی کڕیاران و بازاڕ'
  },
  {
    key: 'Property Passport',
    en: 'Property Passport',
    ar: 'جواز العقار الرقمي',
    ku: 'پاسپۆرتی موڵک'
  },
  {
    key: 'Command Center',
    en: 'Command Center',
    ar: 'مركز العمليات والتحكم',
    ku: 'ناوەندی کۆنترۆڵ'
  },
  {
    key: 'Overview',
    en: 'Overview',
    ar: 'نظرة عامة',
    ku: 'پوختە'
  },
  {
    key: 'Tasks',
    en: 'Tasks',
    ar: 'المهام',
    ku: 'ئەرکەکان'
  },
  {
    key: 'Documents',
    en: 'Documents',
    ar: 'المستندات',
    ku: 'بەڵگەنامەکان'
  },
  {
    key: 'Timeline',
    en: 'Timeline',
    ar: 'المخطط الزمني',
    ku: 'مێژووی ڕووداوەکان'
  },
  {
    key: 'Verified',
    en: 'Verified',
    ar: 'موثق',
    ku: 'پشتڕاستکراوەتەوە'
  },
  {
    key: 'Pending',
    en: 'Pending',
    ar: 'معلق',
    ku: 'چاوەڕوانکراو'
  },
  {
    key: 'Completed',
    en: 'Completed',
    ar: 'مكتمل',
    ku: 'تەواوکراوە'
  },
  {
    key: 'Cancelled',
    en: 'Cancelled',
    ar: 'ملغي',
    ku: 'هەڵوەشێنراوەتەوە'
  },
  {
    key: 'English',
    en: 'English',
    ar: 'الإنجليزية (English)',
    ku: 'English (ئینگلیزی)'
  },
  {
    key: 'No active maintenance requests.',
    en: 'No active maintenance requests.',
    ar: 'لا توجد طلبات صيانة نشطة.',
    ku: 'هیچ داواکارییەکی چاکسازی چالاک نییە.'
  },
  {
    key: 'Authentication is not configured. Select a test persona to view the UI.',
    en: 'Authentication is not configured. Select a test persona to view the UI.',
    ar: 'المصادقة غير مهيأة. اختر شخصية اختبار لعرض واجهة المستخدم.',
    ku: 'چوونەژوورەوەی ڕاستەقینە دیاری نەکراوە. کەسایەتییەکی تاقیکاری هەڵبژێرە بۆ گەڕان لە بەشەکانی پلاتفۆرمدا.'
  },
  {
    key: 'Operations dependent on this provider have been safely paused. No data has been lost or fabricated.',
    en: 'Operations dependent on this provider have been safely paused. No data has been lost or fabricated.',
    ar: 'تم إيقاف العمليات المعتمدة على هذا المزود بأمان. لم تفقد أي بيانات.',
    ku: 'کردارەکانی پەیوەست بەم دابینکەرە بە پارێزراوی ڕاگیراون. هیچ زانیارییەک لەدەست نەچووە.'
  },
  {
    key: 'Reference No.',
    en: 'Reference No.',
    ar: 'الرقم المرجعي',
    ku: 'ژمارەی ئاماژە'
  },
  {
    key: 'Manage service requests, quotes, and work orders.',
    en: 'Manage service requests, quotes, and work orders.',
    ar: 'إدارة طلبات الخدمة وعروض الأسعار وأوامر العمل.',
    ku: 'بەڕێوەبردنی داواکارییەکانی خزمەتگوزاری، نرخدان و فەرمانەکانی کار.'
  },
  {
    key: 'This feature is currently unavailable or pending integration.',
    en: 'This feature is currently unavailable or pending integration.',
    ar: 'هذه الميزة غير متاحة حالياً أو قيد التكامل.',
    ku: 'ئەم تایبەتمەندییە لە ئێستادا بەردەست نییە یان چاوەڕوانی یەکخستنە.'
  },
  {
    key: 'This module has not been fully configured with real data sources yet.',
    en: 'This module has not been fully configured with real data sources yet.',
    ar: 'لم تتم تهيئة هذا الجزء بالكامل مع مصادر البيانات الحقيقية بعد.',
    ku: 'ئەم بەشە هێشتا بە تەواوی دانەمەزراوە لەگەڵ داتابەیسی سەرەکی.'
  },
  {
    key: 'Loading...',
    en: 'Loading...',
    ar: 'جاري التحميل...',
    ku: 'باردەکرێت...'
  },
  {
    key: 'Loading properties...',
    en: 'Loading properties...',
    ar: 'جاري تحميل العقارات...',
    ku: 'موڵکەکان باردەکرێن...'
  },
  {
    key: 'No properties found in your portfolio.',
    en: 'No properties found in your portfolio.',
    ar: 'لم يتم العثور على أي عقارات في محفظتك.',
    ku: 'هیچ موڵکێک لە پۆرتفۆلیۆکەتدا نەدۆزرایەوە.'
  },
  {
    key: 'No AI insights available at this time.',
    en: 'No AI insights available at this time.',
    ar: 'لا توجد رؤى ذكاء اصطناعي متاحة حالياً.',
    ku: 'لە ئێستادا هیچ تێڕوانینێکی ژیری دەستکرد بەردەست نییە.'
  },
  {
    key: 'AI insights do not execute actions automatically.',
    en: 'AI insights do not execute actions automatically.',
    ar: 'رؤى الذكاء الاصطناعي لا تنفذ الإجراءات تلقائياً.',
    ku: 'تێڕوانینەکانی ژیری دەستکرد کرداری خۆکار ئەنجام نادەن بەبێ پەسەندکردنی تۆ.'
  }
];

fs.writeFileSync(
  path.join(process.cwd(), 'tests', 'new-translations-map.json'),
  JSON.stringify(newTranslations, null, 2),
  'utf-8'
);
console.log(`Generated ${newTranslations.length} complete translations!`);

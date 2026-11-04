import * as fs from 'fs';
import * as path from 'path';

// Complete dictionary of translations to correct or add across en, ar, and ku
export const translationDictionary: Record<string, { en: string; ar: string; ku: string }> = {
  'company.fully_managed_only': {
    en: 'Fully Managed only',
    ar: 'في نموذج الإدارة الكاملة فقط',
    ku: 'تەنها لە مۆدێلی بەڕێوەبردنی تەواودا'
  },
  'company.rent_fee': {
    en: 'Rent Fee',
    ar: 'رسوم التأجير',
    ku: 'تێچووی بەکرێدان'
  },
  'company.status_error': {
    en: 'Reconciliation Unavailable',
    ar: 'بيانات المطابقة غير متاحة',
    ku: 'داتای هاوسەنگی بەردەست نییە'
  },
  'company.status_loading': {
    en: 'Verifying Reconciliation...',
    ar: 'جارٍ التحقق من المطابقة...',
    ku: 'لە پشکنینی هاوسەنگیدایە...'
  },
  'company.status_no_data': {
    en: 'No Financial Activity',
    ar: 'لا يوجد نشاط مالي',
    ku: 'هیچ چالاکییەکی دارایی نییە'
  },
  'company.status_pending': {
    en: 'Pending Ledger Posting',
    ar: 'بانتظار الترحيل إلى دفتر الأستاذ',
    ku: 'لە چاوەڕوانی تۆمارکردنی دەفتەردایە'
  },
  'company.status_unreconciled': {
    en: 'Reconciliation Discrepancy',
    ar: 'وجود فارق في المطابقة',
    ku: 'ناهەوسەنگی لە دەفتەردا هەیە'
  },
  'pricing.management': {
    en: 'Management',
    ar: 'الإدارة',
    ku: 'بەڕێوەبردن'
  },
  'pricing.standard_rate': {
    en: 'Standard',
    ar: 'قياسي',
    ku: 'ستاندارد / ئاسایی'
  },
  'property.model.agent_listed': {
    en: 'Agent-Listed, Platform-Managed',
    ar: 'مدرج عبر وكيل، مدار عبر المنصة',
    ku: 'لیستکراو لەلایەن بریکار، بەڕێوەبراو لەلایەن پلاتفۆرم'
  },
  'property.model.agent_operated': {
    en: 'Agent-Operated',
    ar: 'مدار بالكامل عبر الوكيل',
    ku: 'بەڕێوەبراو لەلایەن بریکار'
  },
  'property.model.fully_managed': {
    en: 'Fully Managed',
    ar: 'إدارة كاملة',
    ku: 'بەڕێوەبردنی تەواو'
  },
  // Missing in code
  'admin.instant_bypass_btn': {
    en: 'Enter as Platform Admin (Development Bypass)',
    ar: 'الدخول كمسؤول النظام (تخطي التطوير)',
    ku: 'چوونەژوورەوە وەک بەڕێوەبەری سەرەکی (تێپەڕاندنی گەشەپێدان)'
  },
  'workspace.company': {
    en: 'Company Workspace',
    ar: 'مساحة عمل الشركة',
    ku: 'شوێنی کاری کۆمپانیا'
  },
  'common.no_data': {
    en: 'No Lease Records',
    ar: 'لا توجد سجلات عقود',
    ku: 'هیچ تۆمارێکی گرێبەست نییە'
  },
  'tenant.noLeaseDesc': {
    en: 'Please contact support or browse available properties.',
    ar: 'يرجى الاتصال بالدعم الفني أو تصفح العقارات المتاحة.',
    ku: 'تکایە پەیوەندی بە پشتگیری بکە یان سەیری موڵکە بەردەستەکان بکە.'
  },
  'common.browse_properties': {
    en: 'Browse Properties',
    ar: 'تصفح العقارات',
    ku: 'گەڕان بەناو موڵکەکاندا'
  },

  // Admin
  'admin.footer_note': {
    en: 'HomeHub Real Estate Enterprise Platform • Kurdistan • Admin Management Portal',
    ar: 'منصة هومهب العقارية المتطورة • كوردستان • بوابة إدارة النظام',
    ku: 'پلاتفۆرمی پێشکەوتووی خانووبەرەی هۆمهەب • کوردستان • دەروازەی بەڕێوەبەرایەتی سەرەکی'
  },
  'admin.trust_disputes': {
    en: 'Trust & Disputes',
    ar: 'الثقة والنزاعات',
    ku: 'متمانە و ناکۆکییەکان'
  },

  // Agent
  'agent.table.actions': {
    en: 'Actions',
    ar: 'الإجراءات',
    ku: 'کردارەکان'
  },
  'agent.table.address': {
    en: 'Location & Address',
    ar: 'الموقع والعنوان',
    ku: 'شوێن و ناونیشان'
  },
  'agent.table.leads_offers': {
    en: 'Agency Assignment',
    ar: 'تفويض الوكالة',
    ku: 'سپاردنی نوێنەرایەتی'
  },
  'agent.table.price_rent': {
    en: 'Price / Rent',
    ar: 'السعر / الإيجار',
    ku: 'نرخ / کرێ'
  },
  'agent.table.property': {
    en: 'Property',
    ar: 'العقار',
    ku: 'موڵک'
  },
  'agent.table.status': {
    en: 'Status',
    ar: 'الحالة',
    ku: 'دۆخ'
  },
  'agent.tabs.commissions': {
    en: 'Commissions',
    ar: 'العمولات والمستحقات',
    ku: 'کارمەزد و شایستەکان'
  },
  'agent.tabs.leads': {
    en: 'Leads CRM',
    ar: 'إدارة العملاء المحتملين',
    ku: 'کڕیارە چاوەڕوانکراوەکان (CRM)'
  },
  'agent.tabs.listings': {
    en: 'Listings',
    ar: 'العقارات المعروضة',
    ku: 'لیستی موڵکەکان'
  },
  'agent.tabs.offers': {
    en: 'Offers',
    ar: 'العروض',
    ku: 'پێشنیارەکان'
  },
  'agent.tabs.portfolio': {
    en: 'Assigned Portfolio',
    ar: 'المحفظة الموكلة',
    ku: 'پۆرتفۆلیۆی سپێردراو'
  },
  'agent.tabs.viewings': {
    en: 'Viewings & Inspections',
    ar: 'المعاينات والزيارات',
    ku: 'بینین و سەردانەکان'
  },

  // Auth
  'auth.reg.social_apple': {
    en: 'Apple login is prepared for platform local development.',
    ar: 'تسجيل الدخول عبر Apple مهيأ للبيئة المحلية للمنصة.',
    ku: 'چوونەژوورەوە بە Apple لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'
  },
  'auth.reg.social_facebook': {
    en: 'Facebook login is prepared for platform local development.',
    ar: 'تسجيل الدخول عبر Facebook مهيأ للبيئة المحلية للمنصة.',
    ku: 'چوونەژوورەوە بە Facebook لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'
  },
  'auth.reg.social_google': {
    en: 'Google login is prepared for platform local development.',
    ar: 'تسجيل الدخول عبر Google مهيأ للبيئة المحلية للمنصة.',
    ku: 'چوونەژوورەوە بە Google لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'
  },

  // Category
  'category.electrical': {
    en: 'Electrical',
    ar: 'كهرباء',
    ku: 'کارەبایی'
  },
  'category.hvac': {
    en: 'HVAC & Cooling',
    ar: 'التكييف والتهوية',
    ku: 'ساردکەرەوە و گەرمکەرەوە (HVAC)'
  },
  'category.plumbing': {
    en: 'Plumbing & Drainage',
    ar: 'السباكة والصرف الصحي',
    ku: 'بۆری و ئاوەڕۆ'
  },
  'category.structural': {
    en: 'Carpentry & Structural',
    ar: 'النجارة والهيكل الإنشائي',
    ku: 'دارتاشی و پێکهاتەیی'
  },

  // Company Profile & CRM
  'company.back_to_marketplace': {
    en: 'Back to Marketplace',
    ar: 'العودة إلى السوق العقاري',
    ku: 'گەڕانەوە بۆ بازاڕی خانووبەرە'
  },
  'company.badge_for_rent': {
    en: 'For Rent',
    ar: 'للإيجار',
    ku: 'بۆ کرێ'
  },
  'company.badge_for_sale': {
    en: 'For Sale',
    ar: 'للبيع',
    ku: 'بۆ فرۆشتن'
  },
  'company.city_fallback': {
    en: 'Erbil',
    ar: 'أربيل',
    ku: 'هەولێر'
  },
  'company.country_fallback': {
    en: 'Kurdistan, Iraq',
    ar: 'كوردستان، العراق',
    ku: 'کوردستان، عێراق'
  },
  'company.for_rent_title': {
    en: 'Properties For Rent',
    ar: 'عقارات متاحة للإيجار',
    ku: 'موڵکەکانی بەردەست بۆ کرێ'
  },
  'company.for_sale_title': {
    en: 'Properties For Sale',
    ar: 'عقارات للبيع',
    ku: 'موڵکەکان بۆ فرۆشتن'
  },
  'company.listings_count': {
    en: 'Listings',
    ar: 'عقار',
    ku: 'موڵک'
  },
  'company.no_rentals': {
    en: 'No rental properties are currently listed by this company.',
    ar: 'لا توجد عقارات للإيجار حالياً لدى هذه الشركة.',
    ku: 'هیچ موڵکێکی کرێ لەم کاتەدا لەلایەن ئەم کۆمپانیایەوە بەردەست نییە.'
  },
  'company.no_sales': {
    en: 'No sale properties available.',
    ar: 'لا توجد عقارات للبيع حالياً.',
    ku: 'هیچ موڵکێکی فرۆشتن بەردەست نییە.'
  },
  'company.per_month': {
    en: '/ month',
    ar: '/ شهرياً',
    ku: '/ مانگانە'
  },
  'company.verified_badge': {
    en: 'Verified Agency',
    ar: 'شركة موثقة',
    ku: 'کۆمپانیای پشتڕاستکراو'
  },
  'company.view_details': {
    en: 'View Details',
    ar: 'عرض التفاصيل',
    ku: 'بینینی وردەکارییەکان'
  },
  'company.not_found': {
    en: 'Company profile not found.',
    ar: 'لم يتم العثور على ملف الشركة.',
    ku: 'پڕۆفایلی کۆمپانیا نەدۆزرایەوە.'
  },
  'company.loading': {
    en: 'Loading company profile...',
    ar: 'جارٍ تحميل ملف الشركة...',
    ku: 'پڕۆفایلی کۆمپانیا باردەکرێت...'
  },
  'company.error_prefix': {
    en: 'Error:',
    ar: 'خطأ:',
    ku: 'هەڵە:'
  },
  'company.team_desc': {
    en: 'Assign properties and designate roles (Manager, Agent).',
    ar: 'تعيين العقارات وتحديد الأدوار (مدير، وكيل).',
    ku: 'سپاردنی موڵکەکان و دیاریکردنی ڕۆڵەکان (بەڕێوەبەر، بریکار).'
  },
  'company.team_members': {
    en: 'Company Team Members',
    ar: 'أعضاء فريق الشركة',
    ku: 'ئەندامانی تیمی کۆمپانیا'
  },
  'company.tenants': {
    en: 'Tenants',
    ar: 'المستأجرين',
    ku: 'کرێنشینەکان'
  },
  'company.trusted_management': {
    en: 'Trusted Real Estate Management',
    ar: 'إدارة عقارية موثوقة',
    ku: 'بەڕێوەبردنی جێی متمانەی خانووبەرە'
  },
  'company.unnamed_company': {
    en: 'HomeHub Real Estate Agency',
    ar: 'وكالة هومهب العقارية',
    ku: 'ئاژانسی هۆمهەب بۆ خانووبەرە'
  },
  'company.view_all': {
    en: 'View All',
    ar: 'عرض الكل',
    ku: 'بینینی هەموویان'
  },
  'company.view_profile': {
    en: 'View Profile',
    ar: 'عرض الملف الشخصي',
    ku: 'بینینی پرۆفایل'
  },

  // CRM Unique items from bad block
  'crm.addContactTitle': {
    en: 'Add New Contact',
    ar: 'إضافة جهة اتصال جديدة',
    ku: 'زیادکردنی کڕیاری نوێ'
  },
  'crm.buyer': {
    en: 'Buyer',
    ar: 'مشتري',
    ku: 'کڕیار'
  },
  'crm.cancel': {
    en: 'Cancel',
    ar: 'إلغاء',
    ku: 'پاشگەزبوونەوە'
  },
  'crm.close': {
    en: 'Close',
    ar: 'إغلاق',
    ku: 'داخستن'
  },
  'crm.conversations': {
    en: 'Conversations',
    ar: 'المحادثات',
    ku: 'گفتوگۆکان'
  },
  'crm.directMessages': {
    en: 'Direct Messages',
    ar: 'الرسائل المباشرة',
    ku: 'نامە ڕاستەوخۆکان'
  },
  'crm.email': {
    en: 'Email',
    ar: 'البريد الإلكتروني',
    ku: 'ئیمەیڵ'
  },
  'crm.firstName': {
    en: 'First Name',
    ar: 'الاسم الأول',
    ku: 'ناوی یەکەم'
  },
  'crm.lastName': {
    en: 'Last Name',
    ar: 'اسم العائلة',
    ku: 'ناوی باوک / نازناو'
  },
  'crm.notes': {
    en: 'Notes',
    ar: 'ملاحظات',
    ku: 'تێبینییەکان'
  },
  'crm.ownerEmail': {
    en: 'Owner Email',
    ar: 'بريد المالك',
    ku: 'ئیمەیڵی خاوەن موڵک'
  },
  'crm.phone': {
    en: 'Phone (+964)',
    ar: 'الهاتف (+964)',
    ku: 'ژمارەی مۆبایل (+964)'
  },
  'crm.propertyName': {
    en: 'Property Name',
    ar: 'اسم العقار',
    ku: 'ناوی موڵک'
  },
  'crm.proposalNotice': {
    en: 'Proposals must follow company operating models and policies.',
    ar: 'يجب أن تتبع المقترحات نماذج وسياسات تشغيل الشركة.',
    ku: 'پێشنیارەکان دەبێت پابەندی مۆدێلەکانی کارکردن و ڕێنماییەکانی کۆمپانیا بن.'
  },
  'crm.proposalTitle': {
    en: 'Management Proposal',
    ar: 'مقترح الإدارة',
    ku: 'پێشنیاری بەڕێوەبردن'
  },
  'crm.prospect': {
    en: 'Prospect',
    ar: 'عميل محتمل',
    ku: 'کڕیاری چاوەڕوانکراو'
  },
  'crm.quietEnd': {
    en: 'Quiet Hours End',
    ar: 'نهاية ساعات الهدوء',
    ku: 'کۆتایی کاتژمێرەکانی بێدەنگی'
  },
  'crm.quietHours': {
    en: 'Quiet Hours',
    ar: 'ساعات الهدوء',
    ku: 'کاتژمێرەکانی بێدەنگی'
  },
  'crm.quietHoursDesc': {
    en: 'Non-urgent notifications will be muted during this period.',
    ar: 'سيتم كتم الإشعارات غير العاجلة خلال هذه الفترة.',
    ku: 'ئاگادارییە ناپەلەکان لەم ماوەیەدا دەنگ نابیسن.'
  },
  'crm.quietStart': {
    en: 'Quiet Hours Start',
    ar: 'بداية ساعات الهدوء',
    ku: 'دەستپێکی کاتژمێرەکانی بێدەنگی'
  },
  'crm.relationship': {
    en: 'Relationship',
    ar: 'طبيعة العلاقة',
    ku: 'جۆری پەیوەندی'
  },
  'crm.save': {
    en: 'Save',
    ar: 'حفظ',
    ku: 'پاشەکەوتکردن'
  },
  'crm.savePreferences': {
    en: 'Save Preferences',
    ar: 'حفظ التفضيلات',
    ku: 'پاشەکەوتکردنی هەڵبژاردنەکان'
  },
  'crm.send': {
    en: 'Send',
    ar: 'إرسال',
    ku: 'ناردن'
  },
  'crm.sendProposal': {
    en: 'Send Proposal',
    ar: 'إرسال المقترح',
    ku: 'ناردنی پێشنیار'
  },
  'crm.spendingLimit': {
    en: 'Spending Limit ($ / IQD)',
    ar: 'حد الإنفاق المسموح',
    ku: 'ئاستی خەرجی ڕێگەپێدراو'
  },
  'crm.tenant': {
    en: 'Tenant',
    ar: 'مستأجر',
    ku: 'کرێنشین'
  },
  'crm.typeReply': {
    en: 'Type your message...',
    ar: 'اكتب رسالتك هنا...',
    ku: 'پەیامەکەت لێرە بنووسە...'
  },
  'crm.vendor': {
    en: 'Vendor / Contractor',
    ar: 'مزود خدمة / مقاول',
    ku: 'پێشکەشکاری خزمەتگوزاری / بەڵێندەر'
  },
  'crm.allCaughtUp': {
    en: 'All caught up!',
    ar: 'كل شيء محدث!',
    ku: 'هەموو شتێک نوێکراوەتەوە!'
  },
  'crm.allCaughtUpDesc': {
    en: 'No unread notifications at this time.',
    ar: 'لا توجد إشعارات غير مقروءة حالياً.',
    ku: 'هیچ ئاگادارییەکی نەخوێندراوە لەم کاتەدا نییە.'
  },

  // Deduction
  'deduction.approve_btn': {
    en: 'Approve',
    ar: 'الموافقة على الخصم',
    ku: 'پەسەندکردنی بڕین'
  },
  'deduction.category': {
    en: 'Category',
    ar: 'الفئة',
    ku: 'پۆلێن'
  },
  'deduction.confirm_rejection': {
    en: 'Confirm Rejection',
    ar: 'تأكيد الرفض',
    ku: 'پشتڕاستکردنەوەی ڕەتکردنەوە'
  },
  'deduction.desc_evidence': {
    en: 'Deduction Description & Repair Evidence',
    ar: 'وصف الخصم وأدلة الإصلاح',
    ku: 'وەسفی بڕین و بەڵگەی چاککردنەوە'
  },
  'deduction.desc_ph': {
    en: 'Explain rationale, repair estimates, or contractor invoice details...',
    ar: 'اشرح أسباب الخصم، تقديرات تكلفة الإصلاح أو تفاصيل فاتورة المقاول...',
    ku: 'هۆکاری بڕین، خەمڵاندنی تێچووی چاککردنەوە یان پسوولەی بەڵێندەر ڕوونبکەرەوە...'
  },
  'deduction.evidence_ref': {
    en: 'Evidence Reference',
    ar: 'مرجع الإثبات',
    ku: 'سەرچاوەی بەڵگە'
  },
  'deduction.link_item': {
    en: 'Link to Inspection Item',
    ar: 'ربط ببند الفحص',
    ku: 'بەستنەوە بە خاڵی پشکنین'
  },
  'deduction.no_records': {
    en: 'No proposed deductions recorded.',
    ar: 'لا توجد خصومات مقترحة مسجلة.',
    ku: 'هیچ بڕینێکی پێشنیارکراو تۆمار نەکراوە.'
  },
  'deduction.none_general': {
    en: 'General / Unlinked to Inspection',
    ar: 'عام / غير مرتبط ببند فحص',
    ku: 'گشتی / بەبێ پەیوەندی بە پشکنین'
  },
  'deduction.notice_status': {
    en: 'Deduction Status Notice',
    ar: 'إشعار حالة الخصم',
    ku: 'ئاگاداری دۆخی بڕین'
  },
  'deduction.notify_tenant': {
    en: 'Notify Tenant',
    ar: 'إشعار المستأجر',
    ku: 'ئاگادارکردنەوەی کرێنشین'
  },
  'deduction.owner_req': {
    en: 'Owner Deduction Request',
    ar: 'طلب المالك للخصم من التأمين',
    ku: 'داواکاری خاوەن موڵک بۆ بڕین لە بارمتە'
  },
  'deduction.propose_title': {
    en: 'Propose Security Deposit Deduction',
    ar: 'اقتراح خصم من مبلغ التأمين',
    ku: 'پێشنیارکردنی بڕین لە بارمتەی دڵنیایی'
  },
  'deduction.reason_label': {
    en: 'Deduction Reason',
    ar: 'سبب الخصم',
    ku: 'هۆکاری بڕین'
  },
  'deduction.reject_btn': {
    en: 'Reject Proposal',
    ar: 'رفض اقتراح الخصم',
    ku: 'ڕەتکردنەوەی پێشنیاری بڕین'
  },
  'deduction.reject_ph': {
    en: 'Provide reason for rejecting this proposed deduction...',
    ar: 'اذكر سبب رفض هذا الخصم المقترح...',
    ku: 'هۆکاری ڕەتکردنەوەی ئەم پێشنیاری بڕینە بنووسە...'
  },
  'deduction.reject_proposal_title': {
    en: 'Reject Deduction Proposal',
    ar: 'رفض اقتراح الخصم',
    ku: 'ڕەتکردنەوەی پێشنیاری بڕین'
  },
  'deduction.rejection_reason_label': {
    en: 'Rejection Reason',
    ar: 'سبب الرفض',
    ku: 'هۆکاری ڕەتکردنەوە'
  },
  'deduction.submit_proposal': {
    en: 'Submit Deduction Proposal',
    ar: 'إرسال مقترح الخصم',
    ku: 'ناردنی پێشنیاری بڕین'
  },
  'deduction.subtitle': {
    en: 'Manage and propose security deposit deductions based on move-out inspections',
    ar: 'إدارة واقتراح الخصومات من التأمين بناءً على فحص إخلاء العقار',
    ku: 'بەڕێوەبردن و داواکردنی بڕین لە بارمتە لەسەر بنەمای پشکنینی دەرچوون'
  },
  'deduction.tenant_dispute_active': {
    en: 'Tenant disputed this deduction (under review)',
    ar: 'المستأجر اعترض على هذا الخصم (قيد النزاع)',
    ku: 'کرێنشین تانەی لەم بڕینە داوە (لە ژێر لێکۆڵینەوەدایە)'
  },
  'deduction.window_unstarted': {
    en: 'Dispute window has not started',
    ar: 'فترة الاعتراض لم تبدأ بعد',
    ku: 'ماوەی تانەدان دەستی پێنەکردووە'
  },

  // Deposit
  'deposit.active_reservations_warn': {
    en: 'Active reservations ({amount}) must be resolved or settled before full release.',
    ar: 'المبالغ المحجوزة حالياً ({amount}) يجب تسويتها قبل الإفراج الكامل.',
    ku: 'بڕی دانراوی چالاک ({amount}) دەبێت یەکلایی بکرێتەوە پێش گەڕاندنەوەی تەواو.'
  },
  'deposit.active_reserved': {
    en: 'Active Reserved',
    ar: 'المبلغ المحجوز النشط',
    ku: 'بڕی دەستبەسەرکراوی چالاک'
  },
  'deposit.amount_to_collect': {
    en: 'Amount to Collect',
    ar: 'المبلغ المطلوب تحصيله',
    ku: 'بڕی وەرگرتن'
  },
  'deposit.amount_to_release': {
    en: 'Amount to Release',
    ar: 'المبلغ المسترد',
    ku: 'بڕی گەڕاندنەوە'
  },
  'deposit.deductions_held_note': {
    en: 'Deductions & disputes held',
    ar: 'الخصومات والنزاعات معلقة في حساب الضمان',
    ku: 'بڕین و ناکۆکییەکان لە هەژماری دەستبەسەردا دەمێننەوە'
  },
  'deposit.eligible_return_note': {
    en: 'Eligible for return to tenant following move-out settlement',
    ar: 'مستحق للإرجاع إلى المستأجر بعد تسوية فحص الإخلاء',
    ku: 'شایستەی گەڕاندنەوەیە بۆ کرێنشین لە دوای یەکلابوونەوەی پشکنین'
  },
  'deposit.escrow_recorded': {
    en: 'Escrow Recorded (Custodial)',
    ar: 'مسجل في حساب الضمان (Escrow)',
    ku: 'تۆمارکراوی هەژماری دەستبەسەر (Escrow)'
  },
  'deposit.escrow_standard_footer': {
    en: 'Security deposits are held securely in escrow and strictly separated from rental revenue.',
    ar: 'يتم الاحتفاظ بمبالغ التأمين بشكل آمن وفق الضوابط وبشكل منفصل تماماً عن إيرادات الإيجار.',
    ku: 'بارمتەی دڵنیایی بە شێوەیەکی پارێزراو بەپێی یاسا ڕادەگیرێت و جیاوازە لە داهاتی کرێ.'
  },
  'deposit.fixed_custodial_req': {
    en: 'Statutory Custodial Requirement',
    ar: 'متطلبات الضمان المالي الثابت',
    ku: 'مەرجی پێویستی بارمتەی یاسایی'
  },
  'deposit.held_no_fees': {
    en: 'Deposits are held without platform fee deduction (0% platform fee)',
    ar: 'يتم حفظ التأمين بدون خصم أي رسوم للمنصة (بنسبة 0%)',
    ku: 'بارمتە بە بێ کەمکردنەوەی هیچ کارمەزدێکی پلاتفۆرم دەپارێزرێت (ڕێژەی 0%)'
  },
  'deposit.required_deposit': {
    en: 'Required Deposit',
    ar: 'مبلغ التأمين المطلوب',
    ku: 'بارمتەی دڵنیایی پێویست'
  },
  'deposit.unreserved_available': {
    en: 'Available for Release',
    ar: 'المبلغ المتاح للإفراج غير المحجوز',
    ku: 'بەردەستی بێبەربەست بۆ گەڕاندنەوە'
  },

  // Fee Policy
  'fee.current_rate': {
    en: 'Persisted Current Rate',
    ar: 'النسبة الحالية المعتمدة',
    ku: 'ڕێژەی ئێستای تۆمارکراو'
  },
  'fee.err_invalid_number': {
    en: 'Rate must be a valid number',
    ar: 'يجب أن تكون النسبة رقماً صالحاً',
    ku: 'دەبێت ڕێژەکە ژمارەیەکی دروست بێت'
  },
  'fee.err_max': {
    en: 'Rate cannot exceed 50% (0.50)',
    ar: 'لا يمكن أن تتجاوز النسبة 50% (0.50)',
    ku: 'ڕێژەی کارمەزد ناتوانێت لە 50% (0.50) زیاتر بێت'
  },
  'fee.err_negative': {
    en: 'Rate cannot be negative',
    ar: 'لا يمكن أن تكون النسبة سالبة',
    ku: 'ڕێژەی کارمەزد ناتوانێت لە سفر کەمتر بێت'
  },
  'fee.err_precision': {
    en: 'Rate precision cannot exceed 4 decimal places',
    ar: 'دقة النسبة لا يمكن أن تتجاوز 4 خانات عشرية',
    ku: 'ڕێژەکە ناتوانێت لە چوار ژمارەی دوای کۆما زیاتر بێت'
  },
  'fee.err_required': {
    en: 'Fee rate is required',
    ar: 'تحديد النسبة مطلوب',
    ku: 'دیاریکردنی ڕێژەی کارمەزد پێویستە'
  },
  'fee.not_applicable': {
    en: 'Not Applicable (0%)',
    ar: 'غير منطبق (0%)',
    ku: 'پێوەندیدار نییە (0%)'
  },
  'fee.not_configured': {
    en: 'Not Configured',
    ar: 'غير مهيأ',
    ku: 'دیاری نەکراوە'
  },

  // Inspection
  'inspection.add_item': {
    en: 'Add Damage Item',
    ar: 'إضافة بند ضرر',
    ku: 'زیادکردنی خاڵی زیان'
  },
  'inspection.baseline_exists': {
    en: 'Move-In Baseline Exists',
    ar: 'فحص الدخول المرجعي متوفر',
    ku: 'پشکنینی سەرەتایی چوونەژوورەوە هەیە'
  },
  'inspection.baseline_ref': {
    en: 'Move-In Baseline Reference',
    ar: 'مرجع فحص الدخول',
    ku: 'سەرچاوەی پشکنینی سەرەتایی'
  },
  'inspection.complete_btn': {
    en: 'Complete Inspection',
    ar: 'إتمام الفحص',
    ku: 'تەواوکردنی پشکنین'
  },
  'inspection.component': {
    en: 'Component / Element',
    ar: 'المكون / العنصر',
    ku: 'بەش / پێکهاتە'
  },
  'inspection.condition': {
    en: 'Physical Condition',
    ar: 'الحالة المادية',
    ku: 'دۆخی فیزیکی'
  },
  'inspection.confirm_start': {
    en: 'Confirm & Start Inspection',
    ar: 'بدء الفحص رسمياً',
    ku: 'دەستپێکردنی فەرمی پشکنین'
  },
  'inspection.estimated_cost': {
    en: 'Estimated Repair Cost',
    ar: 'التكلفة التقديرية',
    ku: 'تێچووی خەمڵێنراو'
  },
  'inspection.evidence_count': {
    en: 'Evidence & Photos Count',
    ar: 'عدد الأدلة والصور',
    ku: 'ژمارەی بەڵگە و وێنەکان'
  },
  'inspection.evidence_ref': {
    en: 'Evidence Reference',
    ar: 'مرجع الإثبات',
    ku: 'سەرچاوەی بەڵگە'
  },
  'inspection.general_notes': {
    en: 'General Notes',
    ar: 'ملاحظات عامة',
    ku: 'تێبینییە گشتییەکان'
  },
  'inspection.general_notes_ph': {
    en: 'Enter general notes on property move-out condition...',
    ar: 'أدخل الملاحظات العامة حول حالة العقار عند الإخلاء...',
    ku: 'تێبینییەکان لەسەر دۆخی گشتی موڵک لە کاتی دەرچوون بنووسە...'
  },
  'inspection.initiate_title': {
    en: 'Initiate Move-Out Inspection',
    ar: 'بدء فحص إخلاء العقار',
    ku: 'دەستپێکردنی پشکنینی دەرچوونی موڵک'
  },
  'inspection.itemized_findings': {
    en: 'Itemized Findings & Observations',
    ar: 'الملاحظات والبنود المفصلة',
    ku: 'تێبینی و خاڵە تۆمارکراوەکان'
  },
  'inspection.no_records': {
    en: 'No inspection records found.',
    ar: 'لا توجد سجلات فحص مسجلة.',
    ku: 'هیچ تۆمارێکی پشکنین نەدۆزرایەوە.'
  },
  'inspection.record_item_title': {
    en: 'Record Damage or Component Status',
    ar: 'تسجيل بند ضرر أو حالة عنصر',
    ku: 'تۆمارکردنی زیان یان دۆخی بەشێک'
  },
  'inspection.records_desc': {
    en: 'Move-in baseline and move-out inspection history for this property.',
    ar: 'سجل فحوصات الاستلام والتسليم للعقار.',
    ku: 'مێژووی پشکنینەکانی چوونەژوورەوە و دەرچوون لەم موڵکەدا.'
  },
  'inspection.save_item': {
    en: 'Save Inspection Item',
    ar: 'حفظ بند الفحص',
    ku: 'پاشەکەوتکردنی خاڵی پشکنین'
  },
  'inspection.tenant_present': {
    en: 'Tenant was present during inspection',
    ar: 'المستأجر كان حاضراً أثناء الفحص',
    ku: 'کرێنشین لە کاتی پشکنین ئامادە بوو'
  },

  // Login
  'login.email_placeholder': {
    en: 'name@example.com',
    ar: 'name@example.com',
    ku: 'name@example.com'
  },

  // Marketplace
  'marketplace.badge.sponsored': {
    en: 'Sponsored',
    ar: 'مميز / برعاية',
    ku: 'سپۆنسەرکراو'
  },
  'marketplace.filter.reset_all': {
    en: 'Reset All',
    ar: 'إعادة ضبط الكل',
    ku: 'سڕینەوەی هەموو فلتەرەکان'
  },
  'marketplace.pagination.page_of': {
    en: 'Page {current} of {total}',
    ar: 'صفحة {current} من {total}',
    ku: 'پەڕەی {current} لە {total}'
  },
  'marketplace.sort.newest': {
    en: 'Newest',
    ar: 'الأحدث',
    ku: 'نوێترین'
  },
  'marketplace.sort.price_asc': {
    en: 'Price: Low to High',
    ar: 'السعر: من الأقل للأعلى',
    ku: 'نرخ: لە کەمەوە بۆ زۆر'
  },
  'marketplace.sort.price_desc': {
    en: 'Price: High to Low',
    ar: 'السعر: من الأعلى للأقل',
    ku: 'نرخ: لە زۆرەوە بۆ کەم'
  },
  'marketplace.sort.promoted': {
    en: 'Promoted',
    ar: 'مرقى بالنقاط',
    ku: 'پێشەنگکراو بە خاڵ'
  },

  // Owner
  'owner.accounting': {
    en: 'Accounting & Ledger',
    ar: 'المحاسبة والمالية',
    ku: 'ژمێریاری و دارایی'
  },
  'owner.action.settlements': {
    en: 'Settlements & Payouts',
    ar: 'التسويات والمستحقات',
    ku: 'شایستە و یەکلاییکردنەوەکان'
  },
  'owner.all_cities': {
    en: 'All Cities',
    ar: 'جميع المدن',
    ku: 'هەموو شارەکان'
  },
  'owner.all_status': {
    en: 'All Statuses',
    ar: 'جميع الحالات',
    ku: 'هەموو دۆخەکان'
  },
  'owner.analytics.avg_lease_duration': {
    en: 'Average Lease Duration',
    ar: 'متوسط مدة العقود',
    ku: 'تێکڕای ماوەی گرێبەستەکان'
  },
  'owner.analytics.based_confirmed_rent': {
    en: 'Based strictly on confirmed collected rent',
    ar: 'بناءً على الإيجار المحصل المؤكد فقط',
    ku: 'لەسەر بنەمای کرێی پشتڕاستکراوی وەرگیراو'
  },
  'owner.analytics.calculated_verified': {
    en: 'Calculated from verified lease agreements',
    ar: 'محسوبة بناءً على العقود الموثقة',
    ku: 'ژمێردراوە لەسەر گرێبەستە پشتڕاستکراوەکان'
  },
  'owner.analytics.collection_rate': {
    en: 'Rent Collection Rate',
    ar: 'معدل تحصيل الإيجار',
    ku: 'ڕێژەی کۆکردنەوەی کرێ'
  },
  'owner.analytics.confirmed_collections': {
    en: 'Total Confirmed Collections',
    ar: 'إجمالي الإيجار المحصل المؤكد',
    ku: 'کۆی کرێی وەرگیراوی پشتڕاستکراو'
  },
  'owner.analytics.gross_yield': {
    en: 'Gross Annual Yield',
    ar: 'العائد الإجمالي السنوي',
    ku: 'تێکڕای داهاتی ساڵانە'
  },
  'owner.analytics.no_active_leases': {
    en: 'No active leases currently recorded.',
    ar: 'لا توجد عقود إيجار نشطة حالياً.',
    ku: 'هیچ گرێبەستێکی چالاک لەم کاتەدا نییە.'
  },
  'owner.analytics.no_operational_revenue': {
    en: 'No confirmed operational rental revenue recorded yet.',
    ar: 'لم تسجل أي إيرادات إيجار مؤكدة بعد.',
    ku: 'هیچ داهاتێکی کرێی پشتڕاستکراو تۆمار نەکراوە.'
  },
  'owner.analytics.no_registered_props': {
    en: 'No properties registered under your ownership.',
    ar: 'لا توجد عقارات مسجلة باسمك.',
    ku: 'هیچ موڵکێک لە ژێر ناوی تۆدا تۆمار نەکراوە.'
  },
  'owner.analytics.noi': {
    en: 'Net Operating Income (NOI)',
    ar: 'صافي الدخل التشغيلي (NOI)',
    ku: 'داهاتی گشتی بەکارخستن (NOI)'
  },
  'owner.analytics.subtitle': {
    en: 'Detailed financial analytics derived strictly from confirmed collections.',
    ar: 'تحليلات مالية دقيقة مبنية فقط على المدفوعات المؤكدة.',
    ku: 'شیکاری دارایی ورد لەسەر بنەمای پارەدانە پشتڕاستکراوەکان.'
  },
  'owner.companies.approval_threshold': {
    en: 'Expense Approval Threshold',
    ar: 'حد الموافقة على المصروفات',
    ku: 'ئاستی پێویستی پەسەندکردنی خەرجی'
  },
  'owner.companies.assigned_prop': {
    en: 'Assigned Property',
    ar: 'العقار الموكل',
    ku: 'موڵکی سپێردراو'
  },
  'owner.companies.delegated_company': {
    en: 'Management Company',
    ar: 'شركة الإدارة الموكلة',
    ku: 'کۆمپانیای بەڕێوەبردن'
  },
  'owner.companies.direct_signoff': {
    en: 'Direct owner signoff required for expenses exceeding threshold',
    ar: 'توقيع المالك المباشر مطلوب للمصروفات التي تتجاوز الحد',
    ku: 'واژۆی ڕاستەوخۆی خاوەن موڵک بۆ خەرجی سەرووی سنور پێویستە'
  },
  'owner.companies.granted_perms': {
    en: 'Granted Authority',
    ar: 'الصلاحيات الممنوحة',
    ku: 'دەسەڵاتە بەخشراوەکان'
  },
  'owner.companies.name_or_license': {
    en: 'Company Name or License #',
    ar: 'اسم الشركة أو رقم الترخيص',
    ku: 'ناوی کۆمپانیا یان ژمارەی مۆڵەت'
  },
  'owner.companies.name_or_license_ph': {
    en: 'Search for licensed property management company...',
    ar: 'ابحث عن شركة إدارة مرخصة...',
    ku: 'گەڕان بەدوای کۆمپانیای مۆڵەتپێدراو...'
  },
  'owner.companies.owner_direct': {
    en: 'Direct Owner Management (Self-Operated)',
    ar: 'المالك يدير العقار مباشرة (بدون تفويض شركة)',
    ku: 'خاوەن موڵک بەڕێوەبەری ڕاستەوخۆیە (بەبێ کۆمپانیا)'
  },
  'owner.companies.select_prop_ph': {
    en: 'Select property...',
    ar: 'اختر العقار...',
    ku: 'موڵکێک هەڵبژێرە...'
  },
  'owner.companies.self_managed_props': {
    en: 'Self-Managed Properties',
    ar: 'العقارات المدارة ذاتياً',
    ku: 'موڵکە خۆبەڕێوەبراوەکان'
  },
  'owner.companies.send_invitation': {
    en: 'Send Delegation Request',
    ar: 'إرسال دعوة تفويض',
    ku: 'ناردنی داواکاری سپاردن'
  },
  'owner.companies.sending': {
    en: 'Sending...',
    ar: 'جارٍ الإرسال...',
    ku: 'دەنێردرێت...'
  },
  'owner.companies.spending_limit_hint': {
    en: 'Expenses above this limit strictly require direct owner signoff.',
    ar: 'المصروفات التي تتجاوز هذا الحد تتطلب موافقة المالك مسبقاً.',
    ku: 'ئەو خەرجیانەی لەم بڕە زیاترن پێویستیان بە پەسەندکردنی خاوەن موڵک دەبێت.'
  },
  'owner.companies.spending_limit_label': {
    en: 'Authorized Spending Limit ($ / IQD)',
    ar: 'حد الصرف المخول به ($ / دينار)',
    ku: 'ئاستی خەرجی دەسەڵاتدار ($ / د.ع)'
  },
  'owner.companies.valid_through': {
    en: 'Delegation Expiry Date',
    ar: 'تاريخ سريان التفويض',
    ku: 'بەرواری بەسەرچوونی سپاردن'
  },
  'owner.companies.zero_delegation': {
    en: 'No management companies currently delegated.',
    ar: 'لا توجد شركات إدارة مفوضة حالياً.',
    ku: 'هیچ کۆمپانیایەکی بەڕێوەبردن دیاری نەکراوە.'
  },
  'owner.documents.doc_title': {
    en: 'Document Title',
    ar: 'عنوان المستند',
    ku: 'ناونیشانی دۆکیومێنت'
  },
  'owner.documents.doc_title_ph': {
    en: 'e.g. Official Tapu Deed, Utility Contract...',
    ar: 'مثال: سند الطابو، فاتورة الكهرباء...',
    ku: 'بۆ نموونە: تاپۆی فەرمی، گرێبەستی کارەبا...'
  },
  'owner.documents.doc_type': {
    en: 'Document Type',
    ar: 'نوع المستند',
    ku: 'جۆری دۆکیومێنت'
  },
  'owner.documents.inspection_option': {
    en: 'Property Inspection Report',
    ar: 'تقرير فحص العقار',
    ku: 'ڕاپۆرتی پشکنینی موڵک'
  },
  'owner.documents.lease_option': {
    en: 'Lease Agreement',
    ar: 'عقد الإيجار',
    ku: 'گرێبەستی کرێداری'
  },
  'owner.documents.management_option': {
    en: 'Company Management Agreement',
    ar: 'اتفاقية إدارة الشركة',
    ku: 'ڕێککەوتنی بەڕێوەبردنی کۆمپانیا'
  },
  'owner.documents.select_file': {
    en: 'Select File',
    ar: 'اختر ملفاً',
    ku: 'فایلێک هەڵبژێرە'
  },
  'owner.documents.tapu_option': {
    en: 'Tapu Deed & Proof of Ownership',
    ar: 'سند الطابو وإثبات الملكية',
    ku: 'سەندی تاپۆ و سەلماندنی خاوەندارێتی'
  },
  'owner.documents.upload_btn': {
    en: 'Upload Document',
    ar: 'رفع المستند',
    ku: 'بەرزکردنەوەی بەڵگەنامە'
  },
  'owner.documents.uploading': {
    en: 'Uploading...',
    ar: 'جارٍ الرفع...',
    ku: 'بەرزدەکرێتەوە...'
  },
  'owner.kpi.overdue_payments': {
    en: 'Overdue Payments',
    ar: 'دفعات متأخرة',
    ku: 'پارەدانی دواکەوتوو'
  },
  'owner.leases.choose_property_ph': {
    en: 'Choose property for this lease...',
    ar: 'اختر العقار لهذا العقد...',
    ku: 'موڵکێک بۆ ئەم گرێبەستە هەڵبژێرە'
  },
  'owner.leases.col_actions': {
    en: 'Actions',
    ar: 'الإجراءات',
    ku: 'کردارەکان'
  },
  'owner.leases.col_dates': {
    en: 'Term Dates',
    ar: 'فترة العقد',
    ku: 'ماوەی گرێبەست'
  },
  'owner.leases.col_deposit': {
    en: 'Security Deposit',
    ar: 'التأمين',
    ku: 'بارمتە'
  },
  'owner.leases.col_property': {
    en: 'Property',
    ar: 'العقار',
    ku: 'موڵک'
  },
  'owner.leases.col_rent': {
    en: 'Monthly Rent',
    ar: 'الإيجار الشهري',
    ku: 'کرێی مانگانە'
  },
  'owner.leases.col_status': {
    en: 'Status',
    ar: 'الحالة',
    ku: 'دۆخ'
  },
  'owner.leases.col_tenant': {
    en: 'Tenant',
    ar: 'المستأجر',
    ku: 'کرێنشین'
  },
  'owner.leases.create_and_send': {
    en: 'Create & Send Lease',
    ar: 'إنشاء وإرسال العقد',
    ku: 'دروستکردن و ناردنی گرێبەست'
  },
  'owner.leases.creating': {
    en: 'Creating...',
    ar: 'جارٍ الإنشاء...',
    ku: 'دروست دەکرێت...'
  },
  'owner.leases.end_date': {
    en: 'End Date',
    ar: 'تاريخ الانتهاء',
    ku: 'بەرواری کۆتایی'
  },
  'owner.leases.fee_notice': {
    en: 'Notice: Platform fees apply dynamically upon confirmed rent collection.',
    ar: 'ملاحظة: رسوم المنصة تطبق فقط عند تأكيد تحصيل الإيجار.',
    ku: 'تێبینی: کارمەزدی پلاتفۆرم تەنها لە کاتی پشتڕاستکردنەوەی کرێدا هەژمار دەکرێت.'
  },
  'owner.leases.monthly_rent': {
    en: 'Monthly Rent ($ / IQD)',
    ar: 'الإيجار الشهري',
    ku: 'کرێی مانگانە ($ / د.ع)'
  },
  'owner.leases.security_deposit': {
    en: 'Security Deposit ($ / IQD)',
    ar: 'مبلغ التأمين',
    ku: 'بارمتەی دڵنیایی ($ / د.ع)'
  },
  'owner.leases.select_property': {
    en: 'Select Property',
    ar: 'اختر العقار',
    ku: 'موڵک هەڵبژێرە'
  },
  'owner.leases.start_date': {
    en: 'Start Date',
    ar: 'تاريخ البدء',
    ku: 'بەرواری دەستپێکردن'
  },
  'owner.leases.tenant_name_ph': {
    en: 'Full tenant name or mobile number...',
    ar: 'اسم المستأجر أو رقم الهاتف...',
    ku: 'ناوی تەواوی کرێنشین یان ژمارەی مۆبایل بنووسە'
  },
  'owner.maintenance.desc_label': {
    en: 'Issue Description',
    ar: 'وصف المشكلة',
    ku: 'وەسفی کێشەکە'
  },
  'owner.maintenance.desc_ph': {
    en: 'Provide details on required maintenance or repairs...',
    ar: 'اشرح تفاصيل المشكلة أو طلب الصيانة...',
    ku: 'وردەکاری چاککردنەوە یان کێشەکە ڕوونبکەرەوە...'
  },
  'owner.maintenance.issue_category': {
    en: 'Maintenance Category',
    ar: 'فئة الصيانة',
    ku: 'پۆلی چاککردنەوە'
  },
  'owner.maintenance.select_property': {
    en: 'Select Property',
    ar: 'حدد العقار',
    ku: 'موڵک دیاری بکە'
  },
  'owner.maintenance.select_property_ph': {
    en: 'Select the affected property...',
    ar: 'اختر العقار المعني...',
    ku: 'موڵکی پەیوەندیدار هەڵبژێرە...'
  },
  'owner.maintenance.submit_btn': {
    en: 'Submit Maintenance Request',
    ar: 'إرسال طلب الصيانة',
    ku: 'ناردنی داواکاری چاککردنەوە'
  },
  'owner.maintenance.submitting': {
    en: 'Submitting...',
    ar: 'جارٍ الإرسال...',
    ku: 'دەنێردرێت...'
  },
  'owner.maintenance.title_ph': {
    en: 'Brief summary of the issue...',
    ar: 'عنوان مختصر للمشكلة...',
    ku: 'ناونیشانی کورتی کێشەکە بنووسە'
  },
  'owner.management_label': {
    en: 'Operating Model:',
    ar: 'نموذج الإدارة:',
    ku: 'مۆدێلی بەڕێوەبردن:'
  },
  'owner.nav.reports': {
    en: 'Financial Reports',
    ar: 'التقارير المالية',
    ku: 'ڕاپۆرتە داراییەکان'
  },
  'owner.policy.fee': {
    en: 'Platform Fee:',
    ar: 'رسوم المنصة:',
    ku: 'کارمەزدی پلاتفۆرم:'
  },
  'owner.policy.net': {
    en: 'Net Owner Payable:',
    ar: 'صافي مستحقات المالك:',
    ku: 'شایستەی خاوەن موڵک (پاش کارمەزد):'
  },
  'owner.policy.tenant': {
    en: 'Tenant Paid (0% Surcharge):',
    ar: 'المدفوع من المستأجر (بدون أي زيادة):',
    ku: 'سەرچاوەی پارەدان: کرێنشین (بەبێ زیادەخەرجی):'
  },
  'owner.search_property_ph': {
    en: 'Search properties by name or address...',
    ar: 'ابحث في العقارات بالاسم أو العنوان...',
    ku: 'گەڕان لە موڵکەکان بەپێی ناو یان ناونیشان...'
  },

  // Payment Statuses
  'payment.status.cancelled': {
    en: 'Cancelled',
    ar: 'ملغى',
    ku: 'هەڵوەشاوەتەوە'
  },
  'payment.status.confirmed': {
    en: 'Collected & Confirmed',
    ar: 'محصل ومؤكد',
    ku: 'وەرگیراو و پشتڕاستکراو'
  },
  'payment.status.failed': {
    en: 'Failed',
    ar: 'فاشل',
    ku: 'شکستی هێناوە'
  },
  'payment.status.overdue': {
    en: 'Overdue',
    ar: 'متأخر عن السداد',
    ku: 'دواکەوتوو لە وادە'
  },
  'payment.status.partially_paid': {
    en: 'Partially Collected',
    ar: 'مدفوع جزئياً',
    ku: 'بەشێکی دراوە'
  },
  'payment.status.pending': {
    en: 'Pending Confirmation',
    ar: 'قيد التأكيد',
    ku: 'چاوەڕوانی پشتڕاستکردنەوەیە'
  },
  'payment.status.recorded': {
    en: 'Recorded',
    ar: 'مسجل',
    ku: 'تۆمارکراو'
  },
  'payment.status.refunded': {
    en: 'Refunded',
    ar: 'مسترد',
    ku: 'گەڕێندراوەتەوە'
  },
  'payment.status.reversed': {
    en: 'Reversed',
    ar: 'معكوس / ملغى',
    ku: 'هەڵگەڕاوەتەوە / پووچەڵکراو'
  },
  'payment.status.unknown': {
    en: 'Unknown Status',
    ar: 'حالة غير معروفة',
    ku: 'دۆخی نەزانراو'
  },
  'payment.status.upcoming': {
    en: 'Upcoming Schedule',
    ar: 'دفعة قادمة',
    ku: 'پارەدانی داهاتوو'
  },

  // Payout
  'payout.assign_lease': {
    en: 'Assign or activate a lease to track scheduled rent and owner payouts.',
    ar: 'قم بتعيين أو تفعيل عقد لتتبع الإيجار المجدول ومستحقات المالك.',
    ku: 'گرێبەستێک دیاریبکە بۆ چاودێریکردنی کرێی خشتەدار و شایستەی خاوەن موڵک.'
  },
  'payout.collections_appear': {
    en: 'Rent collections will appear here once confirmed in the system.',
    ar: 'ستظهر مبالغ الإيجار المحصلة هنا بمجرد تأكيدها في النظام.',
    ku: 'کرێی وەرگیراو لێرە دەردەکەوێت لە دوای پشتڕاستکردنەوە لە سیستەمدا.'
  },
  'payout.entitlement_recorded': {
    en: 'Net owner entitlement recorded',
    ar: 'تم تسجيل صافي استحقاق المالك',
    ku: 'شایستەی خاوەن موڵک تۆمارکراوە'
  },
  'payout.gateway_notice': {
    en: 'Disbursement gateway in pre-integration. Settlement payouts are managed via Owner Finances.',
    ar: 'بوابة الصرف قيد الإعداد. تتم إدارة المستحقات عبر قسم مالية المالك.',
    ku: 'دەروازەی خەرجکردن لە قۆناغی ئامادەکاریدایە. شایستەکان لە بەشی دارایی خاوەن موڵک بەڕێوەدەبرێن.'
  },
  'payout.no_active_lease': {
    en: 'No Active Lease Recorded',
    ar: 'لا يوجد عقد إيجار نشط مسجل',
    ku: 'هیچ گرێبەستێکی چالاک تۆمار نەکراوە'
  },
  'payout.none_awaiting': {
    en: 'No payouts currently awaiting disbursement.',
    ar: 'لا توجد مستحقات معلقة حالياً.',
    ku: 'هیچ شایستەیەکی چاوەڕوانکراو لەم کاتەدا نییە.'
  },
  'payout.view_finances': {
    en: 'View Owner Finances',
    ar: 'عرض مالية المالك',
    ku: 'بینینی دارایی خاوەن موڵک'
  },
  'payout.view_settlements': {
    en: 'View Settlements',
    ar: 'عرض التسويات',
    ku: 'بینینی یەکلاییکردنەوەکان'
  },

  // Pricing
  'pricing.back_to_dashboard': {
    en: 'Back to Dashboard',
    ar: 'العودة إلى لوحة القيادة',
    ku: 'گەڕانەوە بۆ داشبۆرد'
  },
  'pricing.cancel': {
    en: 'Cancel',
    ar: 'إلغاء',
    ku: 'پاشگەزبوونەوە'
  },
  'pricing.create_success': {
    en: 'Pricing tier created successfully!',
    ar: 'تم إنشاء شريحة الأسعار بنجاح!',
    ku: 'ئاستی نرخ بە سەرکەوتوویی دروستکرا!'
  },
  'pricing.create_tier': {
    en: 'Create New Tier',
    ar: 'إنشاء شريحة جديدة',
    ku: 'دروستکردنی ئاستی نوێ'
  },
  'pricing.err_max_invalid': {
    en: 'Max properties must be a valid number',
    ar: 'يجب أن يكون الحد الأقصى للعقارات رقماً صالحاً',
    ku: 'دەبێت زۆرترین موڵک ژمارەیەکی دروست بێت'
  },
  'pricing.err_max_less_min': {
    en: 'Max properties cannot be less than min properties',
    ar: 'لا يمكن أن يكون الحد الأقصى أقل من الحد الأدنى',
    ku: 'زۆرترین موڵک ناتوانێت کەمتر بێت لە کەمترین موڵک'
  },
  'pricing.err_mgmt_rate': {
    en: 'Management fee rate must be between 0 and 1 (or 0% to 100%)',
    ar: 'يجب أن تكون نسبة الإدارة بين 0 و 1 (أو 0% إلى 100%)',
    ku: 'ڕێژەی بەڕێوەبردن دەبێت لە نێوان 0 و 1 بێت (0% بۆ 100%)'
  },
  'pricing.err_min_invalid': {
    en: 'Min properties must be 0 or greater',
    ar: 'يجب أن يكون الحد الأدنى للعقارات 0 أو أكثر',
    ku: 'کەمترین موڵک دەبێت 0 یان زیاتر بێت'
  },
  'pricing.err_name_required': {
    en: 'Tier name is required',
    ar: 'اسم الشريحة مطلوب',
    ku: 'ناوی ئاست پێویستە'
  },
  'pricing.err_prio': {
    en: 'Priority must be an integer',
    ar: 'يجب أن تكون الأولوية رقماً صحيحاً',
    ku: 'ئەولەویەت دەبێت ژمارەیەکی تەواو بێت'
  },
  'pricing.err_rent_rate': {
    en: 'Rent fee rate must be between 0 and 1 (or 0% to 100%)',
    ar: 'يجب أن تكون نسبة الإيجار بين 0 و 1 (أو 0% إلى 100%)',
    ku: 'ڕێژەی کرێ دەبێت لە نێوان 0 و 1 بێت (0% بۆ 100%)'
  },
  'pricing.max_props': {
    en: 'Max Properties',
    ar: 'الحد الأقصى للعقارات',
    ku: 'زۆرترین ژمارەی موڵک'
  },
  'pricing.max_props_hint': {
    en: '(Optional)',
    ar: '(اختياري)',
    ku: '(ئارەزوومەندانە)'
  },
  'pricing.mgmt_fee_rate': {
    en: 'Management Fee Rate:',
    ar: 'نسبة رسوم الإدارة:',
    ku: 'ڕێژەی کارمەزدی بەڕێوەبردن:'
  },
  'pricing.min_props': {
    en: 'Min Properties',
    ar: 'الحد الأدنى للعقارات',
    ku: 'کەمترین ژمارەی موڵک'
  },
  'pricing.modal_title': {
    en: 'Create New Pricing Tier',
    ar: 'إنشاء شريحة تسعير جديدة',
    ku: 'دروستکردنی ئاستی نوێی نرخ'
  },
  'pricing.no_tiers': {
    en: 'No pricing tiers configured.',
    ar: 'لا توجد شرائح تسعير مهيأة.',
    ku: 'هیچ ئاستێکی نرخ دانەنراوە.'
  },
  'pricing.no_tiers_hint': {
    en: 'Click "Create New Tier" to define the first pricing bracket.',
    ar: 'انقر على "إنشاء شريحة جديدة" لتعريف أول شريحة تسعير.',
    ku: 'کلیک لەسەر "دروستکردنی ئاستی نوێ" بکە بۆ دیاریکردنی یەکەم قۆناغی نرخ.'
  },
  'pricing.priority': {
    en: 'Priority',
    ar: 'الأولوية',
    ku: 'ئەولەویەت'
  },
  'pricing.property_range': {
    en: 'Property Range:',
    ar: 'نطاق العقارات:',
    ku: 'مەودای ژمارەی موڵک:'
  },
  'pricing.rent_fee_rate': {
    en: 'Rent Fee Rate:',
    ar: 'نسبة رسوم الإيجار:',
    ku: 'ڕێژەی کارمەزدی کرێ:'
  },
  'pricing.save_tier': {
    en: 'Save Tier',
    ar: 'حفظ الشريحة',
    ku: 'پاشەکەوتکردنی ئاست'
  },
  'pricing.saving': {
    en: 'Creating...',
    ar: 'جارٍ الحفظ...',
    ku: 'دروست دەکرێت...'
  },
  'pricing.subtitle': {
    en: 'Manage platform fee tiers, property boundaries, and priority rankings.',
    ar: 'إدارة شرائح رسوم المنصة وحدود العقارات وترتيب الأولويات.',
    ku: 'بەڕێوەبردنی ئاستەکانی کارمەزدی پلاتفۆرم، سنووری موڵکەکان و ڕیزبەندی.'
  },
  'pricing.tier_name': {
    en: 'Tier Name',
    ar: 'اسم الشريحة',
    ku: 'ناوی ئاست'
  },
  'pricing.title': {
    en: 'Tiered Pricing Configuration',
    ar: 'تهيئة شرائح الأسعار',
    ku: 'ڕێکخستنی ئاستەکانی نرخی پلاتفۆرم'
  },

  // Property
  'property.active_lease': {
    en: 'Active Lease',
    ar: 'عقد إيجار نشط',
    ku: 'گرێبەستی چالاک'
  },
  'property.collection_breakdown': {
    en: 'Collection Breakdown',
    ar: 'تفاصيل تحصيل الإيجار',
    ku: 'وردەکاری کۆکردنەوەی کرێ'
  },
  'property.download_receipt': {
    en: 'Download Receipt',
    ar: 'تحميل الإيصال',
    ku: 'داگرتنی پسوولە'
  },
  'property.due_date': {
    en: 'Due Date',
    ar: 'تاريخ الاستحقاق',
    ku: 'وادەی پارەدان'
  },
  'property.financial_error': {
    en: 'Authoritative financial records are temporarily unavailable. Data is not fabricated.',
    ar: 'السجلات المالية المعتمدة غير متاحة مؤقتاً. لا يتم عرض أي بيانات مصطنعة.',
    ku: 'تۆمارە داراییە ڕاستەقینەکان لەم کاتەدا بەردەست نین. هیچ داتایەکی ساختە پیشان نادرێت.'
  },
  'property.form_name': {
    en: 'Property Name',
    ar: 'اسم العقار',
    ku: 'ناوی موڵک'
  },
  'property.mgmt_fee_agreed': {
    en: 'Agreed Management Fee Rate',
    ar: 'نسبة رسوم الإدارة المتفق عليها',
    ku: 'ڕێژەی ڕێککەوتووی کارمەزدی بەڕێوەبردن'
  },
  'property.mgmt_fee_desc': {
    en: 'Property-specific fee for day-to-day operations.',
    ar: 'رسوم خاصة بالعقار للعمليات اليومية.',
    ku: 'کارمەزدی تایبەت بە موڵک بۆ بەڕێوەبردنی ڕۆژانە.'
  },
  'property.no_active_lease': {
    en: 'No Active Lease',
    ar: 'لا يوجد عقد نشط',
    ku: 'هیچ گرێبەستێکی چالاک نییە'
  },
  'property.no_schedule': {
    en: 'No Schedule',
    ar: 'لا يوجد جدول إيجار',
    ku: 'خشتەی کرێ نییە'
  },
  'property.owner_net': {
    en: 'Owner Receives (Net)',
    ar: 'صافي مستحق المالك',
    ku: 'شایستەی خاوەن موڵک (خاوێن)'
  },
  'property.paid_date': {
    en: 'Paid Date',
    ar: 'تاريخ الدفع',
    ku: 'بەرواری پارەدان'
  },
  'property.rent_amount': {
    en: 'Rent Amount',
    ar: 'مبلغ الإيجار',
    ku: 'بڕی کرێ'
  },
  'property.rent_breakdown': {
    en: 'Rent Collection & Payout',
    ar: 'تحصيل الإيجار وصرف المستحقات',
    ku: 'کۆکردنەوەی کرێ و شایستەی دارایی'
  },
  'property.rent_fee_agreed': {
    en: 'Agreed Rent Fee Rate',
    ar: 'نسبة رسوم الإيجار المتفق عليها',
    ku: 'ڕێژەی ڕێککەوتووی کارمەزدی کرێ'
  },
  'property.rent_fee_desc': {
    en: 'Property-specific fee for tenant leasing.',
    ar: 'رسوم خاصة بالعقار لتأجير المستأجر.',
    ku: 'کارمەزدی تایبەت بە موڵک بۆ بەکرێدان.'
  },
  'property.select_city': {
    en: 'Select City',
    ar: 'اختر المدينة',
    ku: 'شار هەڵبژێرە'
  },
  'property.select_state': {
    en: 'Select Governorate',
    ar: 'اختر المحافظة',
    ku: 'پارێزگا هەڵبژێرە'
  },
  'property.total_collected': {
    en: 'Total Rent Collected (Confirmed)',
    ar: 'إجمالي الإيجار المحصل (المؤكد)',
    ku: 'کۆی کرێی کۆکراوە (پشتڕاستکراو)'
  },
  'property.total_fees': {
    en: 'Total Applicable Fees',
    ar: 'إجمالي الرسوم المطبقة',
    ku: 'کۆی کارمەزدە کارپێکراوەکان'
  },
  'property.vacant': {
    en: 'Vacant / No Active Lease',
    ar: 'شاغر / بدون عقد نشط',
    ku: 'بەتاڵ / بەبێ گرێبەستی چالاک'
  },
  'property.validation.name_required': {
    en: 'Property name is required and cannot be empty.',
    ar: 'اسم العقار مطلوب ولا يمكن تركه فارغاً.',
    ku: 'ناوی موڵک پێویستە و نابێت بەتاڵ بێت.'
  },
  'property.view_statement': {
    en: 'View Full Statement',
    ar: 'عرض كشف الحساب كاملاً',
    ku: 'بینینی ڕاپۆرتی دارایی تەواو'
  },

  // Receipt
  'receipt.none': {
    en: 'No confirmed payment receipt is available for this period.',
    ar: 'لا يتوفر إيصال دفع مؤكد لهذه الفترة.',
    ku: 'هیچ پسوولەیەکی پشتڕاستکراوی پارەدان بۆ ئەم ماوەیە بەردەست نییە.'
  },
  'receipt.notice': {
    en: 'Payment receipt record verified (${rcpNum}). Formal PDF document download is pending banking/accounting export service integration.',
    ar: 'تم التحقق من سجل إيصال الدفع (${rcpNum}). تنزيل مستند PDF بانتظار ربط خدمة التصدير المحاسبي.',
    ku: 'تۆماری پسوولەی پارەدان پشتڕاستکرایەوە (${rcpNum}). داگرتنی فەرمی PDF لە چاوەڕوانی بەستنەوەی خزمەتگوزاری دارایی دایە.'
  },

  // Statement
  'statement.notice': {
    en: 'Financial statement ledger is accessible to property owners and management companies in the Owner Workspace.',
    ar: 'كشف الحساب المالي متاح للملاك وشركات الإدارة في مساحة عمل المالك.',
    ku: 'دەفتەری گشتی دارایی لە شوێنی کاری خاوەن موڵک بەردەستە بۆ خاوەن موڵک و کۆمپانیاکانی بەڕێوەبردن.'
  },

  // Tenant Payment
  'tenant.amountExceeds': {
    en: 'Payment amount cannot exceed remaining rent due',
    ar: 'لا يمكن أن يتجاوز مبلغ الدفع الرصيد المتبقي للإيجار',
    ku: 'بڕی پارەدان ناتوانێت لە ماوەی کرێی ماوە زیاتر بێت'
  },
  'tenant.amountPositive': {
    en: 'Payment amount must be greater than zero',
    ar: 'يجب أن يكون مبلغ الدفع أكبر من الصفر',
    ku: 'بڕی پارەدان دەبێت لە سفر گەورەتر بێت'
  },
  'tenant.enterAmountToPay': {
    en: 'Enter amount to pay now',
    ar: 'أدخل المبلغ المراد دفعه الآن',
    ku: 'بڕی پارەدان ئێستا بنووسە'
  },
  'tenant.fullPayment': {
    en: 'Full Balance',
    ar: 'كامل الرصيد المتبقي',
    ku: 'کۆی باڵانس (تەواوی کرێ)'
  },
  'tenant.partialPayment': {
    en: 'Custom / Partial',
    ar: 'دفع جزئي / مخصص',
    ku: 'پارەدانی بەشەکی / دیاریکراو'
  },
  'tenant.paymentType': {
    en: 'Payment Type',
    ar: 'نوع الدفعة',
    ku: 'جۆری پارەدان'
  },
  'tenant.remainingAfterPayment': {
    en: 'Remaining balance after this payment:',
    ar: 'الرصيد المتبقي بعد هذه الدفعة:',
    ku: 'باڵانسی ماوە دوای ئەم پارەدانە:'
  },

  // Workspace
  'workspace.all_roles_enrolled': {
    en: 'You have already activated all available platform roles.',
    ar: 'لقد قمت بالفعل بتفعيل جميع أدوار المنصة المتاحة.',
    ku: 'تۆ پێشتر هەموو ڕۆڵە بەردەستەکانی پلاتفۆڕمت چالاک کردووە.'
  },
  'workspace.back_to_workspaces': {
    en: 'Back to Workspaces',
    ar: 'العودة إلى مساحات العمل',
    ku: 'گەڕانەوە بۆ شوێنەکانی کار'
  },
  'workspace.enroll_failed': {
    en: 'Failed to activate role.',
    ar: 'فشل تفعيل الدور المطلوب.',
    ku: 'چالاککردنی ڕۆڵ سەرکەوتوو نەبوو.'
  },
  'workspace.single_workspace_hint': {
    en: 'You have one active workspace according to your current role.',
    ar: 'لديك مساحة عمل واحدة نشطة وفق دورك الحالي.',
    ku: 'تۆ یەک شوێنی کاری چالاکت هەیە بەپێی ڕۆڵی هەنووکەیت.'
  },
  'workspace.switch_failed': {
    en: 'Failed to switch workspace.',
    ar: 'فشل التبديل إلى مساحة العمل.',
    ku: 'گۆڕینی شوێنی کار سەرکەوتوو نەبوو.'
  }
};

async function run() {
  const i18nPath = path.resolve('src/i18n/I18nProvider.tsx');
  let content = fs.readFileSync(i18nPath, 'utf8');

  // 1. In en, remove lines 739 to 821 (the bad crm block)
  // Let's identify the start and end of the bad block in en:
  // Starts with 'crm.acceptAgreement': 'acceptAgreement',
  // Ends with 'crm.workspaceTitle': 'workspaceTitle',
  
  // We can safely replace the bad crm blocks using specific regex or string boundaries:
  const badEnCrmStart = "    'crm.acceptAgreement': 'acceptAgreement',";
  const badEnCrmEnd = "    'crm.workspaceTitle': 'workspaceTitle',";

  // Check occurrences
  const enIdx1 = content.indexOf(badEnCrmStart);
  if (enIdx1 === -1) {
    console.error('Could not find badEnCrmStart in I18nProvider.tsx!');
    return;
  }
  const enIdx2 = content.indexOf(badEnCrmEnd, enIdx1);
  if (enIdx2 === -1) {
    console.error('Could not find badEnCrmEnd in I18nProvider.tsx!');
    return;
  }

  // The second block is Arabic
  const arIdx1 = content.indexOf(badEnCrmStart, enIdx2 + badEnCrmEnd.length);
  const arIdx2 = content.indexOf(badEnCrmEnd, arIdx1);

  // The third block is Kurdish
  const kuIdx1 = content.indexOf(badEnCrmStart, arIdx2 + badEnCrmEnd.length);
  const kuIdx2 = content.indexOf(badEnCrmEnd, kuIdx1);

  console.log('En bad block range:', enIdx1, enIdx2);
  console.log('Ar bad block range:', arIdx1, arIdx2);
  console.log('Ku bad block range:', kuIdx1, kuIdx2);

  // For Kurdish, we replace the bad block with all updated translations for ku!
  // Same for Arabic, same for English!
  
  // Format keys as code lines
  function formatKeys(lang: 'en' | 'ar' | 'ku') {
    return Object.entries(translationDictionary)
      .map(([k, v]) => `    '${k}': '${v[lang].replace(/'/g, "\\'")}',`)
      .join('\n');
  }

  const enReplacement = formatKeys('en');
  const arReplacement = formatKeys('ar');
  const kuReplacement = formatKeys('ku');

  // Replace from bottom to top so indices don't shift!
  // Ku replacement:
  content = content.substring(0, kuIdx1) + kuReplacement + content.substring(kuIdx2 + badEnCrmEnd.length);
  // Ar replacement:
  content = content.substring(0, arIdx1) + arReplacement + content.substring(arIdx2 + badEnCrmEnd.length);
  // En replacement:
  content = content.substring(0, enIdx1) + enReplacement + content.substring(enIdx2 + badEnCrmEnd.length);

  fs.writeFileSync(i18nPath, content, 'utf8');
  console.log('Successfully updated I18nProvider.tsx!');
}

run().catch(console.error);

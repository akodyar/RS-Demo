import fs from 'fs';
import { newTranslations } from './new-translations-data.mjs';

export const phase50Translations = {
  'login.error.invalid_email': {
    en: 'Please enter a valid email address.',
    ar: 'يرجى إدخال عنوان بريد إلكتروني صالح.',
    ku: 'تکایە ئیمەیڵێکی دروست بنووسە.',
  },
  'login.error.enter_email_for_reset': {
    en: 'Please enter your email address to receive password reset link.',
    ar: 'يرجى إدخال بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.',
    ku: 'تکایە سەرەتا ئیمەیڵەکەت بنووسە بۆ ناردنی بەستەری نوێکردنەوەی وشەی نهێنی.',
  },
  'login.forgot_notice': {
    en: 'If this email is registered in our platform, a reset link will be sent.',
    ar: 'إذا كان هذا البريد الإلكتروني مسجلاً، فسيتم إرسال رابط إعادة التعيين.',
    ku: 'ئەگەر ئەم ئیمەیڵە تۆمارکراو بێت لە سیستەم، بەستەری نوێکردنەوە دەنێردرێت.',
  },
  'social.apple.notice': {
    en: 'Sign in with Apple will be available in the upcoming mobile release.',
    ar: 'تسجيل الدخول باستخدام Apple سيتوفر في الإصدار القادم للتطبيق.',
    ku: 'چوونەژوورەوە بە Apple بەردەست دەبێت لە وەشانەکانی داهاتوودا.',
  },
  'social.google.notice': {
    en: 'Sign in with Google will be integrated in future platform updates.',
    ar: 'تسجيل الدخول عبر Google سيتوفر في التحديثات القادمة للمنصة.',
    ku: 'چوونەژوورەوە بە Google پەیوەست دەکرێت لە وەشانەکانی داهاتوو.',
  },
  'social.fb.notice': {
    en: 'Sign in with Facebook is currently under preparation.',
    ar: 'تسجيل الدخول عبر Facebook قيد الإعداد حالياً.',
    ku: 'چوونەژوورەوە بە Facebook لەژێر ئامادەکردندایە.',
  },
  'deposit.collect_success': {
    en: 'Security deposit marked as collected successfully!',
    ar: 'تم تسجيل استلام مبلغ التأمين بنجاح!',
    ku: 'وەرگرتنی بڕی بارمتە بە سەرکەوتوویی تۆمارکرا!',
  },
  'deposit.release_success': {
    en: 'Security deposit released successfully!',
    ar: 'تم إرجاع مبلغ التأمين بنجاح!',
    ku: 'گەڕاندنەوەی بارمتە بە سەرکەوتوویی ئەنجامدرا!',
  },
  'inspection.create_success': {
    en: 'Move-out inspection initiated successfully!',
    ar: 'تم بدء كشف إخلاء العقار بنجاح!',
    ku: 'پشکنینی دەرچوونی موڵک بە سەرکەوتوویی دەستیپێکرد!',
  },
  'inspection.error.area_component_required': {
    en: 'Area and Component are required',
    ar: 'المنطقة والعنصر مطلوبان',
    ku: 'شوێن و بەشی دیاریکراو پێویستن',
  },
  'inspection.item_added': {
    en: 'Inspection item recorded!',
    ar: 'تم تسجيل عنصر الكشف!',
    ku: 'بڕگەی پشکنین تۆمارکرا!',
  },
  'inspection.completed': {
    en: 'Inspection completed! You can now propose deductions.',
    ar: 'اكتمل الكشف! يمكنك الآن اقتراح الخصومات.',
    ku: 'پشکنین تەواوبوو! ئێستا دەتوانیت بڕی لێبڕین پێشنیار بکەیت.',
  },
  'deduction.error.amount_desc_required': {
    en: 'Amount and description are required',
    ar: 'المبلغ والوصف مطلوبان',
    ku: 'بڕی پارە و وەسفکردن پێویستن',
  },
  'deduction.proposed_success': {
    en: 'Deduction proposal created successfully!',
    ar: 'تم إنشاء مقترح الخصم بنجاح!',
    ku: 'پێشنیاری لێبڕین بە سەرکەوتوویی دروستکرا!',
  },
  'deduction.error.company_delegation_gap': {
    en: 'Company managers lack explicit deduction approval authority (Decision P02). Only verified property owners may approve.',
    ar: 'لا يمتلك مديرو الشركات صلاحية الموافقة على الخصومات (القرار P02). يقتصر الاعتماد على مالك العقار الموثق فقط.',
    ku: 'بەڕێوەبەرانی کۆمپانیا دەسەڵاتی پەسەندکردنی لێبڕینیان نییە (بڕیاری P02). تەنها خاوەن موڵکی پەسەندکراو دەتوانێت پەسەندی بکات.',
  },
  'deduction.approved': {
    en: 'Deduction approved successfully!',
    ar: 'تمت الموافقة على الخصم بنجاح!',
    ku: 'لێبڕین بە سەرکەوتوویی پەسەندکرا!',
  },
  'deduction.error.reason_required': {
    en: 'Rejection reason is required',
    ar: 'سبب الرفض مطلوب',
    ku: 'هۆکاری ڕەتکردنەوە پێویستە',
  },
  'deduction.rejected': {
    en: 'Deduction rejected successfully!',
    ar: 'تم رفض الخصم بنجاح!',
    ku: 'لێبڕینەکە ڕەتکرایەوە!',
  },
  'deposit.modal_title': {
    en: 'Security Deposit & Move-Out Management',
    ar: 'إدارة التأمين وإخلاء العقار',
    ku: 'بەڕێوەبردنی بارمتە و چۆڵکردنی موڵک',
  },
  'deposit.tab_deposit': {
    en: 'Deposit Balance & Escrow',
    ar: 'رصيد التأمين والأمانات',
    ku: 'باڵانسی بارمتە و ئەمانات',
  },
  'deposit.tab_inspections': {
    en: 'Move-Out Inspections',
    ar: 'كشوفات إخلاء العقار',
    ku: 'پشکنینەکانی چۆڵکردن',
  },
  'deposit.tab_deductions': {
    en: 'Security Deductions',
    ar: 'خصومات التأمين',
    ku: 'لێبڕینەکانی بارمتە',
  },
  'deposit.no_record_notice': {
    en: 'No security deposit has been initialized for this lease yet.',
    ar: 'لم يتم تسجيل أي تأمين مالي لهذا العقد حتى الآن.',
    ku: 'تا ئێستا هیچ بارمتەیەکی دارایی بۆ ئەم گرێبەستە تۆمار نەکراوە.',
  },
  'deposit.collect_heading': {
    en: 'Collect / Record Security Deposit',
    ar: 'تسجيل استلام مبلغ التأمين',
    ku: 'تۆمارکردنی وەرگرتنی بارمتە',
  },
  'deposit.already_held': {
    en: 'This deposit is currently HELD in custodial escrow.',
    ar: 'مبلغ التأمين محتجز حالياً في حساب الأمانات المستقل.',
    ku: 'ئەم بارمتەیە لە ئێستادا لە ئەماناتی جێمتمانە پارێزراوە.',
  },
  'deposit.collect_desc': {
    en: 'Confirm tenant payment of the required deposit. Moves status from PENDING to HELD.',
    ar: 'تأكيد سداد المستأجر لمبلغ التأمين المطلوب، وتغيير الحالة إلى محتجز.',
    ku: 'پشتڕاستکردنەوەی پێدانی بارمتە لەلایەن کرێنشین و گۆڕینی دۆخەکە بۆ پارێزراو.',
  },
  'deposit.confirm_collect': {
    en: 'Confirm Custodial Collection',
    ar: 'تأكيد استلام الأمانة',
    ku: 'پشتڕاستکردنەوەی وەرگرتنی ئەمانات',
  },
  'deposit.release_heading': {
    en: 'Release / Refund Security Deposit',
    ar: 'إرجاع / رد مبلغ التأمين',
    ku: 'گەڕاندنەوەی بڕی بارمتە',
  },
  'deposit.release_desc': {
    en: 'Release held custodial funds back to tenant at end of lease.',
    ar: 'رد مبالغ الأمانات المحتجزة للمستأجر عند انتهاء عقد الإيجار.',
    ku: 'گەڕاندنەوەی پارەی ئەمانات بۆ کرێنشین لە کاتی کۆتاییهاتنی گرێبەست.',
  },
  'deposit.confirm_release': {
    en: 'Release Unreserved Custodial Funds',
    ar: 'إرجاع مبالغ الأمانات غير المحجوزة',
    ku: 'گەڕاندنەوەی پارەی ئەماناتی ئازادکراو',
  },
  'inspection.list_title': {
    en: 'Move-Out Inspection Records',
    ar: 'سجلات كشف إخلاء العقار',
    ku: 'تۆماری پشکنینەکانی چۆڵکردن',
  },
  'inspection.new_inspection': {
    en: 'Start New Inspection',
    ar: 'بدء كشف جديد',
    ku: 'دەستپێکردنی پشکنینی نوێ',
  },
  'deduction.list_title': {
    en: 'Security Deposit Deductions',
    ar: 'خصومات مبلغ التأمين',
    ku: 'لێبڕینەکانی بڕی بارمتە',
  },
  'deduction.propose_btn': {
    en: 'Propose Deduction',
    ar: 'اقتراح خصم',
    ku: 'پێشنیارکردنی لێبڕین',
  },
  'dispute.error.window_expired': {
    en: 'The statutory 30-day contestation window has expired. Formal disputes can no longer be submitted.',
    ar: 'انتهت فترة الاعتراض القانونية المحددة بـ 30 يوماً. لا يمكن تقديم اعتراضات رسمية بعد الآن.',
    ku: 'ماوەی یاسایی ٣٠ ڕۆژەی ناڕەزایەتی کۆتایی هاتووە. ناتوانرێت تانەی فەرمی پێشکەش بکرێت.',
  },
  'dispute.error.reason_required': {
    en: 'Dispute reason is required.',
    ar: 'سبب الاعتراض مطلوب.',
    ku: 'هۆکاری ناڕەزایەتی پێویستە.',
  },
  'dispute.success': {
    en: 'Your formal dispute has been submitted and recorded.',
    ar: 'تم تقديم وتسجيل اعتراضك الرسمي بنجاح.',
    ku: 'تانە و ناڕەزایەتییە فەرمییەکەت بە سەرکەوتوویی تۆمارکرا.',
  },
  'dispute.title': {
    en: 'Dispute Security Deposit Deduction',
    ar: 'الاعتراض على خصم التأمين',
    ku: 'ناڕەزایەتی دەربڕین بەرامبەر لێبڕینی بارمتە',
  },
  'dispute.subtitle': {
    en: 'Submit formal contestation within the statutory 30-day notice window.',
    ar: 'تقديم اعتراض رسمي خلال فترة الإشعار القانونية (30 يوماً).',
    ku: 'پێشکەشکردنی تانەی فەرمی لە ماوەی یاسایی ٣٠ ڕۆژدا.',
  },
  'dispute.window_expired_warning': {
    en: 'The statutory 30-day contestation window has expired. Formal disputes can no longer be submitted.',
    ar: 'انتهت المهلة القانونية للاعتراض (30 يوماً). لا يمكن تقديم اعتراض جديد.',
    ku: 'ماوەی یاسایی ٣٠ ڕۆژ بۆ ناڕەزایەتی بەسەرچووە. پێشکەشکردنی تانەی نوێ ناکرێت.',
  },
  'dispute.reason_label': {
    en: 'Contestation & Evidence Rationale *',
    ar: 'أسباب الاعتراض ومبررات الأدلة *',
    ku: 'هۆکاری ناڕەزایەتی و بەڵگەنامەکان *',
  },
  'dispute.reason_ph': {
    en: 'Explain why this deduction is unwarranted (e.g. pre-existing wear, move-in baseline note, landlord responsibility)...',
    ar: 'وضح سبب عدم استحقاق هذا الخصم (مثل الاستهلاك الطبيعي، حالة العقار عند الاستلام، مسؤولية المالك)...',
    ku: 'ڕوونی بکەرەوە بۆچی ئەم لێبڕینە دروست نییە (وەک داخورانی ئاسایی، دۆخی سەرەتای وەرگرتن، بەرپرسیارێتی خاوەن موڵک)...',
  },
  'dispute.evidence_label': {
    en: 'Evidence Reference / Move-In Photo Key (Optional)',
    ar: 'مرجع الأدلة / مفتاح صور استلام العقار (اختياري)',
    ku: 'بەڵگە یان وێنەی کاتی وەرگرتنی موڵک (ئارەزوومەندانە)',
  },
  'common.submitting': {
    en: 'Submitting...',
    ar: 'جاري الإرسال...',
    ku: 'دەنێردرێت...',
  },
  'dispute.submit_btn': {
    en: 'Submit Formal Dispute',
    ar: 'إرسال الاعتراض الرسمي',
    ku: 'ناردنی تانەی فەرمی',
  },
  'tenant.depositEscrowTitle': {
    en: 'Security Deposit Escrow & Inspections',
    ar: 'حساب أمانات التأمين وكشوفات العقار',
    ku: 'ئەماناتی بارمتە و پشکنینەکانی موڵک',
  },
  'tenant.depositEscrowDesc': {
    en: 'Authoritative held escrow, move-out condition records, and deduction contestations.',
    ar: 'الأمانات المحتجزة رسمياً، سجلات حالة العقار عند الإخلاء، والاعتراضات على الخصومات.',
    ku: 'ئەماناتی فەرمی پارێزراو، تۆماری دۆخی موڵک لە کاتی چۆڵکردن، و تانەکانی لێبڕین.',
  },
  'tenant.depositRecorded': {
    en: 'Total Recorded',
    ar: 'إجمالي المسجل',
    ku: 'کۆی گشتی تۆمارکراو',
  },
  'tenant.depositStatus': {
    en: 'Escrow Status',
    ar: 'حالة الأمانة',
    ku: 'دۆخی ئەمانات',
  },
  'tenant.inspectionsHeading': {
    en: 'Move-In & Move-Out Inspections',
    ar: 'كشوفات استلام وإخلاء العقار',
    ku: 'پشکنینەکانی وەرگرتن و چۆڵکردنی موڵک',
  },
  'tenant.noInspections': {
    en: 'No inspections recorded for this lease yet.',
    ar: 'لا توجد كشوفات مسجلة لهذا العقد حتى الآن.',
    ku: 'تا ئێستا هیچ پشکنینێک بۆ ئەم گرێبەستە تۆمار نەکراوە.',
  },
  'common.pending': {
    en: 'Pending',
    ar: 'قيد الانتظار',
    ku: 'چاوەڕوانکراو',
  },
  'tenant.baselineLinked': {
    en: 'Linked Baseline ID:',
    ar: 'معرف الكشف المبدئي المرتبط:',
    ku: 'ناسنامەی پشکنینی بنەڕەتی:',
  },
  'tenant.noBaseline': {
    en: 'Explicitly recorded: No move-in baseline on file.',
    ar: 'مسجل رسمياً: لا يوجد كشف استلام مبدئي في الملف.',
    ku: 'تۆمارکراوی فەرمی: هیچ پشکنینێکی سەرەتایی لە پەڕگەدا نییە.',
  },
  'tenant.deductionsHeading': {
    en: 'Proposed Deductions & Contestation',
    ar: 'الخصومات المقترحة والاعتراضات',
    ku: 'لێبڕینە پێشنیارکراوەکان و تانەکان',
  },
  'tenant.noDeductions': {
    en: 'No security deposit deductions proposed. Full deposit eligible for return upon lease exit.',
    ar: 'لم يتم اقتراح أي خصومات من مبلغ التأمين. التأمين مؤهل للرد بالكامل عند انتهاء العقد.',
    ku: 'هیچ لێبڕینێک لە بارمتە پێشنیار نەکراوە. تەواوی بارمتە شایستەی گەڕاندنەوەیە لە کاتی تەواوبوونی گرێبەست.',
  },
  'tenant.evidenceAttached': {
    en: 'Evidence records attached ({count})',
    ar: 'وثائق وأدلة مرفقة ({count})',
    ku: 'بەڵگەنامەی هاوپێچکراو ({count})',
  },
  'tenant.disputeWindowNotice': {
    en: 'Contestation Window Closes:',
    ar: 'تغلق مهلة الاعتراض في:',
    ku: 'کۆتاییهاتنی ماوەی ناڕەزایەتی:',
  },
  'tenant.windowClosedBadge': {
    en: 'Closed',
    ar: 'مغلقة',
    ku: 'داخراو',
  },
  'tenant.disputeActive': {
    en: 'Active Formal Dispute',
    ar: 'اعتراض رسمي نشط',
    ku: 'تانەی فەرمی چالاک',
  },
  'tenant.disputeAction': {
    en: 'Dispute Deduction',
    ar: 'الاعتراض على الخصم',
    ku: 'ناڕەزایەتی لەسەر لێبڕین',
  },
  'tenant.disputeWindowExpired': {
    en: 'Dispute Window Expired',
    ar: 'انتهت مهلة الاعتراض',
    ku: 'ماوەی ناڕەزایەتی بەسەرچوو',
  },
  'tenant.utility_paid_success': {
    en: 'Utility bill paid successfully!',
    ar: 'تم سداد فاتورة الخدمات بنجاح!',
    ku: 'پشکی خزمەتگوزاری بە سەرکەوتوویی درا!',
  },
  'tenant.utility_payment_failed': {
    en: 'Payment failed. Please verify your balance and try again.',
    ar: 'فشلت عملية الدفع. يرجى التحقق من الرصيد والمحاولة مرة أخرى.',
    ku: 'پارەدانەکە سەرکەوتوو نەبوو. تکایە باڵانسەکەت بپشکنە و دووبارە هەوڵبدەرەوە.',
  },
  'tenant.utility_network_error': {
    en: 'Network error connecting to utility billing service.',
    ar: 'خطأ في الاتصال بخدمة سداد الفواتير.',
    ku: 'هەڵەی هێڵ لە پەیوەندیکردن بە خزمەتگوزاریی پارەدانی پسوولە.',
  },
  'tenant.no_utility_bills': {
    en: 'No pending utility bills found for this property.',
    ar: 'لا توجد فواتير خدمات مستحقة لهذا العقار.',
    ku: 'هیچ پسوولەیەکی خزمەتگوزاری چاوەڕوانکراو بۆ ئەم موڵکە نییە.',
  },
  'property.error.create_failed': {
    en: 'Failed to create property.',
    ar: 'فشل في إنشاء العقار.',
    ku: 'تۆمارکردنی موڵک سەرکەوتوو نەبوو.',
  },
  'property.error.server_error': {
    en: 'An internal server error occurred while creating the property. Please try again.',
    ar: 'حدث خطأ داخلي في الخادم أثناء إنشاء العقار. يرجى المحاولة مرة أخرى.',
    ku: 'هەڵەیەکی ناوخۆیی ڕوویدا لە کاتی تۆمارکردنی موڵک. تکایە دووبارە هەوڵبدەرەوە.',
  },
  'admin.password_required': {
    en: 'Please enter administrative password',
    ar: 'يرجى إدخال كلمة المرور الإدارية',
    ku: 'تکایە وشەی نهێنی کارگێڕی بنووسە',
  },
  'property.deposit_inspections': {
    en: 'Deposit & Move-Out',
    ar: 'التأمين وإخلاء العقار',
    ku: 'بارمتە و چۆڵکردن',
  },
};

// Merge into new-translations-data.mjs
const combined = { ...newTranslations, ...phase50Translations };

const output = `export const newTranslations = ${JSON.stringify(combined, null, 2)};\n`;
fs.writeFileSync('scripts/new-translations-data.mjs', output, 'utf8');
console.log('Merged all 70 Phase 50 translations into scripts/new-translations-data.mjs!');

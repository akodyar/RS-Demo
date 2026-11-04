const fs = require('fs');

const missingDict = {
  'settlements.expenses': {
    en: 'Expenses & Maintenance',
    ar: 'المصاريف والصيانة',
    ku: 'خەرجی و چاکسازی'
  },
  'tenant.paymentCurrency': {
    en: 'Payment Currency',
    ar: 'عملة الدفع',
    ku: 'دراوی پارەدان'
  },
  'tenant.officialCentralBankRate': {
    en: 'Authoritative Exchange Rate',
    ar: 'سعر الصرف المعتمد',
    ku: 'نرخی فەرمی ئاڵوگۆڕ'
  },
  'property.mgmt_persisted_note': {
    en: 'Management preference was specified during wizard registration and saved to the database.',
    ar: 'تم تحديد تفضيل الإدارة أثناء التسجيل وحفظه في قاعدة البيانات.',
    ku: 'هەڵبژاردنی شێوازی بەڕێوەبردن لە کاتی تۆمارکردن دیاریکراوە و لە بنکەدراوەدا پاشەکەوت کراوە.'
  },
  'property.mgmt_agreement_required': {
    en: 'Formal Management Agreement Required',
    ar: 'اتفاقية إدارة رسمية مطلوبة',
    ku: 'ڕێککەوتننامەی فەرمی بەڕێوەبردن پێویستە'
  },
  'property.operating_sub_model': {
    en: 'Operating Model Structure',
    ar: 'هيكل نموذج التشغيل',
    ku: 'پێکهاتەی مۆدێلی کارپێکردن'
  },
  'property.platform_fee_only_note': {
    en: 'Platform Fee Only (No Rent or Management Fee Applied)',
    ar: 'رسوم المنصة فقط (لا تطبق رسوم إيجار أو إدارة)',
    ku: 'تەنها کرێی پلاتفۆرم (هیچ کرێیەکی کرێ یان بەڕێوەبردن دیارینەکراوە)'
  },
  'nav.rentals': {
    en: 'Rentals',
    ar: 'عقارات للإيجار',
    ku: 'مۆڵک بۆ کڕێ'
  },
  'property.share': {
    en: 'Share',
    ar: 'مشاركة',
    ku: 'هاوبەشکردن'
  },
  'property.save': {
    en: 'Save',
    ar: 'حفظ',
    ku: 'پاشەکەوتکردن'
  },
  'property.saved': {
    en: 'Saved',
    ar: 'تم الحفظ',
    ku: 'پاشەکەوتکرا'
  },
  'property.link_copied': {
    en: 'Link copied to clipboard!',
    ar: 'تم نسخ الرابط إلى الحافظة!',
    ku: 'بەستەر کۆپیکرا!'
  },
  'property.owner_notice': {
    en: 'You own or manage this property. Open Command Center for management actions.',
    ar: 'أنت تمتلك أو تدير هذا العقار. افتح مركز التحكم لإجراءات الإدارة.',
    ku: 'تۆ خاوەن یان بەڕێوەبەری ئەم مۆڵکەیت. سەنتەری کۆنتڕۆڵ بکەوە بۆ بەڕێوەبردن.'
  },
  'property.open_command_center': {
    en: 'Open Property Command Center',
    ar: 'فتح مركز تحكم العقار',
    ku: 'کردنەوەی سەنتەری کۆنتڕۆڵی مۆڵک'
  },
  'property.badge.sponsored': {
    en: 'Sponsored 👑',
    ar: 'مميز 👑',
    ku: 'سپۆنسەرکراو 👑'
  },
  'property.badge.verified_deed': {
    en: 'Verified TAPU Deed',
    ar: 'عقار موثق بالطابو',
    ku: 'مۆڵکی باوەڕپێکراو بە تاپۆ'
  },
  'type.villa': {
    en: 'Villa',
    ar: 'فيلا',
    ku: 'ڤێلا'
  },
  'type.house': {
    en: 'House',
    ar: 'منزل',
    ku: 'خانوو'
  },
  'type.apartment': {
    en: 'Apartment',
    ar: 'شقة',
    ku: 'شوقە'
  },
  'property.gallery.view_fullscreen': {
    en: 'View Fullscreen',
    ar: 'عرض ملء الشاشة',
    ku: 'بینینی تەواوی شاشە'
  },
  'property.zero_surcharge_rule': {
    en: 'Protected by HomeHub Standard: 0% Tenant Commission Surcharge.',
    ar: 'محمي بمعيار هومهاب: 0% عمولة إضافية على المستأجر.',
    ku: 'پارێزراو بە ستانداردی هۆمهاب: ٠٪ سەرچاوەی زیادەی کرێنشین.'
  },
  'property.specs_title': {
    en: 'Property Specifications & Dimensions',
    ar: 'مواصفات ومساحة العقار',
    ku: 'تایبەتمەندی و قەبارەی مۆڵک'
  },
  'property.bedrooms_label': {
    en: 'Bedrooms',
    ar: 'غرف النوم',
    ku: 'ژووری نووستن'
  },
  'property.bathrooms_label': {
    en: 'Bathrooms',
    ar: 'الحمامات',
    ku: 'حەمام و دەستشۆر'
  },
  'property.type_label': {
    en: 'Property Type',
    ar: 'نوع العقار',
    ku: 'جۆری مۆڵک'
  },
  'property.desc_title': {
    en: 'Property Description',
    ar: 'وصف العقار',
    ku: 'ڕوونکردنەوە و زانیاریی مۆڵک'
  },
  'property.amenities_title': {
    en: 'Amenities & Features',
    ar: 'المرافق والخدمات',
    ku: 'خزمەتگوزاری و ئاسانکارییەکان'
  },
  'property.terms_title': {
    en: 'Rental Terms & Conditions',
    ar: 'شروط الإيجار',
    ku: 'مەرجەکانی کڕێکردن'
  },
  'property.call_agent': {
    en: 'Contact Agent / Owner',
    ar: 'الاتصال بالوكيل / المالك',
    ku: 'پەیوەندی بە برۆکەر / خاوەن مۆڵک'
  },
  'property.schedule_viewing': {
    en: 'Schedule a Viewing',
    ar: 'تحديد موعد للمعاينة',
    ku: 'دیاریکردنی کاتی سەردان'
  },
  'property.choose_slot': {
    en: 'Choose Viewing Date & Time',
    ar: 'اختر تاريخ ووقت المعاينة',
    ku: 'ڕۆژ و کاتی سەردان هەڵبژێرە'
  },
  'property.available_days': {
    en: 'Available Days',
    ar: 'الأيام المتاحة',
    ku: 'ڕۆژە بەردەستەکان:'
  },
  'property.available_times': {
    en: 'Time Slots',
    ar: 'الأوقات المتاحة',
    ku: 'کاتژمێر:'
  },
  'property.schedule_confirmed': {
    en: 'Viewing Schedule Confirmed',
    ar: 'تم تأكيد موعد المعاينة',
    ku: 'کاتی سەردانەکە پشتڕاستکرایەوە'
  },
  'property.confirm_appointment': {
    en: 'Confirm Appointment',
    ar: 'تأكيد الموعد',
    ku: 'پشتڕاستکردنەوەی سەردان'
  },
  'property.appointment_booked': {
    en: 'Appointment Successfully Booked!',
    ar: 'تم حجز الموعد بنجاح!',
    ku: 'سەردانەکە بە سەرکەوتوویی دیاریکرا!'
  },
  'property.apply_success': {
    en: 'Rental application submitted successfully! Once approved by the owner, digital lease contracts will be generated.',
    ar: 'تم إرسال طلب الإيجار بنجاح! بمجرد موافقة المالك، سيتم إنشاء عقد الإيجار الرقمي.',
    ku: 'داواکاری کڕێ بە سەرکەوتوویی نێردرا! پاش پەسەندکردنی خاوەن مۆڵک، گرێبەستی دیجیتاڵی ئامادە دەکرێت.'
  },
  'property.apply_for_rent': {
    en: 'Apply for Rent',
    ar: 'تقديم طلب إيجار',
    ku: 'پێشکەشکردنی داواکاری کڕێ'
  },
  'property.trust_title': {
    en: 'HomeHub Trust & Protection',
    ar: 'الأمان والموثوقية في هومهاب',
    ku: 'متمانە و پارێزبەندی هۆمهاب'
  },
  'property.trust_1': {
    en: 'TAPU deed and legal ownership digitally verified',
    ar: 'سند الطابو والملكية موثقة رقمياً',
    ku: 'تاپۆ و خاوەنداریەتی بە سیستەمی دیجیتاڵی پشتڕاستکراوەتەوە'
  },
  'property.trust_2': {
    en: 'Official legal lease agreement compliant with Kurdistan and Iraqi law',
    ar: 'عقد إيجار قانوني رسمي متوافق مع قوانين إقليم كوردستان والعراق',
    ku: 'گرێبەستی فەرمی یاسایی پارێزراو بەپێی یاساکانی هەرێم و عێراق'
  },
  'property.trust_3': {
    en: 'Security deposit protected in dedicated custodial escrow',
    ar: 'مبلغ التأمين محفوظ في حساب أمانات بنكي موثوق',
    ku: 'پارەی دەستەبەری لە هەژماری دەستەبەری پارێزراو دەمێنێتەوە'
  }
};

let i18n = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// Function to inject keys before closing of language object
function injectForLang(content, lang, nextAnchor) {
  const marker = lang + ': {';
  const startIdx = content.indexOf(marker);
  if (startIdx === -1) throw new Error(`Could not find ${lang}: {`);
  const anchorIdx = content.indexOf(nextAnchor, startIdx);
  if (anchorIdx === -1) throw new Error(`Could not find next anchor ${nextAnchor}`);
  
  // Find the closing brace of this language dictionary
  const closingBraceIdx = lang === 'ku'
    ? content.lastIndexOf('\n  }\n};', anchorIdx) + 1
    : content.lastIndexOf('},', anchorIdx);
  if (closingBraceIdx === -1 || closingBraceIdx === 0) throw new Error(`Could not find closing brace for ${lang}`);

  let insertion = '\n';
  for (const [key, val] of Object.entries(missingDict)) {
    // Check if key already exists
    if (!content.slice(startIdx, closingBraceIdx).includes(`'${key}':`)) {
      const escaped = val[lang].replace(/'/g, "\\'");
      insertion += `    '${key}': '${escaped}',\n`;
    }
  }

  return content.slice(0, closingBraceIdx) + insertion + '  ' + content.slice(closingBraceIdx);
}

console.log('Injecting EN...');
i18n = injectForLang(i18n, 'en', 'ar: {');

console.log('Injecting AR...');
i18n = injectForLang(i18n, 'ar', 'ku: {');

console.log('Injecting KU...');
i18n = injectForLang(i18n, 'ku', 'export interface I18nProviderProps');

fs.writeFileSync('src/i18n/I18nProvider.tsx', i18n, 'utf8');
console.log('Successfully injected all missing translations into src/i18n/I18nProvider.tsx!');

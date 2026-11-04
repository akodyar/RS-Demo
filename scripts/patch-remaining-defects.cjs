const fs = require('fs');
const path = require('path');

console.log('=== Patching Remaining Localization Fixes ===\n');

// 1. AgentWorkspace.tsx: insert getLocalizedCommissionStatus
const agentFile = path.join(__dirname, '../src/pages/AgentWorkspace.tsx');
let agentContent = fs.readFileSync(agentFile, 'utf8');

if (!agentContent.includes('const getLocalizedCommissionStatus')) {
  const target = `const [commissions, setCommissions] = useState<any[]>([]);`;
  const helper = `const [commissions, setCommissions] = useState<any[]>([]);

  const getLocalizedCommissionStatus = (status: string) => {
    if (language === 'ku') {
      switch (status) {
        case 'CALCULATED': return 'ئەژمارکراو';
        case 'PENDING_APPROVAL': return 'چاوەڕوانی پەسەندکردن';
        case 'APPROVED': return 'پەسەندکراو';
        case 'PAYABLE': return 'شایستەی وەرگرتن';
        case 'PAID':
        case 'DISBURSED': return 'دراوە';
        default: return status;
      }
    }
    if (language === 'ar') {
      switch (status) {
        case 'CALCULATED': return 'محسوبة';
        case 'PENDING_APPROVAL': return 'قيد الاعتماد';
        case 'APPROVED': return 'معتمدة';
        case 'PAYABLE': return 'مستحقة للدفع';
        case 'PAID':
        case 'DISBURSED': return 'تم الصرف';
        default: return status;
      }
    }
    return status;
  };`;

  if (agentContent.includes(target)) {
    agentContent = agentContent.replace(target, helper);
    fs.writeFileSync(agentFile, agentContent, 'utf8');
    console.log('[OK] Added getLocalizedCommissionStatus to AgentWorkspace.tsx');
  } else {
    console.warn('[WARN] Could not find commissions state in AgentWorkspace.tsx');
  }
} else {
  console.log('[INFO] getLocalizedCommissionStatus already present');
}

// 2. IntegrationsAdminWorkspace.tsx: regex replace the 5 descriptions
const intFile = path.join(__dirname, '../src/pages/IntegrationsAdminWorkspace.tsx');
let intContent = fs.readFileSync(intFile, 'utf8');

// Stripe
const stripeRegex = /<p className="text-sm text-slate-600 mb-4 line-clamp-2">\s*Handles secure ledger-validated payments and webhooks\. Financial states fall back safely when unconfigured\.\s*<\/p>/;
const stripeRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'پارەدانی پارێزراوی پشتڕاستکراو بە دەفتەری دارایی و وێبهووکەکان بەڕێوەدەبات. بارودۆخە داراییەکان بە سەلامەتی دەمێننەوە کاتێک دانەمەزراوە.'
                    : language === 'ar'
                    ? 'يدير المدفوعات الآمنة المعتمدة في سجل الحسابات والخطافات البرمجية. تعمل الحالات المالية بأمان عند عدم التهيئة.'
                    : 'Handles secure ledger-validated payments and webhooks. Financial states fall back safely when unconfigured.'}
                </p>`;
if (stripeRegex.test(intContent)) {
  intContent = intContent.replace(stripeRegex, stripeRepl);
  console.log('[OK] Localized Stripe description');
} else {
  console.warn('[WARN] Stripe description regex did not match');
}

// SendGrid
const sendgridRegex = /<p className="text-sm text-slate-600 mb-4 line-clamp-2">\s*Delivers transactional emails \(receipts, lease renewals\) governed by user notification preferences\.\s*<\/p>/;
const sendgridRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'ئیمەیڵە مامەڵەییەکان (پسوولە، نوێکردنەوەی گرێبەست) بەپێی هەڵبژاردنەکانی بەکارهێنەر دەنێرێت.'
                    : language === 'ar'
                    ? 'يرسل رسائل البريد الإلكتروني للمعاملات (الإيصالات، وتجديد العقود) وفقًا لتفضيلات الإشعارات.'
                    : 'Delivers transactional emails (receipts, lease renewals) governed by user notification preferences.'}
                </p>`;
if (sendgridRegex.test(intContent)) {
  intContent = intContent.replace(sendgridRegex, sendgridRepl);
  console.log('[OK] Localized SendGrid description');
} else {
  console.warn('[WARN] SendGrid description regex did not match');
}

// AWS S3
const s3Regex = /<p className="text-sm text-slate-600 mb-4 line-clamp-2">\s*Provides secure, signed-URL access to property passports, contracts, and sensitive ID documents\.\s*<\/p>/;
const s3Repl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'دەستگەیشتنی پارێزراو بە لینکی واژۆکراو بۆ پاسپۆرتی موڵک، گرێبەستەکان و بەڵگەنامە ناسنامەییە هەستیارەکان دابین دەکات.'
                    : language === 'ar'
                    ? 'يوفر وصولاً آمنًا عبر عناوين URL الموقعة لجوازات العقارات والعقود والمستندات الحساسة.'
                    : 'Provides secure, signed-URL access to property passports, contracts, and sensitive ID documents.'}
                </p>`;
if (s3Regex.test(intContent)) {
  intContent = intContent.replace(s3Regex, s3Repl);
  console.log('[OK] Localized AWS S3 description');
} else {
  console.warn('[WARN] AWS S3 description regex did not match');
}

// Twilio
const twilioRegex = /<p className="text-sm text-slate-600 mb-4 line-clamp-2">\s*High-priority alerts for verifications and urgent maintenance requests\.\s*<\/p>/;
const twilioRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'ئاگاداری بەپەلە و خێرا بۆ پشتڕاستکردنەوەکان و داواکارییە بەپەلەکانی چاککردنەوە دەنێرێت.'
                    : language === 'ar'
                    ? 'تنبيهات عالية الأولوية لعمليات التحقق وطلبات الصيانة العاجلة.'
                    : 'High-priority alerts for verifications and urgent maintenance requests.'}
                </p>`;
if (twilioRegex.test(intContent)) {
  intContent = intContent.replace(twilioRegex, twilioRepl);
  console.log('[OK] Localized Twilio description');
} else {
  console.warn('[WARN] Twilio description regex did not match');
}

// DocuSign
const docusignRegex = /<p className="text-sm text-slate-600 mb-4 line-clamp-2">\s*Handles legally binding execution of contracts from Stage 12\.\s*<\/p>/;
const docusignRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'جێبەجێکردنی واژۆی دیجیتاڵی یاسایی و پەسەندکراو بۆ گرێبەستی کرێ و ڕێککەوتننامەکان بەڕێوەدەبات.'
                    : language === 'ar'
                    ? 'يدير التنفيذ الرقمي الملزم قانونياً لاتفاقيات الإيجار والعقود.'
                    : 'Handles legally binding digital execution of lease agreements and contracts.'}
                </p>`;
if (docusignRegex.test(intContent)) {
  intContent = intContent.replace(docusignRegex, docusignRepl);
  console.log('[OK] Localized DocuSign description (removed Stage 12)');
} else {
  console.warn('[WARN] DocuSign description regex did not match');
}

fs.writeFileSync(intFile, intContent, 'utf8');

// 3. I18nProvider.tsx: Add Arabic and Kurdish keys for admin.trust_disputes
const i18nFile = path.join(__dirname, '../src/i18n/I18nProvider.tsx');
let i18nContent = fs.readFileSync(i18nFile, 'utf8');

if (!i18nContent.includes(`'admin.trust_disputes': 'مركز الثقة وفض النزاعات'`)) {
  i18nContent = i18nContent.replace(
    `'role.admin': 'مدير المنصة',`,
    `'role.admin': 'مدير المنصة',\n    'admin.trust_disputes': 'مركز الثقة وفض النزاعات',`
  );
  console.log('[OK] Added Arabic admin.trust_disputes');
}

if (!i18nContent.includes(`'admin.trust_disputes': 'ناوەندی متمانە و ناکۆکییەکان'`)) {
  i18nContent = i18nContent.replace(
    `'role.admin': 'بەڕێوەبەری پلاتفۆرم',`,
    `'role.admin': 'بەڕێوەبەری پلاتفۆرم',\n    'admin.trust_disputes': 'ناوەندی متمانە و ناکۆکییەکان',`
  );
  console.log('[OK] Added Kurdish admin.trust_disputes');
}

fs.writeFileSync(i18nFile, i18nContent, 'utf8');

console.log('\n=== All remaining patches completed! ===');

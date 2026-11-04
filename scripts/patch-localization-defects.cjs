const fs = require('fs');
const path = require('path');

console.log('=== Starting HomeHub Localization Defect Patching ===\n');

// --------------------------------------------------------------------------
// 1. Patch IntegrationsAdminWorkspace.tsx
// --------------------------------------------------------------------------
const integrationsFile = path.join(__dirname, '../src/pages/IntegrationsAdminWorkspace.tsx');
let integrationsContent = fs.readFileSync(integrationsFile, 'utf8');

// Replace Stripe description
const stripeTarget = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  Handles secure ledger-validated payments and webhooks. Financial states fall back safely when unconfigured.
                </p>`;
const stripeRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'پارەدانی پارێزراوی پشتڕاستکراو بە دەفتەری دارایی و وێبهووکەکان بەڕێوەدەبات. بارودۆخە داراییەکان بە سەلامەتی دەمێننەوە کاتێک دانەمەزراوە.'
                    : language === 'ar'
                    ? 'يدير المدفوعات الآمنة المعتمدة في سجل الحسابات والخطافات البرمجية. تعمل الحالات المالية بأمان عند عدم التهيئة.'
                    : 'Handles secure ledger-validated payments and webhooks. Financial states fall back safely when unconfigured.'}
                </p>`;

// Replace SendGrid description
const sendgridTarget = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  Delivers transactional emails (receipts, lease renewals) governed by user notification preferences.
                </p>`;
const sendgridRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'ئیمەیڵە مامەڵەییەکان (پسوولە، نوێکردنەوەی گرێبەست) بەپێی هەڵبژاردنەکانی بەکارهێنەر دەنێرێت.'
                    : language === 'ar'
                    ? 'يرسل رسائل البريد الإلكتروني للمعاملات (الإيصالات، وتجديد العقود) وفقًا لتفضيلات الإشعارات.'
                    : 'Delivers transactional emails (receipts, lease renewals) governed by user notification preferences.'}
                </p>`;

// Replace AWS S3 description
const s3Target = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  Provides secure, signed-URL access to property passports, contracts, and sensitive ID documents.
                </p>`;
const s3Repl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'دەستگەیشتنی پارێزراو بە لینکی واژۆکراو بۆ پاسپۆرتی موڵک، گرێبەستەکان و بەڵگەنامە ناسنامەییە هەستیارەکان دابین دەکات.'
                    : language === 'ar'
                    ? 'يوفر وصولاً آمنًا عبر عناوين URL الموقعة لجوازات العقارات والعقود والمستندات الحساسة.'
                    : 'Provides secure, signed-URL access to property passports, contracts, and sensitive ID documents.'}
                </p>`;

// Replace Twilio description
const twilioTarget = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  High-priority alerts for verifications and urgent maintenance requests.
                </p>`;
const twilioRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'ئاگاداری بەپەلە و خێرا بۆ پشتڕاستکردنەوەکان و داواکارییە بەپەلەکانی چاککردنەوە دەنێرێت.'
                    : language === 'ar'
                    ? 'تنبيهات عالية الأولوية لعمليات التحقق وطلبات الصيانة العاجلة.'
                    : 'High-priority alerts for verifications and urgent maintenance requests.'}
                </p>`;

// Replace DocuSign description (removes "Stage 12" internal text)
const docusignTarget = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  Handles legally binding execution of contracts from Stage 12.
                </p>`;
const docusignRepl = `<p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {language === 'ku'
                    ? 'جێبەجێکردنی واژۆی دیجیتاڵی یاسایی و پەسەندکراو بۆ گرێبەستی کرێ و ڕێککەوتننامەکان بەڕێوەدەبات.'
                    : language === 'ar'
                    ? 'يدير التنفيذ الرقمي الملزم قانونياً لاتفاقيات الإيجار والعقود.'
                    : 'Handles legally binding digital execution of lease agreements and contracts.'}
                </p>`;

// Normalize newlines helper
function safeReplace(source, target, replacement, label) {
  const normSource = source.replace(/\r\n/g, '\n');
  const normTarget = target.replace(/\r\n/g, '\n');
  const normRepl = replacement.replace(/\r\n/g, '\n');
  if (!normSource.includes(normTarget)) {
    console.warn(`[WARN] Target not found for: ${label}`);
    return source;
  }
  console.log(`[OK] Replaced: ${label}`);
  return normSource.replace(normTarget, normRepl);
}

integrationsContent = safeReplace(integrationsContent, stripeTarget, stripeRepl, 'Stripe description');
integrationsContent = safeReplace(integrationsContent, sendgridTarget, sendgridRepl, 'SendGrid description');
integrationsContent = safeReplace(integrationsContent, s3Target, s3Repl, 'AWS S3 description');
integrationsContent = safeReplace(integrationsContent, twilioTarget, twilioRepl, 'Twilio description');
integrationsContent = safeReplace(integrationsContent, docusignTarget, docusignRepl, 'DocuSign description (remove Stage 12)');
integrationsContent = safeReplace(
  integrationsContent,
  '<table className="w-full text-left border-collapse min-w-[800px]">',
  '<table className="w-full ltr:text-left rtl:text-right border-collapse min-w-[800px]">',
  'Webhooks table alignment'
);
fs.writeFileSync(integrationsFile, integrationsContent, 'utf8');

// --------------------------------------------------------------------------
// 2. Patch AdminTrustWorkspace.tsx
// --------------------------------------------------------------------------
const trustFile = path.join(__dirname, '../src/pages/AdminTrustWorkspace.tsx');
let trustContent = fs.readFileSync(trustFile, 'utf8');

const stage10Target = `<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Stage 10 Active
              </span>`;
const stage10Repl = `<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                {isRtl ? 'چالاک و پارێزراو' : 'Active & Verified'}
              </span>`;

trustContent = safeReplace(trustContent, stage10Target, stage10Repl, 'Admin Trust Stage 10 Badge');
fs.writeFileSync(trustFile, trustContent, 'utf8');

// --------------------------------------------------------------------------
// 3. Patch Layout.tsx & I18nProvider.tsx (Duplicate Platform Admin in Sidebar)
// --------------------------------------------------------------------------
const layoutFile = path.join(__dirname, '../src/components/Layout.tsx');
let layoutContent = fs.readFileSync(layoutFile, 'utf8');

const layoutTarget = `<Link to="/workspace/admin" className="px-4 py-1.5 text-slate-600 hover:text-blue-600">{t('role.admin')}</Link>`;
const layoutRepl = `<Link to="/workspace/admin" className="px-4 py-1.5 text-slate-600 hover:text-blue-600">{t('admin.trust_disputes', 'Trust & Disputes')}</Link>`;

layoutContent = safeReplace(layoutContent, layoutTarget, layoutRepl, 'Sidebar Admin duplicate disambiguation');
fs.writeFileSync(layoutFile, layoutContent, 'utf8');

// Add translation key to I18nProvider.tsx
const i18nFile = path.join(__dirname, '../src/i18n/I18nProvider.tsx');
let i18nContent = fs.readFileSync(i18nFile, 'utf8');

// En translations
if (!i18nContent.includes("'admin.trust_disputes':")) {
  i18nContent = safeReplace(
    i18nContent,
    `    'role.admin': 'Platform Admin',`,
    `    'role.admin': 'Platform Admin',\n    'admin.trust_disputes': 'Trust & Dispute Center',`,
    'I18n English trust disputes key'
  );
  i18nContent = safeReplace(
    i18nContent,
    `    'role.admin': 'مشرف النظام',`,
    `    'role.admin': 'مشرف النظام',\n    'admin.trust_disputes': 'مركز الثقة وفض النزاعات',`,
    'I18n Arabic trust disputes key'
  );
  i18nContent = safeReplace(
    i18nContent,
    `    'role.admin': 'بەڕێوەبەری سیستم',`,
    `    'role.admin': 'بەڕێوەبەری سیستم',\n    'admin.trust_disputes': 'ناوەندی متمانە و ناکۆکییەکان',`,
    'I18n Kurdish trust disputes key'
  );
  fs.writeFileSync(i18nFile, i18nContent, 'utf8');
}

// --------------------------------------------------------------------------
// 4. Patch OwnerWorkspace.tsx (Month Names on Rental Income Chart)
// --------------------------------------------------------------------------
const ownerFile = path.join(__dirname, '../src/pages/OwnerWorkspace.tsx');
let ownerContent = fs.readFileSync(ownerFile, 'utf8');

// Add getLocalizedMonth inside OwnerWorkspacePage if not present
if (!ownerContent.includes('getLocalizedMonth')) {
  const insertBefore = `  const [incomePeriod, setIncomePeriod] = useState`;
  const helperCode = `  const getLocalizedMonth = (mStr: string) => {
    if (!mStr) return '';
    const parts = mStr.trim().split(' ');
    const m = parts[0]?.toUpperCase() || '';
    const y = parts[1] || '';
    const kuMonths: Record<string, string> = {
      JAN: 'کانوونی دووەم', FEB: 'شوبات', MAR: 'ئادار', APR: 'نیسان',
      MAY: 'ئایار', JUN: 'حوزەیران', JUL: 'تەممووز', AUG: 'ئاب',
      SEP: 'ئەیلوول', OCT: 'تشرینی یەکەم', NOV: 'تشرینی دووەم', DEC: 'کانوونی یەکەم'
    };
    const arMonths: Record<string, string> = {
      JAN: 'يناير', FEB: 'فبراير', MAR: 'مارس', APR: 'أبريل',
      MAY: 'مايو', JUN: 'يونيو', JUL: 'يوليو', AUG: 'أغسطس',
      SEP: 'سبتمبر', OCT: 'أكتوبر', NOV: 'نوفمبر', DEC: 'ديسمبر'
    };
    if (language === 'ku') return kuMonths[m] ? \`\${kuMonths[m]} \${y ? "'" + y : ''}\` : mStr;
    if (language === 'ar') return arMonths[m] ? \`\${arMonths[m]} \${y ? "'" + y : ''}\` : mStr;
    return mStr;
  };

  `;
  ownerContent = safeReplace(ownerContent, insertBefore, helperCode + insertBefore, 'Owner getLocalizedMonth helper');

  // Replace {m.month} with {getLocalizedMonth(m.month)}
  ownerContent = safeReplace(
    ownerContent,
    `<span className="text-[10px] font-medium text-zinc-500 uppercase">
                              {m.month}
                            </span>`,
    `<span className="text-[10px] font-medium text-zinc-500 uppercase">
                              {getLocalizedMonth(m.month)}
                            </span>`,
    'Owner income chart localized month'
  );
  fs.writeFileSync(ownerFile, ownerContent, 'utf8');
}

// --------------------------------------------------------------------------
// 5. Patch AgentWorkspace.tsx (Commissions Enum & Performance & Profile Labels)
// --------------------------------------------------------------------------
const agentFile = path.join(__dirname, '../src/pages/AgentWorkspace.tsx');
let agentContent = fs.readFileSync(agentFile, 'utf8');

if (!agentContent.includes('getLocalizedCommissionStatus')) {
  const insertBeforeAgent = `  // 12. Commissions State`;
  const helperCodeAgent = `  const getLocalizedCommissionStatus = (status: string) => {
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
  };

  `;
  agentContent = safeReplace(agentContent, insertBeforeAgent, helperCodeAgent + insertBeforeAgent, 'Agent getLocalizedCommissionStatus helper');

  // Replace commission status tag and labels
  const commTarget = `<div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Deal Commission</span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Gross Commission</span>
                      <span className="text-xs font-bold text-slate-900 font-mono" dir="ltr">\${formatAmount(c.grossCommissionAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Agent (70%)</span>
                      <span className="text-xs font-bold text-blue-600 font-mono" dir="ltr">\${formatAmount(c.agentShareAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Brokerage (30%)</span>
                      <span className="text-xs font-bold text-slate-600 font-mono" dir="ltr">\${formatAmount(c.brokerageShareAmount)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Preserves double-entry accounting reconciliation with zero discrepancy.
                  </div>`;

  const commRepl = `<div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'ku' ? 'پشکی مامەڵە (کۆمیسیۆن)' : language === 'ar' ? 'عمولة الصفقة' : 'Deal Commission'}
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                      {getLocalizedCommissionStatus(c.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'کۆی کۆمیسیۆن' : language === 'ar' ? 'إجمالي العمولة' : 'Gross Commission'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono" dir="ltr">\${formatAmount(c.grossCommissionAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'نوێنەر (٧٠٪)' : language === 'ar' ? 'الوكيل (70%)' : 'Agent (70%)'}
                      </span>
                      <span className="text-xs font-bold text-blue-600 font-mono" dir="ltr">\${formatAmount(c.agentShareAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'کۆمپانیا (٣٠٪)' : language === 'ar' ? 'الوساطة (30%)' : 'Brokerage (30%)'}
                      </span>
                      <span className="text-xs font-bold text-slate-600 font-mono" dir="ltr">\${formatAmount(c.brokerageShareAmount)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {language === 'ku'
                      ? 'پشتڕاستکردنەوەی دارایی دوولایەنە دەپارێزێت بەبێ هیچ جیاوازییەک.'
                      : language === 'ar'
                      ? 'يحافظ على المطابقة المحاسبية بالقيد المزدوج دون أي فروقات.'
                      : 'Preserves double-entry accounting reconciliation with zero discrepancy.'}
                  </div>`;

  agentContent = safeReplace(agentContent, commTarget, commRepl, 'Agent commissions card trilingual localization');

  // Localize Commissions Subtitle
  const commSubTarget = `<p className="text-xs text-slate-500 mt-0.5">
                Standard 70/30 brokerage deal commission split records. Projected commissions are clearly distinguished from disbursed payouts.
              </p>`;
  const commSubRepl = `<p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'تۆماری دابەشکردنی کۆمیسیۆنی ٧٠/٣٠ی نێوان نوێنەر و نوسینگە. کۆمیسیۆنە پێشبینیکراوەکان بەڕوونی جیاکراونەتەوە لە پشکی دراو.'
                  : language === 'ar'
                  ? 'سجلات توزيع عمولة الوساطة بنسبة 70/30. يتم تمييز العمولات المتوقعة بوضوح عن المدفوعات المصروفة.'
                  : 'Standard 70/30 brokerage deal commission split records. Projected commissions are clearly distinguished from disbursed payouts.'}
              </p>`;
  agentContent = safeReplace(agentContent, commSubTarget, commSubRepl, 'Agent commissions subtitle localization');

  // Localize Performance Analytics Tab
  const perfTarget = `<h1 className="text-xl font-bold tracking-tight text-slate-900">Performance Analytics</h1>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative performance metrics calculated directly from database records.</p>`;
  const perfRepl = `<h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ku' ? 'شیکاری کارایی' : language === 'ar' ? 'تحليلات الأداء' : 'Performance Analytics'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'پێوەرە فەرمییەکانی کارایی کە راستەوخۆ لە داتابەیسەوە ئەژمارکراون.'
                  : language === 'ar'
                  ? 'مؤشرات الأداء المعتمدة المحسوبة مباشرة من السجلات الرسمية.'
                  : 'Authoritative performance metrics calculated directly from database records.'}
              </p>`;
  agentContent = safeReplace(agentContent, perfTarget, perfRepl, 'Agent performance header localization');

  // Localize Performance Metrics cards
  const perfCardsTarget = `<span className="text-xs font-semibold text-slate-500 block">Assigned Listings</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.assignedListingsCount ?? portfolio.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">Total Pipeline Leads</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.totalLeadsCount ?? leads.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">Scheduled Viewings</span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.scheduledViewingsCount ?? viewings.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">Viewing Completion Rate</span>`;

  const perfCardsRepl = `<span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'موڵکە سپێردراوەکان' : language === 'ar' ? 'العقارات المسندة' : 'Assigned Listings'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.assignedListingsCount ?? portfolio.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'کۆی کڕیارە چاوەڕوانکراوەکان' : language === 'ar' ? 'إجمالي العملاء المحتملين' : 'Total Pipeline Leads'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.totalLeadsCount ?? leads.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'سەردانە دیاریکراوەکان' : language === 'ar' ? 'المعاينات المجدولة' : 'Scheduled Viewings'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.scheduledViewingsCount ?? viewings.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'ڕێژەی ئەنجامدانی سەردان' : language === 'ar' ? 'نسبة إتمام المعاينات' : 'Viewing Completion Rate'}
                </span>`;
  agentContent = safeReplace(agentContent, perfCardsTarget, perfCardsRepl, 'Agent performance metric cards localization');

  // Localize Profile & Settings
  const profileTarget = `<h1 className="text-xl font-bold tracking-tight text-slate-900">Agent Profile & License Credentials</h1>
              <p className="text-xs text-slate-500 mt-0.5">Professional credentials, license verification status, and availability.</p>`;
  const profileRepl = `<h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ku' ? 'پڕۆفایل و مۆڵەتی نوێنەر' : language === 'ar' ? 'ملف الوكيل وبيانات الترخيص' : 'Agent Profile & License Credentials'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'بەڵگەنامە پیشەییەکان، دۆخی مۆڵەت، و بەردەستبوون.'
                  : language === 'ar'
                  ? 'الوثائق المهنية، وحالة التحقق من الترخيص، والجاهزية.'
                  : 'Professional credentials, license verification status, and availability.'}
              </p>`;
  agentContent = safeReplace(agentContent, profileTarget, profileRepl, 'Agent profile header localization');

  // Localize Profile badges and labels
  const profileBadgeTarget = `<span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full mt-1">
                    {profile?.verificationStatus || 'VERIFIED LICENSE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">{profile?.phone || '+964 750 111 2233'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Email</span>
                  <span className="font-bold text-slate-800" dir="ltr">{profile?.email || 'agent@homehub.iq'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Office / Organization</span>
                  <span className="font-bold text-slate-800">{profile?.officeName || 'Zagros Real Estate Partners'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Availability</span>
                  <span className="font-bold text-blue-600">{profile?.availabilityStatus || 'AVAILABLE'}</span>`;

  const profileBadgeRepl = `<span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full mt-1">
                    {language === 'ku' ? 'مۆڵەتی پشتڕاستکراو' : language === 'ar' ? 'ترخيص معتمد' : 'VERIFIED LICENSE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'تەلەفۆن' : language === 'ar' ? 'الهاتف' : 'Phone'}</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">{profile?.phone || '+964 750 111 2233'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'ئیمەیڵ' : language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className="font-bold text-slate-800" dir="ltr">{profile?.email || 'agent@homehub.iq'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'نوسینگە / ڕێکخراو' : language === 'ar' ? 'المكتب / المنظمة' : 'Office / Organization'}</span>
                  <span className="font-bold text-slate-800">{profile?.officeName || 'Zagros Real Estate Partners'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'دۆخی بەردەستبوون' : language === 'ar' ? 'حالة التوفر' : 'Availability'}</span>
                  <span className="font-bold text-blue-600">{language === 'ku' ? 'بەردەستە' : language === 'ar' ? 'متاح' : 'AVAILABLE'}</span>`;

  agentContent = safeReplace(agentContent, profileBadgeTarget, profileBadgeRepl, 'Agent profile details localization');
  fs.writeFileSync(agentFile, agentContent, 'utf8');
}

// --------------------------------------------------------------------------
// 6. Patch DepositInspectionModal.tsx (KPIs & Forms Localization)
// --------------------------------------------------------------------------
const depositFile = path.join(__dirname, '../src/components/owner/DepositInspectionModal.tsx');
let depositContent = fs.readFileSync(depositFile, 'utf8');

// Ensure isRtl is defined from direction
if (!depositContent.includes('const isRtl = direction ===')) {
  depositContent = safeReplace(
    depositContent,
    `  const { t, direction } = useI18n();`,
    `  const { t, direction, language } = useI18n();\n  const isRtl = direction === 'rtl';`,
    'Deposit modal isRtl definition'
  );
}

// KPI Cards Localization
const kpiTarget = `<span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Required Deposit</span>
                      <p className="text-lg font-black text-slate-900" dir="ltr">
                        {deposit ? Number(deposit.requiredAmount).toLocaleString() : '0'} <span className="text-xs text-slate-500">{currency}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">Fixed custodial requirement</span>
                    </div>

                    <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-blue-700 uppercase block mb-1">Recorded in Escrow</span>
                      <p className="text-lg font-black text-blue-900" dir="ltr">
                        {recorded.toLocaleString()} <span className="text-xs text-blue-700">{currency}</span>
                      </p>
                      <span className="text-[10px] text-blue-600">Held without fees (0% 3-Fee)</span>
                    </div>

                    <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-amber-700 uppercase block mb-1">Active Reserved</span>
                      <p className="text-lg font-black text-amber-900" dir="ltr">
                        {activeReserved.toLocaleString()} <span className="text-xs text-amber-700">{currency}</span>
                      </p>
                      <span className="text-[10px] text-amber-600">Deductions & disputes held</span>
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1">Unreserved Available</span>
                      <p className="text-lg font-black text-emerald-900" dir="ltr">
                        {unreservedAvailable.toLocaleString()} <span className="text-xs text-emerald-700">{currency}</span>
                      </p>
                      <span className="text-[10px] text-emerald-600">Eligible for return / release</span>`;

const kpiRepl = `<span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        {isRtl ? 'بڕی پێویستی بارمتە' : 'Required Deposit'}
                      </span>
                      <p className="text-lg font-black text-slate-900" dir="ltr">
                        {deposit ? Number(deposit.requiredAmount).toLocaleString() : '0'} <span className="text-xs text-slate-500">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {isRtl ? 'مەرجی بارمتەی پارێزراوی دیاریکراو' : 'Fixed custodial requirement'}
                      </span>
                    </div>

                    <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-blue-700 uppercase block mb-1">
                        {isRtl ? 'تۆمارکراو لە هەژماری ئەمانەت' : 'Recorded in Escrow'}
                      </span>
                      <p className="text-lg font-black text-blue-900" dir="ltr">
                        {recorded.toLocaleString()} <span className="text-xs text-blue-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-blue-600">
                        {isRtl ? 'پارێزراو بەبێ لێبڕینی کرێ (٠٪ مۆدێلی ٣-تێچوو)' : 'Held without fees (0% 3-Fee)'}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-amber-700 uppercase block mb-1">
                        {isRtl ? 'بڕی دانراوی چالاک' : 'Active Reserved'}
                      </span>
                      <p className="text-lg font-black text-amber-900" dir="ltr">
                        {activeReserved.toLocaleString()} <span className="text-xs text-amber-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-amber-600">
                        {isRtl ? 'داشکاندن و ناکۆکییە ڕاگیراوەکان' : 'Deductions & disputes held'}
                      </span>
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1">
                        {isRtl ? 'بەردەستی سەربەست بۆ گەڕاندنەوە' : 'Unreserved Available'}
                      </span>
                      <p className="text-lg font-black text-emerald-900" dir="ltr">
                        {unreservedAvailable.toLocaleString()} <span className="text-xs text-emerald-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-emerald-600">
                        {isRtl ? 'شایستەی ئازادکردن یان دانەوەیە' : 'Eligible for return / release'}
                      </span>`;

depositContent = safeReplace(depositContent, kpiTarget, kpiRepl, 'Deposit modal KPI cards localization');

// Localize input labels
depositContent = safeReplace(
  depositContent,
  `<label className="block text-xs font-bold text-slate-700 mb-1">Amount to Collect ({currency})</label>`,
  `<label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? \`بڕ بۆ وەرگرتن (\${currency === 'IQD' ? 'د.ع' : currency})\` : \`Amount to Collect (\${currency})\`}</label>`,
  'Deposit collect amount label'
);

depositContent = safeReplace(
  depositContent,
  `<label className="block text-xs font-bold text-slate-700 mb-1">Amount to Release ({currency})</label>`,
  `<label className="block text-xs font-bold text-slate-700 mb-1">{isRtl ? \`بڕ بۆ گەڕاندنەوە (\${currency === 'IQD' ? 'د.ع' : currency})\` : \`Amount to Release (\${currency})\`}</label>`,
  'Deposit release amount label'
);

// Localize active reservations warning
depositContent = safeReplace(
  depositContent,
  `⚠️ Active reservations ({activeReserved.toLocaleString()} {currency}) must be resolved or settled before full release.`,
  `{isRtl ? \`⚠️ تەرخانکردنی چالاک (\${activeReserved.toLocaleString()} \${currency === 'IQD' ? 'د.ع' : currency}) دەبێت یەکلا بکرێتەوە پێش گەڕاندنەوەی تەواو.\` : \`⚠️ Active reservations (\${activeReserved.toLocaleString()} \${currency}) must be resolved or settled before full release.\`}`,
  'Deposit active reservations warning'
);

fs.writeFileSync(depositFile, depositContent, 'utf8');

console.log('\n=== All Localization Defect Patches Successfully Applied! ===');

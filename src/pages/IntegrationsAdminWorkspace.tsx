import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { 
  Server, 
  Zap, 
  ShieldCheck, 
  AlertCircle, 
  Link as LinkIcon, 
  Key, 
  Activity, 
  CreditCard, 
  Mail, 
  MessageSquare, 
  Database, 
  FileText,
  RefreshCw
} from 'lucide-react';

export const IntegrationsAdminWorkspacePage: React.FC = () => {
  const { t, language, direction } = useI18n();
  const isRtl = direction === 'rtl';
  const [activeTab, setActiveTab] = useState<'providers' | 'webhooks'>('providers');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getTabTitle = (tab: 'providers' | 'webhooks') => {
    switch (tab) {
      case 'providers':
        return isRtl ? 'دابینکەرانی دەرەکی' : 'Infrastructure Providers';
      case 'webhooks':
        return isRtl ? 'ڕووداوەکانی وێبهووک' : 'Webhook Events';
      default:
        return tab;
    }
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Integrations Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Integrations"
            aria-label="HomeHub Integrations"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Integrations Navigation"
          >
            {/* Providers Tab */}
            <button
              type="button"
              data-testid="integrations-tab-providers"
              onClick={() => setActiveTab('providers')}
              title={isRtl ? 'دابینکەرانی دەرەکی' : 'Providers'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'providers'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'providers' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Server className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'providers' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'دابینکەر' : 'Providers'}
              </span>
              <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-bold flex items-center justify-center">
                5
              </span>
            </button>

            {/* Webhooks Tab */}
            <button
              type="button"
              data-testid="integrations-tab-webhooks"
              onClick={() => setActiveTab('webhooks')}
              title={isRtl ? 'وێبهووکەکان' : 'Webhooks'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'webhooks'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'webhooks' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Zap className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'webhooks' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'وێبهووک' : 'Webhooks'}
              </span>
              <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                2
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Refresh */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={isRtl ? 'نوێکردنەوەی دۆخ' : 'Refresh Status'}
            aria-label="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 text-slate-950 font-bold ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT COLUMN (Minimal Header + Content Area)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Minimal Clean Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex md:hidden items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs">
                HH
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('providers')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {isRtl ? 'بەڕێوەبردنی سیستم' : 'System Administration'}
              </button>
              <span className="text-slate-600">/</span>
              <button
                type="button"
                onClick={() => setActiveTab('providers')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {isRtl ? 'بەستەر و API دەرەکییەکان' : 'Integrations & External APIs'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isRtl ? 'پارێزراوی واژۆ چالاکە' : 'Signature Validation Active'}
            </span>
            <button 
              onClick={handleRefresh}
              className="p-2 border border-slate-800 rounded-xl text-slate-300 bg-[#080d19] hover:bg-[#111b2e] transition cursor-pointer"
              title={isRtl ? 'نوێکردنەوە' : 'Refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Navigation (< md) */}
        <div className="md:hidden flex border-b border-slate-800 overflow-x-auto px-4 py-2 bg-[#0c1322]">
          {[
            { id: 'providers', label: isRtl ? 'دابینکەران' : 'Providers', icon: Server },
            { id: 'webhooks', label: isRtl ? 'وێبهووک' : 'Webhooks', icon: Zap },
          ].map(tTab => {
            const Icon = tTab.icon;
            return (
              <button
                key={tTab.id}
                onClick={() => setActiveTab(tTab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                  activeTab === tTab.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tTab.label}
              </button>
            );
          })}
        </div>

        {/* Workspace Body */}
        <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6 w-full">
          
          {/* Header Banner Card */}
          <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 end-0 p-6 opacity-10 pointer-events-none">
              <LinkIcon className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{t('integration.title')}</h1>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                {t('integration.subtitle', 'Real-World Infrastructure & External APIs')}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'providers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              
              {/* Payment Provider Card */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-5 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="bg-slate-800 p-2.5 rounded-lg text-amber-400 border border-slate-700">
                         <CreditCard className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-bold text-white">Stripe</h3>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('integration.payment')}</p>
                       </div>
                     </div>
                     <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('integration.not_configured')}</span>
                   </div>
                   <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {language === 'ku'
                        ? 'پارەدانی پارێزراوی پشتڕاستکراو بە دەفتەری دارایی و وێبهووکەکان بەڕێوەدەبات. بارودۆخە داراییەکان بە سەلامەتی دەمێننەوە کاتێک دانەمەزراوە.'
                        : language === 'ar'
                        ? 'يدير المدفوعات الآمنة المعتمدة في سجل الحسابات والخطافات البرمجية. تعمل الحالات المالية بأمان عند عدم التهيئة.'
                        : 'Handles secure ledger-validated payments and webhooks. Financial states fall back safely when unconfigured.'}
                    </p>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-sm font-medium text-amber-400 hover:underline flex items-center gap-1"><Key className="w-4 h-4"/> {t('integration.configure_keys', 'Configure Keys')}</button>
                   <span className="text-xs text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> {t('property.unknown', 'Unknown')}</span>
                 </div>
              </div>

              {/* Email Provider Card */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-5 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="bg-blue-500/20 p-2.5 rounded-lg text-blue-400 border border-blue-500/30">
                         <Mail className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-bold text-white">SendGrid</h3>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('integration.email_notif', 'EMAIL NOTIFICATIONS')}</p>
                       </div>
                     </div>
                     <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('integration.configured', 'CONFIGURED')}</span>
                   </div>
                   <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {language === 'ku'
                        ? 'ئیمەیڵە مامەڵەییەکان (پسوولە، نوێکردنەوەی گرێبەست) بەپێی هەڵبژاردنەکانی بەکارهێنەر دەنێرێت.'
                        : language === 'ar'
                        ? 'يرسل رسائل البريد الإلكتروني للمعاملات (الإيصالات، وتجديد العقود) وفقًا لتفضيلات الإشعارات.'
                        : 'Delivers transactional emails (receipts, lease renewals) governed by user notification preferences.'}
                    </p>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-sm font-medium text-slate-300 hover:underline flex items-center gap-1">{t('integration.manage_settings', 'Manage Settings')}</button>
                   <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> {t('integration.healthy')}</span>
                 </div>
              </div>

              {/* Storage Provider Card */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-5 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="bg-amber-500/20 p-2.5 rounded-lg text-amber-400 border border-amber-500/30">
                         <Database className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-bold text-white">AWS S3</h3>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('integration.storage')}</p>
                       </div>
                     </div>
                     <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('integration.not_configured')}</span>
                   </div>
                   <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {language === 'ku'
                        ? 'دەستگەیشتنی پارێزراو بە لینکی واژۆکراو بۆ پاسپۆرتی موڵک، گرێبەستەکان و بەڵگەنامە ناسنامەییە هەستیارەکان دابین دەکات.'
                        : language === 'ar'
                        ? 'يوفر وصولاً آمنًا عبر عناوين URL الموقعة لجوازات العقارات والعقود والمستندات الحساسة.'
                        : 'Provides secure, signed-URL access to property passports, contracts, and sensitive ID documents.'}
                    </p>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-sm font-medium text-amber-400 hover:underline flex items-center gap-1"><Key className="w-4 h-4"/> {t('integration.configure_keys', 'Configure Keys')}</button>
                   <span className="text-xs text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> {t('property.unknown', 'Unknown')}</span>
                 </div>
              </div>

              {/* SMS Provider Card */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-5 flex flex-col justify-between opacity-80">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="bg-rose-500/20 p-2.5 rounded-lg text-rose-400 border border-rose-500/30">
                         <MessageSquare className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-bold text-white">Twilio</h3>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('integration.sms_provider', 'SMS PROVIDER')}</p>
                       </div>
                     </div>
                     <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('integration.not_configured')}</span>
                   </div>
                   <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {language === 'ku'
                        ? 'ئاگاداری بەپەلە و خێرا بۆ پشتڕاستکردنەوەکان و داواکارییە بەپەلەکانی چاککردنەوە دەنێرێت.'
                        : language === 'ar'
                        ? 'تنبيهات عالية الأولوية لعمليات التحقق وطلبات الصيانة العاجلة.'
                        : 'High-priority alerts for verifications and urgent maintenance requests.'}
                    </p>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-sm font-medium text-amber-400 hover:underline flex items-center gap-1"><Key className="w-4 h-4"/> {t('integration.configure_keys', 'Configure Keys')}</button>
                   <span className="text-xs text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> {t('property.unknown', 'Unknown')}</span>
                 </div>
              </div>

              {/* E-Signature Card */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-5 flex flex-col justify-between opacity-80">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="bg-purple-500/20 p-2.5 rounded-lg text-purple-400 border border-purple-500/30">
                         <FileText className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-bold text-white">DocuSign</h3>
                         <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('integration.esignature', 'E-SIGNATURE')}</p>
                       </div>
                     </div>
                     <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('integration.not_configured')}</span>
                   </div>
                   <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {language === 'ku'
                        ? 'جێبەجێکردنی واژۆی دیجیتاڵی یاسایی و پەسەندکراو بۆ گرێبەستی کرێ و ڕێککەوتننامەکان بەڕێوەدەبات.'
                        : language === 'ar'
                        ? 'يدير التنفيذ الرقمي الملزم قانونياً لاتفاقيات الإيجار والعقود.'
                        : 'Handles legally binding digital execution of lease agreements and contracts.'}
                    </p>
                 </div>
                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-sm font-medium text-amber-400 hover:underline flex items-center gap-1"><Key className="w-4 h-4"/> {t('integration.configure_keys', 'Configure Keys')}</button>
                   <span className="text-xs text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> {t('property.unknown', 'Unknown')}</span>
                 </div>
              </div>

            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md overflow-hidden">
              <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Zap className="w-5 h-5 text-amber-400" />
                   {t('Recent Webhook Events', 'Recent Webhook Events')}
                 </h3>
                 <div className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                   <ShieldCheck className="w-4 h-4 text-emerald-400" /> {t('Signature Validation Active', 'Signature Validation Active')}
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full ltr:text-left rtl:text-right border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 bg-slate-900/40">
                      <th className="p-4 font-semibold">{t('Provider', 'Provider')}</th>
                      <th className="p-4 font-semibold">{t('Event Type', 'Event Type')}</th>
                      <th className="p-4 font-semibold">{t('Event ID', 'Event ID')}</th>
                      <th className="p-4 font-semibold">{t('core.status', 'Status')}</th>
                      <th className="p-4 font-semibold">{t('Timestamp', 'Timestamp')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-300 divide-y divide-slate-800/60">
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">Stripe</td>
                      <td className="p-4"><code className="bg-slate-800 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded text-xs">payment_intent.succeeded</code></td>
                      <td className="p-4 text-amber-400/90 font-mono text-xs">evt_12398410023</td>
                      <td className="p-4">
                        <span className="text-rose-400 font-bold bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded text-xs flex items-center w-max gap-1">
                          <AlertCircle className="w-3 h-3"/> {t('INVALID_SIGNATURE', 'INVALID_SIGNATURE')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{t('Today, 10:15 AM', 'Today, 10:15 AM')}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">SendGrid</td>
                      <td className="p-4"><code className="bg-slate-800 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-xs">email.delivered</code></td>
                      <td className="p-4 text-amber-400/90 font-mono text-xs">evt_99182310111</td>
                      <td className="p-4">
                        <span className="text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded text-xs flex items-center w-max gap-1">
                          <ShieldCheck className="w-3 h-3"/> {t('PROCESSED', 'PROCESSED')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{t('Yesterday, 04:30 PM', 'Yesterday, 04:30 PM')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

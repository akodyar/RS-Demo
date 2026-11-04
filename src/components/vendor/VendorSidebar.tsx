import React from 'react';
import {
  Wrench,
  LayoutDashboard,
  Calendar,
  FileText,
  DollarSign,
  CheckCircle2,
  Star,
  TrendingUp,
  MapPin,
  Clock,
  MessageSquare,
  Layers,
  X,
  Sparkles,
  ShieldCheck,
  LogOut,
  Briefcase,
  Users,
  Building,
  FolderCheck,
  CheckSquare,
  Settings,
  Flame,
  Globe,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface VendorProfileData {
  id?: string;
  displayName: string;
  businessName: string;
  categories: string[];
  specialties: string[];
  serviceAreas: string[];
  workingHours: string;
  emergencyAvailable: boolean;
}

interface VendorSidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  profile: VendorProfileData;
  rating: number;
  reviewCount: number;
  unreadMessagesCount?: number;
  pendingQuotesCount?: number;
  pendingPaymentsCount?: number;
  openRequestsCount?: number;
  tasksCount?: number;
  onOpenAiAssistant: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  onLogout?: () => void;
}

export const VendorSidebar: React.FC<VendorSidebarProps> = ({
  activeNav,
  setActiveNav,
  mobileMenuOpen,
  setMobileMenuOpen,
  profile,
  rating,
  reviewCount,
  unreadMessagesCount = 5,
  pendingQuotesCount = 2,
  pendingPaymentsCount = 0,
  openRequestsCount = 3,
  tasksCount = 4,
  onOpenAiAssistant,
  onOpenWorkspaceSwitcher,
  onLogout,
}) => {
  const { t, direction, language, setLanguage } = useI18n();

  const handleNavClick = (nav: string) => {
    setActiveNav(nav);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        id="vendor-navigation-rail"
        className="hidden lg:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Vendor Workspace Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Vendor Pro"
            aria-label="HomeHub Vendor Pro"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Vendor Navigation"
          >
            {/* 1. Dashboard */}
            <button
              type="button"
              data-testid="vendor-tab-dashboard"
              onClick={() => handleNavClick('dashboard')}
              title={t('vendor.dashboard', 'Dashboard')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'dashboard' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <LayoutDashboard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'dashboard' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'داشبۆرد' : language === 'ar' ? 'الرئيسية' : 'Dashboard'}
              </span>
            </button>

            {/* 2. Requests */}
            <button
              type="button"
              data-testid="vendor-tab-requests"
              onClick={() => handleNavClick('requests')}
              title={t('vendor.nav_requests', 'Service Requests')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'requests'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'requests' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wrench className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'requests' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'داواکاری' : language === 'ar' ? 'الطلبات' : 'Requests'}
              </span>
              {openRequestsCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {openRequestsCount}
                </span>
              )}
            </button>

            {/* 3. Work Orders */}
            <button
              type="button"
              data-testid="vendor-tab-work-orders"
              onClick={() => handleNavClick('work-orders')}
              title={t('vendor.nav_work_orders', 'Work Orders')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'work-orders'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'work-orders' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CheckSquare className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'work-orders' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'فەرمان' : language === 'ar' ? 'الأوامر' : 'Orders'}
              </span>
            </button>

            {/* 4. Schedule */}
            <button
              type="button"
              data-testid="vendor-tab-schedule"
              onClick={() => handleNavClick('schedule')}
              title={t('vendor.nav_scheduled', 'Scheduled Jobs')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'schedule'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'schedule' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Calendar className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'schedule' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'خشتە' : language === 'ar' ? 'الجدول' : 'Schedule'}
              </span>
            </button>

            {/* 5. Quotes */}
            <button
              type="button"
              data-testid="vendor-tab-quotes"
              onClick={() => handleNavClick('quotes')}
              title={t('vendor.nav_quotes', 'Quotes & Estimates')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'quotes'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'quotes' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'quotes' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'تێچوو' : language === 'ar' ? 'التسعير' : 'Quotes'}
              </span>
              {pendingQuotesCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {pendingQuotesCount}
                </span>
              )}
            </button>

            {/* 6. Invoices */}
            <button
              type="button"
              onClick={() => handleNavClick('invoices')}
              title={t('vendor.nav_invoices', 'Invoices')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'invoices'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'invoices' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <DollarSign className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'invoices' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'پسوولە' : language === 'ar' ? 'الفواتير' : 'Invoices'}
              </span>
            </button>

            {/* 7. Messages */}
            <button
              type="button"
              onClick={() => handleNavClick('messages')}
              title={t('vendor.nav_messages', 'Messages')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'messages'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'messages' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <MessageSquare className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'messages' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'پەیام' : language === 'ar' ? 'الرسائل' : 'Messages'}
              </span>
              {unreadMessagesCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            {/* 8. Profile */}
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              title={t('vendor.nav_profile', 'Profile')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'profile'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'profile' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'profile' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'پڕۆفایل' : language === 'ar' ? 'الملف' : 'Profile'}
              </span>
            </button>

            {/* 9. Settings */}
            <button
              type="button"
              onClick={() => handleNavClick('settings')}
              title={t('vendor.nav_settings', 'Settings')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeNav === 'settings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeNav === 'settings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Settings className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeNav === 'settings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕێکخستن' : language === 'ar' ? 'الإعدادات' : 'Settings'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: AI Co-Pilot */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={onOpenAiAssistant}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="AI Co-Pilot"
            aria-label="AI Co-Pilot"
          >
            <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* Vendor Navigation Mobile Slide-over Drawer (< lg) */}
      <aside
        id="vendor-navigation-sidebar"
        className={`
          fixed top-0 z-50 lg:hidden
          h-screen lg:h-auto lg:max-h-[calc(100vh-6rem)]
          w-72 lg:w-64 xl:w-72 shrink-0
          bg-[#0B1528] text-slate-300
          flex flex-col rounded-none lg:rounded-2xl
          shadow-xl lg:shadow-sm border-e lg:border border-slate-800
          transition-transform duration-300 ease-in-out
          ${
            mobileMenuOpen
              ? 'translate-x-0'
              : direction === 'rtl'
              ? 'translate-x-full lg:translate-x-0'
              : '-translate-x-full lg:translate-x-0'
          }
          ${direction === 'rtl' ? 'right-0 lg:right-auto' : 'left-0 lg:left-auto'}
        `}
      >
        {/* 1. Brand / Workspace Identity */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-black text-base text-white tracking-tight">
                <span>{t('vendor.portal_name', 'HomeHub Pro')}</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                  {t('vendor.badge_vendor', 'Vendor')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {t('vendor.portal_subtitle', 'Contractor Operations & Ledger')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label={t('vendor.close_navigation', 'Close Navigation')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Vendor Profile Card */}
        <div className="p-3.5 mx-3 mt-3 rounded-xl bg-[#132238] border border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
                alt={profile.displayName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/80"
              />
              <span
                className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-[#132238] ${
                  profile.emergencyAvailable ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={
                  profile.emergencyAvailable
                    ? t('vendor.tooltip_emergency_active', '24/7 Emergency Dispatch Active')
                    : t('vendor.tooltip_standard_hours', 'Standard Business Hours')
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white truncate">{profile.displayName}</h4>
                <span className="px-1 py-0.2 text-[9px] font-bold bg-blue-500/20 text-blue-400 rounded">
                  ✓
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{profile.businessName}</p>
              <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                <Star className="w-3 h-3 fill-amber-400 shrink-0" />
                <span className="font-bold">{rating}</span>
                <span className="text-[10px] text-slate-400">({reviewCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Navigation Groups (Scrollable) */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs font-medium scrollbar-thin scrollbar-thumb-slate-700">
          {/* Main Dashboard */}
          <div>
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('vendor.dashboard', 'Dashboard')}</span>
            </button>
          </div>

          {/* Group: Jobs & Work Orders */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_jobs', 'Jobs & Work Orders')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('requests')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'requests'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{t('vendor.nav_requests', 'Service Requests')}</span>
                </div>
                {openRequestsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full shrink-0">
                    {openRequestsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('work-orders')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'work-orders'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_work_orders', 'My Work Orders')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('schedule')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'schedule'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_scheduled', 'Scheduled Jobs')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('completed')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'completed'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_completed', 'Completed Jobs')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('quotes')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'quotes'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{t('vendor.nav_quotes', 'Quotes & Estimates')}</span>
                </div>
                {pendingQuotesCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full shrink-0">
                    {pendingQuotesCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Group: Clients & Operations */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_clients', 'Clients & Properties')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('clients')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'clients'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_clients', 'Clients')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('properties')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'properties'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_properties', 'Properties')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('messages')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'messages'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{t('vendor.nav_messages', 'Messages')}</span>
                </div>
                {unreadMessagesCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full shrink-0">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Group: Services & Coverage */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_services', 'Services & Coverage')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('categories')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'categories'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_categories', 'Service Categories')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('availability')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'availability'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_availability', 'Availability & Hours')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('areas')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'areas'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_areas', 'Service Areas')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('team')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'team'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_team', 'My Team')}</span>
              </button>
            </div>
          </div>

          {/* Group: Financial */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_financial', 'Financial & Earnings')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('invoices')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'invoices'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_invoices', 'Invoices')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('payments')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'payments'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{t('vendor.nav_payments', 'Payments')}</span>
                </div>
                {pendingPaymentsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full shrink-0">
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('earnings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'earnings'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_earnings', 'Earnings & Reports')}</span>
              </button>
            </div>
          </div>

          {/* Group: Tools */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_tools', 'Tools')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('calendar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'calendar'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_calendar', 'Calendar')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('tasks')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'tasks'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{t('vendor.nav_tasks', 'Tasks')}</span>
                </div>
                {tasksCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full shrink-0">
                    {tasksCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('documents')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'documents'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <FolderCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_documents', 'Documents')}</span>
              </button>

              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-blue-400 hover:bg-blue-600/10 hover:text-blue-300 transition-all font-semibold cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{t('vendor.ai_assistant', 'AI Advisory Co-Pilot')}</span>
              </button>
            </div>
          </div>

          {/* Group: Profile & Verification */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t('vendor.group_profile', 'Account & Verification')}
            </span>
            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'profile'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_profile', 'Vendor Profile')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('verification')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'verification'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_verification', 'Verification & License')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('reviews')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'reviews'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Star className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_reviews', 'Reviews & Ratings')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  activeNav === 'settings'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{t('vendor.nav_settings', 'Settings')}</span>
              </button>
            </div>
          </div>
        </nav>

        {/* 4. Localization Navigator & Language Selector */}
        <div id="vendor-sidebar-localization-navigator" className="p-3 border-t border-slate-800 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('common.language', 'Language')}</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-mono">{language}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-[#132238] p-1 rounded-xl border border-slate-800 text-xs font-bold" dir="ltr">
            {(['ku', 'ar', 'en'] as const).map((lang) => (
              <button
                key={lang}
                id={`vendor-sidebar-lang-${lang}`}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`py-1.5 rounded-lg text-center transition-all cursor-pointer text-[11px] ${
                  language === lang
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={lang === 'ku' ? 'کوردی (سۆرانی)' : lang === 'ar' ? 'العربية' : 'English'}
              >
                {lang === 'ku' ? 'کوردی' : lang === 'ar' ? 'عربي' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace Switcher in Sidebar */}
        {onOpenWorkspaceSwitcher && (
          <div className="p-3 pb-0 border-t border-slate-800 shrink-0">
            <button
              id="vendor-sidebar-switch-workspace-btn"
              type="button"
              onClick={onOpenWorkspaceSwitcher}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-blue-400 hover:text-white hover:bg-blue-900/30 border border-blue-900/50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 shrink-0 text-blue-400" />
              <span>{t('workspace.switch_button', 'گۆڕینی شوێنی کار')}</span>
            </button>
          </div>
        )}

        {/* 5. Account Actions / Sign Out */}
        {onLogout && (
          <div className="p-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t('vendor.sign_out', t('action.sign_out', 'Log Out'))}</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

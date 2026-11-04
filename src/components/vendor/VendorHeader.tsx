import React from 'react';
import { Search, MapPin, Sparkles, Menu, ChevronRight, Globe, Users } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface VendorHeaderProps {
  activeNav: string;
  onToggleMobileMenu: () => void;
  onOpenAiAssistant: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  serviceAreaLabel?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const VendorHeader: React.FC<VendorHeaderProps> = ({
  activeNav,
  onToggleMobileMenu,
  onOpenAiAssistant,
  onOpenWorkspaceSwitcher,
  serviceAreaLabel,
  searchQuery = '',
  onSearchChange,
}) => {
  const { t, direction, language, setLanguage } = useI18n();
  const currentServiceArea = serviceAreaLabel || t('vendor.erbil_kurdistan', 'Erbil, Kurdistan');

  // Compute clean breadcrumb label
  const getSectionTitle = (nav: string) => {
    switch (nav) {
      case 'dashboard':
        return t('vendor.dashboard', 'Dashboard');
      case 'requests':
        return t('vendor.nav_requests', 'Service Requests');
      case 'work-orders':
        return t('vendor.nav_work_orders', 'My Work Orders');
      case 'schedule':
        return t('vendor.nav_scheduled', 'Scheduled Jobs');
      case 'completed':
        return t('vendor.nav_completed', 'Completed Jobs');
      case 'quotes':
        return t('vendor.nav_quotes', 'Quotes & Estimates');
      case 'clients':
        return t('vendor.nav_clients', 'Clients');
      case 'properties':
        return t('vendor.nav_properties', 'Properties');
      case 'messages':
        return t('vendor.nav_messages', 'Messages');
      case 'categories':
        return t('vendor.nav_categories', 'Service Categories');
      case 'availability':
        return t('vendor.nav_availability', 'Availability & Hours');
      case 'areas':
        return t('vendor.nav_areas', 'Service Areas');
      case 'team':
        return t('vendor.nav_team', 'My Team');
      case 'invoices':
        return t('vendor.nav_invoices', 'Invoices');
      case 'payments':
        return t('vendor.nav_payments', 'Payments');
      case 'earnings':
        return t('vendor.nav_earnings', 'Earnings & Reports');
      case 'calendar':
        return t('vendor.nav_calendar', 'Calendar');
      case 'tasks':
        return t('vendor.nav_tasks', 'Tasks');
      case 'documents':
        return t('vendor.nav_documents', 'Documents');
      case 'profile':
        return t('vendor.nav_profile', 'Vendor Profile');
      case 'verification':
        return t('vendor.nav_verification', 'Verification & License');
      case 'reviews':
        return t('vendor.nav_reviews', 'Reviews & Ratings');
      case 'settings':
        return t('vendor.nav_settings', 'Settings');
      default:
        return nav.replace('-', ' ');
    }
  };

  return (
    <header data-testid="vendor-header" className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
      {/* Left / Breadcrumbs & Mobile Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors cursor-pointer"
          aria-label={t('vendor.open_menu', 'Open Navigation Menu')}
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium">{t('workspace.context', 'Workspaces')}</span>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          <span className="text-slate-400 font-medium">{t('vendor.badge_vendor', 'Vendor')}</span>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          <span className="font-bold text-amber-400 capitalize">{getSectionTitle(activeNav)}</span>
        </nav>
      </div>

      {/* Right / Quick Actions & Search */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Search Input */}
        <div className="relative w-36 sm:w-48 md:w-52 lg:w-44 xl:w-60 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t('vendor.search_placeholder', 'Search...')}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-[#080d19] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all truncate"
          />
        </div>

        {/* Service Area Badge */}
        <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#080d19] border border-slate-800 text-[11px] font-semibold text-slate-300 shrink-0">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="truncate max-w-[120px]">{currentServiceArea}</span>
        </div>

        {/* AI Co-Pilot Quick Button */}
        <button
          type="button"
          onClick={onOpenAiAssistant}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer shrink-0"
          title={t('vendor.open_copilot', 'Open AI Advisory Co-Pilot')}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{t('vendor.ai_copilot_badge', 'AI Co-Pilot')}</span>
        </button>

        {/* Workspace Switcher Quick Button */}
        {onOpenWorkspaceSwitcher && (
          <button
            id="vendor-switch-workspace-btn"
            type="button"
            onClick={onOpenWorkspaceSwitcher}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer shrink-0"
            title={t('workspace.switch_button_title', 'گۆڕینی شوێنی کار')}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{t('workspace.switch_button', 'گۆڕینی شوێنی کار')}</span>
          </button>
        )}

        {/* Localization Navigator */}
        <div
          id="vendor-localization-navigator"
          className="flex items-center bg-[#080d19] p-0.5 rounded-xl border border-slate-800 text-xs font-bold shrink-0"
          role="group"
          aria-label={t('vendor.language_selector', 'Localization Navigator')}
          dir="ltr"
        >
          <div className="px-1.5 text-slate-500 hidden sm:flex items-center" title={t('common.language', 'Language')}>
            <Globe className="w-3.5 h-3.5 text-amber-400" />
          </div>
          {(['ku', 'ar', 'en'] as const).map((lang) => (
            <button
              key={lang}
              id={`vendor-lang-btn-${lang}`}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                language === lang
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={
                lang === 'ku'
                  ? 'Kurdish Sorani - کوردی (سۆرانی)'
                  : lang === 'ar'
                  ? 'Arabic - العربية'
                  : 'English'
              }
            >
              {lang === 'ku' ? 'کوردی' : lang === 'ar' ? 'عربي' : 'EN'}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

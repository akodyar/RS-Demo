import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Bell, 
  User, 
  ShieldCheck, 
  ChevronDown, 
  LogOut, 
  Users, 
  Compass, 
  FileText, 
  CreditCard, 
  Wrench,
  ExternalLink
} from 'lucide-react';
import { useI18n, SupportedLanguage } from '../../i18n/I18nProvider';
import { TenantNavTab } from './TenantBottomNav';

interface TenantHeaderProps {
  activeTabTitle?: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  propertyName?: string;
  unitNumber?: string;
  currentTab?: TenantNavTab;
  onTabChange?: (tab: TenantNavTab) => void;
  unreadNotificationsCount?: number;
  openMaintenanceCount?: number;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onSwitchPersona?: () => void;
}

export const TenantHeader: React.FC<TenantHeaderProps> = ({
  userName,
  userEmail,
  userRole,
  propertyName,
  unitNumber,
  activeTabTitle,
  currentTab = 'home',
  onTabChange,
  unreadNotificationsCount = 0,
  openMaintenanceCount = 0,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
  onSwitchPersona,
}) => {
  const { t, language, setLanguage, direction } = useI18n();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  // Compute initials safely without character bleed
  const getInitials = (nameStr: string) => {
    if (!nameStr) return language === 'en' ? 'T' : 'ک';
    const trimmed = nameStr.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].charAt(0);
      const second = parts[1].charAt(0);
      return (first + second).toUpperCase();
    }
    return trimmed.slice(0, Math.min(2, trimmed.length)).toUpperCase();
  };

  const initials = getInitials(userName);

  const desktopNavItems: Array<{ id: TenantNavTab; label: string }> = [
    { id: 'home', label: t('tenant.home', 'Home') },
    { id: 'lease', label: t('tenant.myLease', 'My Lease') },
    { id: 'payments', label: t('tenant.payments', 'Payments') },
    { id: 'maintenance', label: t('tenant.maintenance', 'Maintenance') },
    { id: 'more', label: t('tenant.more', 'More') },
  ];

  return (
    <header id="tenant-main-header" className="w-full bg-[#0c1322] border-b border-amber-500/30 sticky top-0 z-30 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Brand & Property Context */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="flex items-center gap-2.5 group cursor-pointer hover:opacity-95 transition-opacity"
            title={t('nav.home', 'HomeHub Home')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform font-black">
              <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
            </div>
            <div className="flex flex-col md:hidden">
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                HomeHub
              </span>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">
                {t('tenant.portal', 'Tenant Portal')}
              </span>
            </div>
          </Link>

          {/* Desktop Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">
              {t('tenant.portal', 'Tenant Portal')}
            </span>
            {activeTabTitle && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-amber-400 font-bold">
                  {activeTabTitle}
                </span>
              </>
            )}
          </div>
        </div>

          {/* Desktop Property Pill */}
          {propertyName && (
            <div className="hidden lg:flex items-center gap-2 ps-3 border-s border-slate-800 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-[#080d19] border border-slate-800 flex items-center gap-1.5">
                {unitNumber && <span className="font-extrabold text-amber-400">{unitNumber}</span>}
                {unitNumber && <span className="text-slate-500">•</span>}
                <span className="text-slate-300 font-medium">{propertyName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Desktop Navigation Tabs */}
        {onTabChange && (
          <nav className="hidden md:flex items-center gap-1 bg-[#080d19] p-1 rounded-xl border border-slate-800">
            {desktopNavItems.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tenant-desktop-nav-${item.id}`}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                    active
                      ? 'bg-[#0c1322] text-amber-400 border border-amber-500/30 shadow-sm font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'maintenance' && openMaintenanceCount > 0 && (
                    <span className="ms-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full text-[9px] font-black">
                      {openMaintenanceCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Side: Search, Language Switcher, Notifications, Profile Dropdown */}
        <div className="flex items-center gap-2">
          {/* Desktop Search Trigger / Input */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/30 text-xs text-slate-400 hover:text-white transition-colors w-48 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">{t('tenant.searchPlaceholder', 'Search lease, bills...')}</span>
          </button>

          {/* Mobile search icon */}
          <button
            id="tenant-search-btn"
            type="button"
            onClick={onOpenSearch}
            className="xl:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={t('tenant.searchPlaceholder', 'Search')}
            aria-label={t('tenant.searchPlaceholder', 'Search')}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Desktop Language Switcher */}
          <div className="flex items-center gap-0.5 bg-[#080d19] p-0.5 rounded-xl text-xs font-bold border border-slate-800" dir="ltr">
            {(['ku', 'ar', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                  language === lang
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Notifications button */}
          <button
            id="tenant-notifications-btn"
            type="button"
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative cursor-pointer"
            title={t('tenant.notifications', 'Notifications')}
            aria-label={t('tenant.notifications', 'Notifications')}
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-[#0c1322]" />
            )}
          </button>

          {/* Profile Dropdown Container */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="tenant-profile-btn"
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1.5 sm:pe-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group"
              title={t('tenant.profile', 'Profile')}
              aria-label={t('tenant.profile', 'Profile')}
              aria-expanded={profileDropdownOpen}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-start leading-tight">
                <span className="text-xs font-black text-white block truncate max-w-[120px]">
                  {userName}
                </span>
                <span className="text-[10px] text-amber-400/90 font-bold block">
                  {userRole || t('tenant.tenantRole', 'Tenant')}
                </span>
              </div>
              <ChevronDown 
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 ${
                  profileDropdownOpen ? 'rotate-180' : ''
                }`} 
              />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                className={`absolute top-full mt-2 w-64 bg-[#0c1322] border border-amber-500/30 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-white ${
                  direction === 'rtl' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                }`}
              >
                {/* User Info Header */}
                <div className="p-3 bg-[#080d19] rounded-xl mb-1 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-white truncate">
                        {userName}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                        {userEmail || 'tenant@homehub.iq'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-400">
                      {t('tenant.role', 'Account Role')}:
                    </span>
                    <span className="font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {userRole || t('tenant.tenantRole', 'Tenant')}
                    </span>
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-start"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{t('tenant.myProfile', 'My Profile & Settings')}</span>
                  </button>

                  {onTabChange && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onTabChange('lease');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-start"
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{t('tenant.myLease', 'My Lease')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onTabChange('payments');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl transition-colors cursor-pointer text-start"
                      >
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span>{t('tenant.payments', 'Payments & Billing')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onTabChange('maintenance');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl transition-colors cursor-pointer text-start"
                      >
                        <Wrench className="w-4 h-4 text-amber-400" />
                        <span>{t('tenant.maintenance', 'Maintenance')}</span>
                      </button>
                    </>
                  )}

                  {/* Switch Persona / Account */}
                  {onSwitchPersona && (
                    <button
                      id="header-switch-account-btn"
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onSwitchPersona();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer text-start"
                    >
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>{t('action.switch_persona', 'Switch Role / Persona')}</span>
                    </button>
                  )}

                  {/* Exit to Home / Marketplace */}
                  <Link
                    to="/"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl transition-colors text-start"
                  >
                    <Compass className="w-4 h-4 text-slate-400" />
                    <span>{t('action.exit_to_home', 'Explore Marketplace / Home')}</span>
                  </Link>
                </div>

                {/* Sign Out Action */}
                {onLogout && (
                  <div className="border-t border-slate-800 pt-1 mt-1">
                    <button
                      id="header-signout-btn"
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer text-start"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>{t('action.sign_out', 'Sign Out')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

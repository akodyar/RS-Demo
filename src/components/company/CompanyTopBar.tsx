import React, { useState } from 'react';
import { useI18n, SupportedLanguage } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { Building2, Search, Bell, Globe, ChevronDown, User, LogOut, Settings, Shield, Repeat } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface CompanyTopBarProps {
  activeTabTitle?: string;
  companyName?: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  onOpenProfile: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  initialUserMenuOpen?: boolean;
}

export const CompanyTopBar: React.FC<CompanyTopBarProps> = ({
  companyName,
  activeTabTitle,
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenProfile,
  onOpenWorkspaceSwitcher,
  initialUserMenuOpen = false,
}) => {
  const { t, language, setLanguage, direction } = useI18n();
  const { user, logout, activeWorkspace } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(initialUserMenuOpen);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Compute initials and display name safely
  const userName = (user as any)?.name || (user?.email ? user.email.split('@')[0] : '');
  const initials = userName.length >= 2 ? userName.slice(0, 2).toUpperCase() : 'CO';

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/login');
  };

  const languages: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: 'EN' },
    { code: 'ku', label: 'کوردی سۆرانی', flag: 'KU' },
    { code: 'ar', label: 'العربية', flag: 'AR' },
  ];

  const currentLangObj = languages.find(l => l.code === language) || languages[0];

  return (
    <header data-testid="company-topbar" className="w-full bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 sticky top-0 z-30 shadow-md text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: HomeHub Logo with Tagline */}
        <div className="flex items-center gap-3">
          <Link 
            to="/workspace/company" 
            className="flex items-center gap-2.5 group cursor-pointer"
            title="HomeHub Company Dashboard"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform flex-shrink-0 font-bold">
              <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
            </div>
            <div className="flex flex-col md:hidden">
              <span className="text-lg font-black tracking-tight text-white leading-none">
                HomeHub
              </span>
              <span className="text-[11px] font-medium text-amber-400/90 mt-0.5 leading-tight">
                {t('company.app_tagline', 'For a Better Home')}
              </span>
            </div>
          </Link>

          {/* Desktop Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium truncate max-w-[200px]">
              {companyName || 'Company Workspace'}
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

        {/* Right: Actions (Search, Notifications, Language, User Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={t('core.search', 'Search')}
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Button with Gold/Red Badge */}
          <button
            id="company-notifications-btn"
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative cursor-pointer"
            title={t('company.notifications', 'Notifications')}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span id="badge-company-unread-notifications" className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#0c1322]">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="h-10 px-2.5 rounded-xl border border-slate-800 bg-[#080d19] hover:bg-[#111b2e] text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Change Language"
            >
              <Globe className="w-4 h-4 text-amber-400" />
              <span className="uppercase">{currentLangObj.flag}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLangMenu && (
              <div 
                className={`absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} mt-1.5 w-40 bg-[#0c1322] rounded-xl shadow-2xl border border-amber-500/30 py-1 z-50 text-white`}
              >
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#111b2e] cursor-pointer ${
                      language === lang.code ? 'font-bold text-amber-400 bg-amber-500/10' : 'text-slate-300'
                    }`}
                  >
                    <span>{lang.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">{lang.flag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Workspace Switcher Button */}
          {onOpenWorkspaceSwitcher && (
            <button
              id="company-header-switch-workspace-btn"
              type="button"
              onClick={onOpenWorkspaceSwitcher}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors border border-amber-500/30 cursor-pointer"
              title={language === 'ku' ? 'گۆڕینی شوێنی کار' : language === 'ar' ? 'تبديل مساحة العمل' : 'Switch Workspace'}
            >
              <Repeat className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ku' ? 'شوێنی کار' : language === 'ar' ? 'مساحة العمل' : 'Workspace'}</span>
            </button>
          )}

          {/* User Menu Avatar Circle */}
          <div className="relative">
            <button
              id="company-profile-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer shadow-sm"
              title={userName}
              aria-label="User menu"
            >
              {initials}
            </button>

            {showUserMenu && (
              <div 
                className={`absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} mt-1.5 w-56 bg-[#0c1322] rounded-2xl shadow-2xl border border-amber-500/30 py-2 z-50 text-white`}
              >
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-white truncate">{userName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'john@kurdistanproperties.iq'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Company Manager
                  </span>
                </div>

                <div className="py-1">
                  {onOpenWorkspaceSwitcher && (
                    <button
                      id="company-switch-workspace-btn"
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenWorkspaceSwitcher();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-amber-400 hover:bg-amber-500/10 flex items-center justify-between cursor-pointer font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-amber-400" />
                        <span>{language === 'ku' ? 'گۆڕینی شوێنی کار' : language === 'ar' ? 'تبديل مساحة العمل' : 'Switch Workspace'}</span>
                      </div>
                      {activeWorkspace && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/30">
                          {activeWorkspace.title}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenProfile();
                    }}
                    className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#111b2e] flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4 text-amber-400" />
                    <span>{t('company.profile', 'Company Profile')}</span>
                  </button>
                  <Link
                    to="/workspace/company/crm"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#111b2e] flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>{t('company.agreements', 'Management Agreements')}</span>
                  </Link>
                  <Link
                    to="/workspace/platform-admin"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#111b2e] flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>{t('role.platform_admin', 'Admin Oversight')}</span>
                  </Link>
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer font-bold"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>{t('action.sign_out', 'Sign Out')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

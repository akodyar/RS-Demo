import React, { useState } from 'react';
import {
  Bell,
  Globe,
  ChevronDown,
  LogOut,
  Check,
  ShieldCheck,
  User,
  Settings,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { AdminRoleType } from '../../types';

interface AdminHeaderProps {
  activeModuleTitle?: string;
  currentRole: AdminRoleType;
  authorizedRoles?: AdminRoleType[];
  onSelectRole: (role: AdminRoleType) => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentRole,
  activeModuleTitle,
  authorizedRoles = [currentRole],
  onSelectRole,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onSignOut,
  onOpenSettings,
}) => {
  const { language, setLanguage, direction } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const t = {
    ku: {
      subtitle: 'بەڕێوەبردنی پلاتفۆرم',
      admin: 'ئەدمین',
      profileTitle: 'هەژماری بەڕێوەبەر',
      adminRole: 'دەسەڵاتی بەڕێوەبەر',
      switchRole: 'گۆڕینی ڕۆڵ (RBAC Scope)',
      settings: 'ڕێکخستنە گشتییەکان',
      notifications: 'ئاگادارییەکان',
      signOut: 'دەرچوون لە هەژمار',
    },
    ar: {
      subtitle: 'إدارة المنصة',
      admin: 'المشرف',
      profileTitle: 'حساب الإدارة',
      adminRole: 'صلاحيات الإدارة',
      switchRole: 'تغيير الصلاحيات (RBAC Scope)',
      settings: 'الإعدادات العامة',
      notifications: 'الإشعارات',
      signOut: 'تسجيل الخروج',
    },
    en: {
      subtitle: 'Platform Administration',
      admin: 'Admin',
      profileTitle: 'Administrator Profile',
      adminRole: 'Administrative Scope',
      switchRole: 'Switch Role (RBAC Scope)',
      settings: 'Platform Settings',
      notifications: 'Notifications',
      signOut: 'Sign Out',
    },
  }[language] || {
    subtitle: 'Platform Administration',
    admin: 'Admin',
    profileTitle: 'Administrator Profile',
    adminRole: 'Administrative Scope',
    switchRole: 'Switch Role (RBAC Scope)',
    settings: 'Platform Settings',
    notifications: 'Notifications',
    signOut: 'Sign Out',
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'ku':
        return 'کوردی';
      case 'ar':
        return 'العربية';
      case 'en':
      default:
        return 'English';
    }
  };

  return (
    <header className="bg-[#0c1322] border-b border-amber-500/30 sticky top-0 z-30 shadow-xl text-white" dir={direction}>
      {/* Main Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Brand logo & platform administration title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#080d19] rounded-[14px] flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-2xs" />
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-2xs" />
                <div className="w-1.5 h-1.5 bg-amber-300 rounded-2xs" />
                <div className="w-1.5 h-1.5 bg-amber-600 rounded-2xs" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">
                HomeHub
              </span>
            </div>
            <p className="text-[10px] text-amber-400/80 font-semibold leading-none mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Right actions: Language pill, Notification bell, Admin profile avatar with dropdown */}
        <div className="flex items-center gap-2">
          {/* Language Selector matching reference pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 text-xs font-semibold text-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{getLanguageLabel()}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLangMenu && (
              <div
                className={`absolute top-full mt-1.5 ${
                  direction === 'rtl' ? 'left-0' : 'right-0'
                } w-36 bg-[#0c1322] rounded-2xl shadow-2xl border border-amber-500/30 py-1.5 z-50 text-white`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('ku');
                    setShowLangMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-xs font-medium hover:bg-[#111b2e] flex items-center justify-between text-slate-300 cursor-pointer"
                >
                  <span>کوردی سۆرانی</span>
                  {language === 'ku' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('ar');
                    setShowLangMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-xs font-medium hover:bg-[#111b2e] flex items-center justify-between text-slate-300 cursor-pointer"
                >
                  <span>العربية</span>
                  {language === 'ar' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    setShowLangMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-xs font-medium hover:bg-[#111b2e] flex items-center justify-between text-slate-300 cursor-pointer"
                >
                  <span>English</span>
                  {language === 'en' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell matching reference badge */}
          <button
            id="admin-notifications-btn"
            type="button"
            onClick={onOpenNotifications}
            className="relative w-9 h-9 rounded-full bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 flex items-center justify-center text-slate-300 transition-colors shadow-2xs cursor-pointer"
            aria-label={t.notifications}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-[#0c1322] shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Admin Avatar & Account Menu matching reference image */}
          <div className="relative">
            <button
              type="button"
              data-testid="admin-profile-menu-toggle"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 cursor-pointer group select-none"
              aria-label={t.profileTitle}
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-amber-500/40 group-hover:border-amber-400 transition-colors shadow-2xs">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
                  alt="Admin"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="hidden xs:flex flex-col items-start leading-none">
                <div className="flex items-center gap-0.5 text-xs font-bold text-white">
                  <span>{t.admin}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            </button>

            {showProfileMenu && (
              <div
                className={`absolute top-full mt-2 ${
                  direction === 'rtl' ? 'left-0' : 'right-0'
                } w-64 bg-[#0c1322] rounded-3xl shadow-2xl border border-amber-500/30 p-3 z-50 text-xs animate-fadeIn text-white`}
              >
                <div className="p-2 border-b border-slate-800 mb-2">
                  <p className="font-extrabold text-sm text-white">superadmin@homehub.iq</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                      {currentRole}
                    </span>
                  </div>
                </div>

                {/* Role Switcher - Strictly restricted to authorized roles (Viewing Scope Filter) */}
                <div className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {authorizedRoles.length > 1 ? t.switchRole : t.adminRole}
                  </div>
                  {authorizedRoles.length > 1 ? (
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {authorizedRoles.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            onSelectRole(r);
                            setShowProfileMenu(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between font-medium cursor-pointer transition-colors ${
                            currentRole === r
                              ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                              : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <span className="font-mono text-[11px]">{r}</span>
                          {currentRole === r && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#080d19] text-slate-300 text-[11px] font-medium border border-slate-800 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-amber-400">{currentRole}</span>
                      <span className="text-[10px] text-slate-500 font-normal">Server Enforced</span>
                    </div>
                  )}
                </div>

                {/* Direct Actions */}
                <div className="pt-2 border-t border-slate-800 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenNotifications();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center justify-between font-bold cursor-pointer"
                  >
                    <span>{t.notifications}</span>
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  <button
                    type="button"
                    data-testid="admin-header-settings"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenSettings?.();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center justify-between font-bold cursor-pointer"
                  >
                    <span>{t.settings}</span>
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onSignOut();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 flex items-center justify-between font-bold cursor-pointer transition-colors"
                    >
                      <span>{t.signOut}</span>
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

import React from 'react';
import { Home, MessageSquare, Calendar, BarChart3, LayoutGrid } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export type AdminBottomNavTab = 'dashboard' | 'messages' | 'calendar' | 'reports' | 'more';

interface AdminBottomNavProps {
  activeTab: AdminBottomNavTab;
  onSelectTab: (tab: AdminBottomNavTab) => void;
  unreadMessagesCount?: number;
}

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadMessagesCount = 3,
}) => {
  const { language, direction } = useI18n();

  const labels = {
    ku: {
      home: 'سەرەتا',
      messages: 'پەیامەکان',
      calendar: 'ڕۆژژمێر',
      reports: 'ڕاپۆرتەکان',
      more: 'زیاتر',
    },
    ar: {
      home: 'الرئيسية',
      messages: 'الرسائل',
      calendar: 'التقويم',
      reports: 'التقارير',
      more: 'المزيد',
    },
    en: {
      home: 'Home',
      messages: 'Messages',
      calendar: 'Calendar',
      reports: 'Reports',
      more: 'More',
    },
  }[language] || {
    home: 'Home',
    messages: 'Messages',
    calendar: 'Calendar',
    reports: 'Reports',
    more: 'More',
  };

  const tabs = [
    {
      id: 'dashboard' as AdminBottomNavTab,
      label: labels.home,
      icon: Home,
    },
    {
      id: 'messages' as AdminBottomNavTab,
      label: labels.messages,
      icon: MessageSquare,
      badge: unreadMessagesCount,
    },
    {
      id: 'calendar' as AdminBottomNavTab,
      label: labels.calendar,
      icon: Calendar,
    },
    {
      id: 'reports' as AdminBottomNavTab,
      label: labels.reports,
      icon: BarChart3,
    },
    {
      id: 'more' as AdminBottomNavTab,
      label: labels.more,
      icon: LayoutGrid,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c1322]/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 shadow-2xl"
      dir={direction}
      aria-label="Admin Bottom Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`admin-bottom-nav-${tab.id}`}
              type="button"
              data-testid={`admin-nav-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center min-w-[58px] py-1 px-2 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-amber-400 font-black'
                  : 'text-slate-400 hover:text-white font-semibold'
              }`}
            >
              {/* Active Pill Container for Home */}
              {isActive && tab.id === 'dashboard' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-500/30 shadow-sm">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-black">{tab.label}</span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-transform ${
                        isActive ? 'scale-110 text-amber-400' : ''
                      }`}
                    />
                    {Boolean(tab.badge && tab.badge > 0) && (
                      <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[#0c1322] shadow-xs">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 tracking-tight leading-none truncate max-w-[64px]">
                    {tab.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

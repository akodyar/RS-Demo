import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Home, Building2, ClipboardList, MessageSquare, MoreHorizontal } from 'lucide-react';

export type BottomNavTabId = 'home' | 'properties' | 'operations' | 'messages' | 'more';

interface CompanyBottomNavProps {
  activeTab: BottomNavTabId;
  onTabChange: (tab: BottomNavTabId) => void;
  unreadMessagesCount?: number;
}

export const CompanyBottomNav: React.FC<CompanyBottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadMessagesCount = 0,
}) => {
  const { t } = useI18n();

  const tabs: {
    id: BottomNavTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hasBadge?: boolean;
    badgeCount?: number;
  }[] = [
    {
      id: 'home',
      label: t('company.nav.home', 'Home'),
      icon: Home,
    },
    {
      id: 'properties',
      label: t('company.nav.properties', 'Properties'),
      icon: Building2,
    },
    {
      id: 'operations',
      label: t('company.nav.operations', 'Operations'),
      icon: ClipboardList,
    },
    {
      id: 'messages',
      label: t('company.nav.messages', 'Messages'),
      icon: MessageSquare,
      hasBadge: unreadMessagesCount > 0,
      badgeCount: unreadMessagesCount,
    },
    {
      id: 'more',
      label: t('company.nav.more', 'More'),
      icon: MoreHorizontal,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex justify-around items-center shadow-lg md:hidden"
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all min-h-[48px] relative cursor-pointer ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {tab.hasBadge && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {tab.badgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 leading-none tracking-tight">
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-blue-600 mt-1" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

import React from 'react';
import { Home, FileText, CreditCard, Wrench, MoreHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export type TenantNavTab = 'home' | 'lease' | 'payments' | 'maintenance' | 'more';

interface TenantBottomNavProps {
  currentTab: TenantNavTab;
  onTabChange: (tab: TenantNavTab) => void;
  openMaintenanceCount?: number;
}

export const TenantBottomNav: React.FC<TenantBottomNavProps> = ({
  currentTab,
  onTabChange,
  openMaintenanceCount = 0,
}) => {
  const { t } = useI18n();

  const tabs: Array<{ id: TenantNavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: t('tenant.home', 'Home'), icon: Home },
    { id: 'lease', label: t('tenant.myLease', 'My Lease'), icon: FileText },
    { id: 'payments', label: t('tenant.payments', 'Payments'), icon: CreditCard },
    { id: 'maintenance', label: t('tenant.maintenance', 'Maintenance'), icon: Wrench },
    { id: 'more', label: t('tenant.more', 'More'), icon: MoreHorizontal },
  ];

  return (
    <nav
      id="tenant-bottom-nav"
      className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200/90 py-2 px-3 z-40 shadow-lg"
      aria-label="Tenant Navigation"
    >
      <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tenant-nav-${tab.id}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-blue-600 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.id === 'maintenance' && openMaintenanceCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                    {openMaintenanceCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] truncate">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute -bottom-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

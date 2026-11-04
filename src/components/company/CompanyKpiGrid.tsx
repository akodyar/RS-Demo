import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { 
  Home, Users, Banknote, Wrench, Tag, Clock, ChevronRight 
} from 'lucide-react';

interface CompanyKpiGridProps {
  managedProperties?: number;
  activeTenants?: number;
  monthlyRentManagedIqd?: number;
  openMaintenance?: number;
  activeListings?: number;
  pendingApprovals?: number;
  onSelectKpi: (kpiType: 'properties' | 'tenants' | 'financials' | 'maintenance' | 'listings' | 'approvals') => void;
}

export const CompanyKpiGrid: React.FC<CompanyKpiGridProps> = ({
  managedProperties = 0,
  activeTenants = 0,
  monthlyRentManagedIqd = 0,
  openMaintenance = 0,
  activeListings = 0,
  pendingApprovals = 0,
  onSelectKpi,
}) => {
  const { t, direction } = useI18n();

  const cards = [
    {
      id: 'properties' as const,
      label: t('company.kpi.managed_properties', 'Managed Properties'),
      value: managedProperties.toString(),
      icon: Home,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
    },
    {
      id: 'tenants' as const,
      label: t('company.kpi.active_tenants', 'Active Tenants'),
      value: activeTenants.toString(),
      icon: Users,
      iconBg: 'bg-teal-50 text-teal-600 border border-teal-100',
    },
    {
      id: 'financials' as const,
      label: t('company.kpi.monthly_rent', 'Monthly Rent Managed'),
      value: `IQD ${monthlyRentManagedIqd.toLocaleString()}`,
      icon: Banknote,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    {
      id: 'maintenance' as const,
      label: t('company.kpi.open_maintenance', 'Open Maintenance'),
      value: openMaintenance.toString(),
      icon: Wrench,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
    },
    {
      id: 'listings' as const,
      label: t('company.kpi.active_listings', 'Active Listings'),
      value: activeListings.toString(),
      icon: Tag,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
    },
    {
      id: 'approvals' as const,
      label: t('company.kpi.pending_approvals', 'Pending Approvals'),
      value: pendingApprovals.toString(),
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            onClick={() => onSelectKpi(card.id)}
            className="group p-4 sm:p-5 rounded-2xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all text-left rtl:text-right flex flex-col justify-between min-h-[110px] cursor-pointer shadow-xl"
          >
            {/* Top row: Icon and Chevron */}
            <div className="flex items-center justify-between w-full mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg} shadow-xs`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-amber-400 group-hover:bg-[#111b2e] transition-colors">
                <ChevronRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Bottom: Value and Label */}
            <div>
              <span className="block text-xl sm:text-2xl font-black text-white tracking-tight leading-none truncate">
                {card.value}
              </span>
              <span className="block text-xs font-semibold text-slate-400 mt-1 truncate">
                {card.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

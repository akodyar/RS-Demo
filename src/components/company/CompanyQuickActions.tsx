import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { 
  Home, UserCheck, UserPlus, Building2, Users, FileText, 
  Wrench, Tag, Store, DollarSign, CheckCircle2, BarChart2, 
  Folder, MessageSquare, Sparkles, MoreHorizontal, ChevronRight,
  Plus
} from 'lucide-react';

export type QuickActionId =
  | 'add_management'
  | 'invite_owner'
  | 'add_team_member'
  | 'manage_properties'
  | 'manage_tenants'
  | 'create_lease'
  | 'maintenance'
  | 'create_listing'
  | 'vendors'
  | 'financials'
  | 'approvals'
  | 'reports'
  | 'documents'
  | 'messages'
  | 'ai_assistant'
  | 'more';

interface CompanyQuickActionsProps {
  onActionClick: (actionId: QuickActionId) => void;
  onSeeAll?: () => void;
}

export const CompanyQuickActions: React.FC<CompanyQuickActionsProps> = ({
  onActionClick,
  onSeeAll,
}) => {
  const { t, direction } = useI18n();

  const actions: {
    id: QuickActionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    containerBg: string;
  }[] = [
    {
      id: 'add_management',
      label: t('company.action.add_management', 'Add Property Management'),
      icon: Home,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'invite_owner',
      label: t('company.action.invite_owner', 'Invite Owner'),
      icon: UserCheck,
      iconColor: 'text-emerald-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-emerald-500/30',
    },
    {
      id: 'add_team_member',
      label: t('company.action.add_team_member', 'Add Team Member'),
      icon: UserPlus,
      iconColor: 'text-purple-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-purple-500/30',
    },
    {
      id: 'manage_properties',
      label: t('company.action.manage_properties', 'Manage Properties'),
      icon: Building2,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'manage_tenants',
      label: t('company.action.manage_tenants', 'Manage Tenants'),
      icon: Users,
      iconColor: 'text-sky-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-sky-500/30',
    },
    {
      id: 'create_lease',
      label: t('company.action.create_lease', 'Create Lease'),
      icon: FileText,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'maintenance',
      label: t('company.action.maintenance', 'Maintenance'),
      icon: Wrench,
      iconColor: 'text-rose-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-rose-500/30',
    },
    {
      id: 'create_listing',
      label: t('company.action.create_listing', 'Create Listing'),
      icon: Tag,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'vendors',
      label: t('company.action.vendors', 'Vendors'),
      icon: Store,
      iconColor: 'text-emerald-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-emerald-500/30',
    },
    {
      id: 'financials',
      label: t('company.action.financials', 'Financials'),
      icon: DollarSign,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'approvals',
      label: t('company.action.approvals', 'Approvals'),
      icon: CheckCircle2,
      iconColor: 'text-purple-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-purple-500/30',
    },
    {
      id: 'reports',
      label: t('company.action.reports', 'Reports'),
      icon: BarChart2,
      iconColor: 'text-cyan-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-cyan-500/30',
    },
    {
      id: 'documents',
      label: t('company.action.documents', 'Documents'),
      icon: Folder,
      iconColor: 'text-slate-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-slate-700',
    },
    {
      id: 'messages',
      label: t('company.action.messages', 'Messages'),
      icon: MessageSquare,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'ai_assistant',
      label: t('company.action.ai_assistant', 'AI Assistant'),
      icon: Sparkles,
      iconColor: 'text-amber-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-amber-500/30',
    },
    {
      id: 'more',
      label: t('company.action.more', 'More'),
      icon: MoreHorizontal,
      iconColor: 'text-slate-400',
      containerBg: 'bg-[#0c1322] hover:bg-[#111b2e] border-slate-800 hover:border-slate-700',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-black text-white">
          {t('company.quick_actions', 'Quick Actions')}
        </h2>
        <button
          onClick={onSeeAll}
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer py-1"
        >
          <span>{t('company.see_all', 'See All')}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 4x4 Grid of 16 Quick Action Buttons */}
      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2.5 sm:gap-3">
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onActionClick(action.id)}
              className="flex flex-col items-center justify-start p-2 rounded-2xl hover:bg-[#0c1322]/80 border border-transparent hover:border-slate-800 transition-all cursor-pointer group text-center min-h-[92px]"
            >
              <div 
                className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-transform group-hover:scale-105 ${action.containerBg}`}
              >
                <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${action.iconColor}`} />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 group-hover:text-amber-400 mt-2 leading-tight line-clamp-2 px-0.5 transition-colors">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

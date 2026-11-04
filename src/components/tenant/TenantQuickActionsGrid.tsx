import React from 'react';
import { 
  CreditCard, 
  Wrench, 
  FileText, 
  FolderOpen, 
  MessageSquare, 
  AlertTriangle, 
  RefreshCw, 
  LogOut 
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantQuickActionsGridProps {
  onPayRent: () => void;
  onRequestMaintenance: () => void;
  onViewLease: () => void;
  onOpenDocuments: () => void;
  onOpenMessages: () => void;
  onReportIssue: () => void;
  onRenewLease: () => void;
  onMoveOut: () => void;
  onOpenUtilityBills: () => void;
}

export const TenantQuickActionsGrid: React.FC<TenantQuickActionsGridProps> = ({
  onPayRent,
  onRequestMaintenance,
  onViewLease,
  onOpenDocuments,
  onOpenMessages,
  onReportIssue,
  onRenewLease,
  onMoveOut,
  onOpenUtilityBills,
}) => {
  const { t } = useI18n();

  const actions = [
    {
      id: 'quick-action-pay-rent',
      label: t('tenant.payRent', 'Pay Rent'),
      icon: CreditCard,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-emerald-500/20 border border-emerald-500/30',
      iconColor: 'text-emerald-400',
      onClick: onPayRent,
    },
    {
      id: 'quick-action-request-maintenance',
      label: t('tenant.requestMaintenance', 'Request Maintenance'),
      icon: Wrench,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-amber-500/20 border border-amber-500/30',
      iconColor: 'text-amber-400',
      onClick: onRequestMaintenance,
    },
    {
      id: 'quick-action-view-lease',
      label: t('tenant.viewLease', 'View Lease'),
      icon: FileText,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-blue-500/20 border border-blue-500/30',
      iconColor: 'text-blue-400',
      onClick: onViewLease,
    },
    {
      id: 'quick-action-documents',
      label: t('tenant.documents', 'Documents'),
      icon: FolderOpen,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-indigo-500/20 border border-indigo-500/30',
      iconColor: 'text-indigo-400',
      onClick: onOpenDocuments,
    },
    {
      id: 'quick-action-messages',
      label: t('tenant.messages', 'Messages'),
      icon: MessageSquare,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-purple-500/20 border border-purple-500/30',
      iconColor: 'text-purple-400',
      onClick: onOpenMessages,
    },
    {
      id: 'quick-action-report-issue',
      label: t('tenant.reportIssue', 'Report Issue'),
      icon: AlertTriangle,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-rose-500/20 border border-rose-500/30',
      iconColor: 'text-rose-400',
      onClick: onReportIssue,
    },
    {
      id: 'quick-action-renew-lease',
      label: t('tenant.renewLease', 'Renew Lease'),
      icon: RefreshCw,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-teal-500/20 border border-teal-500/30',
      iconColor: 'text-teal-400',
      onClick: onRenewLease,
    },
    {
      id: 'quick-action-move-out',
      label: t('tenant.moveOut', 'Move-out'),
      icon: LogOut,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-slate-800 border border-slate-700',
      iconColor: 'text-slate-300',
      onClick: onMoveOut,
    },
    {
      id: 'quick-action-utility-bills',
      label: t('tenant.utilityBills', 'Utility Bills'),
      icon: FileText,
      colorClass: 'bg-[#0c1322] text-slate-200 hover:text-white hover:border-amber-400/80 border-slate-800',
      iconBoxClass: 'bg-cyan-500/20 border border-cyan-500/30',
      iconColor: 'text-cyan-400',
      onClick: onOpenUtilityBills,
    },
  ];

  return (
    <div id="tenant-quick-actions-section" className="space-y-2.5">
      <h3 className="text-sm font-extrabold text-white tracking-tight">
        {t('tenant.quickActions', 'Quick Actions')}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              id={act.id}
              type="button"
              onClick={act.onClick}
              className={`p-3.5 sm:p-4 rounded-2xl border text-start flex flex-col items-start gap-2.5 transition-all active:scale-95 shadow-sm cursor-pointer ${act.colorClass}`}
            >
              <div className={`p-2 rounded-xl shadow-2xs ${act.iconBoxClass}`}>
                <Icon className={`w-5 h-5 ${act.iconColor}`} />
              </div>
              <span className="text-xs sm:text-sm font-bold leading-tight">
                {act.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

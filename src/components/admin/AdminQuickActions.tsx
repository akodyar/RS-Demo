import React from 'react';
import {
  Users,
  Building2,
  Home,
  ShoppingCart,
  ShieldCheck,
  Coins,
  Wrench,
  BarChart3,
  MessageSquare,
  FileText,
  Cpu,
  Sliders,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export type QuickActionKey =
  | 'users'
  | 'companies'
  | 'properties'
  | 'marketplace'
  | 'verification'
  | 'finance'
  | 'maintenance'
  | 'reports'
  | 'messages'
  | 'documents'
  | 'security'
  | 'settings';

interface AdminQuickActionsProps {
  onSelectAction: (actionKey: QuickActionKey) => void;
  onViewAll: () => void;
}

export const AdminQuickActions: React.FC<AdminQuickActionsProps> = ({
  onSelectAction,
  onViewAll,
}) => {
  const { language, direction } = useI18n();

  const labels = {
    ku: {
      title: 'کردارە خێراکان',
      viewAll: 'بینینی هەموو',
      users: 'بەکارهێنەران',
      companies: 'کۆمپانیاکان',
      properties: 'موڵکەکان',
      marketplace: 'بازاڕ',
      verification: 'دڵنیایی',
      finance: 'دارایی',
      maintenance: 'چاکسازی',
      reports: 'ڕاپۆرتەکان',
      messages: 'پەیامەکان',
      documents: 'بەڵگەنامەکان',
      system: 'سیستەم',
      settings: 'ڕێکخستن',
    },
    ar: {
      title: 'الإجراءات السريعة',
      viewAll: 'عرض الكل',
      users: 'المستخدمين',
      companies: 'الشركات',
      properties: 'العقارات',
      marketplace: 'السوق',
      verification: 'التوثيق',
      finance: 'المالية',
      maintenance: 'الصيانة',
      reports: 'التقارير',
      messages: 'الرسائل',
      documents: 'الوثائق',
      system: 'النظام',
      settings: 'الإعدادات',
    },
    en: {
      title: 'Quick Actions',
      viewAll: 'View All',
      users: 'Users',
      companies: 'Companies',
      properties: 'Properties',
      marketplace: 'Marketplace',
      verification: 'Verification',
      finance: 'Finance',
      maintenance: 'Maintenance',
      reports: 'Reports',
      messages: 'Messages',
      documents: 'Documents',
      system: 'System',
      settings: 'Settings',
    },
  }[language] || {
    title: 'Quick Actions',
    viewAll: 'View All',
    users: 'Users',
    companies: 'Companies',
    properties: 'Properties',
    marketplace: 'Marketplace',
    verification: 'Verification',
    finance: 'Finance',
    maintenance: 'Maintenance',
    reports: 'Reports',
    messages: 'Messages',
    documents: 'Documents',
    system: 'System',
    settings: 'Settings',
  };

  // Exact 12 actions in 2 rows of 6 matching the reference image
  const actions = [
    {
      key: 'users' as QuickActionKey,
      label: labels.users,
      icon: Users,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      key: 'companies' as QuickActionKey,
      label: labels.companies,
      icon: Building2,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
    {
      key: 'properties' as QuickActionKey,
      label: labels.properties,
      icon: Home,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      key: 'marketplace' as QuickActionKey,
      label: labels.marketplace,
      icon: ShoppingCart,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
    },
    {
      key: 'verification' as QuickActionKey,
      label: labels.verification,
      icon: ShieldCheck,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
    },
    {
      key: 'finance' as QuickActionKey,
      label: labels.finance,
      icon: Coins,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
    },
    {
      key: 'maintenance' as QuickActionKey,
      label: labels.maintenance,
      icon: Wrench,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
    },
    {
      key: 'reports' as QuickActionKey,
      label: labels.reports,
      icon: BarChart3,
      iconColor: 'text-pink-600',
      iconBg: 'bg-pink-50',
    },
    {
      key: 'messages' as QuickActionKey,
      label: labels.messages,
      icon: MessageSquare,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
    },
    {
      key: 'documents' as QuickActionKey,
      label: labels.documents,
      icon: FileText,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
    {
      key: 'security' as QuickActionKey,
      label: labels.system,
      icon: Cpu,
      iconColor: 'text-slate-700',
      iconBg: 'bg-slate-100',
    },
    {
      key: 'settings' as QuickActionKey,
      label: labels.settings,
      icon: Sliders,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
    },
  ];

  return (
    <div className="px-4 py-3 space-y-2.5" dir={direction}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-white tracking-tight">
          {labels.title}
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer transition-colors group"
        >
          <span>{labels.viewAll}</span>
          {direction === 'rtl' ? (
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          ) : (
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Grid: 6 columns on medium screens / 3 columns on small phones matching reference layout */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.key}
              type="button"
              data-testid={`admin-quick-action-${act.key}`}
              onClick={() => onSelectAction(act.key)}
              className="bg-[#0c1322] hover:bg-[#111b2e] rounded-2xl p-2.5 sm:p-3 border border-slate-800 hover:border-amber-500/40 shadow-xl transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${act.iconBg} ${act.iconColor} flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-200 text-center line-clamp-1 leading-tight w-full">
                {act.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

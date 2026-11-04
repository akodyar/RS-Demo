import React from 'react';
import { Wrench, MessageSquare, Calendar } from 'lucide-react';
import { TenantQuickStats } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantQuickStatsRowProps {
  quickStats: TenantQuickStats;
  onNavigateTab: (tab: 'maintenance' | 'messages' | 'payments') => void;
}

export const TenantQuickStatsRow: React.FC<TenantQuickStatsRowProps> = ({
  quickStats,
  onNavigateTab,
}) => {
  const { t } = useI18n();

  return (
    <div id="tenant-quick-stats-row" className="grid grid-cols-3 gap-3 sm:gap-4">
      {/* Maintenance */}
      <button
        id="stat-btn-maintenance"
        type="button"
        onClick={() => onNavigateTab('maintenance')}
        className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 text-start hover:border-amber-400/80 hover:bg-[#111b2e] transition-all cursor-pointer shadow-sm group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-400">
            {t('tenant.maintenance', 'Maintenance')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform border border-amber-500/30">
            <Wrench className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className="text-sm sm:text-base font-extrabold text-white">
          {quickStats.openMaintenanceCount} {t('tenant.active', 'Active')}
        </p>
      </button>

      {/* Messages */}
      <button
        id="stat-btn-messages"
        type="button"
        onClick={() => onNavigateTab('messages')}
        className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 text-start hover:border-blue-400/80 hover:bg-[#111b2e] transition-all cursor-pointer shadow-sm group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-400">
            {t('tenant.messages', 'Messages')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform border border-blue-500/30">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className="text-sm sm:text-base font-extrabold text-white">
          {quickStats.unreadMessagesCount} {t('tenant.unread', 'Unread')}
        </p>
      </button>

      {/* Upcoming */}
      <button
        id="stat-btn-upcoming"
        type="button"
        onClick={() => onNavigateTab('payments')}
        className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 text-start hover:border-amber-400/80 hover:bg-[#111b2e] transition-all cursor-pointer shadow-sm group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-400">
            {t('tenant.upcoming', 'Upcoming')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform border border-amber-500/30">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className="text-sm sm:text-base font-extrabold text-white">
          {quickStats.upcomingEventsCount} {t('tenant.event', 'Event')}
        </p>
      </button>
    </div>
  );
};

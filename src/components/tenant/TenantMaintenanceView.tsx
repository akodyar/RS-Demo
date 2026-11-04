import React from 'react';
import { 
  Wrench, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  AlertTriangle 
} from 'lucide-react';
import { TenantMaintenanceItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantMaintenanceViewProps {
  requests: TenantMaintenanceItem[];
  onRequestNew: () => void;
  onSelectRequest?: (req: TenantMaintenanceItem) => void;
}

export const TenantMaintenanceView: React.FC<TenantMaintenanceViewProps> = ({
  requests,
  onRequestNew,
  onSelectRequest,
}) => {
  const { t } = useI18n();

  return (
    <div id="tenant-maintenance-view" className="space-y-6">
      {/* Top Banner with Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {t('tenant.maintenanceRequests', 'Maintenance & Repairs')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('tenant.maintenanceSubtitle', 'Report plumbing, electrical, AC, or appliance issues directly to property management.')}
          </p>
        </div>

        <button
          id="btn-new-maintenance-request"
          type="button"
          onClick={onRequestNew}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 text-xs sm:text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('tenant.requestMaintenance', 'Request Maintenance')}</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">{t('tenant.noMaintenanceRequests', 'No maintenance requests found')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('tenant.allOperatingNormally', 'Everything in your unit is operating normally.')}</p>
          </div>
        ) : (
          requests.map((item) => {
            const isCompleted = item.status === 'COMPLETED';
            const isPending = item.status === 'REPORTED' || item.status === 'ASSIGNED';

            return (
              <div
                key={item.id}
                onClick={() => onSelectRequest && onSelectRequest(item)}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:border-blue-300 transition-colors cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 font-mono" dir="ltr">
                          {item.referenceNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {item.category}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : isPending
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span dir="ltr">{new Date(item.submittedDate).toLocaleDateString()}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.unitNumber}</span>
                    </span>
                  </div>

                  {item.latestUpdate && (
                    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      Status: {item.latestUpdate}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

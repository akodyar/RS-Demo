import React from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Building,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminMaintenanceOrder } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminMaintenanceModuleProps {
  orders: AdminMaintenanceOrder[];
  currentRole: AdminRoleType;
  onUpdateOrderStatus: (orderId: string, status: AdminMaintenanceOrder['status']) => void;
  onBack: () => void;
}

export const AdminMaintenanceModule: React.FC<AdminMaintenanceModuleProps> = ({
  orders,
  currentRole,
  onUpdateOrderStatus,
  onBack,
}) => {
  const { direction } = useI18n();

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              <span>بەڕێوەبردنی چاکسازی و وەستاکان (Maintenance Operations)</span>
            </h2>
            <p className="text-xs text-slate-500">
              چاودێری داواکارییە فۆرییەکان، خەمڵاندنی نرخ، و ڕاسپاردنی کۆمپانیا خزمەتگوزارەکان
            </p>
          </div>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>تەنها بینین</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {order.ticketNumber}
                    </span>
                    {order.urgency === 'CRITICAL' && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                        فۆری (CRITICAL)
                      </span>
                    )}
                    {order.urgency === 'HIGH' && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                        گرنگ
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 mt-1">{order.title}</h4>
                  <p className="text-xs text-slate-500">{order.propertyTitle}</p>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                  {order.status === 'IN_PROGRESS'
                    ? 'لە کاردایە'
                    : order.status === 'PENDING'
                    ? 'چاوەڕوانی دەستپێکردن'
                    : 'تەواوکراو'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">وەستای ڕاسپێردراو:</span>
                  <strong className="text-slate-800">{order.assignedVendorName || 'دیارینەکراوە'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">تێچووی خەمڵێنراو:</span>
                  <strong className="text-slate-900 font-mono">
                    {order.estimatedCostIqd.toLocaleString()} IQD
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{order.createdAt}</span>

              {!isReadOnly && (
                <div className="flex items-center gap-1.5">
                  {order.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'COMPLETED')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                    >
                      تەواوکردنی کارەکە
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

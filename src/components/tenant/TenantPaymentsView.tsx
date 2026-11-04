import React, { useState } from 'react';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  Download, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  Receipt,
  FileCheck,
  RotateCcw,
  AlertCircle,
  XCircle,
  Zap
} from 'lucide-react';
import { TenantRentDue, TenantFinancialSummary, TenantPaymentHistoryItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';
import { TenantUtilityBillsView } from './TenantUtilityBillsView';

export interface PaymentStatusBadgeConfig {
  label: string;
  badgeClass: string;
  iconClass: string;
  icon: React.ReactNode;
}

export const getPaymentStatusConfig = (
  rawStatus: string | undefined,
  t: (key: string, defaultValue?: string) => string
): PaymentStatusBadgeConfig => {
  const normalized = (rawStatus || '').toUpperCase();

  switch (normalized) {
    case 'CONFIRMED':
      return {
        label: t('payment.status.confirmed', t('tenant.confirmed', 'Confirmed')),
        badgeClass: 'bg-emerald-100 text-emerald-800',
        iconClass: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle2 className="w-5 h-5" />,
      };
    case 'REVERSED':
      return {
        label: t('payment.status.reversed', 'Reversed'),
        badgeClass: 'bg-rose-100 text-rose-800',
        iconClass: 'bg-rose-100 text-rose-700',
        icon: <RotateCcw className="w-5 h-5" />,
      };
    case 'PENDING':
      return {
        label: t('payment.status.pending', t('status.pending', 'Pending')),
        badgeClass: 'bg-amber-100 text-amber-800',
        iconClass: 'bg-amber-100 text-amber-700',
        icon: <Clock className="w-5 h-5" />,
      };
    case 'RECORDED':
      return {
        label: t('payment.status.recorded', 'Recorded'),
        badgeClass: 'bg-blue-100 text-blue-800',
        iconClass: 'bg-blue-100 text-blue-700',
        icon: <FileCheck className="w-5 h-5" />,
      };
    case 'FAILED':
      return {
        label: t('payment.status.failed', t('status.failed', 'Failed')),
        badgeClass: 'bg-red-100 text-red-800',
        iconClass: 'bg-red-100 text-red-700',
        icon: <AlertCircle className="w-5 h-5" />,
      };
    case 'CANCELLED':
      return {
        label: t('payment.status.cancelled', t('status.cancelled', 'Cancelled')),
        badgeClass: 'bg-slate-100 text-slate-700',
        iconClass: 'bg-slate-100 text-slate-600',
        icon: <XCircle className="w-5 h-5" />,
      };
    case 'REFUNDED':
      return {
        label: t('payment.status.refunded', 'Refunded'),
        badgeClass: 'bg-purple-100 text-purple-800',
        iconClass: 'bg-purple-100 text-purple-700',
        icon: <RotateCcw className="w-5 h-5" />,
      };
    default:
      return {
        label: rawStatus || t('payment.status.unknown', 'Unknown'),
        badgeClass: 'bg-slate-100 text-slate-700',
        iconClass: 'bg-slate-100 text-slate-600',
        icon: <Clock className="w-5 h-5" />,
      };
  }
};

interface TenantPaymentsViewProps {
  rentDue: TenantRentDue | null;
  summary: TenantFinancialSummary;
  paymentHistory: TenantPaymentHistoryItem[];
  onPayRent: () => void;
  onViewReceipt: (payment: TenantPaymentHistoryItem) => void;
}

export const TenantPaymentsView: React.FC<TenantPaymentsViewProps> = ({
  rentDue,
  summary,
  paymentHistory,
  onPayRent,
  onViewReceipt,
}) => {
  const { t, language } = useI18n();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'utilities' | 'history'>('upcoming');

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isDue = rentDue && rentDue.status !== 'PAID';

  return (
    <div id="tenant-payments-view" className="space-y-6">
      {/* Top Banner with Due status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {t('tenant.currentRentStatus', 'Current Rent Status')}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-slate-900">
              {rentDue ? rentDue.amount.toLocaleString() : '0'}
            </span>
            <span className="text-sm font-bold text-slate-600 uppercase">
              {rentDue?.currency || 'IQD'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {t('tenant.dueDate', 'Due Date:')}{' '}
              <span dir="ltr">{rentDue?.dueDate ? formatDueDate(rentDue.dueDate) : t('tenant.noPaymentDue', 'No Payment Due')}</span>
            </span>
          </p>
        </div>

        <div>
          {isDue ? (
            <button
              id="payments-view-pay-btn"
              type="button"
              onClick={onPayRent}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('tenant.payRentWith', 'Pay Rent with FIB / FastPay')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('tenant.allPaidUp', 'All Paid for Current Period')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          id="btn-tab-upcoming-schedules"
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('tenant.upcomingSchedules', 'Upcoming Rent Schedules')}
        </button>
        <button
          id="btn-tab-utility-bills"
          type="button"
          onClick={() => setActiveTab('utilities')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'utilities'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('tenant.utilityBills', 'Utility Bills')}
        </button>
        <button
          id="btn-tab-payment-history"
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('tenant.paymentHistoryReceipts', 'Payment History & Receipts')} ({paymentHistory.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'upcoming' ? (
        <div className="space-y-3">
          {rentDue ? (
            <div className="bg-white rounded-2xl border border-blue-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {t('tenant.payMonthlyRent', 'Monthly Rent Payment')}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {t('tenant.period', 'Period')}: <span dir="ltr">{rentDue.periodStart || '2026-05-01'} → {rentDue.periodEnd || '2026-05-31'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-start sm:text-end">
                  <span className="text-base font-black text-slate-900 block" dir="ltr">
                    {rentDue.amount.toLocaleString()} {rentDue.currency}
                  </span>
                  <span className="text-[11px] font-bold text-amber-600">
                    {t('tenant.dueDate', 'Due Date:')} <span dir="ltr">{formatDueDate(rentDue.dueDate)}</span>
                  </span>
                </div>
                <button
                  id="btn-upcoming-pay-now"
                  type="button"
                  onClick={onPayRent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {t('tenant.payRentNow', 'Pay Now')}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
              {t('tenant.noUpcomingSchedules', 'No upcoming rent schedules due at this moment.')}
            </div>
          )}
        </div>
      ) : activeTab === 'utilities' ? (
        <TenantUtilityBillsView />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              {t('tenant.paymentHistoryReceipts', 'Verified Payment Receipts')}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {t('tenant.authorizedReceipts', 'HomeHub Authorized Receipts')}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paymentHistory.map((p) => {
              const displayPeriod = p.period.includes('April')
                ? p.period.replace('April', t('tenant.monthApril', 'April'))
                : p.period.includes('March')
                ? p.period.replace('March', t('tenant.monthMarch', 'March'))
                : p.period.includes('May')
                ? p.period.replace('May', t('tenant.monthMay', 'May'))
                : p.period;

              const statusConfig = getPaymentStatusConfig(p.status, t);

              return (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusConfig.iconClass}`}>
                    {statusConfig.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {displayPeriod}
                    </h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span dir="ltr">{p.paymentDate}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-600" dir="ltr">{p.referenceNumber}</span>
                      <span>•</span>
                      <span>{t('tenant.paymentMethod', 'Method')}: <span dir="ltr">{p.paymentMethod}</span></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <div className="text-start sm:text-end">
                    <span className="text-base font-black text-slate-900 block" dir="ltr">
                      {p.amount.toLocaleString()} {p.currency}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeClass}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewReceipt(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('tenant.viewReceipt', 'Receipt')}</span>
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
};

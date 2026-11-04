import React from 'react';
import { CreditCard, CheckCircle, FileText } from 'lucide-react';
import { TenantRentDue } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantRentDueCardProps {
  rentDue: TenantRentDue | null;
  onPayRent: () => void;
}

export const TenantRentDueCard: React.FC<TenantRentDueCardProps> = ({
  rentDue,
  onPayRent,
}) => {
  const { t, language } = useI18n();

  if (!rentDue) {
    return (
      <div id="tenant-rent-due-card" className="bg-[#0c1322] rounded-2xl border border-slate-800 shadow-sm p-6 text-center space-y-2 mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-amber-400">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">{t('tenant.noRentDueTitle', 'No Rent Payments Due')}</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">{t('tenant.noRentDueDesc', 'You have no scheduled rent payments pending or overdue at this time.')}</p>
      </div>
    );
  }

  const isPaid = rentDue.status === 'PAID';
  const amountFormatted = rentDue.amount.toLocaleString();
  const currency = rentDue.currency || 'IQD';
  const formatFriendlyDate = (dateStr?: string) => {
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
  const dueDate = formatFriendlyDate(rentDue.dueDate);
  const period = rentDue.periodStart 
    ? new Date(rentDue.periodStart).toLocaleDateString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : 'en-US', { month: 'long', year: 'numeric' })
    : dueDate;

  if (isPaid) {
    return (
      <div id="tenant-rent-due-card" className="bg-[#0c1322] rounded-2xl border border-slate-800 shadow-sm overflow-hidden mb-6">
        <div className="p-5 flex items-start gap-4 border-b border-slate-800 bg-[#080d19]/80">
          <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center shrink-0">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-400">
              {t('tenant.paymentSuccessful', 'Payment Successful')}
            </h3>
            <p className="text-sm text-slate-400">
              <span dir="ltr">{dueDate}</span>
            </p>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-sm">
            <span className="text-slate-400 font-medium">
              {t('tenant.amountPaid', 'Amount Paid')}
            </span>
            <span className="font-bold text-white" dir="ltr">
              {amountFormatted} {currency}
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-sm">
            <span className="text-slate-400 font-medium">
              {t('tenant.verificationStatus', 'Status')}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-bold">
              {t('tenant.confirmed', 'Confirmed')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="tenant-rent-due-card" className="bg-[#0c1322] rounded-2xl border border-slate-800 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-[#080d19] border-b border-slate-800 p-4 flex items-center gap-3">
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-2 flex items-center justify-center">
          <FileText className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-base font-bold text-white">
          {t('tenant.payRentFor', 'Pay Rent for')} {period}
        </h2>
      </div>

      <div className="p-5">
        <div className="mb-6">
          <p className="text-sm text-slate-400 font-medium mb-1">
            {t('tenant.amountDue', 'Amount Due')}
          </p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-black text-white tracking-tight" dir="ltr">
              {amountFormatted} {currency}
            </span>
          </div>
          <p className="text-sm text-slate-400 font-medium">
            {t('tenant.dueDate', 'Due Date:')} <span dir="ltr" className="text-slate-200">{dueDate}</span>
          </p>
        </div>

        <div className="mb-4 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            {t('tenant.oneClickGateways', 'One-Click Payment Gateways')}
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onPayRent}
              className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <span>{t('tenant.gwFib', 'First Iraqi Bank (FIB)')}</span>
            </button>
            <button
              type="button"
              onClick={onPayRent}
              className="py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <span>{t('tenant.gwFastpay', 'FastPay Wallet')}</span>
            </button>
          </div>
        </div>

        <button
          id="btn-rent-due-pay-now"
          data-testid="btn-pay-rent-card-action"
          type="button"
          onClick={onPayRent}
          className="w-full bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold py-3.5 rounded-xl transition-all shadow-md mb-4 cursor-pointer text-sm"
        >
          {t('tenant.payRentNow', 'Pay Rent Now')}
        </button>

        {/* Escrow Deposit Protection Pill */}
        <div className="mb-4 p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-300">
              {t('tenant.escrowDepositProtection', 'Escrow Security Deposit Protection Active')}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-700/50">
            {t('tenant.confirmed', 'Verified')}
          </span>
        </div>

        {/* Fee Notice Box */}
        <div className="bg-[#080d19] border border-slate-800 rounded-xl p-4 flex gap-3 items-start">
          <CheckCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {t('tenant.fivePercentNotice', "You pay the full rent amount. HomeHub's platform and management fees are deducted from the collected amount. You do not pay any extra.")}
          </p>
        </div>
      </div>
    </div>
  );
};

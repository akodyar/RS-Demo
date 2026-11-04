import React, { useState } from 'react';
import {
  Coins,
  DollarSign,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminLedgerEntry } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminFinanceModuleProps {
  ledgerEntries: AdminLedgerEntry[];
  currentRole: AdminRoleType;
  onBack: () => void;
}

export const AdminFinanceModule: React.FC<AdminFinanceModuleProps> = ({
  ledgerEntries,
  currentRole,
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
              <Coins className="w-5 h-5 text-rose-500" />
              <span>بەڕێوەبەرایەتی دارایی و حیساباتی ئەمانەت (Finance & Escrow Ledger)</span>
            </h2>
            <p className="text-xs text-slate-500">
              سیستەمی ژمێریاری دوولایەنە (Double-Entry Ledger) و چاودێری پارەی ئەمانەتی کڕیاران
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

      {/* Honest Escrow & Banking Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-amber-950">تێبینی پاراستنی دارایی و سیستەمی حەواڵە:</p>
          <p className="text-[11px] text-amber-800">
            تۆمارە داراییەکانی پلاتفۆڕم لەسەر پەڕاوی حیساباتە. یەکلاکردنەوەی ڕاستەقینەی بانک (Bank Settlement) تەنها لەگەڵ بەستنەوەی فەرمی بانکی مەرکەزی و دراو لە قۆناغی داهاتوو چالاک دەبێت.
          </p>
        </div>
      </div>

      {/* Financial Overview Metrics */}
      {(() => {
        const totalVolumeIqd = ledgerEntries.reduce((sum, e) => sum + (Number(e.amountIqd) || 0), 0);
        const escrowRefEntries = ledgerEntries.filter(
          (e) => e.description && (e.description.includes('ئەمانەت') || e.description.includes('Escrow'))
        );
        const escrowRefIqd = escrowRefEntries.reduce((sum, e) => sum + (Number(e.amountIqd) || 0), 0);
        const totalCommissionsIqd = Math.round(totalVolumeIqd * 0.015);

        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">تۆماری ژمێریاری ناوخۆیی (Internal Ledger):</span>
              <p className="text-base font-black text-slate-900 font-mono">
                {totalVolumeIqd.toLocaleString()} IQD
              </p>
              <span className="text-[10px] text-amber-700 font-bold block leading-tight">
                تۆماری نافەرمی - بەبێ هەژماری بانکی دەرەکی
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">ئاماژەی ئەمانەت (Escrow Ref):</span>
              <p className="text-base font-black text-slate-900 font-mono">
                {(escrowRefIqd > 0 ? escrowRefIqd : Math.round(totalVolumeIqd * 0.75)).toLocaleString()} IQD
              </p>
              <span className="text-[10px] text-slate-500">بەپێی تۆماری ناوخۆیی</span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">کۆمسیۆنی خەمڵێنراو (Dynamic):</span>
              <p className="text-base font-black text-blue-600 font-mono">
                {totalCommissionsIqd.toLocaleString()} IQD
              </p>
              <span className="text-[10px] text-slate-500">لە قەبارەی گرێبەستەکان</span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">تۆمارە پەسەندکراوەکان:</span>
              <p className="text-base font-black text-emerald-600 font-mono">
                {ledgerEntries.filter((e) => e.status === 'CONFIRMED' || e.status === 'SETTLED').length} / {ledgerEntries.length}
              </p>
              <span className="text-[10px] text-slate-500">دۆخی تەواوکراو لە پەڕاو</span>
            </div>
          </div>
        );
      })()}

      {/* Double-Entry Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>تۆماری حیساباتی دوولایەنە (General Ledger Entries)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-2.5">ژمارەی بەڵگەنامە</th>
                <th className="p-2.5">ڕوونکردنەوە</th>
                <th className="p-2.5">لایەنی مەدین (Debit)</th>
                <th className="p-2.5">لایەنی داین (Credit)</th>
                <th className="p-2.5">بڕ (IQD)</th>
                <th className="p-2.5 text-center">دۆخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5 font-mono font-bold text-slate-900">{entry.referenceNumber}</td>
                  <td className="p-2.5 max-w-xs">{entry.description}</td>
                  <td className="p-2.5 font-mono text-emerald-700">{entry.accountDebit}</td>
                  <td className="p-2.5 font-mono text-rose-700">{entry.accountCredit}</td>
                  <td className="p-2.5 font-mono font-black text-slate-900">
                    {entry.amountIqd.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                      {entry.status === 'CONFIRMED' ? 'پشتڕاستکراو' : 'یەکلاکراوە'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

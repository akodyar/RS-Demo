import React, { useState } from 'react';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Lock,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  DollarSign,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminCompanyRecord } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminCompaniesModuleProps {
  companies: AdminCompanyRecord[];
  currentRole: AdminRoleType;
  onUpdateCompanyStatus: (companyId: string, status: AdminCompanyRecord['status'], reason: string) => void;
  onBack: () => void;
}

export const AdminCompaniesModule: React.FC<AdminCompaniesModuleProps> = ({
  companies,
  currentRole,
  onUpdateCompanyStatus,
  onBack,
}) => {
  const { direction } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<AdminCompanyRecord | null>(null);
  const [reasonInput, setReasonInput] = useState('');

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  const filteredCompanies = companies.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.tradeNameKurdish.toLowerCase().includes(q) ||
        c.licenseNumber.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="گەڕانەوە"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>بەڕێوەبردنی کۆمپانیا و نووسینگەکان (Company Oversight)</span>
            </h2>
            <p className="text-xs text-slate-500">
              جیاکردنەوەی فەرمی نێوان <strong>خاوەنداریەتی موڵک</strong> و <strong>دەسەڵاتی بەڕێوەبردن</strong>
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

      {/* Authority Notice Box */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 space-y-1">
        <div className="flex items-center gap-2 font-bold text-blue-950">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          <span>یاسای جیاکاری خاوەنداری (Ownership vs Management Authority):</span>
        </div>
        <p className="leading-relaxed text-blue-800 text-[11px]">
          کۆمپانیا و برۆکەرەکان تەنها وەکیل و بەڕێوەبەری گرێبەستن بەپێی ڕێککەوتننامەی فەرمی. بە هیچ شێوەیەک کۆمپانیا نابێتە خاوەنی سەندی تاپۆی کڕیار یان خاوەن موڵک.
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="گەڕان بەپێی ناوی کۆمپانیا، مۆڵەت، شار..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredCompanies.map((cmp) => (
          <div
            key={cmp.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                    {cmp.tradeNameKurdish}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-400 font-mono mt-0.5">
                    {cmp.name} • {cmp.licenseNumber}
                  </p>
                </div>

                {cmp.status === 'verified' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>مۆڵەتپێدراو</span>
                  </span>
                )}
                {cmp.status === 'pending' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>چاوەڕوان</span>
                  </span>
                )}
                {cmp.status === 'suspended' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>ڕاگیراو</span>
                  </span>
                )}
              </div>

              {/* Stats & Thresholds */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">موڵکە بەڕێوەبراوەکان:</span>
                  <strong className="text-slate-800">{cmp.managedPropertiesCount ?? 0} موڵک</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">برۆکەرە چالاکەکان:</span>
                  <strong className="text-slate-800">{cmp.agentCount ?? 0} کەس</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">سنووری خەرجی خۆکار:</span>
                  <strong className="text-slate-800 font-mono">
                    {(cmp.spendingLimitIqd ?? 0).toLocaleString()} IQD
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">پێویستی بە پەسەندکردن:</span>
                  <strong className="text-blue-700 font-mono">
                    سەرووی {(cmp.approvalRequiredAboveIqd ?? 0).toLocaleString()} IQD
                  </strong>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedCompany(cmp)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                پشکنینی بەڵگەنامە و گرێبەستەکان
              </button>

              {!isReadOnly && (
                <div>
                  {cmp.status === 'verified' ? (
                    <button
                      type="button"
                      onClick={() => onUpdateCompanyStatus(cmp.id, 'suspended', 'ڕاگرتنی مۆڵەت')}
                      className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs border border-rose-200 cursor-pointer"
                    >
                      ڕاگرتن
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUpdateCompanyStatus(cmp.id, 'verified', 'پەسەندکردنی فەرمی مۆڵەت')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-2xs cursor-pointer"
                    >
                      بەخشینی باجی فەرمی
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                وردەکاری گرێبەستی بەڕێوەبردن (Management Scope)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-800 text-sm">{selectedCompany.tradeNameKurdish}</p>
              <p className="text-slate-500 font-mono">ژمارەی تۆماری وەزارەت: {selectedCompany.licenseNumber}</p>
              <p className="text-slate-500">پەیوەندی: {selectedCompany.contactPerson} ({selectedCompany.phone})</p>
              <p className="text-slate-500">بەرواری بەسەرچوونی گرێبەست: {selectedCompany.agreementExpiry}</p>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-900 text-[11px] font-medium border border-amber-200">
                ئاستی مەترسی (Risk Score): <strong className="font-bold">{selectedCompany.riskScore}</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  UserCheck,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminVerificationItem } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminVerificationModuleProps {
  items: AdminVerificationItem[];
  currentRole: AdminRoleType;
  onDecideVerification: (itemId: string, decision: 'VERIFIED' | 'REJECTED', reason: string) => void;
  onBack: () => void;
}

export const AdminVerificationModule: React.FC<AdminVerificationModuleProps> = ({
  items,
  currentRole,
  onDecideVerification,
  onBack,
}) => {
  const { direction } = useI18n();
  const [selectedItem, setSelectedItem] = useState<AdminVerificationItem | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  const handleDecision = (decision: 'VERIFIED' | 'REJECTED') => {
    if (!selectedItem) return;
    onDecideVerification(selectedItem.id, decision, decisionReason || 'بڕیاری بەڕێوەبەرایەتی پشکنین');
    setSelectedItem(null);
    setDecisionReason('');
  };

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
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <span>ناوەندی دڵنیابوونەوە و متمانە (Verification & Trust Center)</span>
            </h2>
            <p className="text-xs text-slate-500">
              پشکنینی ناسنامەی نیشتمانی، مۆڵەتی ژووری بازرگانی، و سەندەکانی تاپۆ
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

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  {item.subjectType === 'PROPERTY_TAPU' && <FileText className="w-5 h-5" />}
                  {item.subjectType === 'COMPANY_LICENSE' && <Building className="w-5 h-5" />}
                  {item.subjectType === 'USER_KYC' && <UserCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    داواکار: <strong className="text-slate-700">{item.requesterName}</strong> • {item.documentType}
                  </p>
                </div>
              </div>

              {item.status === 'PENDING' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>چاوەڕوانی پشکنین</span>
                </span>
              )}
              {item.status === 'VERIFIED' && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>پەسەندکراو</span>
                </span>
              )}
              {item.status === 'REJECTED' && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  <span>ڕەتکراوەتەوە</span>
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs">
              <span className="font-mono text-slate-700">ژمارەی دۆکیۆمێنت: {item.documentNumber}</span>
              <span className="text-slate-400">{item.dateSubmitted}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                پشکنینی بەڵگەنامە و بڕیاردان
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inspection & Decision Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                پشکنینی فەرمی بەڵگەنامە و بڕیاری بەڕێوەبەر
              </h3>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <p className="font-bold text-slate-900">{selectedItem.title}</p>
                <p className="text-slate-600">داواکار: {selectedItem.requesterName}</p>
                <p className="text-slate-600 font-mono">ژمارە: {selectedItem.documentNumber}</p>
              </div>

              {selectedItem.evidenceUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <img
                    src={selectedItem.evidenceUrl}
                    alt="Document Evidence"
                    className="w-full h-44 object-cover"
                  />
                  <div className="p-2 bg-slate-50 text-[11px] text-slate-500 text-center font-medium">
                    پشکنینی بەڵگەنامەی سکانکراوی فەرمی
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">تێبینی یان هۆکاری بڕیار:</label>
                <input
                  type="text"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="هۆکاری پەسەندکردن یان ڕەتکردنەوە بنووسە..."
                  className="w-full text-xs p-2 rounded-xl bg-slate-50 border border-slate-200 outline-none"
                />
              </div>
            </div>

            {!isReadOnly ? (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDecision('REJECTED')}
                  className="px-4 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs border border-rose-200 cursor-pointer"
                >
                  ڕەتکردنەوە
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision('VERIFIED')}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-xs cursor-pointer"
                >
                  پەسەندکردنی فەرمی
                </button>
              </div>
            ) : (
              <div className="text-center text-xs text-amber-700 font-bold py-1 bg-amber-50 rounded-xl">
                ئاستی دەسەڵات تەنها ڕێگە بە چاوپێخشاندن دەدات.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

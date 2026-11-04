import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { useToast } from '../ui/Toast';
import { X, AlertTriangle, ShieldAlert, CheckCircle2, FileText, Camera } from 'lucide-react';

interface TenantDepositDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deduction: {
    id: string;
    amount: string | number;
    currency?: string;
    category?: string;
    description?: string;
    evidenceRefs?: string[] | null;
    disputeDeadline?: string | null;
  } | null;
  onSuccess: () => void;
}

export const TenantDepositDisputeModal: React.FC<TenantDepositDisputeModalProps> = ({
  isOpen,
  onClose,
  deduction,
  onSuccess,
}) => {
  const { t, direction } = useI18n();
  const { token } = useAuth();
  const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token')) : null);
  const { showToast } = useToast();

  const [disputeReason, setDisputeReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !deduction) return null;

  const isExpired = deduction.disputeDeadline ? new Date() > new Date(deduction.disputeDeadline) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpired) {
      setError(t('dispute.error.window_expired', 'The statutory 30-day contestation window has expired. Formal disputes can no longer be submitted.'));
      return;
    }
    const trimmedReason = disputeReason.trim();
    if (!trimmedReason) {
      setError(t('dispute.error.reason_required', 'Dispute reason is required.'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenant/deductions/${deduction.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          disputeReason: trimmedReason,
          evidenceRefs: evidenceRef.trim() ? [evidenceRef.trim()] : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit dispute.');
      }

      showToast(t('dispute.success', 'Your formal dispute has been submitted and recorded.'), 'success');
      setDisputeReason('');
      setEvidenceRef('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error submitting dispute');
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {t('dispute.title', 'Dispute Security Deposit Deduction')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('dispute.subtitle', 'Submit formal contestation within the statutory 30-day notice window.')}
            </p>
          </div>
        </div>

        {/* Deduction summary */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-500 uppercase">{deduction.category}</span>
            <span className="font-black text-slate-900" dir="ltr">
              {Number(deduction.amount).toLocaleString()} {deduction.currency || 'IQD'}
            </span>
          </div>
          <p className="text-slate-700 font-medium">{deduction.description}</p>
          {deduction.disputeDeadline && (
            <div className={`text-[11px] font-bold pt-1 border-t border-slate-200/60 ${isExpired ? 'text-slate-500' : 'text-amber-700'}`}>
              {t('tenant.disputeWindowNotice', 'Contestation Window Closes:')}{' '}
              <span dir="ltr" className="font-medium">{new Date(deduction.disputeDeadline).toLocaleDateString()}</span>
              {isExpired && <span className="ms-1.5 text-rose-600 font-extrabold">({t('tenant.windowClosedBadge', 'Closed')})</span>}
            </div>
          )}
        </div>

        {isExpired && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{t('dispute.window_expired_warning', 'The statutory 30-day contestation window has expired. Formal disputes can no longer be submitted.')}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t('dispute.reason_label', 'Contestation & Evidence Rationale *')}
            </label>
            <textarea
              required
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder={t('dispute.reason_ph', 'Explain why this deduction is unwarranted (e.g. pre-existing wear, move-in baseline note, landlord responsibility)...')}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t('dispute.evidence_label', 'Evidence Reference / Move-In Photo Key (Optional)')}
            </label>
            <input
              type="text"
              value={evidenceRef}
              onChange={(e) => setEvidenceRef(e.target.value)}
              placeholder="e.g. move-in-photos/living_room_window.jpg"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-800 leading-relaxed font-medium">
            🛡️ <strong>Deposit Protection Invariant:</strong> Once disputed, the disputed funds remain held in custodial escrow and cannot be released or deducted until resolved.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !disputeReason.trim() || isExpired}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              {submitting ? t('common.submitting', 'Submitting...') : t('dispute.submit_btn', 'Submit Formal Dispute')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

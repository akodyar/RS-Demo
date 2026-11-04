import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { Building2, ArrowUpRight, AlertCircle, RefreshCw, CheckCircle2, X } from 'lucide-react';

export const OwnerSettlementTab: React.FC = () => {
  const { t, direction } = useI18n();
  const { token } = useAuth();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string, amount: number } | null>(null);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlements/owner/settlements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 503) throw new Error('DATABASE_NOT_CONFIGURED');
        throw new Error(t('errors.fetchFailed', 'Failed to fetch settlements'));
      }
      const data = await res.json();
      setSettlements(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [token]);

  const requestPayout = async (id: string, amountIqd: number) => {
    setConfirmDialog(null);
    setRequestingId(id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/settlements/owner/settlements/${id}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amountIqd })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('errors.payoutFailed', 'Failed to request payout'));
      }
      setSuccessMsg(t('settlements.payoutSuccess', 'Payout requested successfully.'));
      fetchSettlements();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400"><RefreshCw className="animate-spin inline mr-2 w-5 h-5" /> {t('common.loading', 'Loading...')}</div>;
  if (error === 'DATABASE_NOT_CONFIGURED') return <div className="p-8 text-center text-rose-400 bg-rose-950/40 rounded-2xl border border-rose-800/50"><AlertCircle className="inline mr-2 w-6 h-6" /> {t('errors.dbUnreachable', 'Database Unreachable')}</div>;

  return (
    <div className="space-y-6" dir={direction}>
      <h2 className="text-xl font-bold text-white">{t('settlements.title', 'Settlements & Payouts')}</h2>
      
      {error && <div className="bg-rose-950/40 p-4 rounded-2xl border border-rose-800/50 text-rose-300 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-rose-400" /> {error}</div>}
      {successMsg && <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-800/50 text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> {successMsg}</div>}
      
      {settlements.length === 0 ? (
        <div className="text-center py-16 bg-[#0c1322] rounded-2xl border border-slate-800 border-dashed text-slate-400">
          {t('settlements.empty', 'No settlements found.')}
        </div>
      ) : (
        <div className="bg-[#0c1322] rounded-2xl shadow-xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-start text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t('settlements.period', 'Period')}</th>
                <th className="px-5 py-4">{t('settlements.collected', 'Collected (IQD)')}</th>
                <th className="px-5 py-4">{t('settlements.commission', 'Platform & Mgmt Fees')}</th>
                <th className="px-5 py-4">{t('settlements.expenses', 'Expenses & Maintenance')}</th>
                <th className="px-5 py-4">{t('settlements.netPayable', 'Net Payable')}</th>
                <th className="px-5 py-4">{t('settlements.status', 'Status')}</th>
                <th className="px-5 py-4">{t('settlements.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {settlements.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-slate-300" dir="ltr">{new Date(s.periodStartDate).toLocaleDateString()} - {new Date(s.periodEndDate).toLocaleDateString()}</td>
                  <td className="px-5 py-4 font-medium text-white" dir="ltr">{Number(s.totalCollectedIqd).toLocaleString()}</td>
                  <td className="px-5 py-4 text-rose-400 font-medium" dir="ltr">-{Number(s.platformCommissionIqd).toLocaleString()}</td>
                  <td className="px-5 py-4 text-amber-400 font-medium" dir="ltr">
                    {Number(s.totalExpensesIqd || 0) > 0 ? `-${Number(s.totalExpensesIqd).toLocaleString()}` : '0'}
                  </td>
                  <td className="px-5 py-4 text-emerald-400 font-bold" dir="ltr">{Number(s.netPayableIqd).toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                      s.status === 'AVAILABLE' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 
                      s.status === 'REQUESTED' ? 'bg-blue-950/60 text-blue-400 border-blue-800/60' :
                      s.status === 'PROCESSING' ? 'bg-amber-950/60 text-amber-400 border-amber-800/60' :
                      (s.status === 'COMPLETED' || s.status === 'PAID') ? 'bg-slate-800/60 text-slate-300 border-slate-700/60' :
                      'bg-rose-950/60 text-rose-400 border-rose-800/60'
                    }`}>
                      {t(`status.${s.status}`, s.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {s.status === 'AVAILABLE' && (
                      <button
                        id={`btn-request-payout-${s.id}`}
                        onClick={() => setConfirmDialog({ id: s.id, amount: s.netPayableIqd })}
                        disabled={requestingId === s.id}
                        className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {requestingId === s.id ? t('common.processing', 'Processing...') : t('settlements.requestPayout', 'Request Payout')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white">{t('settlements.confirmPayout', 'Confirm Payout Request')}</h3>
                <button onClick={() => setConfirmDialog(null)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                {t('settlements.confirmMsg', 'Are you sure you want to request a payout for')} <strong className="text-amber-400" dir="ltr">{Number(confirmDialog.amount).toLocaleString()} IQD</strong>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-800 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  id="btn-confirm-payout-modal"
                  onClick={() => requestPayout(confirmDialog.id, confirmDialog.amount)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {t('common.confirm', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

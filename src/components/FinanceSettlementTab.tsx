import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { CheckCircle2, XCircle, Clock, AlertCircle, Search, Filter } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const FinanceSettlementTab: React.FC = () => {
  const { showToast } = useToast();
  const { t, direction } = useI18n();
  const { token } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [extRef, setExtRef] = useState<{ [key: string]: string }>({});

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlements/finance/payouts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(t('errors.fetchFailed', 'Failed to fetch payouts'));
      const data = await res.json();
      setPayouts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [token]);

  const processPayout = async (id: string, status: string) => {
    const ref = extRef[id];
    if (status === 'COMPLETED' && !ref) {
      showToast(t('settlements.missingRef', 'External confirmation reference is mandatory for COMPLETED payouts (Internal Finance Record only).'), 'info');
      return;
    }
    setProcessingId(id);
    try {
      const res = await fetch(`/api/settlements/finance/payouts/${id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, externalTransactionReference: ref })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error);
      }
      setExtRef(prev => ({ ...prev, [id]: '' }));
      fetchPayouts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">{t('common.loading', 'Loading...')}</div>;
  if (error) return <div className="p-8 text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-2xl">{error}</div>;

  return (
    <div className="space-y-6" dir={direction}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{t('settlements.financeQueue', 'Payout Requests Queue')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('settlements.financeQueueDesc', 'Manage owner payouts. External API transfers disabled; manual internal recording only.')}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="text" placeholder={t('common.search', 'Search...')} className="pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 w-full md:w-64 focus:outline-none focus:border-amber-500/50" />
          </div>
          <button className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="bg-[#0c1322] rounded-2xl shadow-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-4">{t('settlements.id', 'ID')}</th>
              <th className="px-5 py-4">{t('settlements.amount', 'Amount (IQD)')}</th>
              <th className="px-5 py-4">{t('settlements.status', 'Status')}</th>
              <th className="px-5 py-4">{t('settlements.actions', 'Finance Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  {t('settlements.emptyQueue', 'No payout requests found.')}
                </td>
              </tr>
            ) : payouts.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-4" dir="ltr"><span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">{p.id.substring(0, 8)}</span></td>
                <td className="px-5 py-4 font-bold text-white" dir="ltr">{Number(p.amountIqd).toLocaleString()}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                    p.status === 'REQUESTED' ? 'bg-blue-950/60 text-blue-400 border-blue-800/60' :
                    p.status === 'COMPLETED' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' :
                    'bg-slate-800/60 text-slate-400 border-slate-700/60'
                  }`}>
                    {t(`status.${p.status}`, p.status)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {p.status === 'REQUESTED' ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        id={`input-wire-ref-${p.id}`}
                        type="text" 
                        placeholder={t('settlements.refPlaceholder', 'Bank Ref # (Required)')}
                        value={extRef[p.id] || ''}
                        onChange={e => setExtRef({ ...extRef, [p.id]: e.target.value })}
                        className="bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-1.5 text-xs w-full max-w-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          id={`btn-complete-payout-${p.id}`}
                          onClick={() => processPayout(p.id, 'COMPLETED')}
                          disabled={processingId === p.id}
                          className="text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                        >
                          {t('settlements.markComplete', 'Mark Completed')}
                        </button>
                        <button
                          id={`btn-reject-payout-${p.id}`}
                          onClick={() => processPayout(p.id, 'REJECTED')}
                          disabled={processingId === p.id}
                          className="text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {t('common.reject', 'Reject')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {p.externalTransactionReference ? `${t('settlements.ref', 'Ref')}: ${p.externalTransactionReference}` : '-'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Wrench, CheckCircle, Clock, AlertTriangle, ChevronRight, User, RefreshCw, XCircle, FileText, Check } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/ui/Toast';

export const MaintenanceWorkspacePage: React.FC = () => {
  const { showToast } = useToast();
  const { t, direction } = useI18n();
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/maintenance/company/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(t('maintenance.error.fetch', 'Failed to fetch queue'));
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedRequestId === id) {
      setExpandedRequestId(null);
      setRequestDetails(null);
      return;
    }
    setExpandedRequestId(id);
    setRequestDetails(null);
    try {
      const res = await fetch(`/api/maintenance/${id}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRequestDetails(await res.json());
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleTriage = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/maintenance/${id}/triage`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchQueue();
        if (expandedRequestId === id) toggleExpand(id); // Reload details
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveQuote = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/maintenance/quote/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchQueue();
        setExpandedRequestId(null);
      } else {
        showToast(t('maintenance.error.approve', 'Failed to approve quote'), 'error');
      }
    } catch(e) {
      console.error(e);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-rose-100 text-rose-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700';
      case 'LOW': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'REPORTED': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">{t('status.new_request', 'NEW REQUEST')}</span>;
      case 'TRIAGED': return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200">{t('status.triaged', 'TRIAGED')}</span>;
      case 'QUOTE_RECEIVED': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">{t('status.quote_ready', 'QUOTE READY')}</span>;
      case 'WORK_ORDER_CREATED': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">{t('status.work_order', 'WORK ORDER')}</span>;
      case 'COMPLETED': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-200">{t('status.completed', 'COMPLETED')}</span>;
      case 'CANCELLED': return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold border border-slate-200">{t('status.cancelled', 'CANCELLED')}</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Maintenance Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Maintenance"
            aria-label="HomeHub Maintenance"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Maintenance Navigation"
          >
            {/* Queue */}
            <button
              type="button"
              data-testid="maint-tab-queue"
              title="Work Order Queue"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold"
            >
              <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              <Wrench className="w-4.5 h-4.5 shrink-0 text-amber-400" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'ڕیز' : 'Queue'}
              </span>
              {requests.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {requests.length}
                </span>
              )}
            </button>

            {/* Triaged */}
            <button
              type="button"
              data-testid="maint-tab-triaged"
              title="Triaged"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <CheckCircle className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'دیاریکراو' : 'Triaged'}
              </span>
            </button>

            {/* Quotes */}
            <button
              type="button"
              data-testid="maint-tab-quotes"
              title="Quotes"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <FileText className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'نرخاندن' : 'Quotes'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Refresh */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={fetchQueue}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-slate-950 font-bold ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex md:hidden items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs">
                HH
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <span className="text-slate-400 font-medium">
                {direction === 'rtl' ? 'ئۆپەراسیۆن' : 'Operations'}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold">
                {t('maintenance.control_center', 'Maintenance Control Center')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {requests.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {requests.length} {direction === 'rtl' ? 'داواکاری چالاک' : 'Active Orders'}
              </span>
            )}
            <button
              onClick={fetchQueue}
              className="p-2 text-slate-300 hover:text-white bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 max-w-6xl mx-auto p-6 pb-12 w-full">

      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('ui.loading_details', 'Loading queue...')}</div>
      ) : error ? (
        <div className="p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-[#0C1322] border border-slate-800 rounded-xl p-12 text-center shadow-md">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">{t('maintenance.queue_empty', 'Queue is empty')}</h3>
          <p className="text-slate-400 mt-1">{t('maintenance.no_requests', 'There are no active maintenance requests at this time.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((item) => {
            const isExpanded = expandedRequestId === item.request.id;
            
            return (
            <div key={item.request.id} className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md overflow-hidden flex flex-col">
              <div className="flex flex-col md:flex-row">
                <div className="p-5 flex-1 cursor-pointer" onClick={() => toggleExpand(item.request.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(item.request.priority)}`}>
                        {item.request.priority}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.request.category}</span>
                    </div>
                    {getStatusBadge(item.request.status)}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{item.request.title}</h3>
                  <p className="text-sm text-slate-300 line-clamp-2 mb-4">{item.request.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Property: {item.property.name}</span>
                    <span className="flex items-center gap-1"><User className="w-4 h-4"/> Reporter: {item.request.reporterUserId.substring(0,8)}...</span>
                  </div>
                </div>
                
                <div className="bg-slate-900/60 border-t md:border-t-0 md:border-l border-slate-800 p-5 w-full md:w-64 flex flex-col justify-center gap-2">
                  {item.request.status === 'REPORTED' && (
                    <>
                      <button onClick={() => handleTriage(item.request.id, 'TRIAGED')} className="w-full py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-extrabold rounded-lg text-sm transition">
                        Triage / Assign
                      </button>
                      <button onClick={() => handleTriage(item.request.id, 'CANCELLED')} className="w-full py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition">
                        Cancel Request
                      </button>
                    </>
                  )}
                  {item.request.status === 'QUOTE_RECEIVED' && !isExpanded && (
                    <button onClick={() => toggleExpand(item.request.id)} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm transition">
                      Review Quote
                    </button>
                  )}
                  {item.request.status === 'WORK_ORDER_CREATED' && !isExpanded && (
                    <button onClick={() => toggleExpand(item.request.id)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
                      View Work Order
                    </button>
                  )}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-5 border-t border-slate-800 bg-slate-900/40">
                  <h4 className="font-bold text-white mb-4">{t('maintenance.details_actions', 'Request Details & Actions')}</h4>
                  
                  {!requestDetails ? (
                    <div className="text-sm text-slate-400">{t('ui.loading_details', 'Loading details...')}</div>
                  ) : (
                    <div className="space-y-6">
                      {item.request.status === 'QUOTE_RECEIVED' && requestDetails.quotes?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-bold text-slate-300 mb-2">{t('maintenance.pending_quotes', 'Pending Quotes')}</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {requestDetails.quotes.map((quote: any) => (
                              <div key={quote.id} className="bg-[#0C1322] border border-slate-800 p-4 rounded-lg shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-white">{t('vendor.id', 'Vendor ID:')} {quote.vendorId.substring(0,8)}</span>
                                  <span className="font-bold text-lg text-amber-400">{quote.totalAmount} {t('currency.iqd', 'IQD')}</span>
                                </div>
                                <p className="text-sm text-slate-300 mb-4">{quote.notes}</p>
                                <button onClick={() => handleApproveQuote(quote.id)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2">
                                  <Check className="w-4 h-4" /> Approve & Create Work Order
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {item.request.status === 'WORK_ORDER_CREATED' && requestDetails.workOrders?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-bold text-slate-300 mb-2">{t('maintenance.active_wos', 'Active Work Orders')}</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {requestDetails.workOrders.map((wo: any) => (
                              <div key={wo.id} className="bg-[#0C1322] border border-slate-800 p-4 rounded-lg shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-white">{t('maintenance.wo', 'WO:')} {wo.id.substring(0,8)}</span>
                                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold">{wo.status}</span>
                                </div>
                                <p className="text-sm text-slate-300 mb-2">{t('maintenance.assigned_vendor', 'Assigned Vendor:')} {wo.vendorId.substring(0,8)}</p>
                                <button onClick={() => showToast(t('ui.feature_unavailable', 'Feature available in upcoming integration.'), 'info')} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-sm border border-slate-700">
                                  Manage Schedule
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      </div>
      </div>
    </div>
  );
};

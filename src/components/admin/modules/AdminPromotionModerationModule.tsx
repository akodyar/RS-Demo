import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  Eye,
  Tag,
  ArrowLeft,
  ArrowRight,
  Lock,
  RefreshCw,
  AlertCircle,
  Coins,
  ShieldCheck,
  CreditCard,
  FileCheck,
  Building,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminRoleType } from '../../../types';
import { useAuth } from '../../AuthProvider';
import { useToast } from '../../ui/Toast';

interface AdminPromotionModerationModuleProps {
  currentRole: AdminRoleType;
  onBack: () => void;
}

export const AdminPromotionModerationModule: React.FC<AdminPromotionModerationModuleProps> = ({
  currentRole,
  onBack,
}) => {
  const { direction, language } = useI18n();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'purchase_orders'>('campaigns');

  // Campaigns Queue State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  // Purchase Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Action Processing IDs
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Reject Reason Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectCampaignId, setRejectCampaignId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  // 1. Fetch moderation queue
  const fetchModerationQueue = async () => {
    setLoadingCampaigns(true);
    setCampaignsError(null);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch('/api/promotions/admin/moderation-queue', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load campaign moderation queue.');
      }
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setCampaignsError(e.message || 'Error fetching moderation queue.');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // 2. Fetch pending purchase orders
  const fetchPurchaseOrders = async () => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch('/api/points/admin/purchase-orders?status=PENDING', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load purchase orders.');
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setOrdersError(e.message || 'Error fetching purchase orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchModerationQueue();
    fetchPurchaseOrders();
  }, [token]);

  // Campaign Actions: Approve
  const handleApproveCampaign = async (campaignId: string) => {
    if (isReadOnly) return;
    setActionInProgressId(campaignId);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch(`/api/promotions/admin/campaigns/${campaignId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ notes: 'Approved via Admin Moderation Panel' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve campaign.');
      }
      showToast('Campaign approved successfully.', 'success');
      fetchModerationQueue();
    } catch (e: any) {
      showToast(e.message || 'Error approving campaign.', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Campaign Actions: Trigger Reject Modal
  const openRejectModal = (campaignId: string) => {
    setRejectCampaignId(campaignId);
    setRejectReason('');
    setRejectError(null);
    setRejectModalOpen(true);
  };

  // Campaign Actions: Confirm Reject (releases reserved points)
  const handleConfirmReject = async () => {
    if (!rejectCampaignId) return;
    if (!rejectReason || rejectReason.trim().length < 5) {
      setRejectError('Please provide a meaningful reason (at least 5 characters).');
      return;
    }

    setActionInProgressId(rejectCampaignId);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch(`/api/promotions/admin/campaigns/${rejectCampaignId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reject campaign.');
      }
      showToast('Campaign rejected and reserved points refunded to user.', 'info');
      setRejectModalOpen(false);
      fetchModerationQueue();
    } catch (e: any) {
      setRejectError(e.message || 'Error rejecting campaign.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Purchase Order Actions: Confirm
  const handleConfirmPurchaseOrder = async (orderId: string) => {
    if (isReadOnly) return;
    setActionInProgressId(orderId);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch(`/api/points/admin/purchase-orders/${orderId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          idempotencyKey: `conf_order_${orderId}_${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to confirm purchase order.');
      }
      showToast('Payment verified and points credited to user wallet.', 'success');
      fetchPurchaseOrders();
    } catch (e: any) {
      showToast(e.message || 'Error confirming purchase order.', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="space-y-4" dir={direction} data-testid="admin-promotion-moderation-module">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="admin-moderation-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            aria-label="Back"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>
                {language === 'ku'
                  ? 'کۆنترۆڵی ڕیکلام و داواکارییەکانی خاڵ'
                  : language === 'ar'
                  ? 'إدارة الترويج وطلبات النقاط'
                  : 'Promotion Campaigns & Points Moderation'}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ku'
                ? 'پەسەندکردنی کەمپینی سپۆنسەری و پشتڕاستکردنەوەی کڕینی خاڵ'
                : language === 'ar'
                ? 'مراجعة حملات الترويج وتأكيد وصول مدفوعات شراء النقاط'
                : 'Review sponsorship campaigns and confirm manual points purchase receipts'}
            </p>
          </div>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'ku' ? 'تەنها بینین' : language === 'ar' ? 'عرض فقط' : 'Read Only'}</span>
          </div>
        )}
      </div>

      {/* 2. Sub-tab Selector */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          data-testid="tab-campaigns-queue"
          onClick={() => setActiveSubTab('campaigns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'campaigns'
              ? 'bg-amber-500 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {language === 'ku'
              ? 'کەمپینە چاوەڕوانکراوەکان'
              : language === 'ar'
              ? 'حملات الترويج المعلقة'
              : 'Pending Campaigns'}
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {campaigns.length}
          </span>
        </button>

        <button
          type="button"
          data-testid="tab-purchase-orders"
          onClick={() => setActiveSubTab('purchase_orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'purchase_orders'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>
            {language === 'ku'
              ? 'داواکارییەکانی کڕینی خاڵ'
              : language === 'ar'
              ? 'طلبات شراء النقاط'
              : 'Points Purchase Orders'}
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {orders.length}
          </span>
        </button>
      </div>

      {/* 3. Sub-Tab 1: Campaign Moderation Queue */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-3" data-testid="campaigns-moderation-queue">
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
            <span>
              {language === 'ku'
                ? `${campaigns.length} کەمپینی تۆمارکراو چاوەڕوانی بڕیارن`
                : language === 'ar'
                ? `${campaigns.length} حملة قيد المراجعة`
                : `${campaigns.length} submitted campaigns awaiting review`}
            </span>
            <button
              type="button"
              onClick={fetchModerationQueue}
              className="text-amber-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{language === 'ku' ? 'نوێکردنەوە' : language === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
              <p className="text-xs">Loading queue...</p>
            </div>
          ) : campaignsError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {campaignsError}
            </div>
          ) : campaigns.length === 0 ? (
            <div
              className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center text-slate-500 space-y-2"
              data-testid="no-pending-campaigns"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-xs text-slate-700">
                {language === 'ku'
                  ? 'هیچ داواکارییەکی ڕیکلام لە چاوەڕوانیدا نییە'
                  : language === 'ar'
                  ? 'لا توجد حملات ترويج معلقة حالياً'
                  : 'No pending promotion campaigns in the queue.'}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === 'ku'
                  ? 'هەموو کەمپینەکان پێداچوونەوەیان بۆ کراوە.'
                  : language === 'ar'
                  ? 'تمت مراجعة كافة الطلبات السابقة.'
                  : 'All submitted campaigns have been reviewed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  data-testid={`campaign-item-${c.id}`}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{c.campaignType}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {c.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">ID: {c.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Points Cost:</span>
                        <span className="font-black text-amber-600" dir="ltr">
                          {Number(c.pointsCost).toLocaleString()} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Duration:</span>
                        <span className="font-bold text-slate-700">{c.durationDays} days</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Consent:</span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            c.consentStatus === 'GRANTED' || c.consentStatus === 'NOT_REQUIRED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.consentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Listing ID:</span>
                      <span className="font-mono text-slate-800 font-semibold">{c.listingId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Requester User:</span>
                      <span className="font-mono text-slate-800 font-semibold">{c.requesterUserId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Payer User:</span>
                      <span className="font-mono text-slate-800 font-semibold">{c.payerUserId}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`reject-campaign-btn-${c.id}`}
                        disabled={actionInProgressId === c.id}
                        onClick={() => openRejectModal(c.id)}
                        className="px-3.5 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{language === 'ku' ? 'ڕەتکردنەوە (Refund)' : language === 'ar' ? 'رفض واسترداد' : 'Reject & Refund'}</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`approve-campaign-btn-${c.id}`}
                        disabled={actionInProgressId === c.id}
                        onClick={() => handleApproveCampaign(c.id)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        {actionInProgressId === c.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{language === 'ku' ? 'پەسەندکردن' : language === 'ar' ? 'اعتماد الحملة' : 'Approve Campaign'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Sub-Tab 2: Points Purchase Orders */}
      {activeSubTab === 'purchase_orders' && (
        <div className="space-y-3" data-testid="purchase-orders-queue">
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
            <span>
              {language === 'ku'
                ? `${orders.length} داواکاری کڕین لە دۆخی چاوەڕوانی دایە`
                : language === 'ar'
                ? `${orders.length} طلب شراء معلق`
                : `${orders.length} pending purchase orders`}
            </span>
            <button
              type="button"
              onClick={fetchPurchaseOrders}
              className="text-amber-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{language === 'ku' ? 'نوێکردنەوە' : language === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>

          {loadingOrders ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-700" />
              <p className="text-xs">Loading orders...</p>
            </div>
          ) : ordersError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div
              className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center text-slate-500 space-y-2"
              data-testid="no-pending-purchase-orders"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-xs text-slate-700">
                {language === 'ku'
                  ? 'هیچ داواکارییەکی کڕینی خاڵ لە چاوەڕوانیدا نییە'
                  : language === 'ar'
                  ? 'لا توجد طلبات شراء نقاط معلقة'
                  : 'No pending purchase orders.'}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === 'ku'
                  ? 'سەرجەم پارەدانەکان پەسەندکراون یاخود جێبەجێ کراون.'
                  : language === 'ar'
                  ? 'تم تأكيد ومعالجة كافة الطلبات السابقة.'
                  : 'All orders have been processed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  data-testid={`purchase-order-item-${o.id}`}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{o.packageId}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {o.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">Order: {o.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          {language === 'ku' ? 'خاڵ:' : language === 'ar' ? 'النقاط:' : 'Points:'}
                        </span>
                        <span className="font-black text-amber-600" dir="ltr">
                          +{Number(o.points).toLocaleString()} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          {language === 'ku' ? 'نرخ:' : language === 'ar' ? 'السعر:' : 'Price:'}
                        </span>
                        <span className="font-extrabold text-slate-900" dir="ltr">
                          {Number(o.price).toLocaleString()} {o.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {language === 'ku' ? 'ناسنامەی کڕیار:' : language === 'ar' ? 'معرف المشتري:' : 'User ID:'}
                      </span>
                      <span className="font-mono text-slate-800 font-semibold">{o.userId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {language === 'ku' ? 'شێوازی پارەدان:' : language === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}
                      </span>
                      <span className="font-semibold text-slate-800">{o.paymentMethod || 'MANUAL'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {language === 'ku' ? 'ژمارەی پسوولە / سەرچاوە:' : language === 'ar' ? 'رقم الوصل / المرجع:' : 'Payment Reference:'}
                      </span>
                      <span className="font-mono text-slate-800">{o.paymentReference || 'None'}</span>
                    </div>
                  </div>

                  {/* Action */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`confirm-purchase-order-btn-${o.id}`}
                        disabled={actionInProgressId === o.id}
                        onClick={() => handleConfirmPurchaseOrder(o.id)}
                        className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        {actionInProgressId === o.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {language === 'ku'
                            ? 'پشتڕاستکردنەوە و خستنەسەری خاڵ'
                            : language === 'ar'
                            ? 'تأكيد وإيداع النقاط'
                            : 'Confirm & Credit Points'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>
                  {language === 'ku'
                    ? 'هۆکاری ڕەتکردنەوەی کەمپین'
                    : language === 'ar'
                    ? 'سبب رفض الحملة الإعلانية'
                    : 'Rejection Reason'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {rejectError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {rejectError}
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'ku'
                ? 'تکایە هۆکاری ڕەتکردنەوە بنووسە. خاڵە پارێزراوەکان ئۆتۆماتیکی بۆ باڵانسی بەکارهێنەر دەگەڕێنرێنەوە.'
                : language === 'ar'
                ? 'يرجى توضيح سبب الرفض. سيتم إرجاع كافة النقاط المحجوزة تلقائياً إلى رصيد المستخدم.'
                : 'Please specify the rejection reason. All reserved points will be atomically released back to the user wallet.'}
            </p>

            <textarea
              data-testid="rejection-reason-input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Listing details require clearer rental terms, or image quality does not meet advertising guidelines."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-rejection-btn"
                disabled={actionInProgressId === rejectCampaignId}
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirm Rejection & Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

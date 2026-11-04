import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Bell,
  AlertCircle,
  CheckCircle2,
  Users,
  ArrowLeft,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminDisputeTicket } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminCommunicationsModuleProps {
  disputes: AdminDisputeTicket[];
  currentRole: AdminRoleType;
  onResolveDispute: (ticketId: string, resolution: string) => void;
  onSendBroadcast: (title: string, message: string) => void;
  onBack: () => void;
}

export const AdminCommunicationsModule: React.FC<AdminCommunicationsModuleProps> = ({
  disputes,
  currentRole,
  onResolveDispute,
  onSendBroadcast,
  onBack,
}) => {
  const { language, direction } = useI18n();
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<AdminDisputeTicket | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const t = {
    ku: {
      title: 'پەیامەکان، ناکۆکییەکان و ئاگادارییە گشتییەکان',
      subtitle: 'ناوەندی ناوبژیوانی کێشەکان و ناردنی ئاگاداری سەرانسەری بۆ بەکارهێنەران',
      broadcastTitle: 'ناردنی ئاگاداری گشتی (System Broadcast)',
      broadcastDesc: 'ئەم پەیامە راستەوخۆ دەگاتە هەموو بەکارهێنەران و برۆکەرە چالاکەکانی سەر پلاتفۆڕم.',
      labelTitle: 'ناونیشانی ئاگاداری:',
      placeholderTitle: 'بۆ نموونە: نوێکردنەوەی سیستەم یان یاسای نوێی تاپۆ...',
      labelMessage: 'دەقی پەیام:',
      placeholderMessage: 'دەقی تەواوی ئاگادارییەکە لێرە بنووسە...',
      successMsg: 'ئاگادارییەکە بە سەرکەوتوویی بۆ هەموو لایەک نێردرا!',
      publishBtn: 'بڵاوکردنەوەی فەرمی',
      disputesTitle: 'ناکۆکی و کێشە تۆمارکراوەکان (Disputes)',
      cases: 'کەیس',
      parties: 'لایەنەکان:',
      against: 'دژی',
      investigation: 'لێکۆڵینەوە',
      resolved: 'چارەسەرکراو',
      resolveBtn: 'بڕیاردان و یەکلاکردنەوە',
      modalTitle: 'یەکلاکردنەوەی ناکۆکی:',
      modalLabel: 'بڕیاری فەرمی بەڕێوەبەر:',
      modalPlaceholder: 'بۆ نموونە: گەڕاندنەوەی بڕی 500,000 دیناری ئەمانەت بۆ کڕیار...',
      cancel: 'پەشیمانبوونەوە',
      confirm: 'پەسەندکردنی بڕیار',
      defaultResolution: 'یەکلاکرایەوە بە بڕیاری بەڕێوەبەر',
    },
    ar: {
      title: 'الاتصالات والنزاعات والإشعارات العامة',
      subtitle: 'مركز فض النزاعات وإرسال الإشعارات الشاملة لجميع مستخدمي المنصة',
      broadcastTitle: 'إرسال إشعار عام (بث النظام)',
      broadcastDesc: 'تصل هذه الرسالة مباشرة إلى جميع المستخدمين والشركات المسجلة على المنصة.',
      labelTitle: 'عنوان الإشعار:',
      placeholderTitle: 'مثال: تحديث النظام أو التعليمات التنظيمية الجديدة...',
      labelMessage: 'نص الرسالة:',
      placeholderMessage: 'اكتب نص الإشعار الكامل هنا...',
      successMsg: 'تم إرسال الإشعار بنجاح لجميع المستخدمين!',
      publishBtn: 'نشر الإشعار رسمياً',
      disputesTitle: 'النزاعات والشكاوى المسجلة (Disputes)',
      cases: 'حالات',
      parties: 'الأطراف:',
      against: 'ضد',
      investigation: 'قيد التحقيق',
      resolved: 'تم الحل',
      resolveBtn: 'إصدار القرار والفصل',
      modalTitle: 'الفصل في النزاع:',
      modalLabel: 'القرار الإداري الرسمي:',
      modalPlaceholder: 'مثال: تسوية النزاع أو إعادة مبلغ التأمين...',
      cancel: 'إلغاء',
      confirm: 'اعتماد القرار',
      defaultResolution: 'تم الفصل بقرار الإدارة الرسمية',
    },
    en: {
      title: 'Communications, Disputes & System Broadcasts',
      subtitle: 'Dispute arbitration hub and platform-wide broadcast delivery center',
      broadcastTitle: 'System Broadcast Announcement',
      broadcastDesc: 'This announcement is broadcast directly to all active users and companies across the platform.',
      labelTitle: 'Announcement Title:',
      placeholderTitle: 'e.g. Scheduled system maintenance or updated regulations...',
      labelMessage: 'Message Body:',
      placeholderMessage: 'Write complete broadcast announcement text here...',
      successMsg: 'Broadcast announcement successfully dispatched to all recipients!',
      publishBtn: 'Publish Broadcast',
      disputesTitle: 'Registered Disputes & Arbitration Cases',
      cases: 'cases',
      parties: 'Parties:',
      against: 'vs',
      investigation: 'Under Investigation',
      resolved: 'Resolved',
      resolveBtn: 'Arbitrate & Resolve',
      modalTitle: 'Resolve Dispute:',
      modalLabel: 'Official Admin Decision:',
      modalPlaceholder: 'e.g. Return full security deposit to tenant or formal settlement...',
      cancel: 'Cancel',
      confirm: 'Confirm Decision',
      defaultResolution: 'Resolved by official platform administrative decision',
    },
  }[language as 'ku' | 'ar' | 'en'] || {
    title: 'Communications, Disputes & System Broadcasts',
    subtitle: 'Dispute arbitration hub and platform-wide broadcast delivery center',
    broadcastTitle: 'System Broadcast Announcement',
    broadcastDesc: 'This announcement is broadcast directly to all active users and companies across the platform.',
    labelTitle: 'Announcement Title:',
    placeholderTitle: 'e.g. Scheduled system maintenance or updated regulations...',
    labelMessage: 'Message Body:',
    placeholderMessage: 'Write complete broadcast announcement text here...',
    successMsg: 'Broadcast announcement successfully dispatched to all recipients!',
    publishBtn: 'Publish Broadcast',
    disputesTitle: 'Registered Disputes & Arbitration Cases',
    cases: 'cases',
    parties: 'Parties:',
    against: 'vs',
    investigation: 'Under Investigation',
    resolved: 'Resolved',
    resolveBtn: 'Arbitrate & Resolve',
    modalTitle: 'Resolve Dispute:',
    modalLabel: 'Official Admin Decision:',
    modalPlaceholder: 'e.g. Return full security deposit to tenant or formal settlement...',
    cancel: 'Cancel',
    confirm: 'Confirm Decision',
    defaultResolution: 'Resolved by official platform administrative decision',
  };

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    onSendBroadcast(broadcastTitle, broadcastMessage);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 4000);
  };

  const handleResolveTicket = () => {
    if (!resolvingTicket) return;
    onResolveDispute(resolvingTicket.id, resolutionText || t.defaultResolution);
    setResolvingTicket(null);
    setResolutionText('');
  };

  return (
    <div className="space-y-4" dir={direction}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            id="btn-admin-comms-back"
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>{t.title}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Broadcast Announcement Form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              {t.broadcastTitle}
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            {t.broadcastDesc}
          </p>

          <form onSubmit={handleBroadcastSubmit} className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {t.labelTitle}
              </label>
              <input
                id="input-broadcast-title"
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder={t.placeholderTitle}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none"
                disabled={isReadOnly}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {t.labelMessage}
              </label>
              <textarea
                id="input-broadcast-message"
                rows={3}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder={t.placeholderMessage}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none resize-none"
                disabled={isReadOnly}
              />
            </div>

            {sentSuccess && (
              <div id="banner-broadcast-success" className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t.successMsg}</span>
              </div>
            )}

            {!isReadOnly && (
              <button
                id="btn-broadcast-submit"
                type="submit"
                className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t.publishBtn}</span>
              </button>
            )}
          </form>
        </div>

        {/* Dispute Resolution Tickets */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600" />
              <h3 className="font-extrabold text-sm text-slate-900">
                {t.disputesTitle}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {disputes.length} {t.cases}
            </span>
          </div>

          <div className="space-y-2.5">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50/60 transition-colors space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-slate-900">{d.subject || d.title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t.parties} <strong>{d.partyA || d.claimantName}</strong> {t.against} <strong>{d.partyB || d.respondentName}</strong>
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      d.status === 'UNDER_INVESTIGATION' || d.status === 'UNDER_REVIEW' || d.status === 'OPEN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {d.status === 'UNDER_INVESTIGATION' || d.status === 'UNDER_REVIEW' || d.status === 'OPEN'
                      ? t.investigation
                      : t.resolved}
                  </span>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg text-slate-600 text-[11px]">
                  {d.reason || d.subject}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{d.createdAt}</span>
                  {!isReadOnly && (d.status === 'UNDER_INVESTIGATION' || d.status === 'UNDER_REVIEW' || d.status === 'OPEN') && (
                    <button
                      id={`btn-resolve-dispute-${d.id}`}
                      type="button"
                      onClick={() => setResolvingTicket(d)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      {t.resolveBtn}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Resolution Modal */}
      {resolvingTicket && (
        <div id="modal-dispute-resolution" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3 shadow-2xl">
            <h4 className="font-extrabold text-sm text-slate-900">
              {t.modalTitle} {resolvingTicket.subject || resolvingTicket.title}
            </h4>
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">{t.modalLabel}</label>
              <textarea
                id="input-resolution-text"
                rows={3}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder={t.modalPlaceholder}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                id="btn-cancel-dispute-resolution"
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                id="btn-confirm-dispute-resolution"
                type="button"
                onClick={handleResolveTicket}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Wrench, 
  Sparkles, 
  ShieldCheck, 
  PhoneCall, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Send,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { TenantMaintenanceItem, TenantSecurityDepositItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantDesktopSidebarWidgetsProps {
  activeMaintenance: TenantMaintenanceItem | null;
  onRequestMaintenance: () => void;
  onViewAllMaintenance: () => void;
  onAskAI: (query: string) => Promise<any>;
  securityDeposit: TenantSecurityDepositItem | null | undefined;
}

export const TenantDesktopSidebarWidgets: React.FC<TenantDesktopSidebarWidgetsProps> = ({
  activeMaintenance,
  onRequestMaintenance,
  onViewAllMaintenance,
  onAskAI,
  securityDeposit,
}) => {
  const { t, direction, language } = useI18n();

  // Local AI Chat state in widget
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; disclaimer?: string }>>([
    {
      sender: 'ai',
      text: language === 'ku' 
        ? 'سڵاو ئەحمەد! دەتوانیت لێرەوە ڕاستەوخۆ پرسیار دەربارەی کرێ، کاتەکانی بێدەنگی و ڕێساکانی باڵەخانە بکەیت.'
        : language === 'ar'
        ? 'مرحباً أحمد! يمكنك السؤال هنا عن الإيجار، ساعات الهدوء، أو قواعد البناية.'
        : 'Hi Ahmed! Ask any quick question about your lease, rent schedule, or building rules.',
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || aiLoading) return;
    const userQuery = promptText;
    setQuery('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setAiLoading(true);

    try {
      const res = await onAskAI(userQuery);
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          disclaimer: res.disclaimer,
        },
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: language === 'ku'
            ? 'کاتەکانی بێدەنگی باڵەخانە لە نێوان ١١:٠٠ی شەو بۆ ٧:٠٠ی بەیانییە. شوێنی وەستانی تایبەت B-14 بۆ یەکەکەت تەرخانکراوە.'
            : 'Building quiet hours are 11:00 PM to 7:00 AM. Underground parking space B-14 is reserved for your unit.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const sampleTicket = activeMaintenance || {
    id: 'mnt-preview',
    referenceNumber: '#MNT-2026-001',
    title: language === 'ku' ? 'لێچوونی بۆڕی ژێر سینکی چێشتخانە' : 'Kitchen Sink Drain Leak',
    category: 'PLUMBING',
    priority: 'NORMAL',
    status: 'SCHEDULED',
    submittedDate: '2026-04-10',
    description: 'Small leak in pipe under basin',
    propertyName: 'Sunset Heights',
    unitNumber: 'Apartment 4B',
    latestUpdate: language === 'ku' ? 'وەستا ڕەوانەکرا — گەیشتن لە کاتژمێر ١١:٣٠ی بەیانی' : 'Technician dispatched — expected 11:30 AM',
  };

  return (
    <aside id="tenant-desktop-sidebar-widgets" className="space-y-6">
      {/* 1. Live Maintenance Dispatch Tracker */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white leading-tight">
                {t('tenant.maintenanceRequests', 'Maintenance Request')}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {t('tenant.liveDispatchStatus', 'Live technician status')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewAllMaintenance}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            {t('tenant.viewAll', 'View All')}
          </button>
        </div>

        {/* Ticket Header & Status */}
        <div className="p-3.5 bg-[#080d19] rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white line-clamp-1">
              {sampleTicket.title}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 shrink-0 ms-2" dir="ltr">
              {sampleTicket.referenceNumber}
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{sampleTicket.latestUpdate}</span>
          </p>
        </div>

        {/* 4-Stage Visual Dispatch Stepper */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span className="text-emerald-400">{t('tenant.stepReported', 'Reported')}</span>
            <span className="text-amber-400 font-extrabold">{t('tenant.stepDispatched', 'Dispatched')}</span>
            <span>{t('tenant.stepOnSite', 'On-Site')}</span>
            <span>{t('tenant.stepResolved', 'Resolved')}</span>
          </div>
          
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
            <div className="bg-emerald-500 h-2 w-1/4" />
            <div className="bg-amber-400 h-2 w-1/4 animate-pulse" />
            <div className="bg-slate-700 h-2 w-2/4" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium" dir="ltr">
            <span>09:00 AM</span>
            <span className="text-amber-400 font-bold">11:30 AM (ETA)</span>
            <span>--:--</span>
            <span>--:--</span>
          </div>
        </div>

        {/* Action strip */}
        <div className="pt-1 flex gap-2">
          <button
            type="button"
            onClick={onRequestMaintenance}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-700 hover:bg-slate-800/60 text-slate-200 text-xs font-bold transition-colors cursor-pointer text-center"
          >
            + {t('tenant.requestMaintenance', 'New Request')}
          </button>
          <a
            href="tel:+9647500000000"
            dir="ltr"
            className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0"
            title="Call Technician Dispatch"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{t('tenant.callDispatch', 'Call')}</span>
          </a>
        </div>
      </div>

      {/* 2. Embedded AI Rental Assistant */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white leading-tight">
                {t('tenant.rentalAssistant', 'Rental Assistant (AI)')}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {t('tenant.instantBylaws', 'Building bylaws & lease copilot')}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-950/60 text-blue-300 border border-blue-800/60">
            GPT-4o
          </span>
        </div>

        {/* Quick Question Chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              label: language === 'ku' ? 'کاتەکانی بێدەنگی' : 'Quiet hours?',
              query: 'What are the building quiet hours?',
            },
            {
              label: language === 'ku' ? 'پارکینگی تایبەت' : 'Parking spot?',
              query: 'Where is my reserved parking spot?',
            },
            {
              label: language === 'ku' ? 'ڕەسمی ڕەسمی هۆم‌هەب' : 'Fee fee policy?',
              query: 'How is the HomeHub rent collection fee handled?',
            },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendPrompt(chip.query)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-amber-400/10 hover:text-amber-400 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat Stream Window */}
        <div className="space-y-2.5 max-h-56 overflow-y-auto p-3 bg-[#080d19] rounded-xl border border-slate-800 text-xs">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-2.5 rounded-xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-amber-500 text-slate-950 font-medium rounded-ee-xs'
                    : 'bg-[#111b2e] text-slate-200 border border-slate-700/60 shadow-2xs rounded-es-xs'
                }`}
              >
                <p>{msg.text}</p>
                {msg.disclaimer && (
                  <p className="text-[9px] text-slate-400 mt-1 pt-1 border-t border-slate-700/50">
                    {msg.disclaimer}
                  </p>
                )}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 italic">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>{t('tenant.consultingLease', 'Consulting lease bylaws...')}</span>
            </div>
          )}
        </div>

        {/* Interactive Query Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(query);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tenant.typeMessagePlaceholder', 'Ask about lease or rules...')}
            className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!query.trim() || aiLoading}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Send query"
          >
            <Send className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </form>
      </div>

      {/* 3. Escrow Deposit Protection Card */}
      <div className="bg-[#0c1322] rounded-2xl border border-emerald-900/60 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <h4 className="text-xs font-black text-emerald-300">
            {t('tenant.escrowDepositProtection', 'Escrow Security Deposit Protection')}
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t(
            'tenant.escrowDepositDesc',
            'Your security deposit is locked in a dedicated escrow account. It cannot be withheld without an authoritative exit inspection report.'
          )}
        </p>
        {securityDeposit ? (() => {
          const reqAmt = Number(securityDeposit.requiredAmount) || 0;
          const recAmt = Number(securityDeposit.recordedAmount) || 0;
          const relAmt = Number(securityDeposit.releasedAmount) || 0;
          const heldAmt = Math.max(0, recAmt - relAmt);
          return (
            <div className="pt-2 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-bold">{t('tenant.depositRequired', 'Required')}:</span>
                <span className="text-sm font-black text-white" dir="ltr">
                  {reqAmt.toLocaleString()} {securityDeposit.currency}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-bold">{t('tenant.depositCollected', 'Collected')}:</span>
                <span className="text-sm font-black text-white" dir="ltr">
                  {recAmt.toLocaleString()} {securityDeposit.currency}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-800 pt-2">
                <span className="text-xs text-emerald-400 font-bold">{t('tenant.depositHeld', 'Held (Escrow)')}:</span>
                <span className="text-sm font-black text-emerald-300" dir="ltr">
                  {heldAmt.toLocaleString()} {securityDeposit.currency}
                </span>
              </div>
              {relAmt > 0 && (
                <div className="flex items-baseline justify-between text-emerald-400">
                  <span className="text-xs font-bold">{t('tenant.depositReleased', 'Released')}:</span>
                  <span className="text-sm font-black" dir="ltr">
                    {relAmt.toLocaleString()} {securityDeposit.currency}
                  </span>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="pt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400 font-bold">{t('tenant.securityDeposit', 'Security Deposit')}:</span>
            <span className="text-sm font-black text-white" dir="ltr">
              0 IQD
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

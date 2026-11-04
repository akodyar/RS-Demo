import React, { useState } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  Server,
  Ban,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminSecurityEvent, AdminAiGovernanceItem } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminSecurityAiModuleProps {
  securityEvents: AdminSecurityEvent[];
  aiGovernanceItems: AdminAiGovernanceItem[];
  currentRole: AdminRoleType;
  onMitigateSecurityEvent: (eventId: string, actionTaken: string) => void;
  onBack: () => void;
}

export const AdminSecurityAiModule: React.FC<AdminSecurityAiModuleProps> = ({
  securityEvents,
  aiGovernanceItems,
  currentRole,
  onMitigateSecurityEvent,
  onBack,
}) => {
  const { direction } = useI18n();
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'ai' | 'health'>('security');

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
              <ShieldAlert className="w-5 h-5 text-emerald-600" />
              <span>ئاسایش، بەڕێوەبردنی ژیری دەستکرد و سیستەم (Security & AI Governance)</span>
            </h2>
            <p className="text-xs text-slate-500">
              چاودێری هەوڵەکانی تێپەڕاندنی هێڵی ئاسایش، ئەنجامەکانی مۆدێلی ژیری دەستکرد، و تەندروستی سێرڤەر
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

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveSubTab('security')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'security'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          ڕووداوە ئەمنیەکان (Security Incidents)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('ai')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'ai'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          چاودێری ژیری دەستکرد (AI Governance)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('health')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'health'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          تەندروستی سێرڤەر (System Health)
        </button>
      </div>

      {/* Content for Security */}
      {activeSubTab === 'security' && (
        <div className="space-y-3">
          {securityEvents.map((evt) => (
            <div
              key={evt.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      evt.severity === 'CRITICAL' || evt.severity === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{evt.eventType || evt.type}</h4>
                    <p className="text-xs text-slate-500 font-mono">
                      IP: {evt.sourceIp || evt.ipAddress} • بەکارهێنەر: {evt.userTarget || evt.actor}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                    evt.status === 'BLOCKED' || evt.resolved
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {evt.status === 'BLOCKED' || evt.resolved ? 'بلۆککراوە' : 'لەژێر لێکۆڵینەوە'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl text-xs flex items-center justify-between">
                <span className="text-slate-600">{evt.description}</span>
                <span className="text-slate-400 font-mono text-[11px]">{evt.timestamp}</span>
              </div>

              {!isReadOnly && evt.status !== 'BLOCKED' && evt.status !== 'MITIGATED' && !evt.resolved && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-500">
                    تێبینی: بلۆککردنی ئەمنیەتی سەر هێڵ (Edge Firewall Blocking) لە ئاستی تۆڕدا پەیوەستە بە Google Cloud Armor / WAF. ئەم ڕێکارە ئاگادارییەکە لەناو سیستەم تۆمار دەکات.
                  </span>
                  <button
                    type="button"
                    onClick={() => onMitigateSecurityEvent(evt.id, 'تۆمارکردنی ڕێکاری ئەمنی لە سیستەم (Internal Mitigation Flag)')}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>تۆمارکردنی چارەسەری ئەمنی (Mitigate)</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content for AI Governance */}
      {activeSubTab === 'ai' && (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-xs text-purple-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-extrabold text-sm">مۆدێلی ژیری دەستکردی HomeHub AI Engine</p>
                <p className="text-purple-700 text-[11px]">
                  پشکنینی بەردەوامی وردی گرێبەستەکان و پێشگیری لە فێڵکردن (Fraud Prevention)
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-200 text-purple-900 font-mono font-bold text-xs">
              ڕێژەی ڕاستی: 98.4%
            </span>
          </div>

          <div className="space-y-3">
            {aiGovernanceItems.map((ai) => (
              <div
                key={ai.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">{ai.featureName || ai.feature}</h4>
                  <span className="font-mono text-purple-700 font-bold">
                    {ai.autonomyLevel || 'RECOMMEND'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                  <p className="text-slate-500 font-mono text-[11px] dir-ltr text-right">
                    داواکارییە جێبەجێکراوەکان: {ai.recommendationsCount || 100} پێشنیار • دەستکاری مرۆڤ: {ai.humanOverrideCount || 0}
                  </p>
                  <p className="text-slate-800 font-medium">دۆخی پارێزگاری: {ai.status}</p>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>دوا هەڵسەنگاندن: {ai.lastEvaluated || ai.timestamp}</span>
                  <span className="text-emerald-600 font-bold">
                    پەسەندکراوە بە شێوازی یاسایی
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content for Server Health */}
      {activeSubTab === 'health' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <span className="text-slate-500 font-bold">بەکارهێنانی سێرڤەر (CPU):</span>
            <p className="text-2xl font-black text-slate-900 font-mono">14.2%</p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-full w-[14%]" />
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">لە ئاستی نایابدایە</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <span className="text-slate-500 font-bold">داتابەیس و وەڵامدانەوە (DB Latency):</span>
            <p className="text-2xl font-black text-slate-900 font-mono">18 ms</p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full w-[18%]" />
            </div>
            <span className="text-[10px] text-blue-600 font-bold">خێرایی بەرز (Low Latency)</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <span className="text-slate-500 font-bold">پاشەکەوتی کەش (Cache Hit Rate):</span>
            <p className="text-2xl font-black text-purple-600 font-mono">94.8%</p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-purple-500 h-full w-[95%]" />
            </div>
            <span className="text-[10px] text-purple-600 font-bold">ئۆپتیمایزکراوی ڕاستەوخۆ</span>
          </div>
        </div>
      )}
    </div>
  );
};

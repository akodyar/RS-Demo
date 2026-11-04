import React, { useState } from 'react';
import { Building, Key, Briefcase, Wrench, ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { HomeHubLogo } from './HomeHubLogo';
import { LanguageSelector } from './LanguageSelector';
import { useI18n } from '../../i18n/I18nProvider';
import { EligibleWorkspace } from '../AuthProvider';

interface ScreenSelectWorkspaceProps {
  workspaces: EligibleWorkspace[];
  onSelectWorkspace: (workspace: EligibleWorkspace) => Promise<void> | void;
  onLogout?: () => void;
  userName?: string;
}

export const ScreenSelectWorkspace: React.FC<ScreenSelectWorkspaceProps> = ({
  workspaces,
  onSelectWorkspace,
  onLogout,
  userName,
}) => {
  const { t, direction } = useI18n();
  const [selectedId, setSelectedId] = useState<string>(workspaces[0]?.workspaceId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWorkspaceIcon = (role: string, isCompany?: boolean) => {
    if (isCompany) return <Briefcase className="w-6 h-6 text-blue-600" />;
    switch (role.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return <Building className="w-6 h-6 text-emerald-600" />;
      case 'TENANT':
        return <Key className="w-6 h-6 text-orange-600" />;
      case 'AGENT':
      case 'AGENT_BROKER':
        return <ShieldCheck className="w-6 h-6 text-rose-600" />;
      case 'VENDOR':
        return <Wrench className="w-6 h-6 text-amber-600" />;
      default:
        return <Building className="w-6 h-6 text-slate-600" />;
    }
  };

  const getWorkspaceBg = (role: string, isCompany?: boolean) => {
    if (isCompany) return 'bg-blue-50 border-blue-200';
    switch (role.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return 'bg-emerald-50 border-emerald-200';
      case 'TENANT':
        return 'bg-orange-50 border-orange-200';
      case 'AGENT':
      case 'AGENT_BROKER':
        return 'bg-rose-50 border-rose-200';
      case 'VENDOR':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const handleConfirm = async () => {
    const target = workspaces.find((w) => w.workspaceId === selectedId);
    if (!target) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSelectWorkspace(target);
    } catch (err: any) {
      setError(err.message || 'Failed to switch workspace');
      setSubmitting(false);
    }
  };

  return (
    <div
      dir={direction}
      className={`min-h-screen flex flex-col justify-between bg-[#070b14] text-white w-full ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
    >
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between" dir={direction}>
        <HomeHubLogo size="md" light={true} />
        <LanguageSelector variant="transparent" />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col justify-center">
        <div className="bg-[#0c1322] rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-10 space-y-8 text-white">
          {/* Header Title */}
          <div className="space-y-3 text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
              <span id="select-workspace-badge">{t('workspace.select.badge', 'دیاریکردنی شوێنی کار')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight" id="select-workspace-title">
              {t('workspace.select.title', 'تکایە شوێنی کارەکەت هەڵبژێرە')}
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              {userName ? `${userName}، ` : ''}
              {t(
                'workspace.select.subtitle',
                'ئەم هەژمارە زیاتر لە یەک ڕۆڵی فەرمی هەیە. تکایە دیاریبکە دەتەوێت بە کام شێواز دەست پێ بکەیت.'
              )}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Workspaces Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Workspaces">
            {workspaces.map((ws) => {
              const isSelected = selectedId === ws.workspaceId;
              const isPending = ws.status === 'PENDING_VERIFICATION';

              return (
                <button
                  type="button"
                  key={ws.workspaceId}
                  id={`workspace-card-${ws.workspaceId}`}
                  data-testid={`workspace-option-${ws.role.toLowerCase()}`}
                  onClick={() => setSelectedId(ws.workspaceId)}
                  className={`relative flex flex-col items-start p-5 rounded-2xl border-2 text-start transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 text-white shadow-lg shadow-amber-950/20'
                      : 'border-slate-800 hover:border-slate-700 bg-[#080d19] text-white hover:bg-[#111b2e]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl border border-slate-800 bg-[#111b2e]">
                      {getWorkspaceIcon(ws.role, ws.isCompany)}
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700" />
                    )}
                  </div>

                  <h3 className="font-bold text-base text-white mb-1">
                    {t(ws.titleKey, ws.title)}
                  </h3>

                  <div className="flex items-center gap-2 mt-2">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        {t('workspace.status.pending', 'لە چاوەڕوانی پەسەندکردن')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('workspace.status.active', 'چالاک')}
                      </span>
                    )}
                    {ws.isCompany && (
                      <span className="text-xs text-slate-400 font-medium">
                        {t('workspace.badge.company', 'کۆمپانیا')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            {onLogout ? (
              <button
                type="button"
                id="select-workspace-logout-btn"
                onClick={onLogout}
                className="text-sm font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {t('workspace.action.signout', 'چوونەدەرەوە و گۆڕینی هەژمار')}
              </button>
            ) : <div />}

            <button
              type="button"
              id="select-workspace-submit-btn"
              disabled={!selectedId || submitting}
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-8 py-3 rounded-full font-black text-sm text-slate-950 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                submitting
                  ? 'bg-amber-400/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.99] shadow-amber-950/40'
              }`}
            >
              <span>{submitting ? t('common.loading', 'کەمێک چاوەڕێبە...') : t('workspace.action.enter', 'چوونە ناو شوێنی کار')}</span>
              {direction === 'rtl' ? <ArrowLeft className="w-4 h-4 stroke-[3]" /> : <ArrowRight className="w-4 h-4 stroke-[3]" />}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        © 2026 HomeHub Technologies. پلاتفۆرمی مۆدێرنی خانووبەرە
      </footer>
    </div>
  );
};

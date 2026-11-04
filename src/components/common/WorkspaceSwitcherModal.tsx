import React, { useEffect, useState, useRef } from 'react';
import { 
  Users, 
  X, 
  CheckCircle2, 
  Clock, 
  Building, 
  Key, 
  ShieldCheck, 
  Wrench, 
  Briefcase, 
  Building2, 
  LogOut, 
  Loader2, 
  AlertCircle,
  PlusCircle,
  ArrowLeft,
  UserPlus
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth, EligibleWorkspace } from '../AuthProvider';

export interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces?: EligibleWorkspace[];
  activeWorkspace?: EligibleWorkspace | null;
  onSelectWorkspace: (workspace: EligibleWorkspace) => Promise<void> | void;
  onLogout: () => void;
  isSwitching?: boolean;
  error?: string | null;
  onClearError?: () => void;
  stayButtonLabel?: string;
  modalTitle?: string;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  isOpen,
  onClose,
  workspaces: explicitWorkspaces,
  activeWorkspace: explicitActiveWorkspace,
  onSelectWorkspace,
  onLogout,
  isSwitching = false,
  error: externalError,
  onClearError,
  stayButtonLabel,
  modalTitle,
}) => {
  const { t, direction, language } = useI18n();
  const auth = useAuth();

  const workspaces = explicitWorkspaces !== undefined ? explicitWorkspaces : (auth?.eligibleWorkspaces || []);
  const activeWorkspace = explicitActiveWorkspace !== undefined ? explicitActiveWorkspace : (auth?.activeWorkspace || null);

  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Multi-Role Enrollment states
  const [viewMode, setViewMode] = useState<'LIST' | 'ENROLL'>('LIST');
  const [selectedRoleToEnroll, setSelectedRoleToEnroll] = useState<'PROPERTY_OWNER' | 'TENANT' | 'VENDOR' | 'AGENT_BROKER' | null>(null);
  const [ownerEntityType, setOwnerEntityType] = useState<'INDIVIDUAL' | 'COMPANY'>('INDIVIDUAL');
  const [ownerCompanyName, setOwnerCompanyName] = useState<string>('');
  const [agentEntityType, setAgentEntityType] = useState<'INDIVIDUAL' | 'COMPANY'>('INDIVIDUAL');
  const [agentCompanyName, setAgentCompanyName] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  const displayError = externalError || internalError;

  const isMountedRef = useRef<boolean>(true);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSwitching && !isEnrolling) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSwitching, isEnrolling, onClose]);

  // Reset internal errors and modes when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInternalError(null);
      setSwitchingWorkspaceId(null);
      setViewMode('LIST');
      setSelectedRoleToEnroll(null);
      setOwnerEntityType('INDIVIDUAL');
      setOwnerCompanyName('');
      setIsEnrolling(false);
      setEnrollError(null);
      setEnrollSuccess(null);
    } else {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine which roles are already held
  const userRoles = auth?.user?.roles || [];
  const activeRoles = new Set(
    [
      ...userRoles.map((r) => r.toUpperCase()),
      ...workspaces.map((w) => w.role.toUpperCase()),
    ].map((r) => {
      if (r === 'OWNER') return 'PROPERTY_OWNER';
      if (r === 'AGENT') return 'AGENT_BROKER';
      return r;
    })
  );

  const hasOwnerRole = activeRoles.has('PROPERTY_OWNER');
  const hasTenantRole = activeRoles.has('TENANT');
  const hasVendorRole = activeRoles.has('VENDOR');
  const hasAgentRole = activeRoles.has('AGENT_BROKER') || activeRoles.has('AGENT');

  const allRolesEnrolled = hasOwnerRole && hasTenantRole && hasVendorRole && hasAgentRole;

  const getWorkspaceIcon = (role: string, isCompany?: boolean) => {
    if (isCompany) return <Briefcase className="w-5 h-5 text-blue-600" />;
    switch (role?.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return <Building className="w-5 h-5 text-emerald-600" />;
      case 'TENANT':
        return <Key className="w-5 h-5 text-orange-600" />;
      case 'AGENT':
      case 'AGENT_BROKER':
        return <ShieldCheck className="w-5 h-5 text-rose-600" />;
      case 'VENDOR':
        return <Wrench className="w-5 h-5 text-amber-600" />;
      default:
        return <Building2 className="w-5 h-5 text-slate-600" />;
    }
  };

  const getWorkspaceIconBg = (role: string, isCompany?: boolean) => {
    if (isCompany) return 'bg-blue-100 text-blue-700 border-blue-200';
    switch (role?.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'TENANT':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'AGENT':
      case 'AGENT_BROKER':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'VENDOR':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleWorkspaceClick = async (ws: EligibleWorkspace) => {
    // If already active or currently switching, do nothing
    if (ws.workspaceId === activeWorkspace?.workspaceId || isSwitching || isEnrolling) {
      return;
    }
    setInternalError(null);
    if (onClearError) onClearError();
    setSwitchingWorkspaceId(ws.workspaceId);

    try {
      await onSelectWorkspace(ws);
    } catch (err: any) {
      setInternalError(err.message || t('workspace.switch_failed', 'Failed to switch workspace.'));
    } finally {
      setSwitchingWorkspaceId(null);
    }
  };

  const handleConfirmEnroll = async () => {
    if (!selectedRoleToEnroll || isEnrolling) return;
    setEnrollError(null);
    setEnrollSuccess(null);
    setIsEnrolling(true);

    try {
      if (!auth?.enrollRole) {
        throw new Error('Enrollment service is not available in current session.');
      }

      const payload: { role: string; entityType?: string; companyName?: string } = {
        role: selectedRoleToEnroll,
      };

      if (selectedRoleToEnroll === 'PROPERTY_OWNER') {
        payload.entityType = ownerEntityType;
        if (ownerEntityType === 'COMPANY' && ownerCompanyName.trim()) {
          payload.companyName = ownerCompanyName.trim();
        }
      } else if (selectedRoleToEnroll === 'AGENT_BROKER') {
        payload.entityType = agentEntityType;
        if (agentEntityType === 'COMPANY' && agentCompanyName.trim()) {
          payload.companyName = agentCompanyName.trim();
        }
      }

      const res = await auth.enrollRole(payload);

      setEnrollSuccess(t('workspace.enroll_success', 'ڕۆڵ بە سەرکەوتوویی چالاککرا! دەستپێکردنی گواستنەوە...'));

      // 1500ms provides clean visual confirmation of success before modal transition
      await new Promise<void>((resolve) => {
        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null;
          resolve();
        }, 1500);
      });

      if (!isMountedRef.current) return;

      // Authoritative workspace resolution from returned workspaces
      const eligible: EligibleWorkspace[] = res?.eligibleWorkspaces || auth?.eligibleWorkspaces || [];
      let targetWs: EligibleWorkspace | undefined;

      if (selectedRoleToEnroll === 'PROPERTY_OWNER') {
        if (ownerEntityType === 'COMPANY') {
          targetWs = eligible.find((w) => w.isCompany && (ownerCompanyName.trim() ? w.organizationName === ownerCompanyName.trim() : true)) ||
                     eligible.find((w) => w.isCompany);
        } else {
          targetWs = eligible.find((w) => w.workspaceId === 'owner_personal' || w.role === 'PROPERTY_OWNER');
        }
      } else if (selectedRoleToEnroll === 'TENANT') {
        targetWs = eligible.find((w) => w.role === 'TENANT' || w.workspaceId === 'tenant');
      } else if (selectedRoleToEnroll === 'VENDOR') {
        targetWs = eligible.find((w) => w.role === 'VENDOR' || w.workspaceId === 'vendor');
      } else if (selectedRoleToEnroll === 'AGENT_BROKER') {
        if (agentEntityType === 'COMPANY') {
          targetWs = eligible.find((w) => w.isCompany && w.organizationName === agentCompanyName.trim()) ||
                     eligible.find((w) => w.isCompany) ||
                     eligible.find((w) => w.role === 'AGENT_BROKER' || w.workspaceId === 'agent');
        } else {
          targetWs = eligible.find((w) => w.role === 'AGENT_BROKER' || w.workspaceId === 'agent');
        }
      }

      if (targetWs) {
        await onSelectWorkspace(targetWs);
      } else {
        // Fall back to workspace list view with updated options
        if (isMountedRef.current) {
          setViewMode('LIST');
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setEnrollError(err.message || t('workspace.enroll_failed', 'Failed to activate role.'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsEnrolling(false);
      }
    }
  };

  const getStayButtonText = () => {
    if (stayButtonLabel) return stayButtonLabel;
    const role = activeWorkspace?.role?.toUpperCase();
    if (role === 'AGENT' || role === 'AGENT_BROKER') {
      return language === 'ku' ? 'مانەوە لە پۆرتالی ئەگێنت' : language === 'ar' ? 'البقاء في بوابة الوكيل' : 'Stay on Agent Portal';
    }
    if (role === 'VENDOR') {
      return language === 'ku' ? 'مانەوە لە پۆرتالی وەستا' : language === 'ar' ? 'البقاء في بوابة المزود' : 'Stay on Vendor Portal';
    }
    if (role === 'PROPERTY_OWNER' || role === 'OWNER') {
      return language === 'ku' ? 'مانەوە لە پۆرتالی خاوەن موڵک' : language === 'ar' ? 'البقاء في بوابة المالك' : 'Stay on Owner Portal';
    }
    if (role === 'COMPANY' || role === 'COMPANY_ADMIN' || role === 'COMPANY_MEMBER') {
      return language === 'ku' ? 'مانەوە لە پۆرتالی کۆمپانیا' : language === 'ar' ? 'البقاء في بوابة الشركة' : 'Stay on Company Portal';
    }
    return t('action.stay_here', 'Stay on Tenant Portal');
  };

  const hasMultipleWorkspaces = workspaces && workspaces.length > 1;

  const roleEnrollOptions = [
    {
      key: 'PROPERTY_OWNER' as const,
      id: 'role-option-property-owner',
      title: t('workspace.role_owner', 'خاوەن موڵک'),
      description: t('workspace.role_owner_desc', 'موڵکەکانت بۆ کرێ دابنێ، گرێبەستەکان بەڕێوەببە، و چاودێری پارەدانە داراییەکان بکە.'),
      icon: Building,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      isEnrolled: hasOwnerRole,
      hasSubOptions: true,
    },
    {
      key: 'TENANT' as const,
      id: 'role-option-tenant',
      title: t('workspace.role_tenant', 'کرێنشین'),
      description: t('workspace.role_tenant_desc', 'کرێ بدە، داواکاریی چاککردنەوە پێشکەش بکە، و بەڵگەنامەکانی کرێداری بەڕێوەببە.'),
      icon: Key,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100 text-orange-700 border-orange-200',
      isEnrolled: hasTenantRole,
      hasSubOptions: false,
    },
    {
      key: 'VENDOR' as const,
      id: 'role-option-vendor',
      title: t('workspace.role_vendor', 'وەستا / دابینکەری خزمەتگوزاری'),
      description: t('workspace.role_vendor_desc', 'فەرمانی چاککردنەوە وەربگرە، نرخی چاککردنەوە بنێرە، و کارە تەواوکراوەکان تۆمار بکە.'),
      nextStepNote: t('workspace.vendor_next_step', 'پێویستی بە پشتڕاستکردنەوەی کارامەییە بۆ وەرگرتنی فەرمانی چاککردنەوە.'),
      icon: Wrench,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100 text-amber-700 border-amber-200',
      isEnrolled: hasVendorRole,
      hasSubOptions: false,
    },
    {
      key: 'AGENT_BROKER' as const,
      id: 'role-option-agent',
      title: t('workspace.role_agent', 'ئەگێنت / دەڵاڵ'),
      description: t('workspace.role_agent_desc', 'ڕیکلامی کرێ بەڕێوەببە، پێشاندانی موڵک ڕێکبخە، و هاوکاریی خاوەن موڵکەکان بکە.'),
      nextStepNote: t('workspace.agent_next_step', 'پشتڕاستکردنەوەی دەڵاڵی جێبەجێ دەبێت پێش ئەنجامدانی کار لەسەر موڵکەکان.'),
      icon: ShieldCheck,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-100 text-rose-700 border-rose-200',
      isEnrolled: hasAgentRole,
      hasSubOptions: true,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSwitching && !isEnrolling) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={viewMode === 'LIST' ? 'tenant-switcher-modal-title' : 'role-enroll-modal-title'}
    >
      <div 
        className={`bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 cursor-default ${
          direction === 'rtl' ? 'font-arabic' : 'font-sans'
        }`}
        dir={direction}
        onClick={(e) => e.stopPropagation()}
      >
        {viewMode === 'LIST' ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 mb-1">
                  <Users className="w-3 h-3 text-blue-600" />
                  <span>{t('workspace.select.badge', 'شوێنی کارەکان')}</span>
                </div>
                <h3 id="tenant-switcher-modal-title" className="text-lg font-black text-slate-900">
                  {modalTitle || t('workspace.select.title', 'شوێنی کارەکەت هەڵبژێرە')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hasMultipleWorkspaces
                    ? t('workspace.select.subtitle', 'ئەم هەژمارە زیاتر لە یەک ڕۆڵی فەرمی هەیە. تکایە دیاریبکە دەتەوێت بە کام شێواز دەست پێ بکەیت.')
                    : t('workspace.single_workspace_hint', 
                        language === 'ku'
                          ? 'تەنها یەک شوێنی کاری چالاکت هەیە. دەتوانیت لە ڕێگەی دوگمەی خوارەوە ڕۆڵێکی نوێ زیاد بکەیت.'
                          : language === 'ar'
                          ? 'لديك مساحة عمل واحدة نشطة حالياً. يمكنك تفعيل دور إضافي أدناه للوصول لمجالات أخرى.'
                          : 'You currently have one active workspace. You can activate an additional role below.')}
                </p>
              </div>
              <button
                id="btn-close-tenant-workspace-modal"
                type="button"
                disabled={isSwitching}
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Alert */}
            {displayError && (
              <div 
                id="tenant-workspace-switch-error"
                className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold">{displayError}</span>
                </div>
                {(onClearError || internalError) && (
                  <button 
                    type="button"
                    onClick={() => {
                      setInternalError(null);
                      if (onClearError) onClearError();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Notice if only 1 workspace exists */}
            {!hasMultipleWorkspaces && (
              <div 
                id="tenant-no-alternative-workspaces-notice"
                className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 text-xs flex items-center gap-2.5"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="font-medium leading-relaxed">
                  {t('workspace.single_workspace_hint', 
                    language === 'ku' 
                      ? 'تەنها یەک شوێنی کاری چالاکت هەیە. دەتوانیت لە ڕێگەی دوگمەی خوارەوە ڕۆڵێکی نوێ زیاد بکەیت.' 
                      : language === 'ar' 
                      ? 'لديك مساحة عمل واحدة نشطة حالياً. يمكنك تفعيل دور إضافي أدناه للوصول لمجالات أخرى.' 
                      : 'You currently have one active workspace. You can activate an additional role below.')}
                </p>
              </div>
            )}

            {/* Workspaces List */}
            <div 
              id="tenant-workspaces-list"
              className="space-y-2.5 max-h-[300px] overflow-y-auto pe-1 scrollbar-thin"
              role="list"
              aria-label={t('workspace.select.badge', 'Workspaces')}
            >
              {workspaces.map((ws) => {
                const isActive = ws.workspaceId === activeWorkspace?.workspaceId || 
                                 (ws.role === activeWorkspace?.role && !ws.organizationId && !activeWorkspace?.organizationId);
                const isTargetSwitching = isSwitching && switchingWorkspaceId === ws.workspaceId;
                const isPending = ws.status === 'PENDING_VERIFICATION';

                return (
                  <button
                    key={ws.workspaceId}
                    id={`workspace-card-${ws.workspaceId}`}
                    type="button"
                    disabled={isActive || isSwitching}
                    onClick={() => handleWorkspaceClick(ws)}
                    className={`w-full p-3.5 rounded-2xl border text-start flex items-center justify-between gap-3 transition-all ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50/70 shadow-2xs ring-1 ring-blue-500/80 cursor-default' 
                        : isSwitching
                        ? 'border-slate-200/80 bg-slate-50/60 opacity-60 cursor-not-allowed'
                        : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-blue-300 cursor-pointer'
                    }`}
                    role="listitem"
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${getWorkspaceIconBg(ws.role, ws.isCompany)}`}>
                        {getWorkspaceIcon(ws.role, ws.isCompany)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {t(ws.titleKey, ws.title || ws.label || ws.role)}
                          </span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{t('workspace.status.active', 'چالاک')}</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{t('workspace.status.pending', 'لە چاوەڕوانی')}</span>
                            </span>
                          )}
                        </div>
                        {ws.organizationName ? (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            <span className="font-semibold text-slate-600 me-1">
                              {t('workspace.badge.company', 'کۆمپانیا')}:
                            </span>
                            {/* BiDi isolation for organization names */}
                            <bdi className="font-medium text-slate-700">{ws.organizationName}</bdi>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5" dir="ltr">
                            {ws.workspaceId}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      {isTargetSwitching ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{t('common.loading', 'گۆڕین...')}</span>
                        </div>
                      ) : isActive ? (
                        <span 
                          id="tenant-switcher-active-badge"
                          className="text-[10px] font-bold text-blue-700 px-2.5 py-1 rounded-xl bg-blue-100/60 border border-blue-200"
                        >
                          {language === 'ku' ? 'شوێنی ئێستا' : language === 'ar' ? 'المساحة الحالية' : 'Current Workspace'}
                        </span>
                      ) : (
                        <span 
                          id={`btn-select-workspace-${ws.workspaceId}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-xl hover:bg-blue-50 transition-colors"
                        >
                          {t('workspace.action.enter', 'هەڵبژاردن')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Multi-Role Enrollment Trigger Button */}
            <div className="pt-1">
              {!allRolesEnrolled ? (
                <button
                  id="btn-activate-another-role"
                  type="button"
                  disabled={isSwitching || isEnrolling}
                  onClick={() => {
                    setInternalError(null);
                    setEnrollError(null);
                    setEnrollSuccess(null);
                    setSelectedRoleToEnroll(null);
                    setOwnerEntityType('INDIVIDUAL');
                    setOwnerCompanyName('');
                    setAgentEntityType('INDIVIDUAL');
                    setAgentCompanyName('');
                    setViewMode('ENROLL');
                  }}
                  className="w-full p-3 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/90 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group shadow-2xs"
                >
                  <PlusCircle className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span>{t('workspace.enroll_button', '+ زیادکردنی ڕۆڵێکی نوێ')}</span>
                </button>
              ) : (
                <div 
                  id="all-roles-enrolled-notice"
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] text-center"
                >
                  {t('workspace.all_roles_enrolled', 'You have already activated all available platform roles.')}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                id="tenant-switcher-logout-btn"
                type="button"
                disabled={isSwitching}
                onClick={onLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>{t('workspace.action.signout', 'Sign Out')}</span>
              </button>

              <button
                id="tenant-switcher-close-btn"
                type="button"
                disabled={isSwitching}
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {getStayButtonText()}
              </button>
            </div>
          </>
        ) : (
          /* =============================================================== */
          /* ENROLL NEW ROLE VIEW MODE                                       */
          /* =============================================================== */
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <button
                  id="btn-back-to-workspaces"
                  type="button"
                  disabled={isEnrolling}
                  onClick={() => {
                    setViewMode('LIST');
                    setEnrollError(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors disabled:opacity-40"
                  aria-label={t('workspace.back_to_workspaces', 'Back to Workspaces')}
                >
                  <ArrowLeft className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                </button>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 mb-0.5">
                    <UserPlus className="w-3 h-3 text-blue-600" />
                    <span>{t('workspace.enroll_badge', 'ڕۆڵی نوێ')}</span>
                  </div>
                  <h3 id="role-enroll-modal-title" className="text-lg font-black text-slate-900">
                    {t('workspace.enroll_title', 'چالاککردنی ڕۆڵێکی نوێ')}
                  </h3>
                </div>
              </div>
              <button
                id="btn-close-enroll-modal"
                type="button"
                disabled={isEnrolling}
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors disabled:opacity-40"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {t('workspace.enroll_subtitle', 'تواناکانی هەژماری هۆم‌هەب فراوان بکە لەڕێگەی کاراکردنی ڕۆڵێکی زیادە.')}
            </p>

            {/* Error Alert */}
            {enrollError && (
              <div 
                id="enroll-role-error"
                className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold">{enrollError}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setEnrollError(null)} 
                  className="text-red-500 hover:text-red-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Success Alert */}
            {enrollSuccess && (
              <div 
                id="enroll-role-success"
                className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 shadow-2xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{enrollSuccess}</span>
              </div>
            )}

            {/* Canonical Role Options */}
            <div 
              id="role-enroll-options-list"
              className="space-y-2.5 max-h-[340px] overflow-y-auto pe-1 scrollbar-thin"
              role="radiogroup"
              aria-label={t('workspace.enroll_title', 'Activate New Role')}
            >
              {roleEnrollOptions.map((opt) => {
                const isSelected = selectedRoleToEnroll === opt.key;
                const IconComponent = opt.icon;

                return (
                  <div 
                    key={opt.key}
                    className={`rounded-2xl border transition-all ${
                      opt.isEnrolled
                        ? 'border-slate-200 bg-slate-50/70 opacity-60'
                        : isSelected
                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/80 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60 cursor-pointer'
                    }`}
                  >
                    <button
                      id={opt.id}
                      type="button"
                      disabled={opt.isEnrolled || isEnrolling}
                      onClick={() => setSelectedRoleToEnroll(opt.key)}
                      className="w-full p-3.5 text-start flex items-start gap-3 cursor-pointer disabled:cursor-not-allowed"
                      role="radio"
                      aria-checked={isSelected}
                    >
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${opt.iconBg}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900">
                            {opt.title}
                          </span>
                          {opt.isEnrolled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold">
                              <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" />
                              <span>{t('workspace.already_enrolled', 'لەم هەژمارەدا چالاکە')}</span>
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{t('common.selected', 'دیاریکراو')}</span>
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                        {opt.nextStepNote && !opt.isEnrolled && (
                          <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-1.5 mt-2 border border-amber-200/60 font-medium">
                            ℹ️ {opt.nextStepNote}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Sub-form for Property Owner Entity Type */}
                    {isSelected && opt.key === 'PROPERTY_OWNER' && !opt.isEnrolled && (
                      <div className="px-4 pb-3.5 pt-1 border-t border-blue-100 bg-blue-50/30 rounded-b-2xl space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-700">
                          {t('workspace.entity_type', 'جۆری هەژمار')}
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              id="enroll-owner-type-individual"
                              type="radio"
                              name="ownerEntityType"
                              value="INDIVIDUAL"
                              checked={ownerEntityType === 'INDIVIDUAL'}
                              onChange={() => setOwnerEntityType('INDIVIDUAL')}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>{t('workspace.entity_individual', 'خاوەن موڵکی سەربەخۆ')}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              id="enroll-owner-type-company"
                              type="radio"
                              name="ownerEntityType"
                              value="COMPANY"
                              checked={ownerEntityType === 'COMPANY'}
                              onChange={() => setOwnerEntityType('COMPANY')}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>{t('workspace.entity_company', 'کۆمپانیای خانووبەرە')}</span>
                          </label>
                        </div>

                        {ownerEntityType === 'COMPANY' && (
                          <div className="pt-1">
                            <label htmlFor="enroll-company-name-input" className="block text-[10px] font-bold text-slate-600 mb-1">
                              {t('workspace.company_name', 'ناوی کۆمپانیا')}
                            </label>
                            <input
                              id="enroll-company-name-input"
                              type="text"
                              value={ownerCompanyName}
                              onChange={(e) => setOwnerCompanyName(e.target.value)}
                              placeholder={t('workspace.company_name_placeholder', 'بۆ نموونە: کۆمپانیای ئەربیل هۆرایزن')}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-form for Agent Entity Type */}
                    {isSelected && opt.key === 'AGENT_BROKER' && !opt.isEnrolled && (
                      <div className="px-4 pb-3.5 pt-1 border-t border-rose-100 bg-rose-50/30 rounded-b-2xl space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-700">
                          {t('workspace.entity_type', 'جۆری هەژمار')}
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              id="enroll-agent-type-individual"
                              data-testid="enroll-agent-type-individual"
                              type="radio"
                              name="agentEntityType"
                              value="INDIVIDUAL"
                              checked={agentEntityType === 'INDIVIDUAL'}
                              onChange={() => setAgentEntityType('INDIVIDUAL')}
                              className="text-rose-600 focus:ring-rose-500"
                            />
                            <span>{t('workspace.agent_individual', 'ئەگێنتی سەربەخۆ')}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              id="enroll-agent-type-company"
                              data-testid="enroll-agent-type-company"
                              type="radio"
                              name="agentEntityType"
                              value="COMPANY"
                              checked={agentEntityType === 'COMPANY'}
                              onChange={() => setAgentEntityType('COMPANY')}
                              className="text-rose-600 focus:ring-rose-500"
                            />
                            <span>{t('workspace.agent_company', 'کۆمپانیای دەڵاڵی / ئاژانس')}</span>
                          </label>
                        </div>

                        {agentEntityType === 'COMPANY' && (
                          <div className="pt-1">
                            <label htmlFor="enroll-agent-company-name-input" className="block text-[10px] font-bold text-slate-600 mb-1">
                              {t('workspace.company_name', 'ناوی کۆمپانیا')}
                            </label>
                            <input
                              id="enroll-agent-company-name-input"
                              data-testid="enroll-agent-company-name-input"
                              type="text"
                              value={agentCompanyName}
                              onChange={(e) => setAgentCompanyName(e.target.value)}
                              placeholder={t('workspace.agent_company_name_placeholder', 'بۆ نموونە: ئاژانسی بەغداد بۆ خانووبەرە')}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                id="btn-cancel-enroll"
                type="button"
                disabled={isEnrolling}
                onClick={() => {
                  setViewMode('LIST');
                  setEnrollError(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
              >
                {t('workspace.cancel', 'پاشگەزبوونەوە')}
              </button>

              <button
                id="btn-confirm-enroll"
                type="button"
                disabled={
                  !selectedRoleToEnroll || 
                  isEnrolling || 
                  (selectedRoleToEnroll === 'PROPERTY_OWNER' && ownerEntityType === 'COMPANY' && !ownerCompanyName.trim()) ||
                  (selectedRoleToEnroll === 'AGENT_BROKER' && agentEntityType === 'COMPANY' && !agentCompanyName.trim())
                }
                onClick={handleConfirmEnroll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEnrolling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('workspace.enrolling', 'چالاککردنی ڕۆڵ...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('workspace.confirm_enroll', 'پشتڕاستکردنەوە و چالاککردن')}</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

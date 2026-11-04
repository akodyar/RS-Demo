import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Building2, CheckCircle2, ChevronRight, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CompanyProfile, CompanyVerificationStatus } from '../../types/company.js';

interface CompanyProfileCardProps {
  company?: CompanyProfile | null;
  managedCount?: number;
  tenantsCount?: number;
  teamCount?: number;
  onViewProfile: () => void;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  company,
  managedCount = 0,
  tenantsCount = 0,
  teamCount = 0,
  onViewProfile,
}) => {
  const { t, direction } = useI18n();

  const companyName = company?.name || t('company.unnamed_company', 'HomeHub Real Estate Agency');
  const subtitle = t('company.trusted_management', 'Property & Portfolio Management');
  const status: CompanyVerificationStatus = company?.status || 'PENDING_VERIFICATION';
  const isVerified = status === 'VERIFIED' && company?.verified === true;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 shadow-xl border border-slate-800">
      {/* Subtle decorative background gradient circles */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-5">
        {/* Top Row: Icon, Titles, and Verification Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {companyName}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="flex-shrink-0">
            {isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('status.verified', 'Verified')}</span>
              </span>
            ) : status === 'PENDING_VERIFICATION' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('status.pending_verification', 'Pending Verification')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{status}</span>
              </span>
            )}
          </div>
        </div>

        {/* Stats Row + View Profile Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-700/60">
          {/* 3 Stats Columns */}
          <div className="grid grid-cols-3 gap-2 sm:gap-6 divide-x divide-slate-700/60 rtl:divide-x-reverse">
            <div className="px-1 text-center sm:text-left rtl:sm:text-right">
              <span className="block text-xl sm:text-2xl font-black text-white leading-none">
                {managedCount}
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-400 mt-1 block">
                {t('company.managed', 'Managed')}
              </span>
            </div>

            <div className="px-2 sm:px-4 text-center sm:text-left rtl:sm:text-right">
              <span className="block text-xl sm:text-2xl font-black text-white leading-none">
                {tenantsCount}
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-400 mt-1 block">
                {t('company.stat.tenants', 'Tenants')}
              </span>
            </div>

            <div className="px-2 sm:px-4 text-center sm:text-left rtl:sm:text-right">
              <span className="block text-xl sm:text-2xl font-black text-white leading-none">
                {teamCount}
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-400 mt-1 block">
                {t('company.stat.team', 'Team Members')}
              </span>
            </div>
          </div>

          {/* "View Profile ->" Button */}
          <button
            onClick={onViewProfile}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer min-h-[44px] flex-shrink-0"
          >
            <span>{t('company.view_profile', 'View Profile')}</span>
            <ChevronRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

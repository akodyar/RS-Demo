import React from 'react';
import { Link } from 'react-router-dom';
import {
  Percent,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  Building2,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
  PlusCircle,
  FileCheck,
  MessageSquare,
  Briefcase,
  HelpCircle,
  Shield
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export const RentManagementPage: React.FC = () => {
  const { t, direction } = useI18n();

  const operationalSteps = [
    {
      num: 1,
      icon: Calendar,
      title: t('rentManagement.step1.title', '1. Monthly Rent Schedules & Due Notices'),
      desc: t(
        'rentManagement.step1.desc',
        'Rental schedules are generated directly from active lease terms. Digital rent notices and statements inform tenants of upcoming due dates without manual intervention.'
      ),
      iconStyle: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      num: 2,
      icon: MessageSquare,
      title: t('rentManagement.step2.title', '2. Authorized Management & Tenant Communication'),
      desc: t(
        'rentManagement.step2.desc',
        'Under approved management agreements, routine inquiries, payment logging (digital or cash recording), and maintenance intake are handled efficiently while keeping owners informed.'
      ),
      iconStyle: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
      num: 3,
      icon: FileCheck,
      title: t('rentManagement.step3.title', '3. Payment Confirmation & Accounting Records'),
      desc: t(
        'rentManagement.step3.desc',
        'Received payments are verified before entry. Confirmed transactions are recorded directly in PostgreSQL double-entry ledgers (journal entries and ledger lines) for verifiable auditing.'
      ),
      iconStyle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      num: 4,
      icon: DollarSign,
      title: t('rentManagement.step4.title', '4. Owner Financial Reporting & Settlement Status'),
      desc: t(
        'rentManagement.step4.desc',
        'Dynamic fees apply only to confirmed collected rent according to your operating model. Itemized net owner balances and settlement statements are readily accessible in your workspace.'
      ),
      iconStyle: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
  ];

  const operatingModels = [
    {
      id: 'fully-managed',
      title: t('rentManagement.model.fullyManaged.title', 'Fully Managed'),
      badge: t('rentManagement.model.fullyManaged.badge', 'Platform + Rent + Mgmt Fee'),
      desc: t(
        'rentManagement.model.fullyManaged.desc',
        'HomeHub or assigned licensed manager manages the complete leasing, collection, and property lifecycle. Platform Fee, Rent Fee, and Management Fee apply to confirmed collected rent.'
      ),
      badgeStyle: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      activeBorder: 'border-amber-500/40 hover:border-amber-400',
    },
    {
      id: 'agent-listed',
      title: t('rentManagement.model.agentListed.title', 'Agent-Listed Platform-Managed'),
      badge: t('rentManagement.model.agentListed.badge', 'Platform + Mgmt Fee'),
      desc: t(
        'rentManagement.model.agentListed.desc',
        'A commercial agent leases the property; HomeHub handles ongoing property management and accounting. Platform Fee and Management Fee apply; Rent Fee is not applicable.'
      ),
      badgeStyle: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      activeBorder: 'border-blue-500/40 hover:border-blue-400',
    },
    {
      id: 'agent-operated',
      title: t('rentManagement.model.agentOperated.title', 'Agent-Operated'),
      badge: t('rentManagement.model.agentOperated.badge', 'Platform Fee Only'),
      desc: t(
        'rentManagement.model.agentOperated.desc',
        'The agent or owner directly operates property management. Only the standard Platform Fee applies; Rent Fee and Management Fee are not applicable.'
      ),
      badgeStyle: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      activeBorder: 'border-emerald-500/40 hover:border-emerald-400',
    },
  ];

  const financialGovernance = [
    {
      icon: Percent,
      title: t('rentManagement.gov.item1.title', 'Configurable Dynamic 3-Fee Model'),
      desc: t(
        'rentManagement.gov.item1.desc',
        'HomeHub operates under a dynamic 3-fee policy (Platform Fee, Rent Fee, Management Fee) fetched dynamically from financial_policies. Fees apply exclusively to CONFIRMED rent collections and are never surcharged to tenants. Security deposits incur 0% commission.'
      ),
    },
    {
      icon: Shield,
      title: t('rentManagement.gov.item2.title', 'Strict Ownership vs. Management Separation'),
      desc: t(
        'rentManagement.gov.item2.desc',
        'Property ownership is strictly defined by ownership_records. Management agreements authorize property operations and tenant handling without transferring ownership or deed rights.'
      ),
    },
    {
      icon: ShieldCheck,
      title: t('rentManagement.gov.item3.title', 'Auditable Double-Entry Ledger Security'),
      desc: t(
        'rentManagement.gov.item3.desc',
        'All balance adjustments, rent disbursements, and fee deductions are governed by authoritative double-entry ledgers in PostgreSQL (journal_entries and ledger_lines), eliminating shadow balances and unverified transactions.'
      ),
    },
  ];

  return (
    <div
      id="rent-management-page"
      className={`w-full min-h-screen bg-[#070b14] text-white ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`}
      dir={direction}
    >
      {/* Hero Section */}
      <section
        id="rent-mgmt-hero"
        className="relative overflow-hidden bg-gradient-to-b from-[#070b14] via-[#0c1322] to-[#070b14] text-white pt-12 pb-20 sm:pb-28 border-b border-amber-500/20"
      >
        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-md text-xs sm:text-sm font-bold shadow-sm">
            <Percent className="w-4 h-4 text-amber-400" />
            <span>
              {t(
                'rentManagement.badge',
                'Core Operational Service: Tenant & Rent Management'
              )}
            </span>
          </div>

          {/* Headline & Supporting Content */}
          <div className="max-w-4xl mx-auto space-y-5">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
              {t('rentManagement.headline', 'Professional Tenant & Rent Management')}
            </h1>

            {/* Benefit-Focused Highlight Box */}
            <div
              id="rent-mgmt-highlight-box"
              className="max-w-3xl mx-auto p-4 sm:p-6 rounded-3xl bg-[#0c1322]/90 backdrop-blur-md border border-amber-500/30 text-amber-200 font-bold text-base sm:text-lg lg:text-xl leading-relaxed shadow-2xl"
            >
              <p>
                {t(
                  'rentManagement.highlightBox',
                  'Manage rental schedules, payment records, tenant communication, and owner financial reporting through one organized workspace.'
                )}
              </p>
            </div>

            <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              {t(
                'rentManagement.subtext',
                'A transparent, accountable management system for property owners: structured rent schedules, verified payment confirmations, auditable double-entry accounting records, and clear net owner statements.'
              )}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              id="rent-mgmt-hero-open-owner-btn"
              to="/workspace/owner"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t('rentManagement.cta.openOwnerWorkspace', 'Open Owner Workspace')}</span>
              <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            </Link>

            <Link
              id="rent-mgmt-hero-register-property-btn"
              to="/properties/add"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#080d19] hover:bg-[#111b2e] active:scale-95 text-white font-bold text-sm transition-all border border-slate-800 hover:border-amber-500/40 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>{t('rentManagement.cta.registerProperty', 'Register a Property')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Stage Operational Flow */}
      <section id="rent-mgmt-operational-flow" className="py-16 sm:py-24 border-b border-slate-800 bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase font-black tracking-wider text-amber-400">
              {t('rentManagement.flow.badge', 'Four-Stage Operational Flow')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {t('rentManagement.flow.heading', 'How HomeHub Supports Rental Management')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {t(
                'rentManagement.flow.subtext',
                'Each stage operates with explicit verification, authenticated workflows, and auditable accounting records.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {operationalSteps.map((st) => {
              const IconComp = st.icon;
              return (
                <div
                  key={st.num}
                  id={`rent-mgmt-step-${st.num}`}
                  className="bg-[#0c1322] rounded-3xl p-6 border border-slate-800/80 hover:border-amber-500/40 hover:shadow-xl transition-all duration-200 text-start flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${st.iconStyle}`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center justify-center">
                        {st.num}
                      </span>
                    </div>

                    <h3 className="font-black text-base sm:text-lg text-white leading-snug">
                      {st.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                      {st.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Operating Models & Fee Transparency Matrix */}
      <section id="rent-mgmt-operating-models" className="py-16 sm:py-24 bg-[#080d19] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase font-black tracking-wider text-amber-400">
              {t('rentManagement.models.badge', 'Operating Models & Fee Allocation')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {t('rentManagement.models.heading', 'Three Flexible Operating Models')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {t(
                'rentManagement.models.subtext',
                'Fees are governed strictly by the agreed operating model. Unset by default, fees apply exclusively to confirmed collected rent with 0% tenant surcharge.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {operatingModels.map((model) => (
              <div
                key={model.id}
                id={`rent-mgmt-model-${model.id}`}
                className={`bg-[#0c1322] rounded-3xl p-7 border ${model.activeBorder} shadow-xl transition-all text-start flex flex-col justify-between space-y-4`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-black text-lg text-white leading-snug">
                      {model.title}
                    </h3>
                  </div>

                  <div className="inline-block">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${model.badgeStyle}`}>
                      {model.badge}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                    {model.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Financial Governance & Architectural Guarantees */}
      <section id="rent-mgmt-governance" className="py-16 sm:py-24 bg-[#070b14] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase font-black tracking-wider text-amber-400">
              {t('rentManagement.gov.badge', 'Financial Governance & Protections')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {t('rentManagement.gov.heading', 'Core Financial Architectural Guarantees')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {t(
                'rentManagement.gov.subtext',
                'Security invariants, authoritative ownership validation, and dynamic fee enforcement built into platform architecture.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {financialGovernance.map((fh, idx) => {
              const GovIcon = fh.icon;
              return (
                <div
                  key={idx}
                  id={`rent-mgmt-gov-${idx + 1}`}
                  className="bg-[#0c1322] rounded-3xl p-7 border border-slate-800/80 hover:border-amber-500/40 shadow-xl transition-all text-start space-y-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                    <GovIcon className="w-5 h-5" />
                  </div>

                  <h3 className="font-black text-lg text-white leading-snug">
                    {fh.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                    {fh.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Owner Workspace Deep Link & Final CTA */}
      <section
        id="rent-mgmt-final-cta"
        className="py-16 sm:py-24 bg-gradient-to-r from-[#0c1322] via-[#111b2e] to-[#0c1322] border-t border-amber-500/20 text-white text-center"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {t('rentManagement.final.heading', 'Ready to Organize Your Property & Rent Management?')}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal leading-relaxed">
              {t(
                'rentManagement.final.subtext',
                'Access your dedicated Owner Workspace to review rent schedules, track verified payment records, and monitor your property portfolio with complete financial clarity.'
              )}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              id="rent-mgmt-bottom-open-owner-btn"
              to="/workspace/owner"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{t('rentManagement.cta.openOwnerWorkspace', 'Open Owner Workspace')}</span>
              <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            </Link>
            <Link
              id="rent-mgmt-bottom-register-property-btn"
              to="/properties/add"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#080d19] hover:bg-[#111b2e] text-white font-bold text-sm border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>{t('rentManagement.cta.registerProperty', 'Register a Property')}</span>
            </Link>
          </div>

          {/* Property Management Company Guidance */}
          <div
            id="rent-mgmt-company-box"
            className="mt-8 max-w-xl mx-auto p-5 rounded-2xl bg-[#070b14]/70 border border-slate-800 text-start space-y-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  {t('rentManagement.company.cardTitle', 'Licensed Property Management Company?')}
                </h4>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                {t(
                  'rentManagement.company.cardDesc',
                  'Operate multi-property portfolios under approved management agreements with dedicated CRM, maintenance dispatch, and cash collection tools.'
                )}
              </p>
            </div>
            <Link
              id="rent-mgmt-company-portal-btn"
              to="/company"
              className="shrink-0 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 hover:border-amber-500/30 transition-all cursor-pointer"
            >
              {t('rentManagement.company.linkText', 'Management Companies Portal')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

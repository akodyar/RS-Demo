import React from 'react';
import { OnboardingHeader } from './OnboardingHeader';
import { PrimaryCTA, SecondaryAction } from './FormControls';
import { SelectableRoleCard } from './OnboardingCards';
import { ProgressIndicator } from './ProgressIndicator';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen6RoleConfirmationProps {
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip?: () => void;
}

export const CONFIRMATION_ROLES = [
  {
    id: 'owner',
    titleKey: 'role.owner.title',
    title: 'خاوەنی موڵک',
    descKey: 'role.owner.desc',
    desc: 'من خاوەنی یەک یان چەند موڵکم و دەمەوێت بەڕێوەی بکەم.',
    imageUrl:
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'tenant',
    titleKey: 'role.tenant.title',
    title: 'کرێچیم',
    descKey: 'role.tenant.desc',
    desc: 'من کرێچیم و دەمەوێت ماڵێک بە کرێ بگرم',
    imageUrl:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'agent',
    titleKey: 'role.agent.title',
    title: 'ئەگێنت / برۆکەر',
    descKey: 'role.agent.desc',
    desc: 'من ئەگێنت یان برۆکەرم و دەمەوێت هاوکاری کڕیار و فرۆشتیار بکەم.',
    imageUrl:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'vendor',
    titleKey: 'role.vendor.title',
    title: 'دابینکەر / خزمەتگوزارەم',
    descKey: 'role.vendor.desc',
    desc: 'من خزمەتگوزارم (چاکسازی، کارمەندانی پسپۆڕی، دابینکەر).',
    imageUrl:
      'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=200&q=80',
  },
];

export const Screen6RoleConfirmation: React.FC<Screen6RoleConfirmationProps> = ({
  selectedRoleId,
  onSelectRole,
  onContinue,
  onBack,
  onSkip,
}) => {
  const { t, direction } = useI18n();

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboarding.step_5_of_6', 'قۆناغی ٥ لە ٦')} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-8 flex flex-col justify-start text-start space-y-6">
        {/* Title & Subtitle */}
        <div className="space-y-2 text-start" dir={direction}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{t('role.confirm.badge', 'دڵنیابوونەوە لە ڕۆڵ')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {t('role.confirm.title', 'ڕۆڵەکەت هەڵبژێرە')}
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-medium">
            {t('role.confirm.desc', 'تکایە ئەو ڕۆڵە هەڵبژێرە کە باشترین پێوەندی بە پێداویستیەکانی تۆ هەیە.')}
          </p>
        </div>

        {/* 4 Selectable Role Cards in Responsive Multi-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-2 w-full" dir={direction}>
          {CONFIRMATION_ROLES.map((role) => (
            <SelectableRoleCard
              key={role.id}
              id={role.id}
              title={t(role.titleKey, role.title)}
              description={t(role.descKey, role.desc)}
              imageUrl={role.imageUrl}
              selected={selectedRoleId === role.id}
              onSelect={() => onSelectRole(role.id)}
            />
          ))}
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="w-full max-w-md mx-auto px-6 pb-8 pt-4 space-y-4">
        <PrimaryCTA id="role-confirm-btn" onClick={onContinue}>
          {t('common.continue', 'بەردەوام بە')}
        </PrimaryCTA>
        {onSkip && (
          <div className="text-center">
            <SecondaryAction
              id="role-skip-btn"
              onClick={onSkip}
              variant="link"
              className="text-xs sm:text-sm text-slate-400 hover:text-amber-400"
            >
              {t('common.skip_later', 'دواتر ئەنجام دەدەم')}
            </SecondaryAction>
          </div>
        )}
        <div className="pt-1">
          <ProgressIndicator totalSteps={6} currentStep={5} />
        </div>
      </div>
    </div>
  );
};

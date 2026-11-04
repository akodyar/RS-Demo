import React, { useState } from 'react';
import { OnboardingHeader } from './OnboardingHeader';
import { PrimaryCTA, SecondaryAction } from './FormControls';
import { RoleCard, RoleItem } from './OnboardingCards';
import { ProgressIndicator } from './ProgressIndicator';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen3PurposeProps {
  selectedRole: string;
  onSelectRole: (role: RoleItem) => void;
  onContinue: () => void;
  onBack: () => void;
  onGuestSearch?: () => void;
}

export const ROLE_DEFINITIONS: RoleItem[] = [
  {
    id: 'owner',
    roleKey: 'OWNER',
    title: 'خاوەنی موڵک',
    desc: 'دەستکاری موڵکەکانت بکە و بەڕێوەبەریی بکەن.',
    iconBg: 'bg-[#e6fcf1]',
    iconColor: 'text-[#059669]',
    iconType: 'owner',
    imageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'tenant',
    roleKey: 'TENANT',
    title: 'کرێنشین',
    desc: 'موڵکی گونجاو بدۆزەوە و کرێ بکە.',
    iconBg: 'bg-[#fff0e6]',
    iconColor: 'text-[#ea580c]',
    iconType: 'tenant',
    imageUrl:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'agent',
    roleKey: 'AGENT',
    title: 'ئەگێنت / برۆکەر',
    desc: 'کەشتیارانی خۆت بەڕێوەبەرە و فرۆشتین زیاد بکە.',
    iconBg: 'bg-[#ffeef0]',
    iconColor: 'text-[#e11d48]',
    iconType: 'agent',
    imageUrl:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'vendor',
    roleKey: 'VENDOR',
    title: 'دابینکەر / خزمەتگوزار',
    desc: 'خزمەتگوزارییەکانت پێشکەش بکە.',
    iconBg: 'bg-[#fffbeb]',
    iconColor: 'text-[#d97706]',
    iconType: 'vendor',
    imageUrl:
      'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=200&q=80',
  },
];

export const Screen3Purpose: React.FC<Screen3PurposeProps> = ({
  selectedRole,
  onSelectRole,
  onContinue,
  onBack,
  onGuestSearch,
}) => {
  const { t, direction } = useI18n();
  const handleProceed = () => {
    if (!selectedRole) return;
    if (selectedRole === 'explore' && onGuestSearch) {
      onGuestSearch();
    } else {
      onContinue();
    }
  };

  const localizedRoles = ROLE_DEFINITIONS.map((role) => ({
    ...role,
    title: t(`role.${role.id}.title`, role.title),
    desc: t(`role.${role.id}.desc`, role.desc),
  }));

  return (
    <div className="flex-1 flex flex-col justify-between bg-white text-slate-900 min-h-screen w-full">
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboard.step.2', 'قۆناغی ۲ لە ۳')} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-8 flex flex-col justify-start text-start space-y-6">
        {/* Title & Subtitle */}
        <div className="space-y-2 text-start" dir={direction}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
            <span>{t('onboard.roles.badge', 'دیاریکردنی جۆری هەژمار')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {t('onboard.roles.title', 'بەکارهێنانی خۆت هەڵبژێرە')}
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-medium">
            {t('onboard.roles.subtitle', 'تکایە ئەو ڕۆڵە هەڵبژێرە کە گونجاوترینە بۆ شێوازی بەکارهێنانت لە پلاتفۆرمی HomeHub.')}
          </p>
        </div>

        {/* 4 Role Cards in Responsive Large Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 py-2 w-full" dir={direction}>
          {localizedRoles.map((role) => (
            <RoleCard
              key={role.id}
              item={role}
              selected={selectedRole === role.id}
              onClick={() => onSelectRole(role)}
            />
          ))}
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="w-full max-w-md mx-auto px-6 pb-8 pt-4 space-y-4">
        <PrimaryCTA
          id="purpose-continue-btn"
          onClick={handleProceed}
          disabled={!selectedRole}
        >
          {selectedRole === 'explore' ? t('onboard.roles.btn_explore', 'گەڕان و بینینی پلاتفۆڕم') : t('action.continue', 'بەردەوام بە')}
        </PrimaryCTA>



        <div className="pt-1">
          <ProgressIndicator totalSteps={3} currentStep={2} />
        </div>
      </div>
    </div>
  );
};

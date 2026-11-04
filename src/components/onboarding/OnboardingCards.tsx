import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  Home,
  Users,
  ShoppingCart,
  User,
  UserCheck,
  Wrench,
  Settings2,
  Check,
  Compass,
  Search,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

// --- Role Card (For Screen 3 Purpose Selection) ---
export interface RoleItem {
  id: string;
  roleKey: 'OWNER' | 'COMPANY' | 'TENANT' | 'BUYER' | 'AGENT' | 'VENDOR' | 'ADMIN' | 'EXPLORE' | 'GUEST';
  title: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  iconType: 'owner' | 'company' | 'tenant' | 'buyer' | 'agent' | 'vendor' | 'admin' | 'explore' | 'guest';
  imageUrl: string;
}

interface RoleCardProps {
  item: RoleItem;
  selected?: boolean;
  onClick: () => void;
  className?: string;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  item,
  selected = false,
  onClick,
  className = '',
}) => {
  const { t } = useI18n();
  const renderIcon = () => {
    switch (item.iconType) {
      case 'owner':
        return <User className="w-4 h-4 text-[#059669]" />;
      case 'company':
        return <Building2 className="w-4 h-4 text-[#0066fe]" />;
      case 'tenant':
        return <Users className="w-4 h-4 text-[#ea580c]" />;
      case 'buyer':
        return <ShoppingCart className="w-4 h-4 text-[#7c3aed]" />;
      case 'agent':
        return <UserCheck className="w-4 h-4 text-[#e11d48]" />;
      case 'vendor':
        return <Wrench className="w-4 h-4 text-[#d97706]" />;
      case 'admin':
        return <Settings2 className="w-4 h-4 text-[#475569]" />;
      case 'explore':
      case 'guest':
        return <Compass className="w-4 h-4 text-[#0284c7]" />;
    }
  };

  return (
    <div
      id={`role-card-${item.id}`}
      data-testid={`role-card-${item.id}`}
      onClick={onClick}
      className={`group w-full rounded-2xl border transition-all duration-200 cursor-pointer flex flex-row items-center p-3 sm:p-4 gap-4 overflow-hidden text-start active:scale-[0.98] ${
        selected
          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/40 text-white'
          : 'border-slate-800 bg-[#0c1322] hover:bg-[#111b2e] hover:border-slate-700 hover:shadow-xl text-white shadow-md'
      } ${className}`}
    >
      {/* Left Image Section */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-[#080d19] border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10" />
        <img
          src={item.imageUrl}
          alt={t(item.title, item.title)}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-transform duration-700 ease-out ${selected ? 'scale-110' : 'group-hover:scale-105'}`}
        />
        {/* Floating Icon inside Image */}
        <div className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-lg bg-[#0c1322]/90 border border-slate-700/80 backdrop-blur-md flex items-center justify-center shadow-md">
          {renderIcon()}
        </div>
      </div>

      {/* Right Content Section */}
      <div className="flex flex-col flex-1 min-w-0 py-1">
        <h4 className="font-bold text-base sm:text-lg text-white group-hover:text-amber-300 tracking-tight truncate transition-colors">
          {t(`role.${item.id}.title`, item.title)}
        </h4>
        <p className="text-xs sm:text-sm text-slate-400 font-medium leading-snug line-clamp-2 mt-1">
          {t(`role.${item.id}.desc`, item.desc)}
        </p>
      </div>

      {/* Selection Indicator */}
      <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
        selected
          ? 'border-amber-400 bg-gradient-to-r from-amber-400 to-amber-500 scale-110 shadow-sm'
          : 'border-slate-700 bg-[#080d19] group-hover:border-amber-400/60'
      }`}>
        <Check className={`w-3.5 h-3.5 text-slate-950 stroke-[3.5] transition-opacity duration-300 ${selected ? 'opacity-100' : 'opacity-0'}`} />
      </div>
    </div>
  );
};

// --- Selectable Role Card with Radio Button (For Screen 6) ---
interface SelectableRoleCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}

export const SelectableRoleCard: React.FC<SelectableRoleCardProps> = ({
  id,
  title,
  description,
  imageUrl,
  selected,
  onSelect,
  className = '',
}) => {
  return (
    <div
      id={`selectable-role-${id}`}
      data-testid={`selectable-role-${id}`}
      onClick={onSelect}
      className={`w-full p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 text-start active:scale-[0.99] ${
        selected
          ? 'border-amber-500 bg-amber-500/10 shadow-md ring-2 ring-amber-500/30 text-white'
          : 'border-slate-800 bg-[#0c1322] hover:border-slate-700 hover:bg-[#111b2e] text-white shadow-xs'
      } ${className}`}
    >
      {/* Image Thumbnail */}
      <img
        src={imageUrl}
        alt={title}
        referrerPolicy="no-referrer"
        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-800 shadow-xs"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm leading-snug text-white">
          {title}
        </h4>
        <p className="text-xs text-slate-400 leading-snug mt-0.5 line-clamp-2">
          {description}
        </p>
      </div>

      {/* Radio Circle */}
      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          selected ? 'border-amber-400 bg-[#0c1322]' : 'border-slate-700 bg-[#080d19]'
        }`}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
      </div>
    </div>
  );
};

// --- AI Sparkle Capability Banner (For Screen 2) ---
export const AICapabilityCard: React.FC<{
  title?: string;
  description?: string;
  className?: string;
}> = ({
  title = 'کارکردن سادەتر دەکەین',
  description = 'بە تەکنەلۆژیای زیرەک (AI) دەتوانیت باشتر بڕیار بدەیت و کات پاشەکەوت بکەیت.',
  className = '',
}) => {
  return (
    <div
      className={`w-full p-4 rounded-2xl bg-gradient-to-br from-[#0c1322] via-[#111b2e] to-[#0c1322] border border-amber-500/30 text-white flex items-start gap-3.5 text-start shadow-xl ${className}`}
    >
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
        <Sparkles className="w-5 h-5 fill-amber-300/20" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-slate-300 leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
};

// --- Benefit Card for Success Screen (Screen 9) ---
interface BenefitCardProps {
  id?: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
}

export const BenefitCard: React.FC<BenefitCardProps> = ({
  id,
  iconBg,
  iconColor,
  icon,
  title,
  desc,
  onClick,
}) => {
  const { direction } = useI18n();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div
      id={id}
      data-testid={id}
      onClick={onClick}
      className="w-full p-3.5 rounded-2xl border border-slate-800 bg-[#0c1322] hover:bg-[#111b2e] hover:border-amber-500/40 transition-all flex items-center justify-between gap-3 text-start shadow-sm cursor-pointer active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl bg-[#080d19] border border-slate-700/80 flex items-center justify-center shrink-0 shadow-xs"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white leading-tight truncate">
            {title}
          </h4>
          <p className="text-xs text-slate-400 leading-tight mt-0.5 truncate">{desc}</p>
        </div>
      </div>
      <Chevron className="w-4 h-4 text-slate-400 shrink-0" />
    </div>
  );
};

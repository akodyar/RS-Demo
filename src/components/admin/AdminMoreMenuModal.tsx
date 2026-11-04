import React from 'react';
import {
  X,
  Users,
  Building2,
  Home,
  ShoppingCart,
  ShieldCheck,
  Wrench,
  Coins,
  FileText,
  Settings,
  ShieldAlert,
  Sparkles,
  MessageSquare,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface AdminMoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleKey: string) => void;
  onSignOut?: () => void;
}

export const AdminMoreMenuModal: React.FC<AdminMoreMenuModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
  onSignOut,
}) => {
  const { language, direction } = useI18n();

  if (!isOpen) return null;

  const t = {
    ku: {
      title: 'بەشەکان و خزمەتگوزارییەکان',
      subtitle: 'هەموو ئامرازەکانی بەڕێوەبەرایەتی HomeHub',
      signOut: 'دەرچوون لە ئەدمین پۆڕتاڵ',
      users: 'بەکارهێنەران',
      companies: 'کۆمپانیاکان',
      properties: 'موڵک و تاپۆ',
      marketplace: 'بازاڕ و ڕیکلامەکان',
      verification: 'دڵنیایی و متمانە',
      finance: 'دارایی و حیسابات',
      maintenance: 'چاکسازی و خزمەتگوزاری',
      security: 'ئاسایش و ژیری دەستکرد',
      audit: 'تۆماری کارکردن (Audit Log)',
      messages: 'پەیام و ناکۆکییەکان',
      settings: 'ڕێکخستنە گشتییەکان',
    },
    ar: {
      title: 'أقسام وخدمات المنصة',
      subtitle: 'جميع أدوات الإدارة والتحكم في منصة HomeHub',
      signOut: 'تسجيل الخروج من لوحة الإدارة',
      users: 'المستخدمين',
      companies: 'الشركات',
      properties: 'العقارات والملكيات',
      marketplace: 'السوق والإعلانات',
      verification: 'التوثيق والتحقق',
      finance: 'المالية والحسابات',
      maintenance: 'الصيانة والخدمات',
      security: 'الأمان والذكاء الاصطناعي',
      audit: 'سجلات العمليات (Audit Log)',
      messages: 'الرسائل والنزاعات',
      settings: 'الإعدادات العامة',
    },
    en: {
      title: 'Platform Modules & Services',
      subtitle: 'All HomeHub platform administration and control tools',
      signOut: 'Sign Out from Admin Portal',
      users: 'Users',
      companies: 'Companies',
      properties: 'Properties & Deeds',
      marketplace: 'Marketplace & Ads',
      verification: 'Verification & Trust',
      finance: 'Finance & Accounts',
      maintenance: 'Maintenance & Services',
      security: 'Security & AI Sentinel',
      audit: 'Audit Log & History',
      messages: 'Messages & Disputes',
      settings: 'General Settings',
    },
  }[language] || {
    title: 'بەشەکان و خزمەتگوزارییەکان',
    subtitle: 'هەموو ئامرازەکانی بەڕێوەبەرایەتی HomeHub',
    signOut: 'دەرچوون لە ئەدمین پۆڕتاڵ',
    users: 'بەکارهێنەران',
    companies: 'کۆمپانیاکان',
    properties: 'موڵک و تاپۆ',
    marketplace: 'بازاڕ و ڕیکلامەکان',
    verification: 'دڵنیایی و متمانە',
    finance: 'دارایی و حیسابات',
    maintenance: 'چاکسازی و خزمەتگوزاری',
    security: 'ئاسایش و ژیری دەستکرد',
    audit: 'تۆماری کارکردن (Audit Log)',
    messages: 'پەیام و ناکۆکییەکان',
    settings: 'ڕێکخستنە گشتییەکان',
  };

  const menuItems = [
    { key: 'users', label: t.users, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { key: 'companies', label: t.companies, icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { key: 'properties', label: t.properties, icon: Home, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'marketplace', label: t.marketplace, icon: ShoppingCart, color: 'text-orange-500 bg-orange-50' },
    { key: 'verification', label: t.verification, icon: ShieldCheck, color: 'text-rose-600 bg-rose-50' },
    { key: 'finance', label: t.finance, icon: Coins, color: 'text-rose-500 bg-rose-50' },
    { key: 'maintenance', label: t.maintenance, icon: Wrench, color: 'text-amber-600 bg-amber-50' },
    { key: 'security', label: t.security, icon: ShieldAlert, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'audit', label: t.audit, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
    { key: 'messages', label: t.messages, icon: MessageSquare, color: 'text-blue-500 bg-blue-50' },
    { key: 'promotions', label: language === 'ku' ? 'ڕیکلام و خاڵەکان' : language === 'ar' ? 'الترويج والنقاط' : 'Promotions & Points', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
    { key: 'pricing', label: language === 'ku' ? 'نرخە پلەبەستووەکان' : language === 'ar' ? 'تسعير الفئات' : 'Tiered Pricing', icon: Coins, color: 'text-emerald-700 bg-emerald-50' },
    { key: 'settings', label: t.settings, icon: Settings, color: 'text-slate-700 bg-slate-100' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" dir={direction}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900">
              {t.title}
            </h3>
            <p className="text-[11px] text-slate-500">
              {t.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid of All Modules */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                data-testid={`admin-module-${item.key}`}
                onClick={() => {
                  onSelectModule(item.key);
                  onClose();
                }}
                className="p-3 rounded-2xl border border-slate-200/80 hover:bg-slate-50 flex flex-col items-center justify-center text-center gap-2 group transition-all cursor-pointer"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center transition-transform group-hover:scale-105`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer with Sign out */}
        {onSignOut && (
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full py-2.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.signOut}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { 
  X, Search, Bell, Building2, Users, FileText, Wrench, 
  Tag, Store, DollarSign, CheckCircle2, BarChart2, Folder, 
  MessageSquare, Sparkles, Plus, AlertTriangle, Shield, 
  Send, Download, ExternalLink, Filter, UserCheck, UserPlus,
  Home
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CompanyProfile, CompanyPropertyItem, CompanyApprovalItem } from '../../types/company.js';
import { ActivityItem } from './CompanyRecentActivity';
import { CashCollectionModal } from './CashCollectionModal';

// -------------------------------------------------------------
// 1. GLOBAL SEARCH MODAL
// -------------------------------------------------------------
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties?: CompanyPropertyItem[];
  onSelectResult?: (type: string, id?: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, properties = [] }) => {
  const { t, direction } = useI18n();
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredProperties = query
    ? properties.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.ownerName.toLowerCase().includes(query.toLowerCase()))
    : properties;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 cursor-default">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Search className="w-5 h-5 text-blue-600" />
            <span>گەڕان لە سیستەم (Company Search)</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search className={`w-4 h-4 text-slate-400 absolute top-3.5 ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="گەڕان بۆ موڵک، کرێنشین، گرێبەست، وەستا..."
              className={`w-full py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                direction === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
              }`}
            />
          </div>
        </div>

        <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-slate-100">
          {filteredProperties.length > 0 ? (
            filteredProperties.map(p => (
              <div key={p.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">خاوەن موڵک: {p.ownerName} • {p.type}</p>
                </div>
                <Link
                  to={`/properties/${p.id}`}
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  پاسپۆرت
                </Link>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              هیچ ئەنجامێک بۆ "{query}" نەدۆزرایەوە.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. NOTIFICATIONS CENTER DRAWER
// -------------------------------------------------------------
interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  urgentAlerts?: { id: string; title: string; message: string; level: string }[];
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  urgentAlerts = [],
}) => {
  const { t, direction } = useI18n();
  if (!isOpen) return null;

  return (
    <div id="company-notifications-drawer" onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150 cursor-pointer">
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full max-w-full sm:max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto cursor-default ${
          direction === 'rtl' ? 'animate-in slide-in-from-left' : 'animate-in slide-in-from-right'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">{t('company.notifications', 'Notifications')}</h3>
            </div>
            <button id="btn-close-company-notifications" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {urgentAlerts.length > 0 ? (
              urgentAlerts.map(alert => (
                <div key={alert.id} className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-amber-900">{alert.title}</h4>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">{t('crm.allCaughtUp')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('crm.allCaughtUpDesc')}</p>
              </div>
            )}
          </div>
        </div>

        <button
          id="btn-dismiss-company-notifications"
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
        >
          {t('crm.close')}
        </button>
      </div>
    </div>
  );
};


// -------------------------------------------------------------
// 3. COMPANY PROFILE MODAL
// -------------------------------------------------------------
interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: CompanyProfile | null;
  company?: any;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({ isOpen, onClose, profile, company }) => {
  if (!isOpen) return null;
  const activeCompany = company || profile;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto cursor-default">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">پڕۆفایلی فەرمی کۆمپانیا (Official Profile)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-xs text-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">ناوی کۆمپانیا:</span>
            <span className="font-bold text-slate-900">{activeCompany?.name || 'HomeHub Partner'}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">ژمارەی مۆڵەتی بازرگانی:</span>
            <span className="font-mono text-slate-800">{activeCompany?.registrationNumber || 'تۆمار نەکراوە (Not Registered)'}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">ناوچەی خزمەتگوزاری:</span>
            <span className="font-semibold text-slate-800">{activeCompany?.serviceArea || 'دیاری نەکراوە (Not Specified)'}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">دۆخی پشتڕاستکردنەوە:</span>
            <span className={`font-bold px-2 py-0.5 rounded border ${
              activeCompany?.status === 'VERIFIED' && activeCompany?.verified
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {activeCompany?.status || 'PENDING_VERIFICATION'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">سنووری خەرجی خۆکار:</span>
            <span className="font-bold text-blue-700">
              {(activeCompany?.spendingLimitDefault || 500000).toLocaleString()} IQD
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
            ڕاستی ژێرخان: سیستەمی پشکنینی ناوخۆیی بەکاردێت. هیچ ئینتیگرەیشنێکی دەرەکی ساختە نەکراوە و پەسەندکردنی بازرگانی لەلایەن بەڕێوەبەرانی پلاتفۆرم دەکرێت.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 4. ADD PROPERTY MANAGEMENT PROPOSAL MODAL
// -------------------------------------------------------------
interface AddAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNotice: (msg: string) => void;
}

export const AddPropertyManagementModal: React.FC<AddAgreementModalProps> = ({
  isOpen,
  onClose,
  onSubmitNotice,
}) => {
  const [propertyName, setPropertyName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [spendingLimit, setSpendingLimit] = useState('500000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNotice(`داواکاری بەڕێوەبردنی موڵکی (${propertyName}) بۆ (${ownerEmail}) نێردرا.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">داواکاری بەڕێوەبردنی موڵک</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5 text-xs text-slate-700">
          <div>
            <label className="font-semibold block mb-1">ناوی موڵک</label>
            <input
              type="text"
              required
              value={propertyName}
              onChange={e => setPropertyName(e.target.value)}
              placeholder="بۆ نموونە: باڵەخانەی ڕێزان"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">ئیمەیڵی خاوەن موڵک</label>
            <input
              type="email"
              required
              value={ownerEmail}
              onChange={e => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">سنووری خەرجی (IQD)</label>
              <input
                type="number"
                value={spendingLimit}
                onChange={e => setSpendingLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-1">
            تێبینی یاسایی: کۆمپانیا نابێتە خاوەنی موڵک. گرێبەستی بەڕێوەبردن (Management Agreement) پێویستی بە واژۆی خاوەن موڵکە.
          </p>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 min-h-[44px]"
            >
              پاشگەزبوونەوە
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 min-h-[44px]"
            >
              ناردنی داواکاری
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 5. ACTIVITY DETAIL MODAL
// -------------------------------------------------------------
interface ActivityDetailModalProps {
  activity: ActivityItem | null;
  onClose: () => void;
  isOpen?: boolean;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({ activity, onClose, isOpen = true }) => {
  if (!activity || isOpen === false) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {activity.type}
            </span>
            <h3 className="font-bold text-slate-900 text-base mt-1">{activity.title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-xs text-slate-700">
          <div className="p-3 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">شوێن / یەکە:</span>
            <span className="font-bold">{activity.subtitle}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 flex justify-between">
            <span className="text-slate-500">کات:</span>
            <span className="font-medium text-slate-600">{activity.timeAgo}</span>
          </div>
          {activity.details && (
            <div className="p-3.5 rounded-xl bg-slate-50">
              <span className="text-slate-500 block mb-1">وردەکارییەکانی ڕووداو:</span>
              <p className="text-slate-800 leading-relaxed">{activity.details}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 6. INVITE OWNER MODAL
// -------------------------------------------------------------
interface InviteOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNotice: (msg: string) => void;
}

export const InviteOwnerModal: React.FC<InviteOwnerModalProps> = ({ isOpen, onClose, onSubmitNotice }) => {
  const [email, setEmail] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNotice(`بانگهێشتنامەی خاوەن موڵک بۆ (${email}) نێردرا.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">بانگهێشتکردنی خاوەن موڵک</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5 text-xs text-slate-700">
          <div>
            <label className="font-semibold block mb-1">ئیمەیڵی خاوەن موڵک</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@example.com"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">ناونیشان یان ناوی موڵک</label>
            <input
              type="text"
              required
              value={propertyAddress}
              onChange={e => setPropertyAddress(e.target.value)}
              placeholder="بۆ نموونە: ڤێلا لە گوندی ئیتاڵی ٢"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <p className="text-[11px] text-slate-500 mt-1">
            خاوەن موڵک نامەیەکی فەرمی پێدەگات بۆ پەیوەستبوون بە پلاتفۆرم و پێداچوونەوە بە مەرجەکانی بەڕێوەبردن.
          </p>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 min-h-[44px]"
            >
              پاشگەزبوونەوە
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 min-h-[44px]"
            >
              ناردنی بانگهێشت
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 7. CREATE LEASE MODAL
// -------------------------------------------------------------
interface CreateLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties?: CompanyPropertyItem[];
  onSubmitNotice: (msg: string) => void;
}

export const CreateLeaseModal: React.FC<CreateLeaseModalProps> = ({
  isOpen,
  onClose,
  onSubmitNotice,
}) => {
  const [tenantEmail, setTenantEmail] = useState('');
  const [rentIqd, setRentIqd] = useState('750000');
  const [unit, setUnit] = useState('Unit 3B');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNotice(`ڕەشنووسی گرێبەستی نوێ بۆ (${tenantEmail}) تۆمارکرا.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">دروستکردنی گرێبەستی کرێ (Create Lease)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 text-xs text-slate-700">
          <div>
            <label className="font-semibold block mb-1">ئیمەیڵی کرێنشین</label>
            <input
              type="email"
              required
              value={tenantEmail}
              onChange={e => setTenantEmail(e.target.value)}
              placeholder="tenant@example.com"
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">ژمارەی یەکە / شوقە</label>
              <input
                type="text"
                required
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">کرێی مانگانە (IQD)</label>
              <input
                type="number"
                required
                value={rentIqd}
                onChange={e => setRentIqd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-[11px]">
            گرێبەستی کرێ دوای واژۆکردنی لایەنەکان دەچێتە بواری جێبەجێکردنەوە و لە تۆماری دەفتەری دارایی دادەنرێت.
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 min-h-[44px]"
            >
              داخستن
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 min-h-[44px]"
            >
              تۆمارکردنی گرێبەست
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 8. CREATE LISTING MODAL
// -------------------------------------------------------------
interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNotice: (msg: string) => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({ isOpen, onClose, onSubmitNotice }) => {
  const [title, setTitle] = useState('');
  const [priceIqd, setPriceIqd] = useState('800000');
  const [type, setType] = useState('RENT');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNotice(`ڕیکلامی (${title}) بۆ بازاڕ بڵاوکرایەوە.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-base">بڵاوکردنەوەی ڕیکلام لە بازاڕ</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 text-xs text-slate-700">
          <div>
            <label className="font-semibold block mb-1">ناونیشانی ڕیکلام</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="شوقەی مۆدێرن بۆ کرێ - ئیمپایەر وۆرڵد"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">جۆری ڕیکلام</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="RENT">بۆ کرێ (For Rent)</option>
                <option value="SALE">بۆ فرۆشتن (For Sale)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">نرخ (IQD)</label>
              <input
                type="number"
                required
                value={priceIqd}
                onChange={e => setPriceIqd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 min-h-[44px]"
            >
              داخستن
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 min-h-[44px]"
            >
              بڵاوکردنەوە
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 9. VENDORS NETWORK MODAL
// -------------------------------------------------------------
interface VendorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VendorsModal: React.FC<VendorsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const vendors = [
    { name: 'کۆمپانیای تەکنیکی ساردکەرەوە (Erbil HVAC Solutions)', specialty: 'تەبرید و کەمپریسەر', phone: '+964 750 445 1122', rating: '4.9' },
    { name: 'وەستای دەستڕەنگین (Zana Plumbing)', specialty: 'بۆری و ئاوەڕۆ', phone: '+964 750 332 8899', rating: '4.8' },
    { name: 'تۆڕی کارەبای نیشتمان (Nishtiman Electrical)', specialty: 'کارەبا و بەرهەمهێنان', phone: '+964 750 119 7733', rating: '4.7' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">تۆڕی بەڵێندەر و وەستاکان (Approved Vendors)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {vendors.map((v, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">{v.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{v.specialty} • پلە: {v.rating} ★</p>
                <p className="text-[11px] font-mono text-slate-700 mt-0.5">{v.phone}</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                پەسەندکراو
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 10. REPORTS & ANALYTICS MODAL
// -------------------------------------------------------------
interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-pink-600" />
            <h3 className="font-bold text-slate-900 text-base">ڕاپۆرتە فەرمییەکان (Official Reports)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 text-xs text-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors">
            <div>
              <p className="font-bold text-slate-900">ڕاپۆرتی داگیرکاری موڵکەکان (Occupancy)</p>
              <p className="text-[11px] text-slate-500">ڕێژەی نیشتەجێبوون: ٩٤٪ لە سەرجەم یەکەکان</p>
            </div>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="داگرتن">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors">
            <div>
              <p className="font-bold text-slate-900">کۆی کرێی کۆکراوە (Rent Collections)</p>
              <p className="text-[11px] text-slate-500">تۆماری دەفتەری دارایی دوو-لایەنە</p>
            </div>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="داگرتن">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors">
            <div>
              <p className="font-bold text-slate-900">ڕاپۆرتی تێچووی چاککردنەوە (Maintenance Expenses)</p>
              <p className="text-[11px] text-slate-500">پۆلێنکراو بەپێی سنووری سەربەخۆیی</p>
            </div>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="داگرتن">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 11. DOCUMENTS MODAL
// -------------------------------------------------------------
interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-base">ئەرشیفی بەڵگەنامە یاساییەکان</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 text-xs text-slate-700">
          <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">مۆڵەتی بازرگانی کۆمپانیا (Trade License)</p>
              <p className="text-[11px] text-slate-500">نوێکراوەتەوە • PDF</p>
            </div>
            <Download className="w-4 h-4 text-slate-500" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">ڕێککەوتنی بەڕێوەبردنی موڵک (نموونەی یاسایی)</p>
              <p className="text-[11px] text-slate-500">پەسەندکراوی وەزارەتی داد • PDF</p>
            </div>
            <Download className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 12. MESSAGES DRAWER
// -------------------------------------------------------------
interface MessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MessagesDrawer: React.FC<MessagesDrawerProps> = ({ isOpen, onClose }) => {
  const { t, direction, language } = useI18n();
  const [msgInput, setMsgInput] = useState('');

  if (!isOpen) return null;

  const messages = language === 'en' ? [
    { sender: 'Ahmed Farhad (Tenant)', text: 'Hello, regarding the bathroom plumbing repair, is the technician scheduled?', time: '10:30 AM' },
    { sender: 'Dr. Nabaz (Property Owner)', text: 'Please review the rental adjustment for the next billing cycle.', time: 'Yesterday' },
  ] : language === 'ar' ? [
    { sender: 'أحمد فرهاد (مستأجر)', text: 'مرحباً، بخصوص صيانة تسريب مياه الحمام، هل تم تأكيد موعد الفني؟', time: '10:30 ص' },
    { sender: 'د. نبز (مالك العقار)', text: 'يرجى مراجعة تسوية الإيجار للشهر القادم.', time: 'أمس' },
  ] : [
    { sender: 'فەرهاد ئەحمەد (کرێنشین)', text: 'سڵاو کاکە، لیکی ئاوەکەی حەمام چارەسەر نەکراوە تکایە.', time: '10:30 AM' },
    { sender: 'خاوەن موڵک (د. نەبەز)', text: 'تکایە پێداچوونەوە بە کرێی مانگی داهاتوو بکەن.', time: 'دوێنێ' },
  ];

  return (
    <div id="company-messages-drawer" onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150 cursor-pointer">
      <div 
        className={`bg-white w-full max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto ${
          direction === 'rtl' ? 'animate-in slide-in-from-left' : 'animate-in slide-in-from-right'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">{t('crm.directMessages')}</h3>
            </div>
            <button id="btn-close-company-messages" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {messages.map((m, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">{m.sender}</span>
                  <span className="text-[10px] text-slate-400" dir="ltr">{m.time}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex gap-2">
            <input
              id="company-message-reply-input"
              type="text"
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              placeholder={t('crm.typeReply')}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              id="btn-send-company-message"
              onClick={() => setMsgInput('')}
              className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer min-h-[44px]"
              title={t('crm.send')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// -------------------------------------------------------------
// 13. MORE / COMMAND CENTER MODAL
// -------------------------------------------------------------
interface MoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: any) => void;
}

export const MoreModal: React.FC<MoreModalProps> = ({ isOpen, onClose, onSelectTab }) => {
  if (!isOpen) return null;

  const links = [
    { label: 'بەڕێوەبردنی موڵکەکان (Properties)', tab: 'properties' },
    { label: 'ئۆپەراسیۆن و چاککردنەوە (Operations)', tab: 'operations' },
    { label: 'پەسەندکردنە هەڵپەسێردراوەکان (Approvals)', tab: 'approvals' },
    { label: 'دارایی و عمولە (Financials)', tab: 'financials' },
    { label: 'تیمی کارمەندان و ڕۆڵەکان (Team)', tab: 'team' },
    { label: 'شیکاری و ڕاپۆرت (Intelligence)', tab: 'intelligence' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base">بەشەکانی کۆمپانیا (Command Center)</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {links.map((link, i) => (
            <button
              key={i}
              onClick={() => {
                onSelectTab(link.tab);
                onClose();
              }}
              className="w-full text-left rtl:text-right px-4 py-3 rounded-xl hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

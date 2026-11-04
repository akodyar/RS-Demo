import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Eye,
  Tag,
  ArrowLeft,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminMarketplaceListing } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminMarketplaceModuleProps {
  listings: AdminMarketplaceListing[];
  currentRole: AdminRoleType;
  onUpdateListingStatus: (listingId: string, status: AdminMarketplaceListing['status']) => void;
  onBack: () => void;
}

export const AdminMarketplaceModule: React.FC<AdminMarketplaceModuleProps> = ({
  listings,
  currentRole,
  onUpdateListingStatus,
  onBack,
}) => {
  const { direction } = useI18n();
  const [filter, setFilter] = useState('all');

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  const filtered = listings.filter((l) => {
    if (filter !== 'all' && l.status !== filter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
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
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span>کۆنترۆڵی بازاڕ و ڕیکلامەکان (Marketplace Moderation)</span>
            </h2>
            <p className="text-xs text-slate-500">
              چاوپێخشاندنی فەرمی ڕیکلامەکانی کرێ و فرۆشتن پێش بڵاوکردنەوەی گشتی
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

      <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 overflow-x-auto">
        {[
          { key: 'all', label: 'هەموو ڕیکلامەکان' },
          { key: 'PENDING_REVIEW', label: 'چاوەڕوانی چاوپێخشاندن' },
          { key: 'PUBLISHED', label: 'بڵاوکراوە' },
          { key: 'PAUSED', label: 'ڕاگیراوی کاتی' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              filter === item.key
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{item.title}</h4>
                  <p className="text-[11px] text-slate-500">
                    {item.city} • {item.propertyType}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                  {item.listingType === 'FOR_RENT' ? 'بۆ کرێ' : 'بۆ فرۆشتن'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">نرخ:</span>
                  <strong className="text-slate-900 font-mono">
                    ${item.price.toLocaleString()} {item.listingType === 'FOR_RENT' ? '/ مانگانە' : ''}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">بینینەکان:</span>
                  <strong className="text-slate-900">{item.viewingsCount} جار</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">پێشنیارەکان:</span>
                  <strong className="text-emerald-700">{item.offersCount} ئۆفەر</strong>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">برۆکەر: {item.agentName}</span>

              {!isReadOnly && (
                <div className="flex items-center gap-1.5">
                  {item.status !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => onUpdateListingStatus(item.id, 'PUBLISHED')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                    >
                      بڵاوکردنەوە
                    </button>
                  )}
                  {item.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => onUpdateListingStatus(item.id, 'PAUSED')}
                      className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs hover:bg-amber-100 cursor-pointer"
                    >
                      ڕاگرتنی کاتی
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

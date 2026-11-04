import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ShieldCheck,
  Download,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  FileBadge,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';

interface AdminDocumentsModuleProps {
  onBack: () => void;
}

interface DocumentRecord {
  id: string;
  title: string;
  category: 'TAPU' | 'LEASE' | 'LICENSE' | 'AGREEMENT';
  entityName: string;
  uploadedAt: string;
  status: 'VERIFIED' | 'PENDING' | 'EXPIRING_SOON';
  fileSize: string;
  referenceNumber: string;
}

const INITIAL_DOCS: DocumentRecord[] = [
  {
    id: 'doc-01',
    title: 'Tapu Ownership Deed (سەنەدی تاپۆ)',
    category: 'TAPU',
    entityName: 'Skyline Residence (Unit 4B, Erbil)',
    uploadedAt: '2026-09-15',
    status: 'VERIFIED',
    fileSize: '4.2 MB',
    referenceNumber: 'TAPU-ERB-2026-9901',
  },
  {
    id: 'doc-02',
    title: 'Standard Certified Lease Contract',
    category: 'LEASE',
    entityName: 'Family Villa - Gulan St',
    uploadedAt: '2026-09-18',
    status: 'VERIFIED',
    fileSize: '1.8 MB',
    referenceNumber: 'LS-2026-0442',
  },
  {
    id: 'doc-03',
    title: 'Commercial Real Estate Brokerage License',
    category: 'LICENSE',
    entityName: 'Bright Real Estate Co.',
    uploadedAt: '2026-09-17',
    status: 'PENDING',
    fileSize: '3.1 MB',
    referenceNumber: 'LIC-KRG-8891',
  },
  {
    id: 'doc-04',
    title: 'Property Management Agreement (PMA)',
    category: 'AGREEMENT',
    entityName: 'Shar Towers Complex',
    uploadedAt: '2026-09-10',
    status: 'VERIFIED',
    fileSize: '5.6 MB',
    referenceNumber: 'PMA-2026-102',
  },
];

export const AdminDocumentsModule: React.FC<AdminDocumentsModuleProps> = ({ onBack }) => {
  const { language, direction } = useI18n();
  const [docs, setDocs] = useState<DocumentRecord[]>(INITIAL_DOCS);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = (doc: DocumentRecord) => {
    setDownloadNotice(doc.referenceNumber);
    setTimeout(() => {
      setDownloadNotice(null);
    }, 3500);
  };

  const t = {
    ku: {
      title: 'بەڵگەنامە و گرێبەستە فەرمییەکان',
      subtitle: 'سەنەدی تاپۆ، گرێبەستی کرێ و مۆڵەتنامە بازرگانییەکان',
      back: 'گەڕانەوە',
      search: 'گەڕان بەپێی ناوی بەڵگەنامە یان ژمارەی فەرمی...',
      all: 'هەموو',
      tapu: 'سەنەدی تاپۆ',
      lease: 'گرێبەستی کرێ',
      license: 'مۆڵەتی بازرگانی',
      agreement: 'ڕێککەوتننامەی بەڕێوەبردن',
      verified: 'پەسەندکراو',
      pending: 'چاوەڕوان',
      expiring: 'بەسەرچوون نزیکە',
      viewDoc: 'بینینی بەڵگەنامە',
      download: 'داگرتن',
      close: 'داخستن',
    },
    ar: {
      title: 'الوثائق والعقود الرسمية',
      subtitle: 'سندات الطابو، عقود الإيجار الموثقة وتراخيص الشركات',
      back: 'رجوع',
      search: 'البحث باسم الوثيقة أو الرقم المرجعي...',
      all: 'الكل',
      tapu: 'سند الطابو',
      lease: 'عقد الإيجار',
      license: 'ترخيص تجاري',
      agreement: 'اتفاقية إدارة أملاك',
      verified: 'موثق ومعتمد',
      pending: 'قيد المراجعة',
      expiring: 'ينتهي قريباً',
      viewDoc: 'معاينة الوثيقة',
      download: 'تنزيل',
      close: 'إغلاق',
    },
    en: {
      title: 'Official Documents & Contracts',
      subtitle: 'Tapu title deeds, legal lease agreements, and commercial licenses',
      back: 'Back',
      search: 'Search by document title or reference number...',
      all: 'All',
      tapu: 'Tapu Deeds',
      lease: 'Lease Contracts',
      license: 'Licenses',
      agreement: 'Management Agreements',
      verified: 'Verified',
      pending: 'Pending',
      expiring: 'Expiring Soon',
      viewDoc: 'Preview Document',
      download: 'Download',
      close: 'Close',
    },
  }[language] || {
    title: 'Official Documents & Contracts',
    subtitle: 'Tapu title deeds, legal lease agreements, and commercial licenses',
    back: 'Back',
    search: 'Search by document title or reference number...',
    all: 'All',
    tapu: 'Tapu Deeds',
    lease: 'Lease Contracts',
    license: 'Licenses',
    agreement: 'Management Agreements',
    verified: 'Verified',
    pending: 'Pending',
    expiring: 'Expiring Soon',
    viewDoc: 'Preview Document',
    download: 'Download',
    close: 'Close',
  };

  const filtered = docs.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.entityName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4" dir={direction}>
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer mb-2"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{t.back}</span>
          </button>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{t.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
        </div>
      </div>

      {/* Search & Categories */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              activeCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.all}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('TAPU')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              activeCategory === 'TAPU'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.tapu}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('LEASE')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              activeCategory === 'LEASE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.lease}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('LICENSE')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              activeCategory === 'LICENSE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.license}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('AGREEMENT')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              activeCategory === 'AGREEMENT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.agreement}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <FileBadge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{doc.title}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{doc.entityName}</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    doc.status === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {doc.status === 'VERIFIED' ? t.verified : t.pending}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span>Ref: {doc.referenceNumber}</span>
                <span>{doc.fileSize}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setPreviewDoc(doc)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t.viewDoc}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload(doc)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.download}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Download Success Notice */}
      {downloadNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>داگرتنی دۆکیومێنت دەستیپێکرد ({downloadNotice})</span>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base text-slate-900">{previewDoc.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3 mb-4">
              <FileText className="w-12 h-12 text-purple-600 mx-auto" />
              <div className="font-bold text-sm text-slate-800">{previewDoc.entityName}</div>
              <div className="font-mono text-xs text-slate-500">Ref: {previewDoc.referenceNumber}</div>
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Officially Sealed & Digitally Verified
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

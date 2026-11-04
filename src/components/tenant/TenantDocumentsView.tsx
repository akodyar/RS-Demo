import React, { useState } from 'react';
import { FileText, Download, FolderOpen, ShieldCheck, Search } from 'lucide-react';
import { TenantDocumentItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast } from '../../components/ui/Toast';

interface TenantDocumentsViewProps {
  documents: TenantDocumentItem[];
  onDownloadDocument?: (doc: TenantDocumentItem) => void;
}

export const TenantDocumentsView: React.FC<TenantDocumentsViewProps> = ({
  documents,
  onDownloadDocument,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [filter, setFilter] = useState<'ALL' | 'LEASE' | 'INSPECTION' | 'RULES' | 'RECEIPT'>('ALL');

  const defaultDocs: TenantDocumentItem[] = documents;

  const filtered = filter === 'ALL' ? defaultDocs : defaultDocs.filter(d => d.category === filter);

  return (
    <div id="tenant-documents-view" className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            <span>{t('tenant.documentVault', 'Document Vault')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('tenant.documentVaultSubtitle', 'Secure, tamper-evident repository of your signed agreements, inspection reports, and official receipts.')}
          </p>
        </div>

        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{t('tenant.encryptedCloudStorage', 'Encrypted Cloud Storage')}</span>
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'LEASE', 'INSPECTION', 'RULES', 'RECEIPT'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filter === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat === 'ALL'
              ? t('tenant.allDocuments', 'All Documents')
              : cat === 'LEASE'
              ? t('tenant.docLease', 'Lease')
              : cat === 'INSPECTION'
              ? t('tenant.docInspection', 'Inspection')
              : cat === 'RULES'
              ? t('tenant.docRules', 'Rules')
              : t('tenant.docReceipt', 'Receipt')}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                  {doc.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {doc.fileType} • {doc.sizeFormatted} • {doc.date}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownloadDocument ? onDownloadDocument(doc) : showToast(`Downloading ${doc.title}...`, 'info')}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title={t('tenant.download', 'Download')}
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

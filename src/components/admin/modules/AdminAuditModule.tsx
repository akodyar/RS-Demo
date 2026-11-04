import React, { useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Filter,
  ArrowLeft,
  ArrowRight,
  Shield,
  Clock,
  User,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminAuditLogItem } from '../../../types/admin';

interface AdminAuditModuleProps {
  auditLogs: AdminAuditLogItem[];
  onBack: () => void;
}

export const AdminAuditModule: React.FC<AdminAuditModuleProps> = ({ auditLogs, onBack }) => {
  const { direction } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  const filteredLogs = auditLogs.filter((log) => {
    const targetEntity = log.targetEntity || log.resourceType || '';
    const actorName = log.actorName || log.actor || '';
    const details = log.details || log.reason || log.action || '';
    const targetId = log.targetId || log.resourceId || '';

    if (entityFilter !== 'all' && targetEntity !== entityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        details.toLowerCase().includes(q) ||
        targetId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homehub-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>تۆماری نەگۆڕی کارکردن و پشکنین (Audit Trail & Activity Log)</span>
            </h2>
            <p className="text-xs text-slate-500">
              تۆمارکردنی هەموو گۆڕانکاری، پەسەندکردن و دەستکارییەکانی سیستەم بە شێوازی نەگۆڕ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>داگرتنی ڕاپۆرت (Export)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="گەڕان بەپێی بەکارهێنەر، کردار، هۆکار..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {[
            { key: 'all', label: 'هەموو جۆرەکان' },
            { key: 'USER', label: 'بەکارهێنەر' },
            { key: 'COMPANY', label: 'کۆمپانیا' },
            { key: 'PROPERTY', label: 'موڵک' },
            { key: 'TRANSACTION', label: 'دارایی' },
            { key: 'SECURITY', label: 'ئاسایش' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setEntityFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                entityFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs divide-y divide-slate-100">
        {filteredLogs.map((log) => (
          <div key={log.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {log.action}
                </span>
                <span className="text-xs font-extrabold text-slate-800">{log.actorName || log.actor}</span>
                <span className="text-[10px] font-mono text-slate-400">({log.actorRole})</span>
              </div>

              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-300" />
                <span>{log.timestamp}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed pr-1">{log.details || log.reason || log.action}</p>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>
                ئامانج: <strong>{log.targetEntity || log.resourceType}</strong> ({log.targetId || log.resourceId})
              </span>
              <span className="font-mono text-[10px]">IP: {log.ipAddress}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Phone,
  Mail,
  Building,
  Key,
  Lock,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminUserRecord } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminUsersModuleProps {
  users: AdminUserRecord[];
  currentRole: AdminRoleType;
  onUpdateUserStatus: (userId: string, status: AdminUserRecord['status'], reason: string) => void;
  onUpdateUserRole: (userId: string, newRole: AdminUserRecord['role']) => void;
  onBack: () => void;
}

export const AdminUsersModule: React.FC<AdminUsersModuleProps> = ({
  users,
  currentRole,
  onUpdateUserStatus,
  onUpdateUserRole,
  onBack,
}) => {
  const { direction } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'suspend' | 'activate' | 'verify';
    user: AdminUserRecord | null;
  }>({ isOpen: false, action: 'suspend', user: null });
  const [actionReason, setActionReason] = useState('');

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  const filteredUsers = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q) ||
        (u.city || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleConfirmAction = () => {
    if (!confirmModal.user) return;
    if (confirmModal.action === 'suspend') {
      onUpdateUserStatus(confirmModal.user.id, 'suspended', actionReason || 'ڕاگرتن بە بڕیاری بەڕێوەبەر');
    } else if (confirmModal.action === 'activate') {
      onUpdateUserStatus(confirmModal.user.id, 'active', actionReason || 'چالاککردنەوە لەلایەن بەڕێوەبەر');
    } else if (confirmModal.action === 'verify') {
      onUpdateUserStatus(confirmModal.user.id, 'active', actionReason || 'پەسەندکردنی بەڵگەنامەکانی بەکارهێنەر');
    }
    setConfirmModal({ isOpen: false, action: 'suspend', user: null });
    setActionReason('');
    setSelectedUser(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="گەڕانەوە بۆ سەرەتا"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span>بەڕێوەبردنی بەکارهێنەران (Users Management)</span>
            </h2>
            <p className="text-xs text-slate-500">
              کۆی بەکارهێنەران: <strong className="text-slate-900">{users.length}</strong> کەس
            </p>
          </div>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>دەسەڵاتی تەنها بینین (Read-Only)</span>
          </div>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="گەڕان بەپێی ناو، ئیمەیڵ، مۆبایل، شار..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'all', label: 'هەموو' },
              { key: 'active', label: 'چالاک' },
              { key: 'pending', label: 'چاوەڕوانی' },
              { key: 'suspended', label: 'ڕاگیراو' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === f.key
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 font-black flex items-center justify-center border border-purple-100 shrink-0">
                    {((user.name || user.email || 'U').slice(0, 1)).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                      {user.name || user.email || 'بەکارهێنەر'}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500 dir-ltr block text-right">
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                {user.status === 'active' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>چالاک</span>
                  </span>
                )}
                {user.status === 'pending' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                    چاوەڕوان
                  </span>
                )}
                {user.status === 'suspended' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>ڕاگیراو</span>
                  </span>
                )}
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">ڕۆڵی پلاتفۆڕم:</span>
                  <strong className="text-slate-800 font-mono text-[11px]">{user.role}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">شار:</span>
                  <strong className="text-slate-800">{user.city}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">موڵکەکان:</span>
                  <strong className="text-slate-800">{user.propertiesCount} موڵک</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">دوایین چالاکی:</span>
                  <span className="text-slate-500">{user.lastActive}</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedUser(user)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                وردەکاری تەواو و مۆڵەتەکان
              </button>

              {!isReadOnly && (
                <div className="flex items-center gap-1.5">
                  {user.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ isOpen: true, action: 'suspend', user })}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] border border-rose-200 cursor-pointer"
                    >
                      ڕاگرتن
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ isOpen: true, action: 'activate', user })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                    >
                      چالاککردنەوە
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User Detail Bottom Sheet / Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  ناسنامە و دەسەڵاتەکانی بەکارهێنەر
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <p className="font-bold text-slate-800 text-sm">{selectedUser.name}</p>
                <p className="text-slate-500 font-mono dir-ltr text-right">{selectedUser.email}</p>
                <p className="text-slate-500 font-mono dir-ltr text-right">{selectedUser.phone}</p>
              </div>

              <div>
                <h5 className="font-bold text-slate-800 mb-1">مۆڵەتە چالاکەکان (Assigned Permissions):</h5>
                <div className="flex flex-wrap gap-1">
                  {(selectedUser.permissions || []).map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] border border-purple-100"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">تۆماری دروستبوون: {selectedUser.createdAt}</span>
                <span className="text-emerald-600 font-bold">
                  {selectedUser.verified ? 'بەڵگەنامەی فەرمی پشتڕاستکراوە' : 'چاوەڕوانی پشتڕاستکردنەوە'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.user && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">
                پشتڕاستکردنەوەی بڕیاری بەڕێوەبەر
              </h4>
            </div>

            <p className="text-xs text-slate-600">
              ئایا دڵنیایت لە گۆڕینی دۆخی هەژماری <strong>{confirmModal.user.name}</strong>؟ ئەم
              کردارە لە تۆماری ئاسایش (Audit Log) بە نەگۆڕی تۆمار دەکرێت.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">هۆکاری کردارەکە:</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="هۆکاری ڕاگرتن یان چالاککردن بنووسە..."
                className="w-full text-xs p-2 rounded-xl bg-slate-50 border border-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, action: 'suspend', user: null })}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
              >
                جێبەجێکردن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

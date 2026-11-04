import React, { useState } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileCheck,
  Building,
  Home,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface AdminNotificationItem {
  id: string;
  title: string;
  category: 'verification' | 'dispute' | 'security' | 'financial' | 'property';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  timestamp: string;
  source: string;
  isRead: boolean;
  targetModule: string;
  targetId?: string;
  details: string;
}

const INITIAL_NOTIFICATIONS: AdminNotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Dispute arbitration requires immediate review',
    category: 'dispute',
    severity: 'CRITICAL',
    timestamp: '10 min ago',
    source: 'Escrow Module',
    isRead: false,
    targetModule: 'messages',
    targetId: 'disp-01',
    details: 'Tenant and Landlord failed mutual agreement on deposit refund for Property #PR-4421.',
  },
  {
    id: 'notif-2',
    title: 'High-value lease transaction pending financial sign-off',
    category: 'financial',
    severity: 'WARNING',
    timestamp: '25 min ago',
    source: 'Finance Ledger',
    isRead: false,
    targetModule: 'finance',
    targetId: 'fin-02',
    details: 'Annual rent escrow release of 36,000,000 IQD awaiting dual administrative approval.',
  },
  {
    id: 'notif-3',
    title: 'New developer company license uploaded for verification',
    category: 'verification',
    severity: 'INFO',
    timestamp: '1 hour ago',
    source: 'Company Registrar',
    isRead: false,
    targetModule: 'companies',
    targetId: 'comp-01',
    details: 'Bright Real Estate Co. submitted commercial registration certificate #KRG-2024-889.',
  },
  {
    id: 'notif-4',
    title: 'Failed administrative login attempts detected',
    category: 'security',
    severity: 'CRITICAL',
    timestamp: '2 hours ago',
    source: 'Security Sentinel',
    isRead: true,
    targetModule: 'security',
    targetId: 'sec-01',
    details: 'Multiple failed password entries from unauthorized IP 185.190.22.44.',
  },
];

interface AdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (moduleKey: string, recordId?: string) => void;
  onUpdateUnreadCount?: (count: number) => void;
}

export const AdminNotificationsModal: React.FC<AdminNotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateModule,
  onUpdateUnreadCount,
}) => {
  const { language, direction } = useI18n();
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  if (!isOpen) return null;

  const t = {
    ku: {
      title: 'ناوەندی ئاگادارییەکانی ئەدمین',
      subtitle: 'ئاگادارییە هەستیارەکان، بڕیارە داواکراوەکان و ڕووداوەکان',
      all: 'هەموو',
      unread: 'نەخوێندراو',
      critical: 'هەستیار و کتوپڕ',
      markAllRead: 'دیاریکردنی هەموو وەک خوێندراوە',
      markRead: 'خوێندراوە',
      openRecord: 'بینینی ڕێکۆرد',
      noNotifs: 'هیچ ئاگادارییەک لەم بەشەدا نییە.',
      close: 'داخستن',
    },
    ar: {
      title: 'مركز إشعارات الإدارة',
      subtitle: 'التنبيهات العاجلة، القرارات المطلوبة وأحداث النظام',
      all: 'الكل',
      unread: 'غير مقروء',
      critical: 'حرج وعاجل',
      markAllRead: 'تحديد الكل كمقروء',
      markRead: 'تمت القراءة',
      openRecord: 'فتح السجل المرتبط',
      noNotifs: 'لا توجد إشعارات في هذا القسم.',
      close: 'إغلاق',
    },
    en: {
      title: 'Admin Notification Center',
      subtitle: 'Critical alerts, required decisions, and platform system events',
      all: 'All',
      unread: 'Unread',
      critical: 'Critical',
      markAllRead: 'Mark all as read',
      markRead: 'Mark read',
      openRecord: 'Open record',
      noNotifs: 'No notifications in this filter.',
      close: 'Close',
    },
  }[language] || {
    title: 'Admin Notification Center',
    subtitle: 'Critical alerts, required decisions, and platform system events',
    all: 'All',
    unread: 'Unread',
    critical: 'Critical',
    markAllRead: 'Mark all as read',
    markRead: 'Mark read',
    openRecord: 'Open record',
    noNotifs: 'No notifications in this filter.',
    close: 'Close',
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    const unread = updated.filter((n) => !n.isRead).length;
    onUpdateUnreadCount?.(unread);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    onUpdateUnreadCount?.(0);
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'critical') return n.severity === 'CRITICAL';
    return true;
  });

  const getSeverityBadge = (severity: AdminNotificationItem['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'INFO':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div
      id="admin-notifications-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      dir={direction}
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">{t.title}</h3>
              <p className="text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            id="btn-close-admin-notifications"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters & Bulk Action */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              id="btn-admin-notif-filter-all"
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.all}
            </button>
            <button
              id="btn-admin-notif-filter-unread"
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-all ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.unread}
            </button>
            <button
              id="btn-admin-notif-filter-critical"
              type="button"
              onClick={() => setFilter('critical')}
              className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-all ${
                filter === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.critical}
            </button>
          </div>

          <button
            id="btn-admin-mark-all-read"
            type="button"
            onClick={handleMarkAllAsRead}
            className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.markAllRead}</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              {t.noNotifs}
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.isRead
                    ? 'bg-white border-slate-200/80 opacity-80'
                    : 'bg-blue-50/40 border-blue-200/90 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getSeverityBadge(
                        item.severity
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">{item.source}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{item.timestamp}</span>
                  </div>
                </div>

                <h4 className="font-extrabold text-xs text-slate-900 leading-snug mb-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3">{item.details}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    id={`btn-admin-notif-open-${item.id}`}
                    type="button"
                    onClick={() => {
                      onNavigateModule(item.targetModule, item.targetId);
                      onClose();
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{t.openRecord}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {!item.isRead && (
                    <button
                      id={`btn-admin-notif-mark-read-${item.id}`}
                      type="button"
                      onClick={() => handleMarkAsRead(item.id)}
                      className="text-slate-500 hover:text-slate-800 font-semibold text-[11px] cursor-pointer"
                    >
                      {t.markRead}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

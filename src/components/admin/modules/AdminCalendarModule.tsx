import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  X,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';

interface AdminCalendarModuleProps {
  onBack: () => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: 'VIEWING' | 'INSPECTION' | 'DEADLINE' | 'HEARING';
  assignedTo: string;
  status: 'CONFIRMED' | 'PENDING' | 'URGENT';
}

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: 'Property Viewing with VIP Buyer',
    date: '2026-09-20',
    time: '11:00 AM',
    location: 'Skyline Residence Penthouse, Erbil',
    type: 'VIEWING',
    assignedTo: 'Ahmad Broker',
    status: 'CONFIRMED',
  },
  {
    id: 'ev-2',
    title: 'Post-Maintenance HVAC Final Inspection',
    date: '2026-09-20',
    time: '02:30 PM',
    location: 'Villa #12, Dream City, Erbil',
    type: 'INSPECTION',
    assignedTo: 'Soran Engineering Team',
    status: 'PENDING',
  },
  {
    id: 'ev-3',
    title: 'Ministry of Justice Tapu Registration Review',
    date: '2026-09-21',
    time: '10:00 AM',
    location: 'Directorate of Land Registry, Baghdad',
    type: 'DEADLINE',
    assignedTo: 'Legal Team',
    status: 'URGENT',
  },
  {
    id: 'ev-4',
    title: 'Escrow Security Deposit Arbitration Hearing',
    date: '2026-09-22',
    time: '04:00 PM',
    location: 'Platform Dispute Virtual Chamber',
    type: 'HEARING',
    assignedTo: 'Super Admin',
    status: 'CONFIRMED',
  },
];

export const AdminCalendarModule: React.FC<AdminCalendarModuleProps> = ({ onBack }) => {
  const { language, direction } = useI18n();
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const t = {
    ku: {
      title: 'ڕۆژژمێری چالاکی و سەردانەکان',
      subtitle: 'سەردانی موڵک، پشکنینی چاکسازی و وادەی کۆتایی گرێبەستەکان',
      back: 'گەڕانەوە',
      all: 'هەموو',
      viewing: 'سەردانی موڵک',
      inspection: 'پشکنینی ئەندازیاری',
      deadline: 'وادەی یاسایی',
      hearing: 'دانیشتنی دادوەری',
      confirmed: 'پشتڕاستکراو',
      pending: 'چاوەڕوان',
      urgent: 'کتوپڕ',
      addEvent: 'زیادکردنی کات',
    },
    ar: {
      title: 'تقويم المواعيد والعمليات',
      subtitle: 'معاينات العقارات، فحوصات الصيانة والمواعيد النهائية للتوثيق',
      back: 'رجوع',
      all: 'الكل',
      viewing: 'معاينة عقار',
      inspection: 'فحص هندسي',
      deadline: 'موعد قانوني نهائي',
      hearing: 'جلسة تحكيم ونزاع',
      confirmed: 'مؤكد',
      pending: 'قيد الانتظار',
      urgent: 'عاجل',
      addEvent: 'إضافة موعد',
    },
    en: {
      title: 'Operations & Events Calendar',
      subtitle: 'Property viewings, maintenance inspections, and regulatory deadlines',
      back: 'Back',
      all: 'All',
      viewing: 'Property Viewing',
      inspection: 'Engineering Inspection',
      deadline: 'Legal Deadline',
      hearing: 'Dispute Hearing',
      confirmed: 'Confirmed',
      pending: 'Pending',
      urgent: 'Urgent',
      addEvent: 'Schedule Event',
    },
  }[language] || {
    title: 'Operations & Events Calendar',
    subtitle: 'Property viewings, maintenance inspections, and regulatory deadlines',
    back: 'Back',
    all: 'All',
    viewing: 'Property Viewing',
    inspection: 'Engineering Inspection',
    deadline: 'Legal Deadline',
    hearing: 'Dispute Hearing',
    confirmed: 'Confirmed',
    pending: 'Pending',
    urgent: 'Urgent',
    addEvent: 'Schedule Event',
  };

  const filtered = events.filter((e) => selectedType === 'ALL' || e.type === selectedType);

  const getTypeBadge = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'VIEWING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'INSPECTION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DEADLINE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HEARING':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

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

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              selectedType === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.all}
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('VIEWING')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              selectedType === 'VIEWING' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.viewing}
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('INSPECTION')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              selectedType === 'INSPECTION' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.inspection}
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('DEADLINE')}
            className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
              selectedType === 'DEADLINE' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.deadline}
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.map((ev) => (
          <div
            key={ev.id}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getTypeBadge(ev.type)}`}>
                  {ev.type}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{ev.date} • {ev.time}</span>
                </div>
              </div>

              <h3 className="text-sm font-extrabold text-slate-900 leading-snug mb-1.5">{ev.title}</h3>

              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="line-clamp-1">{ev.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{ev.assignedTo}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold">
              <span
                className={`text-[11px] font-bold ${
                  ev.status === 'URGENT'
                    ? 'text-rose-600'
                    : ev.status === 'CONFIRMED'
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                ● {ev.status}
              </span>
              <button
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className="text-blue-600 hover:text-blue-700 cursor-pointer font-bold"
              >
                پشکنینی کات (Manage)
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">وردەکاری کاتی دیاریکراو</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">بابەت / چالاکی</span>
                <p className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedEvent.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">بەروار و کات:</span>
                  <p className="font-mono font-bold text-slate-800">{selectedEvent.date} • {selectedEvent.time}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">دۆخ:</span>
                  <p className="font-bold text-blue-600">{selectedEvent.status}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold block">شوێن:</span>
                <p className="font-medium text-slate-700 mt-0.5">{selectedEvent.location}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold block">بەرپرسیار:</span>
                <p className="font-medium text-slate-700 mt-0.5">{selectedEvent.assignedTo}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                تێبینی: ئەم خشتەیە تەنها لەناو پلاتفۆرمی هۆمهەب تۆمار کراوە و بەبێ بەستنەوەی ڕاستەوخۆ بە ڕۆژژمێری گووگڵ (Google Calendar) هاوکات ناکرێت.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

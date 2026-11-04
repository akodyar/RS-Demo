import React, { useState, useEffect } from 'react';
import { FileText, CreditCard, Wrench, MessageSquare, MapPin, CheckCircle, Camera, X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { TenantPropertySummary } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantCurrentHomeCardProps {
  property: TenantPropertySummary | null;
  onNavigateTab: (tab: 'lease' | 'payments' | 'maintenance' | 'messages') => void;
  onPayRent: () => void;
}

export const TenantCurrentHomeCard: React.FC<TenantCurrentHomeCardProps> = ({
  property,
  onNavigateTab,
  onPayRent,
}) => {
  const { t, direction } = useI18n();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (!galleryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGalleryOpen(false);
      if (e.key === 'ArrowRight') {
        direction === 'rtl' ? handlePrev() : handleNext();
      }
      if (e.key === 'ArrowLeft') {
        direction === 'rtl' ? handleNext() : handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, direction, activePhotoIdx]);

  if (!property) {
    return (
      <div id="tenant-current-home-card" className="bg-[#0c1322] rounded-2xl border border-slate-800 p-8 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-amber-400">
          <MapPin className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">
          {t('tenant.noActiveLeaseTitle', 'No Active Property Lease')}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {t('tenant.noActiveLeaseDesc', 'You do not have an active tenancy agreement linked to your account.')}
        </p>
      </div>
    );
  }

  const title = property.unitNumber ? `${property.unitNumber}, ${property.name}` : property.name;
  const address = `${property.address}, ${property.city}`;
  const rawPhotos = Array.isArray(property.photos) && property.photos.length > 0 ? property.photos : (property.imageUrl ? [property.imageUrl] : []);
  const photos = rawPhotos.filter(Boolean);
  const imageUrl = photos[0] || property.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
  const isActive = property.leaseStatus === 'ACTIVE' || property.leaseStatus === 'EXPIRING';

  const handleNext = () => {
    if (photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev + 1) % photos.length);
  };

  const handlePrev = () => {
    if (photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <div id="tenant-current-home-card" className="bg-[#0c1322] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
      {/* Property Hero Image with Overlay */}
      <div className="relative h-48 sm:h-56 w-full bg-slate-900 overflow-hidden group">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105 cursor-pointer"
          referrerPolicy="no-referrer"
          onClick={() => {
            if (photos.length > 0) {
              setActivePhotoIdx(0);
              setGalleryOpen(true);
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent pointer-events-none" />
        
        {/* Top Badges Row */}
        <div className="absolute top-3.5 start-3.5 end-3.5 flex items-center justify-between pointer-events-none">
          {/* Active Lease Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/90 text-white backdrop-blur-xs shadow-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            {isActive ? t('tenant.activeLease', 'Active Lease') : t('tenant.pendingLease', 'Pending Lease')}
          </span>

          {/* Photo count button */}
          {photos.length > 0 && (
            <button
              id="tenant-view-photos-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePhotoIdx(0);
                setGalleryOpen(true);
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-md transition-all hover:scale-105 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('tenant.viewPhotos', 'View Photos')}</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                {photos.length}
              </span>
            </button>
          )}
        </div>

        {/* Title & Address on bottom of image */}
        <div className="absolute bottom-3.5 start-4 end-4 text-white">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug drop-shadow-xs truncate">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 flex items-center gap-1.5 mt-0.5 font-medium drop-shadow-xs truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{address}</span>
              </p>
            </div>
            {photos.length > 1 && (
              <span className="text-[11px] font-bold text-slate-300/90 hidden sm:inline-flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md backdrop-blur-xs">
                <ImageIcon className="w-3 h-3 text-blue-400" />
                {photos.length} {t('property.photos', 'Photos')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {galleryOpen && photos.length > 0 && (
        <div 
          id="tenant-photo-lightbox"
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setGalleryOpen(false)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between text-white pb-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-blue-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <p className="text-xs text-slate-400">
                  {t('tenant.photoOf', 'Photo {current} of {total}')
                    .replace('{current}', String(activePhotoIdx + 1))
                    .replace('{total}', String(photos.length))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline-block px-2 py-1 bg-white/5 rounded-md border border-white/10 font-mono">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo Viewing Stage */}
          <div 
            className="relative flex-1 flex items-center justify-center py-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[activePhotoIdx]}
              alt={`${title} - ${activePhotoIdx + 1}`}
              className="max-h-[65vh] sm:max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
              referrerPolicy="no-referrer"
            />

            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute start-2 sm:start-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-md transition-transform hover:scale-110 cursor-pointer"
                  aria-label={t('tenant.previousPhoto', 'Previous Photo')}
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute end-2 sm:end-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-md transition-transform hover:scale-110 cursor-pointer"
                  aria-label={t('tenant.nextPhoto', 'Next Photo')}
                >
                  <ChevronRight className="w-6 h-6 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {photos.length > 1 && (
            <div 
              className="pt-3 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto max-w-full py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.map((photo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer ${
                    activePhotoIdx === idx
                      ? 'ring-2 ring-blue-500 scale-105 shadow-md shadow-blue-500/30'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-white text-[9px] font-bold text-center py-0.5 leading-none">
                      Cover
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4 Action Buttons Strip */}
      <div className="grid grid-cols-4 divide-x rtl:divide-x-reverse divide-slate-800 border-t border-slate-800 bg-[#080d19]/90">
        <button
          id="home-action-my-lease"
          type="button"
          onClick={() => onNavigateTab('lease')}
          className="py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <FileText className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold truncate max-w-full">
            {t('tenant.myLease', 'My Lease')}
          </span>
        </button>

        <button
          id="home-action-pay-rent"
          type="button"
          onClick={onPayRent}
          className="py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <CreditCard className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold truncate max-w-full">
            {t('tenant.payRent', 'Pay Rent')}
          </span>
        </button>

        <button
          id="home-action-maintenance"
          type="button"
          onClick={() => onNavigateTab('maintenance')}
          className="py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <Wrench className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-bold truncate max-w-full">
            {t('tenant.maintenance', 'Maintenance')}
          </span>
        </button>

        <button
          id="home-action-contact"
          type="button"
          onClick={() => onNavigateTab('messages')}
          className="py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-bold truncate max-w-full">
            {t('tenant.contact', 'Contact')}
          </span>
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Star, X, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast } from '../ui/Toast';
import { useAuth } from '../AuthProvider';
import { PropertyReview } from '../../types/review';

interface TenantPropertyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  existingReview?: PropertyReview | null;
  onSuccess: (review: PropertyReview) => void;
}

export const TenantPropertyReviewModal: React.FC<TenantPropertyReviewModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  existingReview,
  onSuccess,
}) => {
  const { t, direction } = useI18n();
  const { showToast } = useToast();
  const { token } = useAuth();

  const [rating, setRating] = useState<number>(existingReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [cleanlinessRating, setCleanlinessRating] = useState<number | undefined>(existingReview?.cleanlinessRating || undefined);
  const [maintenanceRating, setMaintenanceRating] = useState<number | undefined>(existingReview?.maintenanceRating || undefined);
  const [communicationRating, setCommunicationRating] = useState<number | undefined>(existingReview?.communicationRating || undefined);
  const [locationRating, setLocationRating] = useState<number | undefined>(existingReview?.locationRating || undefined);
  const [title, setTitle] = useState<string>(existingReview?.title || '');
  const [comment, setComment] = useState<string>(existingReview?.comment || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setCleanlinessRating(existingReview.cleanlinessRating || undefined);
      setMaintenanceRating(existingReview.maintenanceRating || undefined);
      setCommunicationRating(existingReview.communicationRating || undefined);
      setLocationRating(existingReview.locationRating || undefined);
      setTitle(existingReview.title || '');
      setComment(existingReview.comment || '');
    } else {
      setRating(5);
      setCleanlinessRating(undefined);
      setMaintenanceRating(undefined);
      setCommunicationRating(undefined);
      setLocationRating(undefined);
      setTitle('');
      setComment('');
    }
    setErrorMessage(null);
  }, [existingReview, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (rating < 1 || rating > 5) {
      setErrorMessage(t('reviews.invalidRating', 'Please select an overall rating between 1 and 5 stars.'));
      return;
    }

    if (!comment.trim() || comment.trim().length < 5) {
      setErrorMessage(t('reviews.commentMinLength', 'Review comment must be at least 5 characters long.'));
      return;
    }

    if (comment.trim().length > 2000) {
      setErrorMessage(t('reviews.commentMaxLength', 'Review comment cannot exceed 2000 characters.'));
      return;
    }

    setIsSubmitting(true);

    try {
      const url = existingReview
        ? `/api/reviews/${existingReview.id}`
        : '/api/reviews/properties';
      const method = existingReview ? 'PATCH' : 'POST';

      const payload = {
        propertyId,
        rating,
        cleanlinessRating: cleanlinessRating || undefined,
        maintenanceRating: maintenanceRating || undefined,
        communicationRating: communicationRating || undefined,
        locationRating: locationRating || undefined,
        title: title.trim() || undefined,
        comment: comment.trim(),
      };

      const effectiveToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('token') ||
            localStorage.getItem('homehub_auth_token') ||
            localStorage.getItem('auth_token')
          : '');

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken || ''}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit review');
      }

      showToast(
        existingReview
          ? t('reviews.updateSuccess', 'Your review has been updated.')
          : t('reviews.submitSuccess', 'Thank you! Your review has been published.'),
        'success'
      );

      onSuccess(data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while saving your review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarSelector = (
    currentVal: number,
    onSelect: (v: number) => void,
    onHover?: (v: number | null) => void,
    hoverVal?: number | null
  ) => {
    const displayVal = hoverVal ?? currentVal;
    return (
      <div className="flex items-center gap-1.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 rounded-lg hover:bg-amber-400/10 text-amber-400 focus:outline-none transition-transform hover:scale-115 cursor-pointer"
            onClick={() => onSelect(star)}
            onMouseEnter={() => onHover && onHover(star)}
            onMouseLeave={() => onHover && onHover(null)}
            aria-label={`${star} stars`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= displayVal
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                  : 'text-slate-700 fill-slate-800/60'
              }`}
            />
          </button>
        ))}
        <span className="ms-2 text-sm font-black text-amber-400">
          {displayVal} / 5
        </span>
      </div>
    );
  };

  const renderSubRating = (
    label: string,
    val: number | undefined,
    onChange: (v: number) => void
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 py-2 border-b border-slate-800/70 last:border-0">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <div className="flex items-center gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 rounded text-amber-400 hover:scale-115 transition-transform cursor-pointer"
            onClick={() => onChange(star)}
            aria-label={`${label} ${star} stars`}
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                val && star <= val
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]'
                  : 'text-slate-700 fill-slate-800/60'
              }`}
            />
          </button>
        ))}
        {val && <span className="text-[11px] font-bold text-amber-400 ms-1">{val}</span>}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0C1322] rounded-3xl shadow-2xl border border-slate-800 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8 text-slate-100"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {existingReview
                  ? t('reviews.editTitle', 'Edit Your Review')
                  : t('reviews.newTitle', 'Rate & Review Property')}
              </h3>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[280px]">
                {propertyName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white border border-slate-700/60 flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Overall Rating */}
          <div className="p-4 rounded-2xl bg-[#070B14] border border-slate-800 space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-amber-400/90">
              {t('reviews.overallRating', 'Overall Rating')} <span className="text-rose-400">*</span>
            </label>
            {renderStarSelector(rating, setRating, setHoverRating, hoverRating)}
          </div>

          {/* Detailed Aspect Ratings (Expandable) */}
          <div className="p-4 rounded-2xl bg-[#070B14]/80 border border-slate-800/80 space-y-1">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              {t('reviews.aspectRatings', 'Aspect Ratings (Optional)')}
            </label>
            {renderSubRating(t('reviews.cleanliness', 'Cleanliness & Upkeep'), cleanlinessRating, setCleanlinessRating)}
            {renderSubRating(t('reviews.maintenance', 'Maintenance Responsiveness'), maintenanceRating, setMaintenanceRating)}
            {renderSubRating(t('reviews.communication', 'Landlord / Management Communication'), communicationRating, setCommunicationRating)}
            {renderSubRating(t('reviews.location', 'Location & Neighborhood'), locationRating, setLocationRating)}
          </div>

          {/* Title (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              {t('reviews.headline', 'Review Headline')} <span className="text-slate-500 font-normal">({t('common.optional', 'Optional')})</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('reviews.headlinePlaceholder', 'e.g. Quiet neighborhood, excellent management')}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-[#070B14] text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all"
            />
          </div>

          {/* Written Comment */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300">
                {t('reviews.feedback', 'Your Honest Experience')} <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {comment.length} / 2000
              </span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reviews.feedbackPlaceholder', 'Share details about the property condition, building amenities, utilities, noise levels, and overall living experience...')}
              rows={4}
              maxLength={2000}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-[#070B14] text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all resize-none"
            />
          </div>

          {/* Privacy Note */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {t('reviews.privacyNotice', 'HomeHub enforces verified reviews. Your review will be published as a Verified Resident with your name abbreviated to protect your privacy.')}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('common.saving', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {existingReview
                      ? t('reviews.updateReviewBtn', 'Update Review')
                      : t('reviews.publishReviewBtn', 'Publish Review')}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

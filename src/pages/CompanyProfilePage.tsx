import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Home,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Building
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider.js';
import { FeatureFlags } from '../utils/featureFlags.js';
import { LanguageSelector } from '../components/onboarding/LanguageSelector.js';

interface CompanyProfile {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: any;
  serviceCategories: string[] | null;
  status: string;
}

interface Listing {
  id: string;
  type: string;
  title: string;
  price: number;
  currency: string;
  property: {
    address: any;
    type: string;
    imageUrl: string;
  };
}

export const CompanyProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { language, direction, t } = useI18n();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [saleListings, setSaleListings] = useState<Listing[]>([]);
  const [rentListings, setRentListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Company Profile
        const profileRes = await fetch(`/api/marketplace/companies/${id}`);
        if (!profileRes.ok) throw new Error(t('company.not_found'));
        const profileData = await profileRes.json();
        setCompany(profileData);

        // Fetch SALE Listings only if enabled
        if (FeatureFlags.BUY_SELL_ENABLED) {
          const salesRes = await fetch(`/api/marketplace/companies/${id}/listings?type=SALE`);
          if (salesRes.ok) {
            const salesData = await salesRes.json();
            setSaleListings(salesData.items || []);
          }
        }

        // Fetch RENT Listings
        const rentsRes = await fetch(`/api/marketplace/companies/${id}/listings?type=RENT`);
        if (rentsRes.ok) {
          const rentsData = await rentsRes.json();
          setRentListings(rentsData.items || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, t]);

  const BackArrow = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const isRtl = direction === 'rtl';

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#070B14] flex items-center justify-center p-6 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
        <div className="bg-[#0C1322] p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-10 h-10 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 font-medium text-sm">{t('company.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className={`min-h-screen bg-[#070B14] flex items-center justify-center p-6 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
        <div className="bg-[#0C1322] p-8 rounded-2xl border border-rose-900/60 shadow-xl flex flex-col items-center gap-4 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-rose-950 text-rose-400 border border-rose-800/60 flex items-center justify-center font-bold text-xl">!</div>
          <p className="text-rose-300 font-semibold text-base">{t('company.error_prefix')} {error || t('company.not_found')}</p>
          <Link
            to="/rent"
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium border border-slate-700 transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            <span>{t('company.back_to_marketplace')}</span>
          </Link>
        </div>
      </div>
    );
  }

  const cityDisplay = company.address?.city || t('company.city_fallback');
  const countryDisplay = company.address?.neighborhood || t('company.country_fallback');

  return (
    <div className={`bg-[#070B14] text-slate-100 min-h-screen pb-16 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Utility Bar */}
      <div className="bg-[#0C1322]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            to="/rent"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-[#D4AF37] transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            <span>{t('company.back_to_marketplace')}</span>
          </Link>
          <LanguageSelector variant="dark" />
        </div>
      </div>

      {/* Company Hero Header */}
      <div className="bg-gradient-to-b from-[#0C1322] to-[#070B14] border-b border-slate-800/80 py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-[#111B2E] to-[#1E293B] border-2 border-[#D4AF37]/40 text-[#D4AF37] rounded-3xl flex items-center justify-center shadow-lg shrink-0">
              <Building2 className="w-12 h-12 sm:w-14 sm:h-14" />
            </div>

            <div className="text-center sm:text-start flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{company.name}</h1>
                {company.status === 'VERIFIED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 rounded-full text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('company.verified_badge')}</span>
                  </span>
                )}
              </div>

              <p className="text-slate-400 mt-2.5 flex items-center justify-center sm:justify-start gap-1.5 text-sm sm:text-base">
                <MapPin className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                <span>{cityDisplay}, {countryDisplay}</span>
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                {company.phone && (
                  <a
                    href={`tel:${company.phone}`}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-200 bg-[#111B2E] hover:bg-slate-800 border border-slate-700/80 px-3.5 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span dir="ltr">{company.phone}</span>
                  </a>
                )}
                {company.email && (
                  <a
                    href={`mailto:${company.email}`}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-200 bg-[#111B2E] hover:bg-slate-800 border border-slate-700/80 px-3.5 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span dir="ltr">{company.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-12">
        {/* Properties For Sale Section */}
        {FeatureFlags.BUY_SELL_ENABLED && (
          <section>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                <Home className="w-6 h-6 text-[#D4AF37]" />
                <span>{t('company.for_sale_title')}</span>
              </h2>
              <span className="text-xs sm:text-sm font-semibold text-slate-400 bg-[#111B2E] border border-slate-800 px-3 py-1 rounded-full">
                <span dir="ltr">{saleListings.length}</span> {t('company.listings_count')}
              </span>
            </div>

            {saleListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {saleListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-[#0C1322] rounded-2xl shadow-md hover:shadow-xl border border-slate-800 hover:border-slate-700 overflow-hidden transition-all duration-200 flex flex-col"
                  >
                    <div className="aspect-[16/10] bg-[#111B2E] relative overflow-hidden">
                      {listing.property.imageUrl ? (
                        <img
                          src={listing.property.imageUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 bg-[#111B2E]">
                          <Home className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-3 end-3 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-sm tracking-wide">
                        {t('company.badge_for_sale')}
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-base sm:text-lg text-white line-clamp-1 mb-1.5">{listing.title}</h3>
                        <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-1.5 mb-4">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span>{listing.property.address?.neighborhood || countryDisplay}, {listing.property.address?.city || cityDisplay}</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <div className="font-black text-lg sm:text-xl text-[#D4AF37]">
                          <span dir="ltr">{listing.price.toLocaleString()} {listing.currency}</span>
                        </div>
                        <Link
                          to="/rent"
                          className="text-[#D4AF37] hover:text-[#E5C158] text-xs sm:text-sm font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>{t('company.view_details')}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4 bg-[#0C1322]/60 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-sm">
                {t('company.no_sales')}
              </div>
            )}
          </section>
        )}

        {/* Properties For Rent Section */}
        <section>
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-[#D4AF37]" />
              <span>{t('company.for_rent_title')}</span>
            </h2>
            <span className="text-xs sm:text-sm font-semibold text-slate-400 bg-[#111B2E] border border-slate-800 px-3 py-1 rounded-full">
              <span dir="ltr">{rentListings.length}</span> {t('company.listings_count')}
            </span>
          </div>

          {rentListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-[#0C1322] rounded-2xl shadow-md hover:shadow-xl border border-slate-800 hover:border-slate-700 overflow-hidden transition-all duration-200 flex flex-col"
                >
                  <div className="aspect-[16/10] bg-[#111B2E] relative overflow-hidden">
                    {listing.property.imageUrl ? (
                      <img
                        src={listing.property.imageUrl}
                        alt={listing.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 bg-[#111B2E]">
                        <Building className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute top-3 end-3 bg-[#D4AF37] text-slate-950 text-[11px] font-black px-3 py-1 rounded-full shadow-sm tracking-wide">
                      {t('company.badge_for_rent')}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-white line-clamp-1 mb-1.5">{listing.title}</h3>
                      <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-1.5 mb-4">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>{listing.property.address?.neighborhood || countryDisplay}, {listing.property.address?.city || cityDisplay}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div className="font-black text-lg sm:text-xl text-[#D4AF37] flex items-baseline gap-1">
                        <span dir="ltr">{listing.price.toLocaleString()} {listing.currency}</span>
                        <span className="text-xs sm:text-sm font-medium text-slate-400">{t('company.per_month')}</span>
                      </div>
                      <Link
                        to="/rent"
                        className="text-[#D4AF37] hover:text-[#E5C158] text-xs sm:text-sm font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <span>{t('company.view_details')}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-[#0C1322]/60 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-sm">
              {t('company.no_rentals')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

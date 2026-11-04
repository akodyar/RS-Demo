import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  ShieldCheck,
  Award,
  Clock,
  DollarSign,
  Search,
  MapPin,
  CheckCircle2,
  Sparkles,
  Layers,
  Shield,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Phone,
  SlidersHorizontal,
  Home
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export const ServicesPage: React.FC = () => {
  const { t, language, direction } = useI18n();
  const [searchParams] = useSearchParams();

  const [selectedCity, setSelectedCity] = useState<string>(searchParams.get('city') || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const city = searchParams.get('city');
    const q = searchParams.get('q');
    if (city) setSelectedCity(city);
    if (q !== null && q !== undefined) setSearchQuery(q);
  }, [searchParams]);

  const getLoc = (ku: string, en: string, ar: string) => {
    if (language === 'ku') return ku || en;
    if (language === 'ar') return ar || en;
    return en;
  };

  // The 8 Authentic HomeHub Vendor Categories
  const categories = [
    {
      id: 'hvac',
      titleKu: 'گەرمکەرەوە و فێنککەرەوە (HVAC)',
      titleEn: 'HVAC & Cooling Systems',
      titleAr: 'التكييف والتهوية (HVAC)',
      descKu: 'چاککردنەوەی سپلیت، گازی ساردکەرەوە، و دڵنیابوون لە هەواگۆڕکێ بە بەرزترین ستاندارد.',
      descEn: 'AC split diagnostics, freon gas refilling, duct cleaning, and central air ventilation maintenance.',
      descAr: 'صيانة مكيفات السبلت، شحن الغاز، وتنظيف الدكتات والتهوية والتكييف المركزي.',
      icon: Sparkles,
      iconColor: 'text-sky-600 bg-sky-50 border-sky-200'
    },
    {
      id: 'plumbing',
      titleKu: 'بۆڕیکاری و ئاوەڕۆ',
      titleEn: 'Plumbing & Water Systems',
      titleAr: 'تأسيسات المياه والصرف الصحي',
      descKu: 'تەئسیساتی ئاو، سیستەمی ئاوەڕۆ، پەمپی بەرزکەرەوە و چارەسەری دەستبەجێی دزەکردنی ئاو.',
      descEn: 'Pipe repairs, drainage leaks, water pressure pumps, filtration units, and sanitary fixtures.',
      descAr: 'تصليح تسريبات المياه، مضخات الضغط، صيانة السخانات وشبكات الصرف الصحي المنزلية.',
      icon: Wrench,
      iconColor: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      id: 'electrical',
      titleKu: 'کارەبا و مۆلیدە',
      titleEn: 'Electrical & Generators',
      titleAr: 'الكهرباء والمولدات',
      descKu: 'چارەسەری شۆرت، بۆردی سەرەکی دابەشکردن، سویچ و پلاک، بەستنی سیستەمی گۆڕینی مۆلیدە.',
      descEn: 'Breaker panels, electrical shorts, generator ATS changeover switches, rewiring, and lighting.',
      descAr: 'لوحات القواطع الكهربائية، صيانة الشورت، أجهزة التحويل الذكية للمولدات، وتمديدات الإنارة.',
      icon: Layers,
      iconColor: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      id: 'painting',
      titleKu: 'بۆیاخ و دیکۆرات',
      titleEn: 'Painting & Interior Decor',
      titleAr: 'الدهان والديكور الداخلي',
      descKu: 'بۆیاخی ناوەوە و دەرەوەی بینا، دیوارپۆش، گەچکاری، و دیکۆراتی مۆدێرن بە بۆیاخی کوالیتی بەرز.',
      descEn: 'Interior and exterior wall painting, wallpaper installation, plastering, and modern decorative finishes.',
      descAr: 'طلاء الجدران الداخلي والخارجي، تركيب ورق الجدران، أعمال الجبس والديكورات الحديثة.',
      icon: Sparkles,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      id: 'cleaning',
      titleKu: 'پاککردنەوەی گشتی و قووڵ',
      titleEn: 'Deep Cleaning & Sanitization',
      titleAr: 'التنظيف العميق والتعقيم',
      descKu: 'پاککردنەوەی قووڵی شوقە و ڤێلا پێش نیشتەجێبوون یان پاش دەرچوونی کرێنشین بە ئامێری پێشکەوتوو.',
      descEn: 'Comprehensive deep cleaning for villas and apartments upon lease move-in or move-out inspections.',
      descAr: 'خدمات التنظيف الشامل للفلل والشقق عند استلام أو تسليم العقار باستخدام أجهزة حديثة.',
      icon: ShieldCheck,
      iconColor: 'text-teal-600 bg-teal-50 border-teal-200'
    },
    {
      id: 'general_maintenance',
      titleKu: 'چاکسازیی گشتی و بیناسازی',
      titleEn: 'General Maintenance & Handyman',
      titleAr: 'الصيانة العامة وأعمال الترميم',
      descKu: 'چاککردنەوەی دەرگا و پەنجەرەی ئەلەمنیۆم، دارتاشی، کێشەی قفڵ، و چاکسازییە خێراکان.',
      descEn: 'Carpentry, aluminum doors and windows, locksmith repairs, ceiling tiles, and emergency handyman tasks.',
      descAr: 'أعمال النجارة، صيانة أبواب وشبابيك الألمنيوم، الأقفال، والإصلاحات السريعة المتنوعة.',
      icon: Wrench,
      iconColor: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      id: 'elevators',
      titleKu: 'ئەسانسۆر و بەرزکەرەوە',
      titleEn: 'Elevator & Lift Systems',
      titleAr: 'المصاعد وأنظمة الرفع',
      descKu: 'پشکنینی مانگانەی ئەسانسۆر، گۆڕینی کێبڵ، دڵنیابوون لە سیستەمی بێخەبەری و ڕزگارکردنی لەناکاو.',
      descEn: 'Routine lift safety inspections, motor diagnostics, emergency backup descent, and scheduled maintenance.',
      descAr: 'فحص دوري للمصاعد، صيانة المحركات، واختبار أنظمة النزول الاضطراري للسلامة العامة.',
      icon: Layers,
      iconColor: 'text-cyan-600 bg-cyan-50 border-cyan-200'
    },
    {
      id: 'security',
      titleKu: 'سیستەمی چاودێری و ئاسایش',
      titleEn: 'Security Systems & CCTV',
      titleAr: 'أنظمة المراقبة والأمان',
      descKu: 'بەستنی کامێرای چاودێری، سیستەمی دەرگای ئەلیکترۆنی، زەنگی ئاگر، و ئینتەرکۆم بە پەیوەندی زیرەک.',
      descEn: 'CCTV installation, smart electronic access control, video intercoms, and fire alarm integration.',
      descAr: 'تركيب كاميرات المراقبة، أجهزة الإنتركم الذكية، أنظمة التحكم بالدخول، وأجهزة إنذار الحريق.',
      icon: Shield,
      iconColor: 'text-rose-600 bg-rose-50 border-rose-200'
    }
  ];

  const filteredCategories = categories.filter((cat) => {
    if (selectedCategory !== 'all' && cat.id !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKu = cat.titleKu.toLowerCase().includes(q) || cat.descKu.toLowerCase().includes(q);
      const matchEn = cat.titleEn.toLowerCase().includes(q) || cat.descEn.toLowerCase().includes(q);
      const matchAr = cat.titleAr.toLowerCase().includes(q) || cat.descAr.toLowerCase().includes(q);
      if (!matchKu && !matchEn && !matchAr) return false;
    }
    return true;
  });

  return (
    <div dir={direction} className={`w-full min-h-screen bg-[#070b14] text-white ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`}>
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#070b14] via-[#0c1322] to-[#070b14] text-white pt-12 pb-20 sm:pb-28 border-b border-amber-500/20">
        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-md text-xs sm:text-sm font-bold">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>{getLoc('خزمەتگوزاریی سێیەم: سێرڤس و خزمەتگوزاری موڵک', 'Core Service 3: Property Services & Maintenance', 'الخدمة الأساسية الثالثة: خدمات وصيانة العقارات')}</span>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[11px] ms-1">
              {getLoc('وەستای پەسەندکراو', 'Verified Pros', 'فنيون معتمدون')}
            </span>
          </div>

          {/* Headline */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
              {getLoc('سێرڤس و خزمەتگوزاریی پیشەیی موڵک', 'Property Services & Verified Maintenance', 'خدمات وصيانة العقارات المعتمدة')}
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              {getLoc(
                'تۆڕی بەڵێندەر و وەستایانی پسپۆڕ بۆ سپلیت، کارەبا، بۆڕیکاری، دیکۆرات و پاراستنی بەردەوامی موڵکەکەت بە مەرج و گەرەنتی.',
                'Trusted network of verified technicians for AC cooling, electrical, plumbing, painting, deep cleaning, and property maintenance.',
                'شبكة موثوقة من الفنيين والمقاولين المعتمدين لصيانة التكييف، الكهرباء، السباكة، الدهان، والتنظيف الشامل للعقار.'
              )}
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#0c1322]/95 backdrop-blur-xl rounded-3xl p-4 sm:p-6 shadow-2xl border border-amber-500/30 max-w-4xl mx-auto text-white">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              
              {/* City selector */}
              <div className="sm:col-span-4 relative">
                <MapPin className={`w-4 h-4 text-amber-400 absolute top-3.5 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className={`w-full h-11 bg-[#080d19] border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500/50 ${
                    direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                >
                  <option value="all" className="bg-[#0c1322] text-white">{getLoc('هەموو شارەکان', 'All Cities', 'كافة المدن')}</option>
                  <option value="Erbil" className="bg-[#0c1322] text-white">هەولێر (Erbil)</option>
                  <option value="Sulaymaniyah" className="bg-[#0c1322] text-white">سلێمانی (Sulaymaniyah)</option>
                  <option value="Duhok" className="bg-[#0c1322] text-white">دهۆک (Duhok)</option>
                  <option value="Baghdad" className="bg-[#0c1322] text-white">بەغداد (Baghdad)</option>
                </select>
              </div>

              {/* Service query */}
              <div className="sm:col-span-5 relative">
                <Search className={`w-4 h-4 text-amber-400 absolute top-3.5 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={getLoc('گەڕان بۆ سپلیت، کارەبا، بۆڕیکاری، دیکۆرات...', 'Search AC cooling, electrical, plumbing, painting...', 'ابحث عن صيانة سبلت، كهرباء، سباكة، دهان...')}
                  className={`w-full h-11 bg-[#080d19] border border-slate-800 rounded-xl text-xs sm:text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 ${
                    direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>

              {/* Category filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-11 bg-[#080d19] border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-white px-3 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="all" className="bg-[#0c1322] text-white">{getLoc('هەموو بوارەکان', 'All Categories', 'كافة التخصصات')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0c1322] text-white">
                      {getLoc(c.titleKu, c.titleEn, c.titleAr)}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Quick Stats / Action Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/tenant/maintenance/new"
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{getLoc('ناردنی داواکاریی چاکسازی', 'Submit Maintenance Request', 'تقديم طلب صيانة')}</span>
              <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            </Link>

            <Link
              to="/workspace/vendor"
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-[#080d19] hover:bg-[#111b2e] active:scale-95 text-white font-bold text-sm transition-all border border-slate-800 hover:border-amber-500/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>{getLoc('پۆرتاڵی وەستا و بەڵێندەر', 'Join as Verified Contractor', 'بوابة الفنيين والمقاولين')}</span>
            </Link>
          </div>

        </div>
      </section>

      {/* 8 Authentic Vendor Categories Grid */}
      <section className="py-16 sm:py-24 border-b border-slate-800 bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-start">
            <div className="space-y-1.5">
              <span className="text-xs uppercase font-black tracking-wider text-amber-400">
                {getLoc('تۆڕی بوارە پسپۆڕییەکان', 'Verified Trade Categories', 'التخصصات الفنية المعتمدة')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {getLoc('٨ بواری سەرەکیی خزمەتگوزاری موڵک', '8 Core Property Maintenance Domains', '٨ تخصصات أساسية لصيانة العقارات')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                {getLoc(
                  'وەستایانی خاوەن مۆڵەت و بەڵگەنامەی فەرمی لە تەواوی شارەکانی هەرێمی کوردستان و عێراق.',
                  'Licensed and identity-vetted technicians covering all major cities across Kurdistan & Iraq.',
                  'فنيون مرخصون وموثقو الهوية يغطون كافة المدن في إقليم كوردستان والعراق.'
                )}
              </p>
            </div>

            <div className="text-xs font-bold text-slate-400">
              {filteredCategories.length} {getLoc('بوار بەردەستە', 'categories available', 'تخصص متاح')}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredCategories.map((cat) => {
              const IconComp = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="p-6 rounded-3xl bg-[#0c1322] border border-slate-800/80 shadow-xl hover:border-amber-500/40 hover:shadow-2xl transition-all duration-200 text-start flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        {getLoc('وەستای پەسەندکراو', 'Verified Pro', 'فني معتمد')}
                      </span>
                    </div>

                    <h3 className="font-black text-base sm:text-lg text-white group-hover:text-amber-400 transition-colors">
                      {getLoc(cat.titleKu, cat.titleEn, cat.titleAr)}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-400 font-normal leading-relaxed">
                      {getLoc(cat.descKu, cat.descEn, cat.descAr)}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
                    <Link
                      to={`/tenant/maintenance/new?category=${cat.id}`}
                      className="hover:text-amber-300 flex items-center gap-1.5"
                    >
                      <span>{getLoc('داواکردنی چاکسازی', 'Request Service', 'طلب الصيانة')}</span>
                      <ChevronRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="bg-[#0c1322] rounded-3xl p-10 text-center max-w-md mx-auto space-y-3 border border-slate-800">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="font-bold text-white text-base">
                {getLoc('هیچ بوارێک لەگەڵ گەڕانەکەت ناگونجێت', 'No services found matching criteria', 'لم يتم العثور على خدمات مطابقة')}
              </h3>
              <p className="text-xs text-slate-400">
                {getLoc('تکایە وشەی گەڕان یان فلتەرەکەت بگۆڕە.', 'Try resetting your search query or city filters.', 'يرجى تغيير كلمات البحث أو الفلاتر.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedCity('all');
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-md"
              >
                {getLoc('سڕینەوەی فلتەرەکان', 'Reset Filters', 'إعادة ضبط الفلاتر')}
              </button>
            </div>
          )}

        </div>
      </section>

      {/* Verified Pros Standards & Commitments */}
      <section className="py-16 sm:py-24 bg-[#080d19] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase font-black tracking-wider text-amber-400">
              {getLoc('ستانداردی وەستای پەسەندکراو', 'Verified Pros Standards', 'معايير الفنيين المعتمدين')}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {getLoc('بۆچی وەستایانی HomeHub باوەڕپێکراون؟', 'Why HomeHub Verified Pros Are Trusted', 'لماذا يثق العملاء بفنيي هومهاب المعتمدين؟')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {getLoc(
                'ئێمە وەستای بێ ناسنامە و بێ بەڵگەنامە تۆمار ناکەین. هەموو ئەندامێک پرۆسەی پشکنینی توند تێدەپەڕێنێت.',
                'Zero fabricated contractor data. Every technician undergoes authenticated credentials vetting and quality inspection.',
                'بيانات حقيقية دون تزييف. يخضع كل فني ومقاول لتدقيق صارم في الهوية والشهادات والخبرة.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-start">
            <div className="bg-[#0c1322] rounded-3xl p-7 border border-slate-800/80 shadow-xl space-y-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-white">
                {getLoc('وەستای خاوەن مۆڵەت و باوەڕپێکراو', 'Licensed & Vetted Contractors', 'فنيون ومقاولون معتمدون')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                {getLoc(
                  'هەموو وەستا و تەکنیککارەکان پێش وەرگرتن بەڵگەنامەی شارەزایی و ناسنامەی فەرمیان لەلایەن تیمی بەڕێوەبردنەوە دەپشکنرێت.',
                  'Every contractor undergoes rigorous national ID, trade license, and technical credential vetting before onboarding to the platform.',
                  'يتم التحقق من الهوية الوطنية ورخص المزاولة وسندات الخبرة لكافة المقاولين قبل تفعيل حساباتهم في المنصة.'
                )}
              </p>
            </div>

            <div className="bg-[#0c1322] rounded-3xl p-7 border border-slate-800/80 shadow-xl space-y-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-white">
                {getLoc('خێرایی لە کاتی لەناکاو', 'Emergency Rapid Response', 'استجابة سريعة لحالات الطوارئ')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                {getLoc(
                  'تیمی فریاگوزاری خێرا بۆ کێشەی دزەکردنی ئاو، شۆرتی کارەبا و وەستانی سپلیت لە گەرمای هاویندا لە ئامادەباشیدان.',
                  'Rapid dispatch units deployed for severe water leaks, electrical short-circuits, and critical AC failures during extreme weather.',
                  'فرق استجابة فورية جاهزة لمعالجة تسريبات المياه الحادة، انقطاع الكهرباء، وأعطال التكييف الطارئة خلال موجات الحر.'
                )}
              </p>
            </div>

            <div className="bg-[#0c1322] rounded-3xl p-7 border border-slate-800/80 shadow-xl space-y-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-white">
                {getLoc('ڕوونی لە خەمڵاندنی تێچوو', 'Transparent Price Estimates', 'شفافية تقدير التكاليف')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                {getLoc(
                  'پسوولەی وردی کەرەستە و حەقدەستی وەستا پێش دەستپێکردنی کار بە فەرمی بە خاوەن موڵک و کرێنشین دەدرێت بێ تێچووی شاراوە.',
                  'Itemized upfront quotes detailing required materials and technician labor rates are provided before work starts with zero hidden fees.',
                  'فواتير تقديرية مفصلة للمواد وأجور اليد العاملة تقدم رسمياً للعميل قبل البدء بالعمل ودون أي رسوم خفية.'
                )}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Vendor Workspace Join CTA */}
      <section className="py-14 sm:py-20 bg-gradient-to-r from-[#0c1322] via-[#111b2e] to-[#0c1322] border-t border-amber-500/20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {getLoc('وەستایت یان کۆمپانیای چاکسازییت؟', 'Are You a Contractor or Service Company?', 'هل أنت فني محترف أو شركة صيانة؟')}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal">
            {getLoc(
              'پەیوەندی بە تۆڕی وەستایانی پەسەندکراوی هۆمهاب بکە، ئۆردەری فەرمی چاکسازی وەربگرە و کارەکانت بە مۆدێرنترین شێواز بەڕێوەببە.',
              'Join the HomeHub verified vendor network to receive verified work orders, submit transparent quotes, and expand your business.',
              'انضم إلى شبكة الفنيين المعتمدين في هومهاب، واستلم أوامر عمل مؤكدة وقدم عروض أسعار رسمية لتوسيع نطاق أعمالك.'
            )}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/workspace/vendor"
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              {getLoc('چوونە پۆرتاڵی وەستا', 'Open Vendor Workspace', 'الانتقال إلى بوابة الفنيين')}
            </Link>
            <Link
              to="/tenant/maintenance/new"
              className="px-8 py-3.5 rounded-2xl bg-[#080d19] hover:bg-[#111b2e] text-white font-bold text-sm border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              {getLoc('داواکردنی چاکسازی بۆ موڵک', 'Request Property Maintenance', 'طلب صيانة عقارية')}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

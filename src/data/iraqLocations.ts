export interface IraqCity {
  id: string;
  nameEn: string;
  nameKu: string;
  nameAr: string;
  lat: number;
  lng: number;
}

export interface IraqGovernorate {
  id: string;
  nameEn: string;
  nameKu: string;
  nameAr: string;
  region: 'Kurdistan' | 'Federal';
  regionNameEn: string;
  regionNameKu: string;
  regionNameAr: string;
  lat: number;
  lng: number;
  cities: IraqCity[];
}

export const IRAQ_GOVERNORATES: IraqGovernorate[] = [
  // --- Kurdistan Region ---
  {
    id: 'erbil',
    nameEn: 'Erbil',
    nameKu: 'هەولێر',
    nameAr: 'أربيل',
    region: 'Kurdistan',
    regionNameEn: 'Kurdistan Region',
    regionNameKu: 'هەرێمی کوردستان',
    regionNameAr: 'إقليم كوردستان',
    lat: 36.1901,
    lng: 44.0090,
    cities: [
      { id: 'erbil_city', nameEn: 'Erbil', nameKu: 'هەولێر', nameAr: 'أربيل', lat: 36.1901, lng: 44.0090 },
      { id: 'ankawa', nameEn: 'Ankawa', nameKu: 'عەنکاوە', nameAr: 'عنكاوا', lat: 36.2307, lng: 43.9934 },
      { id: 'soran', nameEn: 'Soran', nameKu: 'سۆران', nameAr: 'سوران', lat: 36.6534, lng: 44.5422 },
      { id: 'shaqlawa', nameEn: 'Shaqlawa', nameKu: 'شەقڵاوە', nameAr: 'شقلاوة', lat: 36.4068, lng: 44.3418 },
      { id: 'koya', nameEn: 'Koya', nameKu: 'کۆیە', nameAr: 'كويه', lat: 36.0833, lng: 44.6333 },
      { id: 'rawanduz', nameEn: 'Rawanduz', nameKu: 'ڕواندز', nameAr: 'رواندوز', lat: 36.6111, lng: 44.5244 },
      { id: 'khabat', nameEn: 'Khabat', nameKu: 'خەبات', nameAr: 'خبات', lat: 36.2731, lng: 43.6764 },
      { id: 'choman', nameEn: 'Choman', nameKu: 'چۆمان', nameAr: 'جومان', lat: 36.6333, lng: 44.8833 },
      { id: 'mergasor', nameEn: 'Mergasor', nameKu: 'مێرگەسۆر', nameAr: 'ميركةسور', lat: 36.8500, lng: 44.3000 }
    ]
  },
  {
    id: 'sulaymaniyah',
    nameEn: 'Sulaymaniyah',
    nameKu: 'سلێمانی',
    nameAr: 'السليمانية',
    region: 'Kurdistan',
    regionNameEn: 'Kurdistan Region',
    regionNameKu: 'هەرێمی کوردستان',
    regionNameAr: 'إقليم كوردستان',
    lat: 35.5558,
    lng: 45.4351,
    cities: [
      { id: 'sulaymaniyah_city', nameEn: 'Sulaymaniyah', nameKu: 'سلێمانی', nameAr: 'السليمانية', lat: 35.5558, lng: 45.4351 },
      { id: 'rania', nameEn: 'Rania', nameKu: 'ڕانیە', nameAr: 'رانية', lat: 36.2550, lng: 44.8828 },
      { id: 'qalat_dizah', nameEn: 'Qalat Dizah', nameKu: 'قەڵادزێ', nameAr: 'قلعة دزة', lat: 36.1833, lng: 45.1167 },
      { id: 'dokan', nameEn: 'Dokan', nameKu: 'دۆکان', nameAr: 'دوكان', lat: 35.9500, lng: 44.9667 },
      { id: 'kalar', nameEn: 'Kalar', nameKu: 'کەلار', nameAr: 'كلار', lat: 34.6333, lng: 45.3167 },
      { id: 'chamchamal', nameEn: 'Chamchamal', nameKu: 'چەمچەماڵ', nameAr: 'جمجمال', lat: 35.5333, lng: 44.8333 },
      { id: 'penjwen', nameEn: 'Penjwen', nameKu: 'پێنجوێن', nameAr: 'بنجوين', lat: 35.6167, lng: 45.9333 },
      { id: 'saidsadiq', nameEn: 'Saidsadiq', nameKu: 'سەید سادق', nameAr: 'سيد صادق', lat: 35.3500, lng: 45.8667 },
      { id: 'kifri', nameEn: 'Kifri', nameKu: 'کفری', nameAr: 'كفري', lat: 34.6833, lng: 44.9667 },
      { id: 'darbandikhan', nameEn: 'Darbandikhan', nameKu: 'دەربەندیخان', nameAr: 'دربندخان', lat: 35.1167, lng: 45.7000 },
      { id: 'sharazoor', nameEn: 'Sharazoor', nameKu: 'شارەزوور', nameAr: 'شهرزور', lat: 35.3167, lng: 45.7167 }
    ]
  },
  {
    id: 'duhok',
    nameEn: 'Duhok',
    nameKu: 'دهۆک',
    nameAr: 'دهوك',
    region: 'Kurdistan',
    regionNameEn: 'Kurdistan Region',
    regionNameKu: 'هەرێمی کوردستان',
    regionNameAr: 'إقليم كوردستان',
    lat: 36.8679,
    lng: 42.9885,
    cities: [
      { id: 'duhok_city', nameEn: 'Duhok', nameKu: 'دهۆک', nameAr: 'دهوك', lat: 36.8679, lng: 42.9885 },
      { id: 'zakho', nameEn: 'Zakho', nameKu: 'زاخۆ', nameAr: 'زاخو', lat: 37.1438, lng: 42.6874 },
      { id: 'semel', nameEn: 'Semel', nameKu: 'سێمێل', nameAr: 'سميل', lat: 36.8583, lng: 42.8500 },
      { id: 'amadiya', nameEn: 'Amadiya', nameKu: 'ئامێدی', nameAr: 'العمادية', lat: 37.0917, lng: 43.4889 },
      { id: 'akre', nameEn: 'Akre', nameKu: 'ئاکرێ', nameAr: 'عقرة', lat: 36.7417, lng: 43.8936 },
      { id: 'shekhan', nameEn: 'Shekhan', nameKu: 'شێخان', nameAr: 'الشيخان', lat: 36.7214, lng: 43.3481 },
      { id: 'bardarash', nameEn: 'Bardarash', nameKu: 'بەردەڕەش', nameAr: 'بردرش', lat: 36.5000, lng: 43.5833 }
    ]
  },
  {
    id: 'halabja',
    nameEn: 'Halabja',
    nameKu: 'هەڵەبجە',
    nameAr: 'حلبجة',
    region: 'Kurdistan',
    regionNameEn: 'Kurdistan Region',
    regionNameKu: 'هەرێمی کوردستان',
    regionNameAr: 'إقليم كوردستان',
    lat: 35.1778,
    lng: 45.9861,
    cities: [
      { id: 'halabja_city', nameEn: 'Halabja', nameKu: 'هەڵەبجە', nameAr: 'حلبجة', lat: 35.1778, lng: 45.9861 },
      { id: 'byara', nameEn: 'Byara', nameKu: 'بیارە', nameAr: 'بيارة', lat: 35.2167, lng: 46.1167 },
      { id: 'khurmal', nameEn: 'Khurmal', nameKu: 'خورماڵ', nameAr: 'خورمال', lat: 35.3167, lng: 46.0333 },
      { id: 'sirwan', nameEn: 'Sirwan', nameKu: 'سیروان', nameAr: 'سيروان', lat: 35.1333, lng: 45.9167 }
    ]
  },

  // --- Federal Iraq Governorates ---
  {
    id: 'baghdad',
    nameEn: 'Baghdad',
    nameKu: 'بەغدا',
    nameAr: 'بغداد',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 33.3152,
    lng: 44.3661,
    cities: [
      { id: 'baghdad_city', nameEn: 'Baghdad', nameKu: 'بەغدا', nameAr: 'بغداد', lat: 33.3152, lng: 44.3661 },
      { id: 'karkh', nameEn: 'Al-Karkh', nameKu: 'کەرخ', nameAr: 'الكرخ', lat: 33.3167, lng: 44.3500 },
      { id: 'rusafa', nameEn: 'Al-Rusafa', nameKu: 'ڕەسافە', nameAr: 'الرصافة', lat: 33.3333, lng: 44.4167 },
      { id: 'mansour', nameEn: 'Al-Mansour', nameKu: 'مەنسوور', nameAr: 'المنصور', lat: 33.3100, lng: 44.3500 },
      { id: 'karrada', nameEn: 'Al-Karrada', nameKu: 'کەڕادە', nameAr: 'الكرادة', lat: 33.3000, lng: 44.4300 },
      { id: 'adhamiyah', nameEn: 'Al-Adhamiyah', nameKu: 'ئەدهەمیە', nameAr: 'الأعظمية', lat: 33.3700, lng: 44.3600 },
      { id: 'sadr_city', nameEn: 'Sadr City', nameKu: 'شاری سەدر', nameAr: 'مدينة الصدر', lat: 33.3800, lng: 44.4600 },
      { id: 'kadhimiyah', nameEn: 'Al-Kadhimiyah', nameKu: 'کازمیە', nameAr: 'الكاظمية', lat: 33.3800, lng: 44.3400 },
      { id: 'dora', nameEn: 'Al-Dora', nameKu: 'دۆڕە', nameAr: 'الدورة', lat: 33.2500, lng: 44.3700 },
      { id: 'abu_ghraib', nameEn: 'Abu Ghraib', nameKu: 'ئەبوو غرێب', nameAr: 'أبو غريب', lat: 33.3069, lng: 44.1794 },
      { id: 'mahmoudiyah', nameEn: 'Al-Mahmoudiyah', nameKu: 'مەحموودیە', nameAr: 'المحمودية', lat: 33.0617, lng: 44.3544 }
    ]
  },
  {
    id: 'basra',
    nameEn: 'Basra',
    nameKu: 'بەسرە',
    nameAr: 'البصرة',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 30.5085,
    lng: 47.7804,
    cities: [
      { id: 'basra_city', nameEn: 'Basra', nameKu: 'بەسرە', nameAr: 'البصرة', lat: 30.5085, lng: 47.7804 },
      { id: 'zubair', nameEn: 'Al-Zubair', nameKu: 'زوبێر', nameAr: 'الزبير', lat: 30.3906, lng: 47.7011 },
      { id: 'qurna', nameEn: 'Al-Qurna', nameKu: 'قوڕنە', nameAr: 'القرنة', lat: 31.0153, lng: 47.4328 },
      { id: 'abu_al_khaseeb', nameEn: 'Abu Al-Khaseeb', nameKu: 'ئەبوو خەسیب', nameAr: 'أبو الخصيب', lat: 30.4500, lng: 47.9833 },
      { id: 'umm_qasr', nameEn: 'Umm Qasr', nameKu: 'ئوم قەسر', nameAr: 'أم قصر', lat: 30.0333, lng: 47.9333 },
      { id: 'al_faw', nameEn: 'Al-Faw', nameKu: 'فاو', nameAr: 'الفاو', lat: 29.9742, lng: 48.4731 },
      { id: 'shatt_al_arab', nameEn: 'Shatt Al-Arab', nameKu: 'شەتولعەرەب', nameAr: 'شط العرب', lat: 30.5333, lng: 47.8500 }
    ]
  },
  {
    id: 'nineveh',
    nameEn: 'Nineveh',
    nameKu: 'نەینەوا',
    nameAr: 'نينوى',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 36.3454,
    lng: 43.1448,
    cities: [
      { id: 'mosul', nameEn: 'Mosul', nameKu: 'مووسڵ', nameAr: 'الموصل', lat: 36.3454, lng: 43.1448 },
      { id: 'tel_afar', nameEn: 'Tel Afar', nameKu: 'تەلەعفەر', nameAr: 'تلعفر', lat: 36.3761, lng: 42.4497 },
      { id: 'sinjar', nameEn: 'Sinjar', nameKu: 'شنگال', nameAr: 'سنجار', lat: 36.3208, lng: 41.8600 },
      { id: 'hamdaniya', nameEn: 'Al-Hamdaniya', nameKu: 'حەمدانیە', nameAr: 'الحمدانية', lat: 36.2750, lng: 43.3750 },
      { id: 'tilkaif', nameEn: 'Tilkaif', nameKu: 'تەلکێف', nameAr: 'تلكيف', lat: 36.4917, lng: 43.1417 },
      { id: 'baaj', nameEn: 'Al-Baaj', nameKu: 'بەعاج', nameAr: 'البعاج', lat: 36.0400, lng: 41.7200 },
      { id: 'hatra', nameEn: 'Hatra', nameKu: 'حەزەر', nameAr: 'الحضر', lat: 35.5897, lng: 42.7186 }
    ]
  },
  {
    id: 'kirkuk',
    nameEn: 'Kirkuk',
    nameKu: 'کەرکووک',
    nameAr: 'كركوك',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 35.4681,
    lng: 44.3922,
    cities: [
      { id: 'kirkuk_city', nameEn: 'Kirkuk', nameKu: 'کەرکووک', nameAr: 'كركوك', lat: 35.4681, lng: 44.3922 },
      { id: 'hawija', nameEn: 'Hawija', nameKu: 'حەویجە', nameAr: 'الحويجة', lat: 35.3247, lng: 43.7742 },
      { id: 'daquq', nameEn: 'Daquq', nameKu: 'داقووق', nameAr: 'داقوق', lat: 35.0833, lng: 44.4500 },
      { id: 'dibis', nameEn: 'Dibis', nameKu: 'دبس', nameAr: 'الدبس', lat: 35.6881, lng: 44.0867 }
    ]
  },
  {
    id: 'anbar',
    nameEn: 'Anbar',
    nameKu: 'ئەنبار',
    nameAr: 'الأنبار',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 33.4244,
    lng: 43.2989,
    cities: [
      { id: 'ramadi', nameEn: 'Ramadi', nameKu: 'ڕەمادی', nameAr: 'الرمادي', lat: 33.4244, lng: 43.2989 },
      { id: 'fallujah', nameEn: 'Fallujah', nameKu: 'فەلووجە', nameAr: 'الفلوجة', lat: 33.3497, lng: 43.7744 },
      { id: 'hit', nameEn: 'Hit', nameKu: 'هیت', nameAr: 'هيت', lat: 33.6428, lng: 42.8253 },
      { id: 'haditha', nameEn: 'Haditha', nameKu: 'حەدیسە', nameAr: 'حديثة', lat: 34.1389, lng: 42.3789 },
      { id: 'al_qaim', nameEn: 'Al-Qaim', nameKu: 'قائیم', nameAr: 'القائم', lat: 34.3644, lng: 41.0117 },
      { id: 'rawah', nameEn: 'Rawah', nameKu: 'ڕاوە', nameAr: 'راوة', lat: 34.4833, lng: 41.9167 },
      { id: 'anah', nameEn: 'Anah', nameKu: 'عانە', nameAr: 'عنه', lat: 34.4667, lng: 41.9500 },
      { id: 'rutba', nameEn: 'Al-Rutba', nameKu: 'ڕوتبە', nameAr: 'الرطبة', lat: 33.0381, lng: 40.2842 }
    ]
  },
  {
    id: 'babil',
    nameEn: 'Babil',
    nameKu: 'بابل',
    nameAr: 'بابل',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 32.4844,
    lng: 44.4311,
    cities: [
      { id: 'hillah', nameEn: 'Hillah', nameKu: 'حیللە', nameAr: 'الحلة', lat: 32.4844, lng: 44.4311 },
      { id: 'musayyib', nameEn: 'Al-Musayyib', nameKu: 'موسەیب', nameAr: 'المسيب', lat: 32.7806, lng: 44.2917 },
      { id: 'mahawil', nameEn: 'Al-Mahawil', nameKu: 'مەهاویل', nameAr: 'المحاويل', lat: 32.6569, lng: 44.4097 },
      { id: 'hashimiyah', nameEn: 'Al-Hashimiyah', nameKu: 'هاشمیە', nameAr: 'الهاشمية', lat: 32.3556, lng: 44.6306 },
      { id: 'jurf_sakhar', nameEn: 'Jurf Al-Sakhar', nameKu: 'جورف سەخر', nameAr: 'جرف الصخر', lat: 32.8800, lng: 44.2000 }
    ]
  },
  {
    id: 'najaf',
    nameEn: 'Najaf',
    nameKu: 'نەجەف',
    nameAr: 'النجف',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 32.0000,
    lng: 44.3333,
    cities: [
      { id: 'najaf_city', nameEn: 'Najaf', nameKu: 'نەجەف', nameAr: 'النجف', lat: 32.0000, lng: 44.3333 },
      { id: 'kufa', nameEn: 'Kufa', nameKu: 'کووفە', nameAr: 'الكوفة', lat: 32.0300, lng: 44.4000 },
      { id: 'manathera', nameEn: 'Al-Manathera', nameKu: 'مەنازیرە', nameAr: 'المناذرة', lat: 31.8833, lng: 44.5167 },
      { id: 'meshkhab', nameEn: 'Al-Meshkhab', nameKu: 'مێشخاب', nameAr: 'المشخاب', lat: 31.8000, lng: 44.5000 }
    ]
  },
  {
    id: 'karbala',
    nameEn: 'Karbala',
    nameKu: 'کەربەلا',
    nameAr: 'كربلاء',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 32.6160,
    lng: 44.0249,
    cities: [
      { id: 'karbala_city', nameEn: 'Karbala', nameKu: 'کەربەلا', nameAr: 'كربلاء', lat: 32.6160, lng: 44.0249 },
      { id: 'ain_tamr', nameEn: 'Ain Al-Tamr', nameKu: 'عەین تەمر', nameAr: 'عين التمر', lat: 32.5667, lng: 43.4833 },
      { id: 'hindiya', nameEn: 'Al-Hindiya', nameKu: 'هیندیە', nameAr: 'الهندية', lat: 32.5500, lng: 44.2333 }
    ]
  },
  {
    id: 'saladin',
    nameEn: 'Saladin',
    nameKu: 'سەلاحەدین',
    nameAr: 'صلاح الدين',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 34.6067,
    lng: 43.6786,
    cities: [
      { id: 'tikrit', nameEn: 'Tikrit', nameKu: 'تکریت', nameAr: 'تكريت', lat: 34.6067, lng: 43.6786 },
      { id: 'samarra', nameEn: 'Samarra', nameKu: 'سامەڕا', nameAr: 'سامراء', lat: 34.1983, lng: 43.8742 },
      { id: 'balad', nameEn: 'Balad', nameKu: 'بەلەد', nameAr: 'بلد', lat: 34.0142, lng: 44.1444 },
      { id: 'dujail', nameEn: 'Dujail', nameKu: 'دوجەیل', nameAr: 'الدجيل', lat: 33.8500, lng: 44.2333 },
      { id: 'baiji', nameEn: 'Baiji', nameKu: 'بەیجی', nameAr: 'بيجي', lat: 34.9317, lng: 43.4897 },
      { id: 'shirqat', nameEn: 'Al-Shirqat', nameKu: 'شیرقات', nameAr: 'الشرقاط', lat: 35.5000, lng: 43.2500 },
      { id: 'tuz_khurmatu', nameEn: 'Tuz Khurmatu', nameKu: 'تووز خورماتوو', nameAr: 'طوز خورماتو', lat: 34.8833, lng: 44.6333 }
    ]
  },
  {
    id: 'diyala',
    nameEn: 'Diyala',
    nameKu: 'دیالە',
    nameAr: 'ديالى',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 33.7439,
    lng: 44.6444,
    cities: [
      { id: 'baqubah', nameEn: 'Baqubah', nameKu: 'بەعقووبە', nameAr: 'بعقوبة', lat: 33.7439, lng: 44.6444 },
      { id: 'khanaqin', nameEn: 'Khanaqin', nameKu: 'خانەقین', nameAr: 'خانقين', lat: 34.3500, lng: 45.3833 },
      { id: 'muqdadiyah', nameEn: 'Al-Muqdadiyah', nameKu: 'موقدادیە', nameAr: 'المقدادية', lat: 33.9806, lng: 44.9361 },
      { id: 'khalis', nameEn: 'Al-Khalis', nameKu: 'خالس', nameAr: 'الخالص', lat: 33.8500, lng: 44.5167 },
      { id: 'mandali', nameEn: 'Mandali', nameKu: 'مەندەلی', nameAr: 'مندلي', lat: 33.7500, lng: 45.5500 },
      { id: 'balad_ruz', nameEn: 'Balad Ruz', nameKu: 'بەلەدرووز', nameAr: 'بلدروز', lat: 33.7000, lng: 45.0833 }
    ]
  },
  {
    id: 'wasit',
    nameEn: 'Wasit',
    nameKu: 'واسیت',
    nameAr: 'واسط',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 32.5128,
    lng: 45.8194,
    cities: [
      { id: 'kut', nameEn: 'Kut', nameKu: 'کووت', nameAr: 'الكوت', lat: 32.5128, lng: 45.8194 },
      { id: 'suwaira', nameEn: 'Al-Suwaira', nameKu: 'سوێرە', nameAr: 'الصويرة', lat: 32.9250, lng: 44.7750 },
      { id: 'hayy', nameEn: 'Al-Hayy', nameKu: 'حەی', nameAr: 'الحي', lat: 32.1667, lng: 46.0500 },
      { id: 'aziziyah', nameEn: 'Al-Aziziyah', nameKu: 'عەزیزیە', nameAr: 'العزيزية', lat: 32.9067, lng: 45.0617 },
      { id: 'badrah', nameEn: 'Badrah', nameKu: 'بەدرە', nameAr: 'بدرة', lat: 33.1000, lng: 45.9667 }
    ]
  },
  {
    id: 'maysan',
    nameEn: 'Maysan',
    nameKu: 'مەیسان',
    nameAr: 'ميسان',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 31.8447,
    lng: 47.1439,
    cities: [
      { id: 'amarah', nameEn: 'Amarah', nameKu: 'عەمارە', nameAr: 'العمارة', lat: 31.8447, lng: 47.1439 },
      { id: 'ali_al_gharbi', nameEn: 'Ali Al-Gharbi', nameKu: 'عەلی غەربی', nameAr: 'علي الغربي', lat: 32.4667, lng: 46.6833 },
      { id: 'qalat_saleh', nameEn: 'Qalat Saleh', nameKu: 'قەڵای ساڵح', nameAr: 'قلعة صالح', lat: 31.5167, lng: 47.2833 },
      { id: 'maimouna', nameEn: 'Al-Maimouna', nameKu: 'مەیموونا', nameAr: 'الميمونة', lat: 31.6833, lng: 46.9667 },
      { id: 'kahla', nameEn: 'Al-Kahla', nameKu: 'کەحلا', nameAr: 'الكحلاء', lat: 31.6667, lng: 47.3000 }
    ]
  },
  {
    id: 'dhi_qar',
    nameEn: 'Dhi Qar',
    nameKu: 'زیقار',
    nameAr: 'ذي قار',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 31.0580,
    lng: 46.2573,
    cities: [
      { id: 'nasiriyah', nameEn: 'Nasiriyah', nameKu: 'ناسیریە', nameAr: 'الناصرية', lat: 31.0580, lng: 46.2573 },
      { id: 'shatrah', nameEn: 'Al-Shatrah', nameKu: 'شەترە', nameAr: 'الشطرة', lat: 31.4083, lng: 46.1750 },
      { id: 'suq_al_shuyukh', nameEn: 'Suq Al-Shuyukh', nameKu: 'سوو قوشیووخ', nameAr: 'سوق الشيوخ', lat: 30.8833, lng: 46.4667 },
      { id: 'rifai', nameEn: 'Al-Rifai', nameKu: 'ڕیفاعی', nameAr: 'الرفاعي', lat: 31.6500, lng: 46.1000 },
      { id: 'chibayish', nameEn: 'Al-Chibayish', nameKu: 'جبایش', nameAr: 'الجبايش', lat: 30.9667, lng: 47.0167 }
    ]
  },
  {
    id: 'muthanna',
    nameEn: 'Muthanna',
    nameKu: 'موسەننا',
    nameAr: 'المثنى',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 31.3167,
    lng: 45.2833,
    cities: [
      { id: 'samawah', nameEn: 'Samawah', nameKu: 'سەماوە', nameAr: 'السماوة', lat: 31.3167, lng: 45.2833 },
      { id: 'rumaitha', nameEn: 'Al-Rumaitha', nameKu: 'ڕومەیسە', nameAr: 'الرميثة', lat: 31.5247, lng: 45.2044 },
      { id: 'khidhir', nameEn: 'Al-Khidhir', nameKu: 'خزر', nameAr: 'الخضر', lat: 31.1833, lng: 45.5667 },
      { id: 'salman', nameEn: 'Al-Salman', nameKu: 'سەلمان', nameAr: 'السلمان', lat: 30.5000, lng: 44.7167 }
    ]
  },
  {
    id: 'qadisiyyah',
    nameEn: 'Al-Qadisiyyah',
    nameKu: 'قادسیە',
    nameAr: 'القادسية',
    region: 'Federal',
    regionNameEn: 'Federal Iraq',
    regionNameKu: 'عێراقی فیدراڵ',
    regionNameAr: 'العراق الاتحادي',
    lat: 31.9928,
    lng: 44.9250,
    cities: [
      { id: 'diwaniyah', nameEn: 'Al-Diwaniyah', nameKu: 'دیوانیە', nameAr: 'الديوانية', lat: 31.9928, lng: 44.9250 },
      { id: 'afak', nameEn: 'Afak', nameKu: 'عەفەک', nameAr: 'عفك', lat: 32.0667, lng: 45.2500 },
      { id: 'shamiya', nameEn: 'Al-Shamiya', nameKu: 'شامیە', nameAr: 'الشامية', lat: 31.9667, lng: 44.6000 },
      { id: 'hamza', nameEn: 'Al-Hamza', nameKu: 'حەمزە', nameAr: 'الحمزة', lat: 31.7333, lng: 44.9667 }
    ]
  }
];

export function getGovernorateName(gov: IraqGovernorate, lang: 'en' | 'ar' | 'ku'): string {
  if (lang === 'ku') return `${gov.nameKu} (${gov.nameEn})`;
  if (lang === 'ar') return `${gov.nameAr} (${gov.nameEn})`;
  return `${gov.nameEn} (${gov.nameKu})`;
}

export function getCityName(city: IraqCity, lang: 'en' | 'ar' | 'ku'): string {
  if (lang === 'ku') return `${city.nameKu} (${city.nameEn})`;
  if (lang === 'ar') return `${city.nameAr} (${city.nameEn})`;
  return `${city.nameEn} (${city.nameKu})`;
}

export function findGovernorateByCityName(cityName: string): IraqGovernorate | undefined {
  if (!cityName) return undefined;
  const lower = cityName.trim().toLowerCase();
  for (const gov of IRAQ_GOVERNORATES) {
    for (const city of gov.cities) {
      if (
        city.nameEn.toLowerCase() === lower ||
        city.nameKu === cityName.trim() ||
        city.nameAr === cityName.trim() ||
        city.id === lower
      ) {
        return gov;
      }
    }
  }
  return undefined;
}

export function findGovernorateByNameOrId(nameOrId: string): IraqGovernorate | undefined {
  if (!nameOrId) return undefined;
  const lower = nameOrId.trim().toLowerCase();
  return IRAQ_GOVERNORATES.find(
    g => g.id === lower ||
         g.nameEn.toLowerCase() === lower ||
         g.nameKu === nameOrId.trim() ||
         g.nameAr === nameOrId.trim()
  );
}

export function getAllIraqCities(): (IraqCity & { governorateId: string; governorateNameEn: string })[] {
  const result: (IraqCity & { governorateId: string; governorateNameEn: string })[] = [];
  for (const gov of IRAQ_GOVERNORATES) {
    for (const city of gov.cities) {
      result.push({
        ...city,
        governorateId: gov.id,
        governorateNameEn: gov.nameEn
      });
    }
  }
  return result;
}

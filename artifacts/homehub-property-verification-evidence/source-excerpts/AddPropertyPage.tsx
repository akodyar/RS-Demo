import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { 
  Building2, MapPin, CheckCircle, ChevronRight, ChevronLeft, Briefcase, Users, 
  Home, Factory, Store, Shield, Sparkles,
  Car, Warehouse, ArrowUpDown, ShieldCheck, Video, Zap,
  Wind, Flame, Wifi, Droplets, Dumbbell, Waves,
  Bath, Trees, Sun, Building, Cpu, Armchair,
  UtensilsCrossed, Box, UserCheck, Shirt, Smile,
  Utensils, ShieldAlert, VolumeX, SunMedium, Bell,
  Lock, Heart, Check, Search, Camera, Upload, 
  Image as ImageIcon, Trash2, Eye, Star, Plus, Link as LinkIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureFlags } from '../utils/featureFlags';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  IRAQ_GOVERNORATES, 
  getGovernorateName, 
  getCityName, 
  findGovernorateByNameOrId, 
  getAllIraqCities 
} from '../data/iraqLocations';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationSelector = ({ lat, lng, setLocation }: { lat: number, lng: number, setLocation: (lat: number, lng: number) => void }) => {
  const map = useMapEvents({
    click(e) {
      setLocation(e.latlng.lat, e.latlng.lng);
    },
  });

  React.useEffect(() => {
    map.setView([lat, lng], map.getZoom() || 13);
  }, [lat, lng, map]);

  return <Marker position={[lat, lng]} />;
};

const STEPS_KEYS = [
  'property.type',
  'property.basic_info',
  'property.location',
  'property.details',
  'property.amenities',
  'property.photos',
  'property.ownership',
  'property.management',
  'property.review'
];

export const AddPropertyPage: React.FC = () => {
  const { t, direction, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stepError, setStepError] = useState<{ step: number; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [pricingTierInfo, setPricingTierInfo] = useState<any>(null);

  // Post-Creation Management Choice State
  const [createdProperty, setCreatedProperty] = useState<any>(null);
  const [showManagementChoice, setShowManagementChoice] = useState(false);
  const [selectedPreference, setSelectedPreference] = useState<'SELF_MANAGED' | 'HOMEHUB_MANAGED' | 'AGENT_MANAGED'>('SELF_MANAGED');
  const [eligibleAgents, setEligibleAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    type: '',
    listingType: 'FOR_RENT' as 'FOR_RENT' | 'FOR_SALE' | 'NONE',
    price: '',
    currency: 'IQD',
    name: '',
    description: '',
    yearBuilt: '',
    squareFeet: '',
    bedrooms: '',
    bathrooms: '',
    floorNumber: '',
    furnishingStatus: 'UNFURNISHED',
    propertyCondition: 'GOOD',
    rentFee: '',
    managementFee: '',
    operatingModel: '' as '' | 'FULLY_MANAGED' | 'AGENT_LISTED_PLATFORM_MANAGED' | 'AGENT_OPERATED',
    address: { street: '', city: '', state: '', zip: '', country: '', lat: 36.1901, lng: 44.0090 },
    amenities: [] as string[],
    photos: [] as string[],
    ownershipPercentage: '100',
    ownerType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    ownerId: '',
    companyId: '',
    managedByAgentId: '',
    documents: [] as { fileName: string; documentType: string; fileUrl?: string }[]
  });

  const generateIdempotencyKey = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'prop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  };

  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateIdempotencyKey);
  const formEditedAfterAttemptRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const token = localStorage.getItem('auth_token') || 'dev-owner';
    fetch('/api/properties/pricing-tier', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setPricingTierInfo(data))
    .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (formEditedAfterAttemptRef.current) {
      setIdempotencyKey(generateIdempotencyKey());
      formEditedAfterAttemptRef.current = false;
    }
  }, [formData]);

  const [amenityCategory, setAmenityCategory] = useState<'all' | 'utilities' | 'comfort' | 'lifestyle' | 'safety'>('all');
  const [amenitySearch, setAmenitySearch] = useState('');

  // Location Selector States & Handlers
  const [isCustomCity, setIsCustomCity] = useState(false);

  const kurdistanGovs = IRAQ_GOVERNORATES.filter(g => g.region === 'Kurdistan');
  const federalGovs = IRAQ_GOVERNORATES.filter(g => g.region === 'Federal');

  const activeGov = findGovernorateByNameOrId(formData.address.state) || 
    (formData.address.city ? findGovernorateByNameOrId(formData.address.city) : undefined);

  const availableCities = activeGov ? activeGov.cities : [];

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const gov = findGovernorateByNameOrId(selectedName);
    if (gov) {
      const cityInGov = gov.cities.find(c => c.nameEn.toLowerCase() === (formData.address.city || '').toLowerCase());
      const nextCity = cityInGov ? cityInGov.nameEn : gov.cities[0].nameEn;
      const nextCityObj = cityInGov || gov.cities[0];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          state: gov.nameEn,
          city: nextCity,
          lat: nextCityObj.lat,
          lng: nextCityObj.lng
        }
      }));
      setIsCustomCity(false);
    } else {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          state: '',
        }
      }));
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'OTHER') {
      setIsCustomCity(true);
      return;
    }
    setIsCustomCity(false);
    if (!val) {
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, city: '' }
      }));
      return;
    }
    const allCities = getAllIraqCities();
    const matched = allCities.find(c => c.nameEn === val || c.id === val);
    if (matched) {
      const parentGov = IRAQ_GOVERNORATES.find(g => g.id === matched.governorateId);
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          city: matched.nameEn,
          state: parentGov ? parentGov.nameEn : prev.address.state,
          lat: matched.lat,
          lng: matched.lng
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, city: val }
      }));
    }
  };

  // Photo Upload States
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  const samplePhotoPresets = [
    {
      title: t('property.photos.preset_living', 'Living Room'),
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: t('property.photos.preset_bed', 'Master Bedroom'),
      url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: t('property.photos.preset_kitchen', 'Modern Kitchen'),
      url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: t('property.photos.preset_bath', 'Luxury Bathroom'),
      url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: t('property.photos.preset_exterior', 'Building Exterior'),
      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: t('property.photos.preset_garden', 'Garden & Terrace'),
      url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPhotoUploadError(null);
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        setPhotoUploadError(t('property.photos.error_type', 'Please select valid image files (JPG, PNG, WEBP).'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setPhotoUploadError(t('property.photos.error_size', 'Image size must be under 10MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const dataUrl = event.target.result as string;
          setFormData(prev => ({
            ...prev,
            photos: [...prev.photos, dataUrl]
          }));
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleAddPhotoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      setPhotoUploadError('Please enter a valid HTTP or HTTPS image URL.');
      return;
    }
    setPhotoUploadError(null);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, trimmed]
    }));
    setPhotoUrlInput('');
  };

  const handleRemovePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSetCoverPhoto = (index: number) => {
    setFormData(prev => {
      const selected = prev.photos[index];
      const rest = prev.photos.filter((_, i) => i !== index);
      return {
        ...prev,
        photos: [selected, ...rest]
      };
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS_KEYS.length - 1) setCurrentStep(s => s + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      formEditedAfterAttemptRef.current = true;
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'dev-owner'}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          listingType: formData.listingType,
          price: formData.price ? Number(formData.price) : (formData.listingType === 'FOR_RENT' ? 1200 : 250000),
          currency: formData.currency || 'IQD',
          address: {
            ...formData.address,
            city: formData.address.city || 'Erbil',
            country: formData.address.country || 'Iraq',
            photos: formData.photos,
            imageUrl: formData.photos[0] || '',
            amenities: formData.amenities,
            bedrooms: parseInt((formData as any).bedrooms) || null,
            bathrooms: parseInt((formData as any).bathrooms) || null,
            floorNumber: parseInt((formData as any).floorNumber) || null,
            furnishingStatus: (formData as any).furnishingStatus || undefined,
            propertyCondition: (formData as any).propertyCondition || undefined,
          },
          photos: formData.photos,
          imageUrl: formData.photos[0] || '',
          amenities: formData.amenities,
          squareFeet: parseInt(formData.squareFeet) || null,
          yearBuilt: parseInt(formData.yearBuilt) || null,
          rentFee: formData.rentFee ? parseFloat(formData.rentFee) : undefined,
          managementFee: formData.managementFee ? parseFloat(formData.managementFee) : undefined,
          operatingModel: formData.operatingModel || undefined,
          managedByAgentId: formData.managedByAgentId || undefined,
          ownerId: (formData as any).ownerType === 'INDIVIDUAL' && formData.ownerId ? formData.ownerId : undefined,
          companyId: (formData as any).ownerType === 'COMPANY' && (formData as any).companyId ? (formData as any).companyId : undefined,
        })
      });

            if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const rawMsg = errorData.message || errorData.error || t('property.error.create_failed', 'Failed to create property.');

        // Sanitize internal errors without exposing server stacks/paths
        let userMessage = rawMsg;
        if (res.status === 500) {
          userMessage = t('property.error.server_error', 'An internal server error occurred while creating the property. Please try again.');
        } else {
          userMessage = userMessage.replace(/^(VALIDATION_ERROR|FORBIDDEN|CONFLICT):\s*/i, '');
        }

        const lower = userMessage.toLowerCase();
        const detectedFieldErrors: Record<string, string> = {};
        let targetStep: number | null = null;

        if (lower.includes('type') && !lower.includes('owner type')) {
          detectedFieldErrors.type = userMessage;
          targetStep = 0; // Type Selection
        } else if (lower.includes('name') || lower.includes('title')) {
          detectedFieldErrors.name = userMessage;
          targetStep = 1; // Basic Information
        } else if (lower.includes('rent fee') || lower.includes('rentfee')) {
          detectedFieldErrors.rentFee = userMessage;
          targetStep = 7; // Operating Model & Financials
        } else if (lower.includes('management fee') || lower.includes('managementfee')) {
          detectedFieldErrors.managementFee = userMessage;
          targetStep = 7;
        } else if (lower.includes('operating model') || lower.includes('operatingmodel')) {
          detectedFieldErrors.operatingModel = userMessage;
          targetStep = 7;
        } else if (lower.includes('company')) {
          detectedFieldErrors.companyId = userMessage;
          targetStep = 6; // Ownership
        }

        setFieldErrors(detectedFieldErrors);
        setError(userMessage);

        if (targetStep !== null) {
          setStepError({ step: targetStep, message: userMessage });
          setCurrentStep(targetStep);
        }

        setLoading(false);
        return;
      }

      const created = await res.json();
      setIdempotencyKey(generateIdempotencyKey());
      formEditedAfterAttemptRef.current = false;
      setCreatedProperty(created);
      setShowManagementChoice(true);
      setLoading(false);

      // Fetch eligible verified management companies for AGENT_MANAGED choice
      const token = localStorage.getItem('auth_token') || 'dev-owner';
      fetch('/api/properties/eligible-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.agents)) setEligibleAgents(d.agents);
      })
      .catch(console.error);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const amenitiesList = [
    // Utilities & Power
    { id: 'Generator', label: t('Generator', '24/7 Power Generator'), category: 'utilities', icon: Zap },
    { id: 'Central AC', label: t('Central AC', 'Central Air Conditioning'), category: 'utilities', icon: Wind },
    { id: 'Central Heating', label: t('Central Heating', 'Central Heating'), category: 'utilities', icon: Flame },
    { id: 'Fiber Internet', label: t('Fiber Internet', 'High-Speed Fiber Internet'), category: 'utilities', icon: Wifi },
    { id: 'Water Well', label: t('Water Well', 'Water Well & Continuous Water'), category: 'utilities', icon: Droplets },
    { id: 'Solar Panels', label: t('Solar Panels', 'Solar Energy Panels'), category: 'utilities', icon: SunMedium },
    { id: 'EV Charger', label: t('EV Charger', 'EV Charging Station'), category: 'utilities', icon: Zap },

    // Building & Comfort
    { id: 'Parking', label: t('Parking', 'Dedicated Parking'), category: 'comfort', icon: Car },
    { id: 'Underground Parking', label: t('Underground Parking', 'Underground Parking'), category: 'comfort', icon: Warehouse },
    { id: 'Elevator', label: t('Elevator', 'High-Speed Elevator'), category: 'comfort', icon: ArrowUpDown },
    { id: 'Balcony', label: t('Balcony', 'Balcony with View'), category: 'comfort', icon: Sun },
    { id: 'Terrace', label: t('Terrace', 'Rooftop Terrace'), category: 'comfort', icon: Building },
    { id: 'Garden', label: t('Garden', 'Private Garden'), category: 'comfort', icon: Trees },
    { id: 'Storage Room', label: t('Storage Room', 'Storage Room'), category: 'comfort', icon: Box },
    { id: 'Maid Room', label: t('Maid Room', "Maid's / Service Room"), category: 'comfort', icon: UserCheck },
    { id: 'Laundry Room', label: t('Laundry Room', 'Laundry Room'), category: 'comfort', icon: Shirt },
    { id: 'Soundproof Windows', label: t('Soundproof Windows', 'Soundproof Double Glazing'), category: 'comfort', icon: VolumeX },

    // Lifestyle & Luxury
    { id: 'Pool', label: t('Pool', 'Swimming Pool'), category: 'lifestyle', icon: Waves },
    { id: 'Indoor Pool', label: t('Indoor Pool', 'Heated Indoor Pool'), category: 'lifestyle', icon: Bath },
    { id: 'Gym', label: t('Gym', 'Gym & Fitness Center'), category: 'lifestyle', icon: Dumbbell },
    { id: 'Sauna & Jacuzzi', label: t('Sauna & Jacuzzi', 'Sauna & Jacuzzi'), category: 'lifestyle', icon: Sparkles },
    { id: 'Smart Home', label: t('Smart Home', 'Smart Home Automation'), category: 'lifestyle', icon: Cpu },
    { id: 'Furnished', label: t('Furnished', 'Fully Furnished'), category: 'lifestyle', icon: Armchair },
    { id: 'Kitchen Appliances', label: t('Kitchen Appliances', 'Fitted Kitchen Appliances'), category: 'lifestyle', icon: UtensilsCrossed },
    { id: 'BBQ Area', label: t('BBQ Area', 'BBQ & Outdoor Grill Area'), category: 'lifestyle', icon: Utensils },
    { id: 'Children Playground', label: t('Children Playground', "Children's Play Area"), category: 'lifestyle', icon: Smile },
    { id: 'Pet Friendly', label: t('Pet Friendly', 'Pet Friendly'), category: 'lifestyle', icon: Heart },

    // Safety & Security
    { id: 'Security', label: t('Security', '24/7 Security & Guard'), category: 'safety', icon: ShieldCheck },
    { id: 'CCTV', label: t('CCTV', 'CCTV Surveillance'), category: 'safety', icon: Video },
    { id: 'Fire Safety', label: t('Fire Safety', 'Fire Alarm & Safety System'), category: 'safety', icon: ShieldAlert },
    { id: 'Concierge', label: t('Concierge', 'Concierge & Reception'), category: 'safety', icon: Bell },
    { id: 'Gated Community', label: t('Gated Community', 'Gated Secure Community'), category: 'safety', icon: Lock },
  ];

  const filteredAmenities = amenitiesList.filter(item => {
    const matchesCategory = amenityCategory === 'all' || item.category === amenityCategory;
    const matchesSearch = !amenitySearch.trim() || 
      item.label.toLowerCase().includes(amenitySearch.toLowerCase()) || 
      item.id.toLowerCase().includes(amenitySearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (showManagementChoice && createdProperty) {
    return (
      <div dir={direction} className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Quick Language Toggle */}
        <div className="flex justify-end">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('ku')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'ku' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              کوردی
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'en' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'ar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عربي
            </button>
          </div>
        </div>

        {/* 1. Submission Confirmation & Admin Verification Notice Banner */}
        <div data-testid="property-submitted-confirmation" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-950 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-emerald-900">
                {language === 'ku'
                  ? 'موڵکەکەت بە سەرکەوتوویی تۆمارکرا!'
                  : language === 'ar'
                  ? 'تم تسجيل عقارك بنجاح!'
                  : 'Property Registered Successfully!'}
              </h2>
              <p className="text-xs text-emerald-700 mt-0.5">
                {createdProperty.name} • {createdProperty.address?.city || 'Erbil'} • ID: {createdProperty.id?.substring(0, 8)}
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2 text-amber-900">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-200 text-amber-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>PENDING_VERIFICATION</span>
              </span>
              <span className="text-xs font-bold">
                {language === 'ku'
                  ? 'پێویستی بە پەسەندکردنی بەڕێوەبەر هەیە پێش بڵاوکردنەوەی گشتی'
                  : language === 'ar'
                  ? 'التحقق الإداري مطلوب قبل الإدراج العام في السوق'
                  : 'Administrative verification required before public listing'}
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              {language === 'ku'
                ? 'بەپێی یاساکانی هۆم‌هەب، هەموو موڵکێکی نوێ دەبێت لەلایەن کارگێڕی پلاتفۆرمەوە پشکنینی تاپۆ و خاوەندارێتی بۆ ئەنجام بدرێت. موڵکەکەت پارێزراوە و لە چاوەڕوانی پەسەندکردندایە و ناتوانرێت پێش پەسەندکردن لە بازاڕ دابنرێت یان بەکرێ بدرێت.'
                : language === 'ar'
                ? 'وفقًا لسياسات هوم هب، يجب فحص جميع العقارات الجديدة من قبل الإدارة للتأكد من سند الطابو والملكية. عقارك محفوظ وقيد المراجعة ولا يمكن إدراجه في السوق العام أو تأجيره قبل الموافقة.'
                : 'Per HomeHub security rules, every registered property must undergo admin verification before it can be publicly listed or leased. Your property is protected and pending review.'}
            </p>
          </div>
        </div>

        {/* 2. Dedicated Owner Management Preference Step */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {language === 'ku'
                ? 'شێوازی بەڕێوەبردنی موڵکەکەت هەڵبژێرە'
                : language === 'ar'
                ? 'اختر تفضيل إدارة عقارك'
                : 'Select Your Management Preference'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'ku'
                ? 'تکایە یەکێک لەم سێ بژاردەیەی خوارەوە دیاری بکە:'
                : language === 'ar'
                ? 'يرجى تحديد أحد الخيارات الثلاثة التالية لإدارة عقارك:'
                : 'Please select exactly one of the three management choices below:'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Option A: SELF_MANAGED */}
            <div
              data-testid="option-self-managed"
              onClick={() => setSelectedPreference('SELF_MANAGED')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPreference === 'SELF_MANAGED'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">A. SELF_MANAGED</span>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {language === 'ku' ? 'بەڕێوەبردنی خۆیی' : language === 'ar' ? 'إدارة ذاتية' : 'Self-Managed'}
                    </h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 italic">
                    “I want to list my property on HomeHub and manage it myself.”
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {language === 'ku'
                      ? 'دەمەوێت موڵکەکەم لە هۆم‌هەب دابنێم و خۆم بەڕێوەی ببەم. کاتێک پشکنین پەسەند کرا، خۆت ڕیکلام دەکەیت و کرێنشین بەڕێوەدەبەیت بەبێ پێویستی بە گرێبەستی بەڕێوەبردن (NOT_APPLICABLE).'
                      : language === 'ar'
                      ? 'أريد إدراج عقاري على هوم هب وإدارته بنفسي. بعد الموافقة على التحقق، يمكنك الإعلان وإدارة المستأجرين مباشرة دون الحاجة لاتفاقية إدارة.'
                      : 'You retain full direct control. Once verified, you can advertise and manage tenancies directly. Arrangement status: NOT_APPLICABLE.'}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                  selectedPreference === 'SELF_MANAGED' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedPreference === 'SELF_MANAGED' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Option B: HOMEHUB_MANAGED */}
            <div
              data-testid="option-homehub-managed"
              onClick={() => setSelectedPreference('HOMEHUB_MANAGED')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPreference === 'HOMEHUB_MANAGED'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">B. HOMEHUB_MANAGED</span>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {language === 'ku' ? 'بەڕێوەبردن لەلایەن هۆم‌هەب' : language === 'ar' ? 'إدارة هوم هب' : 'HomeHub-Managed'}
                    </h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 italic">
                    “I want HomeHub to manage my property for me.”
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {language === 'ku'
                      ? 'دەمەوێت هۆم‌هەب موڵکەکەم بۆ بەڕێوەببات. تیمی ئۆپەراسیۆن دەست بە ئۆنبۆردکردن دەکات و گرێبەستی بەڕێوەبردن ئامادە دەکات (AWAITING_ONBOARDING).'
                      : language === 'ar'
                      ? 'أريد أن تتولى هوم هب إدارة عقاري بالكامل. سيبدأ فريق العمليات بالإعداد وتجهيز اتفاقية الإدارة المعتمدة.'
                      : 'HomeHub operations manages your property end-to-end under the standard platform operating model. Arrangement status: AWAITING_ONBOARDING.'}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                  selectedPreference === 'HOMEHUB_MANAGED' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedPreference === 'HOMEHUB_MANAGED' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Option C: AGENT_MANAGED */}
            <div
              data-testid="option-agent-managed"
              onClick={() => setSelectedPreference('AGENT_MANAGED')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPreference === 'AGENT_MANAGED'
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">C. AGENT_MANAGED</span>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {language === 'ku' ? 'بەڕێوەبردن لەلایەن ئاژانس / کۆمپانیا' : language === 'ar' ? 'إدارة وكيل / شركة' : 'Agent-Managed'}
                    </h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 italic">
                    “I want an agent or property management company to manage my property.”
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {language === 'ku'
                      ? 'دەمەوێت ئاژانس یان کۆمپانیایەکی بەڕێوەبردن موڵکەکەم بەڕێوەببات. پێویستە گرێبەستی فەرمی هەبێت پێش ئەوەی دەسەڵاتی بەڕێوەبردن پێبدرێت (AWAITING_AGREEMENT).'
                      : language === 'ar'
                      ? 'أريد أن يدير عقاري وكيل أو شركة إدارة عقارية معتمدة. يلزم توقيع اتفاقية إدارة رسمية قبل منح صلاحيات الإدارة.'
                      : 'An authorized management partner will manage your property. Management access is not granted until an agreement is executed. Arrangement status: AWAITING_AGREEMENT.'}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                  selectedPreference === 'AGENT_MANAGED' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedPreference === 'AGENT_MANAGED' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {selectedPreference === 'AGENT_MANAGED' && (
                <div className="mt-4 pt-4 border-t border-blue-200/60 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'ku'
                      ? 'هەڵبژاردنی کۆمپانیای بەڕێوەبردن (Verified Management Company):'
                      : language === 'ar'
                      ? 'اختر شركة الإدارة المعتمدة:'
                      : 'Select Verified Management Company:'}
                  </label>
                  {eligibleAgents.length > 0 ? (
                    <select
                      data-testid="agent-company-select"
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 outline-none focus:border-blue-600"
                    >
                      <option value="">-- {language === 'ku' ? 'کۆمپانیایەک هەڵبژێرە' : 'Select a verified company'} --</option>
                      {eligibleAgents.map(ag => (
                        <option key={ag.id} value={ag.id}>{ag.name} ({ag.id.substring(0, 8)})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                      <p className="font-semibold text-slate-700">
                        {language === 'ku'
                          ? 'هیچ کۆمپانیایەکی دەرەکی باوەڕپێکراو لەم ساتەدا بەردەست نییە.'
                          : 'No external verified management companies currently registered in this environment.'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {language === 'ku'
                          ? 'دەتوانیت دواتر لەڕێگەی پشتگیری هۆم‌هەب داوای هاوکاری بکەیت. دۆخی ڕێککەوتنەکە بە AWAITING_AGREEMENT دەمێنێتەوە.'
                          : 'Assistance finding a manager can be requested from HomeHub Support. Arrangement status will be recorded as AWAITING_AGREEMENT.'}
                      </p>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {language === 'ku'
                        ? 'ئاگاداری: دیاریکردنی بەڕێوەبەر بە خۆکاری دەسەڵاتی چوونەژوورەوەی پێنابەخشێت. دەبێت گرێبەستی بەڕێوەبردن لە نێوانتان واژۆ بکرێت.'
                        : 'Selecting a manager does not automatically grant property access. A formal signed management agreement is mandatory.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {preferenceError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
              {preferenceError}
            </div>
          )}

          {preferenceSaved ? (
            <div data-testid="preference-saved-banner" className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'ku'
                    ? `شێوازی بەڕێوەبردن (${selectedPreference}) بە سەرکەوتوویی پاشەکەوتکرا!`
                    : language === 'ar'
                    ? `تم حفظ تفضيل الإدارة (${selectedPreference}) بنجاح!`
                    : `Management preference (${selectedPreference}) saved successfully!`}
                </span>
              </div>
              <div className="text-xs text-emerald-900 space-y-1">
                <p>
                  <strong>{language === 'ku' ? 'هەنگاوی داهاتوو:' : 'Next Action:'}</strong>{' '}
                  {selectedPreference === 'SELF_MANAGED'
                    ? (language === 'ku' ? 'چاوەڕوانی پەسەندکردنی تاپۆ/خاوەندارێتی لەلایەن بەڕێوەبەر. دوای پەسەندکردن دەتوانیت ڕیکلام دابنێیت.' : 'Awaiting admin verification. Once verified, you can advertise and manage directly.')
                    : selectedPreference === 'HOMEHUB_MANAGED'
                    ? (language === 'ku' ? 'تیمی ئۆپەراسیۆن پەیوەندیت پێوە دەکەن بۆ تەواوکردنی ئۆنبۆردکردن و گرێبەستی بەڕێوەبردن.' : 'HomeHub operations team will contact you to complete onboarding and execute the agreement.')
                    : (language === 'ku' ? 'ئاژانسی هەڵبژێردراو پێویستە گرێبەستی بەڕێوەبردن پێشکەش بکات پێش دەستپێکردن.' : 'The selected agent must submit and execute the management agreement before access is granted.')}
                </p>
              </div>
              <button
                type="button"
                data-testid="go-to-portfolio-btn"
                onClick={() => navigate('/properties')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs mt-2"
              >
                {language === 'ku' ? 'بڕۆ بۆ لیستی موڵکەکانم (Go to Portfolio)' : 'Go to My Portfolio'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/properties')}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                {language === 'ku' ? 'دوایی بڕیار دەدەم (Decide Later)' : 'Decide Later'}
              </button>

              <button
                type="button"
                data-testid="save-management-preference-btn"
                disabled={savingPreference}
                onClick={async () => {
                  setSavingPreference(true);
                  setPreferenceError(null);
                  try {
                    const token = localStorage.getItem('auth_token') || 'dev-owner';
                    const res = await fetch(`/api/properties/${createdProperty.id}/management-preference`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        managementPreference: selectedPreference,
                        agentCompanyId: selectedPreference === 'AGENT_MANAGED' && selectedAgentId ? selectedAgentId : undefined
                      })
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(errData.message || errData.error || 'Failed to save management preference');
                    }
                    setPreferenceSaved(true);
                  } catch (err: any) {
                    setPreferenceError(err.message);
                  } finally {
                    setSavingPreference(false);
                  }
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              >
                {savingPreference ? (
                  <span>{language === 'ku' ? 'پاشەکەوت دەکرێت...' : 'Saving...'}</span>
                ) : (
                  <>
                    <span>{language === 'ku' ? 'پاشەکەوتکردنی هەڵبژاردن' : language === 'ar' ? 'حفظ التفضيل' : 'Save Preference'}</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir={direction} className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header with Language Switcher */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('property.add_new', 'Add New Property')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('property.add.subtitle', 'Register a new property into the portfolio.')}
          </p>
        </div>

        {/* Quick Language Toggle Pill */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setLanguage('ku')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'ku' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            کوردی
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'en' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ar')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'ar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            عربي
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full" />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-300 ${
              direction === 'rtl' ? 'right-0' : 'left-0'
            }`}
            style={{ width: `${(currentStep / (STEPS_KEYS.length - 1)) * 100}%` }}
          />
          
          {STEPS_KEYS.map((stepKey, idx) => (
            <button 
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className="flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-105 group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                stepError?.step === idx ? 'bg-red-100 text-red-700 border-2 border-red-500 ring-2 ring-red-200' :
                idx < currentStep ? 'bg-blue-600 text-white' : 
                idx === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110 shadow-xs' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
              }`}>
                {stepError?.step === idx ? '!' : idx < currentStep ? <CheckCircle className="w-5 h-5" /> : idx + 1}
              </div>
              <span className={`text-[11px] font-semibold hidden sm:block transition-colors ${
                stepError?.step === idx ? 'text-red-600 font-bold' :
                idx <= currentStep ? 'text-slate-900 font-bold' : 'text-slate-400 group-hover:text-slate-600'
              }`}>
                {t(stepKey, stepKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-s-4 border-red-500 text-sm text-red-700 rounded-r-xl">
          {error}
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border-s-4 border-emerald-500 text-sm text-emerald-800 rounded-r-xl font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span>{t('property.created_success', 'Property successfully registered in portfolio!')}</span>
        </div>
      )}

      {/* Step Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 min-h-[420px]">
        
        {/* Step 0: Type Selection */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-4">
              {t('property.type.question', 'What type of property is this?')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'Apartment', icon: Building2, label: t('property.type.apartment', 'Apartment Building') },
                { id: 'Villa', icon: Home, label: t('property.type.villa', 'Villa / House') },
                { id: 'Commercial', icon: Store, label: t('property.type.commercial', 'Commercial Property') },
                { id: 'Industrial', icon: Factory, label: t('property.type.industrial', 'Industrial Facility') },
              ].map(type => (
                <button 
                  key={type.id}
                  type="button"
                  data-testid={`property-type-${type.id.toLowerCase()}`}
                  onClick={() => setFormData({ ...formData, type: type.id })}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center ${
                    formData.type === type.id 
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm scale-[1.02]' 
                      : 'border-slate-200 hover:border-blue-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <type.icon className="w-9 h-9" />
                  <span className="font-bold text-sm sm:text-base">{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-2">
              {t('property.step_basic_info', 'Basic Information')}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {t('property.add.subtitle', 'Register a new property into the portfolio.')}
            </p>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {t('property.form_name_optional', 'Property Name (Optional)')}
              </label>
              <input 
                type="text" 
                data-testid="property-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('property.ph_name', 'e.g. Empire World Tower A')} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {t('property.description', 'Description')}
              </label>
              <textarea 
                data-testid="property-description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('property.ph_desc', 'Describe the property, features, and neighborhood...')} 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium min-h-[100px] resize-y"
              />
            </div>


            {/* Listing Purpose Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                {t('property.listing_purpose', 'مەبەست لە تۆمارکردن (Listing Purpose)')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  data-testid="purpose-rent"
                  onClick={() => setFormData({ ...formData, listingType: 'FOR_RENT' })}
                  className={`p-3.5 rounded-xl border-2 text-start font-bold text-xs transition-all cursor-pointer flex flex-col gap-1 ${
                    formData.listingType === 'FOR_RENT'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm">🔑 {t('property.purpose_rent', 'بۆ كرێ (For Rent)')}</span>
                  <span className="text-[11px] text-slate-500 font-normal">{t('property.purpose_rent_desc', 'Publish property for tenants with monthly rent')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, listingType: 'NONE' })}
                  className={`p-3.5 rounded-xl border-2 text-start font-bold text-xs transition-all cursor-pointer flex flex-col gap-1 ${
                    formData.listingType === 'NONE'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-900 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm">📁 {t('property.purpose_portfolio', 'تەنها پۆرتفۆلیۆ (Private)')}</span>
                  <span className="text-[11px] text-slate-500 font-normal">{t('property.purpose_portfolio_desc', 'Manage in portfolio without publishing to market')}</span>
                </button>

                <button
                  type="button"
                  disabled
                  data-testid="purpose-sale-disabled"
                  className="p-3.5 rounded-xl border-2 border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed flex flex-col gap-1 opacity-60 text-start font-bold text-xs"
                >
                  <span className="text-sm">🏷️ {t('property.purpose_sale', 'بۆ فرۆشتن (For Sale)')}</span>
                  <span className="text-[11px] text-slate-400 font-normal">{t('property.purpose_sale_disabled', 'ناچالاکە لە وەشانی ئێستا (Rental-only)')}</span>
                </button>
              </div>
            </div>

            {/* Price Input if Rent or Sale */}
            {formData.listingType !== 'NONE' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="block text-sm font-bold text-slate-700">
                  {formData.listingType === 'FOR_RENT' 
                    ? t('property.rent_price_label', 'نرخی کرێی مانگانە بە دۆلار (Monthly Rent USD)') 
                    : t('property.sale_price_label', 'نرخی فرۆشتن بە دۆلار (Sale Price USD)')}
                </label>
                <div className="mb-2 max-w-sm">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {t('property.currency_label', 'دراوی مامەڵە (Currency)')}
                  </label>
                  <select
                    data-testid="property-currency"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800 bg-white"
                  >
                    <option value="IQD">IQD — دیناری عێراقی (Iraqi Dinar)</option>
                    <option value="USD">USD — دۆلاری ئەمریکی (US Dollar)</option>
                  </select>
                </div>
                <div className="relative max-w-sm">
                  <input 
                    type="number" 
                    min="1"
                    placeholder={formData.listingType === 'FOR_RENT' ? '1200' : '250000'}
                    data-testid="property-price"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800"
                  />
                  <span className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 ${
                    direction === 'rtl' ? 'left-3' : 'right-3'
                  }`}>
                    {formData.listingType === 'FOR_RENT' ? `${formData.currency} / mo` : formData.currency}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Location */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span>{t('property.location', 'Location')}</span>
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('property.address', 'Address')}
                </label>
                <input 
                  type="text" 
                  placeholder={t('property.ph_street', 'Street Address (e.g. 100m Road, Gulan)')}
                  value={formData.address.street}
                  onChange={e => setFormData({ ...formData, address: { ...formData.address, street: e.target.value }})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* City Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{t('common.city', 'City')}</span>
                    {availableCities.length > 0 && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        {availableCities.length} {language === 'ku' ? 'شار/قەزا' : language === 'ar' ? 'مدينة/قضاء' : 'cities'}
                      </span>
                    )}
                  </label>
                  <select 
                    data-testid="property-address-city-select"
                    value={isCustomCity ? 'OTHER' : (formData.address.city || '')}
                    onChange={handleCityChange}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white text-slate-800 cursor-pointer transition-all"
                  >
                    <option value="">{t('property.select_city', language === 'ku' ? 'شارێک هەڵبژێرە...' : language === 'ar' ? 'اختر المدينة...' : 'Select City...')}</option>
                    {activeGov ? (
                      activeGov.cities.map(city => (
                        <option key={city.id} value={city.nameEn}>
                          {getCityName(city, language)}
                        </option>
                      ))
                    ) : (
                      <>
                        <optgroup label={language === 'ku' ? 'هەرێمی کوردستان (Kurdistan Region)' : language === 'ar' ? 'إقليم كوردستان (Kurdistan Region)' : 'Kurdistan Region (هەرێمی کوردستان)'}>
                          {kurdistanGovs.flatMap(g => g.cities).map(city => (
                            <option key={city.id} value={city.nameEn}>
                              {getCityName(city, language)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={language === 'ku' ? 'عێراقی فیدراڵ (Federal Iraq)' : language === 'ar' ? 'العراق الاتحادي (Federal Iraq)' : 'Federal Iraq (عێراقی فیدراڵ)'}>
                          {federalGovs.flatMap(g => g.cities).map(city => (
                            <option key={city.id} value={city.nameEn}>
                              {getCityName(city, language)}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                    <option value="OTHER">
                      {language === 'ku' ? '✍️ شار یان ناوچەیەکی تر (دەستنووس)...' : language === 'ar' ? '✍️ مدينة أو منطقة أخرى (يدوي)...' : '✍️ Other / Custom City or Area...'}
                    </option>
                  </select>
                </div>

                {/* State / Province Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{t('common.state', 'State / Province')}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      19 {language === 'ku' ? 'پارێزگا' : language === 'ar' ? 'محافظة' : 'provinces'}
                    </span>
                  </label>
                  <select 
                    data-testid="property-address-state-select"
                    value={activeGov ? activeGov.nameEn : (formData.address.state || '')}
                    onChange={handleStateChange}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white text-slate-800 cursor-pointer transition-all"
                  >
                    <option value="">{t('property.select_state', language === 'ku' ? 'پارێزگا / هەرێمێک هەڵبژێرە...' : language === 'ar' ? 'اختر المحافظة / الإقليم...' : 'Select State / Province...')}</option>
                    <optgroup label={language === 'ku' ? 'هەرێمی کوردستان (Kurdistan Region)' : language === 'ar' ? 'إقليم كوردستان (Kurdistan Region)' : 'Kurdistan Region (هەرێمی کوردستان)'}>
                      {kurdistanGovs.map(gov => (
                        <option key={gov.id} value={gov.nameEn}>
                          {getGovernorateName(gov, language)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={language === 'ku' ? 'عێراقی فیدراڵ (Federal Iraq)' : language === 'ar' ? 'العراق الاتحادي (Federal Iraq)' : 'Federal Iraq (عێراقی فیدراڵ)'}>
                      {federalGovs.map(gov => (
                        <option key={gov.id} value={gov.nameEn}>
                          {getGovernorateName(gov, language)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Custom City Input when OTHER is selected */}
              {isCustomCity && (
                <div className="animate-in fade-in duration-200 p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    {language === 'ku' ? 'ناوی شار یان ناوچەی تر بنووسە:' : language === 'ar' ? 'اكتب اسم المدينة أو المنطقة الأخرى:' : 'Enter Custom City / District Name:'}
                  </label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
                    placeholder={language === 'ku' ? 'بۆ نموونە: کەسنەزان، بەحرکە، دارەتوو...' : language === 'ar' ? 'مثال: كسنزان، بحركة، دارتو...' : 'e.g. Kasnazan, Baharka, Shawes...'}
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white"
                    autoFocus
                  />
                </div>
              )}
              
              {/* Map Section */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t('property.map_location', 'Select on Map')}
                </label>
                <div className="h-64 rounded-xl overflow-hidden border border-slate-300 relative z-0">
                  <MapContainer center={[formData.address.lat || 36.1901, formData.address.lng || 44.0090]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <LocationSelector 
                      lat={formData.address.lat || 36.1901} 
                      lng={formData.address.lng || 44.0090} 
                      setLocation={(lat, lng) => setFormData(prev => ({ ...prev, address: { ...prev.address, lat, lng } }))}
                    />
                  </MapContainer>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('property.map_hint', 'Click on the map to pin the exact location of the property.')}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Step 3: Specifications */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-4">
              {t('property.details', 'Property Details')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.year_built', 'Year Built')}
                </label>
                <input 
                  type="number" 
                  placeholder={t('property.ph_year', 'e.g. 2022')}
                  value={formData.yearBuilt}
                  onChange={e => setFormData({ ...formData, yearBuilt: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.total_area', 'Total Area (SqM / SqFt)')}
                </label>
                <input 
                  type="number" 
                  placeholder={t('property.ph_area', 'e.g. 220')}
                  value={formData.squareFeet}
                  onChange={e => setFormData({ ...formData, squareFeet: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.bedrooms', 'Bedrooms')}
                </label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={t('property.ph_bedrooms', 'e.g. 3')}
                  value={(formData as any).bedrooms}
                  onChange={e => setFormData({ ...formData, bedrooms: e.target.value } as any)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.bathrooms', 'Bathrooms')}
                </label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={t('property.ph_bathrooms', 'e.g. 2')}
                  value={(formData as any).bathrooms}
                  onChange={e => setFormData({ ...formData, bathrooms: e.target.value } as any)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
              
              {formData.type === 'APARTMENT' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    {t('property.floor_number', 'Floor Number')}
                  </label>
                  <input 
                    type="number" 
                    placeholder={t('property.ph_floor', 'e.g. 5')}
                    value={(formData as any).floorNumber}
                    onChange={e => setFormData({ ...formData, floorNumber: e.target.value } as any)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.furnishing', 'Furnishing Status')}
                </label>
                <select
                  value={(formData as any).furnishingStatus}
                  onChange={e => setFormData({ ...formData, furnishingStatus: e.target.value } as any)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium appearance-none bg-white"
                >
                  <option value="UNFURNISHED">{t('furnishing.unfurnished', 'Unfurnished')}</option>
                  <option value="SEMI_FURNISHED">{t('furnishing.semi', 'Semi-Furnished')}</option>
                  <option value="FULLY_FURNISHED">{t('furnishing.fully', 'Fully Furnished')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {t('property.condition', 'Property Condition')}
                </label>
                <select
                  value={(formData as any).propertyCondition}
                  onChange={e => setFormData({ ...formData, propertyCondition: e.target.value } as any)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium appearance-none bg-white"
                >
                  <option value="BRAND_NEW">{t('condition.new', 'Brand New')}</option>
                  <option value="EXCELLENT">{t('condition.excellent', 'Excellent')}</option>
                  <option value="GOOD">{t('condition.good', 'Good')}</option>
                  <option value="NEEDS_RENOVATION">{t('condition.needs_renovation', 'Needs Renovation')}</option>
                </select>
              </div>
            </div>
            {/* Pricing Tier Banner */}
            {pricingTierInfo && (
              <div data-testid="pricing-tier-banner" className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl my-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900" data-testid="resolved-tier-name">
                    {t('pricing.tier', 'Pricing Tier')}: {pricingTierInfo.tier ? pricingTierInfo.tier.name : t('pricing.standard', 'Standard Tier')}
                  </span>
                  <span className="text-xs text-blue-700 font-semibold" data-testid="verified-property-count">
                    {t('pricing.prop_count', 'Verified Properties')}: <span dir="ltr">{pricingTierInfo.propertyCount}</span>
                  </span>
                </div>
                {pricingTierInfo.tier && (
                  <p className="text-[11px] text-blue-600 mt-1" data-testid="tier-rates-info">
                    {t('pricing.rec_rates', 'Recommended rates')}: {' '}
                    {t('pricing.rent', 'Rent')} <span dir="ltr">{pricingTierInfo.tier.rentFeeRate ? `${(parseFloat(pricingTierInfo.tier.rentFeeRate) * 100).toFixed(1)}%` : t('pricing.standard_rate', 'Standard')}</span>, {' '}
                    {t('pricing.management', 'Management')} <span dir="ltr">{pricingTierInfo.tier.managementFeeRate ? `${(parseFloat(pricingTierInfo.tier.managementFeeRate) * 100).toFixed(1)}%` : t('pricing.standard_rate', 'Standard')}</span>
                  </p>
                )}
              </div>
            )}

            {/* Operating Model & Agreed Fees */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <label className="block text-sm font-bold text-slate-700">
                {t('property.operating_model', 'Operating Model')}
              </label>
              <select
                data-testid="property-operating-model"
                value={formData.operatingModel}
                onChange={e => setFormData({ ...formData, operatingModel: e.target.value as any })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white"
              >
                <option value="FULLY_MANAGED">{t('property.model.fully_managed', 'Fully Managed')}</option>
                <option value="AGENT_LISTED_PLATFORM_MANAGED">{t('property.model.agent_listed', 'Agent-Listed, Platform-Managed')}</option>
                <option value="AGENT_OPERATED">{t('property.model.agent_operated', 'Agent-Operated')}</option>
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('property.rent_fee_agreed', 'Agreed Rent Fee Rate')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    data-testid="property-rent-fee"
                    placeholder="0.00"
                    value={formData.rentFee}
                    onChange={e => {
                      setFormData({ ...formData, rentFee: e.target.value });
                      if (fieldErrors.rentFee) setFieldErrors(prev => ({ ...prev, rentFee: '' }));
                    }}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium ${
                      fieldErrors.rentFee ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                    }`}
                    dir="ltr"
                  />
                  {fieldErrors.rentFee && (
                    <p data-testid="field-error-rent-fee" className="text-red-600 text-xs mt-1 font-bold">
                      {fieldErrors.rentFee}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('property.mgmt_fee_agreed', 'Agreed Management Fee Rate')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    data-testid="property-management-fee"
                    placeholder="0.00"
                    value={formData.managementFee}
                    onChange={e => {
                      setFormData({ ...formData, managementFee: e.target.value });
                      if (fieldErrors.managementFee) setFieldErrors(prev => ({ ...prev, managementFee: '' }));
                    }}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium ${
                      fieldErrors.managementFee ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                    }`}
                    dir="ltr"
                  />
                  {fieldErrors.managementFee && (
                    <p data-testid="field-error-mgmt-fee" className="text-red-600 text-xs mt-1 font-bold">
                      {fieldErrors.managementFee}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Amenities */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>{t('property.amenities', 'Amenities')}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('amenity.selected_count', `Selected (${formData.amenities.length})`).replace('{count}', formData.amenities.length.toString())}
                </p>
              </div>

              {/* Quick Select Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = filteredAmenities.map(a => a.id);
                    const combined = Array.from(new Set([...formData.amenities, ...allIds]));
                    setFormData({ ...formData, amenities: combined });
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  {t('amenity.select_all', 'Select All')}
                </button>
                {formData.amenities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, amenities: [] })}
                    className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                  >
                    {t('amenity.clear_all', 'Clear Selection')}
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
                {[
                  { id: 'all', label: t('amenity.cat.all', 'All') },
                  { id: 'utilities', label: t('amenity.cat.utilities', 'Utilities & Power') },
                  { id: 'comfort', label: t('amenity.cat.comfort', 'Comfort & Spaces') },
                  { id: 'lifestyle', label: t('amenity.cat.lifestyle', 'Leisure & Luxury') },
                  { id: 'safety', label: t('amenity.cat.safety', 'Safety & Access') },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAmenityCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      amenityCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[180px]">
                <Search className={`w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  placeholder={t('amenity.search_placeholder', 'Search amenities...')}
                  value={amenitySearch}
                  onChange={e => setAmenitySearch(e.target.value)}
                  className={`w-full py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 ${
                    direction === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                  }`}
                />
              </div>
            </div>

            {/* Amenity Pills Grid */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              {filteredAmenities.map(amenity => {
                const isSelected = formData.amenities.includes(amenity.id);
                const IconComponent = amenity.icon;
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => {
                      const am = formData.amenities;
                      if (isSelected) setFormData({ ...formData, amenities: am.filter(a => a !== amenity.id) });
                      else setFormData({ ...formData, amenities: [...am, amenity.id] });
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer select-none active:scale-95 ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-102 ring-2 ring-blue-200' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                    <span>{amenity.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-white stroke-[3]" />
                    )}
                  </button>
                );
              })}

              {filteredAmenities.length === 0 && (
                <div className="w-full py-8 text-center text-xs text-slate-400">
                  {t('common.no_results', 'No amenities found matching your search.')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Photos & Media */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  <span>{t('property.photos.title', 'Property Pictures & Media')}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('property.photos.subtitle', 'Add pictures of your property so that tenants can see and explore the rooms, kitchen, and exterior.')}
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
                {t('property.photos.count_badge', `Photos Added (${formData.photos.length})`).replace('{count}', formData.photos.length.toString())}
              </span>
            </div>

            {/* Tenant Visibility Notice Alert */}
            <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-start gap-3 text-xs text-sky-950">
              <Eye className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {t('property.photos.tenant_notice', 'Visible to Tenants: The primary cover photo and gallery will be displayed on the tenant dashboard, digital lease overview, and property inspections.')}
              </p>
            </div>

            {/* Upload Box (Drag and Drop / File Input) */}
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 sm:p-8 text-center transition-colors bg-slate-50/60 hover:bg-blue-50/20 group">
              <input
                type="file"
                id="property-photo-upload"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="property-photo-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-sm font-extrabold text-blue-700 hover:underline block">
                    {t('property.photos.upload_btn', 'Upload from Computer / Device')}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('property.photos.drag_drop', 'Drag and drop photos here, or click to browse files')}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {t('property.photos.supported_formats', 'Supports JPG, PNG, WEBP (Multiple images allowed)')}
                </span>
              </label>
            </div>

            {photoUploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                {photoUploadError}
              </div>
            )}

            {/* Add by Web URL Bar */}
            <form onSubmit={handleAddPhotoUrl} className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
                <input
                  type="url"
                  placeholder={t('property.photos.url_placeholder', 'Paste image URL (e.g. https://...)...')}
                  value={photoUrlInput}
                  onChange={e => setPhotoUrlInput(e.target.value)}
                  className={`w-full py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 ${
                    direction === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={!photoUrlInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('property.photos.add_url_btn', 'Add URL')}</span>
              </button>
            </form>

            {/* Quick Presets / Samples Strip */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-600 block">
                {t('property.photos.sample_presets', 'Or choose from high-resolution sample photos:')}
              </span>
              <div className="flex flex-wrap gap-2">
                {samplePhotoPresets.map((preset, idx) => {
                  const isAdded = formData.photos.includes(preset.url);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (!isAdded) {
                          setFormData(prev => ({
                            ...prev,
                            photos: [...prev.photos, preset.url]
                          }));
                        }
                      }}
                      disabled={isAdded}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isAdded 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{preset.title}</span>
                      {isAdded && <Check className="w-3 h-3 text-emerald-600 ms-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Uploaded Photos Gallery Grid */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>{t('property.photos', 'Photos')} ({formData.photos.length})</span>
                {formData.photos.length > 0 && (
                  <span className="text-xs text-slate-400 font-normal">
                    {t('property.photos.first_is_cover', 'The first photo is automatically used as the main cover photo.')}
                  </span>
                )}
              </h3>

              {formData.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {formData.photos.map((photoUrl, idx) => (
                    <div 
                      key={idx} 
                      className={`group relative rounded-2xl overflow-hidden border-2 bg-slate-900 transition-all shadow-xs ${
                        idx === 0 ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="h-36 sm:h-40 w-full overflow-hidden">
                        <img
                          src={photoUrl}
                          alt={`Property photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Cover Badge */}
                      {idx === 0 ? (
                        <div className="absolute top-2.5 start-2.5 bg-blue-600/90 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                          <span>{t('property.photos.cover_badge', 'Cover Photo')}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetCoverPhoto(idx)}
                          className="absolute top-2.5 start-2.5 bg-black/60 hover:bg-black/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                        >
                          <Star className="w-3 h-3 text-amber-300" />
                          <span>{t('property.photos.set_cover', 'Set as Cover')}</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-2.5 end-2.5 w-7 h-7 bg-black/60 hover:bg-rose-600 backdrop-blur-xs text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        title={t('property.photos.delete', 'Remove')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Bottom index bar */}
                      <div className="absolute bottom-2 end-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Camera className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {t('property.photos.no_photos', 'No photos added yet. Upload pictures or pick from sample photos above so tenants can view your property.')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Ownership Claim */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <span>{t('property.ownership_claim', 'Ownership Claim')}</span>
            </h2>
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-xs sm:text-sm text-blue-900 leading-relaxed font-medium">
              {t(
                'property.ownership_share_desc',
                'Specify your exact ownership share. Under HomeHub governance, ownership must be backed by official title deed documentation.'
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {t('property.ownership_percentage', 'Ownership Percentage (%)')}
              </label>
              <div className="relative max-w-xs">
                <input 
                  type="number" 
                  min="1" max="100"
                  value={formData.ownershipPercentage}
                  onChange={e => setFormData({ ...formData, ownershipPercentage: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-slate-400 font-bold ${
                  direction === 'rtl' ? 'left-3' : 'right-3'
                }`}>
                  %
                </span>
              </div>
            </div>
            <div className="mt-4 p-4 border rounded-xl bg-slate-50 border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>{t('property.actual_owner', 'Actual Owner')}</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">{t('property.for_agents_admins', 'For Agents / Admins')}</span>
              </label>
              <p className="text-xs text-slate-500 mb-4">
                {t('property.actual_owner_desc', 'If you are adding this property on behalf of a client, select their type and enter their ID.')}
              </p>
              
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="ownerType"
                    checked={formData.ownerType === 'INDIVIDUAL'}
                    onChange={() => setFormData({ ...formData, ownerType: 'INDIVIDUAL', companyId: '' })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  {t('property.owner_individual', 'Individual (User ID)')}
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="ownerType"
                    checked={formData.ownerType === 'COMPANY'}
                    onChange={() => setFormData({ ...formData, ownerType: 'COMPANY', ownerId: '' })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  {t('property.owner_company', 'Company (Company ID)')}
                </label>
              </div>

              {formData.ownerType === 'INDIVIDUAL' ? (
                <input 
                  type="text"
                  placeholder={t('property.ph_owner_id', 'Enter Actual Owner User ID...')}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  value={formData.ownerId}
                  onChange={e => setFormData({ ...formData, ownerId: e.target.value })}
                />
              ) : (
                <input 
                  type="text"
                  placeholder={t('property.ph_company_id', 'Enter Actual Owner Company ID...')}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  value={formData.companyId}
                  onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                />
              )}
            </div>

            <hr className="border-slate-200 my-8" />

            <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <span>{t('property.documents', 'Legal & Ownership Documents')}</span>
            </h2>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium mb-4">
              {t('property.documents_desc', 'Upload title deeds, ownership documents, legal documents, or contract attachments.')}
            </div>

            <div className="space-y-3">
              {formData.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <span className="text-lg">📄</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{doc.fileName}</p>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{doc.documentType}</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }))}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select 
                id="docTypeSelect"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white"
              >
                <option value="Title Deed (تاپۆ)">{t('property.doc_title_deed', 'Title Deed (تاپۆ)')}</option>
                <option value="Ownership Document (بەڵگەنامەی خاوەندارێتی)">{t('property.doc_ownership', 'Ownership Document (بەڵگەنامەی خاوەندارێتی)')}</option>
                <option value="Legal Document (بەڵگەنامەی یاسایی)">{t('property.doc_legal', 'Legal Document (بەڵگەنامەی یاسایی)')}</option>
                <option value="Contract / Document Attachment (گرێبەست / هاوپێچ)">{t('property.doc_contract', 'Contract / Document Attachment (گرێبەست / هاوپێچ)')}</option>
              </select>
              <div className="relative w-full">
                <input 
                  type="file" 
                  id="document-upload" 
                  className="hidden" 
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const typeSelect = document.getElementById('docTypeSelect') as HTMLSelectElement;
                    const docType = typeSelect.value;
                    
                    // Add the selected file to documents state
                    setFormData(prev => ({
                      ...prev,
                      documents: [...prev.documents, { fileName: file.name, documentType: docType }]
                    }));
                    
                    // Reset input so the same file can be selected again if needed
                    e.target.value = '';
                  }}
                />
                <label 
                  htmlFor="document-upload"
                  className="w-full h-full min-h-[42px] px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {t('property.add_document', 'Add Document +')}
                </label>
              </div>
            </div>
          </div>
        )}

                {/* Step 7: Operating Model & Financials */}
        {currentStep === 7 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>{t('property.management_assignment', 'Operating Model & Financials')}</span>
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                {t('property.management_desc', 'Select the operating model and define the property-specific agreed fees.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                type="button"
                data-testid="op-model-fully-managed"
                onClick={() => {
                  setFormData({ 
                    ...formData, 
                    operatingModel: 'FULLY_MANAGED',
                    rentFee: '', 
                    managementFee: '' 
                  });
                }}
                className={`p-4 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col h-full ${
                  formData.operatingModel === 'FULLY_MANAGED'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${formData.operatingModel === 'FULLY_MANAGED' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{t('property.model.fully_managed_title', 'Fully Managed / Platform-Operated')}</h3>
                <p className="text-[11px] leading-relaxed text-slate-500 flex-grow mb-3">
                  {t('property.model.fully_managed_desc', 'HomeHub directly leases the property and assumes responsibility for the complete rental and management lifecycle.')}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 w-full text-[10px] font-bold text-slate-600">
                  <span className="text-emerald-600">{t('property.model.fully_managed_badge', 'All Fees Apply (Platform, Rent, Mgmt)')}</span>
                </div>
              </button>

              <button
                type="button"
                data-testid="op-model-agent-listed"
                onClick={() => {
                  setFormData({ 
                    ...formData, 
                    operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
                    rentFee: '' 
                  });
                }}
                className={`p-4 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col h-full ${
                  formData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${formData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED' ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{t('property.model.agent_listed_title', 'Agent Listed, Platform Managed')}</h3>
                <p className="text-[11px] leading-relaxed text-slate-500 flex-grow mb-3">
                  {t('property.model.agent_listed_desc', 'The Agent secures the property and tenant. HomeHub takes responsibility for ongoing property management.')}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 w-full text-[10px] font-bold text-slate-600">
                  <span className="text-blue-600">{t('property.model.agent_listed_badge', 'Platform + Mgmt Fee (No Rent Fee)')}</span>
                </div>
              </button>

              <button
                type="button"
                data-testid="op-model-agent-operated"
                onClick={() => {
                  setFormData({ 
                    ...formData, 
                    operatingModel: 'AGENT_OPERATED',
                    rentFee: '', 
                    managementFee: '' 
                  });
                }}
                className={`p-4 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col h-full ${
                  formData.operatingModel === 'AGENT_OPERATED'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${formData.operatingModel === 'AGENT_OPERATED' ? 'bg-blue-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{t('property.model.agent_operated_title', 'Managed by Agent')}</h3>
                <p className="text-[11px] leading-relaxed text-slate-500 flex-grow mb-3">
                  {t('property.model.agent_operated_desc', 'The Agent independently controls the rental lifecycle and full daily operations.')}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 w-full text-[10px] font-bold text-slate-600">
                  <span className="text-rose-600">{t('property.model.agent_operated_badge', 'Platform Fee ONLY (No Rent/Mgmt Fee)')}</span>
                </div>
              </button>
            </div>

            {/* Strict Dynamic Fee Info Box based on model */}
            {formData.operatingModel && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
                <h4 className="text-sm font-bold text-slate-800 mb-2">
                  {t('property.model.agreed_fees', 'Agreed Property Fees')}
                </h4>
                <p className="text-xs text-slate-600 mb-5">
                  {formData.operatingModel === 'FULLY_MANAGED' && t('property.model.fully_managed_info', 'HomeHub receives all three applicable fees (Platform, Rent, and Management). Please enter the manually agreed property-specific Rent Fee and Management Fee below. (Note: Global Platform Fee is applied automatically at the platform level).')}
                  {formData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED' && t('property.model.agent_listed_info', 'The Agent pays the Platform Fee and Management Fee, but does NOT pay the Rent Fee (as they secured the listing/tenant). Please enter the manually agreed property-specific Management Fee below.')}
                  {formData.operatingModel === 'AGENT_OPERATED' && t('property.model.agent_operated_info', 'The Agent pays ONLY the Platform Fee. They do NOT pay Rent Fee or Management Fee. (Note: Global Platform Fee is applied automatically at the platform level).')}
                </p>

                {(formData.operatingModel === 'AGENT_OPERATED' || formData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') && (
                  <div className="mb-5">
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      {t('property.select_agent_id', 'Assigned Agent / Company ID')}
                    </label>
                    <input 
                      type="text"
                      placeholder={t('property.ph_organization_id', 'Enter Agent Organization ID')}
                      className="w-full max-w-sm px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                      value={formData.managedByAgentId === 'agent-id-placeholder' ? '' : formData.managedByAgentId}
                      onChange={e => setFormData({ ...formData, managedByAgentId: e.target.value })}
                    />
                  </div>
                )}

                {/* Manual Fee Inputs (No defaults, no placeholders indicating defaults) */}
                {formData.operatingModel !== 'AGENT_OPERATED' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        {t('property.mgmt_fee_agreed', 'Agreed Management Fee Rate')} <span className="text-red-500 ms-1">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          data-testid="agreed-mgmt-fee-input"
                          placeholder="0.00"
                          value={formData.managementFee}
                          onChange={e => {
                            setFormData({ ...formData, managementFee: e.target.value });
                            if (fieldErrors.managementFee) setFieldErrors(prev => ({ ...prev, managementFee: '' }));
                          }}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium ${
                            fieldErrors.managementFee ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                          }`}
                          dir="ltr"
                        />
                      </div>
                      {fieldErrors.managementFee && (
                        <p data-testid="field-error-mgmt-fee" className="text-red-600 text-xs mt-1 font-bold">
                          {fieldErrors.managementFee}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">{t('property.mgmt_fee_desc', 'Property-specific fee for day-to-day operations.')}</p>
                    </div>
                    
                    {formData.operatingModel === 'FULLY_MANAGED' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          {t('property.rent_fee_agreed', 'Agreed Rent Fee Rate')} <span className="text-red-500 ms-1">*</span>
                        </label>
                        <input 
                          type="number" 
                          step="0.01"
                          data-testid="agreed-rent-fee-input"
                          placeholder="0.00"
                          value={formData.rentFee}
                          onChange={e => {
                            setFormData({ ...formData, rentFee: e.target.value });
                            if (fieldErrors.rentFee) setFieldErrors(prev => ({ ...prev, rentFee: '' }));
                          }}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium ${
                            fieldErrors.rentFee ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                          }`}
                          dir="ltr"
                        />
                        {fieldErrors.rentFee && (
                          <p data-testid="field-error-rent-fee" className="text-red-600 text-xs mt-1 font-bold">
                            {fieldErrors.rentFee}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1">{t('property.rent_fee_desc', 'Property-specific fee for tenant leasing.')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 8: Review & Confirmation */}
        {currentStep === 8 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-black text-slate-900 mb-4">
              {t('property.review_submit', 'Review & Submit')}
            </h2>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
              {/* Cover Photo Banner in Review */}
              {formData.photos.length > 0 && (
                <div className="space-y-2 pb-4 border-b border-slate-200">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t('property.photos', 'Photos')} ({formData.photos.length})
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {formData.photos.slice(0, 4).map((pUrl, i) => (
                      <div key={i} className="relative h-24 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                        <img src={pUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute bottom-1.5 start-1.5 text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded shadow">
                            {t('property.photos.cover_badge', 'Cover')}
                          </span>
                        )}
                        {i === 3 && formData.photos.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs">
                            +{formData.photos.length - 4}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.type', 'Type')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.type 
                      ? t(`property.type.${formData.type.toLowerCase()}`, formData.type) 
                      : t('common.not_specified', 'Not specified')}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.name', 'Name')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.name || t('common.not_specified', 'Not specified')}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.address', 'Address')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.address.street || formData.address.city 
                      ? `${formData.address.street}${formData.address.street && formData.address.city ? ', ' : ''}${formData.address.city}`
                      : t('common.not_specified', 'Not specified')}
                  </span>
                </div>
                {formData.amenities.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      {t('property.amenities', 'Amenities')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {formData.amenities.map(a => (
                        <span key={a} className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                          {t(a, a)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {formData.documents && formData.documents.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      {t('property.documents', 'Documents')} ({formData.documents.length})
                    </span>
                    <div className="flex flex-col gap-2">
                      {formData.documents.map((d, i) => (
                        <div key={i} className="text-xs p-2 bg-slate-100 rounded-lg flex justify-between">
                          <span className="font-bold text-slate-800">{d.fileName}</span>
                          <span className="text-slate-500 font-medium">{d.documentType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.actual_owner', 'Actual Owner')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {(formData as any).ownerType === 'INDIVIDUAL' && formData.ownerId ? formData.ownerId : (formData as any).ownerType === 'COMPANY' && (formData as any).companyId ? (formData as any).companyId : t('property.owner_self', 'Self / Default')}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.operating_model', 'Operating Model')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.operatingModel === 'FULLY_MANAGED' ? t('property.fully_managed', 'Fully Managed (HomeHub operates)') :
                     formData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED' ? t('property.agent_listed', 'Agent Listed, Platform Managed') :
                     formData.operatingModel === 'AGENT_OPERATED' ? t('property.agent_operated', 'Agent Operated Entirely') :
                     t('common.not_specified', 'Not specified')}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.management', 'Management')}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.managedByAgentId ? formData.managedByAgentId : t('property.managed_by_platform', 'HomeHub Platform')}
                  </span>
                </div>
                {formData.operatingModel !== 'AGENT_OPERATED' && formData.operatingModel !== 'AGENT_LISTED_PLATFORM_MANAGED' && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {t('property.rent_fee', 'Rent Fee')}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formData.rentFee ? <span dir="ltr">{(parseFloat(formData.rentFee) * 100).toFixed(1)}%</span> : t('common.not_specified', 'Not specified')}
                    </span>
                  </div>
                )}
                {formData.operatingModel !== 'AGENT_OPERATED' && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {t('property.mgmt_fee', 'Management Fee')}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formData.managementFee ? <span dir="ltr">{(parseFloat(formData.managementFee) * 100).toFixed(1)}%</span> : t('common.not_specified', 'Not specified')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.ownership', 'Ownership')}
                  </span>
                  <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md inline-block" dir="ltr">
                    {formData.ownershipPercentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer Controls */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button 
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 0 || loading}
          className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-colors text-sm"
        >
          {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          <span>{t('action.back', 'Back')}</span>
        </button>

        {currentStep < STEPS_KEYS.length - 1 ? (
          <button 
            type="button"
            data-testid="add-property-next-btn"
            onClick={handleNext}
            disabled={currentStep === 0 && !formData.type}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-colors text-sm shadow-xs"
          >
            <span>{t('action.next', 'Next')}</span>
            {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <button 
            type="button"
            data-testid="add-property-submit-btn"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-colors text-sm shadow-md"
          >
            <span>
              {loading 
                ? t('property.submitting', 'Submitting...') 
                : t('property.submit_property', 'Submit Property')}
            </span>
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};









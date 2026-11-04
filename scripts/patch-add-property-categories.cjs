const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/AddPropertyPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Step 0 Type Selection
const targetStep0Regex = /\{\/\* Step 0: Type Selection \*\/\}[\s\S]*?\{\/\* Step 1: Basic Information \*\/\}/;

const newStep0 = `{/* Step 0: Type Selection */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-white mb-1.5">
                {t('property.type.question', 'What type of property is this?')}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'ku' 
                  ? 'جۆری دروستی موڵکەکە هەڵبژێرە بۆ ئەوەی ڕاستەوخۆ لە بەشی گەڕانی گونجاودا دەربکەوێت' 
                  : language === 'ar' 
                  ? 'اختر النوع الدقيق للعقار ليظهر مباشرة في فئة البحث المناسبة' 
                  : 'Select the exact property type to ensure it appears in the matching search category'}
              </p>
            </div>

            {/* Core Residential & Commercial Categories (Search Tabs) */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                {t('home.tab_all', 'Core Property Categories')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: 'Apartment', icon: Building2, label: t('property.type.apartment_short', 'Apartment'), desc: t('home.tab_apartments', 'Apartments') },
                  { id: 'House', icon: Home, label: t('property.type.house', 'House'), desc: t('home.tab_houses', 'Houses') },
                  { id: 'Villa', icon: Building, label: t('property.type.villa_short', 'Villa'), desc: t('home.tab_villas', 'Villas') },
                  { id: 'Commercial', icon: Store, label: t('property.type.commercial_short', 'Commercial'), desc: t('home.tab_commercial', 'Commercial') },
                ].map(type => {
                  const isSelected = formData.type?.toUpperCase() === type.id.toUpperCase();
                  return (
                    <button 
                      key={type.id}
                      type="button"
                      data-testid={\`property-type-\${type.id.toLowerCase()}\`}
                      onClick={() => setFormData({ ...formData, type: type.id })}
                      className={\`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer text-center \${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-950/40 scale-[1.02] ring-1 ring-amber-500/30' 
                          : 'border-slate-800 hover:border-amber-500/40 text-slate-300 bg-[#111b2e] hover:bg-[#17243a]'
                      }\`}
                    >
                      <type.icon className="w-7 h-7 text-amber-400" />
                      <span className="font-bold text-sm">{type.label}</span>
                      <span className="text-[11px] text-slate-400 font-normal">{type.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Other Rental Types (Matching Search "More" Dropdown) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {t('home.other_rental_types', 'Other Rental Types')}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                  {t('home.hero_title_highlight', 'Rental')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: 'Studio', icon: Bed, label: t('home.rental_type_studio', 'Studio Apartment'), desc: t('home.rental_desc_studio', 'Compact studio & single-room rentals') },
                  { id: 'Office', icon: Briefcase, label: t('home.rental_type_office', 'Office Space'), desc: t('home.rental_desc_office', 'Commercial & corporate offices') },
                  { id: 'Warehouse', icon: Warehouse, label: t('home.rental_type_warehouse', 'Warehouse & Storage'), desc: t('home.rental_desc_warehouse', 'Storage facilities & logistics hubs') },
                  { id: 'Duplex', icon: Layers, label: t('home.rental_type_duplex', 'Duplex'), desc: t('home.rental_desc_duplex', 'Two-story rental residences') },
                  { id: 'Residential', icon: Building, label: t('home.rental_type_residential', 'Residential Building'), desc: t('home.rental_desc_residential', 'Full multi-unit rental buildings') },
                ].map(type => {
                  const isSelected = formData.type?.toUpperCase() === type.id.toUpperCase();
                  return (
                    <button 
                      key={type.id}
                      type="button"
                      data-testid={\`property-type-\${type.id.toLowerCase()}\`}
                      onClick={() => {
                        const updates = { type: type.id };
                        if (type.id === 'Office') updates.commercialUse = 'OFFICE';
                        if (type.id === 'Warehouse') updates.industrialUse = 'WAREHOUSE';
                        if (type.id === 'Studio' && !formData.bedrooms) updates.bedrooms = '1';
                        if (type.id === 'Duplex' && !formData.totalFloors) updates.totalFloors = '2';
                        setFormData({ ...formData, ...updates });
                      }}
                      className={\`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer text-center \${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-950/40 scale-[1.02] ring-1 ring-amber-500/30' 
                          : 'border-slate-800 hover:border-amber-500/40 text-slate-300 bg-[#111b2e] hover:bg-[#17243a]'
                      }\`}
                    >
                      <type.icon className="w-7 h-7 text-amber-400" />
                      <span className="font-bold text-sm">{type.label}</span>
                      <span className="text-[11px] text-slate-400 font-normal">{type.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Basic Information */}`;

if (!targetStep0Regex.test(content)) {
  console.error('Failed to match Step 0 regex');
  process.exit(1);
}
content = content.replace(targetStep0Regex, newStep0);

// 2. Update Step 3 Dynamic Specifications
content = content.replace(
  "formData.type?.toUpperCase() === 'COMMERCIAL' ?",
  "(['COMMERCIAL', 'OFFICE'].includes(formData.type?.toUpperCase() || '')) ?"
);

content = content.replace(
  ") : formData.type?.toUpperCase() === 'INDUSTRIAL' ?",
  ") : (['INDUSTRIAL', 'WAREHOUSE'].includes(formData.type?.toUpperCase() || '')) ?"
);

content = content.replace(
  "{(formData.type === 'Apartment' || formData.type?.toUpperCase() === 'APARTMENT') && (",
  "{((['APARTMENT', 'STUDIO', 'RESIDENTIAL'].includes(formData.type?.toUpperCase() || ''))) && ("
);

content = content.replace(
  "{(formData.type === 'Villa' || formData.type?.toUpperCase() === 'VILLA' || formData.type?.toUpperCase() === 'HOUSE') && (",
  "{((['VILLA', 'HOUSE', 'DUPLEX'].includes(formData.type?.toUpperCase() || ''))) && ("
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched AddPropertyPage.tsx');


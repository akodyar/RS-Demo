const fs = require('fs');
let c = fs.readFileSync('src/pages/AddPropertyPage.tsx', 'utf8');

c = c.replace(
  `<div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.name', 'Name')}
                  </span>
                  <span data-testid="review-property-type" className="font-bold text-white">
                    {formData.name || t('common.not_specified', 'Not specified')}`,
  `<div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.name', 'Name')}
                  </span>
                  <span data-testid="review-property-name" className="font-bold text-white">
                    {formData.name || t('common.not_specified', 'Not specified')}`
);

c = c.replace(
  `<div className="sm:col-span-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.address', 'Address')}
                  </span>
                  <span data-testid="review-property-type" className="font-bold text-white">`,
  `<div className="sm:col-span-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t('property.address', 'Address')}
                  </span>
                  <span data-testid="review-property-address" className="font-bold text-white">`
);

c = c.replace(
  `<span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {t('property.rent_fee', 'Rent Fee')}
                    </span>
                    <span data-testid="review-property-type" className="font-bold text-white">`,
  `<span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {t('property.rent_fee', 'Rent Fee')}
                    </span>
                    <span data-testid="review-rent-fee" className="font-bold text-white">`
);

fs.writeFileSync('src/pages/AddPropertyPage.tsx', c, 'utf8');
console.log('Fixed testids successfully');


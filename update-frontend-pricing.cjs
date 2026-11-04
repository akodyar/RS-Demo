const fs = require('fs');
let file = 'src/pages/AddPropertyPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add suggestedTier state and fetch logic
const fetchLogic = `
  const [pricingTierInfo, setPricingTierInfo] = useState<any>(null);

  React.useEffect(() => {
    fetch('/api/properties/pricing-tier', {
      headers: { 'Authorization': \`Bearer dev-platform_admin\` }
    })
    .then(res => res.json())
    .then(data => setPricingTierInfo(data))
    .catch(console.error);
  }, []);
`;

content = content.replace(
  'const [success, setSuccess] = useState(false);',
  'const [success, setSuccess] = useState(false);' + fetchLogic
);

// 2. Add UI for Suggested Tier
const uiLogic = `
                {/* Pricing Tier Display */}
                {pricingTierInfo && pricingTierInfo.tier && (
                  <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <h4 className="text-blue-900 font-bold mb-2">Applicable Pricing Tier: {pricingTierInfo.tier.name}</h4>
                    <p className="text-sm text-blue-700">Based on your portfolio of {pricingTierInfo.propertyCount} verified properties, you qualify for {pricingTierInfo.tier.name}.</p>
                    <p className="text-sm text-blue-700 mt-1">Suggested Rent Fee: {pricingTierInfo.tier.rentFeeRate} | Suggested Management Fee: {pricingTierInfo.tier.managementFeeRate}</p>
                  </div>
                )}
`;

content = content.replace(
  '<h3 className="text-xl font-bold text-slate-900 mb-6">{t(\'property.financial_setup\', \'Financial Setup\')}</h3>',
  '<h3 className="text-xl font-bold text-slate-900 mb-6">{t(\'property.financial_setup\', \'Financial Setup\')}</h3>' + uiLogic
);

fs.writeFileSync(file, content, 'utf8');

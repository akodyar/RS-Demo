const fs = require('fs');

let s = fs.readFileSync('src/pages/OwnerWorkspace.tsx', 'utf8');

s = s.replace(/>May</g, ">{t('time.may', 'May')}<");
s = s.replace(/>Jun</g, ">{t('time.jun', 'Jun')}<");
s = s.replace(/>Jul</g, ">{t('time.jul', 'Jul')}<");
s = s.replace(/>Aug</g, ">{t('time.aug', 'Aug')}<");
s = s.replace(/>Sep</g, ">{t('time.sep', 'Sep')}<");
s = s.replace(/>Oct</g, ">{t('time.oct', 'Oct')}<");

s = s.replace(/>Portfolio Properties</g, ">{t('owner.portfolio_properties', 'Portfolio Properties')}<");
s = s.replace(/>Loading properties...</g, ">{t('ui.loading', 'Loading properties...')}<");
s = s.replace(/>Unable to fetch real properties</g, ">{t('property.error.fetch', 'Unable to fetch real properties')}<");

s = s.replace(/>Type</g, ">{t('property.type', 'Type')}<");
s = s.replace(/>Units</g, ">{t('property.units', 'Units')}<");
s = s.replace(/>Health</g, ">{t('property.health', 'Health')}<");
s = s.replace(/'Unnamed Property'/g, "t('property.unnamed', 'Unnamed Property')");
s = s.replace(/'DRAFT'/g, "t('status.draft', 'DRAFT')");

// AI Mock replacement
const aiMockRegex = /<div className="relative z-10 bg-white\/10 backdrop-blur-sm border border-white\/20 rounded-lg p-4 mb-4">[\s\S]*?<\/div>/;

const aiReplacement = `
<div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 mb-4 text-center">
  <p className="text-sm text-slate-100">{t('ui.no_data', 'No AI insights available at this time.')}</p>
</div>
`;

s = s.replace(aiMockRegex, aiReplacement);
s = s.replace(/>AI insights do not execute actions automatically.</g, ">{t('analytics.ai_disclaimer', 'AI insights do not execute actions automatically.')}<");

// Alert Mock replacement
const alertMockRegex = /<div className="flex flex-col gap-3">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const alertReplacement = `
<div className="flex flex-col gap-3">
  <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">
    {t('ui.no_data', 'No active alerts.')}
  </div>
</div>
</div>
</div>
`;

s = s.replace(alertMockRegex, alertReplacement);

fs.writeFileSync('src/pages/OwnerWorkspace.tsx', s);
console.log('Owner mocks wiped.');

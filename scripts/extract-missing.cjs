const fs = require('fs');

const missingFiles = [
  'src/components/OwnerSettlementTab.tsx',
  'src/components/tenant/TenantModals.tsx',
  'src/pages/AddPropertyPage.tsx',
  'src/pages/PropertyDetailPage.tsx'
];

const results = [];
const re = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g;

for (const file of missingFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(content)) !== null) {
    results.push({ file, key: m[1], fallback: m[2] });
  }
}

console.log(JSON.stringify(results, null, 2));


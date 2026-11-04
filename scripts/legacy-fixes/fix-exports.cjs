const fs = require('fs');

function fix(filepath, wrong, right) {
  let s = fs.readFileSync(filepath, 'utf8');
  s = s.replace(wrong, right);
  fs.writeFileSync(filepath, s);
}

fix('src/pages/MarketplacePage.tsx', 'export const MarketplacePagePage', 'export const MarketplacePage');


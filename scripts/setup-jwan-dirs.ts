import fs from 'fs';
import path from 'path';

const baseDir = path.resolve(process.cwd(), 'screenshots/تێستی جوان');
const subdirs = [
  '01-accounts-and-auth',
  '02-properties-and-listings',
  '03-leases-and-financials',
  '04-points-services-reviews',
  '05-mobile-rtl-concurrency',
];

for (const sub of subdirs) {
  const fullPath = path.join(baseDir, sub);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

console.log('Successfully initialized screenshots directories in:', baseDir);


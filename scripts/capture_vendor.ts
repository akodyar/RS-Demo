import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const artifactDir = path.resolve('scratch');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('Navigating to http://localhost:3000/workspace/vendor...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('homehub_auth_persona', JSON.stringify({
      uid: 'dev-vendor-123',
      email: 'vendor@homehub.iq',
      displayName: 'Omar Hassan',
      role: 'VENDOR',
    }));
  });
  await page.goto('http://localhost:3000/workspace/vendor', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.log('Wait timeout:', e.message));
  
  await page.waitForTimeout(2000);
  const screenshotPath = path.join(artifactDir, 'vendor_current_1440.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);
  
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
  console.error(err);
  process.exit(1);
});

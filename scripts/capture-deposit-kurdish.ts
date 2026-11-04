import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/localization_fixes';
const localDir = path.resolve(process.cwd(), 'screenshots/localization_fixes');

async function run() {
  const OWNER = { id: 'user_owner_01', email: 'owner@example.com', roles: ['PROPERTY_OWNER', 'OWNER'], name: 'Rebaz Owner' };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ku' });
  const page = await context.newPage();

  const token = jwt.sign(
    { id: OWNER.id, email: OWNER.email, roles: OWNER.roles, tokenVersion: 1 },
    jwtSecret
  );

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('homehub_auth_token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('homehub_user', JSON.stringify(user));
    localStorage.setItem('homehub_lang', 'ku');
    localStorage.setItem('homehub_language', 'ku');
    localStorage.setItem('i18nextLng', 'ku');
  }, { token, user: OWNER });

  await page.goto('http://localhost:3000/workspace/owner?lang=ku', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click on the Leases tab ("کرێچی")
  const leasesNavBtn = page.locator('button:has-text("کرێچی"), a:has-text("کرێچی")').first();
  if (await leasesNavBtn.isVisible()) {
    await leasesNavBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click on the Deposit button ("بارمتە و پشکنین")
  const depositBtn = page.locator('button:has-text("بارمتە و پشکنین"), button:has-text("بارمتە")').first();
  if (await depositBtn.isVisible()) {
    await depositBtn.click();
    await page.waitForTimeout(1200);
  }

  const filename = '10_owner_deposit_modal_kurdish.png';
  const localPath = path.join(localDir, filename);
  const artifactPath = path.join(artifactDir, filename);

  await page.screenshot({ path: localPath, fullPage: false });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`[PASS] Captured ${filename}`);

  await browser.close();
}

run()
  .then(() => process.exit(0))
  .catch(console.error);

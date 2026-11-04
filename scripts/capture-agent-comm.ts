import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/localization_fixes';
const localDir = path.resolve(process.cwd(), 'screenshots/localization_fixes');

async function run() {
  const AGENT = { id: 'user_agent_01', email: 'agent@homehub.iq', roles: ['AGENT', 'AGENT_BROKER'], name: 'Dara Agent' };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ku' });
  const page = await context.newPage();

  const token = jwt.sign(
    { id: AGENT.id, email: AGENT.email, roles: AGENT.roles, tokenVersion: 1 },
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
  }, { token, user: AGENT });

  await page.goto('http://localhost:3000/workspace/agent?lang=ku', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click Commissions tab
  const commBtn = page.locator('button:has-text("ڕەسمی دەڵاڵی"), button:has-text("کۆمیسیۆن")').first();
  if (await commBtn.isVisible()) {
    await commBtn.click();
    await page.waitForTimeout(1000);
  }

  const filename = '05_agent_commissions_kurdish.png';
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

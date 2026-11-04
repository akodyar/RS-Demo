import { chromium } from 'playwright';
import { signAuthToken } from '../src/server/utils/auth.js';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  const authToken = signAuthToken({
    id: 'user_owner_01',
    email: 'owner@homehub.iq',
    roles: ['PROPERTY_OWNER'],
    activeRole: 'PROPERTY_OWNER',
  });

  await page.addInitScript((token) => {
    window.localStorage.setItem('auth_token', token);
    window.localStorage.setItem('homehub_auth_token', token);
    window.localStorage.setItem('homehub_auth_persona', JSON.stringify({
      id: 'user_owner_01',
      email: 'owner@homehub.iq',
      roles: ['PROPERTY_OWNER'],
      activeRole: 'PROPERTY_OWNER',
      name: 'Salar Aziz',
    }));
  }, authToken);

  console.log('1. Navigating to /properties/add');
  await page.goto('http://localhost:3000/properties/add', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="property-type-apartment"]', { timeout: 10000 });
  console.log('2. Step 0 loaded');

  // Select apartment
  await page.click('[data-testid="property-type-apartment"]');
  console.log('3. Selected apartment');

  for (let s = 0; s < 8; s++) {
    console.log(`Advancing from step ${s}...`);
    if (s === 1) {
      await page.waitForSelector('[data-testid="property-name"]', { timeout: 5000 });
      await page.fill('[data-testid="property-name"]', 'Test Penthouse Suite');
      await page.fill('[data-testid="property-price"]', '1500');
    }
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(600);
  }

  await page.waitForSelector('[data-testid="review-property-type"]', { timeout: 5000 });
  const reviewText = await page.locator('[data-testid="review-property-type"]').innerText();
  console.log('4. Reached Step 8! Review Type:', reviewText);

  const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
  await submitBtn.scrollIntoViewIfNeeded();
  await submitBtn.click();

  await page.waitForSelector('[data-testid="property-create-success"]', { timeout: 10000 });
  console.log('5. Submitted successfully!');

  await browser.close();
}

test().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});


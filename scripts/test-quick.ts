import { chromium } from 'playwright';
import pg from 'pg';

const { Pool } = pg;
const dbPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/homehub_test' });

async function test() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'dev-owner');
    window.localStorage.setItem('homehub_auth_token', 'dev-owner');
    window.localStorage.setItem('homehub_lang', 'en');
    window.localStorage.setItem('homehub_auth_persona', JSON.stringify({
      id: 'user_owner_01',
      email: 'owner@homehub.iq',
      roles: ['PROPERTY_OWNER'],
      activeRole: 'PROPERTY_OWNER',
      name: 'Salar Aziz',
    }));
  });

  console.log('1. Navigating to /properties/add');
  await page.goto('http://localhost:3000/properties/add', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="property-type-apartment"]', { timeout: 10000 });
  console.log('2. Step 0 ready');

  await page.locator('[data-testid="property-type-apartment"]').click();
  console.log('3. Clicked property-type-apartment');
  await page.waitForTimeout(300);

  // Advance Step 0 -> Step 1
  await page.locator('[data-testid="add-property-next-btn"]').click();
  console.log('4. Clicked Next to Step 1');

  await page.waitForSelector('[data-testid="property-name"]', { timeout: 10000 });
  await page.fill('[data-testid="property-name"]', 'Test Penthouse Direct 2');
  const priceInput = page.locator('[data-testid="property-price"]').first();
  if (await priceInput.isVisible()) {
    await priceInput.fill('1500');
  }
  console.log('5. Filled Step 1');

  // Advance Step 1 -> Step 2
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('6. Advanced to Step 2 (Location)');

  // Advance Step 2 -> Step 3
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('7. Advanced to Step 3 (Details)');

  // Advance Step 3 -> Step 4
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('8. Advanced to Step 4 (Amenities)');

  // Advance Step 4 -> Step 5
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('9. Advanced to Step 5 (Photos)');

  // Advance Step 5 -> Step 6
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('10. Advanced to Step 6 (Ownership)');

  // Advance Step 6 -> Step 7
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForTimeout(400);
  console.log('11. Advanced to Step 7 (Management)');

  // Advance Step 7 -> Step 8
  await page.locator('[data-testid="add-property-next-btn"]').click();
  await page.waitForSelector('[data-testid="review-property-type"]', { timeout: 10000 });
  const reviewText = await page.locator('[data-testid="review-property-type"]').first().innerText();
  console.log('12. Reached Step 8! Review Type text:', reviewText);

  // Submit
  await page.locator('[data-testid="add-property-submit-btn"]').click();
  await page.waitForSelector('[data-testid="property-create-success"]', { timeout: 15000 });
  console.log('13. Property successfully created!');

  // Check DB
  const res = await dbPool.query("SELECT id, name, type, verification_status FROM properties WHERE name = 'Test Penthouse Direct 2'");
  console.log('14. PostgreSQL Record:', res.rows[0]);

  await browser.close();
  await dbPool.end();
}

test().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});

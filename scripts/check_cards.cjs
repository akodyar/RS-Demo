const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Find sponsored items
  const sponsoredCards = await page.$$('[data-testid^="sponsored-card-"]');
  console.log('Sponsored cards count:', sponsoredCards.length);

  // Find rental items
  const rentalCards = await page.$$('[data-testid^="rental-card-"]');
  console.log('Rental cards count:', rentalCards.length);
  
  // Check text content of cards
  for (let i = 0; i < sponsoredCards.length; i++) {
    const text = await sponsoredCards[i].innerText();
    console.log(`Sponsored Card ${i}:`, text.split('\n')[0]);
  }
  for (let i = 0; i < rentalCards.length; i++) {
    const text = await rentalCards[i].innerText();
    console.log(`Rental Card ${i}:`, text.split('\n')[0]);
  }

  await browser.close();
}
test().catch(console.error);

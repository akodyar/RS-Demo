import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("OWNER WORKSPACE TEXT:");
  console.log(text);
  
  await page.goto('http://localhost:3000/workspace/tenant', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);
  const text2 = await page.evaluate(() => document.body.innerText);
  console.log("TENANT WORKSPACE TEXT:");
  console.log(text2);

  await browser.close();
}

run()
  .then(() => process.exit(0))
  .catch(console.error);


import { chromium } from 'playwright';
import fs from 'fs';

async function runAudit() {
  console.log('Starting UI Audit...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { timeout: 10000 });
    console.log('Page Title:', await page.title());

    // Log visible text on homepage
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Homepage Body Text Preview:', bodyText.substring(0, 200).replace(/\n/g, ' '));

    // Attempt to navigate to Add Property directly
    console.log('\nNavigating to /properties/add');
    await page.goto('http://localhost:3000/properties/add', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    const addPropText = await page.evaluate(() => document.body.innerText);
    console.log('Add Property Page Body Text Preview:', addPropText.substring(0, 300).replace(/\n/g, ' '));

    // Find form fields on Add Property Page
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea, button')).map(el => {
        const id = el.id || '';
        const name = (el as any).name || '';
        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type || '';
        const text = el.textContent?.trim().substring(0, 20) || '';
        return `${tag}[type=${type}][id=${id}][name=${name}] - ${text}`;
      });
    });
    console.log('Add Property Form Elements:', inputs.join('\n'));

    // Try navigating to Owner Workspace
    console.log('\nNavigating to /owner');
    await page.goto('http://localhost:3000/owner', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('Owner Workspace Text Preview:', (await page.evaluate(() => document.body.innerText)).substring(0, 300).replace(/\n/g, ' '));

    // Try navigating to Company Workspace
    console.log('\nNavigating to /company');
    await page.goto('http://localhost:3000/company', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('Company Workspace Text Preview:', (await page.evaluate(() => document.body.innerText)).substring(0, 300).replace(/\n/g, ' '));

    // Try navigating to Tenant Workspace
    console.log('\nNavigating to /tenant');
    await page.goto('http://localhost:3000/tenant', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('Tenant Workspace Text Preview:', (await page.evaluate(() => document.body.innerText)).substring(0, 300).replace(/\n/g, ' '));

  } catch (error) {
    console.error('Audit Error:', error);
  } finally {
    await browser.close();
  }
}

runAudit()
  .then(() => process.exit(0))
  .catch(console.error);

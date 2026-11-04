import { chromium } from 'playwright';

async function openBrowserPersistent() {
  console.log('Launching browser via automation...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null // Uses maximized window size
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

  console.log('Successfully opened http://localhost:3000/ in browser!');
  console.log('Page Title:', await page.title());

  // Inject a visual indicator showing automation control
  await page.evaluate(() => {
    const badge = document.createElement('div');
    badge.id = 'automation-control-badge';
    badge.style.position = 'fixed';
    badge.style.bottom = '16px';
    badge.style.right = '16px';
    badge.style.zIndex = '999999';
    badge.style.backgroundColor = '#2563eb';
    badge.style.color = '#ffffff';
    badge.style.padding = '8px 16px';
    badge.style.borderRadius = '9999px';
    badge.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
    badge.style.fontFamily = 'system-ui, sans-serif';
    badge.style.fontSize = '13px';
    badge.style.fontWeight = 'bold';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '8px';
    badge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80"></span>
      <span>Antigravity Browser Control Active — http://localhost:3000</span>
    `;
    document.body.appendChild(badge);
  });

  // Keep the process running indefinitely so the browser stays open on the user's screen
  await new Promise(() => {});
}

openBrowserPersistent()
  .then(() => process.exit(0))
  .catch(console.error);

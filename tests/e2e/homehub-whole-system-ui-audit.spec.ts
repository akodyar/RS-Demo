import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-whole-system-ui-audit/audit-run-2026-10-25');

function ensureDir() {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
}

test.describe.serial('HomeHub Whole-System UI Audit & Option 4 Verification', () => {
  test.beforeAll(() => {
    ensureDir();
  });

  // 1. Homepage Desktop Kurdish Sorani
  test('01. Public Homepage — Desktop (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '01-homepage-desktop-ku.png'),
      fullPage: true,
    });
  });

  // 2. Homepage Mobile Kurdish Sorani
  test('02. Public Homepage — Mobile (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '02-homepage-mobile-ku.png'),
      fullPage: true,
    });
  });

  // 3. Homepage Desktop Arabic
  test('03. Public Homepage — Desktop (Arabic RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '03-homepage-desktop-ar.png'),
      fullPage: true,
    });
  });

  // 4. Homepage Desktop English
  test('04. Public Homepage — Desktop (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '04-homepage-desktop-en.png'),
      fullPage: true,
    });
  });

  // 5. Rentals Search Explorer Kurdish
  test('05. Public Rentals Search Explorer (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#search-explorer-root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '05-rentals-search-explorer-ku.png'),
      fullPage: true,
    });
  });

  // 6. Rentals Search Explorer English
  test('06. Public Rentals Search Explorer (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });

    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#search-explorer-root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '06-rentals-search-explorer-en.png'),
      fullPage: true,
    });
  });

  // 7. Property Detail Page Kurdish
  test('07. Dedicated Property Detail Page (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    // Mock property detail response for robust rendering
    await page.route('**/api/properties/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'browser-prop-1',
          name: 'ڤێلای شاهانەی بەختیاری',
          type: 'RESIDENTIAL',
          status: 'ACTIVE',
          operatingModel: 'FULLY_MANAGED',
          address: 'گەڕەکی بەختیاری، هەولێر',
          city: 'Erbil',
          bedrooms: 4,
          bathrooms: 3,
          areaSqm: 320,
          monthlyRent: 1800000,
          currency: 'IQD',
          description: 'ڤێلایەکی ناوازە بە دیزاینی سەردەمیانە لە باشترین شوێنی شاری هەولێر.',
          features: ['باخچە', 'پارکینگ', 'سیستەمی فێنککەرەوە', 'پاسەوانی ٢٤ کاتژمێری'],
          images: [],
          financials: {
            rentAmount: 1800000,
            currency: 'IQD',
            depositAmount: 1800000,
          }
        }),
      });
    });

    await page.goto('/properties/browser-prop-1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '07-property-detail-ku.png'),
      fullPage: true,
    });
  });

  // 8. Sign-In / Login Screen
  test('08. Sign-In / Login Screen (/login)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('homehub_auth_token');
      localStorage.removeItem('homehub_auth_persona');
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '08-login-screen.png'),
      fullPage: true,
    });
  });

  // 9. Owner Workspace Overview Kurdish
  test('09. Owner Workspace — Overview (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
        firstName: 'کاروان',
        lastName: 'عەلی',
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '09-owner-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  // 10. Agent Workspace Overview Kurdish
  test('10. Agent Workspace — Overview (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        email: 'agent@homehub.iq',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER'],
        firstName: 'ئاراس',
        lastName: 'ڕەشید',
      }));
    });

    await page.goto('/agent', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '10-agent-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  // 11. Vendor Workspace Overview Kurdish
  test('11. Vendor Workspace — Overview (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_vendor_01',
        email: 'vendor@homehub.iq',
        role: 'VENDOR',
        roles: ['VENDOR'],
        firstName: 'سەردار',
        lastName: 'محەمەد',
      }));
    });

    await page.goto('/vendor', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '11-vendor-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  // 12. Company Workspace Overview Kurdish
  test('12. Company Workspace — Overview (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
        companyId: 'comp_01',
        companyName: 'کۆمپانیای نیشتیمان بۆ خانووبەرە',
      }));
    });

    await page.goto('/company', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '12-company-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  // 13. Company CRM Workspace Kurdish
  test('13. Company CRM Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
        companyId: 'comp_01',
        companyName: 'کۆمپانیای نیشتیمان بۆ خانووبەرە',
      }));
    });

    await page.goto('/workspace/company/crm', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#crm-workspace-title').first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '13-company-crm-workspace-ku.png'),
      fullPage: true,
    });
  });

  // 14. Platform Admin Dashboard Kurdish
  test('14. Platform Admin Dashboard (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        email: 'admin@homehub.iq',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '14-platform-admin-dashboard-ku.png'),
      fullPage: true,
    });
  });

  // 15. Tenant Workspace Kurdish
  test('15. Tenant Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
        firstName: 'هێمن',
        lastName: 'کەریم',
      }));
    });

    // Mock active lease tenant dashboard response
    await page.route('**/api/tenant/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          property: {
            id: 'p_tenant_01',
            name: 'تاوەری کەیوان - شوقەی ١٤B',
            type: 'RESIDENTIAL',
            address: 'شەقامی گوڵان، هەولێر',
            rentAmount: 850000,
            currency: 'IQD',
            leaseId: 'lease_01',
            status: 'ACTIVE'
          },
          rentDue: {
            amount: 850000,
            currency: 'IQD',
            dueDate: '2026-11-01',
            status: 'UPCOMING'
          },
          financialSummary: {
            paidThisMonth: 850000,
            outstanding: 0,
            overdue: 0,
            currency: 'IQD',
            totalPaid: 2550000,
            deposit: 850000,
          },
          quickStats: {
            openMaintenanceCount: 1,
            unreadMessagesCount: 2,
            upcomingEventsCount: 1,
            pendingRequests: 0,
            daysToNextRent: 7,
          },
          paymentHistory: [
            {
              id: 'pay_01',
              amount: 850000,
              currency: 'IQD',
              date: '2026-10-01',
              status: 'CONFIRMED',
              method: 'FIB'
            }
          ],
          maintenanceRequests: [],
          documents: []
        }),
      });
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '15-tenant-workspace-ku.png'),
      fullPage: true,
    });
  });

  // 16. Rent Management Core Service Page (/rent-management)
  test('16. Rent Management Core Service Page (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '16-rent-management-page-ku.png'),
      fullPage: true,
    });
  });

  // 17. Admin Trust & Verification Workspace (/workspace/admin)
  test('17. Admin Trust & Verification Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_admin_01',
        email: 'admin@homehub.iq',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      }));
    });

    await page.goto('/workspace/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '17-admin-trust-workspace-ku.png'),
      fullPage: true,
    });
  });

  // 18. Integrations Admin Workspace (/workspace/integrations)
  test('18. Integrations Admin Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_admin_01',
        email: 'admin@homehub.iq',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
      }));
    });

    await page.goto('/workspace/integrations', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '18-integrations-admin-ku.png'),
      fullPage: true,
    });
  });

  // 19. Finance & Accountant Workspace (/accountant)
  test('19. Finance & Accountant Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-accountant');
      localStorage.setItem('homehub_auth_token', 'dev-accountant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_acct_01',
        email: 'finance@homehub.iq',
        role: 'ACCOUNTANT',
        roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
      }));
    });

    await page.route('**/api/financials/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            totalRevenue: 45000000,
            pendingReceivables: 3200000,
            totalExpenses: 6500000,
            netIncome: 38500000,
          },
          recentTransactions: [
            {
              id: 'txn_001',
              date: '2026-10-24',
              reference: 'RENT-INV-2026-108',
              method: 'FIB',
              amount: 1200000,
              status: 'CONFIRMED'
            },
            {
              id: 'txn_002',
              date: '2026-10-23',
              reference: 'RENT-INV-2026-107',
              method: 'FASTPAY',
              amount: 950000,
              status: 'CONFIRMED'
            }
          ]
        })
      });
    });

    await page.goto('/accountant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '19-accountant-workspace-ku.png'),
      fullPage: true,
    });
  });

  // 20. Portfolio Intelligence Workspace (/workspace/portfolio)
  test('20. Portfolio Intelligence Workspace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.route('**/api/analytics/portfolio?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalProperties: 12,
          totalUnits: 24,
          occupiedUnits: 22,
          vacantUnits: 2,
          overallOccupancyRate: 91.6,
          overallVacancyRate: 8.4,
          totalAssetValue: 4800000000,
          totalGrossRevenue: 15400000,
          totalOperatingExpenses: 2100000,
          totalNetOperatingIncome: 13300000,
          portfolioGrossYield: 9.2,
          portfolioNetYield: 8.4,
          portfolioCapRate: 7.9,
          overallCollectionRate: 98.2,
          overallDelinquencyRate: 1.8,
          totalArrears: 650000,
          totalMaintenanceCost: 1200000,
          totalCashFlow: 12100000,
          currency: 'IQD',
          underperformingSignals: [
            {
              propertyId: 'prop_002',
              propertyName: 'کۆمەڵگای بەختیاری - ڤێلا ١٢',
              signal: 'ELEVATED_MAINTENANCE',
              metric: 'Maintenance Ratio',
              actualValue: '18%',
              threshold: '10%',
              severity: 'MEDIUM',
              explanation: 'تێچووی چاککردنەوە لە ڕێژەی ئاسایی بەرزترە لەم مانگەدا.'
            }
          ]
        })
      });
    });

    await page.route('**/api/analytics/portfolio/distributions?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetTypeDistribution: [
            { key: 'RESIDENTIAL', label: 'نیشتەجێبوون', count: 9, percentage: 75 },
            { key: 'COMMERCIAL', label: 'بازرگانی', count: 3, percentage: 25 }
          ],
          geographicDistribution: [
            { key: 'Erbil', label: 'هەولێر', count: 8, percentage: 67 },
            { key: 'Sulaymaniyah', label: 'سلێمانی', count: 4, percentage: 33 }
          ]
        })
      });
    });

    await page.route('**/api/analytics/portfolio/properties?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            propertyId: 'prop_001',
            propertyName: 'تاوەری کەیوان - نهۆمی ٥',
            city: 'Erbil',
            type: 'RESIDENTIAL',
            totalUnits: 4,
            occupiedUnits: 4,
            vacantUnits: 0,
            availableUnits: 0,
            occupancyRate: 100,
            grossScheduledRent: 1200000,
            netOperatingIncome: 1050000,
            netRentalYield: 8.6,
            healthStatus: 'HEALTHY'
          },
          {
            propertyId: 'prop_002',
            propertyName: 'کۆمەڵگای بەختیاری - ڤێلا ١٢',
            city: 'Erbil',
            type: 'RESIDENTIAL',
            totalUnits: 1,
            occupiedUnits: 1,
            vacantUnits: 0,
            availableUnits: 0,
            occupancyRate: 100,
            grossScheduledRent: 2200000,
            netOperatingIncome: 1850000,
            netRentalYield: 8.1,
            healthStatus: 'HEALTHY'
          }
        ])
      });
    });

    await page.route('**/api/analytics/ai/insights?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          insights: [
            {
              id: 'ins_01',
              category: 'REVENUE_OPTIMIZATION',
              generatedAt: '2026-10-25T12:00:00Z',
              headline: 'Opportunity to optimize rent yield',
              headlineKurdish: 'ئەگەری بەرزکردنەوەی داهاتی کرێ',
              explanation: 'Based on market demand in Bakhtiyari, rent adjustments can yield +5% upon renewal.',
              explanationKurdish: 'بەپێی خواستی بازاڕ لە گەڕەکی بەختیاری، دەتوانیت کرێی ساڵانە لە کاتی نوێکردنەوەدا بە ڕێژەی ٥٪ بەرزبکەیتەوە.',
              proposedHumanAction: 'پێداچوونەوە بە نرخی نوێکردنەوەی گرێبەستەکان لە مانگی داهاتوودا.'
            }
          ]
        })
      });
    });

    await page.goto('/workspace/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '20-portfolio-intelligence-ku.png'),
      fullPage: true,
    });
  });

  // 21. Maintenance Control Center (/workspace/maintenance)
  test('21. Maintenance Control Center (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_vendor_01',
        email: 'vendor@homehub.iq',
        role: 'VENDOR',
        roles: ['VENDOR'],
      }));
    });

    await page.goto('/workspace/maintenance', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '21-maintenance-control-center-ku.png'),
      fullPage: true,
    });
  });

  // 22. Responsive Tablet (1024x768) Public Homepage
  test('22. Responsive Tablet 1024x768 — Public Homepage (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '22-homepage-tablet-ku.png'),
      fullPage: true,
    });
  });

  // 23. Interactive Public Search Flow
  test('23. Interactive Control — Public Search & Filter Navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    // Look for search button or rental link
    const rentalLink = page.locator('a[href="/rentals"]').first();
    if (await rentalLink.isVisible()) {
      await rentalLink.click();
      await page.waitForURL('**/rentals**', { timeout: 10000 });
    } else {
      await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    }

    await expect(page.locator('#search-explorer-root')).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: path.join(screenshotDir, '23-interactive-search-navigated-ku.png'),
      fullPage: true,
    });
  });

  // 24. Public Property Services & Verified Pros Page (/services)
  test('24. Public Property Services & Verified Pros Page (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/services', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '24-property-services-ku.png'),
      fullPage: true,
    });
  });

  // 25. Rental Property Registration Wizard (/properties/add)
  test('25. Rental Property Registration Wizard (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="property-type-apartment"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="property-type-apartment"]').click();
    await page.locator('[data-testid="add-property-next-btn"]').click();
    await expect(page.locator('[data-testid="purpose-sale-disabled"]')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '25-add-property-wizard-ku.png'),
      fullPage: true,
    });
  });

  // 26. Tenant Maintenance Request Workflow (/tenant/maintenance/new)
  test('26. Tenant Maintenance Request Workflow (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
      }));
    });

    await page.goto('/tenant/maintenance/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '26-tenant-maintenance-request-ku.png'),
      fullPage: true,
    });
  });
});

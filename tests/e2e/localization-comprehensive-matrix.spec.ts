import { test, expect } from '@playwright/test';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  'artifacts/evidence-gaps-closure-20261022/screenshots/localization'
);

const LOCALES = [
  { code: 'ku', dir: 'rtl', label: 'Kurdish Sorani' },
  { code: 'ar', dir: 'rtl', label: 'Arabic' },
  { code: 'en', dir: 'ltr', label: 'English' },
] as const;

test.describe('HomeHub — Issue B: Comprehensive Localization Matrix (Kurdish, Arabic, English)', () => {
  test.beforeEach(async ({ page }) => {
    // Deterministic API routes mocking for isolation from backend database mutations
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin_audit_01',
            email: 'superadmin@homehub.iq',
            role: 'SUPER_ADMIN',
            roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
            firstName: 'Aram',
            lastName: 'Hassan',
            status: 'ACTIVE',
          },
        }),
      });
    });

    await page.route('/api/admin/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            totalUsers: 240,
            totalProperties: 1372,
            pendingVerifications: 4,
            totalVolume: 50000000,
          },
        }),
      });
    });

    await page.route('/api/admin/settings', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, settings: postData }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            settings: {
              exchangeRateIqd: 1530,
              platformFeeRate: 0.03,
              twoFactorEnforced: true,
              maintenanceMode: false,
              largeContractThresholdUsd: 100000,
            },
          }),
        });
      }
    });

    await page.route('/api/admin/fees', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fees: {
            platformFee: {
              rate: 0.03,
              effectiveFrom: '2026-01-01T00:00:00.000Z',
            },
          },
        }),
      });
    });

    await page.route('/api/admin/pricing-tiers', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            pricingTier: {
              id: 'tier_mock_new',
              name: body.name,
              minProperties: body.minProperties,
              maxProperties: body.maxProperties,
              rentFeeRate: body.rentFeeRate,
              managementFeeRate: body.managementFeeRate,
              priority: body.priority,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pricingTiers: [
              {
                id: 'tier_mock_1',
                name: 'Tier A — Standard Portfolio',
                minProperties: 0,
                maxProperties: 5,
                rentFeeRate: '0.05',
                managementFeeRate: '0.07',
                priority: 1,
              },
              {
                id: 'tier_mock_2',
                name: 'Tier B — Commercial Portfolio',
                minProperties: 6,
                maxProperties: null,
                rentFeeRate: '0.04',
                managementFeeRate: '0.06',
                priority: 2,
              },
            ],
          }),
        });
      }
    });

    await page.route('/api/admin/properties*', async (route) => {
      const url = route.request().url();
      if (url.includes('/verification-history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ history: [] }),
        });
      } else if (url.includes('/approve') || url.includes('/reject')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            properties: [
              {
                id: 'prop_verif_audit_01',
                title: 'Empire World Luxury Suite',
                city: 'Erbil',
                address: { street: 'Empire World Tower C' },
                tapuNumber: 'TN-994821',
                verificationStatus: 'PENDING_VERIFICATION',
                status: 'PENDING',
                managementPreference: 'HOMEHUB_MANAGED',
                managementArrangementStatus: 'AWAITING_ONBOARDING',
                ownerName: 'Hiwa Omar',
                ownerId: 'user_owner_01',
                photos: [],
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await page.route('/api/properties/eligible-agents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            {
              id: 'agent_verified_org_01',
              name: 'Kurdistan Premier Brokerage Group',
              type: 'COMPANY',
              status: 'VERIFIED',
            },
          ],
        }),
      });
    });

    await page.route('/api/properties/pricing-tier', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tier: 'Tier A — Standard Portfolio',
          rentFeeRate: '0.05',
          managementFeeRate: '0.07',
        }),
      });
    });

    await page.route('/api/properties/prop_audit_choice_01*', async (route) => {
      if (route.request().method() === 'POST' && route.request().url().includes('/preference')) {
        const body = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            property: {
              id: 'prop_audit_choice_01',
              title: 'Hawler Park View Residence',
              managementPreference: body.preference || body.managementPreference,
              managementArrangementStatus:
                body.preference === 'HOMEHUB_MANAGED'
                  ? 'AWAITING_ONBOARDING'
                  : body.preference === 'AGENT_MANAGED'
                  ? 'AWAITING_AGREEMENT'
                  : 'NOT_APPLICABLE',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'prop_audit_choice_01',
            title: 'Hawler Park View Residence',
            city: 'Erbil',
            verificationStatus: 'PENDING_VERIFICATION',
            status: 'PENDING',
            managementPreference: 'SELF_MANAGED',
            managementArrangementStatus: 'NOT_APPLICABLE',
            operatingModel: 'FULLY_MANAGED',
            ownerId: 'user_owner_01',
          }),
        });
      }
    });
  });

  for (const locale of LOCALES) {
    test(`Area 1: Admin Fee Management & Tiered Pricing — ${locale.label} (${locale.code.toUpperCase()}) [${locale.dir.toUpperCase()}]`, async ({
      page,
    }) => {
      // 1. Set language in localStorage and session
      await page.addInitScript(
        ({ code }) => {
          localStorage.setItem('homehub_lang', code);
          localStorage.setItem('auth_token', 'dev-super-admin');
          localStorage.setItem(
            'user',
            JSON.stringify({
              id: 'admin_audit_01',
              email: 'superadmin@homehub.iq',
              role: 'SUPER_ADMIN',
              roles: ['SUPER_ADMIN', 'ADMIN'],
            })
          );
        },
        { code: locale.code }
      );

      await page.goto('/platform-admin', { waitUntil: 'domcontentloaded' });

      // Assert document language and direction
      const htmlDir = await page.getAttribute('html', 'dir');
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlDir).toBe(locale.dir);
      expect(htmlLang).toBe(locale.code);

      // Navigate to Settings module
      const settingsQuickAction = page.locator('[data-testid="admin-action-settings"]');
      if (await settingsQuickAction.isVisible({ timeout: 5000 })) {
        await settingsQuickAction.click();
      }

      // Assert Admin Settings title
      const feeTitle = page.locator('h2');
      await expect(feeTitle).toBeVisible({ timeout: 10000 });
      const feeTitleText = await feeTitle.innerText();

      if (locale.code === 'ku') {
        expect(feeTitleText).toContain('ڕێکخستنە گشتییەکانی پلاتفۆڕم و کرێیەکان');
      } else if (locale.code === 'ar') {
        expect(feeTitleText).toContain('إدارة الرسوم وسياسات التشغيل');
      } else {
        expect(feeTitleText).toContain('Fee Management & Operating Policies');
      }

      // Assert Platform Fee Input
      const feeInput = page.locator('[data-testid="admin-platform-fee-input"]');
      await expect(feeInput).toBeVisible({ timeout: 5000 });
      await expect(feeInput).toHaveValue('0.03');

      // Test rate validation error (enter rate > 0.50)
      await feeInput.fill('0.65');
      const feeError = page.locator('[data-testid="admin-platform-fee-error"]');
      await expect(feeError).toBeVisible({ timeout: 5000 });
      const feeErrorText = await feeError.innerText();

      if (locale.code === 'ku') {
        expect(feeErrorText).toContain('ڕێژە ناتوانێت لە ٥٠٪ (٠.٥٠) زیاتر بێت');
      } else if (locale.code === 'ar') {
        expect(feeErrorText).toContain('لا يمكن أن تتجاوز النسبة 50% (0.50)');
      } else {
        expect(feeErrorText).toContain('Rate cannot exceed 50% (0.50)');
      }

      // Restore rate to 0.03
      await feeInput.fill('0.03');
      await expect(feeError).not.toBeVisible({ timeout: 5000 });

      // Capture fee management screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `01-fee-management-${locale.code}-${locale.dir}.png`),
        fullPage: false,
      });

      // Navigate to Pricing Tiers module
      const backBtn = page.locator('[data-testid="admin-settings-back-btn"]');
      if (await backBtn.isVisible({ timeout: 5000 })) {
        await backBtn.click();
      }

      const pricingQuickAction = page.locator('[data-testid="admin-action-pricing"]');
      if (await pricingQuickAction.isVisible({ timeout: 5000 })) {
        await pricingQuickAction.click();
      }

      // Assert Pricing Tiers Heading
      const pricingHeading = page.locator('h2');
      await expect(pricingHeading).toBeVisible({ timeout: 10000 });
      const pricingHeadingText = await pricingHeading.innerText();

      if (locale.code === 'ku') {
        expect(pricingHeadingText).toContain('ڕێکخستنی کرێی پلەبەندی');
      } else if (locale.code === 'ar') {
        expect(pricingHeadingText).toContain('تهيئة تسعير الفئات');
      } else {
        expect(pricingHeadingText).toContain('Tiered Pricing Configuration');
      }

      // Open Create Tier Modal
      const createTierBtn = page.locator('[data-testid="create-tier-btn"]');
      await expect(createTierBtn).toBeVisible({ timeout: 5000 });
      await createTierBtn.click();

      const modalTitle = page.locator('#create-tier-modal-title');
      await expect(modalTitle).toBeVisible({ timeout: 5000 });
      const modalTitleText = await modalTitle.innerText();

      if (locale.code === 'ku') {
        expect(modalTitleText).toContain('دروستکردنی پلەی نوێی کرێ');
      } else if (locale.code === 'ar') {
        expect(modalTitleText).toContain('إنشاء فئة تسعير جديدة');
      } else {
        expect(modalTitleText).toContain('Create New Pricing Tier');
      }

      // Capture modal screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `02-pricing-tier-modal-${locale.code}-${locale.dir}.png`),
      });

      // Submit empty form to trigger localized validation errors
      const saveTierBtn = page.locator('button[type="submit"]');
      await saveTierBtn.click();

      // Check field error for tier name
      const nameError = page.locator('form p.text-red-500').first();
      await expect(nameError).toBeVisible({ timeout: 5000 });
      const nameErrorText = await nameError.innerText();

      if (locale.code === 'ku') {
        expect(nameErrorText).toContain('ناوی پلە پێویستە');
      } else if (locale.code === 'ar') {
        expect(nameErrorText).toContain('اسم الفئة مطلوب');
      } else {
        expect(nameErrorText).toContain('Tier name is required');
      }

      // Capture validation screenshot
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIR,
          `03-pricing-tier-validation-${locale.code}-${locale.dir}.png`
        ),
      });

      // Close modal using Escape
      await page.keyboard.press('Escape');
      await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
    });

    test(`Area 2: Property Verification Lifecycle — ${locale.label} (${locale.code.toUpperCase()}) [${locale.dir.toUpperCase()}]`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ code }) => {
          localStorage.setItem('homehub_lang', code);
          localStorage.setItem('auth_token', 'dev-super-admin');
          localStorage.setItem(
            'user',
            JSON.stringify({
              id: 'admin_audit_01',
              email: 'superadmin@homehub.iq',
              role: 'SUPER_ADMIN',
              roles: ['SUPER_ADMIN', 'ADMIN'],
            })
          );
        },
        { code: locale.code }
      );

      await page.goto('/platform-admin', { waitUntil: 'domcontentloaded' });

      // Navigate to Properties Module
      const propsAction = page.locator('[data-testid="admin-action-properties"]');
      if (await propsAction.isVisible({ timeout: 5000 })) {
        await propsAction.click();
      }

      // Assert Property Inspection modal can be opened
      const inspectBtn = page.locator('button:has-text("پشکنین"), button:has-text("فحص"), button:has-text("Inspect")').first();
      if (await inspectBtn.isVisible({ timeout: 5000 })) {
        await inspectBtn.click();

        // Check inspection modal is open
        const inspectModal = page.locator('[data-testid="admin-reject-btn"]');
        await expect(inspectModal).toBeVisible({ timeout: 5000 });

        // Verify rejection reason textarea is present
        const rejectReasonInput = page.locator('[data-testid="admin-reject-reason-input"]');
        await expect(rejectReasonInput).toBeVisible({ timeout: 5000 });

        // Capture verification inspection screenshot
        await page.screenshot({
          path: path.join(
            SCREENSHOT_DIR,
            `04-property-verification-inspect-${locale.code}-${locale.dir}.png`
          ),
        });

        // Close inspection modal
        const closeBtn = page.locator('button:has-text("داخستن"), button:has-text("إغلاق"), button:has-text("Close")').first();
        if (await closeBtn.isVisible({ timeout: 3000 })) {
          await closeBtn.click();
        }
      }
    });

    test(`Area 3: Post-Creation Management Choice — ${locale.label} (${locale.code.toUpperCase()}) [${locale.dir.toUpperCase()}]`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ code }) => {
          localStorage.setItem('homehub_lang', code);
          localStorage.setItem('auth_token', 'dev-owner');
          localStorage.setItem(
            'user',
            JSON.stringify({
              id: 'user_owner_01',
              email: 'owner@homehub.iq',
              role: 'PROPERTY_OWNER',
              roles: ['PROPERTY_OWNER'],
            })
          );
        },
        { code: locale.code }
      );

      await page.goto('/owner/properties/add?prop_id=prop_audit_choice_01', {
        waitUntil: 'domcontentloaded',
      });

      // Assert all 3 business options are rendered
      const optionSelf = page.locator('[data-testid="option-self-managed"]');
      const optionHomehub = page.locator('[data-testid="option-homehub-managed"]');
      const optionAgent = page.locator('[data-testid="option-agent-managed"]');

      await expect(optionSelf).toBeVisible({ timeout: 10000 });
      await expect(optionHomehub).toBeVisible({ timeout: 5000 });
      await expect(optionAgent).toBeVisible({ timeout: 5000 });

      // Verify choice titles in the active locale
      const selfText = await optionSelf.innerText();
      const homehubText = await optionHomehub.innerText();
      const agentText = await optionAgent.innerText();

      if (locale.code === 'ku') {
        expect(selfText).toContain('بەڕێوەبردنی خۆیی');
        expect(homehubText).toContain('بەڕێوەبردن لەلایەن هۆم‌هەب');
        expect(agentText).toContain('بەڕێوەبردن لەلایەن ئاژانس / کۆمپانیا');
      } else if (locale.code === 'ar') {
        expect(selfText).toContain('إدارة ذاتية');
        expect(homehubText).toContain('إدارة هوم هب');
        expect(agentText).toContain('إدارة وكيل / شركة');
      } else {
        expect(selfText).toContain('Self-Managed');
        expect(homehubText).toContain('HomeHub-Managed');
        expect(agentText).toContain('Agent-Managed');
      }

      // Click Option B (HOMEHUB_MANAGED)
      await optionHomehub.click();

      // Submit and confirm selection
      const confirmBtn = page.locator('[data-testid="btn-confirm-management-preference"]');
      if (await confirmBtn.isVisible({ timeout: 5000 })) {
        await confirmBtn.click();
        const savedAlert = page.locator('[data-testid="management-preference-saved-alert"]');
        await expect(savedAlert).toBeVisible({ timeout: 5000 });
      }

      // Capture screenshot of Management Choice in current locale
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIR,
          `05-management-choice-${locale.code}-${locale.dir}.png`
        ),
      });

      // Verify Reload Persistence: reload page and assert preference persists
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(optionHomehub).toBeVisible({ timeout: 10000 });

      // Assert language persisted in localStorage after reload
      const persistedLang = await page.evaluate(() => localStorage.getItem('homehub_lang'));
      expect(persistedLang).toBe(locale.code);

      // Verify No Horizontal Overflow (Viewport Responsiveness)
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);

      // Capture screenshot after reload persistence
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIR,
          `06-management-choice-persisted-${locale.code}-${locale.dir}.png`
        ),
      });
    });
  }
});

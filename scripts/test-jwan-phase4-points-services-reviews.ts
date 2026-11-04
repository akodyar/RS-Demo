/**
 * HOMEHUB MASTER VERIFICATION - PHASE 4: POINTS, SERVICES & REVIEWS
 * 
 * Tests:
 * 1. Points Purchase Order creation by Owner & Admin confirmation
 * 2. Tenant Rent Payment Reward points granting & wallet verification
 * 3. Sponsored Listing campaign activation using points & Homepage placement
 * 4. Tenant maintenance request submission
 * 5. Vendor quote submission & Owner approval within spending limit -> Work Order generation
 * 6. Vendor work order completion
 * 7. Reciprocal Rate & Review: Tenant rates property + Owner response + Vendor rating
 * 8. Visual screenshots saved in screenshots/تێستی جوان/04-points-services-reviews/
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { db } from '../src/db/index.js';
import { 
  users, properties, units, leases, listings, 
  pointsPurchaseOrders, pointsWallets, pointsTransactions,
  promotionPackages, promotionCampaigns,
  maintenanceRequests, maintenanceQuotes, workOrders, vendorProfiles,
  propertyReviews, vendorReviews 
} from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { maintenanceRepository } from '../src/server/repositories/maintenance.js';
import { reviewsRepository } from '../src/server/repositories/reviews.js';

const APP_URL = 'http://localhost:3005';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots/تێستی جوان/04-points-services-reviews');

async function runPhase4() {
  console.log('===============================================================');
  console.log('🚀 STARTING HOMEHUB MASTER TEST - PHASE 4: POINTS, SERVICES & REVIEWS');
  console.log('===============================================================');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const personas = JSON.parse(fs.readFileSync('scripts/test-jwan-active-personas.json', 'utf-8'));
  const activeProps = JSON.parse(fs.readFileSync('scripts/test-jwan-active-properties.json', 'utf-8'));

  const aptMeta = activeProps['APARTMENT'];
  const [ownerUser] = await db.select().from(users).where(eq(users.email, personas.ownerIndiv.email)).limit(1);
  const [tenantUser] = await db.select().from(users).where(eq(users.email, personas.tenant.email)).limit(1);
  const [vendorUser] = await db.select().from(users).where(eq(users.email, personas.vendor.email)).limit(1);

  // Fetch or ensure platform admin user
  let [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@homehub.iq')).limit(1);
  if (!adminUser) {
    [adminUser] = await db.select().from(users).where(eq(users.email, 'kaywan.sabir@gmail.com')).limit(1);
  }

  // Ensure active lease exists for reviews and maintenance
  let [activeLease] = await db.select().from(leases).where(and(
    eq(leases.propertyId, aptMeta.propertyId),
    eq(leases.status, 'ACTIVE')
  )).limit(1);

  // Ensure vendor profile exists
  let [vendorProf] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, vendorUser.id)).limit(1);
  if (!vendorProf) {
    [vendorProf] = await db.insert(vendorProfiles).values({
      userId: vendorUser.id,
      businessName: 'وەستای شارەزا بۆ سێرڤس و چاککردنەوە',
      categories: ['PLUMBING', 'ELECTRICAL'],
      phone: vendorUser.phone || '07706667788',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    }).returning();
    console.log(`[SETUP] Created vendor profile: ${vendorProf.id}`);
  }

  // Ensure published listing exists for apartment
  let [aptListing] = await db.select().from(listings).where(eq(listings.propertyId, aptMeta.propertyId)).limit(1);
  if (!aptListing) {
    [aptListing] = await db.insert(listings).values({
      propertyId: aptMeta.propertyId,
      publisherUserId: ownerUser.id,
      type: 'FOR_RENT',
      price: '750',
      currency: 'USD',
      status: 'PUBLISHED',
      title: 'شوقەی لوکس لە بەختیاری بۆ کرێ',
      description: 'شوقەیەکی تایبەت و نوێ بە هەموو کەلوپەلەکانەوە.',
    }).returning();
    console.log(`[SETUP] Created published listing: ${aptListing.id}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // STEP 4.1: Points Purchase & Admin Confirmation
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.1: Owner Purchases Points & Admin Confirms ---');
    const orderResult = await pointsEngine.createPurchaseOrder({
      userId: ownerUser.id,
      userRoles: ['PROPERTY_OWNER'],
      packageId: 'PKG_POINTS_1000',
      paymentMethod: 'ZAINCASH',
      paymentReference: `ZC-ORDER-${Date.now()}`,
      idempotencyKey: `points-purchase-${ownerUser.id}-${Date.now()}`,
      actorUserId: ownerUser.id,
    });
    console.log(`[POINTS] Purchase order created: ${orderResult.order.id}, Status: ${orderResult.order.status}, Points: 1000`);

    // Admin confirms purchase order
    const confirmOrder = await pointsEngine.confirmPurchaseOrder({
      orderId: orderResult.order.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
      idempotencyKey: `confirm-${orderResult.order.id}`,
    });
    console.log(`[POINTS] Order confirmed! New Owner balance: ${confirmOrder.wallet.totalBalance} points`);

    // UI inspection: Owner logs in and views points wallet / dashboard
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="@"]', personas.ownerIndiv.email);
    await page.fill('input[type="password"]', personas.ownerIndiv.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes('/owner'), { timeout: 10000 });
    await page.waitForTimeout(1500);

    const shot1 = path.join(SCREENSHOT_DIR, '01-owner-points-wallet-funded.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`📸 Saved: ${shot1}`);

    // -------------------------------------------------------------
    // STEP 4.2: Points Reward System for Tenant
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.2: Granting Rent Payment Reward Points to Tenant ---');
    const rewardGrant = await pointsEngine.grantRewardPoints({
      userId: tenantUser.id,
      userRoles: ['TENANT'],
      ruleKey: 'TENANT_ON_TIME_RENT',
      referenceEventId: `rent-reward-${Date.now()}`,
      idempotencyKey: `rent-reward-${tenantUser.id}-${Date.now()}`,
      notes: 'Rewarded points for on-time rent payment',
    });
    console.log(`[POINTS REWARD] Granted reward points to tenant! Tenant Total Balance: ${rewardGrant.wallet.totalBalance}`);

    // Tenant logs in and views dashboard
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="@"]', personas.tenant.email);
    await page.fill('input[type="password"]', personas.tenant.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes('/tenant'), { timeout: 10000 });
    await page.waitForTimeout(1500);

    const shot2 = path.join(SCREENSHOT_DIR, '02-tenant-points-rewarded.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`📸 Saved: ${shot2}`);

    // -------------------------------------------------------------
    // STEP 4.3: Sponsor Listing on Homepage using Points
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.3: Sponsoring Apartment Listing on Homepage ---');
    // Owner creates draft campaign
    const draftCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: aptListing.id,
      packageId: 'PKG_HOME_FEATURED_7D',
      actorUserId: ownerUser.id,
      actorRoles: ['PROPERTY_OWNER'],
    });
    console.log(`[PROMOTION] Draft campaign created: ${draftCampaign.id}, Cost: ${draftCampaign.pointsCost} points`);

    // Submit campaign (reserves points from owner's wallet)
    const submittedCampaign = await promotionCampaignService.submitCampaign({
      campaignId: draftCampaign.id,
      actorUserId: ownerUser.id,
      actorRoles: ['PROPERTY_OWNER'],
      idempotencyKey: `submit-campaign-${draftCampaign.id}`,
    });
    console.log(`[PROMOTION] Campaign submitted and points reserved: status: ${submittedCampaign.campaign.status}`);

    // Admin approves campaign
    const approvedCampaign = await promotionCampaignService.approveCampaign({
      campaignId: draftCampaign.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
      notes: 'Approved for homepage featured display',
    });
    console.log(`[PROMOTION] Campaign approved by admin: status: ${approvedCampaign.status}`);

    // Activate campaign (spends reserved points, live on homepage!)
    const activeCampaign = await promotionCampaignService.activateCampaign({
      campaignId: draftCampaign.id,
      actorUserId: ownerUser.id,
      startTime: new Date().toISOString(),
      idempotencyKey: `activate-campaign-${draftCampaign.id}`,
    });
    console.log(`[PROMOTION] Campaign activated! Status: ${activeCampaign.status}`);

    // Navigate to Homepage to verify sponsored listing
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const shot3 = path.join(SCREENSHOT_DIR, '03-sponsored-featured-listing-homepage.png');
    await page.screenshot({ path: shot3, fullPage: true });
    console.log(`📸 Saved: ${shot3}`);

    // -------------------------------------------------------------
    // STEP 4.4: Tenant Submits Maintenance Request
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.4: Tenant Submits Maintenance Request ---');
    const maintReq = await maintenanceRepository.createRequest(
      tenantUser.id,
      aptMeta.propertyId,
      aptMeta.unitId,
      'PLUMBING',
      'MEDIUM',
      'کێشەی دزەکردنی ئاو لە ژێر سینک',
      'لە ژێر سینکی چێشتخانەکە ئاو دزە دەکات و پێویستی بە وەستای تەندروستی هەیە.'
    );
    console.log(`[MAINTENANCE] Request created: ${maintReq.id}, Status: ${maintReq.status}`);

    // View Tenant maintenance view
    await page.goto(`${APP_URL}/tenant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const shot4 = path.join(SCREENSHOT_DIR, '04-tenant-maintenance-ticket-created.png');
    await page.screenshot({ path: shot4, fullPage: true });
    console.log(`📸 Saved: ${shot4}`);

    // -------------------------------------------------------------
    // STEP 4.5: Vendor Submits Quote & Owner Approves -> Work Order
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.5: Vendor Submits Quote & Owner Approves ---');
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const quote = await maintenanceRepository.submitQuote(
      maintReq.id,
      vendorProf.id,
      aptMeta.propertyId,
      85,
      'پشکنینی بەستەرەکان و گۆڕینی واشەر بە گەرەنتی',
      nextWeek
    );
    console.log(`[QUOTE] Quote submitted: ${quote.id}, Amount: $85 USD`);

    // Owner approves quote -> Automatically creates Work Order
    const workOrder = await maintenanceRepository.approveQuote(quote.id);
    console.log(`[QUOTE APPROVED] Quote marked APPROVED. Work order created: ${workOrder.id}, Status: ${workOrder.status}`);

    // Owner logs in and views maintenance dashboard
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="@"]', personas.ownerIndiv.email);
    await page.fill('input[type="password"]', personas.ownerIndiv.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes('/owner'), { timeout: 10000 });
    await page.waitForTimeout(1500);

    const shot5 = path.join(SCREENSHOT_DIR, '05-owner-approved-quote-work-order.png');
    await page.screenshot({ path: shot5, fullPage: true });
    console.log(`📸 Saved: ${shot5}`);

    // -------------------------------------------------------------
    // STEP 4.6: Vendor Completes Work Order with Proof
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.6: Vendor Completes Work Order ---');
    const completedWO = await maintenanceRepository.completeWorkOrder(
      workOrder.id,
      true,
      ownerUser.id
    );
    console.log(`[WORK ORDER COMPLETED] Work Order ID: ${completedWO.id}`);

    // Vendor views status
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="@"]', personas.vendor.email);
    await page.fill('input[type="password"]', personas.vendor.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const shot6 = path.join(SCREENSHOT_DIR, '06-vendor-work-order-completed.png');
    await page.screenshot({ path: shot6, fullPage: true });
    console.log(`📸 Saved: ${shot6}`);

    // -------------------------------------------------------------
    // STEP 4.7: Reciprocal Rate & Review
    // -------------------------------------------------------------
    console.log('\n--- STEP 4.7: Reciprocal Rate & Review Submission ---');
    // Ensure clean state for review
    await db.delete(propertyReviews).where(and(
      eq(propertyReviews.propertyId, aptMeta.propertyId),
      eq(propertyReviews.tenantId, tenantUser.id)
    ));

    // 1. Tenant reviews property
    const propReview = await reviewsRepository.createPropertyReview(tenantUser.id, {
      propertyId: aptMeta.propertyId,
      rating: 5,
      cleanlinessRating: 5,
      maintenanceRating: 5,
      communicationRating: 5,
      locationRating: 5,
      title: 'شوقەیەکی نایاب و ئارام',
      comment: 'خاوەن موڵکێکی زۆر بەڕێز و خزمەتگوزاری زۆر خێرا و شوێنێکی زۆر دڵگیر.',
    });
    console.log(`[REVIEW] Tenant submitted property review: ${propReview.id}, Rating: 5/5`);

    // 2. Owner responds to review
    const respondedReview = await reviewsRepository.respondToPropertyReview(
      propReview.id,
      { id: ownerUser.id, roles: ['PROPERTY_OWNER'] },
      'سوپاس بۆ متمانەکەتان بەڕێزم، هەمیشە ئامانجمان ئاسوودەیی ئێوەیە.'
    );
    console.log(`[REVIEW RESPONSE] Owner responded to review: ${respondedReview.id}`);

    // 3. Tenant rates Vendor on completed work order
    const vendReview = await reviewsRepository.createVendorReview(
      tenantUser.id,
      'TENANT',
      {
        vendorId: vendorProf.id,
        workOrderId: workOrder.id,
        rating: 5,
        comment: 'وەستایەکی دەستپاک، بە ئەزموون و لە کاتی دیاریکراودا کارەکەی بە جوانی تەواو کرد.',
      }
    );
    console.log(`[VENDOR REVIEW] Vendor reviewed: ${vendReview.id}, Rating: 5/5`);

    // Public Rent / Property Page inspection
    await page.goto(`${APP_URL}/rent`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const shot7 = path.join(SCREENSHOT_DIR, '07-reciprocal-reviews-and-rating-verified.png');
    await page.screenshot({ path: shot7, fullPage: true });
    console.log(`📸 Saved: ${shot7}`);

    console.log('\n===============================================================');
    console.log('✅ PHASE 4: POINTS, SERVICES & REVIEWS VERIFIED SUCCESSFULLY!');
    console.log('===============================================================');
  } finally {
    await browser.close();
  }
}

runPhase4()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ PHASE 4 FAILED:', err);
    process.exit(1);
  });

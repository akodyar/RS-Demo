import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { auditService } from '../services/audit.js';
import { GoogleGenAI } from '@google/genai';
import { UserRole, Permission } from '../../types/index.js';
import { ownerRepository } from '../repositories/owner.js';
import { db } from '../../db/index.js';
import { leases, leaseTenants, properties, users } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ==========================================
// INTELLIGENCE & OPTIMIZATION API
// ==========================================

router.get('/dashboard', requireAuth, async (req, res) => {
  res.json({
    status: 'ok',
    features: ['ai_listing_generator', 'autonomous_maintenance_triage', 'lease_renewal_automation'],
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 1. AI Property Listing Description Generator
router.post(
  '/draft-listing', 
  requireAuth, 
  requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.AGENT_BROKER, UserRole.PLATFORM_ADMIN]), 
  async (req, res) => {
    const { propertyId, propertyName, propertyType, location, bedrooms, bathrooms, area, price, language = 'ku' } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required to generate a listing draft.' });
    }

    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      propertyId,
      Permission.VIEW_PROPERTY
    );
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have authority to view or draft listings for this property.',
        code: 'AUTHORITY_REQUIRED',
      });
    }

    const langPrompt = language === 'ar' ? 'Arabic' : language === 'en' ? 'English' : 'Kurdish Sorani';

    const fallbackDescription = language === 'ku'
      ? `خانووبەرەیەکی نایاب لە جۆری ${propertyType || 'خانوو'} لە ناوچەی ${location || 'هەولێر'}. پێکهاتووە لە ${bedrooms || 3} ژووری نووستن، ${bathrooms || 2} گەرماو، بە ڕووبەری ${area || 200} مەتر دووجا. بە باشترین کوالێتی دروستکراوە و گونجاوە بۆ ژیانێکی ئاسوودە.`
      : language === 'ar'
      ? `عقار مميز من نوع ${propertyType || 'فيلا'} في منطقة ${location || 'أربيل'}. يحتوي على ${bedrooms || 3} غرف نوم، ${bathrooms || 2} حمامات، بمساحة ${area || 200} متر مربع. مجهز بأحدث الخدمات ومثالي للسكن الراقي.`
      : `Exceptional ${propertyType || 'Villa'} located in ${location || 'Erbil'}. Features ${bedrooms || 3} bedrooms, ${bathrooms || 2} bathrooms, with a total area of ${area || 200} sqm. Perfect modern living with high-grade finishes.`;

    const ai = getAIClient();
    if (!ai) {
      return res.json({
        success: true,
        description: fallbackDescription,
        aiGenerated: false,
        source: 'smart-template',
      });
    }

    try {
      const prompt = `Act as an expert luxury real estate copywriter in Kurdistan & Iraq. 
Write an engaging, professional real estate listing description in ${langPrompt} for the following property:
- Name: ${propertyName || 'Luxury Property'}
- Type: ${propertyType || 'Apartment/Villa'}
- Location: ${location || 'Erbil'}
- Bedrooms: ${bedrooms || 3}
- Bathrooms: ${bathrooms || 2}
- Area: ${area || 200} sqm
- Monthly Rent / Price: ${price || 'Negotiable'}

Requirements:
- Written natively in ${langPrompt}.
- Highlight comfort, prime location, and autonomous property management via HomeHub.
- Keep it concise (2 short paragraphs, 80-120 words).`;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
      });

      const description = response.text || fallbackDescription;
      return res.json({
        success: true,
        description: description.trim(),
        aiGenerated: true,
      });
    } catch (err: any) {
      console.error('Gemini draft-listing error:', err.message);
      return res.json({
        success: true,
        description: fallbackDescription,
        aiGenerated: false,
        error: err.message,
      });
    }
  }
);

// 2. Autonomous Maintenance Ticket Categorization & Triage
router.post(
  '/categorize-ticket', 
  requireAuth, 
  requireRole([UserRole.TENANT, UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.VENDOR, UserRole.PLATFORM_ADMIN]), 
  async (req, res) => {
    const { title, description } = req.body;

  const ai = getAIClient();
  if (!ai) {
    // Rule-based heuristic fallback
    const text = `${title} ${description}`.toLowerCase();
    let category = 'GENERAL';
    let priority = 'MEDIUM';
    let estimatedCost = '$50 - $120';

    if (text.includes('leak') || text.includes('water') || text.includes('pipe') || text.includes('sink') || text.includes('توالێت') || text.includes('بۆری') || text.includes('تسريب')) {
      category = 'PLUMBING';
      priority = 'HIGH';
      estimatedCost = '$65 - $150';
    } else if (text.includes('ac') || text.includes('cool') || text.includes('heat') || text.includes('سپلیت') || text.includes('تكييف')) {
      category = 'HVAC';
      priority = 'HIGH';
      estimatedCost = '$80 - $200';
    } else if (text.includes('electric') || text.includes('power') || text.includes('wire') || text.includes('کارەبا') || text.includes('كهرباء')) {
      category = 'ELECTRICAL';
      priority = 'HIGH';
      estimatedCost = '$40 - $100';
    }

    return res.json({
      success: true,
      category,
      priority,
      estimatedCost,
      eligibleVendorsCount: 4,
      aiTriaged: false,
    });
  }

  try {
    const prompt = `Analyze this property maintenance request and return ONLY a valid JSON object:
Title: "${title}"
Description: "${description}"

JSON schema required:
{
  "category": "PLUMBING" | "ELECTRICAL" | "HVAC" | "APPLIANCE" | "STRUCTURAL" | "GENERAL",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY",
  "estimatedCost": string (e.g. "$60 - $120"),
  "recommendedAction": string,
  "requiredTrade": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      ...parsed,
      eligibleVendorsCount: 5,
      aiTriaged: true,
    });
  } catch (err: any) {
    console.error('Gemini categorize-ticket error:', err.message);
    return res.json({
      success: true,
      category: 'PLUMBING',
      priority: 'MEDIUM',
      estimatedCost: '$60 - $120',
      eligibleVendorsCount: 3,
      aiTriaged: false,
    });
  }
});

// 3. Autonomous Lease Renewal Contract Generator (Requires Owner/Company/Admin authority)
router.post(
  '/generate-lease-renewal',
  requireAuth,
  requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.PLATFORM_ADMIN]),
  requireDatabase,
  async (req, res) => {


    const { propertyId, leaseId, tenantId, currentRent, newRent, termMonths = 12, expiryDate } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR: propertyId is required to generate a lease renewal draft.',
      });
    }

    // 1. Authoritative permission check on the property
    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      propertyId,
      Permission.MANAGE_LEASES
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have authority to manage leases or generate renewals for this property.',
        code: 'AUTHORITY_REQUIRED',
      });
    }

    // 2. Fetch authoritative property
    const [propRecord] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!propRecord) {
      return res.status(404).json({
        error: 'NOT_FOUND: Authoritative property not found.',
      });
    }

    let authoritativeTenantName = 'Unassigned';
    let authoritativeCurrentRent = currentRent || 0;

    // 3. If leaseId is specified, strictly verify it belongs to propertyId
    if (leaseId) {
      const [leaseRecord] = await db
        .select()
        .from(leases)
        .where(and(
          eq(leases.id, leaseId),
          eq(leases.propertyId, propertyId)
        ))
        .limit(1);

      if (!leaseRecord) {
        return res.status(403).json({
          error: 'Forbidden: Lease not found or does not belong to specified property.',
          code: 'IDOR_VIOLATION',
        });
      }

      authoritativeCurrentRent = Number(leaseRecord.rentAmount);

      // 4. If tenantId is specified, verify association with the lease
      if (tenantId) {
        const [tenantRecord] = await db
          .select({
            assoc: leaseTenants,
            user: users,
          })
          .from(leaseTenants)
          .innerJoin(users, eq(leaseTenants.tenantId, users.id))
          .where(and(
            eq(leaseTenants.leaseId, leaseId),
            eq(leaseTenants.tenantId, tenantId)
          ))
          .limit(1);

        if (!tenantRecord) {
          return res.status(403).json({
            error: 'Forbidden: Tenant is not associated with the specified lease.',
            code: 'IDOR_VIOLATION',
          });
        }

        authoritativeTenantName = `${tenantRecord.user.firstName} ${tenantRecord.user.lastName}`;
      }
    }

    const rentVal = newRent || authoritativeCurrentRent || 850;
    const renewalDraft = `گرێبەستی نوێکردنەوەی بەکرێدان (HomeHub Automated Lease Renewal Draft)
خاوەن موڵک / بەڕێوەبەر: تۆماری ڕێگەپێدراوی هۆم هاب
کرێچی: ${authoritativeTenantName}
موڵک: ${propRecord.name}
بڕی کرێی نوێکراوە: $${rentVal} مانگانە
ماوە: ${termMonths} مانگ
ڕێکەوتی پێشنیارکراو: ${expiryDate || '2026-10-01'}

تێبینی فەرمی: ئەم بەڵگەنامەیە وەک پێشنیاری ڕەشنووس (AI Draft Recommendation) دروستکراوە و پێویستی بە وردبینی و واژۆی یاسایی دەستکاریپێنەکراوە لەلایەن لایەنە پەیوەندیدارەکان.

مەرجە بنەڕەتییەکان:
١. کرێچی بەردەوام دەبێت لە پێدانی کرێ لە ڕێگەی دەروازەی ئەلیکترۆنی هۆم هاب (FIB / FastPay / ZainCash).
٢. چاکسازی بنەڕەتی بەپێی یاسای خانووبەرەی هەرێمی کوردستان لە ئەستۆی لایەنە پەیوەندیدارەکان دەبێت.
٣. هەر گۆڕانکارییەک دەبێت لەلایەن هەردوولا بە فەرمی پەسەند بکرێت.`;

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'AI_GENERATE_LEASE_RENEWAL_DRAFT',
      resourceType: 'LeaseRenewalDraft',
      resourceId: `draft-${Date.now()}`,
      changes: { propertyId, propertyName: propRecord.name, leaseId, tenantId, rentVal, termMonths },
      ipAddress: (req.ip || '') as string,
    });

    return res.json({
      success: true,
      contractText: renewalDraft,
      generatedTimestamp: new Date().toISOString(),
      status: 'DRAFT_RECOMMENDATION',
      isAutonomousDraft: true,
      authoritativeData: {
        propertyId,
        propertyName: propRecord.name,
        leaseId,
        tenantId,
        rentAmount: rentVal,
        termMonths,
      },
    });
  }
);

router.post(
  '/recommendations/:id/action', 
  requireAuth, 
  requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.PLATFORM_ADMIN]), 
  async (req, res) => {
    const { id } = req.params;
    const { action, reason } = req.body;
  
  await auditService.logAction({
    actorUserId: req.user!.id,
    actorRole: req.user!.roles[0] as string,
    action: `RECOMMENDATION_${action.toUpperCase()}`,
    resourceType: 'Recommendation',
    resourceId: id as string,
    changes: { reason },
    ipAddress: (req.ip || "") as string
  });
  
  res.json({ success: true, message: `Recommendation ${id} processed with action ${action}` });
});

export default router;


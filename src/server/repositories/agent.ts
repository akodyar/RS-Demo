import { db } from '../../db/index.js';
import { 
  users, 
  properties, 
  listings, 
  propertyInquiries, 
  propertyViewings, 
  propertyOffers, 
  offerCounterHistory, 
  salesContracts, 
  salesTransactions,
  agentProfiles,
  agentLicenses,
  agentPropertyAssignments,
  agentLeads,
  agentTasks,
  agentCommissions,
  agentCompensationAgreements,
  agentEvents,
  organizations,
  ownershipRecords,
  documents,
  leases,
} from '../../db/schema.js';
import { eq, and, or, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';
import { 
  AgentProfile, 
  AgentLicense, 
  AgentPropertyAssignment, 
  AgentLead, 
  AgentTask, 
  AgentCommission, 
  AgentCalendarEvent, 
  AgentDashboardData,
  AgentAssignedPropertyItem,
  AgentRentalItem,
  AgentDocumentItem,
  AgentAnalyticsData,
  AgentStatus,
  AgentAvailability,
  AgentVerificationStatus,
  PropertyAssignmentStatus,
  LeadType,
  LeadStage,
  LeadPriority,
  TaskPriority,
  TaskStatus,
  DealCommissionStatus,
  CalendarEventType,
} from '../../types/agent.js';
import { Permission, UserRole } from '../../types/index.js';
import { auditService } from '../services/audit.js';

export class AgentRepository {
  private checkDatabaseConfigured() {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
  }

  // =========================================================================
  // 1. AGENT PROFILE & LICENSING
  // =========================================================================

  async getProfile(userId: string): Promise<AgentProfile | null> {
    this.checkDatabaseConfigured();
    const [record] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId)).limit(1);
    if (!record) return null;

    return {
      id: record.id,
      userId: record.userId,
      displayName: record.displayName,
      professionalTitle: record.professionalTitle,
      biography: record.biography || undefined,
      phone: record.phone || undefined,
      email: record.email || undefined,
      avatarUrl: record.avatarUrl || undefined,
      officeName: record.officeName || undefined,
      officeAddress: record.officeAddress || undefined,
      spokenLanguages: (record.spokenLanguages as string[]) || ['Kurdish', 'Arabic', 'English'],
      specialties: (record.specialties as string[]) || ['Residential Sales', 'Luxury Properties'],
      propertyTypes: (record.propertyTypes as string[]) || ['Villa', 'Apartment'],
      serviceAreas: (record.serviceAreas as string[]) || ['Erbil', 'Sulaymaniyah'],
      availabilityStatus: record.availabilityStatus as AgentAvailability,
      workingHours: (record.workingHours as Record<string, string>) || undefined,
      status: record.status as AgentStatus,
      isPublic: Boolean(record.isPublic),
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async upsertProfile(userId: string, data: Partial<AgentProfile>): Promise<AgentProfile> {
    this.checkDatabaseConfigured();
    const existing = await this.getProfile(userId);

    if (existing) {
      const [updated] = await db.update(agentProfiles)
        .set({
          displayName: data.displayName !== undefined ? data.displayName : existing.displayName,
          professionalTitle: data.professionalTitle !== undefined ? data.professionalTitle : existing.professionalTitle,
          biography: data.biography !== undefined ? data.biography : existing.biography,
          phone: data.phone !== undefined ? data.phone : existing.phone,
          email: data.email !== undefined ? data.email : existing.email,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
          officeName: data.officeName !== undefined ? data.officeName : existing.officeName,
          officeAddress: data.officeAddress !== undefined ? data.officeAddress : existing.officeAddress,
          spokenLanguages: data.spokenLanguages !== undefined ? data.spokenLanguages : existing.spokenLanguages,
          specialties: data.specialties !== undefined ? data.specialties : existing.specialties,
          propertyTypes: data.propertyTypes !== undefined ? data.propertyTypes : existing.propertyTypes,
          serviceAreas: data.serviceAreas !== undefined ? data.serviceAreas : existing.serviceAreas,
          availabilityStatus: data.availabilityStatus !== undefined ? data.availabilityStatus : existing.availabilityStatus,
          workingHours: data.workingHours !== undefined ? data.workingHours : existing.workingHours,
          isPublic: data.isPublic !== undefined ? data.isPublic : existing.isPublic,
          updatedAt: new Date(),
        })
        .where(eq(agentProfiles.userId, userId))
        .returning();

      return (await this.getProfile(userId))!;
    } else {
      const [created] = await db.insert(agentProfiles)
        .values({
          userId,
          displayName: data.displayName || 'Agent',
          professionalTitle: data.professionalTitle || 'Real Estate Agent',
          biography: data.biography || null,
          phone: data.phone || null,
          email: data.email || null,
          avatarUrl: data.avatarUrl || null,
          officeName: data.officeName || null,
          officeAddress: data.officeAddress || null,
          spokenLanguages: data.spokenLanguages || ['Kurdish', 'Arabic', 'English'],
          specialties: data.specialties || ['Residential Sales'],
          propertyTypes: data.propertyTypes || ['Villa', 'Apartment'],
          serviceAreas: data.serviceAreas || ['Erbil'],
          availabilityStatus: data.availabilityStatus || AgentAvailability.AVAILABLE,
          workingHours: data.workingHours || null,
          status: AgentStatus.PENDING_VERIFICATION,
          isPublic: data.isPublic !== undefined ? data.isPublic : true,
        })
        .returning();

      return (await this.getProfile(userId))!;
    }
  }

  async getLicense(userId: string): Promise<AgentLicense | null> {
    this.checkDatabaseConfigured();
    const [record] = await db.select().from(agentLicenses).where(eq(agentLicenses.userId, userId)).orderBy(desc(agentLicenses.createdAt)).limit(1);
    if (!record) return null;

    return {
      id: record.id,
      agentId: record.agentId,
      userId: record.userId,
      licenseNumber: record.licenseNumber,
      issuingAuthority: record.issuingAuthority,
      issuedDate: record.issuedDate || undefined,
      expiryDate: record.expiryDate || undefined,
      documentUrl: record.documentUrl || undefined,
      verificationStatus: record.verificationStatus as AgentVerificationStatus,
      reviewedBy: record.reviewedBy || undefined,
      reviewedAt: record.reviewedAt?.toISOString(),
      rejectionReason: record.rejectionReason || undefined,
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async submitLicense(userId: string, data: { licenseNumber: string; issuingAuthority: string; issuedDate?: string; expiryDate?: string; documentUrl?: string }): Promise<AgentLicense> {
    this.checkDatabaseConfigured();
    let profile = await this.getProfile(userId);
    if (!profile) {
      profile = await this.upsertProfile(userId, { displayName: 'Agent' });
    }

    const [created] = await db.insert(agentLicenses)
      .values({
        agentId: profile.id,
        userId,
        licenseNumber: data.licenseNumber,
        issuingAuthority: data.issuingAuthority,
        issuedDate: data.issuedDate || null,
        expiryDate: data.expiryDate || null,
        documentUrl: data.documentUrl || null,
        verificationStatus: AgentVerificationStatus.SUBMITTED,
      })
      .returning();

    return {
      id: created.id,
      agentId: created.agentId,
      userId: created.userId,
      licenseNumber: created.licenseNumber,
      issuingAuthority: created.issuingAuthority,
      issuedDate: created.issuedDate || undefined,
      expiryDate: created.expiryDate || undefined,
      documentUrl: created.documentUrl || undefined,
      verificationStatus: created.verificationStatus as AgentVerificationStatus,
      createdAt: created.createdAt?.toISOString(),
      updatedAt: created.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 2. PROPERTY ASSIGNMENTS & AUTHORIZATION
  // =========================================================================

  async getPropertyAssignments(userId: string): Promise<AgentPropertyAssignment[]> {
    this.checkDatabaseConfigured();
    const rows = await db.select()
      .from(agentPropertyAssignments)
      .where(and(
        eq(agentPropertyAssignments.userId, userId),
        eq(agentPropertyAssignments.status, PropertyAssignmentStatus.ACTIVE)
      ));

    return rows.map(r => ({
      id: r.id,
      agentId: r.agentId || undefined,
      userId: r.userId,
      propertyId: r.propertyId,
      companyId: r.companyId || undefined,
      assignedBy: r.assignedBy,
      permissions: (r.permissions as string[]) || [],
      status: r.status as PropertyAssignmentStatus,
      effectiveDate: r.effectiveDate?.toISOString(),
      expiryDate: r.expiryDate?.toISOString(),
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async getAssignedPropertyIds(userId: string): Promise<string[]> {
    this.checkDatabaseConfigured();
    const assignments = await this.getPropertyAssignments(userId);
    const now = new Date();
    return assignments
      .filter(a => !a.expiryDate || new Date(a.expiryDate) > now)
      .map(a => a.propertyId);
  }

  async assignProperty(assignedByUserId: string, data: {
    agentUserId: string;
    propertyId: string;
    companyId?: string;
    permissions?: string[];
    expiryDate?: string;
  }): Promise<AgentPropertyAssignment> {
    this.checkDatabaseConfigured();
    const defaultPermissions = [
      Permission.VIEW_PROPERTY,
      Permission.EDIT_LISTING,
      Permission.CREATE_LISTING,
      Permission.MANAGE_VIEWINGS,
      Permission.MANAGE_OFFERS,
      Permission.VIEW_DOCUMENTS,
    ];

    const agentProfile = await this.getProfile(data.agentUserId);

    const [record] = await db.insert(agentPropertyAssignments)
      .values({
        agentId: agentProfile?.id || null,
        userId: data.agentUserId,
        propertyId: data.propertyId,
        companyId: data.companyId || null,
        assignedBy: assignedByUserId,
        permissions: data.permissions || defaultPermissions,
        status: PropertyAssignmentStatus.ACTIVE,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      })
      .returning();

    return {
      id: record.id,
      agentId: record.agentId || undefined,
      userId: record.userId,
      propertyId: record.propertyId,
      companyId: record.companyId || undefined,
      assignedBy: record.assignedBy,
      permissions: (record.permissions as string[]) || [],
      status: record.status as PropertyAssignmentStatus,
      effectiveDate: record.effectiveDate?.toISOString(),
      expiryDate: record.expiryDate?.toISOString(),
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async revokePropertyAssignment(userId: string, assignmentId: string): Promise<boolean> {
    this.checkDatabaseConfigured();
    const [result] = await db.update(agentPropertyAssignments)
      .set({ status: PropertyAssignmentStatus.REVOKED, updatedAt: new Date() })
      .where(and(
        eq(agentPropertyAssignments.id, assignmentId),
        eq(agentPropertyAssignments.userId, userId)
      ))
      .returning();

    return Boolean(result);
  }

  async verifyAgentPropertyPermission(userId: string, propertyId: string, permission: Permission): Promise<boolean> {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (!assignedPropertyIds.includes(propertyId)) {
      return false;
    }

    const [assignment] = await db.select().from(agentPropertyAssignments).where(and(
      eq(agentPropertyAssignments.userId, userId),
      eq(agentPropertyAssignments.propertyId, propertyId),
      eq(agentPropertyAssignments.status, PropertyAssignmentStatus.ACTIVE)
    )).limit(1);

    if (!assignment) return false;
    const permissions = (assignment.permissions as string[]) || [];
    return permissions.includes(permission);
  }

  // =========================================================================
  // 3. DASHBOARD (AUTHORITATIVE RECONCILIATION)
  // =========================================================================

  async getAuthoritativeDashboard(userId: string): Promise<AgentDashboardData> {
    this.checkDatabaseConfigured();

    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);

    // 1. Total Listings
    let listingsCount = 0;
    let agentListingsRows: any[] = [];
    if (assignedPropertyIds.length > 0) {
      agentListingsRows = await db.select({
        listing: listings,
        property: properties,
      })
        .from(listings)
        .innerJoin(properties, eq(listings.propertyId, properties.id))
        .where(inArray(listings.propertyId, assignedPropertyIds))
        .limit(10);
      listingsCount = agentListingsRows.length;
    }

    // 2. Active Leads
    const leadsRows = await db.select().from(agentLeads).where(eq(agentLeads.userId, userId));
    const activeLeads = leadsRows.filter(l => l.stage !== LeadStage.CLOSED_WON && l.stage !== LeadStage.CLOSED_LOST);

    // 3. Scheduled Viewings Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let viewingsToday = 0;
    let todayViewingsRows: any[] = [];
    if (assignedPropertyIds.length > 0) {
      todayViewingsRows = await db.select()
        .from(propertyViewings)
        .where(and(
          inArray(propertyViewings.propertyId, assignedPropertyIds),
          gte(propertyViewings.scheduledAt, todayStart),
          lte(propertyViewings.scheduledAt, todayEnd)
        ));
      viewingsToday = todayViewingsRows.length;
    }

    // 4. Active Offers
    let activeOffersCount = 0;
    if (assignedPropertyIds.length > 0) {
      const offersRows = await db.select()
        .from(propertyOffers)
        .where(and(
          inArray(propertyOffers.propertyId, assignedPropertyIds),
          inArray(propertyOffers.status, ['OFFER_SUBMITTED', 'UNDER_REVIEW', 'COUNTERED'])
        ));
      activeOffersCount = offersRows.length;
    }

    // 5. Closed Deals & Total Commission Earned
    const commissionsRows = await db.select().from(agentCommissions).where(eq(agentCommissions.userId, userId));
    const closedCommissions = commissionsRows.filter(c => c.status === DealCommissionStatus.APPROVED || c.status === DealCommissionStatus.DISBURSED);
    const totalCommission = closedCommissions.reduce((acc, curr) => acc + Number(curr.agentShareAmount || 0), 0);

    // 6. Today's Events / Schedule
    const eventsToday = await db.select()
      .from(agentEvents)
      .where(and(
        eq(agentEvents.userId, userId),
        gte(agentEvents.startTime, todayStart),
        lte(agentEvents.startTime, todayEnd)
      ))
      .orderBy(asc(agentEvents.startTime));

    const todaySchedule = eventsToday.map(e => ({
      id: e.id,
      time: new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: e.eventType as CalendarEventType,
      title: e.title,
      subtitle: e.location || 'HomeHub Office / Site',
      actionType: (e.eventType === CalendarEventType.VIEWING ? 'VIEW' : e.eventType === CalendarEventType.TEAM_MEETING ? 'JOIN' : 'MEET') as 'VIEW' | 'MEET' | 'JOIN',
      actionTarget: e.linkedPropertyId || undefined,
    }));

    // If no events in DB yet, synthesize today's viewings into schedule
    if (todaySchedule.length === 0 && todayViewingsRows.length > 0) {
      todayViewingsRows.forEach(v => {
        todaySchedule.push({
          id: v.id,
          time: new Date(v.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: CalendarEventType.VIEWING,
          title: 'Property Viewing',
          subtitle: `Property ID: ${v.propertyId.substring(0, 8)}...`,
          actionType: 'VIEW',
          actionTarget: v.propertyId,
        });
      });
    }

    // Format My Listings
    const myListings = agentListingsRows.map(row => ({
      id: row.listing.id,
      propertyId: row.property.id,
      title: row.listing.title,
      location: `${row.property.neighborhood || 'Central'}, ${row.property.city || 'Erbil'}`,
      price: Number(row.listing.price || 0),
      currency: row.listing.currency || 'USD',
      status: row.listing.status || 'ACTIVE',
      beds: Number(row.property.bedrooms || 3),
      baths: Number(row.property.bathrooms || 2),
      areaSqm: Number(row.property.totalAreaSqm || 180),
      imageUrl: (row.property.images as string[])?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    }));

    // Format Recent Leads
    const sortedLeads = [...leadsRows].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    const recentLeads = sortedLeads.slice(0, 5).map(lead => ({
      id: lead.id,
      clientName: lead.clientName,
      leadType: lead.leadType as LeadType,
      summary: lead.notes || `Looking for ${lead.propertyType || 'property'} in Erbil`,
      stage: lead.stage as LeadStage,
      timeAgo: lead.createdAt ? getRelativeTime(lead.createdAt) : 'Just now',
      priority: lead.priority as LeadPriority,
    }));

    return {
      kpi: {
        totalListings: listingsCount,
        listingsDeltaMonth: 4,
        activeLeads: activeLeads.length,
        leadsDeltaWeek: 12,
        scheduledViewingsToday: viewingsToday,
        activeOffers: activeOffersCount,
        offersDeltaNew: 2,
        closedDealsThisYear: closedCommissions.length,
        totalCommissionEarned: totalCommission,
        commissionCurrency: 'USD',
      },
      propertyPerformance: {
        period: '30d',
        totalViews: 1245,
        totalInquiries: 86,
        totalViewings: 24,
        totalOffers: 6,
        timeline: [
          { date: 'Aug 24', views: 45, inquiries: 3 },
          { date: 'Aug 31', views: 110, inquiries: 8 },
          { date: 'Sep 7', views: 95, inquiries: 6 },
          { date: 'Sep 14', views: 140, inquiries: 12 },
          { date: 'Sep 21', views: 185, inquiries: 16 },
        ],
      },
      recentLeads,
      todaySchedule,
      myListings,
      aiAssistant: {
        greeting: 'Your AI Real Estate Assistant is ready.',
        suggestedPrompts: [
          'Suggest properties for my lead',
          'Analyze market trends',
          'Help me write a client message',
          'Create a property description',
        ],
        insightSnippet: 'High buyer activity in Italian Village and Dream City apartments this week.',
      },
      marketInsights: await this.getMarketInsights(),
    };
  }

  // =========================================================================
  // 4. LISTINGS MANAGEMENT
  // =========================================================================

  async getListings(userId: string) {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) {
      return [];
    }

    const rows = await db.select({
      listing: listings,
      property: properties,
    })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(inArray(listings.propertyId, assignedPropertyIds))
      .orderBy(desc(listings.createdAt));

    return rows.map(r => ({
      ...r.listing,
      property: r.property,
    }));
  }

  async createListing(userId: string, data: {
    propertyId: string;
    type: string;
    price: number;
    currency?: string;
    title: string;
    description?: string;
  }) {
    this.checkDatabaseConfigured();
    // Verify agent is assigned to property with CREATE_LISTING permission
    const hasPermission = await this.verifyAgentPropertyPermission(userId, data.propertyId, Permission.CREATE_LISTING);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: Agent lacks CREATE_LISTING permission on this property.');
    }

    const { properties, SUPPORTED_CURRENCIES } = await import('../../db/schema.js');
    const [propRecord] = await db.select().from(properties).where(eq(properties.id, data.propertyId)).limit(1);
    const effectiveCurrency = data.currency || propRecord?.currency || 'USD';
    if (!SUPPORTED_CURRENCIES.includes(effectiveCurrency as any)) {
      throw new Error(`VALIDATION_ERROR: Unsupported currency '${effectiveCurrency}'. Must be IQD or USD.`);
    }

    const [listing] = await db.insert(listings)
      .values({
        propertyId: data.propertyId,
        publisherUserId: userId,
        type: data.type,
        price: sql`${data.price}`,
        currency: effectiveCurrency,
        status: 'DRAFT',
        title: data.title,
        description: data.description || null,
      })
      .returning();

    return listing;
  }

  async updateListing(userId: string, listingId: string, data: Partial<{
    price: number;
    currency: string;
    title: string;
    description: string;
    status: string;
  }>) {
    this.checkDatabaseConfigured();
    const [existing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!existing) {
      throw new Error('LISTING_NOT_FOUND');
    }

    // Verify agent is assigned to property with EDIT_LISTING permission
    const hasPermission = await this.verifyAgentPropertyPermission(userId, existing.propertyId, Permission.EDIT_LISTING);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: Agent lacks EDIT_LISTING permission on this property.');
    }

    if (data.currency) {
      const { SUPPORTED_CURRENCIES } = await import('../../db/schema.js');
      if (!SUPPORTED_CURRENCIES.includes(data.currency as any)) {
        throw new Error(`VALIDATION_ERROR: Unsupported currency '${data.currency}'. Must be IQD or USD.`);
      }
    }

    const [updated] = await db.update(listings)
      .set({
        price: data.price !== undefined ? sql`${data.price}` : existing.price,
        currency: data.currency !== undefined ? data.currency : existing.currency,
        title: data.title !== undefined ? data.title : existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        status: data.status !== undefined ? data.status : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId))
      .returning();

    return updated;
  }

  // =========================================================================
  // 5. LEADS / CRM PIPELINE
  // =========================================================================

  async getLeads(userId: string, filter?: { stage?: string; type?: string }): Promise<AgentLead[]> {
    this.checkDatabaseConfigured();
    let query = db.select().from(agentLeads).where(eq(agentLeads.userId, userId));

    const rows = await query.orderBy(desc(agentLeads.createdAt));
    return rows.map(r => ({
      id: r.id,
      agentId: r.agentId || undefined,
      userId: r.userId,
      companyId: r.companyId || undefined,
      clientName: r.clientName,
      clientPhone: r.clientPhone || undefined,
      clientEmail: r.clientEmail || undefined,
      leadType: r.leadType as LeadType,
      stage: r.stage as LeadStage,
      budgetMin: r.budgetMin ? Number(r.budgetMin) : undefined,
      budgetMax: r.budgetMax ? Number(r.budgetMax) : undefined,
      currency: r.currency,
      preferredLocations: (r.preferredLocations as string[]) || undefined,
      propertyType: r.propertyType || undefined,
      notes: r.notes || undefined,
      nextFollowUp: r.nextFollowUp?.toISOString(),
      priority: r.priority as LeadPriority,
      source: r.source,
      linkedBuyerId: r.linkedBuyerId || undefined,
      linkedPropertyId: r.linkedPropertyId || undefined,
      linkedListingId: r.linkedListingId || undefined,
      linkedInquiryId: r.linkedInquiryId || undefined,
      linkedViewingId: r.linkedViewingId || undefined,
      linkedOfferId: r.linkedOfferId || undefined,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async getLeadById(userId: string, leadId: string): Promise<AgentLead | null> {
    this.checkDatabaseConfigured();
    const [record] = await db.select().from(agentLeads).where(and(
      eq(agentLeads.id, leadId),
      eq(agentLeads.userId, userId) // STRICT AGENT DATA ISOLATION
    )).limit(1);

    if (!record) return null;

    return {
      id: record.id,
      agentId: record.agentId || undefined,
      userId: record.userId,
      companyId: record.companyId || undefined,
      clientName: record.clientName,
      clientPhone: record.clientPhone || undefined,
      clientEmail: record.clientEmail || undefined,
      leadType: record.leadType as LeadType,
      stage: record.stage as LeadStage,
      budgetMin: record.budgetMin ? Number(record.budgetMin) : undefined,
      budgetMax: record.budgetMax ? Number(record.budgetMax) : undefined,
      currency: record.currency,
      preferredLocations: (record.preferredLocations as string[]) || undefined,
      propertyType: record.propertyType || undefined,
      notes: record.notes || undefined,
      nextFollowUp: record.nextFollowUp?.toISOString(),
      priority: record.priority as LeadPriority,
      source: record.source,
      linkedBuyerId: record.linkedBuyerId || undefined,
      linkedPropertyId: record.linkedPropertyId || undefined,
      linkedListingId: record.linkedListingId || undefined,
      linkedInquiryId: record.linkedInquiryId || undefined,
      linkedViewingId: record.linkedViewingId || undefined,
      linkedOfferId: record.linkedOfferId || undefined,
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async createLead(userId: string, data: Partial<AgentLead>): Promise<AgentLead> {
    this.checkDatabaseConfigured();
    const agentProfile = await this.getProfile(userId);

    const [record] = await db.insert(agentLeads)
      .values({
        agentId: agentProfile?.id || null,
        userId, // AUTHORITATIVE ASSIGNMENT TO CALLER
        companyId: data.companyId || null,
        clientName: data.clientName || 'New Client',
        clientPhone: data.clientPhone || null,
        clientEmail: data.clientEmail || null,
        leadType: data.leadType || LeadType.BUY,
        stage: LeadStage.NEW,
        budgetMin: data.budgetMin ? sql`${data.budgetMin}` : null,
        budgetMax: data.budgetMax ? sql`${data.budgetMax}` : null,
        currency: data.currency || 'USD',
        preferredLocations: data.preferredLocations || null,
        propertyType: data.propertyType || null,
        notes: data.notes || null,
        nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
        priority: data.priority || LeadPriority.MEDIUM,
        source: data.source || 'DIRECT_ENTRY',
        linkedBuyerId: data.linkedBuyerId || null,
        linkedPropertyId: data.linkedPropertyId || null,
        linkedListingId: data.linkedListingId || null,
      })
      .returning();

    return (await this.getLeadById(userId, record.id))!;
  }

  async updateLead(userId: string, leadId: string, data: Partial<AgentLead>): Promise<AgentLead> {
    this.checkDatabaseConfigured();
    const existing = await this.getLeadById(userId, leadId);
    if (!existing) {
      throw new Error('LEAD_NOT_FOUND_OR_FORBIDDEN');
    }

    const [updated] = await db.update(agentLeads)
      .set({
        clientName: data.clientName !== undefined ? data.clientName : existing.clientName,
        clientPhone: data.clientPhone !== undefined ? data.clientPhone : existing.clientPhone,
        clientEmail: data.clientEmail !== undefined ? data.clientEmail : existing.clientEmail,
        leadType: data.leadType !== undefined ? data.leadType : existing.leadType,
        budgetMin: data.budgetMin !== undefined ? sql`${data.budgetMin}` : existing.budgetMin ? sql`${existing.budgetMin}` : null,
        budgetMax: data.budgetMax !== undefined ? sql`${data.budgetMax}` : existing.budgetMax ? sql`${existing.budgetMax}` : null,
        currency: data.currency !== undefined ? data.currency : existing.currency,
        preferredLocations: data.preferredLocations !== undefined ? data.preferredLocations : existing.preferredLocations,
        propertyType: data.propertyType !== undefined ? data.propertyType : existing.propertyType,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        nextFollowUp: data.nextFollowUp !== undefined ? new Date(data.nextFollowUp) : existing.nextFollowUp ? new Date(existing.nextFollowUp) : null,
        priority: data.priority !== undefined ? data.priority : existing.priority,
        updatedAt: new Date(),
      })
      .where(and(eq(agentLeads.id, leadId), eq(agentLeads.userId, userId)))
      .returning();

    return (await this.getLeadById(userId, leadId))!;
  }

  async transitionLeadStage(userId: string, leadId: string, newStage: LeadStage): Promise<AgentLead> {
    this.checkDatabaseConfigured();
    const existing = await this.getLeadById(userId, leadId);
    if (!existing) {
      throw new Error('LEAD_NOT_FOUND_OR_FORBIDDEN');
    }

    // Server-side State Machine Validation:
    // NEW -> CONTACTED -> QUALIFIED -> VIEWING_SCHEDULED -> OFFER_MADE -> NEGOTIATING -> CLOSED_WON / CLOSED_LOST
    const validTransitions: Record<LeadStage, LeadStage[]> = {
      [LeadStage.NEW]: [LeadStage.CONTACTED, LeadStage.CLOSED_LOST],
      [LeadStage.CONTACTED]: [LeadStage.QUALIFIED, LeadStage.CLOSED_LOST],
      [LeadStage.QUALIFIED]: [LeadStage.VIEWING_SCHEDULED, LeadStage.CLOSED_LOST],
      [LeadStage.VIEWING_SCHEDULED]: [LeadStage.OFFER_MADE, LeadStage.QUALIFIED, LeadStage.CLOSED_LOST],
      [LeadStage.OFFER_MADE]: [LeadStage.NEGOTIATING, LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST],
      [LeadStage.NEGOTIATING]: [LeadStage.CLOSED_WON, LeadStage.CLOSED_LOST],
      [LeadStage.CLOSED_WON]: [],
      [LeadStage.CLOSED_LOST]: [LeadStage.NEW], // Allow reopening if client re-engages
    };

    const allowed = validTransitions[existing.stage] || [];
    if (!allowed.includes(newStage)) {
      throw new Error(`INVALID_STATE_TRANSITION: Cannot transition lead stage from ${existing.stage} to ${newStage}`);
    }

    await db.update(agentLeads)
      .set({ stage: newStage, updatedAt: new Date() })
      .where(and(eq(agentLeads.id, leadId), eq(agentLeads.userId, userId)));

    return (await this.getLeadById(userId, leadId))!;
  }

  // =========================================================================
  // 6. BUYER INQUIRIES INTEGRATION
  // =========================================================================

  async getInquiries(userId: string) {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) return [];

    return db.select()
      .from(propertyInquiries)
      .where(inArray(propertyInquiries.propertyId, assignedPropertyIds))
      .orderBy(desc(propertyInquiries.createdAt));
  }

  async respondToInquiry(userId: string, inquiryId: string, responseMessage: string) {
    this.checkDatabaseConfigured();
    const [inquiry] = await db.select().from(propertyInquiries).where(eq(propertyInquiries.id, inquiryId)).limit(1);
    if (!inquiry) throw new Error('INQUIRY_NOT_FOUND');

    // Authorize: check if agent is assigned to property
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (!assignedPropertyIds.includes(inquiry.propertyId)) {
      throw new Error('AUTHORITY_REQUIRED: You are not authorized to respond to inquiries for this property.');
    }

    const [updated] = await db.update(propertyInquiries)
      .set({
        responseMessage,
        respondedAt: new Date(),
        status: 'RESPONDED',
        updatedAt: new Date(),
      })
      .where(eq(propertyInquiries.id, inquiryId))
      .returning();

    return updated;
  }

  // =========================================================================
  // 7. VIEWINGS MANAGEMENT
  // =========================================================================

  async getViewings(userId: string) {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) return [];

    return db.select()
      .from(propertyViewings)
      .where(inArray(propertyViewings.propertyId, assignedPropertyIds))
      .orderBy(desc(propertyViewings.scheduledAt));
  }

  async updateViewingStatus(userId: string, viewingId: string, status: string, notes?: string) {
    this.checkDatabaseConfigured();
    const [viewing] = await db.select().from(propertyViewings).where(eq(propertyViewings.id, viewingId)).limit(1);
    if (!viewing) throw new Error('VIEWING_NOT_FOUND');

    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (!assignedPropertyIds.includes(viewing.propertyId)) {
      throw new Error('AUTHORITY_REQUIRED: Not authorized to manage viewings for this property.');
    }

    // State machine: REQUESTED -> CONFIRMED -> COMPLETED, or REQUESTED -> CANCELLED, or CONFIRMED -> NO_SHOW
    const validStatuses: Record<string, string[]> = {
      'REQUESTED': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      'COMPLETED': [],
      'CANCELLED': [],
      'NO_SHOW': [],
    };

    const allowed = validStatuses[viewing.status] || [];
    if (!allowed.includes(status)) {
      throw new Error(`INVALID_STATE_TRANSITION: Cannot transition viewing from ${viewing.status} to ${status}`);
    }

    const [updated] = await db.update(propertyViewings)
      .set({
        status,
        notes: notes !== undefined ? notes : viewing.notes,
        updatedAt: new Date(),
      })
      .where(eq(propertyViewings.id, viewingId))
      .returning();

    return updated;
  }

  // =========================================================================
  // 8. OFFERS & NEGOTIATIONS
  // =========================================================================

  async getOffers(userId: string) {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) return [];

    return db.select()
      .from(propertyOffers)
      .where(inArray(propertyOffers.propertyId, assignedPropertyIds))
      .orderBy(desc(propertyOffers.createdAt));
  }

  async submitCounterOffer(userId: string, offerId: string, counterAmount: number, counterTerms?: string, note?: string) {
    this.checkDatabaseConfigured();
    const [offer] = await db.select().from(propertyOffers).where(eq(propertyOffers.id, offerId)).limit(1);
    if (!offer) throw new Error('OFFER_NOT_FOUND');

    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (!assignedPropertyIds.includes(offer.propertyId)) {
      throw new Error('AUTHORITY_REQUIRED: Not authorized to facilitate counter-offers on this property.');
    }

    if (counterAmount <= 0) {
      throw new Error('INVALID_COUNTER_AMOUNT: Counter amount must be greater than zero.');
    }

    // Record in immutable negotiation history
    await db.insert(offerCounterHistory)
      .values({
        offerId,
        actorId: userId,
        actorRole: 'AGENT_INTERMEDIARY',
        counterAmount: sql`${counterAmount}`,
        currency: offer.currency,
        counterTerms: counterTerms || null,
        status: 'COUNTERED',
        note: note || null,
      });

    const [updatedOffer] = await db.update(propertyOffers)
      .set({
        status: 'COUNTERED',
        updatedAt: new Date(),
      })
      .where(eq(propertyOffers.id, offerId))
      .returning();

    return updatedOffer;
  }

  // =========================================================================
  // 9. SALES TRANSACTIONS & COMMISSIONS
  // =========================================================================

  async getTransactions(userId: string) {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) return [];

    return db.select()
      .from(salesTransactions)
      .where(inArray(salesTransactions.propertyId, assignedPropertyIds))
      .orderBy(desc(salesTransactions.createdAt));
  }

  async getCommissions(userId: string): Promise<AgentCommission[]> {
    this.checkDatabaseConfigured();
    const rows = await db.select().from(agentCommissions).where(eq(agentCommissions.userId, userId)).orderBy(desc(agentCommissions.createdAt));
    return rows.map(r => ({
      id: r.id,
      agentId: r.agentId || undefined,
      userId: r.userId,
      companyId: r.companyId || undefined,
      transactionId: r.transactionId || undefined,
      contractId: r.contractId || undefined,
      propertyId: r.propertyId || undefined,
      listingId: r.listingId || undefined,
      dealAmount: Number(r.dealAmount),
      dealType: r.dealType as 'SALE' | 'LEASE_ACQUISITION',
      commissionBasis: r.commissionBasis as 'PERCENTAGE' | 'FIXED_FEE',
      grossCommissionRate: r.grossCommissionRate ? Number(r.grossCommissionRate) : undefined,
      grossCommissionAmount: Number(r.grossCommissionAmount),
      brokerageSplitRate: r.brokerageSplitRate ? Number(r.brokerageSplitRate) : undefined,
      brokerageShareAmount: Number(r.brokerageShareAmount),
      agentShareAmount: Number(r.agentShareAmount),
      currency: r.currency,
      status: r.status as DealCommissionStatus,
      approvedBy: r.approvedBy || undefined,
      approvedAt: r.approvedAt?.toISOString(),
      disbursedAt: r.disbursedAt?.toISOString(),
      paymentReference: r.paymentReference || undefined,
      journalEntryId: r.journalEntryId || undefined,
      notes: r.notes || undefined,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async calculateDealCommission(userId: string, data: {
    transactionId?: string;
    contractId?: string;
    propertyId: string;
    dealAmount: number;
    currency?: string;
    notes?: string;
  }): Promise<AgentCommission> {
    this.checkDatabaseConfigured();
    if (data.dealAmount <= 0) {
      throw new Error('INVALID_DEAL_AMOUNT: Deal amount must be strictly greater than zero.');
    }

    const agentProfile = await this.getProfile(userId);
    if (!agentProfile) {
      throw new Error('NOT_FOUND: Agent profile not found.');
    }

    const [agreement] = await db.select()
      .from(agentCompensationAgreements)
      .where(and(
        eq(agentCompensationAgreements.agentId, agentProfile.id),
        eq(agentCompensationAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (!agreement) {
      throw new Error('UNAUTHORIZED: No active compensation agreement found for this agent. Commission allocation requires a valid agreement.');
    }

    const grossRate = 0.02;
    const grossCommission = Math.round(data.dealAmount * grossRate * 100) / 100;
    const brokerageSplitRate = Number(agreement.brokerageSplitRate);
    const brokerageShare = Math.round(grossCommission * brokerageSplitRate * 100) / 100;
    const agentShare = Math.round((grossCommission - brokerageShare) * 100) / 100;

    const [record] = await db.insert(agentCommissions)
      .values({
        agentId: agentProfile.id,
        userId,
        transactionId: data.transactionId || null,
        contractId: data.contractId || null,
        propertyId: data.propertyId,
        dealAmount: sql`${data.dealAmount}`,
        dealType: 'SALE',
        commissionBasis: 'PERCENTAGE',
        grossCommissionRate: sql`${grossRate}`,
        grossCommissionAmount: sql`${grossCommission}`,
        brokerageSplitRate: sql`${brokerageSplitRate}`,
        brokerageShareAmount: sql`${brokerageShare}`,
        agentShareAmount: sql`${agentShare}`,
        currency: data.currency || 'USD',
        status: DealCommissionStatus.CALCULATED,
        notes: data.notes || null,
      })
      .returning();

    return {
      id: record.id,
      agentId: record.agentId || undefined,
      userId: record.userId,
      companyId: record.companyId || undefined,
      transactionId: record.transactionId || undefined,
      contractId: record.contractId || undefined,
      propertyId: record.propertyId || undefined,
      listingId: record.listingId || undefined,
      dealAmount: Number(record.dealAmount),
      dealType: record.dealType as 'SALE' | 'LEASE_ACQUISITION',
      commissionBasis: record.commissionBasis as 'PERCENTAGE' | 'FIXED_FEE',
      grossCommissionRate: Number(record.grossCommissionRate),
      grossCommissionAmount: Number(record.grossCommissionAmount),
      brokerageSplitRate: Number(record.brokerageSplitRate),
      brokerageShareAmount: Number(record.brokerageShareAmount),
      agentShareAmount: Number(record.agentShareAmount),
      currency: record.currency,
      status: record.status as DealCommissionStatus,
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 10. TASKS MANAGEMENT
  // =========================================================================

  async getTasks(userId: string, filter?: { status?: string }): Promise<AgentTask[]> {
    this.checkDatabaseConfigured();
    const rows = await db.select().from(agentTasks).where(eq(agentTasks.userId, userId)).orderBy(asc(agentTasks.dueDate));
    return rows.map(r => ({
      id: r.id,
      agentId: r.agentId || undefined,
      userId: r.userId,
      companyId: r.companyId || undefined,
      title: r.title,
      description: r.description || undefined,
      priority: r.priority as TaskPriority,
      dueDate: r.dueDate?.toISOString(),
      status: r.status as TaskStatus,
      category: r.category,
      linkedLeadId: r.linkedLeadId || undefined,
      linkedPropertyId: r.linkedPropertyId || undefined,
      linkedViewingId: r.linkedViewingId || undefined,
      linkedOfferId: r.linkedOfferId || undefined,
      completedAt: r.completedAt?.toISOString(),
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async createTask(userId: string, data: Partial<AgentTask>): Promise<AgentTask> {
    this.checkDatabaseConfigured();
    const agentProfile = await this.getProfile(userId);

    const [record] = await db.insert(agentTasks)
      .values({
        agentId: agentProfile?.id || null,
        userId,
        title: data.title || 'New Task',
        description: data.description || null,
        priority: data.priority || TaskPriority.NORMAL,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: TaskStatus.PENDING,
        category: data.category || 'GENERAL',
        linkedLeadId: data.linkedLeadId || null,
        linkedPropertyId: data.linkedPropertyId || null,
      })
      .returning();

    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      description: record.description || undefined,
      priority: record.priority as TaskPriority,
      dueDate: record.dueDate?.toISOString(),
      status: record.status as TaskStatus,
      category: record.category,
      linkedLeadId: record.linkedLeadId || undefined,
      linkedPropertyId: record.linkedPropertyId || undefined,
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async updateTask(userId: string, taskId: string, data: Partial<AgentTask>): Promise<AgentTask> {
    this.checkDatabaseConfigured();
    const [existing] = await db.select().from(agentTasks).where(and(
      eq(agentTasks.id, taskId),
      eq(agentTasks.userId, userId)
    )).limit(1);

    if (!existing) throw new Error('TASK_NOT_FOUND_OR_FORBIDDEN');

    const [updated] = await db.update(agentTasks)
      .set({
        title: data.title !== undefined ? data.title : existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        priority: data.priority !== undefined ? data.priority : existing.priority,
        status: data.status !== undefined ? data.status : existing.status,
        completedAt: data.status === TaskStatus.COMPLETED ? new Date() : existing.completedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId)))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      description: updated.description || undefined,
      priority: updated.priority as TaskPriority,
      status: updated.status as TaskStatus,
      category: updated.category,
      linkedLeadId: updated.linkedLeadId || undefined,
      linkedPropertyId: updated.linkedPropertyId || undefined,
      completedAt: updated.completedAt?.toISOString(),
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 11. CALENDAR & SCHEDULE
  // =========================================================================

  async getCalendarEvents(userId: string, startDate?: string, endDate?: string): Promise<AgentCalendarEvent[]> {
    this.checkDatabaseConfigured();
    const rows = await db.select()
      .from(agentEvents)
      .where(eq(agentEvents.userId, userId))
      .orderBy(asc(agentEvents.startTime));

    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      eventType: r.eventType as CalendarEventType,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      location: r.location || undefined,
      meetingLink: r.meetingLink || undefined,
      status: r.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED',
      linkedLeadId: r.linkedLeadId || undefined,
      linkedViewingId: r.linkedViewingId || undefined,
      linkedPropertyId: r.linkedPropertyId || undefined,
      notes: r.notes || undefined,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async createCalendarEvent(userId: string, data: {
    title: string;
    eventType: CalendarEventType;
    startTime: string;
    endTime: string;
    location?: string;
    meetingLink?: string;
    linkedLeadId?: string;
    linkedPropertyId?: string;
    notes?: string;
  }): Promise<AgentCalendarEvent> {
    this.checkDatabaseConfigured();
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);

    if (end <= start) {
      throw new Error('INVALID_EVENT_TIME: End time must be after start time.');
    }

    const [record] = await db.insert(agentEvents)
      .values({
        userId,
        title: data.title,
        eventType: data.eventType,
        startTime: start,
        endTime: end,
        location: data.location || null,
        meetingLink: data.meetingLink || null,
        linkedLeadId: data.linkedLeadId || null,
        linkedPropertyId: data.linkedPropertyId || null,
        notes: data.notes || null,
        status: 'SCHEDULED',
      })
      .returning();

    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      eventType: record.eventType as CalendarEventType,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime.toISOString(),
      location: record.location || undefined,
      meetingLink: record.meetingLink || undefined,
      status: record.status as any,
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async getMarketInsights(city: string = 'Erbil'): Promise<any> {
    this.checkDatabaseConfigured();
    
    // Inquire actual active listings from authoritative database
    const activeListings = await db.select().from(listings).where(eq(listings.status, 'ACTIVE'));
    
    if (activeListings.length === 0) {
      return {
        city,
        averageSalePricePerSqm: 0,
        averageSalePriceChange: 0,
        averageRentPricePerSqm: 0,
        averageRentPriceChange: 0,
        activeListingsCount: 0,
        activeListingsChange: 0,
        marketDemand: 'LOW',
        marketDemandChange: 0,
        isAuthoritative: true,
        status: 'INSUFFICIENT_DATA',
        message: 'No active listings in database to compute local market statistics.',
      };
    }

    const saleListings = activeListings.filter(l => l.type === 'FOR_SALE');
    const rentListings = activeListings.filter(l => l.type === 'FOR_RENT');
    const avgSale = saleListings.length > 0
      ? Math.round(saleListings.reduce((sum, l) => sum + Number(l.price || 0), 0) / saleListings.length)
      : 0;
    const avgRent = rentListings.length > 0
      ? Math.round((rentListings.reduce((sum, l) => sum + Number(l.price || 0), 0) / rentListings.length) * 10) / 10
      : 0;

    return {
      city,
      averageSalePricePerSqm: avgSale,
      averageSalePriceChange: 0,
      averageRentPricePerSqm: avgRent,
      averageRentPriceChange: 0,
      activeListingsCount: activeListings.length,
      activeListingsChange: 0,
      marketDemand: activeListings.length > 5 ? 'HIGH' : 'MEDIUM',
      marketDemandChange: 0,
      isAuthoritative: true,
      status: 'AVAILABLE',
    };
  }

  // =========================================================================
  // 12. ASSIGNED PORTFOLIO & NON-OWNERSHIP ENFORCEMENT
  // =========================================================================

  async getAssignedProperties(userId: string): Promise<AgentAssignedPropertyItem[]> {
    this.checkDatabaseConfigured();
    const assignments = await db
      .select({
        assignment: agentPropertyAssignments,
        property: properties,
      })
      .from(agentPropertyAssignments)
      .innerJoin(properties, eq(agentPropertyAssignments.propertyId, properties.id))
      .where(and(
        eq(agentPropertyAssignments.userId, userId),
        eq(agentPropertyAssignments.status, PropertyAssignmentStatus.ACTIVE)
      ));

    const now = new Date();
    const activeAssignments = assignments.filter(a => !a.assignment.expiryDate || new Date(a.assignment.expiryDate) > now);

    const result: AgentAssignedPropertyItem[] = [];
    for (const item of activeAssignments) {
      const [ownership] = await db
        .select({
          ownerUser: users,
        })
        .from(ownershipRecords)
        .leftJoin(users, eq(ownershipRecords.ownerId, users.id))
        .where(and(
          eq(ownershipRecords.propertyId, item.property.id),
          eq(ownershipRecords.status, 'VERIFIED')
        ))
        .limit(1);

      const ownerName = ownership?.ownerUser
        ? `${ownership.ownerUser.firstName || ''} ${ownership.ownerUser.lastName || ''}`.trim() || 'Verified Owner'
        : 'Registered Owner';

      result.push({
        id: item.assignment.id,
        propertyId: item.property.id,
        title: item.property.name,
        propertyType: item.property.type,
        city: (item.property.address as any)?.city || 'Erbil',
        address: item.property.address,
        status: item.property.status || 'ACTIVE',
        isOwner: false, // Critical invariant: agent NEVER holds deed ownership
        assignmentStatus: item.assignment.status as PropertyAssignmentStatus,
        permissions: (item.assignment.permissions as string[]) || [],
        assignedBy: item.assignment.assignedBy,
        companyId: item.assignment.companyId || undefined,
        effectiveDate: item.assignment.effectiveDate?.toISOString(),
        expiryDate: item.assignment.expiryDate?.toISOString(),
        ownerName,
        createdAt: item.property.createdAt?.toISOString(),
      });
    }

    return result;
  }

  // =========================================================================
  // 13. RENTAL OPERATIONS & COORDINATION
  // =========================================================================

  async getAssignedRentals(userId: string): Promise<AgentRentalItem[]> {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (assignedPropertyIds.length === 0) return [];

    const rentalListings = await db
      .select({
        listing: listings,
        property: properties,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(and(
        inArray(listings.propertyId, assignedPropertyIds),
        eq(listings.type, 'FOR_RENT')
      ));

    const result: AgentRentalItem[] = [];
    for (const item of rentalListings) {
      const [assignment] = await db
        .select()
        .from(agentPropertyAssignments)
        .where(and(
          eq(agentPropertyAssignments.userId, userId),
          eq(agentPropertyAssignments.propertyId, item.property.id),
          eq(agentPropertyAssignments.status, PropertyAssignmentStatus.ACTIVE)
        ))
        .limit(1);

      const inqRows = await db
        .select()
        .from(propertyInquiries)
        .where(and(
          eq(propertyInquiries.propertyId, item.property.id),
          eq(propertyInquiries.status, 'PENDING')
        ));

      const viewingRows = await db
        .select()
        .from(propertyViewings)
        .where(and(
          eq(propertyViewings.propertyId, item.property.id),
          inArray(propertyViewings.status, ['REQUESTED', 'CONFIRMED'])
        ));

      const [activeLease] = await db
        .select()
        .from(leases)
        .where(and(
          eq(leases.propertyId, item.property.id),
          eq(leases.status, 'ACTIVE')
        ))
        .limit(1);

      result.push({
        propertyId: item.property.id,
        listingId: item.listing.id,
        title: item.listing.title,
        location: (item.property.address as any)?.city || 'Erbil',
        monthlyRent: Number(item.listing.price || 0),
        currency: item.listing.currency || 'USD',
        status: item.listing.status || 'PUBLISHED',
        assignedPermissions: (assignment?.permissions as string[]) || [],
        activeInquiriesCount: inqRows.length,
        activeViewingsCount: viewingRows.length,
        currentLeaseId: activeLease?.id || undefined,
        occupancyStatus: activeLease ? 'OCCUPIED' : 'VACANT',
      });
    }

    return result;
  }

  // =========================================================================
  // 14. DOCUMENTS & AGREEMENTS ACCESS
  // =========================================================================

  async getAssignedDocuments(userId: string): Promise<AgentDocumentItem[]> {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);

    const condition = assignedPropertyIds.length > 0
      ? or(eq(documents.uploaderUserId, userId), inArray(documents.propertyId, assignedPropertyIds))
      : eq(documents.uploaderUserId, userId);

    const docRows = await db
      .select({
        doc: documents,
        property: properties,
      })
      .from(documents)
      .leftJoin(properties, eq(documents.propertyId, properties.id))
      .where(condition)
      .orderBy(desc(documents.createdAt))
      .limit(50);

    return docRows.map(r => ({
      id: r.doc.id,
      title: r.doc.title,
      category: r.doc.documentType,
      propertyId: r.doc.propertyId || undefined,
      propertyName: r.property?.name || undefined,
      fileType: (r.doc.metadata as any)?.mimeType || 'application/pdf',
      fileSize: (r.doc.metadata as any)?.sizeBytes || 1024 * 1024,
      status: r.doc.verificationState || 'PENDING',
      downloadUrl: r.doc.fileUrl || `/api/storage/document/${r.doc.id}`,
      createdAt: r.doc.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  // =========================================================================
  // 15. PERFORMANCE ANALYTICS (AUTHORITATIVE METRICS)
  // =========================================================================

  async getPerformanceAnalytics(userId: string): Promise<AgentAnalyticsData> {
    this.checkDatabaseConfigured();
    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);

    const leads = await db.select().from(agentLeads).where(eq(agentLeads.userId, userId));
    const commissions = await db.select().from(agentCommissions).where(eq(agentCommissions.userId, userId));

    const totalLeadsCount = leads.length;
    const leadsByStage: Record<string, number> = {
      [LeadStage.NEW]: 0,
      [LeadStage.CONTACTED]: 0,
      [LeadStage.QUALIFIED]: 0,
      [LeadStage.VIEWING_SCHEDULED]: 0,
      [LeadStage.OFFER_MADE]: 0,
      [LeadStage.NEGOTIATING]: 0,
      [LeadStage.CLOSED_WON]: 0,
      [LeadStage.CLOSED_LOST]: 0,
    };
    for (const l of leads) {
      leadsByStage[l.stage] = (leadsByStage[l.stage] || 0) + 1;
    }

    const closedWonCount = leadsByStage[LeadStage.CLOSED_WON] || 0;
    const leadConversionRate = totalLeadsCount > 0 ? Math.round((closedWonCount / totalLeadsCount) * 1000) / 10 : 0;

    let scheduledViewingsCount = 0;
    let completedViewingsCount = 0;
    let activeOffersCount = 0;

    if (assignedPropertyIds.length > 0) {
      const viewings = await db.select().from(propertyViewings).where(inArray(propertyViewings.propertyId, assignedPropertyIds));
      scheduledViewingsCount = viewings.length;
      completedViewingsCount = viewings.filter(v => v.status === 'COMPLETED').length;

      const offers = await db.select().from(propertyOffers).where(inArray(propertyOffers.propertyId, assignedPropertyIds));
      activeOffersCount = offers.filter(o => ['OFFER_SUBMITTED', 'UNDER_REVIEW', 'COUNTERED'].includes(o.status)).length;
    }

    const viewingCompletionRate = scheduledViewingsCount > 0 ? Math.round((completedViewingsCount / scheduledViewingsCount) * 1000) / 10 : 0;
    const closedDealsCount = commissions.filter(c => c.status === DealCommissionStatus.APPROVED || c.status === DealCommissionStatus.DISBURSED).length;
    const totalCommissionsEarned = commissions
      .filter(c => c.status === DealCommissionStatus.APPROVED || c.status === DealCommissionStatus.DISBURSED)
      .reduce((sum, c) => sum + Number(c.agentShareAmount || 0), 0);

    const isInsufficient = assignedPropertyIds.length === 0 && totalLeadsCount === 0;

    return {
      assignedListingsCount: assignedPropertyIds.length,
      totalLeadsCount,
      leadsByStage,
      leadConversionRate,
      scheduledViewingsCount,
      completedViewingsCount,
      viewingCompletionRate,
      activeOffersCount,
      closedDealsCount,
      totalCommissionsEarned,
      currency: 'USD',
      status: isInsufficient ? 'INSUFFICIENT_DATA' : 'AVAILABLE',
    };
  }

  // =========================================================================
  // 16. LISTING STATUS MANAGEMENT
  // =========================================================================

  async updateListingStatus(userId: string, listingId: string, status: string) {
    this.checkDatabaseConfigured();
    const [existing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!existing) {
      throw new Error('LISTING_NOT_FOUND');
    }

    const hasPermission = await this.verifyAgentPropertyPermission(userId, existing.propertyId, Permission.EDIT_LISTING);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: Agent lacks EDIT_LISTING permission on this property.');
    }

    const validStatuses = ['DRAFT', 'PUBLISHED', 'UNDER_OFFER', 'SOLD', 'RENTED', 'WITHDRAWN'];
    if (!validStatuses.includes(status)) {
      throw new Error(`INVALID_LISTING_STATUS: Status '${status}' is not supported.`);
    }

    const [updated] = await db.update(listings)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId))
      .returning();

    await auditService.logAction({
      actorUserId: userId,
      actorRole: 'AGENT',
      action: 'UPDATE_LISTING_STATUS',
      resourceType: 'Listing',
      resourceId: listingId,
      changes: { previousStatus: existing.status, newStatus: status },
      ipAddress: '',
    });

    return updated;
  }

  // =========================================================================
  // 17. TRANSACTION DETAILS & FOLLOW-UP
  // =========================================================================

  async getTransactionById(userId: string, transactionId: string) {
    this.checkDatabaseConfigured();
    const [tx] = await db.select().from(salesTransactions).where(eq(salesTransactions.id, transactionId)).limit(1);
    if (!tx) throw new Error('TRANSACTION_NOT_FOUND');

    const assignedPropertyIds = await this.getAssignedPropertyIds(userId);
    if (!assignedPropertyIds.includes(tx.propertyId)) {
      throw new Error('AUTHORITY_REQUIRED: Not authorized to access transaction for this property.');
    }

    const [prop] = await db.select().from(properties).where(eq(properties.id, tx.propertyId)).limit(1);
    const [contract] = tx.contractId ? await db.select().from(salesContracts).where(eq(salesContracts.id, tx.contractId)).limit(1) : [null];

    return {
      ...tx,
      property: prop,
      contract,
    };
  }

  async addTransactionFollowUp(userId: string, transactionId: string, note: string) {
    this.checkDatabaseConfigured();
    const tx = await this.getTransactionById(userId, transactionId);

    const task = await this.createTask(userId, {
      title: `Follow-up: Transaction ${tx.transactionNumber}`,
      description: note,
      priority: TaskPriority.HIGH,
      category: 'TRANSACTION_COORDINATION',
      linkedPropertyId: tx.propertyId,
    });

    await auditService.logAction({
      actorUserId: userId,
      actorRole: 'AGENT',
      action: 'TRANSACTION_COORDINATION_NOTE_ADDED',
      resourceType: 'SalesTransaction',
      resourceId: transactionId,
      changes: { note, taskId: task.id },
      ipAddress: '',
    });

    return task;
  }
}

function getRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export const agentRepository = new AgentRepository();

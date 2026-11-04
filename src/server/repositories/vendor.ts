import { db } from '../../db/index.js';
import { 
  users, 
  properties, 
  units,
  maintenanceRequests,
  maintenanceQuotes,
  workOrders,
  inspections,
  maintenanceInvoices,
  vendorProfiles,
  vendorLicenses,
  vendorTasks,
  vendorEvents,
  vendorReviews,
  organizations,
} from '../../db/schema.js';
import { eq, and, desc, asc, sql, inArray, gte, lte, or } from 'drizzle-orm';
import { 
  VendorProfile, 
  VendorLicense, 
  VendorQuote, 
  VendorWorkOrder, 
  VendorInvoice, 
  VendorTask, 
  VendorEvent, 
  VendorReview, 
  VendorDashboardData,
  VendorStatus,
  VendorVerificationStatus,
  WorkOrderStatus,
  VendorQuoteStatus,
  VendorInvoiceStatus,
  VendorTaskPriority,
  VendorTaskStatus,
  VendorEventType
} from '../../types/vendor.js';

export class VendorRepository {
  private checkDatabaseConfigured() {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
  }

  // =========================================================================
  // 1. VENDOR PROFILE & LICENSES
  // =========================================================================

  async getProfile(userId: string): Promise<VendorProfile | null> {
    this.checkDatabaseConfigured();
    const [record] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, userId)).limit(1);
    if (!record) return null;

    return {
      id: record.id,
      userId: record.userId,
      organizationId: record.organizationId || undefined,
      businessName: record.businessName,
      legalName: record.legalName || undefined,
      bio: record.bio || undefined,
      categories: (record.categories as string[]) || [],
      specialties: (record.specialties as string[]) || [],
      serviceAreas: (record.serviceAreas as string[]) || [],
      phone: record.phone || undefined,
      email: record.email || undefined,
      workingHours: (record.workingHours as any) || undefined,
      emergencyAvailable: Boolean(record.emergencyAvailable),
      status: record.status as VendorStatus,
      verificationStatus: record.verificationStatus as VendorVerificationStatus,
      rating: Number(record.rating || '5.00'),
      reviewCount: record.reviewCount || 0,
      hourlyRate: record.hourlyRate ? Number(record.hourlyRate) : undefined,
      currency: record.currency || 'USD',
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
    };
  }

  async upsertProfile(userId: string, data: Partial<VendorProfile>): Promise<VendorProfile> {
    this.checkDatabaseConfigured();
    const existing = await this.getProfile(userId);

    if (existing) {
      const [updated] = await db.update(vendorProfiles)
        .set({
          businessName: data.businessName !== undefined ? data.businessName : existing.businessName,
          legalName: data.legalName !== undefined ? data.legalName : existing.legalName,
          bio: data.bio !== undefined ? data.bio : existing.bio,
          categories: data.categories !== undefined ? data.categories : existing.categories,
          specialties: data.specialties !== undefined ? data.specialties : existing.specialties,
          serviceAreas: data.serviceAreas !== undefined ? data.serviceAreas : existing.serviceAreas,
          phone: data.phone !== undefined ? data.phone : existing.phone,
          email: data.email !== undefined ? data.email : existing.email,
          workingHours: data.workingHours !== undefined ? data.workingHours : existing.workingHours,
          emergencyAvailable: data.emergencyAvailable !== undefined ? data.emergencyAvailable : existing.emergencyAvailable,
          hourlyRate: data.hourlyRate !== undefined ? data.hourlyRate.toString() : existing.hourlyRate?.toString(),
          currency: data.currency !== undefined ? data.currency : existing.currency,
          updatedAt: new Date(),
        })
        .where(eq(vendorProfiles.userId, userId))
        .returning();

      return {
        id: updated.id,
        userId: updated.userId,
        organizationId: updated.organizationId || undefined,
        businessName: updated.businessName,
        legalName: updated.legalName || undefined,
        bio: updated.bio || undefined,
        categories: (updated.categories as string[]) || [],
        specialties: (updated.specialties as string[]) || [],
        serviceAreas: (updated.serviceAreas as string[]) || [],
        phone: updated.phone || undefined,
        email: updated.email || undefined,
        workingHours: (updated.workingHours as any) || undefined,
        emergencyAvailable: Boolean(updated.emergencyAvailable),
        status: updated.status as VendorStatus,
        verificationStatus: updated.verificationStatus as VendorVerificationStatus,
        rating: Number(updated.rating || '5.00'),
        reviewCount: updated.reviewCount || 0,
        hourlyRate: updated.hourlyRate ? Number(updated.hourlyRate) : undefined,
        currency: updated.currency || 'USD',
        createdAt: updated.createdAt?.toISOString(),
        updatedAt: updated.updatedAt?.toISOString(),
      };
    } else {
      const [inserted] = await db.insert(vendorProfiles)
        .values({
          userId,
          businessName: data.businessName || 'Service Provider',
          legalName: data.legalName,
          bio: data.bio,
          categories: data.categories || ['HVAC', 'Plumbing', 'Electrical'],
          specialties: data.specialties || ['General Maintenance'],
          serviceAreas: data.serviceAreas || ['Erbil', 'Sulaymaniyah'],
          phone: data.phone,
          email: data.email,
          workingHours: data.workingHours,
          emergencyAvailable: Boolean(data.emergencyAvailable),
          status: 'ACTIVE',
          verificationStatus: 'PENDING',
          rating: '5.00',
          reviewCount: 0,
          hourlyRate: data.hourlyRate ? data.hourlyRate.toString() : '50.00',
          currency: data.currency || 'USD',
        })
        .returning();

      return {
        id: inserted.id,
        userId: inserted.userId,
        organizationId: inserted.organizationId || undefined,
        businessName: inserted.businessName,
        legalName: inserted.legalName || undefined,
        bio: inserted.bio || undefined,
        categories: (inserted.categories as string[]) || [],
        specialties: (inserted.specialties as string[]) || [],
        serviceAreas: (inserted.serviceAreas as string[]) || [],
        phone: inserted.phone || undefined,
        email: inserted.email || undefined,
        workingHours: (inserted.workingHours as any) || undefined,
        emergencyAvailable: Boolean(inserted.emergencyAvailable),
        status: inserted.status as VendorStatus,
        verificationStatus: inserted.verificationStatus as VendorVerificationStatus,
        rating: Number(inserted.rating || '5.00'),
        reviewCount: inserted.reviewCount || 0,
        hourlyRate: inserted.hourlyRate ? Number(inserted.hourlyRate) : undefined,
        currency: inserted.currency || 'USD',
        createdAt: inserted.createdAt?.toISOString(),
        updatedAt: inserted.updatedAt?.toISOString(),
      };
    }
  }

  async getLicenses(userId: string): Promise<VendorLicense[]> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);
    if (!profile) return [];

    const records = await db.select().from(vendorLicenses)
      .where(eq(vendorLicenses.vendorId, profile.id))
      .orderBy(desc(vendorLicenses.createdAt));

    return records.map(r => ({
      id: r.id,
      vendorId: r.vendorId,
      userId: r.userId,
      licenseType: r.licenseType,
      licenseNumber: r.licenseNumber,
      issuingAuthority: r.issuingAuthority,
      issueDate: r.issueDate?.toISOString(),
      expiryDate: r.expiryDate?.toISOString(),
      documentUrl: r.documentUrl || undefined,
      status: r.status as any,
      verifiedBy: r.verifiedBy || undefined,
      verifiedAt: r.verifiedAt?.toISOString(),
      notes: r.notes || undefined,
      createdAt: r.createdAt?.toISOString(),
    }));
  }

  async submitLicense(userId: string, data: {
    licenseType: string;
    licenseNumber: string;
    issuingAuthority: string;
    issueDate?: string;
    expiryDate?: string;
    documentUrl?: string;
    notes?: string;
  }): Promise<VendorLicense> {
    this.checkDatabaseConfigured();
    let profile = await this.getProfile(userId);
    if (!profile) {
      profile = await this.upsertProfile(userId, { businessName: 'Service Provider' });
    }

    const [inserted] = await db.insert(vendorLicenses)
      .values({
        vendorId: profile.id,
        userId,
        licenseType: data.licenseType,
        licenseNumber: data.licenseNumber,
        issuingAuthority: data.issuingAuthority,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        documentUrl: data.documentUrl,
        status: 'SUBMITTED',
        notes: data.notes,
      })
      .returning();

    return {
      id: inserted.id,
      vendorId: inserted.vendorId,
      userId: inserted.userId,
      licenseType: inserted.licenseType,
      licenseNumber: inserted.licenseNumber,
      issuingAuthority: inserted.issuingAuthority,
      issueDate: inserted.issueDate?.toISOString(),
      expiryDate: inserted.expiryDate?.toISOString(),
      documentUrl: inserted.documentUrl || undefined,
      status: inserted.status as any,
      notes: inserted.notes || undefined,
      createdAt: inserted.createdAt?.toISOString(),
    };
  }

  // =========================================================================
  // 2. SERVICE REQUESTS & WORK ORDERS
  // =========================================================================

  async getAssignedServiceRequests(userId: string) {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const vendorConditions = [eq(maintenanceRequests.assignedVendorId, userId)];
    if (profile) {
      vendorConditions.push(eq(maintenanceRequests.assignedVendorId, profile.id));
      if (profile.organizationId) {
        vendorConditions.push(eq(maintenanceRequests.assignedVendorId, profile.organizationId));
      }
    }

    const rows = await db.select({
      request: maintenanceRequests,
      property: properties,
      reporter: users,
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .leftJoin(users, eq(maintenanceRequests.reporterUserId, users.id))
    .where(or(...vendorConditions))
    .orderBy(desc(maintenanceRequests.createdAt));

    return rows.map(r => ({
      id: r.request.id,
      propertyId: r.request.propertyId,
      propertyName: r.property.name,
      propertyAddress: r.property.address,
      unitId: r.request.unitId || undefined,
      category: r.request.category,
      priority: r.request.priority,
      title: r.request.title,
      description: r.request.description,
      status: r.request.status,
      reporterName: r.reporter ? `${r.reporter.firstName} ${r.reporter.lastName}`.trim() : 'Authorized Tenant',
      createdAt: r.request.createdAt?.toISOString(),
      updatedAt: r.request.updatedAt?.toISOString(),
    }));
  }

  async getWorkOrders(userId: string, filters?: { status?: string }): Promise<VendorWorkOrder[]> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const conditions = [
      or(
        eq(workOrders.vendorUserId, userId),
        eq(workOrders.assignedTechnicianId, userId),
        profile ? eq(workOrders.vendorId, profile.id) : sql`1=0`,
        profile?.organizationId ? eq(workOrders.vendorId, profile.organizationId) : sql`1=0`
      )
    ];

    if (filters?.status) {
      conditions.push(eq(workOrders.status, filters.status));
    }

    const rows = await db.select({
      wo: workOrders,
      prop: properties,
      req: maintenanceRequests,
    })
    .from(workOrders)
    .innerJoin(properties, eq(workOrders.propertyId, properties.id))
    .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
    .where(and(...conditions))
    .orderBy(desc(workOrders.createdAt));

    return rows.map(r => ({
      id: r.wo.id,
      maintenanceRequestId: r.wo.maintenanceRequestId,
      quoteId: r.wo.quoteId || undefined,
      vendorId: r.wo.vendorId || undefined,
      vendorUserId: r.wo.vendorUserId || undefined,
      assignedTechnicianId: r.wo.assignedTechnicianId || undefined,
      propertyId: r.wo.propertyId,
      propertyName: r.prop.name,
      propertyAddress: r.prop.address ? (typeof r.prop.address === 'string' ? r.prop.address : JSON.stringify(r.prop.address)) : undefined,
      category: r.req.category,
      priority: (r.wo.priority as any) || 'MEDIUM',
      status: r.wo.status as WorkOrderStatus,
      scheduledStartDate: r.wo.scheduledStartDate || undefined,
      scheduledEndDate: r.wo.scheduledEndDate || undefined,
      actualStartDate: r.wo.actualStartDate || undefined,
      actualEndDate: r.wo.actualEndDate || undefined,
      scopeOfWork: r.wo.scopeOfWork || undefined,
      materialsUsed: (r.wo.materialsUsed as any) || undefined,
      completionNotes: r.wo.completionNotes || undefined,
      completionPhotos: (r.wo.completionPhotos as string[]) || undefined,
      rating: r.wo.rating ? Number(r.wo.rating) : undefined,
      createdAt: r.wo.createdAt?.toISOString(),
      updatedAt: r.wo.updatedAt?.toISOString(),
    }));
  }

  async getWorkOrderById(id: string, userId: string): Promise<VendorWorkOrder | null> {
    this.checkDatabaseConfigured();
    const list = await this.getWorkOrders(userId);
    return list.find(w => w.id === id) || null;
  }

  async updateWorkOrderStatus(
    id: string, 
    userId: string, 
    status: WorkOrderStatus, 
    notes?: string, 
    photos?: string[]
  ): Promise<VendorWorkOrder> {
    this.checkDatabaseConfigured();
    const target = await this.getWorkOrderById(id, userId);
    if (!target) {
      throw new Error('NOT_FOUND_OR_FORBIDDEN');
    }

    const updateFields: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'IN_PROGRESS' && !target.actualStartDate) {
      updateFields.actualStartDate = new Date().toISOString();
    }
    if (status === 'COMPLETED') {
      updateFields.actualEndDate = new Date().toISOString();
      if (notes) updateFields.completionNotes = notes;
      if (photos) updateFields.completionPhotos = photos;
    }

    const [updated] = await db.update(workOrders)
      .set(updateFields)
      .where(eq(workOrders.id, id))
      .returning();

    // If completed, update linked maintenance request
    if (status === 'COMPLETED') {
      await db.update(maintenanceRequests)
        .set({ status: 'COMPLETED', updatedAt: new Date() })
        .where(eq(maintenanceRequests.id, target.maintenanceRequestId));
    }

    return {
      ...target,
      status: updated.status as WorkOrderStatus,
      actualStartDate: updated.actualStartDate || target.actualStartDate,
      actualEndDate: updated.actualEndDate || target.actualEndDate,
      completionNotes: updated.completionNotes || target.completionNotes,
      completionPhotos: (updated.completionPhotos as string[]) || target.completionPhotos,
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 3. QUOTES & ESTIMATES (Confidential per vendor)
  // =========================================================================

  async getQuotes(userId: string): Promise<VendorQuote[]> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const conditions = [
      or(
        eq(maintenanceQuotes.vendorUserId, userId),
        profile ? eq(maintenanceQuotes.vendorId, profile.id) : sql`1=0`,
        profile?.organizationId ? eq(maintenanceQuotes.vendorId, profile.organizationId) : sql`1=0`
      )
    ];

    const rows = await db.select({
      q: maintenanceQuotes,
      prop: properties,
      req: maintenanceRequests,
    })
    .from(maintenanceQuotes)
    .innerJoin(properties, eq(maintenanceQuotes.propertyId, properties.id))
    .innerJoin(maintenanceRequests, eq(maintenanceQuotes.maintenanceRequestId, maintenanceRequests.id))
    .where(and(...conditions))
    .orderBy(desc(maintenanceQuotes.createdAt));

    return rows.map(r => ({
      id: r.q.id,
      maintenanceRequestId: r.q.maintenanceRequestId,
      vendorId: r.q.vendorId || undefined,
      vendorUserId: r.q.vendorUserId || undefined,
      propertyId: r.q.propertyId,
      propertyName: r.prop.name,
      totalAmount: Number(r.q.totalAmount),
      laborAmount: r.q.laborAmount ? Number(r.q.laborAmount) : 0,
      materialsAmount: r.q.materialsAmount ? Number(r.q.materialsAmount) : 0,
      feesAmount: r.q.feesAmount ? Number(r.q.feesAmount) : 0,
      currency: r.q.currency || 'USD',
      estimatedDuration: r.q.estimatedDuration || undefined,
      warrantyTerms: r.q.warrantyTerms || undefined,
      lineItems: (r.q.lineItems as any) || undefined,
      validUntil: r.q.validUntil || undefined,
      revisionNumber: r.q.revisionNumber || 1,
      status: r.q.status as VendorQuoteStatus,
      notes: r.q.notes || undefined,
      createdAt: r.q.createdAt?.toISOString(),
      updatedAt: r.q.updatedAt?.toISOString(),
    }));
  }

  async getQuoteById(id: string, userId: string): Promise<VendorQuote | null> {
    this.checkDatabaseConfigured();
    const quotes = await this.getQuotes(userId);
    return quotes.find(q => q.id === id) || null;
  }

  async createQuote(userId: string, data: {
    maintenanceRequestId: string;
    propertyId: string;
    totalAmount: number;
    laborAmount?: number;
    materialsAmount?: number;
    feesAmount?: number;
    currency?: string;
    estimatedDuration?: string;
    warrantyTerms?: string;
    lineItems?: any[];
    validUntil?: string;
    notes?: string;
  }): Promise<VendorQuote> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const [inserted] = await db.insert(maintenanceQuotes)
      .values({
        maintenanceRequestId: data.maintenanceRequestId,
        propertyId: data.propertyId,
        vendorUserId: userId,
        vendorId: profile ? profile.id : undefined,
        totalAmount: data.totalAmount.toString(),
        laborAmount: data.laborAmount !== undefined ? data.laborAmount.toString() : '0',
        materialsAmount: data.materialsAmount !== undefined ? data.materialsAmount.toString() : '0',
        feesAmount: data.feesAmount !== undefined ? data.feesAmount.toString() : '0',
        currency: data.currency || 'USD',
        estimatedDuration: data.estimatedDuration,
        warrantyTerms: data.warrantyTerms,
        lineItems: data.lineItems || [],
        validUntil: data.validUntil,
        revisionNumber: 1,
        status: 'PENDING_APPROVAL',
        notes: data.notes,
      })
      .returning();

    // Update maintenance request status
    await db.update(maintenanceRequests)
      .set({ status: 'QUOTE_RECEIVED', updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, data.maintenanceRequestId));

    return {
      id: inserted.id,
      maintenanceRequestId: inserted.maintenanceRequestId,
      vendorId: inserted.vendorId || undefined,
      vendorUserId: inserted.vendorUserId || userId,
      propertyId: inserted.propertyId,
      totalAmount: Number(inserted.totalAmount),
      laborAmount: inserted.laborAmount ? Number(inserted.laborAmount) : 0,
      materialsAmount: inserted.materialsAmount ? Number(inserted.materialsAmount) : 0,
      feesAmount: inserted.feesAmount ? Number(inserted.feesAmount) : 0,
      currency: inserted.currency || 'USD',
      estimatedDuration: inserted.estimatedDuration || undefined,
      warrantyTerms: inserted.warrantyTerms || undefined,
      lineItems: (inserted.lineItems as any) || undefined,
      validUntil: inserted.validUntil || undefined,
      revisionNumber: inserted.revisionNumber || 1,
      status: inserted.status as VendorQuoteStatus,
      notes: inserted.notes || undefined,
      createdAt: inserted.createdAt?.toISOString(),
      updatedAt: inserted.updatedAt?.toISOString(),
    };
  }

  async reviseQuote(id: string, userId: string, data: {
    totalAmount: number;
    laborAmount?: number;
    materialsAmount?: number;
    feesAmount?: number;
    lineItems?: any[];
    notes?: string;
  }): Promise<VendorQuote> {
    this.checkDatabaseConfigured();
    const existing = await this.getQuoteById(id, userId);
    if (!existing) {
      throw new Error('NOT_FOUND_OR_FORBIDDEN');
    }

    if (existing.status === 'APPROVED') {
      throw new Error('CANNOT_REVISE_APPROVED_QUOTE');
    }

    const nextRevision = (existing.revisionNumber || 1) + 1;

    const [updated] = await db.update(maintenanceQuotes)
      .set({
        totalAmount: data.totalAmount.toString(),
        laborAmount: data.laborAmount !== undefined ? data.laborAmount.toString() : existing.laborAmount?.toString(),
        materialsAmount: data.materialsAmount !== undefined ? data.materialsAmount.toString() : existing.materialsAmount?.toString(),
        feesAmount: data.feesAmount !== undefined ? data.feesAmount.toString() : existing.feesAmount?.toString(),
        lineItems: data.lineItems || existing.lineItems,
        notes: data.notes || existing.notes,
        revisionNumber: nextRevision,
        status: 'PENDING_APPROVAL',
        updatedAt: new Date(),
      })
      .where(eq(maintenanceQuotes.id, id))
      .returning();

    return {
      ...existing,
      totalAmount: Number(updated.totalAmount),
      laborAmount: updated.laborAmount ? Number(updated.laborAmount) : 0,
      materialsAmount: updated.materialsAmount ? Number(updated.materialsAmount) : 0,
      feesAmount: updated.feesAmount ? Number(updated.feesAmount) : 0,
      revisionNumber: updated.revisionNumber || nextRevision,
      status: updated.status as VendorQuoteStatus,
      notes: updated.notes || undefined,
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 4. INVOICES & FINANCIAL REFERENCES
  // =========================================================================

  async getInvoices(userId: string): Promise<VendorInvoice[]> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const conditions = [
      or(
        eq(maintenanceInvoices.vendorUserId, userId),
        profile ? eq(maintenanceInvoices.vendorId, profile.id) : sql`1=0`,
        profile?.organizationId ? eq(maintenanceInvoices.vendorId, profile.organizationId) : sql`1=0`
      )
    ];

    const records = await db.select({
      inv: maintenanceInvoices,
      wo: workOrders,
      prop: properties,
    })
    .from(maintenanceInvoices)
    .innerJoin(workOrders, eq(maintenanceInvoices.workOrderId, workOrders.id))
    .innerJoin(properties, eq(maintenanceInvoices.propertyId, properties.id))
    .where(and(...conditions))
    .orderBy(desc(maintenanceInvoices.createdAt));

    return records.map(r => ({
      id: r.inv.id,
      workOrderId: r.inv.workOrderId,
      quoteId: r.inv.quoteId || undefined,
      propertyId: r.inv.propertyId,
      propertyName: r.prop.name,
      vendorId: r.inv.vendorId || undefined,
      vendorUserId: r.inv.vendorUserId || undefined,
      invoiceNumber: r.inv.invoiceNumber || undefined,
      amount: Number(r.inv.amount),
      currency: r.inv.currency || 'USD',
      status: r.inv.status as VendorInvoiceStatus,
      lineItems: (r.inv.lineItems as any) || undefined,
      paymentReference: r.inv.paymentReference || undefined,
      paidAt: r.inv.paidAt?.toISOString(),
      createdAt: r.inv.createdAt?.toISOString(),
      updatedAt: r.inv.updatedAt?.toISOString(),
    }));
  }

  async createInvoice(userId: string, data: {
    workOrderId: string;
    quoteId?: string;
    amount: number;
    currency?: string;
    lineItems?: any[];
  }): Promise<VendorInvoice> {
    this.checkDatabaseConfigured();
    const wo = await this.getWorkOrderById(data.workOrderId, userId);
    if (!wo) {
      throw new Error('WORK_ORDER_NOT_FOUND_OR_UNAUTHORIZED');
    }

    const profile = await this.getProfile(userId);
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;

    const [inserted] = await db.insert(maintenanceInvoices)
      .values({
        workOrderId: data.workOrderId,
        propertyId: wo.propertyId,
        quoteId: data.quoteId || wo.quoteId,
        vendorUserId: userId,
        vendorId: profile ? profile.id : undefined,
        amount: data.amount.toString(),
        currency: data.currency || 'USD',
        invoiceNumber: invoiceNum,
        lineItems: data.lineItems || [],
        status: 'SUBMITTED',
      })
      .returning();

    return {
      id: inserted.id,
      workOrderId: inserted.workOrderId,
      quoteId: inserted.quoteId || undefined,
      propertyId: inserted.propertyId,
      propertyName: wo.propertyName,
      vendorId: inserted.vendorId || undefined,
      vendorUserId: inserted.vendorUserId || userId,
      invoiceNumber: inserted.invoiceNumber || invoiceNum,
      amount: Number(inserted.amount),
      currency: inserted.currency || 'USD',
      status: inserted.status as VendorInvoiceStatus,
      lineItems: (inserted.lineItems as any) || undefined,
      createdAt: inserted.createdAt?.toISOString(),
      updatedAt: inserted.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 5. SCHEDULE & TASKS
  // =========================================================================

  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<VendorEvent[]> {
    this.checkDatabaseConfigured();
    const conditions = [eq(vendorEvents.userId, userId)];

    if (startDate) {
      conditions.push(gte(vendorEvents.startTime, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(vendorEvents.endTime, new Date(endDate)));
    }

    const records = await db.select().from(vendorEvents)
      .where(and(...conditions))
      .orderBy(asc(vendorEvents.startTime));

    return records.map(r => ({
      id: r.id,
      vendorId: r.vendorId || undefined,
      userId: r.userId,
      title: r.title,
      eventType: r.eventType as VendorEventType,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      location: r.location || undefined,
      linkedWorkOrderId: r.linkedWorkOrderId || undefined,
      linkedPropertyId: r.linkedPropertyId || undefined,
      status: r.status as any,
      notes: r.notes || undefined,
      createdAt: r.createdAt?.toISOString(),
    }));
  }

  async createEvent(userId: string, data: {
    title: string;
    eventType: VendorEventType;
    startTime: string;
    endTime: string;
    location?: string;
    linkedWorkOrderId?: string;
    linkedPropertyId?: string;
    notes?: string;
  }): Promise<VendorEvent> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const [inserted] = await db.insert(vendorEvents)
      .values({
        userId,
        vendorId: profile ? profile.id : undefined,
        title: data.title,
        eventType: data.eventType,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        location: data.location,
        linkedWorkOrderId: data.linkedWorkOrderId,
        linkedPropertyId: data.linkedPropertyId,
        status: 'SCHEDULED',
        notes: data.notes,
      })
      .returning();

    return {
      id: inserted.id,
      vendorId: inserted.vendorId || undefined,
      userId: inserted.userId,
      title: inserted.title,
      eventType: inserted.eventType as VendorEventType,
      startTime: inserted.startTime.toISOString(),
      endTime: inserted.endTime.toISOString(),
      location: inserted.location || undefined,
      linkedWorkOrderId: inserted.linkedWorkOrderId || undefined,
      linkedPropertyId: inserted.linkedPropertyId || undefined,
      status: inserted.status as any,
      notes: inserted.notes || undefined,
      createdAt: inserted.createdAt?.toISOString(),
    };
  }

  async getTasks(userId: string): Promise<VendorTask[]> {
    this.checkDatabaseConfigured();
    const records = await db.select().from(vendorTasks)
      .where(eq(vendorTasks.userId, userId))
      .orderBy(desc(vendorTasks.createdAt));

    return records.map(r => ({
      id: r.id,
      vendorId: r.vendorId || undefined,
      userId: r.userId,
      title: r.title,
      description: r.description || undefined,
      priority: r.priority as VendorTaskPriority,
      status: r.status as VendorTaskStatus,
      dueDate: r.dueDate?.toISOString(),
      linkedWorkOrderId: r.linkedWorkOrderId || undefined,
      linkedRequestId: r.linkedRequestId || undefined,
      completedAt: r.completedAt?.toISOString(),
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));
  }

  async createTask(userId: string, data: {
    title: string;
    description?: string;
    priority?: VendorTaskPriority;
    dueDate?: string;
    linkedWorkOrderId?: string;
    linkedRequestId?: string;
  }): Promise<VendorTask> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);

    const [inserted] = await db.insert(vendorTasks)
      .values({
        userId,
        vendorId: profile ? profile.id : undefined,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        status: 'PENDING',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        linkedWorkOrderId: data.linkedWorkOrderId,
        linkedRequestId: data.linkedRequestId,
      })
      .returning();

    return {
      id: inserted.id,
      vendorId: inserted.vendorId || undefined,
      userId: inserted.userId,
      title: inserted.title,
      description: inserted.description || undefined,
      priority: inserted.priority as VendorTaskPriority,
      status: inserted.status as VendorTaskStatus,
      dueDate: inserted.dueDate?.toISOString(),
      linkedWorkOrderId: inserted.linkedWorkOrderId || undefined,
      linkedRequestId: inserted.linkedRequestId || undefined,
      createdAt: inserted.createdAt?.toISOString(),
      updatedAt: inserted.updatedAt?.toISOString(),
    };
  }

  async updateTask(taskId: string, userId: string, updates: Partial<VendorTask>): Promise<VendorTask> {
    this.checkDatabaseConfigured();
    const [existing] = await db.select().from(vendorTasks).where(and(
      eq(vendorTasks.id, taskId),
      eq(vendorTasks.userId, userId)
    )).limit(1);

    if (!existing) {
      throw new Error('TASK_NOT_FOUND_OR_FORBIDDEN');
    }

    const patch: any = {
      updatedAt: new Date(),
    };
    if (updates.status) {
      patch.status = updates.status;
      if (updates.status === 'COMPLETED') {
        patch.completedAt = new Date();
      }
    }
    if (updates.title) patch.title = updates.title;
    if (updates.priority) patch.priority = updates.priority;
    if (updates.dueDate) patch.dueDate = new Date(updates.dueDate);

    const [updated] = await db.update(vendorTasks)
      .set(patch)
      .where(eq(vendorTasks.id, taskId))
      .returning();

    return {
      id: updated.id,
      vendorId: updated.vendorId || undefined,
      userId: updated.userId,
      title: updated.title,
      description: updated.description || undefined,
      priority: updated.priority as VendorTaskPriority,
      status: updated.status as VendorTaskStatus,
      dueDate: updated.dueDate?.toISOString(),
      linkedWorkOrderId: updated.linkedWorkOrderId || undefined,
      linkedRequestId: updated.linkedRequestId || undefined,
      completedAt: updated.completedAt?.toISOString(),
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  // =========================================================================
  // 6. REVIEWS & RATINGS
  // =========================================================================

  async getReviews(userId: string): Promise<VendorReview[]> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);
    if (!profile) return [];

    const records = await db.select({
      rev: vendorReviews,
      reviewer: users,
    })
    .from(vendorReviews)
    .innerJoin(users, eq(vendorReviews.reviewerUserId, users.id))
    .where(eq(vendorReviews.vendorId, profile.id))
    .orderBy(desc(vendorReviews.createdAt));

    return records.map(r => ({
      id: r.rev.id,
      vendorId: r.rev.vendorId,
      workOrderId: r.rev.workOrderId,
      reviewerUserId: r.rev.reviewerUserId,
      reviewerName: `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim() || 'Client',
      reviewerRole: r.rev.reviewerRole,
      rating: r.rev.rating,
      comment: r.rev.comment,
      vendorResponse: r.rev.vendorResponse || undefined,
      respondedAt: r.rev.respondedAt?.toISOString(),
      createdAt: r.rev.createdAt?.toISOString(),
    }));
  }

  async respondToReview(reviewId: string, userId: string, response: string): Promise<VendorReview> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error('PROFILE_NOT_FOUND');

    const [existing] = await db.select({
      rev: vendorReviews,
      reviewer: users,
    })
    .from(vendorReviews)
    .innerJoin(users, eq(vendorReviews.reviewerUserId, users.id))
    .where(and(
      eq(vendorReviews.id, reviewId),
      eq(vendorReviews.vendorId, profile.id)
    ))
    .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND_OR_FORBIDDEN');

    const [updated] = await db.update(vendorReviews)
      .set({
        vendorResponse: response,
        respondedAt: new Date(),
      })
      .where(eq(vendorReviews.id, reviewId))
      .returning();

    return {
      id: updated.id,
      vendorId: updated.vendorId,
      workOrderId: updated.workOrderId,
      reviewerUserId: updated.reviewerUserId,
      reviewerName: `${existing.reviewer.firstName} ${existing.reviewer.lastName}`.trim() || 'Client',
      reviewerRole: updated.reviewerRole,
      rating: updated.rating,
      comment: updated.comment,
      vendorResponse: updated.vendorResponse || undefined,
      respondedAt: updated.respondedAt?.toISOString(),
      createdAt: updated.createdAt?.toISOString(),
    };
  }

  // =========================================================================
  // 7. AUTHORITATIVE DASHBOARD AGGREGATION
  // =========================================================================

  async getAuthoritativeDashboard(userId: string): Promise<VendorDashboardData> {
    this.checkDatabaseConfigured();
    const profile = await this.getProfile(userId);
    const workOrdersList = await this.getWorkOrders(userId);
    const quotesList = await this.getQuotes(userId);
    const invoicesList = await this.getInvoices(userId);
    const eventsList = await this.getEvents(userId);
    const reviewsList = await this.getReviews(userId);
    const assignedRequests = await this.getAssignedServiceRequests(userId);

    // Dynamic metrics
    const activeWorkOrders = workOrdersList.filter(w => w.status === 'IN_PROGRESS' || w.status === 'SCHEDULED').length;
    
    // Scheduled today
    const todayStr = new Date().toISOString().split('T')[0];
    const scheduledToday = workOrdersList.filter(w => w.scheduledStartDate?.startsWith(todayStr)).length +
      eventsList.filter(e => e.startTime.startsWith(todayStr)).length;

    const pendingQuotes = quotesList.filter(q => q.status === VendorQuoteStatus.PENDING_APPROVAL || q.status === VendorQuoteStatus.SUBMITTED || q.status === VendorQuoteStatus.DRAFT).length;

    // Completed this month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const completedThisMonth = workOrdersList.filter(w => w.status === 'COMPLETED' && w.actualEndDate?.startsWith(currentMonth)).length;

    // Total earnings this month from paid or approved invoices
    const totalEarnings = invoicesList
      .filter(i => (i.status === 'PAID' || i.status === 'APPROVED') && i.createdAt?.startsWith(currentMonth))
      .reduce((sum, i) => sum + i.amount, 0);

    const averageRating = profile?.rating || (reviewsList.length > 0 
      ? Number((reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1))
      : 5.0);

    // Job Activity breakdown for last 7 days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const jobActivityDays = days.map((day, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      return {
        day,
        newRequests: assignedRequests.filter(r => r.createdAt?.startsWith(dateStr)).length,
        inProgress: workOrdersList.filter(w => w.status === 'IN_PROGRESS' && w.actualStartDate?.startsWith(dateStr)).length,
        completed: workOrdersList.filter(w => w.status === 'COMPLETED' && w.actualEndDate?.startsWith(dateStr)).length,
      };
    });

    // Request overview status counts
    const reqNew = assignedRequests.filter(r => r.status === 'REPORTED').length;
    const reqAssigned = assignedRequests.filter(r => r.status === 'TRIAGED' || r.status === 'QUOTE_RECEIVED').length;
    const reqInProgress = workOrdersList.filter(w => w.status === 'IN_PROGRESS').length;
    const reqOnHold = workOrdersList.filter(w => w.status === 'PAUSED').length;
    const reqCompleted = workOrdersList.filter(w => w.status === 'COMPLETED').length;
    const reqTotal = reqNew + reqAssigned + reqInProgress + reqOnHold + reqCompleted;

    // Today's schedule items
    const scheduleItems = [
      ...eventsList.map(e => ({
        id: e.id,
        time: e.startTime.substring(11, 16),
        endTime: e.endTime.substring(11, 16),
        title: e.title,
        propertyLocation: e.location || 'HomeHub Property',
        status: (e.eventType === 'CLIENT_MEETING' ? 'MEETING' : 'SCHEDULED') as 'IN_PROGRESS' | 'SCHEDULED' | 'MEETING',
        workOrderId: e.linkedWorkOrderId,
      })),
      ...workOrdersList.filter(w => w.scheduledStartDate?.startsWith(todayStr)).map(w => ({
        id: w.id,
        time: w.scheduledStartDate ? w.scheduledStartDate.substring(11, 16) || '09:00' : '09:00',
        endTime: w.scheduledEndDate ? w.scheduledEndDate.substring(11, 16) || '11:00' : '11:00',
        title: `${w.category || 'Maintenance'} - ${w.priority}`,
        propertyLocation: w.propertyName || 'Property',
        status: (w.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SCHEDULED') as 'IN_PROGRESS' | 'SCHEDULED' | 'MEETING',
        workOrderId: w.id,
      }))
    ].slice(0, 5);

    // Recent requests
    const recentRequests = assignedRequests.slice(0, 5).map(r => {
      let mappedStatus: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' = 'NEW';
      if (r.status === 'REPORTED') mappedStatus = 'NEW';
      else if (r.status === 'TRIAGED' || r.status === 'QUOTE_RECEIVED') mappedStatus = 'ASSIGNED';
      else if (r.status === 'IN_PROGRESS') mappedStatus = 'IN_PROGRESS';
      else if (r.status === 'COMPLETED') mappedStatus = 'COMPLETED';

      return {
        id: r.id,
        srCode: `#SR-${new Date().getFullYear()}-${r.id.slice(0, 4)}`,
        title: r.title,
        location: r.propertyAddress ? String(r.propertyAddress) : (r.propertyName || 'Property Location'),
        status: mappedStatus,
        priority: (r.priority as any) || 'MEDIUM',
        timeAgo: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent',
      };
    });

    // Top service categories
    const categoryCounts: Record<string, number> = {};
    workOrdersList.forEach(w => {
      const cat = w.category || 'General Maintenance';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const totalCat = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;
    const topCategories = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      percentage: Math.round((count / totalCat) * 100),
      jobCount: count,
    }));

    // Monthly earnings
    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].slice(
      Math.max(0, new Date().getMonth() - 5),
      new Date().getMonth() + 1
    );
    const earningsOverview = months.map((month, i) => {
      const monthNum = (new Date().getMonth() - months.length + 1 + i + 1).toString().padStart(2, '0');
      const prefix = `${currentYear}-${monthNum}`;
      const amount = invoicesList
        .filter(inv => (inv.status === 'PAID' || inv.status === 'APPROVED') && inv.createdAt?.startsWith(prefix))
        .reduce((sum, inv) => sum + inv.amount, 0);
      return { month, amount };
    });

    return {
      kpi: {
        activeWorkOrders,
        workOrdersDelta: 0,
        scheduledToday,
        scheduledDelta: 0,
        pendingQuotes,
        pendingQuotesDelta: 0,
        completedThisMonth,
        completedDelta: 0,
        totalEarningsThisMonth: totalEarnings,
        earningsDelta: 0,
        averageRating,
        ratingDelta: 0,
        currency: 'USD',
      },
      jobActivity: {
        period: 'Last 7 days',
        days: jobActivityDays,
      },
      requestOverview: {
        totalRequests: reqTotal,
        new: reqNew,
        assigned: reqAssigned,
        inProgress: reqInProgress,
        onHold: reqOnHold,
        completed: reqCompleted,
      },
      todaySchedule: scheduleItems,
      recentRequests,
      messages: [],
      earningsOverview: {
        year: new Date().getFullYear(),
        months: earningsOverview,
      },
      topCategories: topCategories,
      clientReviews: {
        averageRating,
        reviewCount: reviewsList.length,
        recentReviews: reviewsList.slice(0, 3).map(r => ({
          id: r.id,
          reviewerName: r.reviewerName || 'Client',
          rating: r.rating,
          comment: r.comment,
          date: r.createdAt ? r.createdAt.substring(0, 10) : 'Recent',
        }))
      },
      workOrders: workOrdersList,
      quotes: quotesList,
      invoices: invoicesList,
      tasks: await this.getTasks(userId),
    };
  }
}

export const vendorRepository = new VendorRepository();

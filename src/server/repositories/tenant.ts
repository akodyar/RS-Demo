import { db } from '../../db/index.js';
import { 
  users, 
  leases, 
  leaseTenants, 
  properties, 
  units, 
  rentSchedules, 
  paymentRecords, 
  maintenanceRequests, 
  documents, 
  conversations, 
  messages, 
  notifications,
  leaseRenewals,
  moveOutRequests,
  rentalApplications,
  securityDeposits,
  ownershipRecords,
} from '../../db/schema.js';
import { eq, and, desc, asc, inArray, or, sql } from 'drizzle-orm';
import { 
  TenantDashboardData, 
  TenantPropertySummary, 
  TenantRentDue, 
  TenantSecurityDepositItem,
  TenantFinancialSummary, 
  TenantQuickStats,
  TenantActivityItem,
  TenantMaintenanceItem,
  TenantDocumentItem,
  TenantConversationItem,
  TenantPaymentHistoryItem,
  TenantUpcomingEvent,
  PayRentRequest,
  CreateTenantMaintenanceRequest,
  TenantLeaseRenewalRequest,
  TenantMoveOutRequest,
  TenantAIAssistResponse,
  TenantRentalApplicationItem
} from '../../types/tenant.js';
import { commissionService } from '../services/commission.js';
import { auditService } from '../services/audit.js';
import { financeService } from '../services/finance.js';
import { convertCurrency } from '../../utils/formatters.js';
import { isDocumentVisibleToTenant, TenantLeaseContext } from '../services/storage-service.js';

export class TenantRepository {
  /**
   * Retrieves full aggregated dashboard payload for the authenticated tenant.
   * Guarantees strict server-side scoping so Tenant A can never see Tenant B data.
   */
  async getAuthoritativeDashboard(tenantUserId: string): Promise<TenantDashboardData> {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. Fetch user
    const [userRecord] = await db.select().from(users).where(eq(users.id, tenantUserId)).limit(1);
    const userName = userRecord ? `${userRecord.firstName} ${userRecord.lastName}`.trim() : 'Ahmed';
    const userEmail = userRecord?.email || 'tenant@homehub.iq';

    // 2. Fetch tenant's active/expiring leases
    const tenantLeaseRecords = await db.select({
      lease: leases,
      property: properties,
      unit: units,
      leaseTenant: leaseTenants,
    })
    .from(leaseTenants)
    .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .where(eq(leaseTenants.tenantId, tenantUserId))
    .orderBy(desc(leases.createdAt));

    // Choose the primary active lease if available (including upcoming SIGNED leases), prioritizing isPrimary
    const primaryRecord = 
      tenantLeaseRecords.find(r => r.leaseTenant?.isPrimary && (r.lease.status === 'ACTIVE' || r.lease.status === 'EXPIRING' || r.lease.status === 'SIGNED')) ||
      tenantLeaseRecords.find(r => r.leaseTenant?.isPrimary) ||
      tenantLeaseRecords.find(r => r.lease.status === 'ACTIVE' || r.lease.status === 'EXPIRING' || r.lease.status === 'SIGNED') ||
      tenantLeaseRecords[0];

    let currentProperty: TenantPropertySummary | null = null;
    let myLease: TenantPropertySummary | null = null;

    if (primaryRecord) {
      const prop = primaryRecord.property;
      const unt = primaryRecord.unit;
      const lse = primaryRecord.lease;

      const addressObj = (prop.address as any) || {};
      const street = addressObj.street || 'Address not provided';
      const city = addressObj.city || '';
      const region = addressObj.region || '';

      const startDate = new Date(lse.startDate);
      const endDate = new Date(lse.endDate);
      const diffMonths = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));

      const propPhotos = Array.isArray(addressObj.photos) ? addressObj.photos : (addressObj.imageUrl ? [addressObj.imageUrl] : []);
      const primaryPhoto = addressObj.imageUrl || propPhotos[0] || '';
      const propAmenities = Array.isArray(addressObj.amenities) ? addressObj.amenities : [];

      // Fetch landlord name from ownership records
      let landlordName = 'Property Management';
      const [ownerRecord] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(ownershipRecords)
      .innerJoin(users, eq(ownershipRecords.ownerId, users.id))
      .where(eq(ownershipRecords.propertyId, prop.id))
      .limit(1);

      if (ownerRecord) {
        landlordName = `${ownerRecord.firstName} ${ownerRecord.lastName}`.trim() || 'Property Owner';
      }

      currentProperty = {
        id: prop.id,
        name: prop.name || 'Property',
        unitId: unt?.id,
        unitNumber: unt?.unitNumber ? `Unit ${unt.unitNumber}` : 'Main Unit',
        address: street,
        city,
        region,
        imageUrl: primaryPhoto,
        photos: propPhotos,
        leaseId: lse.id,
        leaseStatus: lse.status || 'ACTIVE',
        leaseStart: lse.startDate,
        leaseEnd: lse.endDate,
        monthlyRent: Number(lse.rentAmount) || 0,
        securityDeposit: Number(lse.depositAmount) || 0,
        durationMonths: diffMonths || 12,
        currency: lse.currency || 'IQD',
        landlordName,
        buildingRules: [],
        amenities: propAmenities,
      };

      myLease = { ...currentProperty };
    }

    // 3. Rent Due
    let rentDue: TenantRentDue | null = null;
    let upcomingSchedules: any[] = [];

    if (primaryRecord) {
      // INVARIANT: Authoritative rent schedules belong to the lease (primaryRecord.lease.id).
      // Both primary tenants and valid secondary co-tenants on the active lease must see the
      // lease's authoritative rent schedules and outstanding balances, while cross-lease access remains blocked.
      upcomingSchedules = await db.select().from(rentSchedules).where(
        eq(rentSchedules.leaseId, primaryRecord.lease.id)
      ).orderBy(asc(rentSchedules.dueDate));

      const nextSchedule = upcomingSchedules.find(s => s.status === 'UPCOMING' || s.status === 'DUE' || s.status === 'OVERDUE' || s.status === 'PARTIALLY_PAID');
      if (nextSchedule) {
        const dueDate = new Date(nextSchedule.dueDate);
        const now = new Date();
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        rentDue = {
          scheduleId: nextSchedule.id,
          leaseId: nextSchedule.leaseId,
          propertyId: nextSchedule.propertyId,
          amount: Math.max(0, Number(nextSchedule.amount) - Number(nextSchedule.paidAmount || 0)),
          dueDate: nextSchedule.dueDate,
          daysRemaining: diffDays,
          status: nextSchedule.status,
          currency: nextSchedule.currency || 'IQD',
          periodStart: nextSchedule.periodStart,
          periodEnd: nextSchedule.periodEnd,
          isOverdue: nextSchedule.status === 'OVERDUE' || diffDays < 0,
        };
      }
    }

    // 4. Financial Summary & Payments
    const tenantPayments = await db.select().from(paymentRecords)
      .where(eq(paymentRecords.payerId, tenantUserId))
      .orderBy(desc(paymentRecords.recordedDate));

    let paidThisMonth = 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    tenantPayments.forEach(p => {
      if (p.status === 'CONFIRMED') {
        const pDate = new Date(p.recordedDate);
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
          paidThisMonth += Number(p.amount);
        }
      }
    });

    let outstanding = 0;
    let overdue = 0;
    upcomingSchedules.forEach(s => {
      const remaining = Math.max(0, Number(s.amount) - Number(s.paidAmount || 0));
      if (s.status === 'OVERDUE') {
        overdue += remaining;
      } else if (s.status === 'DUE' || s.status === 'UPCOMING') {
        outstanding += remaining;
      } else if (s.status === 'PARTIALLY_PAID') {
        const dueDate = new Date(s.dueDate);
        if (dueDate < now) {
          overdue += remaining;
        } else {
          outstanding += remaining;
        }
      }
    });

    const financialSummary: TenantFinancialSummary = {
      paidThisMonth,
      outstanding,
      overdue,
      currency: primaryRecord?.lease?.currency || rentDue?.currency || 'IQD',
      lastPaymentDate: tenantPayments[0]?.recordedDate,
    };

    const paymentHistory: TenantPaymentHistoryItem[] = tenantPayments.map(p => ({
      id: p.id,
      paymentRecordId: p.id,
      period: p.recordedDate ? new Date(p.recordedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Current Month',
      amount: Number(p.amount),
      currency: p.currency || 'IQD',
      paymentDate: p.recordedDate,
      status: p.status || 'CONFIRMED',
      referenceNumber: p.referenceNumber || `#TXN-${p.id.slice(0, 8).toUpperCase()}`,
      receiptNumber: p.receiptNumber || (p.status === 'CONFIRMED' ? `#RCP-${p.id.slice(0, 6).toUpperCase()}` : undefined),
      paymentMethod: p.paymentMethod || 'FIB',
      hasReceipt: p.status === 'CONFIRMED',
    }));

    // 5. Maintenance Requests
    const tenantMaintenance = await db.select().from(maintenanceRequests)
      .where(eq(maintenanceRequests.reporterUserId, tenantUserId))
      .orderBy(desc(maintenanceRequests.createdAt));

    const openMaintenanceCount = tenantMaintenance.filter(m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED').length;

    const maintenanceItems: TenantMaintenanceItem[] = tenantMaintenance.map((m) => ({
      id: m.id,
      referenceNumber: `#MNT-${m.id.split('-')[0].toUpperCase()}`,
      title: m.title,
      category: m.category,
      priority: (m.priority as any) || 'NORMAL',
      status: (m.status as any) || 'REPORTED',
      submittedDate: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      description: m.description,
      propertyName: primaryRecord?.property.name || 'Current Residence',
      unitNumber: primaryRecord?.unit?.unitNumber ? `Apartment ${primaryRecord.unit.unitNumber}` : 'Current Unit',
    }));

    // 6. Conversations & Messages
    const tenantConversations = await db.select().from(conversations)
      .where(or(
        eq(conversations.creatorUserId, tenantUserId),
        sql`${conversations.participantIds} ? ${tenantUserId}`
      ));

    let unreadMessagesCount = 0;
    const conversationItems: TenantConversationItem[] = [];

    for (const c of tenantConversations) {
      // Fetch the last message
      const [lastMsg] = await db.select().from(messages)
        .where(eq(messages.conversationId, c.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      // Count unread
      const unreadMsgs = await db.select().from(messages)
        .where(and(
          eq(messages.conversationId, c.id),
          sql`NOT (${messages.readByUserIds} ? ${tenantUserId})`
        ));
      
      const unreadCount = unreadMsgs.length;
      unreadMessagesCount += unreadCount;

      conversationItems.push({
        id: c.id,
        title: c.title,
        participantName: c.title.includes('Owner') ? 'Property Owner' : c.title.includes('Maintenance') ? 'Maintenance Team' : 'Property Management',
        participantRole: c.title.includes('Owner') ? 'PROPERTY_OWNER' : c.title.includes('Maintenance') ? 'MAINTENANCE_TEAM' : 'PROPERTY_MANAGEMENT',
        lastMessage: lastMsg ? lastMsg.content : 'No messages yet.',
        timestamp: (lastMsg?.createdAt || c.updatedAt || new Date()).toISOString(),
        unreadCount,
        avatarType: c.title.includes('Owner') ? 'owner' : c.title.includes('Maintenance') ? 'maintenance' : 'management',
      });
    }

    // 7. Security Deposit Query
    // INVARIANT: The security deposit belongs to the authoritative lease.
    // Authorized co-tenants on the active lease view the lease deposit status via verified lease membership.
    let depositRecord: any = null;
    if (primaryRecord) {
      const [dep] = await db.select()
        .from(securityDeposits)
        .where(eq(securityDeposits.leaseId, primaryRecord.lease.id))
        .limit(1);
      depositRecord = dep;
    }
    if (!depositRecord) {
      const [dep] = await db.select()
        .from(securityDeposits)
        .where(eq(securityDeposits.tenantId, tenantUserId))
        .limit(1);
      depositRecord = dep;
    }

    const securityDeposit: TenantSecurityDepositItem | null = depositRecord ? {
      id: depositRecord.id,
      leaseId: depositRecord.leaseId,
      propertyId: depositRecord.propertyId,
      propertyName: primaryRecord?.property.name || 'Current Residence',
      requiredAmount: Number(depositRecord.requiredAmount || 0),
      recordedAmount: Number(depositRecord.recordedAmount || 0),
      releasedAmount: Number(depositRecord.releasedAmount || 0),
      currency: depositRecord.currency || 'IQD',
      status: depositRecord.status || 'HELD',
      createdAt: depositRecord.createdAt ? new Date(depositRecord.createdAt).toISOString() : undefined,
    } : null;

    // 8. Documents (Filtered strictly by authoritative tenant visibility policy)
    let documentItems: TenantDocumentItem[] = [];
    const eligibleRecords = tenantLeaseRecords.filter(r => 
      r.lease.status === 'ACTIVE' || r.lease.status === 'EXPIRING' || r.lease.status === 'SIGNED'
    );

    if (eligibleRecords.length > 0) {
      const seenDocIds = new Set<string>();

      for (const rec of eligibleRecords) {
        const propDocs = await db.select().from(documents).where(eq(documents.propertyId, rec.property.id));
        const leaseContext: TenantLeaseContext = {
          leaseId: rec.lease.id,
          unitId: rec.unit?.id || null,
          propertyId: rec.property.id,
        };

        const visibleDocs = propDocs.filter(d => isDocumentVisibleToTenant(d, tenantUserId, leaseContext));

        for (const d of visibleDocs) {
          if (seenDocIds.has(d.id)) continue;
          seenDocIds.add(d.id);

          const docTypeUpper = (d.documentType || '').toUpperCase().trim();
          let cat: 'LEASE' | 'INSPECTION' | 'RULES' | 'RECEIPT' = 'RULES';
          if (docTypeUpper.includes('LEASE')) {
            cat = 'LEASE';
          } else if (docTypeUpper.includes('INSPECTION')) {
            cat = 'INSPECTION';
          } else if (docTypeUpper.includes('RECEIPT')) {
            cat = 'RECEIPT';
          } else if (
            docTypeUpper === 'RULES' ||
            docTypeUpper === 'BUILDING_RULES' ||
            docTypeUpper === 'COMMUNITY_RULES' ||
            docTypeUpper === 'COMMUNITY_GUIDELINES' ||
            docTypeUpper === 'HOUSE_RULES' ||
            docTypeUpper === 'PROPERTY_RULES'
          ) {
            cat = 'RULES';
          } else {
            cat = 'LEASE';
          }

          documentItems.push({
            id: d.id,
            title: d.title,
            documentType: d.documentType,
            fileType: (d.metadata as any)?.fileType || 'UNKNOWN',
            sizeFormatted: (d.metadata as any)?.sizeFormatted || 'Unknown Size',
            date: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
            fileUrl: d.fileUrl || undefined,
            category: cat,
          });
        }
      }
    }

    // 8. Upcoming Events
    const upcomingEvents: TenantUpcomingEvent[] = [];
    if (rentDue) {
      upcomingEvents.push({
        id: 'evt-rent',
        title: 'Monthly Rent Payment Due',
        date: rentDue.dueDate,
        type: 'RENT_DUE',
        description: `Rent payment of ${rentDue.amount.toLocaleString()} ${rentDue.currency} is scheduled.`,
      });
    }
    if (currentProperty && currentProperty.leaseEnd) {
      upcomingEvents.push({
        id: 'evt-lease-end',
        title: 'Lease Expiration / Renewal Window',
        date: currentProperty.leaseEnd,
        type: 'LEASE_RENEWAL',
        description: 'Review lease renewal options with property owner.',
      });
    }

    // 9. Recent Activity
    const recentActivity: TenantActivityItem[] = [];
    if (maintenanceItems.length > 0) {
      const m = maintenanceItems[0];
      recentActivity.push({
        id: `act-${m.id}`,
        type: 'MAINTENANCE',
        title: 'Maintenance Request Submitted',
        subtitle: m.title,
        timestamp: m.submittedDate,
        status: m.status,
        referenceNumber: m.referenceNumber,
        entityId: m.id,
      });
    }
    if (paymentHistory.length > 0) {
      const p = paymentHistory[0];
      recentActivity.push({
        id: `act-${p.id}`,
        type: 'PAYMENT',
        title: `Rent Payment ${p.status === 'CONFIRMED' ? 'Confirmed' : 'Recorded'}`,
        subtitle: `${p.amount.toLocaleString()} ${p.currency} - ${p.period}`,
        timestamp: p.paymentDate,
        status: p.status,
        referenceNumber: p.referenceNumber,
        entityId: p.id,
      });
    }

    // 10. Rental Applications
    const rawApplications = await db.select({
      id: rentalApplications.id,
      status: rentalApplications.status,
      submittedAt: rentalApplications.createdAt,
      propertyName: properties.name,
      propertyAddress: properties.address,
    })
    .from(rentalApplications)
    .leftJoin(properties, eq(rentalApplications.propertyId, properties.id))
    .where(eq(rentalApplications.applicantUserId, tenantUserId))
    .orderBy(desc(rentalApplications.createdAt));

    const myApplications: TenantRentalApplicationItem[] = rawApplications.map(app => {
      const addr = (app.propertyAddress as any) || {};
      const addrStr = typeof addr === 'string' 
        ? addr 
        : (addr.street ? `${addr.street}${addr.city ? ', ' + addr.city : ''}` : (addr.city || 'Address not provided'));
      return {
        id: app.id,
        status: app.status || 'PENDING',
        submittedAt: app.submittedAt ? (app.submittedAt instanceof Date ? app.submittedAt.toISOString() : String(app.submittedAt)) : null,
        propertyName: app.propertyName || null,
        propertyAddress: addrStr,
      };
    });

    return {
      user: {
        id: tenantUserId,
        name: userName,
        email: userEmail,
        location: currentProperty ? `${currentProperty.city}, ${currentProperty.region}` : undefined,
      },
      currentProperty,
      rentDue,
      securityDeposit,
      financialSummary,
      quickStats: {
        openMaintenanceCount,
        unreadMessagesCount,
        upcomingEventsCount: upcomingEvents.length,
      },
      recentActivity,
      myLease,
      paymentHistory,
      maintenanceRequests: maintenanceItems,
      documents: documentItems,
      conversations: conversationItems,
      upcomingEvents,
      rentalApplications: myApplications,
    };
  }

  /**
   * Records and confirms a tenant rent payment.
   * Directly calculates and triggers platform fee posting.
   */
  async recordRentPayment(tenantUserId: string, payload: PayRentRequest) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    if (!payload.amount || payload.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // 1. Authorize tenant occupies property/lease
    const userLease = await db.select()
      .from(leaseTenants)
      .where(and(
        eq(leaseTenants.tenantId, tenantUserId),
        eq(leaseTenants.leaseId, payload.leaseId)
      )).limit(1);

    if (userLease.length === 0) {
      throw new Error('UNAUTHORIZED_TENANT_LEASE_ACCESS');
    }

    const receiptNum = `RCP-${Date.now().toString().slice(-6)}`;
    const refNum = payload.referenceNumber || `TXN-${Date.now().toString().slice(-6)}`;

    // 2. Insert Payment Record
    return await db.transaction(async (tx) => {
      let paymentCurrency = payload.currency;

      // Validate schedule if provided (do not mutate paidAmount or status until payment is confirmed)
      if (payload.scheduleId) {
        const [schedule] = await tx.select().from(rentSchedules)
          .where(and(
            eq(rentSchedules.id, payload.scheduleId),
            eq(rentSchedules.leaseId, payload.leaseId) // Ensure schedule belongs to authorized lease
          ))
          .limit(1)
          .for('update');

        if (!schedule) {
          throw new Error('UNAUTHORIZED_SCHEDULE_ACCESS');
        }

        const scheduleCurrency = schedule.currency || 'IQD';
        const pCurrency = (paymentCurrency || scheduleCurrency).toUpperCase();

        if (pCurrency !== scheduleCurrency) {
          if (!payload.allowConversion) {
            throw new Error(`CURRENCY_MISMATCH: Payment currency (${paymentCurrency}) does not match schedule currency (${scheduleCurrency}). Cross-currency payments are not supported.`);
          }
          if (!['USD', 'IQD'].includes(pCurrency) || !['USD', 'IQD'].includes(scheduleCurrency)) {
            throw new Error(`UNSUPPORTED_CURRENCY: Cross-currency payment between ${pCurrency} and ${scheduleCurrency} is not supported.`);
          }
        }
        paymentCurrency = pCurrency;

        const exchangeRate = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD', 1310);
        const paymentInScheduleCurrency = convertCurrency(payload.amount, paymentCurrency, scheduleCurrency, exchangeRate);

        // Sum active pending RECORDED claims for this schedule converted to schedule currency
        const pendingPayments = await tx.select({ 
          amount: paymentRecords.amount,
          currency: paymentRecords.currency,
        })
          .from(paymentRecords)
          .where(and(
            eq(paymentRecords.rentScheduleId, schedule.id),
            eq(paymentRecords.status, 'RECORDED')
          ));

        const pendingRecordedAmount = pendingPayments.reduce((sum, p) => {
          const recCur = (p.currency || scheduleCurrency).toUpperCase();
          const amtInSched = convertCurrency(Number(p.amount || 0), recCur, scheduleCurrency, exchangeRate);
          return sum + amtInSched;
        }, 0);

        const currentConfirmedPaid = Number(schedule.paidAmount || 0);
        const totalAmount = Number(schedule.amount);
        const totalCommitted = currentConfirmedPaid + pendingRecordedAmount + paymentInScheduleCurrency;

        if (totalCommitted > totalAmount) {
          throw new Error('Payment amount exceeds remaining rent due');
        }

        // INVARIANT: An unconfirmed (RECORDED) payment must NOT alter rent_schedules.paidAmount
        // or transition schedule status to PARTIALLY_PAID or PAID.
        // The schedule balance is updated exclusively upon authorized payment confirmation.
      } else {
        const [lease] = await tx.select().from(leases).where(eq(leases.id, payload.leaseId)).limit(1);
        const leaseCurrency = lease?.currency || 'IQD';
        const pCurrency = (paymentCurrency || leaseCurrency).toUpperCase();
        if (pCurrency !== leaseCurrency) {
          if (!payload.allowConversion) {
            throw new Error(`CURRENCY_MISMATCH: Payment currency (${paymentCurrency}) does not match lease currency (${leaseCurrency}). Cross-currency payments are not supported.`);
          }
        }
        paymentCurrency = pCurrency;
      }

      const [payment] = await tx.insert(paymentRecords).values({
        propertyId: payload.propertyId,
        leaseId: payload.leaseId,
        rentScheduleId: payload.scheduleId,
        payerId: tenantUserId,
        amount: payload.amount.toString(),
        currency: paymentCurrency || 'IQD',
        paymentMethod: payload.paymentMethod || 'FIB',
        referenceNumber: refNum,
        receiptNumber: receiptNum,
        status: 'RECORDED', // Changed from CONFIRMED to require two-step confirmation
        recordedDate: new Date().toISOString(),
      }).returning();

      // 4. Audit Log
      await auditService.logAction({
        actorUserId: tenantUserId,
        actorRole: 'TENANT',
        action: 'PAYMENT_RECORDED',
        resourceType: 'PaymentRecord',
        resourceId: payment.id,
        changes: {
          amount: payload.amount,
          currency: payload.currency,
          receiptNumber: receiptNum,
          status: 'RECORDED'
        },
        tx,
      });

      return {
        payment,
        commission: { calculation: { commissionAmount: 0 }, alreadyPosted: true } // Commission posted on confirm
      };
    });
  }

  /**
   * Submits a tenant maintenance request with strict property authorization.
   */
  async createMaintenanceRequest(tenantUserId: string, payload: CreateTenantMaintenanceRequest) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // Verify tenant occupies property
    const authorized = await db.select()
      .from(leases)
      .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
      .where(and(
        eq(leaseTenants.tenantId, tenantUserId),
        eq(leases.propertyId, payload.propertyId)
      )).limit(1);

    if (authorized.length === 0) {
      throw new Error('UNAUTHORIZED_PROPERTY_MAINTENANCE_ACCESS');
    }

    const [request] = await db.insert(maintenanceRequests).values({
      propertyId: payload.propertyId,
      unitId: payload.unitId,
      reporterUserId: tenantUserId,
      category: payload.category,
      priority: payload.priority,
      status: 'REPORTED',
      title: payload.title,
      description: payload.description,
    }).returning();

    await auditService.logAction({
      actorUserId: tenantUserId,
      actorRole: 'TENANT',
      action: 'MAINTENANCE_REQUEST_CREATED',
      resourceType: 'MaintenanceRequest',
      resourceId: request.id,
      changes: { title: payload.title, category: payload.category, priority: payload.priority },
    });

    return request;
  }

  /**
   * Requests a lease renewal.
   */
  async requestLeaseRenewal(tenantUserId: string, payload: TenantLeaseRenewalRequest) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const authorized = await db.select().from(leaseTenants).where(and(
      eq(leaseTenants.tenantId, tenantUserId),
      eq(leaseTenants.leaseId, payload.leaseId)
    )).limit(1);

    if (authorized.length === 0) {
      throw new Error('UNAUTHORIZED_LEASE_RENEWAL_ACCESS');
    }

    const [targetLease] = await db.select().from(leases).where(eq(leases.id, payload.leaseId)).limit(1);
    if (!targetLease) {
      throw new Error('VALIDATION_ERROR: Target lease not found.');
    }

    if (targetLease.status !== 'ACTIVE') {
      throw new Error(`VALIDATION_ERROR: Cannot request renewal for a lease with status ${targetLease.status}. Only ACTIVE leases may be renewed.`);
    }

    const proposedStartDate = payload.proposedStartDate || targetLease.endDate;
    const startDateObj = new Date(proposedStartDate);
    const endDateObj = new Date(payload.proposedEndDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error('VALIDATION_ERROR: Invalid renewal date format.');
    }

    if (endDateObj <= startDateObj) {
      throw new Error('VALIDATION_ERROR: Proposed end date must be strictly after proposed start date.');
    }

    // Duplicate pending renewal prevention
    const existingPending = await db.select().from(leaseRenewals).where(and(
      eq(leaseRenewals.leaseId, payload.leaseId),
      or(
        eq(leaseRenewals.status, 'REQUESTED'),
        eq(leaseRenewals.status, 'UNDER_REVIEW')
      )
    )).limit(1);

    if (existingPending.length > 0) {
      throw new Error('DUPLICATE_RENEWAL_REQUEST: A lease renewal request is already pending review for this lease.');
    }

    const targetCurrency = targetLease?.currency || 'IQD';

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: payload.leaseId,
      propertyId: payload.propertyId || targetLease.propertyId,
      tenantId: tenantUserId,
      proposedStartDate: proposedStartDate,
      proposedEndDate: payload.proposedEndDate,
      proposedRentAmount: payload.proposedRentAmount ? payload.proposedRentAmount.toString() : null,
      currency: targetCurrency,
      status: 'REQUESTED',
      tenantNotes: payload.tenantNotes,
    }).returning();

    await auditService.logAction({
      actorUserId: tenantUserId,
      actorRole: 'TENANT',
      action: 'RENEWAL_REQUESTED',
      resourceType: 'LeaseRenewal',
      resourceId: renewal.id,
      changes: { leaseId: payload.leaseId, proposedStartDate: payload.proposedStartDate },
    });

    return renewal;
  }

  /**
   * Submits a move-out request.
   */
  async requestMoveOut(tenantUserId: string, payload: TenantMoveOutRequest) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const authorized = await db.select().from(leaseTenants).where(and(
      eq(leaseTenants.tenantId, tenantUserId),
      eq(leaseTenants.leaseId, payload.leaseId)
    )).limit(1);

    if (authorized.length === 0) {
      throw new Error('UNAUTHORIZED_MOVE_OUT_ACCESS');
    }

    const [moveOut] = await db.insert(moveOutRequests).values({
      leaseId: payload.leaseId,
      propertyId: payload.propertyId,
      tenantId: tenantUserId,
      requestedMoveOutDate: payload.requestedMoveOutDate,
      reason: payload.reason,
      forwardingAddress: payload.forwardingAddress,
      status: 'PENDING_REVIEW',
    }).returning();

    await auditService.logAction({
      actorUserId: tenantUserId,
      actorRole: 'TENANT',
      action: 'MOVE_OUT_REQUESTED',
      resourceType: 'MoveOutRequest',
      resourceId: moveOut.id,
      changes: { requestedDate: payload.requestedMoveOutDate },
    });

    return moveOut;
  }

  /**
   * Tenant AI Assistant.
   * Scoped strictly to the authenticated tenant's lease and property context.
   */
  async getTenantAIAssist(tenantUserId: string, query: string): Promise<TenantAIAssistResponse> {
    const dashboard = await this.getAuthoritativeDashboard(tenantUserId);
    const q = query.toLowerCase();

    if (q.includes('rent') || q.includes('pay') || q.includes('amount') || q.includes('due')) {
      if (dashboard.rentDue) {
        return {
          answer: `Your next rent payment of ${dashboard.rentDue.amount.toLocaleString()} ${dashboard.rentDue.currency} is due on ${dashboard.rentDue.dueDate} (${dashboard.rentDue.daysRemaining} days remaining). You can pay directly using FastPay, FIB QR, or ZainCash.`,
          type: 'CALCULATION',
          suggestedActions: ['Pay Rent Now', 'View Payment Schedule', 'Download Previous Receipts'],
          disclaimer: 'Calculated from your official lease rent schedule. HomeHub earns a platform fee on confirmed collections.',
          requiresConfirmation: q.includes('pay') ? true : false,
        };
      }
      return {
        answer: 'You have no outstanding rent payments due at this moment.',
        type: 'FACT',
        suggestedActions: ['View Payment History'],
        disclaimer: 'Authoritative financial status derived from HomeHub ledger.',
        requiresConfirmation: q.includes('pay') ? true : false,
      };
    }

    if (q.includes('maintenance') || q.includes('repair') || q.includes('leak') || q.includes('ac')) {
      return {
        answer: 'You have reported active maintenance requests. Urgent issues (water leaks, electrical risks) receive prioritized technician response within 24 hours under your lease agreement.',
        type: 'RECOMMENDATION',
        suggestedActions: ['Submit New Maintenance Request', 'View Maintenance Status'],
        disclaimer: 'Emergency safety issues should be reported immediately via the Report Issue button.',
      };
    }

    if (q.includes('renew') || q.includes('extend') || q.includes('lease') || q.includes('expire')) {
      const lease = dashboard.myLease;
      return {
        answer: lease 
          ? `Your active lease for ${lease.name} (${lease.unitNumber}) runs until ${lease.leaseEnd}. Lease renewals require mutual agreement between tenant and landlord/management.`
          : 'You currently have no active lease record eligible for renewal.',
        type: 'FACT',
        suggestedActions: ['Start Lease Renewal Request', 'Review Current Lease Terms'],
        disclaimer: 'AI recommendations cannot automatically execute or alter legal lease contracts.',
      };
    }

    return {
      answer: `Hello! I am your HomeHub Rental Assistant. I can help you understand your lease terms, review your rent schedule, check maintenance status, or prepare a renewal or move-out request for your apartment at ${dashboard.currentProperty?.name || 'HomeHub'}.`,
      type: 'FACT',
      suggestedActions: ['When is my rent due?', 'How do I report a maintenance problem?', 'What are my building rules?'],
      disclaimer: 'Advisory guidance based strictly on your authenticated tenant profile.',
    };
  }

  /**
   * Authoritative retrieval of tenant security deposits.
   */
  async getTenantDeposits(tenantUserId: string): Promise<TenantSecurityDepositItem[]> {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // Get all authorized lease IDs where the user is an active or assigned tenant
    const userLeases = await db.select({ leaseId: leaseTenants.leaseId })
      .from(leaseTenants)
      .where(eq(leaseTenants.tenantId, tenantUserId));

    const userLeaseIds = userLeases.map(l => l.leaseId);

    const conditions = [eq(securityDeposits.tenantId, tenantUserId)];
    if (userLeaseIds.length > 0) {
      conditions.push(inArray(securityDeposits.leaseId, userLeaseIds));
    }

    const records = await db.select({
      deposit: securityDeposits,
      property: properties,
    })
    .from(securityDeposits)
    .innerJoin(properties, eq(securityDeposits.propertyId, properties.id))
    .where(or(...conditions));

    return records.map(r => ({
      id: r.deposit.id,
      leaseId: r.deposit.leaseId,
      propertyId: r.deposit.propertyId,
      propertyName: r.property.name,
      requiredAmount: Number(r.deposit.requiredAmount || 0),
      recordedAmount: Number(r.deposit.recordedAmount || 0),
      releasedAmount: Number(r.deposit.releasedAmount || 0),
      currency: r.deposit.currency || 'IQD',
      status: r.deposit.status || 'HELD',
      createdAt: r.deposit.createdAt ? new Date(r.deposit.createdAt).toISOString() : undefined,
    }));
  }

  /**
   * Accepts an offered lease contract.
   */
  async acceptLeaseOffer(tenantUserId: string, leaseId: string) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const authorized = await db.select().from(leaseTenants).where(and(
      eq(leaseTenants.tenantId, tenantUserId),
      eq(leaseTenants.leaseId, leaseId)
    )).limit(1);

    if (authorized.length === 0) {
      throw new Error('UNAUTHORIZED_TENANT_LEASE_ACCESS');
    }

    const [targetLease] = await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
    if (!targetLease) {
      throw new Error('Lease not found');
    }

    if (targetLease.status === 'PENDING_APPROVAL') {
      throw new Error('FORBIDDEN_LEASE_PENDING_APPROVAL: Lease is awaiting owner approval and cannot be accepted or activated by tenant.');
    }

    if (targetLease.status !== 'PENDING_SIGNATURE') {
      throw new Error(`VALIDATION_ERROR: Cannot accept lease with status ${targetLease.status}. Lease must be in PENDING_SIGNATURE status.`);
    }

    const { leaseRepository } = await import('./leases.js');
    const updatedLease = await leaseRepository.activateLease(leaseId);

    await auditService.logAction({
      actorUserId: tenantUserId,
      actorRole: 'TENANT',
      action: 'LEASE_ACCEPTED',
      resourceType: 'Lease',
      resourceId: leaseId,
      changes: { status: 'ACTIVE' },
    });

    return updatedLease;
  }

  /**
   * Retrieves the current active or upcoming lease for a tenant.
   */
  async getActiveLease(tenantUserId: string): Promise<{ id: string; propertyId: string; unitId?: string | null } | null> {
    const records = await db.select({
      id: leases.id,
      propertyId: leases.propertyId,
      unitId: leases.unitId,
    })
    .from(leaseTenants)
    .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
    .where(and(
      eq(leaseTenants.tenantId, tenantUserId),
      inArray(leases.status, ['ACTIVE', 'EXPIRING', 'SIGNED'])
    ))
    .orderBy(desc(leases.createdAt))
    .limit(1);

    return records[0] || null;
  }

  /**
   * Retrieves prospective/onboarding status for a tenant without requiring an active lease.
   * Includes submitted rental applications and pending lease offers awaiting signature or approval.
   */
  async getTenantOnboardingData(tenantUserId: string): Promise<{
    applications: TenantRentalApplicationItem[];
    pendingLeases: Array<{
      id: string;
      propertyId: string;
      propertyName: string;
      propertyAddress: string;
      unitNumber: string;
      status: string;
      startDate: string;
      endDate: string;
      monthlyRent: number;
      depositAmount: number;
      currency: string;
      landlordName: string;
    }>;
  }> {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. Fetch rental applications
    const rawApplications = await db.select({
      id: rentalApplications.id,
      status: rentalApplications.status,
      submittedAt: rentalApplications.createdAt,
      propertyName: properties.name,
      propertyAddress: properties.address,
    })
    .from(rentalApplications)
    .leftJoin(properties, eq(rentalApplications.propertyId, properties.id))
    .where(eq(rentalApplications.applicantUserId, tenantUserId))
    .orderBy(desc(rentalApplications.createdAt));

    const applications: TenantRentalApplicationItem[] = rawApplications.map(app => {
      const addr = (app.propertyAddress as any) || {};
      const addrStr = typeof addr === 'string' 
        ? addr 
        : (addr.street ? `${addr.street}${addr.city ? ', ' + addr.city : ''}` : (addr.city || 'Address not provided'));
      return {
        id: app.id,
        status: app.status || 'PENDING',
        submittedAt: app.submittedAt ? (app.submittedAt instanceof Date ? app.submittedAt.toISOString() : String(app.submittedAt)) : null,
        propertyName: app.propertyName || null,
        propertyAddress: addrStr,
      };
    });

    // 2. Fetch pending lease offers (e.g. PENDING_SIGNATURE, PENDING_APPROVAL, DRAFT)
    const rawLeases = await db.select({
      lease: leases,
      property: properties,
      unit: units,
    })
    .from(leaseTenants)
    .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .where(and(
      eq(leaseTenants.tenantId, tenantUserId),
      inArray(leases.status, ['PENDING_SIGNATURE', 'PENDING_APPROVAL', 'DRAFT'])
    ))
    .orderBy(desc(leases.createdAt));

    const pendingLeases = [];
    for (const row of rawLeases) {
      const l = row.lease;
      const p = row.property;
      const u = row.unit;
      const addr = (p.address as any) || {};
      const addrStr = typeof addr === 'string' 
        ? addr 
        : (addr.street ? `${addr.street}${addr.city ? ', ' + addr.city : ''}` : (addr.city || 'Address not provided'));

      let landlordName = 'Property Management';
      const [ownerRecord] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(ownershipRecords)
      .innerJoin(users, eq(ownershipRecords.ownerId, users.id))
      .where(eq(ownershipRecords.propertyId, p.id))
      .limit(1);

      if (ownerRecord) {
        landlordName = `${ownerRecord.firstName} ${ownerRecord.lastName}`.trim() || 'Property Owner';
      }

      pendingLeases.push({
        id: l.id,
        propertyId: p.id,
        propertyName: p.name || 'Property',
        propertyAddress: addrStr,
        unitNumber: u?.unitNumber ? `Unit ${u.unitNumber}` : 'Main Residence',
        status: l.status,
        startDate: l.startDate,
        endDate: l.endDate,
        monthlyRent: Number(l.rentAmount) || 0,
        depositAmount: Number(l.depositAmount) || 0,
        currency: l.currency || 'IQD',
        landlordName,
      });
    }

    return { applications, pendingLeases };
  }
}

export const tenantRepository = new TenantRepository();

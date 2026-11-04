import { db } from '../../db/index.js';
import { 
  properties, 
  units, 
  ownershipRecords, 
  managementAgreements, 
  leases, 
  leaseTenants, 
  rentSchedules, 
  paymentRecords, 
  maintenanceInvoices, 
  maintenanceRequests,
  propertyValuations, 
  portfolioSnapshots, 
  exchangeRates, 
  salesContracts, 
  salesTransactions,
  listings,
  users
} from '../../db/schema.js';
import { eq, and, inArray, desc, sql, gte, lte, or } from 'drizzle-orm';
import { UserRole } from '../../types/index.js';

export interface ScopedAccess {
  isPlatformAdmin: boolean;
  isOwner: boolean;
  isCompany: boolean;
  propertyIds: string[];
}

export class AnalyticsRepository {
  /**
   * Authoritative server-side resolution of authorized properties for the caller.
   * Prevents IDOR and cross-entity data leakage.
   */
  async resolveUserPropertyScope(
    user: { id: string; organizationId?: string; roles: string[] },
    specificPropertyId?: string
  ): Promise<ScopedAccess> {
    const userRoles = user.roles || [];
    const isPlatformAdmin = userRoles.some(r => 
      ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', UserRole.PLATFORM_ADMIN].includes(r as any)
    );
    const isCompany = userRoles.some(r => 
      [UserRole.COMPANY, 'COMPANY_ADMIN', 'COMPANY_MEMBER', 'ACCOUNTANT'].includes(r as any)
    );
    const isOwner = userRoles.some(r => 
      [UserRole.PROPERTY_OWNER, 'PROPERTY_OWNER', 'OWNER'].includes(r as any)
    );

    let accessiblePropIds: string[] = [];

    if (isPlatformAdmin) {
      if (specificPropertyId) {
        const [prop] = await db.select({ id: properties.id }).from(properties).where(eq(properties.id, specificPropertyId)).limit(1);
        accessiblePropIds = prop ? [prop.id] : [];
      } else {
        const allProps = await db.select({ id: properties.id }).from(properties);
        accessiblePropIds = allProps.map(p => p.id);
      }
      return { isPlatformAdmin: true, isOwner: false, isCompany: false, propertyIds: accessiblePropIds };
    }

    if (isOwner) {
      const verifiedOwnership = await db.select({
        propertyId: ownershipRecords.propertyId,
      })
      .from(ownershipRecords)
      .where(and(
        eq(ownershipRecords.ownerId, user.id),
        eq(ownershipRecords.status, 'VERIFIED')
      ));

      accessiblePropIds = verifiedOwnership.map(o => o.propertyId);

      if (specificPropertyId) {
        accessiblePropIds = accessiblePropIds.includes(specificPropertyId) ? [specificPropertyId] : [];
      }

      return { isPlatformAdmin: false, isOwner: true, isCompany: false, propertyIds: accessiblePropIds };
    }

    if (isCompany && user.organizationId) {
      const activeAgreements = await db.select({
        propertyId: managementAgreements.propertyId,
      })
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, user.organizationId),
        eq(managementAgreements.status, 'ACTIVE')
      ));

      accessiblePropIds = activeAgreements.map(a => a.propertyId);

      if (specificPropertyId) {
        accessiblePropIds = accessiblePropIds.includes(specificPropertyId) ? [specificPropertyId] : [];
      }

      return { isPlatformAdmin: false, isOwner: false, isCompany: true, propertyIds: accessiblePropIds };
    }

    // Unauthorized roles (Tenant, Buyer, Vendor, unpermitted Agent)
    return { isPlatformAdmin: false, isOwner: false, isCompany: false, propertyIds: [] };
  }

  /**
   * Get basic properties metadata for authorized propertyIds
   */
  async getScopedProperties(propertyIds: string[]) {
    if (propertyIds.length === 0) return [];
    return await db.select().from(properties).where(inArray(properties.id, propertyIds));
  }

  /**
   * Get units for authorized propertyIds
   */
  async getScopedUnits(propertyIds: string[]) {
    if (propertyIds.length === 0) return [];
    return await db.select().from(units).where(inArray(units.propertyId, propertyIds));
  }

  /**
   * Get active leases for authorized propertyIds
   */
  async getScopedActiveLeases(propertyIds: string[]) {
    if (propertyIds.length === 0) return [];
    return await db.select().from(leases).where(and(
      inArray(leases.propertyId, propertyIds),
      eq(leases.status, 'ACTIVE')
    ));
  }

  /**
   * Get all leases (including expired/terminated) for authorized propertyIds
   */
  async getAllScopedLeases(propertyIds: string[]) {
    if (propertyIds.length === 0) return [];
    return await db.select().from(leases).where(inArray(leases.propertyId, propertyIds));
  }

  /**
   * Get rent schedules for authorized propertyIds, optionally filtered by due date window
   */
  async getScopedRentSchedules(propertyIds: string[], startDate?: string, endDate?: string) {
    if (propertyIds.length === 0) return [];
    const conditions = [inArray(rentSchedules.propertyId, propertyIds)];
    if (startDate) conditions.push(gte(rentSchedules.dueDate, startDate));
    if (endDate) conditions.push(lte(rentSchedules.dueDate, endDate));

    return await db.select().from(rentSchedules).where(and(...conditions)).orderBy(desc(rentSchedules.dueDate));
  }

  /**
   * Get confirmed payments for authorized propertyIds
   */
  async getScopedPayments(propertyIds: string[], startDate?: string, endDate?: string) {
    if (propertyIds.length === 0) return [];
    const conditions = [
      inArray(paymentRecords.propertyId, propertyIds),
      eq(paymentRecords.status, 'CONFIRMED')
    ];
    if (startDate) conditions.push(gte(paymentRecords.recordedDate, startDate));
    if (endDate) conditions.push(lte(paymentRecords.recordedDate, endDate));

    return await db.select().from(paymentRecords).where(and(...conditions)).orderBy(desc(paymentRecords.recordedDate));
  }

  /**
   * Get maintenance invoices for authorized propertyIds
   */
  async getScopedMaintenanceInvoices(propertyIds: string[], startDate?: string, endDate?: string) {
    if (propertyIds.length === 0) return [];
    const conditions = [
      inArray(maintenanceInvoices.propertyId, propertyIds),
      inArray(maintenanceInvoices.status, ['APPROVED', 'PAID'])
    ];
    if (startDate) conditions.push(gte(maintenanceInvoices.dueDate, startDate));
    if (endDate) conditions.push(lte(maintenanceInvoices.dueDate, endDate));

    return await db.select().from(maintenanceInvoices).where(and(...conditions));
  }

  /**
   * Get latest FINAL valuation for each authorized property
   */
  async getLatestValuations(propertyIds: string[]) {
    if (propertyIds.length === 0) return new Map<string, typeof propertyValuations.$inferSelect>();
    
    const valuations = await db.select()
      .from(propertyValuations)
      .where(and(
        inArray(propertyValuations.propertyId, propertyIds),
        eq(propertyValuations.status, 'FINAL')
      ))
      .orderBy(desc(propertyValuations.valuationDate), desc(propertyValuations.createdAt));

    const map = new Map<string, typeof propertyValuations.$inferSelect>();
    for (const v of valuations) {
      if (!map.has(v.propertyId)) {
        map.set(v.propertyId, v);
      }
    }
    return map;
  }

  /**
   * Get valuation history for a specific property
   */
  async getValuationHistory(propertyId: string) {
    return await db.select()
      .from(propertyValuations)
      .where(eq(propertyValuations.propertyId, propertyId))
      .orderBy(desc(propertyValuations.valuationDate), desc(propertyValuations.createdAt));
  }

  /**
   * Create a new valuation record
   */
  async insertValuation(data: typeof propertyValuations.$inferInsert) {
    const [inserted] = await db.insert(propertyValuations).values(data).returning();
    return inserted;
  }

  /**
   * Mark an existing valuation as SUPERSEDED
   */
  async supersedeValuation(valuationId: string) {
    const [updated] = await db.update(propertyValuations)
      .set({ status: 'SUPERSEDED', updatedAt: new Date() })
      .where(eq(propertyValuations.id, valuationId))
      .returning();
    return updated;
  }

  /**
   * Fetch exchange rates for currency normalization
   */
  async getExchangeRates() {
    return await db.select().from(exchangeRates).orderBy(desc(exchangeRates.date));
  }

  /**
   * Insert a calculated portfolio snapshot
   */
  async insertPortfolioSnapshot(data: typeof portfolioSnapshots.$inferInsert) {
    const [inserted] = await db.insert(portfolioSnapshots).values(data).returning();
    return inserted;
  }

  /**
   * Query historical portfolio snapshots for an authorized owner or company
   */
  async getPortfolioSnapshots(ownerId?: string, companyId?: string, startDate?: string, endDate?: string) {
    const conditions = [];
    if (ownerId) conditions.push(eq(portfolioSnapshots.ownerId, ownerId));
    if (companyId) conditions.push(eq(portfolioSnapshots.companyId, companyId));
    if (startDate) conditions.push(gte(portfolioSnapshots.snapshotDate, startDate));
    if (endDate) conditions.push(lte(portfolioSnapshots.snapshotDate, endDate));

    if (conditions.length === 0) return [];

    return await db.select()
      .from(portfolioSnapshots)
      .where(and(...conditions))
      .orderBy(desc(portfolioSnapshots.snapshotDate));
  }

  /**
   * Internal HomeHub market intelligence: Closed sales and agreed contract data
   */
  async getInternalMarketSales() {
    return await db.select({
      contractId: salesContracts.id,
      propertyId: salesContracts.propertyId,
      agreedPrice: salesContracts.agreedPrice,
      currency: salesContracts.currency,
      executionDate: salesContracts.executionDate,
      propertyName: properties.name,
      propertyType: properties.type,
      squareFeet: properties.squareFeet,
      address: properties.address,
    })
    .from(salesContracts)
    .innerJoin(properties, eq(salesContracts.propertyId, properties.id))
    .where(inArray(salesContracts.status, ['EXECUTED']));
  }

  /**
   * Internal HomeHub market intelligence: Active leases and published listings
   */
  async getInternalMarketRentals() {
    const leaseData = await db.select({
      leaseId: leases.id,
      propertyId: leases.propertyId,
      rentAmount: leases.rentAmount,
      currency: leases.currency,
      propertyName: properties.name,
      propertyType: properties.type,
      squareFeet: properties.squareFeet,
      address: properties.address,
    })
    .from(leases)
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .where(eq(leases.status, 'ACTIVE'));

    const publishedListings = await db.select({
      listingId: listings.id,
      propertyId: listings.propertyId,
      price: listings.price,
      currency: listings.currency,
      type: listings.type,
      propertyName: properties.name,
      propertyType: properties.type,
      address: properties.address,
    })
    .from(listings)
    .innerJoin(properties, eq(listings.propertyId, properties.id))
    .where(eq(listings.status, 'PUBLISHED'));

    return { activeLeases: leaseData, publishedListings };
  }
}

export const analyticsRepository = new AnalyticsRepository();

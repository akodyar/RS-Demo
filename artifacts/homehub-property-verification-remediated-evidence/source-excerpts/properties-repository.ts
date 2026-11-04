import { db } from '../../db/index.js';
import { properties, ownershipRecords, users, organizations, units, listings, managementAgreements, agentPropertyAssignments, organizationMembers, leases, leaseTenants, rentSchedules, paymentRecords, commissions, ledgerLines, idempotencyRecords, verificationRecords, notifications, auditLogs, documents } from '../../db/schema.js';
import { eq, and, or, inArray, asc, desc } from 'drizzle-orm';
import { CommissionService } from '../services/commission.js';
import { financeService } from '../services/finance.js';
import { auditService } from '../services/audit.js';
import { validateIdempotencyKey, normalizePropertyCreationPayload, computePayloadHash, IDEMPOTENCY_RETENTION_MS } from '../services/idempotency.js';

export const ELIGIBLE_AGENT_ORG_TYPES = ['AGENT_COMPANY', 'COMPANY', 'AGENCY'] as const;

export function isEligibleAgentOrganization(org: {
  type: string;
  status?: string | null;
  verified?: boolean | null;
}): boolean {
  if (!org || !org.type || !ELIGIBLE_AGENT_ORG_TYPES.includes(org.type as any)) {
    return false;
  }
  if (['SUSPENDED', 'REJECTED', 'ARCHIVED', 'DRAFT', 'PENDING_VERIFICATION'].includes(org.status || '')) {
    return false;
  }
  return org.status === 'ACTIVE' || org.status === 'VERIFIED';
}

export class PropertyRepository {
  async getPropertiesByOwner(ownerId: string) {
    try {
      const records = await db.select({
        property: properties,
        ownership: ownershipRecords
      })
      .from(properties)
      .innerJoin(ownershipRecords, eq(properties.id, ownershipRecords.propertyId))
      .where(eq(ownershipRecords.ownerId, ownerId));
      return records.map(r => ({
        ...r.property,
        ownershipPercentage: r.ownership.ownershipPercentage
      }));
    } catch (error) {
      console.error("Database query failed:", error);
      throw new Error("Failed to fetch properties", { cause: error });
    }
  }

  async createProperty(creatorId: string, creatorRoles: string[], propertyData: { 
    name: string, 
    type: string, 
    address?: any, 
    city?: string,
    ownerId?: string,
    companyId?: string,
    photos?: string[], 
    imageUrl?: string, 
    amenities?: string[], 
    squareFeet?: number | string | null, 
    yearBuilt?: number | string | null,
    listingType?: string,
    price?: number | string,
    currency?: string,
    description?: string,
    rentFee?: number | string,
    managementFee?: number | string,
    operatingModel?: string,
    managedByAgentId?: string,
    listedByAgentId?: string,
    managementPreference?: string,
    managementArrangementStatus?: string,
  }, options?: {
    idempotencyKey?: string | null;
    scope?: string;
  }) {
    let validatedKey: string | null = null;
    let requestHash: string | null = null;
    const scope = options?.scope || 'PROPERTY_CREATE';

    if (options?.idempotencyKey !== undefined && options?.idempotencyKey !== null) {
      const keyCheck = validateIdempotencyKey(options.idempotencyKey);
      if (!keyCheck.valid) {
        throw new Error(`VALIDATION_ERROR: ${keyCheck.error}`);
      }
      validatedKey = keyCheck.key!;
    }

    if (!propertyData || typeof propertyData !== 'object') {
      throw new Error('VALIDATION_ERROR: Property payload is required and must be an object.');
    }

    // 1. Validate property name (required, non-empty, string, trimmed)
    if (typeof propertyData.name !== 'string' || !propertyData.name.trim()) {
      throw new Error('VALIDATION_ERROR: Property name is required and cannot be empty.');
    }
    const trimmedName = propertyData.name.trim();
    if (trimmedName.length > 255) {
      throw new Error('VALIDATION_ERROR: Property name cannot exceed 255 characters.');
    }

    // 2. Validate property type (required, non-empty, string, recognized type)
    if (typeof propertyData.type !== 'string' || !propertyData.type.trim()) {
      throw new Error('VALIDATION_ERROR: Property type is required and cannot be empty.');
    }
    const trimmedType = propertyData.type.trim();
    const VALID_PROPERTY_TYPES = new Set([
      'APARTMENT', 'VILLA', 'HOUSE', 'RESIDENTIAL',
      'RESIDENTIAL_APARTMENT', 'RESIDENTIAL_VILLA',
      'COMMERCIAL', 'COMMERCIAL_OFFICE', 'COMMERCIAL_SHOP',
      'OFFICE', 'RETAIL', 'SHOP',
      'INDUSTRIAL', 'INDUSTRIAL_WAREHOUSE', 'WAREHOUSE',
      'LAND', 'BUILDING', 'MULTI_UNIT', 'SINGLE_FAMILY',
      'TOWNHOUSE', 'STUDIO', 'DUPLEX'
    ]);
    if (!VALID_PROPERTY_TYPES.has(trimmedType.toUpperCase())) {
      throw new Error(`VALIDATION_ERROR: Invalid property type '${propertyData.type}'.`);
    }

    // 3. Validate address structure & extract city
    if (propertyData.address !== undefined && propertyData.address !== null && (typeof propertyData.address !== 'object' || Array.isArray(propertyData.address))) {
      throw new Error('VALIDATION_ERROR: Property address must be an object containing location details.');
    }

    let resolvedCity: string | undefined = undefined;
    if (typeof propertyData.city === 'string' && propertyData.city.trim()) {
      resolvedCity = propertyData.city.trim();
    } else if (propertyData.address && typeof propertyData.address === 'object' && typeof propertyData.address.city === 'string' && propertyData.address.city.trim()) {
      resolvedCity = propertyData.address.city.trim();
    }

    if (!resolvedCity) {
      throw new Error('VALIDATION_ERROR: Property city is required and cannot be empty.');
    }

    const addr = typeof propertyData.address === 'object' && propertyData.address !== null ? { ...propertyData.address } : {};
    addr.city = resolvedCity;
    if (typeof addr.street === 'string') addr.street = addr.street.trim();
    if (typeof addr.country === 'string') addr.country = addr.country.trim();
    if (typeof addr.region === 'string') addr.region = addr.region.trim();
    if (!addr.country) addr.country = 'Iraq';
    if (!addr.region) addr.region = 'Kurdistan';

    // 4. Validate listing type & rental-only boundary (Reject FOR_SALE)
    if (propertyData.listingType !== undefined && propertyData.listingType !== null && (propertyData.listingType as any) !== '') {
      if (typeof propertyData.listingType !== 'string') {
        throw new Error(`VALIDATION_ERROR: Invalid listing type '${propertyData.listingType}'.`);
      }
      const trimmedListingType = propertyData.listingType.trim().toUpperCase();
      if (trimmedListingType === 'FOR_SALE' || trimmedListingType === 'SALE') {
        throw new Error('VALIDATION_ERROR: Sale workflows and FOR_SALE listings are disabled in this rental-only release.');
      }
      if (trimmedListingType !== 'FOR_RENT' && trimmedListingType !== 'NONE') {
        throw new Error(`VALIDATION_ERROR: Invalid listing type '${propertyData.listingType}'. Allowed values are 'FOR_RENT', 'NONE', or omitted.`);
      }
    }

    // 5. Validate listing price if FOR_RENT
    if (propertyData.listingType && propertyData.listingType.trim().toUpperCase() === 'FOR_RENT') {
      if (propertyData.price !== undefined && propertyData.price !== null && (propertyData.price as any) !== '') {
        const p = Number(propertyData.price);
        if (isNaN(p) || !isFinite(p) || p <= 0) {
          throw new Error('VALIDATION_ERROR: Listing price must be a valid positive number.');
        }
      }
    }

    // 5b. Validate management preference if provided
    if (propertyData.managementPreference !== undefined && propertyData.managementPreference !== null && (propertyData.managementPreference as any) !== '') {
      if (typeof propertyData.managementPreference !== 'string') {
        throw new Error('VALIDATION_ERROR: Invalid management preference. Must be a string.');
      }
      const trimmedPref = propertyData.managementPreference.trim().toUpperCase();
      if (!['SELF_MANAGED', 'HOMEHUB_MANAGED', 'AGENT_MANAGED'].includes(trimmedPref)) {
        throw new Error(`VALIDATION_ERROR: Invalid management preference '${propertyData.managementPreference}'. Allowed choices are SELF_MANAGED, HOMEHUB_MANAGED, AGENT_MANAGED.`);
      }
    }

    // 6. Validate optional dimensions: squareFeet & yearBuilt
    let finalSquareFeet: number | null = null;
    if (propertyData.squareFeet !== undefined && propertyData.squareFeet !== null && (propertyData.squareFeet as any) !== '') {
      const sqft = Number(propertyData.squareFeet);
      if (isNaN(sqft) || !isFinite(sqft) || sqft < 0 || sqft > 10000000) {
        throw new Error('VALIDATION_ERROR: Square feet must be a valid positive number.');
      }
      finalSquareFeet = Math.round(sqft);
    }

    let finalYearBuilt: number | null = null;
    if (propertyData.yearBuilt !== undefined && propertyData.yearBuilt !== null && (propertyData.yearBuilt as any) !== '') {
      const yb = Number(propertyData.yearBuilt);
      const currentYear = new Date().getFullYear();
      if (isNaN(yb) || !isFinite(yb) || yb < 1800 || yb > currentYear + 5) {
        throw new Error('VALIDATION_ERROR: Year built must be a valid year.');
      }
      finalYearBuilt = Math.round(yb);
    }

    // 7. Validate operating model if provided
    const validModels = ['FULLY_MANAGED', 'AGENT_LISTED_PLATFORM_MANAGED', 'AGENT_OPERATED'];
    if (propertyData.operatingModel !== undefined && propertyData.operatingModel !== null && (propertyData.operatingModel as any) !== '') {
      if (typeof propertyData.operatingModel !== 'string') {
        throw new Error(`VALIDATION_ERROR: Invalid operating model: ${propertyData.operatingModel}. Must be one of: ${validModels.join(', ')}`);
      }
      const trimmedModel = propertyData.operatingModel.trim();
      if (!validModels.includes(trimmedModel)) {
        throw new Error(`Invalid operating model: ${propertyData.operatingModel}. Must be one of: ${validModels.join(', ')}`);
      }
    }

    // 8. Enforce Operating Model Fees & mathematically validate fees
    let finalRentFee = propertyData.rentFee;
    let finalManagementFee = propertyData.managementFee;

    if (propertyData.operatingModel === 'AGENT_OPERATED') {
      finalRentFee = undefined;
      finalManagementFee = undefined;
    } else if (propertyData.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') {
      finalRentFee = undefined;
    }

    if (finalRentFee !== undefined && finalRentFee !== null && (finalRentFee as any) !== '') {
      const rf = Number(finalRentFee);
      if (isNaN(rf) || !isFinite(rf) || rf < 0 || rf > 1) {
        throw new Error('INVALID_FEE: Rent fee must be a valid number between 0 and 1');
      }
    }
    if (finalManagementFee !== undefined && finalManagementFee !== null && (finalManagementFee as any) !== '') {
      const mf = Number(finalManagementFee);
      if (isNaN(mf) || !isFinite(mf) || mf < 0 || mf > 1) {
        throw new Error('INVALID_FEE: Management fee must be a valid number between 0 and 1');
      }
    }

    // 9. Validate currency
    if (propertyData.currency !== undefined && propertyData.currency !== null && (propertyData.currency as any) !== '') {
      if (typeof propertyData.currency !== 'string') {
        throw new Error(`INVALID_CURRENCY: Unsupported currency '${propertyData.currency}'. Supported currencies are IQD and USD.`);
      }
    }
    const resolvedCurrency = (propertyData.currency || 'IQD').trim().toUpperCase();
    if (resolvedCurrency !== 'IQD' && resolvedCurrency !== 'USD') {
      throw new Error(`INVALID_CURRENCY: Unsupported currency '${propertyData.currency}'. Supported currencies are IQD and USD.`);
    }

    // Determine the actual owner based on creator role and provided data
    const isOwner = creatorRoles.includes('PROPERTY_OWNER');
    const isCompany = creatorRoles.includes('COMPANY') || creatorRoles.includes('COMPANY_MEMBER') || creatorRoles.includes('COMPANY_ADMIN');
    const isAgent = creatorRoles.includes('AGENT_BROKER');
    const isAdmin = creatorRoles.includes('PLATFORM_ADMIN') || creatorRoles.includes('SUPER_ADMIN');

    let targetOwnerId: string | null = null;
    let targetCompanyId: string | null = null;

    if (propertyData.ownerId || propertyData.companyId) {
      if (propertyData.ownerId) {
        if (typeof propertyData.ownerId !== 'string' || !propertyData.ownerId.trim()) {
          throw new Error('VALIDATION_ERROR: Owner ID must be a non-empty string.');
        }
        const userCheck = await db.select().from(users).where(eq(users.id, propertyData.ownerId.trim())).limit(1);
        if (userCheck.length === 0) {
          throw new Error('INVALID_OWNER: The specified owner user does not exist.');
        }
        targetOwnerId = propertyData.ownerId.trim();
      }

      if (propertyData.companyId) {
        if (typeof propertyData.companyId !== 'string' || !propertyData.companyId.trim()) {
          throw new Error('VALIDATION_ERROR: Company ID must be a non-empty string.');
        }
        const companyCheck = await db.select().from(organizations).where(eq(organizations.id, propertyData.companyId.trim())).limit(1);
        if (companyCheck.length === 0) {
          throw new Error('INVALID_OWNER: The specified owner company does not exist.');
        }
        targetCompanyId = propertyData.companyId.trim();
      }

      if (!isAgent && !isAdmin) {
        const isSelfAssigningOwner = isOwner && propertyData.ownerId === creatorId && !propertyData.companyId;
        
        let isSelfAssigningCompany = false;
        if (isCompany && propertyData.companyId) {
            const orgCheck = await db.select().from(organizationMembers).where(
                and(
                    eq(organizationMembers.userId, creatorId),
                    eq(organizationMembers.organizationId, propertyData.companyId)
                )
            ).limit(1);
            if (orgCheck.length > 0) {
              if (!propertyData.ownerId || propertyData.ownerId === creatorId) {
                isSelfAssigningCompany = true;
              } else {
                const memberCheck = await db.select().from(organizationMembers).where(
                  and(
                    eq(organizationMembers.userId, propertyData.ownerId),
                    eq(organizationMembers.organizationId, propertyData.companyId)
                  )
                ).limit(1);
                isSelfAssigningCompany = memberCheck.length > 0;
              }
            }
        }

        if (!isSelfAssigningOwner && !isSelfAssigningCompany) {
          throw new Error('FORBIDDEN: Only Agents and Admins can assign properties to other owners.');
        }
      }
    }

    // If no explicit owner provided, but creator is an owner, they own it
    if (!targetOwnerId && !targetCompanyId) {
      if (isOwner && !isCompany) {
        targetOwnerId = creatorId;
      } else if (isCompany && !isAgent) {
        // Find their company id if not provided
        const userOrgs = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, creatorId)).limit(1);
        if (userOrgs.length > 0) {
          targetCompanyId = userOrgs[0].organizationId;
        } else {
          targetOwnerId = creatorId; // fallback
        }
      }
    }

    // If creator is an agent company and managedByAgentId is not provided, infer it
    let resolvedManagedByAgentId = propertyData.managedByAgentId;
    if (isAgent && isCompany && !resolvedManagedByAgentId) {
      const userOrgs = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, creatorId)).limit(1);
      if (userOrgs.length > 0 && userOrgs[0].organizationId !== targetCompanyId) {
        resolvedManagedByAgentId = userOrgs[0].organizationId;
      }
    }

    // P0 FIX: Agent Authorization. If Agent is creating on behalf of an owner, they must have a CRM Contact relationship
    // or an existing Management Agreement. Since this is creation, we check crmContacts or just require the agent
    // to have an established relationship. (Admins bypass this).
    if (targetOwnerId && isAgent && !isAdmin && targetOwnerId !== creatorId) {
      // Check if targetOwnerId is a client of the agent's organization or the agent themselves
      const { crmContacts } = await import('../../db/schema.js');
      const clientCheck = await db.select().from(crmContacts).where(
        and(
          eq(crmContacts.contactUserId, targetOwnerId),
          resolvedManagedByAgentId 
            ? eq(crmContacts.organizationId, resolvedManagedByAgentId)
            : eq(crmContacts.ownerUserId, creatorId)
        )
      ).limit(1);
      if (clientCheck.length === 0) {
        throw new Error('FORBIDDEN: You do not have an established client relationship with this owner.');
      }
    }

    if (resolvedManagedByAgentId) {
      const agentCheck = await db.select().from(organizations).where(eq(organizations.id, resolvedManagedByAgentId)).limit(1);
      if (agentCheck.length === 0) {
        throw new Error('INVALID_AGENT: The specified agent/company does not exist.');
      }
      if (!isEligibleAgentOrganization(agentCheck[0])) {
        throw new Error('INVALID_AGENT: The specified organization is not an authorized management agent.');
      }

      if (isAgent && !isAdmin && propertyData.managedByAgentId) {
        const agentMembership = await db.select().from(organizationMembers).where(
          and(
            eq(organizationMembers.userId, creatorId),
            eq(organizationMembers.organizationId, propertyData.managedByAgentId)
          )
        ).limit(1);
        if (agentMembership.length === 0) {
          throw new Error('FORBIDDEN: Agents can only assign management to their own organization.');
        }
      }
    }

    if (validatedKey) {
      requestHash = computePayloadHash(normalizePropertyCreationPayload(propertyData));

      // Check for existing non-expired idempotency record
      const existing = await db.select().from(idempotencyRecords).where(
        and(
          eq(idempotencyRecords.userId, creatorId),
          eq(idempotencyRecords.scope, scope),
          eq(idempotencyRecords.key, validatedKey)
        )
      ).limit(1);

      if (existing.length > 0) {
        const record = existing[0];
        const isExpired = new Date(record.expiresAt).getTime() <= Date.now();

        if (!isExpired) {
          // Payload mismatch check
          if (record.requestHash !== requestHash) {
            throw new Error('CONFLICT: Idempotency key payload mismatch. The provided idempotency key was already used with a different request payload.');
          }

          // Return replayed response
          const replayed = { ...record.responseBody };
          Object.defineProperty(replayed, '__isReplay', { value: true, enumerable: false });
          return replayed;
        } else {
          // Expired record: delete it so fresh execution proceeds
          await db.delete(idempotencyRecords).where(eq(idempotencyRecords.id, record.id));
        }
      }
    }

    try {
      return await db.transaction(async (tx) => {
        const photos = propertyData.photos || addr.photos || [];
        const imageUrl = propertyData.imageUrl || addr.imageUrl || photos[0] || '';
        const amenities = propertyData.amenities || addr.amenities || [];

        let resolvedMgmtPref = 'SELF_MANAGED';
        let resolvedArrangementStatus = 'NOT_APPLICABLE';

        if (propertyData.managementPreference) {
          const pref = propertyData.managementPreference.trim().toUpperCase();
          if (pref === 'HOMEHUB_MANAGED') {
            resolvedMgmtPref = 'HOMEHUB_MANAGED';
            resolvedArrangementStatus = 'AWAITING_ONBOARDING';
          } else if (pref === 'AGENT_MANAGED') {
            resolvedMgmtPref = 'AGENT_MANAGED';
            resolvedArrangementStatus = 'AWAITING_AGREEMENT';
          } else {
            resolvedMgmtPref = 'SELF_MANAGED';
            resolvedArrangementStatus = 'NOT_APPLICABLE';
          }
        }

        // 1. Create property
        const [newProperty] = await tx.insert(properties).values({
          name: trimmedName,
          type: trimmedType,
          address: {
            ...addr,
            photos,
            imageUrl,
            amenities,
          },
          squareFeet: finalSquareFeet,
          yearBuilt: finalYearBuilt,
          rentFee: finalRentFee !== undefined && finalRentFee !== null && (finalRentFee as any) !== '' ? String(finalRentFee) : null,
          managementFee: finalManagementFee !== undefined && finalManagementFee !== null && (finalManagementFee as any) !== '' ? String(finalManagementFee) : null,
          operatingModel: propertyData.operatingModel ? propertyData.operatingModel.trim() : null,
          managedByAgentId: resolvedManagedByAgentId || null,
          listedByAgentId: propertyData.listedByAgentId || null,
          currency: resolvedCurrency,
          status: 'PENDING_VERIFICATION',
          verificationStatus: 'PENDING_VERIFICATION',
          rejectionReason: null,
          managementPreference: resolvedMgmtPref,
          managementArrangementStatus: resolvedArrangementStatus,
        }).returning();

        // 2. Assign initial ownership only if an owner is identified
        const hasActualOwner = targetOwnerId || targetCompanyId;
        if (hasActualOwner) {
          await tx.insert(ownershipRecords).values({
            propertyId: newProperty.id,
            ownerId: targetOwnerId || null,
            companyId: targetCompanyId || null,
            ownershipPercentage: '100.00',
            status: 'PENDING_VERIFICATION',
          });

          await tx.insert(verificationRecords).values({
            subjectType: 'PROPERTY',
            subjectId: newProperty.id,
            verificationType: 'PROPERTY_TAPU',
            status: 'PENDING_VERIFICATION',
            ownerId: targetOwnerId || null,
            organizationId: targetCompanyId || null,
            propertyId: newProperty.id,
            submittedBy: creatorId,
            submittedAt: new Date(),
            metadata: {
              propertyName: trimmedName,
              city: addr.city,
              listingType: propertyData.listingType || null,
              managementPreference: propertyData.managementPreference || null,
            }
          });
        }

        // 3. If listingType is FOR_RENT, stage listing in PENDING_REVIEW (NEVER PUBLISHED until verified)
        // Authoritative Verification Invariant: Unverified properties must not be published to marketplace
        if (propertyData.listingType && propertyData.listingType.trim().toUpperCase() === 'FOR_RENT' && hasActualOwner) {
          await tx.insert(listings).values({
            propertyId: newProperty.id,
            publisherUserId: creatorId,
            type: 'FOR_RENT',
            price: String(propertyData.price || (resolvedCurrency === 'USD' ? '1000' : '1200000')),
            currency: resolvedCurrency,
            status: 'PENDING_REVIEW',
            title: trimmedName || `Property in ${addr.city || 'Kurdistan'}`,
            description: (propertyData.description && typeof propertyData.description === 'string' ? propertyData.description.trim() : '') || addr.description || 'Verified property listed on HomeHub',
          });
        }

        // 4. Create management agreement if managedByAgentId is provided
        if (resolvedManagedByAgentId) {
          if (!targetOwnerId) {
            throw new Error('VALIDATION_ERROR: Cannot create management agreement without a designated owner user.');
          }

          await tx.insert(managementAgreements).values({
            propertyId: newProperty.id,
            companyId: resolvedManagedByAgentId,
            ownerId: targetOwnerId,
            status: 'ACTIVE',
            startDate: new Date().toISOString().split('T')[0],
            grantedPermissions: ['MAINTENANCE_VIEW', 'FINANCIAL_VIEW'],
          });
        }

        // 5. If creator is an individual agent, assign them as the property manager
        if (isAgent && !resolvedManagedByAgentId && !isCompany) {
          await tx.insert(agentPropertyAssignments).values({
            propertyId: newProperty.id,
            userId: creatorId,
            assignedBy: targetOwnerId || creatorId, // fallback to creator if no owner
            permissions: ['VIEW_PROPERTY', 'EDIT_PROPERTY', 'MANAGE_MAINTENANCE', 'VIEW_FINANCIALS'],
            status: 'ACTIVE',
          });
        }

        // 6. Record idempotency in the same atomic transaction
        if (validatedKey && requestHash) {
          await tx.insert(idempotencyRecords).values({
            key: validatedKey,
            scope,
            userId: creatorId,
            requestHash,
            resourceId: newProperty.id,
            responseStatus: 201,
            responseBody: newProperty,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
          });
        }

        return newProperty;
      });
    } catch (error: any) {
      if (
        validatedKey &&
        (error?.code === '23505' ||
          error?.cause?.code === '23505' ||
          error?.message?.includes('idempotency_records_user_scope_key_unique') ||
          error?.cause?.message?.includes('idempotency_records_user_scope_key_unique') ||
          error?.message?.includes('duplicate key value') ||
          error?.cause?.message?.includes('duplicate key value'))
      ) {
        let committed = await db.select().from(idempotencyRecords).where(
          and(
            eq(idempotencyRecords.userId, creatorId),
            eq(idempotencyRecords.scope, scope),
            eq(idempotencyRecords.key, validatedKey)
          )
        ).limit(1);

        if (committed.length === 0) {
          for (let attempt = 0; attempt < 5 && committed.length === 0; attempt++) {
            await new Promise((r) => setTimeout(r, 50));
            committed = await db.select().from(idempotencyRecords).where(
              and(
                eq(idempotencyRecords.userId, creatorId),
                eq(idempotencyRecords.scope, scope),
                eq(idempotencyRecords.key, validatedKey)
              )
            ).limit(1);
          }
        }

        if (committed.length > 0) {
          if (committed[0].requestHash !== requestHash) {
            throw new Error('CONFLICT: Idempotency key payload mismatch. The provided idempotency key was already used with a different request payload.');
          }
          const replayed = { ...committed[0].responseBody };
          Object.defineProperty(replayed, '__isReplay', { value: true, enumerable: false });
          return replayed;
        }
      }
      throw error;
    }
  }

  async updateProperty(propertyId: string, updates: Partial<typeof properties.$inferInsert>) {
    const [updatedProperty] = await db.update(properties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(properties.id, propertyId))
      .returning();
      
    return updatedProperty;
  }

  async getPropertyById(id: string) {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async addUnit(propertyId: string, unitData: any) {
    if (!propertyId || typeof propertyId !== 'string' || !propertyId.trim()) {
      throw new Error('VALIDATION_ERROR: propertyId is required.');
    }

    const property = await this.getPropertyById(propertyId);
    if (!property) {
      throw new Error('NOT_FOUND: Property not found.');
    }

    if (!unitData || typeof unitData !== 'object') {
      throw new Error('VALIDATION_ERROR: unitData must be an object.');
    }

    if (
      unitData.unitNumber === undefined ||
      unitData.unitNumber === null ||
      typeof unitData.unitNumber !== 'string' ||
      !unitData.unitNumber.trim()
    ) {
      throw new Error('VALIDATION_ERROR: unitNumber is required and must be a non-empty string.');
    }

    const normalizedUnitNumber = unitData.unitNumber.trim();

    // Validate optional beds / bedrooms
    const bedsRaw = unitData.beds !== undefined ? unitData.beds : unitData.bedrooms;
    let beds: number | null = null;
    if (bedsRaw !== undefined && bedsRaw !== null) {
      const numBeds = typeof bedsRaw === 'number' ? bedsRaw : Number(bedsRaw);
      if (!Number.isInteger(numBeds) || numBeds < 0 || numBeds > 100) {
        throw new Error('VALIDATION_ERROR: beds must be a non-negative integer.');
      }
      beds = numBeds;
    }

    // Validate optional baths / bathrooms
    const bathsRaw = unitData.baths !== undefined ? unitData.baths : unitData.bathrooms;
    let baths: string | null = null;
    if (bathsRaw !== undefined && bathsRaw !== null) {
      const numBaths = typeof bathsRaw === 'number' ? bathsRaw : Number(bathsRaw);
      if (isNaN(numBaths) || numBaths < 0 || numBaths > 50) {
        throw new Error('VALIDATION_ERROR: baths must be a non-negative number.');
      }
      baths = String(numBaths);
    }

    // Validate optional squareFeet / sizeSqm / area
    const sqftRaw = unitData.squareFeet !== undefined ? unitData.squareFeet : (unitData.sizeSqm !== undefined ? unitData.sizeSqm : unitData.area);
    let squareFeet: number | null = null;
    if (sqftRaw !== undefined && sqftRaw !== null) {
      const numSqft = typeof sqftRaw === 'number' ? sqftRaw : Number(sqftRaw);
      if (isNaN(numSqft) || numSqft < 0 || numSqft > 1000000) {
        throw new Error('VALIDATION_ERROR: squareFeet must be a non-negative number.');
      }
      squareFeet = Math.round(numSqft);
    }

    // Validate optional marketRent
    let marketRent: string | null = null;
    if (unitData.marketRent !== undefined && unitData.marketRent !== null) {
      const numRent = typeof unitData.marketRent === 'number' ? unitData.marketRent : Number(unitData.marketRent);
      if (isNaN(numRent) || numRent < 0) {
        throw new Error('VALIDATION_ERROR: marketRent must be a non-negative number.');
      }
      marketRent = String(numRent);
    }

    // Validate currency
    const unitCurrency = (unitData.currency || property.currency || 'IQD').toUpperCase();
    if (unitCurrency !== 'IQD' && unitCurrency !== 'USD') {
      throw new Error(`VALIDATION_ERROR: Invalid currency '${unitCurrency}'. Must be IQD or USD.`);
    }

    // Application pre-check for duplicate unit number within this property
    const [existingUnit] = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.propertyId, propertyId), eq(units.unitNumber, normalizedUnitNumber)))
      .limit(1);

    if (existingUnit) {
      throw new Error(`CONFLICT: Unit '${normalizedUnitNumber}' already exists for this property.`);
    }

    try {
      const [newUnit] = await db.insert(units).values({
        propertyId,
        unitNumber: normalizedUnitNumber,
        beds,
        baths,
        squareFeet,
        marketRent,
        currency: unitCurrency,
        status: 'VACANT',
      }).returning();
      return newUnit;
    } catch (dbError: any) {
      // Catch race-condition or concurrent constraint violation (PostgreSQL 23505)
      if (
        dbError.code === '23505' ||
        dbError.message?.includes('units_property_unit_unique') ||
        dbError.message?.includes('unique')
      ) {
        throw new Error(`CONFLICT: Unit '${normalizedUnitNumber}' already exists for this property.`);
      }
      throw dbError;
    }
  }


  /**
   * Authoritative financial summary for PropertyCommandCenter and property finance auditing.
   * Strictly calculates confirmed collected rent from payment_records (status = 'CONFIRMED'),
   * completely excluding RECORDED, PENDING, REVERSED, REFUNDED, or FAILED payments.
   * Authoritatively computes dynamic 3-fee breakdown using active financial policy and/or
   * historically posted commission and ledger records.
   */
  async getAuthoritativeFinancialSummary(propertyId: string, scheduleId?: string) {
    const property = await this.getPropertyById(propertyId);
    if (!property) {
      throw new Error("Property not found");
    }

    const operatingModel = property.operatingModel || 'FULLY_MANAGED';
    const rentFeeRate = (property.rentFee !== null && property.rentFee !== undefined && String(property.rentFee).trim() !== '') ? parseFloat(property.rentFee) : null;
    const managementFeeRate = (property.managementFee !== null && property.managementFee !== undefined && String(property.managementFee).trim() !== '') ? parseFloat(property.managementFee) : null;
    let currency = property.currency || 'IQD';

    // Fetch active financial policy rate from database (default fallback 0.03 if unconfigured)
    let currentPlatformFeeRate = 0.03;
    try {
      currentPlatformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    } catch {
      currentPlatformFeeRate = 0.03;
    }

    // 1. Fetch active lease for property
    const [activeLease] = await db.select({
      lease: leases,
      tenant: users
    })
    .from(leases)
    .leftJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
    .leftJoin(users, eq(leaseTenants.tenantId, users.id))
    .where(and(
      eq(leases.propertyId, propertyId),
      inArray(leases.status, ['ACTIVE', 'EXPIRING'])
    ))
    .limit(1);

    if (activeLease?.lease?.currency) {
      currency = activeLease.lease.currency;
    }

    if (!activeLease) {
      return {
        propertyId,
        hasActiveLease: false,
        operatingModel,
        currency,
        platformFeeRate: currentPlatformFeeRate,
        rentFeeRate: operatingModel === 'FULLY_MANAGED' ? rentFeeRate : null,
        managementFeeRate: (operatingModel === 'FULLY_MANAGED' || operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') ? managementFeeRate : null,
        scheduledRentAmount: 0,
        confirmedCollectedRent: 0,
        platformFeeAmount: 0,
        rentFeeAmount: 0,
        managementFeeAmount: 0,
        totalFeeAmount: 0,
        ownerNetAmount: 0,
        currentSchedule: null,
        latestConfirmedPayment: null,
        confirmedPaymentCount: 0,
        payoutStatus: 'NONE' as const,
        isAuthoritative: true,
      };
    }

    // 2. Fetch rent schedules for active lease
    const schedules = await db.select()
      .from(rentSchedules)
      .where(eq(rentSchedules.leaseId, activeLease.lease.id))
      .orderBy(asc(rentSchedules.dueDate));

    // Determine target schedule
    let targetSchedule = scheduleId
      ? schedules.find(s => s.id === scheduleId)
      : null;

    if (!targetSchedule && schedules.length > 0) {
      targetSchedule = schedules.slice().reverse().find(s => s.status === 'PAID') ||
        schedules.find(s => s.status === 'DUE' || s.status === 'OVERDUE' || s.status === 'PARTIALLY_PAID' || s.status === 'UPCOMING') ||
        schedules[0];
    }

    const scheduledRentAmount = targetSchedule
      ? Number(targetSchedule.amount || 0)
      : Number(activeLease.lease.rentAmount || 0);

    const activeCurrency = targetSchedule?.currency || activeLease.lease.currency || currency;

    // 3. Query CONFIRMED payments ONLY for this property
    const confirmedPayments = await db.select()
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.propertyId, propertyId),
        eq(paymentRecords.status, 'CONFIRMED')
      ));

    // Filter confirmed payments for target schedule (or lease if no scheduleId assigned)
    const periodConfirmedPayments = targetSchedule
      ? confirmedPayments.filter(p => p.rentScheduleId === targetSchedule.id || (!p.rentScheduleId && p.leaseId === activeLease.lease.id))
      : confirmedPayments.filter(p => p.leaseId === activeLease.lease.id);

    // Confirmed collected rent: strictly sum of CONFIRMED payments
    const confirmedCollectedRent = periodConfirmedPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    // Latest confirmed payment for receipt/date reference
    const latestPayment = periodConfirmedPayments.length > 0
      ? periodConfirmedPayments.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
      : null;

    // 4. Fees derivation: Posted commission / ledger lines vs dynamic policy calculation
    let platformFeeRate = currentPlatformFeeRate;
    let platformFeeAmount = 0;
    let rentFeeAmount = 0;
    let managementFeeAmount = 0;
    let totalFeeAmount = 0;
    let ownerNetAmount = 0;
    let effectiveRentFeeRate: number | null = rentFeeRate;
    let effectiveManagementFeeRate: number | null = managementFeeRate;

    const paymentIds = periodConfirmedPayments.map(p => p.id);
    const postedCommissions = paymentIds.length > 0
      ? await db.select()
          .from(commissions)
          .where(and(
            inArray(commissions.paymentRecordId, paymentIds),
            eq(commissions.status, 'POSTED')
          ))
      : [];

    if (postedCommissions.length > 0) {
      // Respect historical platform rate recorded on posted commission
      platformFeeRate = parseFloat(postedCommissions[0].rate || String(currentPlatformFeeRate));
      
      const jeIds = postedCommissions.map(c => c.journalEntryId).filter(Boolean) as string[];
      let hasLedgerBreakdown = false;

      if (jeIds.length > 0) {
        const lines = await db.select().from(ledgerLines).where(inArray(ledgerLines.journalEntryId, jeIds));
        if (lines.length > 0) {
          hasLedgerBreakdown = true;
          for (const l of lines) {
            if (l.accountId === '4010') platformFeeAmount += Number(l.credit || 0);
            if (l.accountId === '4011') rentFeeAmount += Number(l.credit || 0);
            if (l.accountId === '4012') managementFeeAmount += Number(l.credit || 0);
            if (l.accountId === '2010') ownerNetAmount += Number(l.credit || 0);
          }
          totalFeeAmount = platformFeeAmount + rentFeeAmount + managementFeeAmount;
          if (operatingModel === 'AGENT_OPERATED') {
            effectiveRentFeeRate = null;
            effectiveManagementFeeRate = null;
          } else if (operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') {
            effectiveRentFeeRate = null;
          }
        }
      }

      if (!hasLedgerBreakdown) {
        const syncCalc = CommissionService.calculateFeesSync(
          confirmedCollectedRent,
          platformFeeRate,
          operatingModel as any,
          rentFeeRate,
          managementFeeRate,
          activeCurrency
        );
        platformFeeAmount = syncCalc.platformFeeAmount;
        rentFeeAmount = syncCalc.rentFeeAmount;
        managementFeeAmount = syncCalc.managementFeeAmount;
        totalFeeAmount = syncCalc.totalFeeAmount;
        ownerNetAmount = syncCalc.ownerNetAmount;
        effectiveRentFeeRate = syncCalc.rentFeeRate;
        effectiveManagementFeeRate = syncCalc.managementFeeRate;
      }
    } else {
      const syncCalc = CommissionService.calculateFeesSync(
        confirmedCollectedRent,
        currentPlatformFeeRate,
        operatingModel as any,
        rentFeeRate,
        managementFeeRate,
        activeCurrency
      );
      platformFeeAmount = syncCalc.platformFeeAmount;
      rentFeeAmount = syncCalc.rentFeeAmount;
      managementFeeAmount = syncCalc.managementFeeAmount;
      totalFeeAmount = syncCalc.totalFeeAmount;
      ownerNetAmount = syncCalc.ownerNetAmount;
      effectiveRentFeeRate = syncCalc.rentFeeRate;
      effectiveManagementFeeRate = syncCalc.managementFeeRate;
    }

    const payoutStatus = (confirmedCollectedRent > 0 && ownerNetAmount > 0)
      ? 'ENTITLEMENT_RECORDED'
      : 'NONE';

    return {
      propertyId,
      hasActiveLease: true,
      activeLeaseId: activeLease.lease.id,
      operatingModel,
      currency: activeCurrency,
      scheduledRentAmount,
      confirmedCollectedRent,
      platformFeeRate,
      platformFeeAmount,
      rentFeeRate: effectiveRentFeeRate,
      rentFeeAmount,
      managementFeeRate: effectiveManagementFeeRate,
      managementFeeAmount,
      totalFeeAmount,
      ownerNetAmount,
      currentSchedule: targetSchedule ? {
        id: targetSchedule.id,
        dueDate: targetSchedule.dueDate,
        periodStart: targetSchedule.periodStart,
        periodEnd: targetSchedule.periodEnd,
        amount: targetSchedule.amount,
        paidAmount: targetSchedule.paidAmount,
        status: targetSchedule.status,
        currency: targetSchedule.currency
      } : null,
      latestConfirmedPayment: latestPayment ? {
        id: latestPayment.id,
        amount: latestPayment.amount,
        currency: latestPayment.currency,
        status: latestPayment.status,
        recordedDate: latestPayment.recordedDate,
        receiptNumber: latestPayment.receiptNumber,
        paymentMethod: latestPayment.paymentMethod,
        confirmedAt: (latestPayment as any).confirmedAt || latestPayment.recordedDate
      } : null,
      confirmedPaymentCount: periodConfirmedPayments.length,
      payoutStatus,
      isAuthoritative: true,
    };
  }

  async getEligibleAgents() {
    const orgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      status: organizations.status,
      type: organizations.type,
      verified: organizations.verified
    })
    .from(organizations)
    .where(
      and(
        inArray(organizations.type, [...ELIGIBLE_AGENT_ORG_TYPES]),
        or(
          eq(organizations.status, 'VERIFIED'),
          and(
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.verified, true)
          )
        )
      )
    );

    return orgs.filter(isEligibleAgentOrganization).map(o => ({
      id: o.id,
      name: o.name,
      status: o.status,
      type: o.type
    }));
  }

  async setManagementPreference(
    ownerUserId: string,
    userRoles: string[],
    userOrgId: string | undefined,
    propertyId: string,
    preference: 'SELF_MANAGED' | 'HOMEHUB_MANAGED' | 'AGENT_MANAGED',
    agentCompanyId?: string
  ) {
    const isPlatformAdmin = userRoles.includes('PLATFORM_ADMIN') || userRoles.includes('SUPER_ADMIN');

    // 1. Verify property exists
    const [prop] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!prop) {
      throw new Error('NOT_FOUND: Property not found.');
    }

    // 2. Verify caller is authorized owner or platform admin
    if (!isPlatformAdmin) {
      const ownerConditions = [
        eq(ownershipRecords.propertyId, propertyId),
      ];
      if (userOrgId) {
        ownerConditions.push(or(eq(ownershipRecords.ownerId, ownerUserId), eq(ownershipRecords.companyId, userOrgId))!);
      } else {
        ownerConditions.push(eq(ownershipRecords.ownerId, ownerUserId));
      }

      const ownerRec = await db.select().from(ownershipRecords).where(and(...ownerConditions)).limit(1);
      if (ownerRec.length === 0) {
        throw new Error('FORBIDDEN: Caller is not the authorized owner of this property.');
      }
    }

    // 3. Validate preference choice
    const validChoices = ['SELF_MANAGED', 'HOMEHUB_MANAGED', 'AGENT_MANAGED'];
    if (!validChoices.includes(preference)) {
      throw new Error(`VALIDATION_ERROR: Invalid management preference '${preference}'. Allowed: ${validChoices.join(', ')}`);
    }

    return await db.transaction(async (tx) => {
      if (preference === 'SELF_MANAGED') {
        // Invariant: Changing preference must respect existing contracts. Cannot silently terminate active agreement.
        const activeAgreements = await tx.select().from(managementAgreements).where(and(
          eq(managementAgreements.propertyId, propertyId),
          eq(managementAgreements.status, 'ACTIVE')
        ));
        if (activeAgreements.length > 0) {
          throw new Error('CONFLICT: An active management agreement exists for this property. Active agreements cannot be silently terminated by changing preference.');
        }

        const [updated] = await tx.update(properties).set({
          managementPreference: 'SELF_MANAGED',
          managementArrangementStatus: 'NOT_APPLICABLE',
          managedByAgentId: null,
          updatedAt: new Date()
        }).where(eq(properties.id, propertyId)).returning();

        await auditService.logAction({
          actorUserId: ownerUserId,
          actorRole: userRoles[0] || 'PROPERTY_OWNER',
          action: 'OWNER_SET_MANAGEMENT_PREFERENCE',
          resourceType: 'Property',
          resourceId: propertyId,
          changes: { managementPreference: 'SELF_MANAGED', managementArrangementStatus: 'NOT_APPLICABLE' }
        });

        return updated;
      }

      if (preference === 'HOMEHUB_MANAGED') {
        const [updated] = await tx.update(properties).set({
          managementPreference: 'HOMEHUB_MANAGED',
          managementArrangementStatus: 'AWAITING_ONBOARDING',
          managedByAgentId: null,
          updatedAt: new Date()
        }).where(eq(properties.id, propertyId)).returning();

        await auditService.logAction({
          actorUserId: ownerUserId,
          actorRole: userRoles[0] || 'PROPERTY_OWNER',
          action: 'OWNER_SET_MANAGEMENT_PREFERENCE',
          resourceType: 'Property',
          resourceId: propertyId,
          changes: { managementPreference: 'HOMEHUB_MANAGED', managementArrangementStatus: 'AWAITING_ONBOARDING' }
        });

        return updated;
      }

      if (preference === 'AGENT_MANAGED') {
        let assignedAgentId: string | null = null;
        if (agentCompanyId) {
          const [agentOrg] = await tx.select().from(organizations).where(eq(organizations.id, agentCompanyId)).limit(1);
          if (!agentOrg || !ELIGIBLE_AGENT_ORG_TYPES.includes(agentOrg.type as any)) {
            throw new Error('VALIDATION_ERROR: The selected property management company or agent does not exist or is not eligible.');
          }
          if (!isEligibleAgentOrganization(agentOrg)) {
            throw new Error('VALIDATION_ERROR: The selected management organization is not active or verified.');
          }
          assignedAgentId = agentCompanyId;
        }

        const [updated] = await tx.update(properties).set({
          managementPreference: 'AGENT_MANAGED',
          managementArrangementStatus: 'AWAITING_AGREEMENT',
          managedByAgentId: assignedAgentId,
          updatedAt: new Date()
        }).where(eq(properties.id, propertyId)).returning();

        await auditService.logAction({
          actorUserId: ownerUserId,
          actorRole: userRoles[0] || 'PROPERTY_OWNER',
          action: 'OWNER_SET_MANAGEMENT_PREFERENCE',
          resourceType: 'Property',
          resourceId: propertyId,
          changes: { managementPreference: 'AGENT_MANAGED', managementArrangementStatus: 'AWAITING_AGREEMENT', managedByAgentId: assignedAgentId }
        });

        return updated;
      }
    });
  }

  async approveProperty(adminUserId: string, adminRoles: string[], propertyId: string, notes?: string) {
    const isPlatformAdmin = adminRoles.some(r => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'VERIFICATION_ADMIN', 'PROPERTY_ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
    if (!isPlatformAdmin) {
      throw new Error('FORBIDDEN: Administrative verification permission required.');
    }

    return await db.transaction(async (tx) => {
      const [prop] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (!prop) throw new Error('NOT_FOUND: Property not found.');

      // 1. Update property
      const [updatedProp] = await tx.update(properties).set({
        verificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        rejectionReason: null,
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
        updatedAt: new Date(),
      }).where(eq(properties.id, propertyId)).returning();

      // 2. Update ownership records
      await tx.update(ownershipRecords).set({
        status: 'VERIFIED',
      }).where(eq(ownershipRecords.propertyId, propertyId));

      // 3. Update or create verification records
      const existingVer = await tx.select().from(verificationRecords).where(and(
        eq(verificationRecords.propertyId, propertyId),
        eq(verificationRecords.subjectType, 'PROPERTY')
      )).orderBy(desc(verificationRecords.createdAt)).limit(1);

      if (existingVer.length > 0) {
        await tx.update(verificationRecords).set({
          status: 'VERIFIED',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          reviewNotes: notes || 'Verified and approved by administrator.',
          updatedAt: new Date(),
        }).where(eq(verificationRecords.id, existingVer[0].id));
      } else {
        await tx.insert(verificationRecords).values({
          subjectType: 'PROPERTY',
          subjectId: propertyId,
          propertyId,
          verificationType: 'PROPERTY_TAPU',
          status: 'VERIFIED',
          submittedBy: adminUserId,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          reviewNotes: notes || 'Verified and approved by administrator.',
        });
      }

      // 4. Publish any queued listing
      await tx.update(listings).set({
        status: 'PUBLISHED',
        updatedAt: new Date(),
      }).where(and(
        eq(listings.propertyId, propertyId),
        or(eq(listings.status, 'PENDING_REVIEW'), eq(listings.status, 'DRAFT'))
      ));

      // 5. Send notification to owner
      const owners = await tx.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
      for (const o of owners) {
        if (o.ownerId) {
          await tx.insert(notifications).values({
            userId: o.ownerId,
            propertyId,
            category: 'PROPERTY_VERIFICATION',
            title: 'موڵکەکەت پەسەندکرا | Property Verified',
            message: `موڵکی "${prop.name}" بە سەرکەوتوویی لەلایەن بەڕێوەبەرایەتی پشکنینەوە پەسەندکرا. | Your property "${prop.name}" has been verified and approved.`,
            status: 'SENT',
            read: false,
            priority: 'NORMAL',
            sensitivity: 'NORMAL',
            sourceDomain: 'TRUST_VERIFICATION',
            entityType: 'PROPERTY',
            entityId: propertyId,
          });
        }
      }

      // 6. Audit log
      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles[0] || 'PLATFORM_ADMIN',
        action: 'ADMIN_APPROVE_PROPERTY',
        resourceType: 'Property',
        resourceId: propertyId,
        changes: { verificationStatus: 'VERIFIED', status: 'ACTIVE', notes },
      });

      return updatedProp;
    });
  }

  async rejectProperty(adminUserId: string, adminRoles: string[], propertyId: string, reason: string) {
    const isPlatformAdmin = adminRoles.some(r => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'VERIFICATION_ADMIN', 'PROPERTY_ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
    if (!isPlatformAdmin) {
      throw new Error('FORBIDDEN: Administrative verification permission required.');
    }

    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new Error('VALIDATION_ERROR: Meaningful rejection reason is required.');
    }

    return await db.transaction(async (tx) => {
      const [prop] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (!prop) throw new Error('NOT_FOUND: Property not found.');

      // 1. Update property
      const [updatedProp] = await tx.update(properties).set({
        verificationStatus: 'REJECTED',
        status: 'REJECTED',
        rejectionReason: trimmedReason,
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
        updatedAt: new Date(),
      }).where(eq(properties.id, propertyId)).returning();

      // 2. Update ownership records
      await tx.update(ownershipRecords).set({
        status: 'REJECTED',
      }).where(eq(ownershipRecords.propertyId, propertyId));

      // 3. Update or create verification records
      const existingVer = await tx.select().from(verificationRecords).where(and(
        eq(verificationRecords.propertyId, propertyId),
        eq(verificationRecords.subjectType, 'PROPERTY')
      )).orderBy(desc(verificationRecords.createdAt)).limit(1);

      if (existingVer.length > 0) {
        await tx.update(verificationRecords).set({
          status: 'REJECTED',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: trimmedReason,
          updatedAt: new Date(),
        }).where(eq(verificationRecords.id, existingVer[0].id));
      } else {
        await tx.insert(verificationRecords).values({
          subjectType: 'PROPERTY',
          subjectId: propertyId,
          propertyId,
          verificationType: 'PROPERTY_TAPU',
          status: 'REJECTED',
          submittedBy: adminUserId,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: trimmedReason,
        });
      }

      // 4. Unpublish any listing
      await tx.update(listings).set({
        status: 'DRAFT',
        updatedAt: new Date(),
      }).where(and(
        eq(listings.propertyId, propertyId),
        or(eq(listings.status, 'PUBLISHED'), eq(listings.status, 'PENDING_REVIEW'))
      ));

      // 5. Send notification to owner
      const owners = await tx.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
      for (const o of owners) {
        if (o.ownerId) {
          await tx.insert(notifications).values({
            userId: o.ownerId,
            propertyId,
            category: 'PROPERTY_VERIFICATION',
            title: 'موڵکەکەت ڕەتکرایەوە | Property Verification Rejected',
            message: `موڵکی "${prop.name}" ڕەتکرایەوە بەهۆی: ${trimmedReason} | Property "${prop.name}" was rejected. Reason: ${trimmedReason}`,
            status: 'SENT',
            read: false,
            priority: 'HIGH',
            sensitivity: 'NORMAL',
            sourceDomain: 'TRUST_VERIFICATION',
            entityType: 'PROPERTY',
            entityId: propertyId,
          });
        }
      }

      // 6. Audit log
      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles[0] || 'PLATFORM_ADMIN',
        action: 'ADMIN_REJECT_PROPERTY',
        resourceType: 'Property',
        resourceId: propertyId,
        changes: { verificationStatus: 'REJECTED', status: 'REJECTED', rejectionReason: trimmedReason },
      });

      return updatedProp;
    });
  }

  async resubmitProperty(userId: string, userRoles: string[], propertyId: string) {
    const isPlatformAdmin = userRoles.includes('PLATFORM_ADMIN') || userRoles.includes('SUPER_ADMIN');
    return await db.transaction(async (tx) => {
      const [prop] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (!prop) throw new Error('NOT_FOUND: Property not found.');

      if (!isPlatformAdmin) {
        const ownerRec = await tx.select().from(ownershipRecords).where(and(
          eq(ownershipRecords.propertyId, propertyId),
          eq(ownershipRecords.ownerId, userId)
        )).limit(1);
        if (ownerRec.length === 0) {
          throw new Error('FORBIDDEN: Caller is not the authorized owner of this property.');
        }
      }

      const [updatedProp] = await tx.update(properties).set({
        verificationStatus: 'PENDING_VERIFICATION',
        status: 'PENDING_VERIFICATION',
        rejectionReason: null,
        updatedAt: new Date(),
      }).where(eq(properties.id, propertyId)).returning();

      await tx.update(ownershipRecords).set({
        status: 'PENDING_VERIFICATION',
      }).where(eq(ownershipRecords.propertyId, propertyId));

      await tx.update(listings).set({
        status: 'PENDING_REVIEW',
        updatedAt: new Date(),
      }).where(and(
        eq(listings.propertyId, propertyId),
        eq(listings.status, 'DRAFT')
      ));

      await tx.insert(verificationRecords).values({
        subjectType: 'PROPERTY',
        subjectId: propertyId,
        propertyId,
        verificationType: 'PROPERTY_TAPU',
        status: 'PENDING_VERIFICATION',
        submittedBy: userId,
        submittedAt: new Date(),
        metadata: { resubmission: true },
      });

      await auditService.logAction({
        actorUserId: userId,
        actorRole: userRoles[0] || 'PROPERTY_OWNER',
        action: 'PROPERTY_RESUBMITTED_FOR_VERIFICATION',
        resourceType: 'Property',
        resourceId: propertyId,
        changes: { verificationStatus: 'PENDING_VERIFICATION' },
      });

      return updatedProp;
    });
  }

  async handleMaterialPropertyUpdate(userId: string, userRoles: string[], propertyId: string, updateData: {
    tapuNumber?: string;
    city?: string;
    street?: string;
    squareFeet?: number;
    ownerId?: string;
    description?: string;
    amenities?: string[];
  }) {
    const isPlatformAdmin = userRoles.includes('PLATFORM_ADMIN') || userRoles.includes('SUPER_ADMIN');
    return await db.transaction(async (tx) => {
      const [prop] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (!prop) throw new Error('NOT_FOUND: Property not found.');

      if (!isPlatformAdmin) {
        const ownerRec = await tx.select().from(ownershipRecords).where(and(
          eq(ownershipRecords.propertyId, propertyId),
          eq(ownershipRecords.ownerId, userId)
        )).limit(1);
        if (ownerRec.length === 0) {
          throw new Error('FORBIDDEN: Caller is not the authorized owner of this property.');
        }
      }

      const currentAddr = (prop.address as any) || {};
      const isMaterialChange = Boolean(
        (updateData.tapuNumber && updateData.tapuNumber !== currentAddr.tapuNumber) ||
        (updateData.city && updateData.city !== currentAddr.city) ||
        (updateData.street && updateData.street !== currentAddr.street) ||
        (updateData.squareFeet !== undefined && Number(updateData.squareFeet) !== Number(prop.squareFeet)) ||
        (updateData.ownerId && updateData.ownerId !== userId)
      );

      const nextAddr = {
        ...currentAddr,
        ...(updateData.city ? { city: updateData.city } : {}),
        ...(updateData.street ? { street: updateData.street } : {}),
        ...(updateData.tapuNumber ? { tapuNumber: updateData.tapuNumber } : {}),
        ...(updateData.amenities ? { amenities: updateData.amenities } : {}),
        ...(updateData.description ? { description: updateData.description } : {}),
      };

      const setValues: any = {
        address: nextAddr,
        updatedAt: new Date(),
      };
      if (updateData.squareFeet !== undefined) setValues.squareFeet = updateData.squareFeet;

      // Safe re-review policy: Material changes reset verification to PENDING_VERIFICATION and unpublish active listings
      if (isMaterialChange && prop.verificationStatus === 'VERIFIED') {
        setValues.verificationStatus = 'PENDING_VERIFICATION';
        setValues.status = 'PENDING_VERIFICATION';
        setValues.rejectionReason = null;

        // Unpublish active listing until re-reviewed
        await tx.update(listings).set({
          status: 'PENDING_REVIEW',
          updatedAt: new Date(),
        }).where(and(
          eq(listings.propertyId, propertyId),
          eq(listings.status, 'PUBLISHED')
        ));

        // Create re-review record
        await tx.insert(verificationRecords).values({
          subjectType: 'PROPERTY',
          subjectId: propertyId,
          propertyId,
          verificationType: 'PROPERTY_TAPU',
          status: 'PENDING_VERIFICATION',
          submittedBy: userId,
          submittedAt: new Date(),
          metadata: {
            reason: 'MATERIAL_CHANGE_RE_REVIEW',
            changes: updateData,
          },
        });

        // Notify owner
        await tx.insert(notifications).values({
          userId,
          propertyId,
          category: 'PROPERTY_VERIFICATION',
          title: 'پێویستی بە دووبارە پشکنینەوە هەیە | Re-verification Required',
          message: `بەهۆی گۆڕانکاری گرنگ لە زانیارییەکانی موڵکی "${prop.name}"، پێویستی بە دووبارە پشکنینی کارگێڕییە پێش بڵاوکردنەوە. | Material changes to "${prop.name}" require administrative re-verification.`,
          status: 'SENT',
          priority: 'NORMAL',
          sourceDomain: 'TRUST_VERIFICATION',
          entityType: 'PROPERTY',
          entityId: propertyId,
        });
      }

      const [updatedProp] = await tx.update(properties).set(setValues).where(eq(properties.id, propertyId)).returning();

      await auditService.logAction({
        actorUserId: userId,
        actorRole: userRoles[0] || 'PROPERTY_OWNER',
        action: isMaterialChange ? 'PROPERTY_MATERIAL_UPDATE_RE_REVIEW' : 'PROPERTY_UPDATE',
        resourceType: 'Property',
        resourceId: propertyId,
        changes: { updateData, isMaterialChange },
      });

      return {
        property: updatedProp,
        isMaterialChange,
        reReviewTriggered: isMaterialChange && prop.verificationStatus === 'VERIFIED',
      };
    });
  }
}

export const propertyRepository = new PropertyRepository();

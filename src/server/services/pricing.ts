import { db } from '../../db/index.js';
import { pricingTiers, ownershipRecords } from '../../db/schema.js';
import { eq, and, sql, asc } from 'drizzle-orm';

export class PricingService {
  async resolveTierForOwner(ownerId: string) {
    // 1. Get authoritative property count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(ownershipRecords)
      .where(and(eq(ownershipRecords.ownerId, ownerId), eq(ownershipRecords.status, 'VERIFIED')));
      
    const propertyCount = Number(countResult[0]?.count || 0);

    // 2. Fetch active tiers ordered by priority
    const tiers = await db.select().from(pricingTiers).where(eq(pricingTiers.isActive, true)).orderBy(asc(pricingTiers.priority));

    // 3. Resolve tier
    let resolvedTier = null;
    for (const tier of tiers) {
      const min = tier.minProperties;
      const max = tier.maxProperties;
      if (propertyCount >= min && (max === null || propertyCount <= max)) {
        resolvedTier = tier;
        break;
      }
    }

    return {
      propertyCount,
      tier: resolvedTier
    };
  }
}

export const pricingService = new PricingService();

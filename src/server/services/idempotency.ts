import crypto from 'crypto';

export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IdempotencyValidationResult {
  valid: boolean;
  key?: string;
  error?: string;
}

/**
 * Validates the Idempotency-Key header or property.
 * Constraints:
 * - Must be a string
 * - Non-empty after trimming
 * - Maximum length 255 characters
 */
export function validateIdempotencyKey(key?: unknown): IdempotencyValidationResult {
  if (key === undefined || key === null) {
    return { valid: false, error: 'Idempotency key is required.' };
  }

  if (typeof key !== 'string') {
    return { valid: false, error: 'Idempotency-Key must be a string.' };
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Idempotency-Key cannot be empty or whitespace only.' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Idempotency-Key length cannot exceed 255 characters.' };
  }

  return { valid: true, key: trimmed };
}

/**
 * Normalizes semantically relevant property creation payload fields into a deterministic structure.
 * Ignores ephemeral/volatile data and field ordering to prevent unstable fingerprints.
 */
export function normalizePropertyCreationPayload(payload: any): Record<string, any> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const type = typeof payload.type === 'string' ? payload.type.trim().toUpperCase() : '';

  // Extract resolved city
  let city = '';
  if (typeof payload.city === 'string' && payload.city.trim()) {
    city = payload.city.trim();
  } else if (payload.address && typeof payload.address === 'object' && typeof payload.address.city === 'string' && payload.address.city.trim()) {
    city = payload.address.city.trim();
  }

  // Normalize address
  let address: Record<string, any> | null = null;
  if (payload.address && typeof payload.address === 'object' && !Array.isArray(payload.address)) {
    address = {
      city: city || (typeof payload.address.city === 'string' ? payload.address.city.trim() : ''),
      country: typeof payload.address.country === 'string' && payload.address.country.trim() ? payload.address.country.trim() : 'Iraq',
      region: typeof payload.address.region === 'string' && payload.address.region.trim() ? payload.address.region.trim() : 'Kurdistan',
      street: typeof payload.address.street === 'string' ? payload.address.street.trim() : '',
      state: typeof payload.address.state === 'string' ? payload.address.state.trim() : '',
      zip: typeof payload.address.zip === 'string' ? payload.address.zip.trim() : '',
      lat: payload.address.lat !== undefined && payload.address.lat !== null && !isNaN(Number(payload.address.lat)) ? Number(payload.address.lat) : null,
      lng: payload.address.lng !== undefined && payload.address.lng !== null && !isNaN(Number(payload.address.lng)) ? Number(payload.address.lng) : null,
    };
  }

  // Normalize listingType & price
  let listingType: string | null = null;
  if (payload.listingType !== undefined && payload.listingType !== null && (payload.listingType as any) !== '') {
    listingType = typeof payload.listingType === 'string' ? payload.listingType.trim().toUpperCase() : String(payload.listingType);
  }

  let price: number | null = null;
  if (payload.price !== undefined && payload.price !== null && (payload.price as any) !== '') {
    const parsedPrice = Number(payload.price);
    if (!isNaN(parsedPrice)) {
      price = parsedPrice;
    }
  }

  const currency = typeof payload.currency === 'string' && payload.currency.trim()
    ? payload.currency.trim().toUpperCase()
    : 'IQD';

  let squareFeet: number | null = null;
  if (payload.squareFeet !== undefined && payload.squareFeet !== null && (payload.squareFeet as any) !== '') {
    const parsedSqft = Number(payload.squareFeet);
    if (!isNaN(parsedSqft)) {
      squareFeet = Math.round(parsedSqft);
    }
  }

  let yearBuilt: number | null = null;
  if (payload.yearBuilt !== undefined && payload.yearBuilt !== null && (payload.yearBuilt as any) !== '') {
    const parsedYb = Number(payload.yearBuilt);
    if (!isNaN(parsedYb)) {
      yearBuilt = Math.round(parsedYb);
    }
  }

  const operatingModel = typeof payload.operatingModel === 'string' && payload.operatingModel.trim()
    ? payload.operatingModel.trim().toUpperCase()
    : null;

  let rentFee: number | null = null;
  if (payload.rentFee !== undefined && payload.rentFee !== null && (payload.rentFee as any) !== '') {
    const parsedRf = Number(payload.rentFee);
    if (!isNaN(parsedRf)) rentFee = parsedRf;
  }

  let managementFee: number | null = null;
  if (payload.managementFee !== undefined && payload.managementFee !== null && (payload.managementFee as any) !== '') {
    const parsedMf = Number(payload.managementFee);
    if (!isNaN(parsedMf)) managementFee = parsedMf;
  }

  let ownershipPercentage: string | null = null;
  if (payload.ownershipPercentage !== undefined && payload.ownershipPercentage !== null && (payload.ownershipPercentage as any) !== '') {
    const parsedOp = Number(payload.ownershipPercentage);
    if (!isNaN(parsedOp)) {
      ownershipPercentage = parsedOp.toFixed(2);
    }
  }

  const ownerId = typeof payload.ownerId === 'string' && payload.ownerId.trim() ? payload.ownerId.trim() : null;
  const companyId = typeof payload.companyId === 'string' && payload.companyId.trim() ? payload.companyId.trim() : null;
  const managedByAgentId = typeof payload.managedByAgentId === 'string' && payload.managedByAgentId.trim() ? payload.managedByAgentId.trim() : null;
  const listedByAgentId = typeof payload.listedByAgentId === 'string' && payload.listedByAgentId.trim() ? payload.listedByAgentId.trim() : null;
  const description = typeof payload.description === 'string' && payload.description.trim() ? payload.description.trim() : null;

  const amenities = Array.isArray(payload.amenities)
    ? payload.amenities.filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim()).sort()
    : [];

  const photos = Array.isArray(payload.photos)
    ? payload.photos.filter((p: any) => typeof p === 'string' && p.trim()).map((p: string) => p.trim())
    : [];

  return {
    address,
    amenities,
    city,
    companyId,
    currency,
    description,
    listedByAgentId,
    listingType,
    managedByAgentId,
    managementFee,
    name,
    operatingModel,
    ownerId,
    ownershipPercentage,
    photos,
    price,
    rentFee,
    squareFeet,
    type,
    yearBuilt,
  };
}

/**
 * Computes a deterministic SHA-256 hash of a normalized payload.
 */
export function computePayloadHash(normalizedPayload: Record<string, any>): string {
  // Sort keys deterministically
  const sortedKeys = Object.keys(normalizedPayload).sort();
  const sortedObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    sortedObj[k] = normalizedPayload[k];
  }
  return crypto.createHash('sha256').update(JSON.stringify(sortedObj)).digest('hex');
}

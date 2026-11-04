const fs = require('fs');
const file = 'src/pages/HomePage.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldTarget = `  const fetchSponsored = useCallback(async () => {
    setSponsoredLoading(true);
    setSponsoredError(null);
    try {
      const res = await fetch('/api/promotions/placements/HOMEPAGE?limit=4');
      if (!res.ok) throw new Error(\`HTTP_\${res.status}\`);
      const data = await res.json();
      const items: PlacementResponseItem[] = Array.isArray(data.items) ? data.items : [];

      const mapped: ListingItem[] = items.map((p) => ({
        id: p.listing.id,
        propertyId: p.listing.propertyId,
        type: 'FOR_RENT',
        price: p.listing.price,
        currency: p.listing.currency || 'USD',
        title: p.listing.title,
        description: p.listing.description,
        status: p.listing.status,
        createdAt: p.listing.createdAt,
        isPromoted: true,
        promotionType: p.campaignType,
        property: p.property || {
          id: p.listing.propertyId,
          name: p.listing.title,
          type: 'APARTMENT',
          city: 'Erbil',
          verificationStatus: 'VERIFIED',
          bedrooms: 2,
          bathrooms: 2,
          squareFeet: 120,
        },
      }));

      setSponsoredListings(mapped);
    } catch (err: any) {
      console.warn('[HomePage] Sponsored fetch error:', err?.message);
      setSponsoredError(err?.message || 'Error fetching sponsored properties');
      setSponsoredListings([]);
    } finally {
      setSponsoredLoading(false);
    }
  }, []);`;

const newTarget = `  const fetchSponsored = useCallback(async (isRetry = false) => {
    setSponsoredLoading(true);
    setSponsoredError(null);
    try {
      const res = await fetch('/api/promotions/placements/HOMEPAGE?limit=4');
      if (!res.ok) {
        if (!isRetry && res.status >= 500) {
          setTimeout(() => fetchSponsored(true), 1200);
          return;
        }
        throw new Error(\`HTTP_\${res.status}\`);
      }
      const data = await res.json();
      const items: PlacementResponseItem[] = Array.isArray(data.items) ? data.items : [];

      const mapped: ListingItem[] = items.map((p) => ({
        id: p.listing.id,
        propertyId: p.listing.propertyId,
        type: 'FOR_RENT',
        price: p.listing.price,
        currency: p.listing.currency || 'USD',
        title: p.listing.title,
        description: p.listing.description,
        status: p.listing.status,
        createdAt: p.listing.createdAt,
        isPromoted: true,
        promotionType: p.campaignType,
        property: p.property || {
          id: p.listing.propertyId,
          name: p.listing.title,
          type: 'APARTMENT',
          city: 'Erbil',
          verificationStatus: 'VERIFIED',
          bedrooms: 2,
          bathrooms: 2,
          squareFeet: 120,
        },
      }));

      setSponsoredListings(mapped);
      setSponsoredLoading(false);
    } catch (err: any) {
      if (!isRetry) {
        setTimeout(() => fetchSponsored(true), 1200);
        return;
      }
      console.warn('[HomePage] Sponsored fetch error:', err?.message);
      setSponsoredError(err?.message || 'Error fetching sponsored properties');
      setSponsoredListings([]);
      setSponsoredLoading(false);
    }
  }, []);`;

const oldRentals = `  const fetchNewestRentals = useCallback(async () => {
    setNewestLoading(true);
    setNewestError(null);
    try {
      let queryUrl = '/api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=4&sortBy=createdAt&sortOrder=desc';
      if (propertyTypeFilter !== 'all') {
        queryUrl += \`&propertyType=\${propertyTypeFilter}\`;
      }
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(\`HTTP_\${res.status}\`);
      const data = await res.json();
      const items: ListingItem[] = Array.isArray(data.items) ? data.items : [];
      setNewestRentals(items);
    } catch (err: any) {
      console.warn('[HomePage] Newest rentals fetch error:', err?.message);
      setNewestError(err?.message || 'Error fetching newest rentals');
      setNewestRentals([]);
    } finally {
      setNewestLoading(false);
    }
  }, [propertyTypeFilter]);`;

const newRentals = `  const fetchNewestRentals = useCallback(async (isRetry = false) => {
    setNewestLoading(true);
    setNewestError(null);
    try {
      let queryUrl = '/api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=4&sortBy=createdAt&sortOrder=desc';
      if (propertyTypeFilter !== 'all') {
        queryUrl += \`&propertyType=\${propertyTypeFilter}\`;
      }
      const res = await fetch(queryUrl);
      if (!res.ok) {
        if (!isRetry && res.status >= 500) {
          setTimeout(() => fetchNewestRentals(true), 1200);
          return;
        }
        throw new Error(\`HTTP_\${res.status}\`);
      }
      const data = await res.json();
      const items: ListingItem[] = Array.isArray(data.items) ? data.items : [];
      setNewestRentals(items);
      setNewestLoading(false);
    } catch (err: any) {
      if (!isRetry) {
        setTimeout(() => fetchNewestRentals(true), 1200);
        return;
      }
      console.warn('[HomePage] Newest rentals fetch error:', err?.message);
      setNewestError(err?.message || 'Error fetching newest rentals');
      setNewestRentals([]);
      setNewestLoading(false);
    }
  }, [propertyTypeFilter]);`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOldTarget = oldTarget.replace(/\r\n/g, '\n');
const normalizedOldRentals = oldRentals.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOldTarget) && normalizedContent.includes(normalizedOldRentals)) {
  let updated = normalizedContent.replace(normalizedOldTarget, newTarget);
  updated = updated.replace(normalizedOldRentals, newRentals);
  fs.writeFileSync(file, updated, 'utf8');
  console.log('Successfully updated HomePage.tsx with retry resilience');
} else {
  console.log('Could not match target blocks in HomePage.tsx');
}

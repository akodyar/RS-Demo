# HomeHub — Rental Property Search Source and Implementation Audit

**Audit Date**: 2026-10-30  
**Target Environment**: Local PostgreSQL (`homehub_test`) on `localhost:5432` | Web Server (`http://localhost:3000`)  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Scope**: Rental Property Search, Navigation Categories, More Dropdown, Filter Form, Search Execution, and Backend Integration.

---

## 1. Relevant Source Files

| File Path | Role & Architecture Responsibility |
|---|---|
| [`src/pages/HomePage.tsx`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/pages/HomePage.tsx) | Main landing page: renders the hero section, floating property search bar, primary category tabs, the "More" dropdown for Other Rental Types, and live newest rentals stream. |
| [`src/pages/SearchExplorerPage.tsx`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/pages/SearchExplorerPage.tsx) | Full-page search explorer (`/rentals`, `/rent`, `/marketplace`): faceted filters, price sliders, bedrooms filter, city filter, and grid/map toggles. |
| [`src/pages/RentalsPage.tsx`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/pages/RentalsPage.tsx) | Wrapper component mounting `SearchExplorerPage` with `domainMode="rent-only"` and `defaultDomain="rent"`. |
| [`src/server/routes/marketplace.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/server/routes/marketplace.ts) | Public marketplace routes: `GET /api/marketplace/listings/search` enforcing strict domain separation (`?type=RENT`). |
| [`src/server/repositories/promotion-campaign.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/server/repositories/promotion-campaign.ts) | Core query repository: executes SQL filtering for `searchRentalListings` over `listings`, `properties`, and `ownership_records`. |
| [`src/db/schema.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/db/schema.ts) | Authoritative PostgreSQL Drizzle ORM schema defining `properties`, `listings`, `ownership_records`, and `users`. |
| [`src/i18n/I18nProvider.tsx`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20(1)/src/i18n/I18nProvider.tsx) | Centralized multilingual dictionary supporting Kurdish Sorani (`ku`, RTL primary), Arabic (`ar`, RTL), and English (`en`, LTR). |

---

## 2. API Endpoints & Contract Verification

### 2.1 `GET /api/marketplace/listings/search`
- **Route**: `src/server/routes/marketplace.ts` lines 64–96
- **Parameters**:
  - `type` (required): `'RENT'` or `'FOR_RENT'` (strict domain validation; `'SALE'` blocked when `BUY_SELL_ENABLED` is false).
  - `propertyType` (optional string): filters properties by type.
  - `minPrice` (optional number): minimum monthly rent in USD.
  - `maxPrice` (optional number): maximum monthly rent in USD.
  - `limit` (optional integer): page size (default 20, max 100).
  - `offset` (optional integer): pagination offset.
  - `asOf` (optional ISO timestamp): effective timestamp for active promotional placements.
  - `placement` (optional string): `'SEARCH'` or `'HOMEPAGE'`.
- **Backend SQL Invariants**:
  - `listings.status = 'PUBLISHED'`
  - `properties.verificationStatus = 'VERIFIED'`
  - `listings.type = 'FOR_RENT'`
  - `EXISTS (SELECT 1 FROM ownership_records WHERE property_id = properties.id AND status = 'VERIFIED')`
  - Substring matching for type: `LOWER(properties.type) LIKE '%' || LOWER(propertyType) || '%'`

### 2.2 `GET /api/promotions/placements/HOMEPAGE`
- **Route**: `src/server/routes/promotions.ts`
- **Parameters**: `limit=4`
- **Function**: Returns active promoted rental placements for the homepage hero showcase.

---

## 3. Database Schema & Fields

### Table: `properties`
- `id` (text, PK): UUID primary key
- `name` (text, notNull): descriptive title of property
- `type` (text, notNull): property classification enum/string
- `address` (jsonb): contains `city`, `neighborhood`, `area`, `street`, `bedrooms`, `bathrooms`, `photos`, `amenities`
- `squareFeet` (integer): total area
- `status` (text): e.g. `'ACTIVE'`, `'DRAFT'`, `'VERIFIED'`
- `verificationStatus` (text, notNull): `'VERIFIED'` (mandatory for marketplace discovery)

### Table: `listings`
- `id` (text, PK): UUID primary key
- `propertyId` (text, FK -> `properties.id`): linked property
- `publisherUserId` (text, FK -> `users.id`): publisher identity
- `type` (text, notNull): `'FOR_RENT'` (active release is RENTAL ONLY)
- `price` (decimal, notNull): monthly rent rate
- `currency` (text): `'USD'` or `'IQD'`
- `status` (text): `'PUBLISHED'` (mandatory for marketplace discovery)
- `title` (text, notNull): listing display headline
- `description` (text): detailed property overview

### Table: `ownership_records`
- `id` (text, PK): UUID primary key
- `propertyId` (text, FK -> `properties.id`): linked property
- `ownerId` (text, FK -> `users.id`): verified property owner
- `ownershipPercentage` (decimal): ownership share (typically 100%)
- `status` (text): `'VERIFIED'` (strict safety gate: unverified properties are excluded from discovery)

---

## 4. UI Categories & Property-Type Mapping Matrix

| Navigation Tab / Option | UI Label (EN) | UI Label (KU) | Filter Parameter Value (`propertyType`) | Backend SQL Match |
|---|---|---|---|---|
| Main Tab 1 | All Properties | هەموو موڵکەکان | `'all'` (omitted from query) | Matches all rental properties |
| Main Tab 2 | Apartments | شوقەکان | `'APARTMENT'` | `LOWER(properties.type) LIKE '%apartment%'` |
| Main Tab 3 | Houses | خانووەکان | `'HOUSE'` | `LOWER(properties.type) LIKE '%house%'` |
| Main Tab 4 | Villas | ڤێلاکان | `'VILLA'` | `LOWER(properties.type) LIKE '%villa%'` |
| Main Tab 5 | Commercial | بازرگانی | `'COMMERCIAL'` | `LOWER(properties.type) LIKE '%commercial%'` |
| More Item 1 | Studio Apartment | شوقەی ستۆدیۆ | `'STUDIO'` | `LOWER(properties.type) LIKE '%studio%'` |
| More Item 2 | Office Space | ئۆفیس و نووسینگە | `'OFFICE'` | `LOWER(properties.type) LIKE '%office%'` |
| More Item 3 | Warehouse & Storage | کۆگا و عەمبار | `'WAREHOUSE'` | `LOWER(properties.type) LIKE '%warehouse%'` |
| More Item 4 | Duplex | دۆپلێکس | `'DUPLEX'` | `LOWER(properties.type) LIKE '%duplex%'` |
| More Item 5 | Residential Building | باڵەخانەی نیشتەجێبوون | `'RESIDENTIAL'` | `LOWER(properties.type) LIKE '%residential%'` |

---

## 5. Filter Controls & Parameter Serialization

### Location Input:
- Element: `input#search-location-input`
- Placeholder: `t('home.filter_location_ph', 'Enter city or area')`
- State: `locationInput`
- Serialization: `?q=${locationInput}`

### Property Type Select:
- Element: `select#search-type-select`
- Options: `all`, `APARTMENT`, `HOUSE`, `VILLA`, `COMMERCIAL`, `STUDIO`, `OFFICE`, `WAREHOUSE`, `DUPLEX`, `RESIDENTIAL`
- Serialization: `?propertyType=${propertyTypeFilter}`

### Monthly Rent Select:
- Element: `select#search-rent-select`
- Options:
  - `all`: Any price range
  - `under-500`: Under $500
  - `500-1000`: $500 - $1,000
  - `1000-2000`: $1,000 - $2,000
  - `2000-plus`: $2,000+
- Serialization: `?priceRange=${priceRangeFilter}`

### Bedrooms Select:
- Element: `select#search-bedrooms-select`
- Options:
  - `all`: Any number
  - `1`: 1+ Bedroom
  - `2`: 2+ Bedrooms
  - `3`: 3+ Bedrooms
  - `4-plus`: 4+ Bedrooms
- Serialization: `?bedrooms=${bedroomsFilter}`

---

## 6. Identified Gaps & Defect Log (Pre-Fix Audit)

1. **Defect D-01: Disconnected Query Binding in SearchExplorerPage (`/rentals`)**:
   - *Severity*: High
   - *Finding*: When a user fills in the Homepage search bar and clicks "Search", `HomePage` navigates to `/rentals?q=...&propertyType=...&priceRange=...&bedrooms=...`. However, `SearchExplorerPage` did not import or read `useSearchParams`, causing all submitted parameters to be dropped and displaying the default un-filtered list instead.
2. **Defect D-02: Missing Subtype Filtering in SearchExplorerPage**:
   - *Severity*: Medium
   - *Finding*: `SearchExplorerPage` hardcoded category tabs to only `apartments` and `villas`, completely omitting `commercial`, `studio`, `office`, `warehouse`, and `duplex`.
3. **Defect D-03: Lack of Zero-Result and Boundary Tolerance in Type Queries**:
   - *Severity*: Medium
   - *Finding*: If a category returns 0 records, the UI previously had inconsistent fallback messages.


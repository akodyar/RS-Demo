import React from 'react';
import { SearchExplorerPage } from './SearchExplorerPage';

/**
 * RentalsPage — Dedicated Public Rental Browsing & Search Route (/rentals)
 * 
 * Invariants enforced:
 * 1. domainMode="rent-only" strictly enforces RENT listings only (SALE completely excluded).
 * 2. URL search parameters (?city=...&q=...) from the public landing hero are seamlessly bound.
 * 3. Real database records are displayed with honest loading, empty, and degraded-mode states.
 */
export const RentalsPage: React.FC = () => {
  return <SearchExplorerPage domainMode="rent-only" defaultDomain="rent" />;
};

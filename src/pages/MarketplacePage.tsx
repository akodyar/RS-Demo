import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';

/**
 * MarketplacePage — Backward-Compatible Legacy Redirect to Canonical /rentals Route
 * 
 * Invariants enforced:
 * 1. Canonical Route: /rentals (RentalsPage / SearchExplorerPage with domainMode="rent-only").
 * 2. Backward Compatibility: Preserves legacy bookmarks, external links, and deep navigation.
 * 3. Query Parameter Preservation: Preserves location.search (?city=...&q=...&category=...) across the redirect.
 * 4. Loop Prevention: Performs a replace redirect directly to canonical /rentals, preventing circular navigation.
 */
export const MarketplacePage: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/rentals${location.search}`} replace />;
};

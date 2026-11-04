/**
 * HomeHub — Company Dashboard / Workspace Page Alias
 *
 * Canonical implementation is maintained in src/pages/CompanyWorkspace.tsx.
 * This file serves as an alias/re-export to ensure 100% compatibility with any
 * route or test import referencing CompanyDashboard.tsx.
 */

import { CompanyWorkspacePage } from './CompanyWorkspace';

export const CompanyDashboardPage = CompanyWorkspacePage;
export const CompanyDashboard = CompanyWorkspacePage;
export default CompanyWorkspacePage;
export { CompanyWorkspacePage };

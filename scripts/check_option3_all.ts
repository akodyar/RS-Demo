import fs from 'fs';
import path from 'path';

const workspaces = [
  'src/pages/AccountantWorkspace.tsx',
  'src/pages/AdminTrustWorkspace.tsx',
  'src/pages/AgentWorkspace.tsx',
  'src/pages/AutopilotWorkspace.tsx',
  'src/pages/BuyerWorkspace.tsx',
  'src/pages/CompanyCRMWorkspace.tsx',
  'src/pages/CompanyIntelligenceWorkspace.tsx',
  'src/pages/CompanyWorkspace.tsx',
  'src/pages/IntegrationsAdminWorkspace.tsx',
  'src/pages/MaintenanceWorkspacePage.tsx',
  'src/pages/OwnerWorkspace.tsx',
  'src/pages/PlatformAdminWorkspace.tsx',
  'src/pages/PortfolioWorkspacePage.tsx',
  'src/pages/TenantWorkspace.tsx',
  'src/pages/VendorWorkspace.tsx',
];

console.log('=== OPTION 3 COMPLIANCE AUDIT ===');
for (const ws of workspaces) {
  if (!fs.existsSync(ws)) {
    console.log(`[MISSING FILE] ${ws}`);
    continue;
  }
  const content = fs.readFileSync(ws, 'utf8');
  const hasAside = content.includes('<aside') || content.includes('VendorSidebar');
  const hasRailStyle = content.includes('w-20') || content.includes('w-22') || content.includes('w-16') || content.includes('shrink-0');
  const hasMinimalHeader = content.includes('<header') || content.includes('VendorHeader') || content.includes('CompanyTopBar') || content.includes('TenantHeader') || content.includes('AdminHeader');

  // Check if there is an old horizontal nav bar with multiple top-level tabs
  const hasOldHorizontalNav = content.includes('flex overflow-x-auto') && content.includes('<header');

  console.log(`${ws}:`);
  console.log(`  - Has Sidebar Rail / Aside: ${hasAside} (Rail styling: ${hasRailStyle})`);
  console.log(`  - Has Minimal Header: ${hasMinimalHeader}`);
  console.log(`  - Has Old Horizontal Nav in Header: ${hasOldHorizontalNav}`);
}

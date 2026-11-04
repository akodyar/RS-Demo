const fs = require('fs');

let content = fs.readFileSync('src/server/services/audit.ts', 'utf8');

// Replace actorRole: UserRole | CompanyRole with string
content = content.replace(/actorRole: UserRole \| CompanyRole;/g, 'actorRole: string;');
content = content.replace(/ipAddress\?: string;/g, 'ipAddress?: string | string[];');

fs.writeFileSync('src/server/services/audit.ts', content);

// Also fix the Express Request types and VendorWorkspace.tsx
let expressType = fs.readFileSync('src/types/express.d.ts', 'utf8');
expressType = expressType.replace(/companyId\?: string;/g, 'companyId?: string;\n        organizationId?: string;');
fs.writeFileSync('src/types/express.d.ts', expressType);

let vendor = fs.readFileSync('src/pages/VendorWorkspace.tsx', 'utf8');
vendor = vendor.replace(/Pen,/g, 'PenTool,');
fs.writeFileSync('src/pages/VendorWorkspace.tsx', vendor);


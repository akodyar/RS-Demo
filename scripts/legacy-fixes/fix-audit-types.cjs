const fs = require('fs');

let content = fs.readFileSync('src/types/index.ts', 'utf8');

// Fix AuditLog to accept string for actorRole
content = content.replace(/actorRole: UserRole \| CompanyRole;/g, 'actorRole: string;');
content = content.replace(/ipAddress\?: string;/g, 'ipAddress?: string | string[];');

fs.writeFileSync('src/types/index.ts', content);


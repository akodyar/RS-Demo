const fs = require('fs');

let content = fs.readFileSync('src/server/middleware/auth.ts', 'utf8');

// Replace AuthenticatedRequest with Request
content = content.replace(/AuthenticatedRequest/g, 'Request');

// Remove the interface declaration
content = content.replace(/export interface Request extends Request \{[\s\S]*?\n\}/, '');

fs.writeFileSync('src/server/middleware/auth.ts', content);


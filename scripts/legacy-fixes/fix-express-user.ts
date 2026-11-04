import fs from 'fs';

let content = fs.readFileSync('src/types/index.ts', 'utf8');

// Remove duplicate AIActionStatus (second one around line 1429)
content = content.replace(/export interface AIAction extends BaseEntity \{[\s\S]*?status: 'PROPOSED' | 'VALIDATING' | 'PENDING_APPROVAL' | 'PENDING_AUTHORITY' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';/g, (match, offset) => {
    return offset > 1000 ? match.replace(/status: 'PROPOSED' | 'VALIDATING' | 'PENDING_APPROVAL' | 'PENDING_AUTHORITY' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';/, 'status: AIActionStatus;') : match;
});

// Actually, wait, it says "Property 'status' must be of type 'AIActionStatus', but here has type '"BLOCKED" | "COMPLETED" | ..."'
// I should just make it `status: AIActionStatus;`

fs.writeFileSync('src/types/index.ts', content);


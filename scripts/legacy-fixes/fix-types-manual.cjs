const fs = require('fs');

let content = fs.readFileSync('src/types/index.ts', 'utf8');

// Fix line 336
content = content.replace(/status: 'TODO' \| 'IN_PROGRESS' \| 'BLOCKED' \|status: AIActionStatus;\| 'CANCELLED';/g, "status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';");

// Fix line 631
content = content.replace(/status: 'PENDING' \| 'PAID' \| 'FAILED' \|status: AIActionStatus;\| 'REFUNDED';/g, "status: 'PENDING' | 'PAID' | 'FAILED' | 'VOID' | 'REFUNDED';");

// Fix line 1429
content = content.replace(/status: 'PROPOSED' \| 'VALIDATING' \| 'PENDING_APPROVAL' \| 'PENDING_AUTHORITY' \| 'EXECUTING' \|status: AIActionStatus;\| 'FAILED' \| 'BLOCKED';/g, "status: AIActionStatus;");

// Fix line 1436
content = content.replace(/status: 'PENDING' \| 'APPROVED' \| 'REJECTED' \|status: AIActionStatus;\| 'REVOKED';/g, "status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';");

fs.writeFileSync('src/types/index.ts', content);


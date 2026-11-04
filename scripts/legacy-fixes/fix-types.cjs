const fs = require('fs');

const file = 'src/types/index.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove duplicate LeadStatus (second one around line 1050)
content = content.replace(/export enum LeadStatus \{[\s\S]*?CLOSED = 'CLOSED'\n\}/g, (match, offset) => {
    return offset > 1000 ? '' : match; // Only keep the first one
});

// For PropertyTimelineEvent, let's just keep the first one and remove the second one.
content = content.replace(/export interface PropertyTimelineEvent extends BaseEntity \{[\s\S]*?metadata\?: Record<string, any>;\n\}/g, (match, offset) => {
    return offset > 1000 ? '' : match;
});

// There is also AIActionStatus redefined around 1460? Wait, let's grep AIActionStatus
fs.writeFileSync(file, content);

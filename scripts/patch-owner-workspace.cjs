const fs = require('fs');

let c = fs.readFileSync('src/pages/OwnerWorkspace.tsx', 'utf8');

// 1. Add data-testid="owner-nav-properties" to the properties button
const pBtn = `onClick={() => setActiveTab('properties')}`;
if (!c.includes(pBtn)) {
  console.error('Properties button onClick not found!');
  process.exit(1);
}
c = c.replace(pBtn, `data-testid="owner-nav-properties"\n                ${pBtn}`);

// 2. Render managingAgencyName in property details
const typeDiv = `{prop.type || 'Residential'}`;
if (!c.includes(typeDiv)) {
  console.error('Property type div not found!');
  process.exit(1);
}
c = c.replace(
  typeDiv,
  `{prop.type || 'Residential'}
                                    {prop.managingAgencyName && (
                                      <span className="text-blue-600 font-semibold" data-testid="prop-managing-agency">
                                        {' '}• {prop.managingAgencyName}
                                      </span>
                                    )}`
);

fs.writeFileSync('src/pages/OwnerWorkspace.tsx', c, 'utf8');
console.log('Successfully updated OwnerWorkspace.tsx');

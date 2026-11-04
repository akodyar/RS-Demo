const fs = require('fs');

let c = fs.readFileSync('src/pages/OwnerWorkspace.tsx', 'utf8');

// 1. Add import
if (!c.includes("import { OwnerUtilityBills }")) {
  c = c.replace(
    "import { DepositInspectionModal } from '../components/owner/DepositInspectionModal';",
    "import { DepositInspectionModal } from '../components/owner/DepositInspectionModal';\nimport { OwnerUtilityBills } from '../components/owner/OwnerUtilityBills';"
  );
}

// 2. Update nav button text to include Earnings
c = c.replace(
  ": 'Accounting')",
  ": 'Accounting / Earnings')"
);

// 3. Render OwnerUtilityBills in rent collection ledger
const oldRowStart = `return (\n                          <tr key={prop.id}`;
const oldRowStartCRLF = `return (\r\n                          <tr key={prop.id}`;

const targetNeedle = c.includes(oldRowStartCRLF) ? oldRowStartCRLF : oldRowStart;

if (c.includes(targetNeedle)) {
  c = c.replace(
    targetNeedle,
    `return (\n                          <React.Fragment key={prop.id}>\n                          <tr key={prop.id}`
  );
  
  const oldRowEnd = `                          </tr>\n                        );\n                      })`;
  const oldRowEndCRLF = `                          </tr>\r\n                        );\r\n                      })`;
  const endNeedle = c.includes(oldRowEndCRLF) ? oldRowEndCRLF : oldRowEnd;
  
  if (c.includes(endNeedle)) {
    c = c.replace(
      endNeedle,
      `                          </tr>\n                          <tr>\n                            <td colSpan={7} className="px-4 py-0 border-none">\n                              <OwnerUtilityBills propertyId={prop.id} />\n                            </td>\n                          </tr>\n                          </React.Fragment>\n                        );\n                      })`
    );
  }
}

fs.writeFileSync('src/pages/OwnerWorkspace.tsx', c, 'utf8');
console.log('Successfully patched OwnerWorkspace.tsx with OwnerUtilityBills');

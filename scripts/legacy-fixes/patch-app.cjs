const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');
if (!s.includes('CompanyWorkspacePage')) {
  s = s.replace("import { CompanyCRMWorkspacePage }", "import { CompanyWorkspacePage } from './pages/CompanyWorkspace';\nimport { CompanyCRMWorkspacePage }");
  s = s.replace("<Route path=\"workspace/company\" element={<CompanyCRMWorkspacePage />} />", "<Route path=\"workspace/company\" element={<CompanyWorkspacePage />} />\n            <Route path=\"workspace/company/crm\" element={<CompanyCRMWorkspacePage />} />");
  fs.writeFileSync('src/App.tsx', s);
}

const fs = require('fs');
let s = fs.readFileSync('src/pages/TenantWorkspace.tsx', 'utf8');

if (!s.includes('useNavigate')) {
  s = s.replace(
    "import { useAuth } from '../components/AuthProvider';",
    "import { useAuth } from '../components/AuthProvider';\nimport { useNavigate } from 'react-router-dom';"
  );
  s = s.replace(
    "export const TenantWorkspacePage: React.FC = () => {",
    "export const TenantWorkspacePage: React.FC = () => {\n  const navigate = useNavigate();"
  );
  fs.writeFileSync('src/pages/TenantWorkspace.tsx', s);
}

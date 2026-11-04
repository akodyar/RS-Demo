const fs = require('fs');
const path = require('path');

let auth = fs.readFileSync('src/server/middleware/auth.ts', 'utf8');
auth = auth.replace(/allowedRoles\.includes\(role\)/g, 'allowedRoles.includes(role as UserRole)');
fs.writeFileSync('src/server/middleware/auth.ts', auth);

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
    let file = path.join(dir, f);
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/ipAddress: req\.ip/g, 'ipAddress: req.ip || ""');
    fs.writeFileSync(file, content);
});

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
    let file = path.join(dir, f);
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/actorRole: req\.user!\.roles\[0\],/g, 'actorRole: req.user!.roles[0] as string,');
    content = content.replace(/ipAddress: req\.ip \|\| ""/g, 'ipAddress: (req.ip || "") as string');
    // also replace actorRole: req.user!.roles[0] as string as string just in case
    content = content.replace(/actorRole: req\.user!\.roles\[0\] as string as string,/g, 'actorRole: req.user!.roles[0] as string,');
    fs.writeFileSync(file, content);
});

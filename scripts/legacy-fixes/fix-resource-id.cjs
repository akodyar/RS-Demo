const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
    let file = path.join(dir, f);
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/resourceId:\s*([a-zA-Z0-9_]+),/g, 'resourceId: $1 as string,');
    fs.writeFileSync(file, content);
});

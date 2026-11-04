const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  
  // Every time we see res.status(501)... followed by router. or export, we insert });
  content = content.replace(/res\.status\(501\)\.json\(\{ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" \}\);\s*(router\.|export)/g, 
    'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });\n});\n$1');

  fs.writeFileSync(file, content);
});

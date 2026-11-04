const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'server', 'routes');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
files.forEach(f => {
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  // insert }); before any // Create Task or // Submit Maintenance if they follow a res.status(501)
  content = content.replace(/res\.status\(501\)\.json\(\{ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" \}\);\s*(\/\/|\/\*\*|router\.|export)/g, 
    'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });\n});\n$1');
  
  // Actually, I can just do a very reliable replace:
  // For every router.METHOD(..., async (req, res) => {
  // if it's not closed, close it.
  
});

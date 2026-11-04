const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the broken sed output:
  // res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });
  //    id: propertyId, ...
  //  });
  // We need to replace all res.status(501).json(...) until the closing }); with a clean one.
  
  // Actually, wait, let's just use regex to clean up everything from res.status(501).json to the matching });
  
  content = content.replace(/res\.status\(501\)\.json\(\{ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" \}\);[\s\S]*?\}\);/g, 'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });');
  content = content.replace(/res\.status\(501\)\.json\(\{ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" \}\);[\s\S]*?\]\);/g, 'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });');

  // Also replace any remaining 200/201 json responses
  content = content.replace(/res\.status\(2[0-9]{2}\)\.json\([\s\S]*?\);/g, 'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });');
  content = content.replace(/res\.json\([\s\S]*?\);/g, 'res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });');

  fs.writeFileSync(file, content);
});

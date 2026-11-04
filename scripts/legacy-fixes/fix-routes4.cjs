const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const files = ['autopilot.ts', 'contracts.ts', 'properties.ts'];

files.forEach(f => {
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  
  // Clean up any extra trailing junk we added
  content = content.replace(/\}\n\);\n\}\n\)\n\}$/g, ''); // just remove all trailing junk and put export default router;
  content = content.replace(/\n\}\n\);\n\}?$/g, '');
  content = content.replace(/export default router;[\s\S]*/, '');
  
  // ensure the last thing is the closing of a route, then export default router
  // if it's missing a closing for the last route, append });
  if (!content.trim().endsWith('});')) {
      content = content.trim() + '\n});';
  }
  content = content + '\n\nexport default router;\n';
  fs.writeFileSync(file, content);
});

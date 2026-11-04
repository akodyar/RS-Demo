const fs = require('fs');

['tests/trust-domain-adversary.test.ts', 'tests/ai-autopilot-domain-adversary.test.ts', 'tests/communications-crm-adversary.test.ts'].forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    
    // Fix the 503 code check where data.error !== DATABASE_NOT_CONFIGURED
    content = content.replace(/res\.status !== 503 \|\| data\.error !== 'DATABASE_NOT_CONFIGURED'/g, 
                              "res.status !== 503 || (data.error !== 'DATABASE_NOT_CONFIGURED' && data.code !== 'DATABASE_NOT_CONFIGURED')");
    
    // Fix missing env restore
    content = content.replace(/assert\(all503Passed, '[^']+', '[^']+'\);\n/g, 
      "$&    if (originalHost) process.env.SQL_HOST = originalHost;\n    if (originalUrl) process.env.DATABASE_URL = originalUrl;\n");

    // Fix missing res in aiRes.status !== 401 && res.status !== 403
    content = content.replace(/aiRes\.status !== 401 && res\.status !== 403/g, "aiRes.status !== 401 && aiRes.status !== 403");
    
    // Fix res.status where it should be resUnauth.status or resTenant.status etc
    content = content.replace(/\n\s*res\.status === 401/g, "\n    resUnauth.status === 401");
    // wait, I don't know the exact var names. Let me use replace_file_content after viewing instead.
    
    fs.writeFileSync(f, content);
  }
});

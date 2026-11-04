const fs = require('fs');

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));
for (const f of files) {
  let c = fs.readFileSync('tests/' + f, 'utf8');
  
  // Replace the broken .status !== 401 && .status !== 403
  // with a generic variable lookup.
  
  // We can just find `const xyzRes = await fetch` and then replace the assertion.
  // Actually, we can use a simpler approach. If there's an assertion that uses `.status`, it must be the variable declared before it.
  
  const regex = /const ([a-zA-Z0-9_]+) = await fetch[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n\s*\.status !== 401 && \.status !== 403/g;
  
  c = c.replace(/const ([a-zA-Z0-9_]+) = await fetch([^;]+);\n\s*assert\(\n\s*\.status !== 401 && \.status !== 403/g, "const $1 = await fetch$2;\n    assert(\n      $1.status !== 401 && $1.status !== 403");

  c = c.replace(/const ([a-zA-Z0-9_]+) = await fetch([^\n]+)\n([^\n]+)\n([^\n]+)\n([^\n]+)\n\s*\.status !== 401 && \.status !== 403/g, "const $1 = await fetch$2\n$3\n$4\n$5\n      $1.status !== 401 && $1.status !== 403");

  // some might have 4 lines before assert
  
  fs.writeFileSync('tests/' + f, c);
}
console.log('Fixed broken status');

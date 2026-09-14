/* Static check: every named import must exist in the target module,
   and flag imports that are never used in the file. */
import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const files = execSync("find js -name '*.js'").toString().trim().split('\n');
const exportsOf = new Map();

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    m[1].split(',').forEach((p) => names.add(p.split(/\s+as\s+/).pop().trim()));
  }
  if (/^export\s+default/m.test(src)) names.add('default');
  exportsOf.set(path.normalize(f), names);
}

let problems = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+'([^']+)'/g)) {
    const target = path.normalize(path.join(path.dirname(f), m[2]));
    const have = exportsOf.get(target);
    if (!have) { console.log(`MISSING MODULE  ${f} -> ${m[2]}`); problems++; continue; }
    for (const raw of m[1].split(',')) {
      const name = raw.split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      if (!have.has(name)) { console.log(`NO EXPORT       ${f}: '${name}' not exported by ${m[2]}`); problems++; }
      const local = (raw.split(/\s+as\s+/)[1] || name).trim();
      const uses = src.split(new RegExp(`\\b${local.replace('$', '\\$')}\\b`)).length - 1;
      if (uses <= 1) { console.log(`UNUSED          ${f}: '${local}'`); }
    }
  }
}
console.log(problems ? `\n${problems} hard problem(s)` : '\nAll imports resolve.');

// G798 / GS2: `pnpm gen:source [--check] [--changed=<path>...]` — every app-wide generated source table from its
// registered producer (scripts/source-generators.mjs). Writes only what differs; --check writes nothing and fails on
// any table that differs from a fresh run; --changed runs only the rows those inputs feed (the pre-commit hook).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SOURCE_GENERATORS, selectSourceGenerators } from './source-generators.mjs';

/** Run the registered rows (all, or those `changed` feeds); returns the outputs written (or stale, with `check`). */
export async function genSource(root, { check = false, changed } = {}) {
  const rows = changed === undefined ? SOURCE_GENERATORS : selectSourceGenerators(changed), touched = [];
  for (const row of rows) {
    if (row.generate !== undefined) {
      const outputs = await row.generate(root);
      if (Object.keys(outputs).sort().join('\n') !== [...row.outputs].sort().join('\n')) throw new Error(`gen:source: ${row.id} outputs differ from its registry row`);
      for (const [path, text] of Object.entries(outputs)) {
        const file = resolve(root, path), now = existsSync(file) ? readFileSync(file, 'utf8') : null;
        if (now === text) continue;
        touched.push(path);
        if (!check) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
      }
    } else if (row.run !== undefined) row.run(root, check);
  }
  if (check && touched.length > 0) throw new Error(`gen:source: stale ${touched.join(', ')} (run pnpm gen:source)`);
  return touched;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const changed = process.argv.filter(arg => arg.startsWith('--changed=')).map(arg => arg.slice('--changed='.length));
  const touched = await genSource(resolve(import.meta.dirname, '..'), { check: process.argv.includes('--check'), ...(changed.length > 0 ? { changed } : {}) });
  console.log(`gen:source: ${touched.length === 0 ? 'every table current' : `${process.argv.includes('--check') ? 'stale' : 'wrote'} ${touched.join(', ')}`}`);
}

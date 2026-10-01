// E362 AG20: Git supplies immutable staged blobs; materialize only the lint paths' dependency closure.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { parseSync } from 'vite';

/** No source file in this snapshot is read from the shared working tree. */
export function guardSnapshot(root, tree, scratch, selected) {
  const git = (args, input) => {
    const result = spawnSync('git', args, { cwd: root, input, maxBuffer: 64 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString()}`);
    return result.stdout;
  };
  const records = git(['ls-tree', '-rz', tree, '--', 'src', 'lint', '.oxlintrc.json', '.oxlintrc.ratchet.json', 'package.json', 'tsconfig.json']).toString().split('\0').filter(Boolean).map((entry) => {
    const split = entry.indexOf('\t');
    return { path: entry.slice(split + 1), oid: entry.slice(0, split).split(' ')[2] };
  });
  const names = new Set(records.map((entry) => entry.path));
  const text = records.filter((entry) => !entry.path.startsWith('src/') || /\.[cm]?[jt]sx?$|\.json$|\.css$/u.test(entry.path));
  // One batch read avoids a process per import. This does not parse or lint unrelated modules.
  const blobs = git(['cat-file', '--batch'], `${text.map((entry) => entry.oid).join('\n')}\n`);
  const sources = new Map();
  let cursor = 0;
  for (const entry of text) {
    const end = blobs.indexOf(10, cursor);
    const header = blobs.subarray(cursor, end).toString().split(' ');
    const size = Number(header[2]);
    if (header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0) throw new Error(`Cannot snapshot ${entry.path}`);
    sources.set(entry.path, blobs.subarray(end + 1, end + 1 + size));
    cursor = end + 1 + size + 1;
  }
  const imports = JSON.parse(sources.get('package.json').toString()).imports;
  const targetOf = (file, source) => {
    let base;
    if (source.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(file), source));
    else if (source.startsWith('#')) {
      let target = imports[source];
      if (!target) for (const key of Object.keys(imports).filter((k) => k.includes('*')).sort((a, b) => b.indexOf('*') - a.indexOf('*'))) {
        const [prefix, suffix] = key.split('*');
        if (source.startsWith(prefix) && source.endsWith(suffix)) { target = imports[key].replace('*', source.slice(prefix.length, source.length - suffix.length)); break; }
      }
      if (typeof target === 'string') base = posix.normalize(target);
    }
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.js`, base.replace(/\.js$/u, '.ts'), `${base}/index.ts`, `${base}/index.js`].find((path) => names.has(path)) ?? null;
  };
  const needed = new Set(text.filter((entry) => !entry.path.startsWith('src/')).map((entry) => entry.path));
  const visit = (file) => {
    if (needed.has(file) || !names.has(file)) return;
    needed.add(file);
    if (!/\.[cm]?[jt]sx?$/u.test(file)) return;
    const parsed = parseSync(file, sources.get(file).toString());
    // The actual lint pass reports syntax errors; dependency discovery must never turn them into a pass.
    if (parsed.errors.length > 0) return;
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && typeof node.source?.value === 'string') {
        const target = targetOf(file, node.source.value); if (target) visit(target);
      }
      for (const [key, value] of Object.entries(node)) if (key !== 'parent') {
        if (Array.isArray(value)) { for (const child of value) walk(child); }
        else if (value && typeof value === 'object') walk(value);
      }
    };
    walk(parsed.program);
  };
  for (const file of selected) visit(file);
  const directories = new Set();
  for (const file of needed) {
    const path = resolve(scratch, file), dir = dirname(path);
    if (!directories.has(dir)) { mkdirSync(dir, { recursive: true }); directories.add(dir); }
    // Raster imports need an existing module path, not image contents, for lint resolution.
    writeFileSync(path, sources.get(file) ?? '');
  }
  return { paths: [...names], readSource: (file) => sources.get(file)?.toString() ?? '' };
}

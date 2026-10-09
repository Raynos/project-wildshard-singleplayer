#!/usr/bin/env node
// SF6b: deterministic outputs in an immutable export; never read the shared working tree.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apiSurface, pages, undocumented } from './gen-api.mjs';
import { SHARDFILE_REFERENCE, shardfileReference } from './docs/gen-shardfile-reference.mjs';
import { compareEdges, graph } from './check-graph.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { appendixRange, engineAppendix, generatedIncreases, replaceDebt, verifyIncreaseTrailers } from './generated-policy.mjs';

const sorted = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)])) : value;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const read = (root, file) => readFileSync(resolve(root, file), 'utf8');
const data = (root, file) => JSON.parse(read(root, file));
function run(root, command, args) {
  const out = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.error) throw out.error;
  if (out.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${out.stderr.length > 0 ? out.stderr : out.stdout}`);
  return out.stdout;
}
/** Compute every generated output, while leaving policy inputs and manual documentation alone. */
export function generatedFiles(root) {
  const files = [];
  const scan = (dir) => {
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(file);
      else if (/\.[cm]?[jt]sx?$/u.test(file) && !file.endsWith('.d.ts')) files.push(file);
    }
  };
  scan('src');
  const { edges, violations } = graph(files.sort((a, b) => a.localeCompare(b)), (file) => read(root, file), (file) => existsSync(resolve(root, file)), legacyInventory(root));
  const failures = [...violations, ...compareEdges(edges, edges).failures];
  const surface = apiSurface(root), ceiling = data(root, 'lint/api-undocumented.json').max;
  if (undocumented(surface) > ceiling) failures.push(`Undocumented API ${undocumented(surface)} exceeds ${ceiling}`);
  if (failures.length > 0) throw new Error(failures.join('\n'));
  const ratchet = replaceDebt(data(root, 'lint/ratchet.json'), JSON.parse(run(root, process.execPath, ['lint/ratchet.mjs', '--measure'])));
  const doc = read(root, 'docs/ENGINE.md'), { start, end } = appendixRange(doc);
  const outputs = {
    'lint/api-surface.json': json(surface), ...pages(surface),
    [SHARDFILE_REFERENCE]: shardfileReference(root),
    'docs/ENGINE.md': doc.slice(0, start) + engineAppendix(surface) + doc.slice(end),
    'lint/layer-edges.json': json({ about: 'SF6b: generated cross-layer import counts; exact increases require coordinator approval in the regeneration commit.', edges: sorted(edges) }),
    'lint/ratchet.json': json(sorted(ratchet)),
  };
  // This pre-existing structural generated index also becomes stale whenever a source helper is added.
  if (existsSync(resolve(root, 'scripts/normalize/liveness.mjs'))) {
    outputs['scripts/README.md'] = run(root, process.execPath, ['scripts/normalize/liveness.mjs', '--readme', '--stdout']);
  }
  return { outputs, measurement: { edges, ratchet } };
}
/** Refuse stale bytes and unlisted measured increases, including the docs Vercel excludes. */
export function checkGenerated(root, predecessor, message) {
  const candidate = generatedFiles(root);
  const stale = Object.entries(candidate.outputs).filter(([file, text]) => (existsSync(resolve(root, file)) ? read(root, file) : '') !== text).map(([file]) => file);
  if (stale.length > 0) throw new Error(`Stale or hand-edited generated files: ${stale.join(', ')}`);
  verifyIncreaseTrailers(generatedIncreases(predecessor, candidate.measurement), message);
  return candidate;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    if (process.argv[2] === '--check') {
      const previous = data(resolve(process.argv[3]), 'measurement.json');
      checkGenerated(root, previous, readFileSync(resolve(process.argv[4]), 'utf8'));
      console.log('generated-files: every generated output and exact increase receipt passed');
    } else if (process.argv[2] === '--write') {
      const { outputs } = generatedFiles(root);
      for (const [file, text] of Object.entries(outputs)) { mkdirSync(resolve(root, file, '..'), { recursive: true }); writeFileSync(resolve(root, file), text); }
    } else throw new Error('Use --write inside an immutable export, or --check <predecessor-dir> <commit-message-file>');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

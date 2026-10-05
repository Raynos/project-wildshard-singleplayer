// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the defining guard in an owned isolated source tree.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own this temporary tree.
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture ownership.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve defining plugin and executable paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the same Node executable as the test worker.
import { cwd, execPath } from 'node:process';
import { afterAll, expect, it } from 'vitest';
import { createCatalogue, catalogueRef } from '../src/commons/catalogue';
import { runtimeCommonsClosure } from '../lint/commons-closure.mjs';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'commons-boundary-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));
cpSync('lint', join(root, 'lint'), { recursive: true });
linkNodeModules(cwd(), root);
const put = (file: string, source: string) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), source); };
put('package.json', '{"type":"module"}');
for (const layer of ['sdk', 'engine', 'game', 'kit', 'commons']) put(`src/${layer}/package.json`, JSON.stringify({ exports: { './catalogue': './catalogue.ts', './facade': './facade.ts', './runtime/facade': './runtime/facade.ts' } }));
put('src/commons/catalogue.ts', 'export const catalogue = 0;');
put('src/sdk/facade.ts', 'export const author = 0;');
put('src/sdk/runtime/facade.ts', 'import "@wildshard/commons/catalogue";');
put('src/shards/proof/data/direct.ts', 'import "@wildshard/commons/catalogue";');
put('src/shards/proof/data/reexport.ts', 'export {catalogue} from "@wildshard/commons/catalogue";');
put('src/shards/proof/data/dynamic.ts', 'export const load = () => import("@wildshard/commons/catalogue");');
put('src/shards/proof/data/computed.ts', 'export const load = (id:string) => import("@wildshard/commons/" + id);');
put('src/shards/proof/data/computed-relative.ts', `export const load = (id:string) => import(\`../../../commons/\${id}\`);`);
put('src/shards/proof/data/cycle-a.ts', 'import "./cycle-b";');
put('src/shards/proof/data/cycle-b.ts', 'import "./cycle-a"; import "./direct";');
put('src/shards/proof/data/clean-a.ts', 'import "./clean-b";');
put('src/shards/proof/data/clean-b.ts', 'import "./clean-a";');
const cases = [
  { file: 'src/shards/proof/generators/allowed.ts', source: 'import "@wildshard/commons/catalogue";', layer: 0, public: 0 },
  { file: 'src/commons/allowed.ts', source: 'import "@wildshard/sdk/facade";', layer: 0, public: 0 },
  { file: 'src/commons/engine.ts', source: 'import "@wildshard/engine/catalogue";', layer: 1, public: 0 },
  { file: 'src/commons/game.ts', source: 'import "@wildshard/game/catalogue";', layer: 1, public: 0 },
  { file: 'src/commons/kit.ts', source: 'import "@wildshard/kit/catalogue";', layer: 1, public: 0 },
  { file: 'src/commons/runtime.ts', source: 'import "@wildshard/sdk/runtime/facade";', layer: 1, public: 0 },
  { file: 'src/sdk/upward.ts', source: 'import "@wildshard/commons/catalogue";', layer: 1, public: 0 },
  { file: 'src/shards/proof/generators/private.ts', source: 'import "@wildshard/commons/private";', layer: 0, public: 1 },
  { file: 'src/shards/proof/combat/forbidden.ts', source: 'import "@wildshard/commons/catalogue";', layer: 1, public: 0 },
  ...['direct', 'reexport', 'dynamic', 'computed', 'computed-relative', 'cycle-a'].map(id => ({ file: `src/shards/proof/runtime/${id}.ts`, source: `import "../data/${id}";`, layer: 1, public: 0 })),
  { file: 'src/shards/proof/runtime/relative.ts', source: 'import "../../../commons/catalogue";', layer: 1, public: 1 },
  { file: 'src/shards/proof/runtime/facade.ts', source: 'import "@wildshard/sdk/runtime/facade";', layer: 1, public: 0 },
  { file: 'src/shards/proof/runtime/clean.ts', source: 'import "../data/clean-a";', layer: 0, public: 0 },
];
for (const row of cases) put(row.file, row.source);
put('.oxlintrc.json', JSON.stringify({ jsPlugins: [join(root, 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/layer': 'error', 'wildshard/public-index': 'error' } }));
const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, '.oxlintrc.json'), '-f', 'json', ...cases.map(row => row.file)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
interface Diagnostic { filename: string; code: string; message: string }
const diagnostics = (JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
it('runs the actual defining layer guard', () => { expect(result.status, result.stderr).toBe(1); expect(result.stderr).toBe(''); });
it.each(cases)('$file', row => {
  expect(diagnostics.filter(site => site.filename === row.file && site.code === 'wildshard(layer)')).toHaveLength(row.layer);
  expect(diagnostics.filter(site => site.filename === row.file && site.code === 'wildshard(public-index)')).toHaveLength(row.public);
});
it('invalidates the closure cache when a clean helper gains a commons edge', () => {
  const file = join(root, 'src/shards/proof/runtime/clean.ts');
  expect(runtimeCommonsClosure(file, '../data/clean-a')).toBeNull();
  put('src/shards/proof/data/clean-b.ts', 'import "./clean-a"; import "./direct";');
  expect(runtimeCommonsClosure(file, '../data/clean-a')).toBe('@wildshard/commons/catalogue');
});
it('resolves a copied catalogue entry and refuses an unknown stable identity', () => {
  const built = createCatalogue([{ id: 'bridges', version: '1.0.0', entries: [{ id: 'deck', kind: 'binary', bytes: new Uint8Array([1]), credit: 'Fixture', licence: 'CC0-1.0' }] }]);
  const resolved = catalogueRef(built.catalogue, 'bridges/deck');
  expect(resolved.ref).toBe(`commons:${resolved.entry.hash}`);
  resolved.entry.credit = 'changed';
  expect(built.catalogue.entries[0]?.credit).toBe('Fixture');
  expect(() => catalogueRef(built.catalogue, 'unknown')).toThrow('Unknown commons entry');
});

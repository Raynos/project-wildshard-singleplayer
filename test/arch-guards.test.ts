// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual lint and pre-commit binaries against isolated fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their temporary directories and never mutate shared source files.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture repositories are outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Platform independent fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Subprocesses use the same Node executable as Vitest.
import { env, execPath } from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';
import { compareCounts, hardRules } from '../scripts/guard-counts.mjs';
import { checkShardLayout, checkShards, shardEntries, type ShardLayout } from '../scripts/check-shards.mjs';
import { genShardWords, shardWordData } from '../scripts/gen-shard-words.mjs';
import { CAPTURE_SHELL_FILES, TIME_ALLOW } from '../lint/wildshard-plugin.js';
import { compareEdges, graph, layerOf, reachViolation } from '../scripts/check-graph.mjs';

interface Case { id: string; file: string; rule: string; code: string; count: number }
interface Diagnostic { code: string; filename: string; message: string }
const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function temp(): string { const root = mkdtempSync(join(tmpdir(), 'arch-guards-')); roots.push(root); return root; }
function put(root: string, file: string, source: string): void { const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source); }
const cases = JSON.parse(readFileSync('test/fixtures/arch-guards/cases.json', 'utf8')) as Case[];
const fixtureRoot = temp();
for (const item of cases) put(fixtureRoot, item.file, item.code);
const lint = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', resolve('.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: fixtureRoot, encoding: 'utf8' });
const diagnostics = (JSON.parse(lint.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
describe('E362 AST guards through oxlint', () => {
  it('loads the real plugin', () => { expect(lint.status).toBe(1); expect(lint.stderr).toBe(''); });
  it.each(cases)('$id', (item) => { expect(diagnostics.filter((d) => d.filename === item.file && d.code === `wildshard(${item.rule})`), item.code).toHaveLength(item.count); });
});

describe('E405 AG24 no dead exemptions', () => {
  it('names only files that exist', () => {
    const ratchet = JSON.parse(readFileSync('lint/ratchet.json', 'utf8')) as { allow?: Record<string, Record<string, string>> };
    const allowed = Object.values(ratchet.allow ?? {}).flatMap((paths) => Object.keys(paths));
    const missing = [...Object.keys(TIME_ALLOW), ...CAPTURE_SHELL_FILES, ...allowed].filter((path) => !existsSync(path));
    expect(missing).toEqual([]);
  });
});

describe('AG16 and AG17', () => {
  const key = 'wildshard/no-raw-input', file = 'src/engine/example.ts';
  it('promotes every selected zero rule in the ordinary src lint override', () => {
    const hard = hardRules('.oxlintrc.json');
    for (const rule of ['no-shard-branch', 'no-raw-save', 'no-raw-shader-patch', 'sim-no-render', 'no-active-chunk', 'no-raw-hud', 'no-raw-animation-mixer']) expect(hard.has(`wildshard/${rule}`)).toBe(true);
  });
  it('refuses a clean file, warns on partial slack and ignores untouched WIP', () => {
    const baseline = { [key]: { [file]: 2, 'src/other.ts': 4 } };
    expect(compareCounts(baseline, {}, new Set([key]), [file]).failures.join(',')).toContain('is clean');
    expect(compareCounts(baseline, { [key]: { [file]: 1 } }, new Set(), [file]).warnings).toHaveLength(1);
    expect(compareCounts(baseline, {}, new Set(), ['src/unrelated.ts']).failures).toEqual([]);
  });
  it('requires promotion even during an update; permits a hard zero and refuses rises', () => {
    expect(compareCounts({ [key]: { [file]: 1 } }, {}, new Set(), undefined, true).failures.join(',')).toContain('move it to .oxlintrc.json');
    expect(compareCounts({ [key]: { [file]: 1 } }, {}, new Set([key]), undefined, true).failures).toEqual([]);
    expect(compareCounts({}, { [key]: { [file]: 1 } }, new Set([key])).failures.join(',')).toContain('was 0, now 1');
  });
});

describe('AG14 generated vocabulary', () => {
  it('discovers a new shard, imported row IDs, settings and assets; generation is deterministic and check fails stale', () => {
    const root = temp();
    put(root, 'src/shards/emberfall/manifest.ts', "export default { slug: 'emberfall', name: 'Emberfall Desert', debugOptions: ['wind'], assetGlobs: ['public/assets/emberfall/**'] };");
    put(root, 'src/shards/emberfall/plugin.ts', "import { ROW } from './species/rows'; export function install(ctx) { ctx.rows.species([ROW]); ctx.rows.weapon({ id: 'weapon.whip' }); ctx.debugRow({ id: 'heat' }); }");
    put(root, 'src/shards/emberfall/species/rows.ts', "const BASE = { id: 'species.kite' }; export const ROW = { ...BASE, id: 'species.emberfall.kite' };");
    const data = shardWordData(root);
    expect(data.slugs).toEqual(['emberfall']);
    expect(data.words).toEqual(expect.arrayContaining(['emberfall', 'Emberfall Desert', 'species.emberfall.kite', 'weapon.whip']));
    expect(data.shards['emberfall']?.settings).toEqual(['emberfall.heat', 'heat', 'wind']);
    genShardWords(root); const file = join(root, 'lint/shard-words.generated.json'), source = readFileSync(file, 'utf8');
    genShardWords(root); expect(readFileSync(file, 'utf8')).toBe(source); expect(() => genShardWords(root, true)).not.toThrow();
    for (const name of ['package.json', '.oxlintrc.ratchet.json', 'lint/wildshard-plugin.js', 'lint/engine-words.json', 'lint/url-params.json']) {
      mkdirSync(dirname(join(root, name)), { recursive: true }); copyFileSync(name, join(root, name));
    }
    put(root, 'src/game/new-shard-branch.ts', "const BY = { emberfall: 1 }; BY['emberfall']; level.id === 'emberfall';");
    put(root, 'src/engine/new-shard-words.ts', "export const label = 'Emberfall Desert'; export const row = 'species.emberfall.kite';");
    const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, '.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    const found = (JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
    expect(result.status, result.stderr).toBe(1);
    expect(found.filter((d) => d.filename === 'src/game/new-shard-branch.ts' && d.code === 'wildshard(no-shard-branch)')).toHaveLength(3);
    expect(found.filter((d) => d.filename === 'src/engine/new-shard-words.ts' && d.code === 'wildshard(engine-words)')).toHaveLength(2);
    writeFileSync(file, '{}'); expect(() => genShardWords(root, true)).toThrow('stale');
  });
});

describe('AG9 shard layout', () => {
  it('holds every real shard in full Vitest, including the pre-push and CI exports', () => { expect(checkShards(resolve('.'))).toEqual([]); });
  const config: ShardLayout = { requiredFiles: ['manifest.ts', 'plugin.ts', 'README.md', 'roster.ts', 'budgets.ts'], allowedFiles: ['layout.ts'], folders: ['world', 'quest'], legacy: { old: { entries: ['quest.ts'], missing: ['README.md'] } } };
  it('allows canonical and exact legacy layouts while refusing new loose entries, missing files and duplicate concepts', () => {
    const names = config.requiredFiles.concat(['world/', 'quest/', 'layout.ts']);
    expect(checkShardLayout({ emberfall: names }, config, () => "export default { slug: 'emberfall' };")).toEqual([]);
    expect(checkShardLayout({ old: config.requiredFiles.filter((p) => p !== 'README.md').concat(['quest.ts']) }, config)).toEqual([]);
    expect(checkShardLayout({ emberfall: ['manifest.ts', 'quest.ts', 'quest/', 'loose.ts'] }, config).join(',')).toContain('missing required plugin.ts');
    expect(checkShardLayout({ emberfall: names.concat(['quest.ts']) }, config).join(',')).toContain('name the same concept');
    expect(checkShardLayout({ emberfall: names }, config, () => "export default { slug: 'wrong' };").join(',')).toContain('slug must equal');
    expect(checkShardLayout({ _template: [] }, config)).toEqual([]);
  });
  it('builds layouts from index paths and selects only the committed shard', () => {
    expect(shardEntries(['src/shards/emberfall/manifest.ts', 'src/shards/emberfall/world/terrain.ts', 'src/shards/other/broken.ts'], new Set(['emberfall']))).toEqual({ emberfall: ['manifest.ts', 'world/'] });
  });
});

describe('AG20 staged content isolation', () => {
  function repo(): { root: string; git: (...args: string[]) => void; run: () => ReturnType<typeof spawnSync> } {
    const root = temp();
    const files = ['package.json', 'tsconfig.json', '.oxlintrc.json', '.oxlintrc.ratchet.json', 'lint/wildshard-plugin.js', 'lint/engine-words.json', 'lint/url-params.json', 'lint/shard-words.generated.json', 'lint/shard-layout.json', 'scripts/precommit-guards.mjs', 'scripts/guard-counts.mjs', 'scripts/guard-snapshot.mjs', 'scripts/check-shards.mjs', 'scripts/gen-shards.mjs', 'scripts/gen-shard-words.mjs'];
    for (const file of files) { mkdirSync(dirname(join(root, file)), { recursive: true }); copyFileSync(file, join(root, file)); }
    put(root, 'lint/ratchet.json', '{}'); put(root, 'src/engine/example.ts', 'export const value = 1;');
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
    const git = (...args: string[]): void => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); expect(result.status, result.stderr).toBe(0); };
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    git('add', '--', ...files, 'lint/ratchet.json', 'src/engine/example.ts'); git('commit', '-qm', 'fixture');
    return { root, git, run: () => spawnSync(execPath, ['scripts/precommit-guards.mjs'], { cwd: root, encoding: 'utf8', env: { ...env, SKIP_ARCH_GUARDS: '0' } }) };
  }
  it('passes staged valid contents despite invalid working contents and unrelated invalid files', () => {
    const f = repo(); put(f.root, 'src/engine/example.ts', 'export const value = 2;'); f.git('add', '--', 'src/engine/example.ts');
    put(f.root, 'src/engine/example.ts', 'const = ;'); put(f.root, 'src/engine/unrelated.ts', 'const = ;');
    const result = f.run(); expect(result.status, String(result.stderr)).toBe(0);
  });
  it('rejects a staged hard violation even when the working file is clean', () => {
    const f = repo(); put(f.root, 'src/engine/example.ts', "export const value = localStorage.getItem('x');"); f.git('add', '--', 'src/engine/example.ts');
    put(f.root, 'src/engine/example.ts', 'export const value = 2;');
    const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('no-raw-save');
  });
  it('checks the per-file ratchet, locks a cleaned staged file and permits a lowered staged baseline', () => {
    const f = repo();
    put(f.root, 'lint/ratchet.json', JSON.stringify({ 'wildshard/no-raw-random-time': { 'src/engine/example.ts': 1, 'src/engine/unrelated.ts': 2 } }));
    put(f.root, 'src/engine/example.ts', 'export const value = Math.random();');
    f.git('add', '--', 'lint/ratchet.json', 'src/engine/example.ts');
    expect(f.run().status).toBe(0);
    put(f.root, 'src/engine/example.ts', 'export const value = 2;'); f.git('add', '--', 'src/engine/example.ts');
    expect(f.run().stderr).toContain('is clean');
    put(f.root, 'lint/ratchet.json', JSON.stringify({ 'wildshard/no-raw-random-time': { 'src/engine/unrelated.ts': 2 } }));
    f.git('add', '--', 'lint/ratchet.json'); expect(f.run().status).toBe(0);
  });
  it('checks only the committed shard layout', () => {
    const f = repo(); put(f.root, 'src/shards/emberfall/plugin.ts', 'export const value = 1;'); f.git('add', '--', 'src/shards/emberfall/plugin.ts');
    const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('missing required README.md');
  });
  it('loads imported dependencies from the staged tree despite invalid working copies', () => {
    const f = repo();
    put(f.root, 'src/engine/example.ts', "import { other } from './dependency';\n\nexport const value = other + 1;");
    put(f.root, 'src/engine/dependency.ts', 'export const other = 2;');
    f.git('add', '--', 'src/engine/example.ts', 'src/engine/dependency.ts');
    put(f.root, 'src/engine/dependency.ts', 'const = ;');
    const result = f.run(); expect(result.status, String(result.stderr)).toBe(0);
  });
  it('checks committed ownership metadata while deriving untracked runtime tables for manifest commits', () => {
    const f = repo();
    put(f.root, 'src/shards/emberfall/manifest.ts', "const manifest = { slug: 'emberfall', name: 'Emberfall Desert', order: 1, debugOptions: [], assetGlobs: [] };\n\n// oxlint-disable-next-line import/no-default-export -- F9 requires a manifest default export.\nexport default manifest;");
    for (const file of ['plugin.ts', 'roster.ts', 'budgets.ts']) put(f.root, `src/shards/emberfall/${file}`, 'export const value = 1;');
    put(f.root, 'src/shards/emberfall/README.md', '# Emberfall\n');
    genShardWords(f.root);
    f.git('add', '--', 'src/shards/emberfall', 'lint/shard-words.generated.json');
    const valid = f.run(); expect(valid.status, String(valid.stderr)).toBe(0);
    const inventory = readFileSync(join(f.root, 'lint/shard-words.generated.json'), 'utf8');
    put(f.root, 'lint/shard-words.generated.json', inventory.replaceAll('Emberfall Desert', 'Stale Desert')); f.git('add', '--', 'lint/shard-words.generated.json');
    const stale = f.run(); expect(stale.status).toBe(1); expect(stale.stderr).toContain('stale');
  });
});

describe('AG7 layer graph', () => {
  it('names layers and refuses a shard reached from outside except the generated table and its own manifest import()', () => {
    expect([layerOf('src/engine/a.ts'), layerOf('src/shards/x/a/b.ts'), layerOf('src/main.ts'), layerOf('test/a.ts')]).toEqual(['engine', 'shards/x', 'root', null]);
    expect(reachViolation('src/shards.generated.ts', 'src/shards/x/manifest.ts', false)).toBeNull();
    expect(reachViolation('src/shards/x/manifest.ts', 'src/shards/x/plugin.ts', true)).toBeNull();
    expect(reachViolation('src/shards/x/manifest.ts', 'src/shards/x/plugin.ts', false)).toMatch(/statically/u);
    expect(reachViolation('src/game/a.ts', 'src/shards/x/plugin.ts', true)).toMatch(/reaches into/u);
    expect(reachViolation('src/shards/y/a.ts', 'src/shards/x/a.ts', false)).toMatch(/reaches into/u);
  });
  it('counts cross-layer edges once per file and target, and fails a new pair, a rise and a two-way pair', () => {
    const files: Record<string, string> = {
      'src/kit/a.ts': "import { x } from '#engine'; import type { Y } from '#engine'; import './b';",
      'src/kit/b.ts': '',
      'src/engine/index.ts': "export const x = 1; export type Y = 1;",
    };
    const g = graph(Object.keys(files), (p) => files[p] ?? '', (p) => p in files);
    expect(g).toEqual({ edges: { 'kit → engine': 1 }, violations: [] });
    expect(compareEdges({ 'kit → engine': 1 }, { 'kit → engine': 2 }).failures).toEqual(['kit → engine rose 1 → 2']);
    expect(compareEdges({}, { 'game → kit': 1 }).failures[0]).toMatch(/new layer pair/u);
    expect(compareEdges({ 'kit → engine': 1, 'engine → kit': 1 }, { 'kit → engine': 1, 'engine → kit': 1 }).failures[0]).toMatch(/cycle/u);
    expect(compareEdges({ 'kit → engine': 3 }, { 'kit → engine': 2 }).fell).toEqual(['kit → engine fell 3 → 2']);
  });
  it('holds the real tree against lint/layer-edges.json', () => {
    const r = spawnSync(execPath, ['scripts/check-graph.mjs'], { encoding: 'utf8' });
    expect(r.stderr).not.toMatch(/failed/u);
    expect(r.status).toBe(0);
  });
});

describe('E422 no module mocks in tests', () => {
  it('refuses vi.mock / resetModules / hoisted in a test folder and leaves vi.fn / spyOn alone', () => {
    const root = temp();
    put(root, 'test/a.test.ts', "vi.mock('x', () => ({})); vi.resetModules(); vi.hoisted(() => 1); vi.fn(); vi.spyOn(console, 'warn');\n");
    put(root, '.oxlintrc.json', JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/no-module-mock': 'error' } }));
    const r = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, '.oxlintrc.json'), '-f', 'json', 'test'], { cwd: root, encoding: 'utf8' });
    const found = (JSON.parse(r.stdout) as { diagnostics: Diagnostic[] }).diagnostics.filter((d) => d.code === 'wildshard(no-module-mock)');
    expect(found).toHaveLength(3);
  });
});

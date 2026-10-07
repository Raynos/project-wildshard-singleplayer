// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual lint and pre-commit binaries against isolated fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their temporary directories and never mutate shared source files.
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture repositories are outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Platform independent fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Subprocesses use the same Node executable as Vitest.
import { env, execPath } from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';
import { comparePlatformList, PLATFORM_LISTS } from '../scripts/check-platform-ratchets.mjs';
import { compareCounts, hardRules } from '../scripts/guard-counts.mjs';
import { checkShardLayout, checkShards, shardEntries, type ShardLayout } from '../scripts/check-shards.mjs';
import { genShardWords, shardWordData } from '../scripts/gen-shard-words.mjs';
import { CAPTURE_SHELL_FILES, SIM_DIRS, TIME_ALLOW, VIEW_PATHS } from '../lint/wildshard-plugin.js';
import { compareEdges, graph, layerOf, reachViolation } from '../scripts/check-graph.mjs';
import { layoutBlock, withLayout } from '../scripts/gen-shard-layout-doc.mjs';

interface Case { id: string; file: string; rule: string; code: string; count: number }
interface Diagnostic { code: string; filename: string; message: string }
const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function temp(): string { const root = mkdtempSync(join(tmpdir(), 'arch-guards-')); roots.push(root); return root; }
function put(root: string, file: string, source: string): void { const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source); }
const cases = JSON.parse(readFileSync('test/fixtures/arch-guards/cases.json', 'utf8')) as Case[];
const fixtureRoot = temp();
const ownedCases = cases.filter((item) => item.id === 'owned-setting' || item.id === 'owned-setting-const');
for (const item of cases.filter((candidate) => !ownedCases.includes(candidate))) put(fixtureRoot, item.file, item.code);
// Raw setting reads have retired from shipping shards. Declare ownership in this isolated fixture,
// using the real generator and plugin, so literal/const acceptance never depends on a shipping tool.
const ownedRoot = temp();
cpSync('lint', join(ownedRoot, 'lint'), { recursive: true });
copyFileSync('.oxlintrc.ratchet.json', join(ownedRoot, '.oxlintrc.ratchet.json'));
symlinkSync(resolve('node_modules'), join(ownedRoot, 'node_modules'));
put(ownedRoot, 'src/shards/nalati-grasslands/manifest.ts', "export default { slug: 'nalati-grasslands', debugOptions: ['nalatiHybrid'] };");
genShardWords(ownedRoot);
for (const item of ownedCases) put(ownedRoot, item.file, item.code);
const ownedLint = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(ownedRoot, '.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: ownedRoot, encoding: 'utf8' });
const ownedDiagnostics = (JSON.parse(ownedLint.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
const lint = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', resolve('.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: fixtureRoot, encoding: 'utf8' });
const diagnostics = (JSON.parse(lint.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
describe('E362 AST guards through oxlint', () => {
  it('loads the real plugin', () => { expect(lint.status).toBe(1); expect(lint.stderr).toBe(''); });
  it.each(cases)('$id', (item) => { expect((ownedCases.includes(item) ? ownedDiagnostics : diagnostics).filter((d) => d.filename === item.file && d.code === `wildshard(${item.rule})`), item.code).toHaveLength(item.count); });
});

describe('E405 AG24 no dead exemptions', () => {
  it('names only files that exist', () => {
    const ratchet = JSON.parse(readFileSync('lint/ratchet.json', 'utf8')) as { allow?: Record<string, Record<string, string>> };
    const allowed = Object.values(ratchet.allow ?? {}).flatMap((paths) => Object.keys(paths));
    const missing = [...Object.keys(TIME_ALLOW), ...CAPTURE_SHELL_FILES, ...allowed].filter((path) => !existsSync(path));
    expect(missing).toEqual([]);
  });
  it('sim-no-render names only engine folders that exist (SHARD-PLATFORM SP1: `quests` and `effects` never did)', () => {
    const missing = [...SIM_DIRS, ...VIEW_PATHS].map((path) => `src/engine/${path}`).filter((path) => !existsSync(path));
    expect(missing).toEqual([]);
  });
});

describe('AG16 and AG17', () => {
  const key = 'wildshard/no-raw-input', file = 'src/engine/example.ts';
  it('promotes every selected zero rule in the ordinary src lint override', () => {
    const hard = hardRules('.oxlintrc.json');
    for (const rule of ['no-shard-branch', 'no-raw-save', 'no-raw-shader-patch', 'sim-no-render', 'no-runtime-generator', 'no-active-chunk', 'no-raw-hud', 'no-raw-animation-mixer']) expect(hard.has(`wildshard/${rule}`)).toBe(true);
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
    for (const name of ['package.json', '.oxlintrc.ratchet.json', 'lint/wildshard-plugin.js', 'lint/authored-html.mjs', 'lint/commons-closure.mjs', ...['lint/sim-closure.mjs', 'lint/sim-closure.json', 'lint/sim-schema-leaves.json'].filter((policyPath) => existsSync(policyPath)), 'lint/engine-words.json', 'lint/url-params.json']) {
      mkdirSync(dirname(join(root, name)), { recursive: true }); copyFileSync(name, join(root, name));
    }
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
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
  it('allows Thin Ice and the seven transition shards, but refuses new runtime folders', () => {
    const runtimeConfig = { ...config, folders: [...config.folders, 'runtime'] };
    const names = config.requiredFiles.concat(['runtime/']);
    const baseline = JSON.parse(readFileSync('lint/shard-platform.json', 'utf8')) as { baseline: Record<string, number> };
    for (const slug of [...Object.keys(baseline.baseline), 'thin-ice']) {
      expect(checkShardLayout({ [slug]: names }, runtimeConfig, () => `export default { slug: '${slug}' };`, { ...baseline.baseline, 'thin-ice': 100 })).toEqual([]);
    }
    for (const slug of ['brand-new', '_new']) expect(checkShardLayout({ [slug]: names }, runtimeConfig, undefined, baseline.baseline).join(',')).toContain('custom runtime is reserved');
  });
  it('builds layouts from index paths and selects only the committed shard', () => {
    expect(shardEntries(['src/shards/emberfall/manifest.ts', 'src/shards/emberfall/world/terrain.ts', 'src/shards/other/broken.ts'], new Set(['emberfall']))).toEqual({ emberfall: ['manifest.ts', 'world/'] });
  });
});

describe('AG20 staged content isolation', () => {
  function repo(): { root: string; git: (...args: string[]) => void; run: () => ReturnType<typeof spawnSync> } {
    const root = temp();
    const files = ['package.json', 'tsconfig.json', '.oxlintrc.json', '.oxlintrc.ratchet.json', 'lint/wildshard-plugin.js', 'lint/authored-html.mjs', 'lint/commons-closure.mjs', ...['lint/sim-closure.mjs', 'lint/sim-closure.json', 'lint/sim-schema-leaves.json'].filter((policyPath) => existsSync(policyPath)), 'lint/engine-words.json', 'lint/url-params.json', 'lint/shard-words.generated.json', 'lint/shard-layout.json', 'scripts/precommit-guards.mjs', 'scripts/check-platform-ratchets.mjs', 'scripts/shard-coupling.mjs', 'lint/shard-coupling.json', 'lint/row-functions.json', 'lint/edge-exemptions.json', 'lint/shard-platform.json', 'scripts/link-node-modules.mjs', 'scripts/guard-counts.mjs', 'scripts/guard-snapshot.mjs', 'scripts/check-shards.mjs', 'scripts/gen-shards.mjs', 'scripts/gen-shard-words.mjs'];
    if (existsSync('lint/weapon-subclasses.json')) files.push('lint/weapon-subclasses.json');
    for (const file of files) { mkdirSync(dirname(join(root, file)), { recursive: true }); copyFileSync(file, join(root, file)); }
    put(root, 'lint/ratchet.json', '{}'); put(root, 'src/engine/example.ts', 'export const value = 1;');
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
    const git = (...args: string[]): void => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); expect(result.status, result.stderr).toBe(0); };
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    git('add', '--', ...files, 'lint/ratchet.json', 'src/engine/example.ts'); git('commit', '-qm', 'fixture');
    return { root, git, run: () => spawnSync(execPath, ['scripts/precommit-guards.mjs'], { cwd: root, encoding: 'utf8', env: { ...env, SKIP_ARCH_GUARDS: '0' } }) };
  }
  it('rejects config-only platform allowance growth in the index', () => {
    const f = repo();
    const file = 'lint/row-functions.json';
    const doc = JSON.parse(readFileSync(join(f.root, file), 'utf8')) as { fields: string[] };
    doc.fields.push('Injected.callback'); put(f.root, file, JSON.stringify(doc)); f.git('add', '--', file);
    const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('new function allowance Injected.callback');
  });
  it('rejects coupling allowance growth in config-only edits and new typed reaches in code', () => {
    const f = repo(), file = 'lint/shard-coupling.json';
    const doc = JSON.parse(readFileSync(join(f.root, file), 'utf8')) as { shards: Record<string, { counts: Record<string, number> }> };
    const row = doc.shards['_template']; if (row === undefined) throw new Error('Missing template baseline');
    row.counts['ctx.app'] = (row.counts['ctx.app'] ?? 0) + 1;
    put(f.root, file, JSON.stringify(doc)); f.git('add', '--', file);
    const config = f.run(); expect(config.status).toBe(1); expect(config.stderr).toContain('ctx.app rose');
    const code = repo();
    put(code.root, 'src/game/shard/context.ts', 'export interface ShardContext { app: { tick: () => void } }');
    put(code.root, 'src/shards/brand-new/plugin.ts', "import type { ShardContext } from '../../game/shard/context'; export function use(ctx: ShardContext): void { ctx.app.tick(); }");
    code.git('add', '--', 'src/game/shard/context.ts', 'src/shards/brand-new/plugin.ts');
    const reach = code.run(); expect(reach.status).toBe(1); expect(reach.stderr).toContain('brand-new: ctx.app rose 0 → 1');
  });
  it('rejects matching code and allowance growth after commit using explicit predecessor files', () => {
    const f = repo(), previous = temp();
    const lists = PLATFORM_LISTS;
    for (const file of lists) put(previous, file, readFileSync(join(f.root, file), 'utf8'));
    const file = lists[0]; if (file === undefined) throw new Error('Missing fixture list');
    const doc = JSON.parse(readFileSync(join(f.root, file), 'utf8')) as { fields: string[] };
    doc.fields.push('Injected.callback'); put(f.root, file, JSON.stringify(doc));
    put(f.root, 'src/engine/example.ts', 'export interface Injected { callback: () => void }');
    f.git('add', '--', file, 'src/engine/example.ts'); f.git('commit', '-qm', 'code and list grow together');
    const result = spawnSync(execPath, ['scripts/check-platform-ratchets.mjs', previous, f.root], { cwd: f.root, encoding: 'utf8' });
    expect(result.status).toBe(1); expect(result.stderr).toContain('new function allowance');
  });
  it('admits indexed Thin Ice runtime with its first ceiling and refuses a new runtime shard', () => {
    function shard(f: ReturnType<typeof repo>, slug: string): void {
      put(f.root, `src/shards/${slug}/manifest.ts`, `const manifest = { slug: '${slug}', name: '${slug}', order: 1, debugOptions: [], assetGlobs: [] };\n\n// oxlint-disable-next-line import/no-default-export -- F9 requires a manifest default export.\nexport default manifest;`);
      for (const file of ['plugin.ts', 'roster.ts', 'budgets.ts', 'runtime/action.ts']) put(f.root, `src/shards/${slug}/${file}`, 'export const value = 1;');
      put(f.root, `src/shards/${slug}/README.md`, '# Runtime fixture\n');
      genShardWords(f.root); f.git('add', '--', `src/shards/${slug}`, 'lint/shard-words.generated.json');
    }
    const thin = repo();
    const list = JSON.parse(readFileSync(join(thin.root, 'lint/shard-platform.json'), 'utf8')) as { baseline: Record<string, number>; enforced: Record<string, number> };
    list.baseline['thin-ice'] = 100; list.enforced['thin-ice'] = 20;
    put(thin.root, 'lint/shard-platform.json', JSON.stringify(list)); thin.git('add', '--', 'lint/shard-platform.json');
    shard(thin, 'thin-ice'); const admitted = thin.run(); expect(admitted.status, String(admitted.stderr)).toBe(0);
    const unknown = repo(); shard(unknown, 'brand-new');
    const refused = unknown.run(); expect(refused.status).toBe(1); expect(refused.stderr).toContain('custom runtime is reserved');
  });
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
  it('warns about per-file legacy changes for central regeneration while keeping source commits independent', () => {
    const f = repo();
    put(f.root, 'lint/ratchet.json', JSON.stringify({ 'wildshard/no-raw-random-time': { 'src/engine/example.ts': 1, 'src/engine/unrelated.ts': 2 } }));
    put(f.root, 'src/engine/example.ts', 'export const value = Math.random();');
    f.git('add', '--', 'lint/ratchet.json', 'src/engine/example.ts');
    expect(f.run().status).toBe(0);
    put(f.root, 'src/engine/example.ts', 'export const value = 2;'); f.git('add', '--', 'src/engine/example.ts');
    const cleaned = f.run(); expect(cleaned.status).toBe(0); expect(cleaned.stderr).toContain('central regeneration');
    put(f.root, 'src/engine/example.ts', 'export const value = Math.random() + Math.random();'); f.git('add', '--', 'src/engine/example.ts');
    const rose = f.run(); expect(rose.status).toBe(0); expect(rose.stderr).toContain('coordinator approval');
    put(f.root, 'src/engine/example.ts', 'export const value = 2;'); f.git('add', '--', 'src/engine/example.ts');
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
      'src/kit/a.ts': "import { x } from '@wildshard/engine'; import type { Y } from '@wildshard/engine'; import './b';",
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

describe('AG22 SHARDS.md layout tables from lint/shard-layout.json', () => {
  const layout = JSON.parse(readFileSync('lint/shard-layout.json', 'utf8')) as ShardLayout & { describe?: Record<string, string> };
  it('generates every required / allowed file and folder, and refuses one with no description', () => {
    const block = layoutBlock(layout);
    for (const name of [...layout.requiredFiles, ...layout.allowedFiles, ...layout.folders.map((f) => `${f}/`)]) expect(block).toContain(`| \`${name}\` |`);
    expect(() => layoutBlock({ ...layout, folders: [...layout.folders, 'newthing'] })).toThrow('newthing/ has no description');
  });
  it.runIf(existsSync('docs/SHARDS.md'))('docs/SHARDS.md holds the current tables (node scripts/gen-shard-layout-doc.mjs)', () => {
    const doc = readFileSync('docs/SHARDS.md', 'utf8');
    expect(withLayout(doc, layout)).toBe(doc);
  });
});

describe('SF1b historical platform allowances', () => {
  function compare(list: string, before: object, after: object): string[] {
    const root = temp(); put(root, 'before.json', JSON.stringify(before)); put(root, 'after.json', JSON.stringify(after));
    return comparePlatformList(list, join(root, 'before.json'), join(root, 'after.json'));
  }
  it('allows list shrinkage but refuses a new edge exemption', () => {
    expect(compare('lint/edge-exemptions.json', { levels: { old: 'reason' } }, { levels: {} })).toEqual([]);
    expect(compare('lint/edge-exemptions.json', { levels: {} }, { levels: { added: 'matching code' } }).join(',')).toContain('new edge exemption');
  });
  it('refuses raised, removed or oversized ceilings and altered or unknown baselines', () => {
    const before = { baseline: { alpha: 100 }, enforced: { alpha: 19 } };
    expect(compare('lint/shard-platform.json', before, { ...before, enforced: { alpha: 18 } })).toEqual([]);
    for (const after of [
      { ...before, enforced: { alpha: 20 } }, { ...before, enforced: {} },
      { ...before, enforced: { alpha: 21 } }, { ...before, baseline: { alpha: 101 } },
      { ...before, baseline: { alpha: 100, unknown: 10 } }, { ...before, enforced: { alpha: 19, unknown: 1 } },
    ]) expect(compare('lint/shard-platform.json', before, after).length).toBeGreaterThan(0);
  });
  it('holds per-shard coupling allowances against a prior committed list', () => {
    const before = { shards: { alpha: { counts: { 'ctx.app': 2 }, sites: {} } } };
    expect(compare('lint/shard-coupling.json', before, { shards: { alpha: { counts: { 'ctx.app': 1 }, sites: {} } } })).toEqual([]);
    expect(compare('lint/shard-coupling.json', before, { shards: { alpha: { counts: { 'ctx.app': 3 }, sites: {} } } }).join(',')).toContain('ctx.app rose 2 → 3');
    expect(compare('lint/shard-coupling.json', before, { shards: { beta: { counts: { 'ctx.app': 1 }, sites: {} } } }).join(',')).toContain('ctx.app rose 0 → 1');
  });
  it('holds sim site counts and owners against explicit predecessor files', () => {
    const before = { violations: { site: { count: 2, row: 'SF3c' } } };
    expect(compare('lint/sim-closure.json', before, { violations: {} })).toEqual([]);
    expect(compare('lint/sim-closure.json', before, { violations: { site: { count: 1, row: 'SF3c' } } })).toEqual([]);
    for (const after of [
      { violations: { site: { count: 3, row: 'SF3c' } } },
      { violations: { site: { count: 2, row: 'SF3b' } } },
      { violations: { added: { count: 1, row: 'SF3c' } } },
    ]) expect(compare('lint/sim-closure.json', before, after).length).toBeGreaterThan(0);
  });
  it('only shrinks reviewed schema leaves and preserves their owner and removal obligation', () => {
    const leaf = { reason: 'pure schema', owner: 'SF16', removal: 'move to data' };
    const before = { 'src/engine/render/families/params.ts': leaf };
    expect(compare('lint/sim-schema-leaves.json', before, {})).toEqual([]);
    expect(compare('lint/sim-schema-leaves.json', before, before)).toEqual([]);
    for (const after of [
      { added: leaf },
      { 'src/engine/render/families/params.ts': { ...leaf, owner: 'SF99' } },
      { 'src/engine/render/families/params.ts': { ...leaf, reason: 'allow renderer' } },
      { 'src/engine/render/families/params.ts': { reason: leaf.reason, owner: leaf.owner } },
    ]) expect(compare('lint/sim-schema-leaves.json', before, after).length).toBeGreaterThan(0);
  });
  it('admits Thin Ice only with a first-commit 20 % ceiling', () => {
    const before = { baseline: {}, enforced: {} };
    expect(compare('lint/shard-platform.json', before, { baseline: { 'thin-ice': 101 }, enforced: { 'thin-ice': 20 } })).toEqual([]);
    expect(compare('lint/shard-platform.json', before, { baseline: { 'thin-ice': 101 }, enforced: {} }).join(',')).toContain('first commit');
  });
});

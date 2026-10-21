// oxlint-disable-next-line import/no-nodejs-modules -- Spawn regression subprocesses with explicit sanitized environment.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute isolated harness expressions against regression fixtures without a browser.
import { runInNewContext } from 'node:vm';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise explicit path selection in fresh Node processes, without pin/build writes.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Read exact source fixtures and own tiny disposable resolver fixture only.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolver fixture uses explicit repository-relative temporary paths.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored byte hashes, not structural admission.
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { expect, test } from 'vitest';
import { createRootedPitcherProofOutput, createRootedPitcherProofSource } from '../src/shards/driftwood-isle/generators/rootedPitcherProof';
import { ROOTED_PITCHER_TABLES, rootedPitcherProofComposition, assertRootedPitcherProofComposition } from '../scripts/rooted-pitcher-proof-composition';
import type { PlatformDataSectionName } from '../src/format/platformDataSections';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { BRINE_PITCHER_NATIVE_OWNER_DECISIONS, BRINE_PITCHER_NATIVE_OWNER_STRIKES } from '../src/shards/driftwood-isle/generators/brinePitcherNativeOwnerCombat';
import { brinePitcherNativeOwnerClips } from '../src/shards/driftwood-isle/generators/brinePitcherNativeOwnerClips';

const metadata = readFileSync('test/proof/brine-pitcher-native-owner/source/core-runtime-study/metadata.json');
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
test('rooted product retains exact seven-bone metadata and real native owner clips', () => {
  const output = createRootedPitcherProofOutput(metadata);
  const bodies = output.namedFiles?.find(row => row.name === 'practice/bodies.json');
  if (bodies === undefined) throw new Error('Missing exact body metadata');
  expect(bodies.hash).toBe(hash(metadata)); expect(output.assets?.get(bodies.hash)).toEqual(Uint8Array.from(metadata));
  const motion = output.namedFiles?.find(row => row.name === 'poses/brine-pitcher-native-owner.json');
  if (motion === undefined) throw new Error('Missing native owner motion');
  const bytes = output.assets?.get(motion.hash);
  if (bytes === undefined) throw new Error('Missing motion bytes');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(brinePitcherNativeOwnerClips());
  expect(() => createRootedPitcherProofOutput(new TextEncoder().encode('{}'))).toThrow('exact retained');
});
test('rooted source is separate labelled WIP without island spawns', () => {
  const source = createRootedPitcherProofSource();
  expect(source.identity.name).toContain('NOT YET ADMITTED');
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
});
async function bundle(pre: boolean): Promise<{ code: string; files: Record<string, string> }> {
  const root = mkdtempSync(resolve('tmp/rooted-pitcher-resolver-')), files: Record<string, string> = {};
  const write = (path: string, text: string): void => { const absolute = resolve(root, path); mkdirSync(dirname(absolute), { recursive: true }); writeFileSync(absolute, text); };
  try {
    write('src/rootedPitcherProof.ts', `export const load = () => import('./rootedPitcherProofBoot');\n${ROOTED_PITCHER_TABLES.map((path, i) => `export { value as table${i} } from './${path.slice(4)}';`).join('\n')}`);
    write('src/rootedPitcherProofBoot.ts', "export const boot = 'ROOTED-PITCHER-BOOT';");
    for (const path of ROOTED_PITCHER_TABLES) write(`${path}.ts`, "export const value = 'GLOBAL-TABLE';");
    const tables = new Map(ROOTED_PITCHER_TABLES.map(path => [resolve(root, path), `export const value = 'PRIVATE-${path}';`]));
    const plugin = rootedPitcherProofComposition(root, tables); if (!pre) delete plugin.enforce;
    const result = await build({ root, configFile: false, publicDir: false, logLevel: 'silent',
      plugins: [plugin, { name: 'rooted-pitcher-resolved-fixture', load(id) {
        if (id.startsWith(`${root}/`)) files[id.slice(root.length + 1)] = 'exact-hash'; return null;
      } }], build: { write: false, minify: false, lib: { entry: resolve(root, 'src/rootedPitcherProof.ts'), formats: ['es'] } } });
    const output = Array.isArray(result) ? result[0] : result;
    if (output === undefined || !('output' in output)) throw new Error('Missing resolver fixture output');
    return { code: output.output.filter(row => row.type === 'chunk').map(row => row.code).join('\n'), files };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const expected = { 'src/rootedPitcherProof.ts': 'exact-hash', 'src/rootedPitcherProofBoot.ts': 'exact-hash' } as const;
test('actual Vite fixture exposes and refuses ordinary resolver ordering', async () => {
  const result = await bundle(false); expect(result.code).toContain('GLOBAL-TABLE');
  expect(() => assertRootedPitcherProofComposition(result.files, expected)).toThrow('Unexpected rooted Pitcher build input');
});
test('actual Vite fixture keeps exact private boot and replaces every generated table before filesystem resolution', async () => {
  const result = await bundle(true); expect(result.code).toContain('ROOTED-PITCHER-BOOT'); expect(result.code).not.toContain('GLOBAL-TABLE');
  for (const path of ROOTED_PITCHER_TABLES) expect(result.code).toContain(`PRIVATE-${path}`);
  expect(() => assertRootedPitcherProofComposition(result.files, expected)).not.toThrow();
  for (const path of Object.keys(expected)) expect(() => assertRootedPitcherProofComposition({ ...result.files, [path]: 'wrong' }, expected)).toThrow('Missing exact');
  for (const path of ['src/practice.ts', 'src/practiceBoot.ts', 'src/nativeOwnerProofBoot.ts', ...ROOTED_PITCHER_TABLES.map(table => `${table}.ts`)])
    expect(() => assertRootedPitcherProofComposition({ ...result.files, [path]: 'wrong' }, expected)).toThrow('Unexpected');
});
test('incomplete or extra private table maps fail closed', () => {
  expect(() => rootedPitcherProofComposition('/repo', new Map())).toThrow('exactly four');
  const tables = new Map(ROOTED_PITCHER_TABLES.map(path => [resolve('/repo', path), 'export {};']));
  tables.set('/repo/foreign', 'export {};'); expect(() => rootedPitcherProofComposition('/repo', tables)).toThrow('exactly four');
});


test('rooted source retains both real strikes and bounded native guest', () => {
  const output = createRootedPitcherProofOutput(metadata);
  const expectedSections = emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['sim/scripts', BRINE_PITCHER_NATIVE_OWNER_DECISIONS],
    ['actors/strikes', BRINE_PITCHER_NATIVE_OWNER_STRIKES], ['actors/moves', []],
  ]));
  for (const [path, bytes] of expectedSections.files) expect(output.platform?.files.get(path)).toEqual(bytes);
  expect(brinePitcherNativeOwnerClips().strikeIds).toEqual(['strike.pitcher.crown', 'strike.pitcher.bilateral']);
});


test('capture reads the real singular strike snapshot and refuses plural or inactive fixtures', () => {
  const harness = readFileSync('scripts/qa-rooted-pitcher-proof.mjs', 'utf8');
  const collect = /const control = typeof row\.control[^\n]+\n\s+if \(control\?\.strike[^\n]+/u.exec(harness)?.[0];
  const verdict = /report\.checks\.bothRealStrikes = [^\n]+/u.exec(harness)?.[0];
  if (collect === undefined || verdict === undefined) throw new Error('Missing actual streamed strike checks');
  const ids = ['strike.pitcher.crown', 'strike.pitcher.bilateral'];
  const check = (key: string, phase: string, compact = false): unknown => {
    const summary = { strikes: new Set<string>() };
    for (const currentId of ids) {
      const value = { [key]: { currentId, phase } };
      const row = { control: compact ? { $nativeEncoding: 'json-string', value } : JSON.stringify(value) };
      runInNewContext(collect, { row, summary });
    }
    return runInNewContext(`${verdict}; report.checks.bothRealStrikes;`, { cycle: summary, report: { checks: {} } });
  };
  expect(readFileSync('src/game/shardfile/borrowedDecisions.ts', 'utf8')).toContain('strike: runner.snapshot()');
  expect(check('strike', 'active')).toBe(true);
  expect(check('strikes', 'active')).toBe(false);
  expect(check('strike', 'windup')).toBe(false);
  expect(check('strike', 'active', true)).toBe(true);
  expect(check('strikes', 'active', true)).toBe(false);
});

test('proof paths preserve legacy defaults and require explicit safe paired retry destinations', () => {
  const inspect = (pin: string | undefined, output: string | undefined): string => {
    const env = { ...process.env }; delete env['ROOTED_PITCHER_PIN']; delete env['ROOTED_PITCHER_OUTPUT'];
    if (pin !== undefined) env['ROOTED_PITCHER_PIN'] = pin;
    if (output !== undefined) env['ROOTED_PITCHER_OUTPUT'] = output;
    return execFileSync(process.execPath, ['--input-type=module', '-e',
      "import { PIN, OUTPUT } from './scripts/rooted-pitcher-proof-pin.mjs'; console.log(JSON.stringify({ PIN, OUTPUT }));"],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };
  const pin = 'docs/reviews/rooted-pitcher-app/REGRESSION-UNWRITTEN.json';
  expect(JSON.parse(inspect(undefined, undefined))).toEqual({ PIN: 'docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-BUILD-PIN1.json', OUTPUT: 'tmp/rooted-pitcher-app1' });
  expect(JSON.parse(inspect(pin, 'tmp/rooted-pitcher-regression'))).toEqual({ PIN: pin, OUTPUT: 'tmp/rooted-pitcher-regression' });
  expect(() => inspect(pin, undefined)).toThrow();
  for (const output of ['/tmp/escape', 'tmp/../escape', 'tmp/rooted-pitcher-app1/nested']) expect(() => inspect(pin, output)).toThrow();
  expect(() => inspect('docs/reviews/rooted-pitcher-app/../escape.json', 'tmp/rooted-pitcher-regression')).toThrow();
});

test('isolated living collision selects the source body without browser author imports', () => {
  const boot = readFileSync('src/rootedPitcherProofBoot.ts', 'utf8');
  expect(boot).toContain("corpse: 'anchored-held', livingBodyBone: 'body'");
  expect(boot).not.toMatch(/(?:from\s*|import\s*\()['"](?:node:|[^'"]*generators\/)/u);
  const html = readFileSync('rooted-pitcher-proof.html', 'utf8');
  for (const label of ['SOURCE-BODY LIVING COLLISION', 'HELD DEATH/NO FOLD', 'NOT ADMITTED']) expect(html).toContain(label);
  expect(html).toContain('http-equiv="Content-Security-Policy" content="connect-src \'self\'"');
  for (const id of ['practice-start', 'practice-retry', 'practice-back']) expect(html).toContain(`id="${id}"`);
});

test('both isolated build stages disable implicit environment and PostCSS discovery', () => {
  const result: unknown = JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', `
      import { resolveConfig } from 'vite';
      import { isolatedProofBuildOptions } from './scripts/rooted-pitcher-proof-pin.mjs';
      const options = isolatedProofBuildOptions();
      const config = await resolveConfig({ ...options, configFile: false, publicDir: false }, 'build');
      console.log(JSON.stringify({ options, env: config.env }));
    `], { encoding: 'utf8', env: { NODE_ENV: 'production', VITE_PROOF_SENTINEL: 'fabricated-not-a-secret', VITE_SENTRY_DSN: 'fabricated-not-an-endpoint' } }));
  expect(result).toEqual({
    options: { envDir: false, envPrefix: [], mode: 'production', css: { postcss: { plugins: [] } },
      define: { 'import.meta.env.VITE_SENTRY_DSN': '""' } },
    env: { BASE_URL: '/', MODE: 'production', DEV: false, PROD: true },
  });
  const buildSource = readFileSync('scripts/build-rooted-pitcher-proof.mjs', 'utf8');
  expect(buildSource.match(/await build\(\{ \.\.\.isolatedOptions,/gu)).toHaveLength(2);
  expect(buildSource.match(/define: \{ \.\.\.isolatedOptions\.define,/gu)).toHaveLength(2);
  expect(buildSource).toContain('Unpinned build source:');
});

test('pre-build closure inventories runtime budgets rather than discovering them after load', () => {
  const result: unknown = JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', `
      import { SOURCE_ROOTS, sourceInventory } from './scripts/rooted-pitcher-proof-pin.mjs';
      const budgets = Object.fromEntries(Object.entries(sourceInventory()).filter(([path]) => path.startsWith('budgets/')));
      console.log(JSON.stringify({ roots: SOURCE_ROOTS, budgets }));
    `], { encoding: 'utf8', env: { NODE_ENV: 'production' } }));
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isRecord(result) || !isRecord(result['budgets'])) throw new Error('Malformed source inventory result');
  expect(result['roots']).toEqual(['src', 'scripts', 'vite', 'budgets']);
  expect(Object.keys(result['budgets']).length).toBeGreaterThan(0);
  for (const [path, digest] of Object.entries(result['budgets'])) expect(digest).toBe(hash(readFileSync(path)));
});

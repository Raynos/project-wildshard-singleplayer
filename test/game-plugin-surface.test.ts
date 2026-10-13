// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated package/consumer fixtures only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary native fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture sources without shell commands.
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { checkGamePluginExports, gamePluginSurface } from '../scripts/game-plugins.mjs';

// The real checkout is immutable within this file; fixture roots below still get a fresh scan after each edit.
const realSurface = gamePluginSurface();
const realExportCheck = checkGamePluginExports(undefined, realSurface);

it('keeps frozen compatibility exports visible and detects removed keys or definitions', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-plugin-surface-'));
  const put = (path: string, text: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  const exports = { './plugin/context': './plugin/context.ts', './shard/context': './plugin/context.ts', './private': './private.ts' };
  try {
    put('src/game/package.json', JSON.stringify({ exports }));
    put('src/game/plugin/context.ts', 'export const context = 1;');
    put('src/shards/ember/runtime/main.ts', "import '@wildshard/game/plugin/context'; import('@wildshard/game/missing');");
    put('src/shards/ember-legacy/world.ts', "import type { Context } from '@wildshard/game/shard/context';");
    put('src/shards/ember-legacy/new.ts', "import '@wildshard/game/shard/context';");
    put('test/consumer.ts', "type T = import('@wildshard/game/plugin/context').Context;");
    put('lint/legacy-shards.json', JSON.stringify({ shards: { 'ember-legacy': { files: { 'world.ts': 'sealed' } } } }));
    const report = gamePluginSurface(root);
    expect(report).toMatchObject({ enforcement: 'report-only', totalExports: 3, pluginExports: 1, withinPluginLimit: true, pluginOnly: false });
    expect(report.entries.find(row => row.key === './shard/context')).toMatchObject({ published: true, frozenConsumers: ['src/shards/ember-legacy/world.ts'], primaryConsumers: ['src/shards/ember-legacy/new.ts'] });
    expect(report.entries.find(row => row.key === './plugin/context')).toMatchObject({ primaryConsumers: ['src/shards/ember/runtime/main.ts'], otherConsumers: ['test/consumer.ts'] });
    expect(report.entries.find(row => row.key === './private')).toMatchObject({ published: false });
    expect(report.unresolved).toEqual([{ specifier: '@wildshard/game/missing', consumers: ['src/shards/ember/runtime/main.ts'] }]);
    put('src/game/package.json', JSON.stringify({ exports: { './plugin/context': exports['./plugin/context'] } }));
    expect(gamePluginSurface(root).unresolved).toContainEqual({ specifier: '@wildshard/game/shard/context', consumers: ['src/shards/ember-legacy/new.ts', 'src/shards/ember-legacy/world.ts'] });
    put('src/game/package.json', JSON.stringify({ exports: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`./plugin/module${i}`, './plugin/context.ts'])) }));
    expect(gamePluginSurface(root)).toMatchObject({ totalExports: 21, pluginExports: 21, withinPluginLimit: false, pluginOnly: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('derives compatibility from a registered actual importer and refuses its abandoned export', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-plugin-export-check-'));
  const put = (path: string, text: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  try {
    put('src/game/package.json', JSON.stringify({ exports: { './plugin/context': './plugin/context.ts', './old': './old.ts' } }));
    put('src/game/plugin/context.ts', 'export const context = 1;');
    put('src/game/old.ts', 'export const old = 1;');
    put('lint/legacy-shards.json', JSON.stringify({ shards: { 'ember-legacy': { files: { 'world.ts': 'sealed' } } } }));
    put('src/shards/ember-legacy/world.ts', "import '@wildshard/game/old';");
    expect(checkGamePluginExports(root)).toMatchObject({ failures: [], pluginExports: 1, legacyExports: 1 });
    put('src/shards/ember-legacy/world.ts', 'export const retired = 1;');
    put('src/shards/ember-legacy/unregistered.ts', "import '@wildshard/game/old';");
    expect(checkGamePluginExports(root).failures).toEqual(['./old: non-plugin export has no registered legacy importer']);
    put('src/game/package.json', JSON.stringify({ exports: { './plugin/context': './plugin/context.ts' } }));
    put('src/shards/ember-legacy/unregistered.ts', 'export const retired = 1;');
    expect(checkGamePluginExports(root).failures).toEqual([]);
    put('src/game/package.json', JSON.stringify({ exports: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`./plugin/module${i}`, `./plugin/module${i}.ts`])) }));
    for (let i = 0; i < 21; i++) put(`src/game/plugin/module${i}.ts`, 'export const context = 1;');
    expect(checkGamePluginExports(root).failures).toEqual(['game plugin exports 21 exceed 20']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses resurrection of the retired format exceptions without a sealed legacy importer', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-plugin-retired-format-'));
  const put = (path: string, text: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  const keys = ['./shardfile/schema', './shardfile/validate', './shardfile/splatTerrain'];
  try {
    put('src/game/package.json', JSON.stringify({ exports: Object.fromEntries(keys.map(key => [key, `${key}.ts`])) }));
    for (const key of keys) put(`src/game/${key.slice(2)}.ts`, 'export const contract = 1;');
    put('lint/legacy-shards.json', JSON.stringify({ shards: {} }));
    expect(checkGamePluginExports(root).temporary).toEqual([]);
    expect(checkGamePluginExports(root).failures).toEqual(keys.sort().map(key => `${key}: non-plugin export has no registered legacy importer`));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('enforces the real export surface and names only the remaining temporary migration exception', () => {
  const report = realExportCheck;
  expect(report.failures).toEqual([]);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  // shrink-only: no new temporary exception; retiring the last one is not a red (usage audit 2026-10-13)
  expect(report.temporary.map(row => row.key).filter(key => key !== './systems/looks/surfaceLooks')).toEqual([]);
  expect(report.temporary.every(row => row.owner.length > 0 && row.reason.length > 0)).toBe(true);
});


it('keeps every sealed consumer resolved after defining plugin consolidation', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  const frozen = report.entries.filter(row => row.frozenConsumers.length > 0);
  expect(frozen.length).toBeGreaterThan(0);
  for (const row of frozen) expect(row.published, row.key).toBe(true);
  for (const key of ["./combat/collisionPose","./systems/species/clips","./systems/looks/shaderFamily","./systems/looks/shaderEdits","./systems/kit/geometryPack","./systems/looks/modelLibrary","./systems/looks/canvasAtlas","./systems/kit/bakedGeometry","./systems/kit/mergedPrimitives","./shardfile/weaponHooks","./shardfile/weaponHooksClient","./shardfile/speciesBrains","./shardfile/speciesScripts","./shardfile/eliteScripts","./systems/effects/starter","./systems/effects/install","./systems/items/weaponHooks","./quest/npcRow","./quest/questGraph","./quest/headlessPrompts"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  for (const key of ['geometry', 'simulation', 'quests', 'prompts', 'weaponFamily', 'animation', 'effects']) {
    expect(report.entries.find(row => row.key === `./plugin/${key}`)).toMatchObject({ published: true, target: `./plugin/${key}.ts` });
  }
});


it('keeps frozen consumers resolved while retiring live-only product and host exports', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./shardfile/reportCard","./grid/memoryAdmission","./shardfile/revision","./shardfile/terrain","./shardfile/rows","./shardfile/assets","./shardfile/runtime","./shardfile/directorRuntime","./shardfile/assetGraph","./shardfile/validationReceipt","./shardfile/terrainEntries","./shardfile/sourceManifest","./shardfile/socketLiftApproach","./shardfile/clientScripts","./shardfile/nativeGround"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.some(row => row.key === './plugin/product')).toBe(false);
});


it('keeps starter recipes on their defining equipment plugin', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./weapons/starterEquipment"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/weaponFamily')).toMatchObject({ published: true, target: './plugin/weaponFamily.ts' });
});


it('keeps reward motion on its defining quest plugin', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./quest/rewardMotion"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/quests')).toMatchObject({ published: true, target: './plugin/quests.ts' });
});


it('keeps declared item families on their defining weapon plugin', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./systems/items/declared"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/weaponFamily')).toMatchObject({ published: true, target: './plugin/weaponFamily.ts' });
});


it('defines boot admission and prompt selection without compatibility wrappers', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./grid/recoveryBoot","./grid/pageBoot","./plugin/clientScript"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/context')).toMatchObject({ published: true, target: './plugin/context.ts' });
});


it('defines boot admission and prompt selection without compatibility wrappers', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./shardfile/loader","./plugin/boot"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/loader')).toMatchObject({ published: true, target: './plugin/loader.ts' });
});


it('defines boot admission and prompt selection without compatibility wrappers', () => {
  const report = realSurface;
  expect(report.unresolved).toEqual([]);
  for (const entry of report.entries.filter(row => row.frozenConsumers.length > 0)) expect(entry.published, entry.key).toBe(true);
  for (const key of ["./shardfile/simulation","./plugin/models"]) expect(report.entries.some(row => row.key === key), key).toBe(false);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.find(row => row.key === './plugin/simulation')).toMatchObject({ published: true, target: './plugin/simulation.ts' });
});

it('defines traversal laws in the mover plugin without a twenty-first public plugin', () => {
  const report = realSurface;
  expect(realExportCheck.failures).toEqual([]);
  expect(report.pluginExports).toBeLessThanOrEqual(20);
  expect(report.entries.some(row => row.key === './plugin/playerMode')).toBe(false);
  expect(report.entries.find(row => row.key === './plugin/mover')).toMatchObject({ published: true, target: './plugin/mover.ts' });
});

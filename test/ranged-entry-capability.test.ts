// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import * as geometry from '../src/engine/models/geometrySources';
import { HeldFinishes } from '../src/game/loadout/finishes';
import { prepareRangedPage } from '../src/game/loadout/rangedPage';
import { shardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { parseClientPlan } from '../src/format/clientPlan';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST } from '../src/shards/_template/discovery.generated';
import { RANGED_PAGE } from '../src/shards/pine-hollow/generators/rangedPage';

function fixture(finish = true, file = true) {
  const scope = new Scope('ranged-entry'), app = new App();
  const source = emptyShardfile({ slug: 'fixture-ranged', name: 'Ranged fixture', author: 'Fixture', revision: 1, seed: 3 });
  const pack = { url: 'https://example.invalid/finish.bin', rows: { bytes: 0, geometries: [] } };
  const sections = new Map<string, unknown>([['held/finishes', finish ? { source: pack } : {}], ['combat/items', {}]]);
  const name = 'client/ranged-page.json', rows = new TextEncoder().encode(JSON.stringify(RANGED_PAGE));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections,
    files: new Map([
      ...file ? [[name, { hash: 'ranged', url: 'https://example.invalid/ranged.json' }] as const] : [],
      [RANGED_PAGE.collection.pack.url, { hash: 'collection', url: 'https://example.invalid/collection.bin' }],
    ]), read: hash => hash === 'ranged' ? Promise.resolve(rows) : Promise.reject(new Error('Unexpected decode')) });
  const runtime: ShardRuntime = { world: null, play: null, step: null, interactables: [], overhead: [], objects: {}, hooks: {},
    viewer: () => { throw new Error('Preparation must not read the player'); }, horizonVeil: null };
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, MANIFEST, { shard: MANIFEST, runtime, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  return { ctx, pack, name };
}

test('declared preparation preserves both packed sources before finish admission and releases them on leave', async () => {
  const f = fixture(), register = vi.spyOn(geometry, 'registerPackedGeometrySource');
  const prepare = vi.spyOn(HeldFinishes, 'prepare').mockRejectedValue(new Error('finish admission boundary'));
  try {
    await expect(prepareRangedPage(f.ctx, RANGED_PAGE)).rejects.toThrow('finish admission boundary');
    expect(register.mock.calls).toEqual([
      [f.ctx.scope, RANGED_PAGE.finishSource, { ...f.pack, label: 'held finishes' }],
      [f.ctx.scope, RANGED_PAGE.collection.source, { url: 'https://example.invalid/collection.bin', rows: RANGED_PAGE.collection.pack.rows, label: 'trophy-wall' }],
    ]);
    expect(register.mock.invocationCallOrder[1]).toBeLessThan(prepare.mock.invocationCallOrder[0] ?? 0);
    f.ctx.scope.dispose();
    expect(() => geometry.readGeometrySource(f.ctx.scope, RANGED_PAGE.finishSource, [])).toThrow('Missing geometry source');
    expect(() => geometry.readGeometrySource(f.ctx.scope, RANGED_PAGE.collection.source, [])).toThrow('Missing geometry source');
  } finally { register.mockRestore(); prepare.mockRestore(); f.ctx.scope.dispose(); }
});

test('a missing finish source refuses before either geometry registration', async () => {
  const f = fixture(false), register = vi.spyOn(geometry, 'registerPackedGeometrySource');
  try {
    await expect(prepareRangedPage(f.ctx, RANGED_PAGE)).rejects.toThrow('Missing declared finish geometry');
    expect(register).not.toHaveBeenCalled();
  } finally { register.mockRestore(); f.ctx.scope.dispose(); }
});

test('the finite capability requires its admitted file and runs only in the entered world phase', async () => {
  const missing = fixture(true, false), f = fixture(), row = { kind: 'held.ranged-page', file: f.name };
  const prepare = vi.spyOn(HeldFinishes, 'prepare').mockRejectedValue(new Error('finish admission boundary'));
  try {
    expect(() => admitClientPlan({ version: 1, features: [row] }, missing.ctx.product)).toThrow('admitted data file');
    expect(() => parseClientPlan({ version: 1, features: [{ ...row, call: 'prepareRangedPage' }] })).toThrow();
    const plan = admitClientPlan({ version: 1, features: [row] }, f.ctx.product);
    await installClientPhase(f.ctx, plan, 'kit', f.ctx.scope);
    await installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'resident');
    expect(prepare).not.toHaveBeenCalled();
    await expect(installClientPhase(f.ctx, plan, 'world', f.ctx.scope, 'entered')).rejects.toThrow('finish admission boundary');
    expect(prepare).toHaveBeenCalledOnce();
  } finally { prepare.mockRestore(); missing.ctx.scope.dispose(); f.ctx.scope.dispose(); }
});

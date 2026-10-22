import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { MountedArsenal } from '../src/game/loadout/mounted';
import { ShardPlugin, type ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import { CLIENT_FEATURES, admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { entryOwner, lendEntryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { parseClientPlan } from '../src/format/clientPlan';
import { parseItems } from '../src/format/items';
import { emptyShardfile } from '../src/sdk/author';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

const mounted = { kind: 'held.mounted', arsenal: 'fixture.arsenal' } as const;
const paths = { kind: 'world.paths', rows: { id: 'fixture.paths', name: 'Paths' } } as const;
function fixture() {
  const parent = new Scope('mounted resident'), scope = parent.child('mounted entry');
  const source = { ...emptyShardfile({ slug: 'mounted-fixture', name: 'Mounted fixture', author: 'Fixture', revision: 1, seed: 4 }), items: parseItems(items) };
  const read = vi.fn(() => Promise.reject(new Error('Kit registration must not read a file')));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
    sections: new Map([['client/plan', { version: 1, features: [paths, mounted] }]]), files: new Map(), read });
  const arsenal = new MountedArsenal({ ...loadout, variants: { bow: { id: 'weapon.golden-bow', name: 'Golden Bow' }, blade: { id: 'weapon.naizagai', name: 'Naizagai' } } });
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const runtime: ShardRuntime = { world: legacyDouble<NonNullable<ShardRuntime['world']>>({}), step: null, play: null,
    interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const ctx = legacyDouble<ShardContext>({ scope, product, app:legacyDouble<ShardContext['app']>({equipment:null}), game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  return { parent, scope, product, arsenal, weapon, runtime, ctx, read };
}

test('mounted kit borrows the original prepared arsenal before ordinary kit consumers', async () => {
  const f = fixture(), order: string[] = [];
  publishEntryOwner(f.parent, 'mounted-arsenal', mounted.arsenal, f.arsenal);
  lendEntryOwner(f.scope, f.parent, 'mounted-arsenal', mounted.arsenal);
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  try {
    const plan = admitClientPlan(f.product.section('client/plan'), f.product);
    await installClientPhase(f.ctx, plan, 'kit', f.parent, 'resident');
    expect(order).toEqual([]);
    await installClientPhase(f.ctx, plan, 'kit', f.parent, 'entered');
    expect(order).toEqual(['mounted', 'paths']);
    expect(entryOwner(f.scope, 'mounted-arsenal', mounted.arsenal) === f.arsenal).toBe(true);
    expect(f.weapon.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: 'weapon.bow' }), expect.objectContaining({ id: 'weapon.sabre' }),
      expect.objectContaining({ id: 'weapon.spear' }), expect.objectContaining({ id: 'weapon.rifle' }),
    ]);
    expect(typeof f.runtime.buildEquipment).toBe('function');
    expect(f.arsenal.pageKit(f.ctx)).toBeNull();
    expect(() => f.arsenal.installPage(f.ctx)).toThrow('already installed');
    expect(f.read).not.toHaveBeenCalled();
    await expect(installClientPhase(f.ctx, plan, 'kit', f.parent, 'entered')).rejects.toThrow('already installed');
    expect(f.weapon).toHaveBeenCalledOnce();
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('missing and retiring mounted owners refuse before registration', async () => {
  const f = fixture(), plan = admitClientPlan({ version: 1, features: [mounted] }, f.product);
  try {
    await expect(installClientPhase(f.ctx, plan, 'kit', f.parent)).rejects.toThrow('Missing live entry owner');
    expect(f.weapon).not.toHaveBeenCalled();
    publishEntryOwner(f.parent, 'mounted-arsenal', mounted.arsenal, f.arsenal);
    lendEntryOwner(f.scope, f.parent, 'mounted-arsenal', mounted.arsenal);
    f.parent.onDispose(() => undefined);
    const retiring = f.parent.disposeSteps(); retiring.next();
    expect(f.scope.disposing).toBe(true); expect(f.scope.disposed).toBe(false);
    await expect(installClientPhase(f.ctx, plan, 'kit', f.parent)).rejects.toThrow('disposed');
    expect(() => f.arsenal.installPage(f.ctx)).toThrow('live native equipment');
    expect(f.weapon).not.toHaveBeenCalled();
    for (const _step of retiring) { /* Complete the actual sliced retirement. */ }
  } finally { f.parent.dispose(); }
});

test('the same arsenal can register a fresh entered kit after the old borrower leaves', async () => {
  const f = fixture();
  publishEntryOwner(f.parent, 'mounted-arsenal', mounted.arsenal, f.arsenal);
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => undefined);
  try {
    for (let visit = 0; visit < 2; visit++) {
      const scope = f.parent.child('visit');
      const ctx = { ...f.ctx, scope };
      lendEntryOwner(scope, f.parent, 'mounted-arsenal', mounted.arsenal);
      await installClientPhase(ctx, admitClientPlan(f.product.section('client/plan'), f.product), 'kit', f.parent);
      scope.dispose();
      expect(entryOwner(f.parent, 'mounted-arsenal', mounted.arsenal) === f.arsenal).toBe(true);
    }
    expect(f.weapon).toHaveBeenCalledTimes(2);
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('native feature selection preserves world, species and play without replaying unrelated kit rows', async () => {
  const f = fixture(), order: string[] = [];
  class Native extends ShardPlugin {
    override world(ctx: ShardContext): void { order.push('world'); publishEntryOwner(ctx.scope, 'mounted-arsenal', mounted.arsenal, f.arsenal); }
    override kit(): void { order.push('species'); }
    override play(ctx: ShardContext): void { expect(entryOwner(ctx.scope, 'mounted-arsenal', mounted.arsenal) === f.arsenal).toBe(true); order.push('play'); }
  }
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install');
  const policy = { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['kit'], features: ['held.mounted'] } } as const;
  const Entry = declaredRuntimeEntry(Native, Native, policy).default, plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(['world', 'species', 'mounted', 'play']);
    expect(path).not.toHaveBeenCalled(); expect(f.weapon).toHaveBeenCalledOnce(); expect(f.read).not.toHaveBeenCalled();
    expect(() => declaredRuntimeEntry(Native, Native, { ...policy, nativePlan: { phases: ['kit'], features: ['held.mounted', 'held.mounted'] } })).toThrow('feature selection');
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('a selected native kind must exist in the admitted plan before its kit effects', async () => {
  const f = fixture();
  class Native extends ShardPlugin { override kit(): void { /* The selected feature owns this phase's effects. */ } }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared',
    nativePlan: { phases: ['kit'], features: ['held.claims.prepare'] } }).default;
  try {
    const plugin = new Entry(undefined, undefined, () => false);
    await plugin.world(f.ctx);
    await expect(plugin.kit(f.ctx)).rejects.toThrow('Missing selected native client feature');
    expect(f.weapon).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

test('regional entry registers the same mounted owner once after native species and before play', async () => {
  const f = fixture(), order: string[] = [];
  class Native extends ShardPlugin {
    override world(ctx: ShardContext): void { order.push('world'); publishEntryOwner(ctx.scope, 'mounted-arsenal', mounted.arsenal, f.arsenal); }
    override kit(): void { order.push('species'); }
    override play(ctx: ShardContext): void { expect(entryOwner(ctx.scope, 'mounted-arsenal', mounted.arsenal) === f.arsenal).toBe(true); order.push('play'); }
  }
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  const resident: HybridResident = { instance: 'mounted', slug: f.product.slug, declaration: { entry: 'runtime/index.ts', binds: [] }, firstParty: true,
    scope: f.scope, runtime: f.runtime, context: (scope, runtime) => ({ context: { ...f.ctx, scope, game: { ...f.ctx.game, runtime } }, openKit: () => undefined, closeKit: () => undefined }) };
  const session = new HybridRuntimeSession(new Map([['mounted', resident]]), [{ slug: f.product.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Native }) }], f.parent);
  try {
    await session.prepare('mounted'); await session.enter({ instance: 'mounted', slug: f.product.slug }); session.leave();
    expect(order).toEqual(['world', 'species', 'mounted', 'paths', 'play']); expect(f.weapon).toHaveBeenCalledOnce();
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('mounted entry wire rejects executable, reflected, duplicate and ignored settings', () => {
  for (const row of [{ ...mounted, arsenal: () => 'anything' }, { ...mounted, owner: 'world' }, { ...mounted, file: 'ignored.json' }])
    expect(() => parseClientPlan({ version: 1, features: [row] })).toThrow();
  expect(() => parseClientPlan({ version: 1, features: [mounted, mounted] })).toThrow('Duplicate');
});

test('a mounted arsenal refuses competing equipment builders before any registration', () => {
  const f = fixture();
  try {
    expect(() => admitClientPlan({ version: 1, features: [mounted, { kind: 'held.claims.prepare', id: 'other.claims' }] }, f.product)).toThrow('sole native equipment builder');
    expect(() => admitClientPlan({ version: 1, features: [mounted, { kind: 'held.ranged-page', file: 'other.json' }] }, f.product)).toThrow('sole native equipment builder');
    expect(f.weapon).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

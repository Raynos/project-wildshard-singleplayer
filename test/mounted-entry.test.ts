import { afterEach, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { HeldClaims } from '../src/game/loadout/claims';
import * as geometry from '../src/game/plugin/geometry';
import { heldSlotRows } from '../src/shards/nalati-grasslands/generators/heldSlots';
import power from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { declaredClientPlanEntry } from '../src/game/shard/declaredEntry';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import { CLIENT_FEATURES, admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { entryOwner, lendEntryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { parseClientPlan } from '../src/format/clientPlan';
import { parseItems } from '../src/format/items';
import { emptyShardfile } from '../src/sdk/author';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type: 'json' };
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

afterEach(()=>{vi.restoreAllMocks();});
const mounted = { kind: 'held.claims.install', claims: 'fixture.arsenal',preparation:'world' } as const;
const paths = { kind: 'world.paths', rows: { id: 'fixture.paths', name: 'Paths' } } as const;
async function fixture() {
  const parent = new Scope('mounted resident'), scope = parent.child('mounted entry');
  const source = { ...emptyShardfile({ slug: 'mounted-fixture', name: 'Mounted fixture', author: 'Fixture', revision: 1, seed: 4 }), items: parseItems(items) };
  const book={rows:[],packed:{bin:'/assets/fixture/gear.bin',bytes:0,rows:[]},materials:{}};
  const read=vi.fn(()=>Promise.resolve(new TextEncoder().encode(JSON.stringify(book))));
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
    sections: new Map([['client/plan', { version: 1, features: [paths, mounted] }]]), files: new Map(['models/gear.json','weapons/bow-page.json',loadout.blade.file,loadout.polearm.file,loadout.page.firearm.file].map(name=>[name,{hash:'a'.repeat(64),url:`/fixture/${name}`} ])), read });
  const slots=heldSlotRows({ ...loadout, variants: { bow: { id: 'weapon.golden-bow', name: 'Golden Bow' }, blade: { id: 'weapon.naizagai', name: 'Naizagai' } } },power);
  const arsenal=HeldClaims.fromProductSlots(product,{...slots,id:mounted.claims},'models/gear.json');
  vi.spyOn(arsenal.blade('blade'),'prepare').mockResolvedValue();vi.spyOn(arsenal.polearm('polearm'),'prepare').mockResolvedValue();
  vi.spyOn(arsenal.blade('blade'),'profile').mockReturnValue(legacyDouble<ReturnType<ReturnType<typeof arsenal.blade>['profile']>>({}));
  vi.spyOn(arsenal.polearm('polearm'),'profile').mockReturnValue(legacyDouble<ReturnType<ReturnType<typeof arsenal.polearm>['profile']>>({}));
  vi.spyOn(geometry,'fetchLaneBake').mockResolvedValue(new Uint8Array());
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const runtime: ShardRuntime = { world: legacyDouble<NonNullable<ShardRuntime['world']>>({}), step: null, play: null,
    interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const ctx = legacyDouble<ShardContext>({ scope, product, app:legacyDouble<ShardContext['app']>({equipment:null}), game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  await arsenal.prepareSlotSources({...ctx,scope:parent});read.mockClear();read.mockRejectedValue(new Error('Kit registration must not read a file'));
  return { parent, scope, product, arsenal, weapon, runtime, ctx, read };
}

test('mounted kit borrows the original prepared arsenal before ordinary kit consumers', async () => {
  const f = await fixture(), order: string[] = [];
  publishEntryOwner(f.parent, 'claims', mounted.claims, f.arsenal);
  lendEntryOwner(f.scope, f.parent, 'claims', mounted.claims);
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  try {
    const plan = admitClientPlan(f.product.section('client/plan'), f.product);
    await installClientPhase(f.ctx, plan, 'kit', f.parent, 'resident');
    expect(order).toEqual([]);
    await installClientPhase(f.ctx, plan, 'kit', f.parent, 'entered');
    expect(order).toEqual(['mounted', 'paths']);
    expect(entryOwner(f.scope, 'claims', mounted.claims) === f.arsenal).toBe(true);
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
  const f = await fixture(), plan = admitClientPlan({ version: 1, features: [mounted] }, f.product);
  try {
    await expect(installClientPhase(f.ctx, plan, 'kit', f.parent)).rejects.toThrow('Missing live entry owner');
    expect(f.weapon).not.toHaveBeenCalled();
    publishEntryOwner(f.parent, 'claims', mounted.claims, f.arsenal);
    lendEntryOwner(f.scope, f.parent, 'claims', mounted.claims);
    f.parent.onDispose(() => undefined);
    const retiring = f.parent.disposeSteps(); retiring.next();
    expect(f.scope.disposing).toBe(true); expect(f.scope.disposed).toBe(false);
    await expect(installClientPhase(f.ctx, plan, 'kit', f.parent)).rejects.toThrow('disposed');
    expect(() => f.arsenal.installPage(f.ctx)).toThrow('owner has ended');
    expect(f.weapon).not.toHaveBeenCalled();
    for (const _step of retiring) { /* Complete the actual sliced retirement. */ }
  } finally { f.parent.dispose(); }
});

test('the same arsenal can register a fresh entered kit after the old borrower leaves', async () => {
  const f = await fixture();
  publishEntryOwner(f.parent, 'claims', mounted.claims, f.arsenal);
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => undefined);
  try {
    for (let visit = 0; visit < 2; visit++) {
      const scope = f.parent.child('visit');
      const ctx = { ...f.ctx, scope };
      lendEntryOwner(scope, f.parent, 'claims', mounted.claims);
      await installClientPhase(ctx, admitClientPlan(f.product.section('client/plan'), f.product), 'kit', f.parent);
      scope.dispose();
      expect(entryOwner(f.parent, 'claims', mounted.claims) === f.arsenal).toBe(true);
    }
    expect(f.weapon).toHaveBeenCalledTimes(2);
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('the compiled entry installs its full kit plan against the original prepared mounted owner', async () => {
  const f = await fixture(), order: string[] = [];
  publishEntryOwner(f.ctx.scope, 'claims', mounted.claims, f.arsenal);
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  const Entry = declaredClientPlanEntry({ retainHomeRuntime: true, stagesOwner: 'declared' }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); expect(f.weapon).not.toHaveBeenCalled();
    await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(['mounted', 'paths']);
    expect(entryOwner(f.ctx.scope, 'claims', mounted.claims)).toBe(f.arsenal);
    expect(path).toHaveBeenCalledOnce(); expect(f.weapon).toHaveBeenCalledOnce(); expect(f.read).not.toHaveBeenCalled();
  } finally { path.mockRestore(); f.parent.dispose(); }
});



test('compiled regional entry registers the same mounted owner once after kit opens and before play', async () => {
  const f = await fixture(), order: string[] = [];
  f.weapon.mockImplementation(() => { order.push('mounted'); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  const resident: HybridResident = { instance: 'mounted', slug: f.product.slug, declaration: null, product: f.product, firstParty: true,
    scope: f.scope, runtime: f.runtime, context: (scope, runtime) => ({ context: { ...f.ctx, scope, game: { ...f.ctx.game, runtime } },
      beforeWorld: entered => { order.push('world'); publishEntryOwner(entered.scope, 'claims', mounted.claims, f.arsenal); },
      openKit: () => { order.push('kit-open'); }, closeKit: () => undefined,
      afterPlay: entered => { expect(entryOwner(entered.scope, 'claims', mounted.claims) === f.arsenal).toBe(true); order.push('play'); } }) };
  const session = new HybridRuntimeSession(new Map([['mounted', resident]]), f.parent);
  try {
    await session.prepare('mounted'); await session.enter({ instance: 'mounted', slug: f.product.slug }); session.leave();
    expect(order).toEqual(['world', 'kit-open', 'mounted', 'paths', 'play']); expect(f.weapon).toHaveBeenCalledOnce();
  } finally { path.mockRestore(); f.parent.dispose(); }
});

test('mounted entry wire rejects executable, reflected, duplicate and ignored settings', () => {
  for (const row of [{ ...mounted, claims: () => 'anything' }, { ...mounted, owner: 'world' }, { ...mounted, file: 'ignored.json' }])
    expect(() => parseClientPlan({ version: 1, features: [row] })).toThrow();
  expect(() => parseClientPlan({ version: 1, features: [mounted, mounted] })).toThrow('Duplicate');
});

test('a mounted arsenal refuses competing equipment builders before any registration', async () => {
  const f = await fixture();
  try {
    expect(() => admitClientPlan({ version: 1, features: [mounted, { kind: 'held.claims.prepare', id: 'other.claims' }] }, f.product)).toThrow('cannot repeat kit preparation');
    expect(() => admitClientPlan({ version: 1, features: [mounted, { kind: 'held.ranged-page', file: 'other.json' }] }, f.product)).toThrow('sole native equipment builder');
    expect(f.weapon).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

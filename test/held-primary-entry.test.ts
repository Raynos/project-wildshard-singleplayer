import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { Sword } from '../src/game/weapons/Sword';
import { HeldClaims } from '../src/game/loadout/claims';
import { ShardPlugin } from '../src/game/shard/plugin';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { HybridRuntimeSession, type HybridResident } from '../src/game/shardfile/hybrid';
import { Vector3 } from 'three';
import * as melee from '../src/game/loadout/declaredMelee';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { prepareHeldClaimsEntry, installHeldClaimsEntry } from '../src/game/shardfile/heldClaimsEntry';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { parseItems } from '../src/format/items';
import { HeldArmsSchema } from '../src/format/heldArms';
import { MeleeWeaponProfileSchema } from '../src/format/weaponProfiles';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

const rows = { kind: 'declared-primary', primary: { item: 'weapon.jian', blade: 'wood', file: 'weapons/presentation.json' }, tools: ['tool.fei-zhua'] };
const defaultPresentation = { portraitFov: 78, aim: {}, view: {} };
function fixture(presentation: unknown = defaultPresentation, pending?: Promise<Uint8Array>, input: unknown = rows) {
  const parent = new Scope('primary-parent'), scope = parent.child('primary-entry'), slug = 'primary-fixture';
  const source = { ...emptyShardfile({ slug, name: 'Primary fixture', author: 'Fixture', revision: 1, seed: 7 }), items: parseItems(items) };
  const read = vi.fn(() => pending ?? Promise.resolve(new TextEncoder().encode(JSON.stringify(presentation))));
  const product = createShardProduct({ slug, revision: 1, shardfile: source, sections: new Map<string, unknown>([['held/arms', input], ['client/plan', { version: 1, features: [{ kind: 'held.claims.prepare', id: 'primary.claims' }, { kind: 'held.claims.install', claims: 'primary.claims' }] }]]),
    files: new Map([[rows.primary.file, { hash: 'a'.repeat(64), url: '/fixture/presentation.json' }]]), read });
  const runtime: ShardRuntime = { world: legacyDouble<NonNullable<ShardRuntime['world']>>({}), step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const tool = vi.fn<ShardContext['rows']['tool']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ tool }) });
  return { parent, scope, ctx, read, tool, slug, runtime };
}

test('declared primary phases lend the original installed melee owner without preparing another rig', async () => {
  const f = fixture(), sword = legacyDouble<Sword>({}), primary = () => sword;
  const item = f.ctx.product.shardfile.items.rows.find(row => row.id === 'weapon.jian');
  if (item?.kind !== 'weapon') throw new Error('Missing fixture weapon');
  const installed = { profile: v.parse(MeleeWeaponProfileSchema, item.profile), primary };
  const install = vi.spyOn(melee, 'installDeclaredMelee').mockReturnValue(installed);
  try {
    await prepareHeldClaimsEntry(f.ctx, 'primary.claims');
    const claims = entryOwner(f.scope, 'claims', 'primary.claims');
    expect(claims).toBe(HeldClaims.current(f.slug));
    expect(() => claims.melee()).toThrow('not installed');
    expect(install).not.toHaveBeenCalled(); expect(f.tool).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledOnce();
    installHeldClaimsEntry(f.ctx, 'primary.claims');
    expect(install).toHaveBeenCalledOnce();
    expect(install.mock.calls[0]?.[0] === f.ctx).toBe(true);
    expect(install.mock.calls[0]?.[1]).toEqual({ item: 'weapon.jian', blade: 'wood', portraitFov: 78 });
    expect(claims.melee()).toBe(installed); expect(claims.melee().primary() === sword).toBe(true);
    expect(f.tool).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'tool.fei-zhua' }));
    expect(() => installHeldClaimsEntry(f.ctx, 'primary.claims')).toThrow('already installed');
    expect(() => claims.display('anything')).toThrow('no Toon claim display');
    f.scope.dispose(); expect(() => claims.melee()).toThrow('ended');
    expect(() => HeldClaims.current(f.slug)).toThrow('not prepared');
  } finally { install.mockRestore(); f.parent.dispose(); }
});

test.each([{}, { portraitFov: 0 }, { portraitFov: 180 }, { portraitFov: '78' }])('primary preparation refuses invalid presentation %j', async presentation => {
  const f = fixture(presentation);
  try {
    await expect(prepareHeldClaimsEntry(f.ctx, 'primary.claims')).rejects.toThrow();
    expect(() => entryOwner(f.scope, 'claims', 'primary.claims')).toThrow('Missing live entry owner');
    expect(() => HeldClaims.current(f.slug)).toThrow('not prepared'); expect(f.tool).not.toHaveBeenCalled();
  } finally { f.parent.dispose(); }
});

test('a sliced retiring ancestor prevents a pending primary from publishing its loan', async () => {
  let finish: ((bytes: Uint8Array) => void) | undefined;
  const pending = new Promise<Uint8Array>(resolve => { finish = resolve; }), f = fixture(undefined, pending);
  const preparation = prepareHeldClaimsEntry(f.ctx, 'primary.claims');
  f.parent.onDispose(() => undefined); const retirement = f.parent.disposeSteps(); retirement.next();
  try {
    expect(f.scope.disposing).toBe(true); expect(f.scope.disposed).toBe(false);
    if (finish === undefined) throw new Error('Missing presentation read'); finish(new TextEncoder().encode('{"portraitFov":78}'));
    await expect(preparation).rejects.toThrow('owner ended during preparation');
    expect(() => HeldClaims.current(f.slug)).toThrow('not prepared'); expect(f.tool).not.toHaveBeenCalled();
  } finally { for (const _step of retirement) { /* Drain the actual original owner. */ } }
});

test('primary rows reject callbacks, unknown fields and repeated tools before reads', () => {
  expect(v.parse(HeldArmsSchema, rows)).toEqual(rows);
  for (const bad of [{ ...rows, tools: ['tool.fei-zhua', 'tool.fei-zhua'] }, { ...rows, owner: 'anything' },
    { ...rows, primary: { ...rows.primary, portraitFov: 80 } }, { ...rows, primary: { ...rows.primary, file: () => 'anything' } }])
    expect(() => v.parse(HeldArmsSchema, bad)).toThrow();
});


test('the actual native entry runs the primary kit once between its original world and play', async () => {
  const f = fixture(), order: string[] = [], item = f.ctx.product.shardfile.items.rows.find(row => row.id === 'weapon.jian');
  if (item?.kind !== 'weapon') throw new Error('Missing fixture weapon');
  const installed = { profile: v.parse(MeleeWeaponProfileSchema, item.profile), primary: () => legacyDouble<Sword>({}) };
  const install = vi.spyOn(melee, 'installDeclaredMelee').mockImplementation(() => { order.push('kit'); return installed; });
  class Native extends ShardPlugin {
    override world(): void { order.push('world'); }
    override play(ctx: ShardContext): void { expect(entryOwner(ctx.scope, 'claims', 'primary.claims').melee()).toBe(installed); order.push('play'); }
  }
  const Entry = declaredRuntimeEntry(Native, Native, { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['kit'] } }).default;
  const plugin = new Entry(undefined, undefined, () => false);
  try {
    await plugin.world(f.ctx); expect(install).not.toHaveBeenCalled();
    await plugin.kit(f.ctx); await plugin.play(f.ctx);
    expect(order).toEqual(['world', 'kit', 'play']); expect(install).toHaveBeenCalledOnce(); expect(f.tool).toHaveBeenCalledOnce();
  } finally { install.mockRestore(); f.parent.dispose(); }
});


test.each(['tool.absent', 'weapon.jian'])('a later invalid tool %s refuses before primary or tool effects', async bad => {
  const f = fixture({ portraitFov: 78 }, undefined, { ...rows, tools: ['tool.fei-zhua', bad] });
  const install = vi.spyOn(melee, 'installDeclaredMelee');
  try {
    await prepareHeldClaimsEntry(f.ctx, 'primary.claims');
    expect(() => installHeldClaimsEntry(f.ctx, 'primary.claims')).toThrow();
    expect(install).not.toHaveBeenCalled(); expect(f.tool).not.toHaveBeenCalled();
    expect(() => entryOwner(f.scope, 'claims', 'primary.claims').melee()).toThrow('not installed');
  } finally { install.mockRestore(); f.parent.dispose(); }
});


test('the regional hybrid borrows one declared primary through its original kit boundary', async () => {
  const f = fixture(), order: string[] = [], item = f.ctx.product.shardfile.items.rows.find(row => row.id === 'weapon.jian');
  if (item?.kind !== 'weapon') throw new Error('Missing fixture weapon');
  const installed = { profile: v.parse(MeleeWeaponProfileSchema, item.profile), primary: () => legacyDouble<Sword>({}) };
  const install = vi.spyOn(melee, 'installDeclaredMelee').mockImplementation(() => { order.push('kit'); return installed; });
  class Native extends ShardPlugin {
    override world(): void { order.push('world'); }
    override play(ctx: ShardContext): void { expect(entryOwner(ctx.scope, 'claims', 'primary.claims').melee()).toBe(installed); order.push('play'); }
  }
  const resident: HybridResident = { instance: 'primary', slug: f.slug, declaration: { entry: 'runtime/index.ts', binds: [] },
    firstParty: true, scope: f.scope, runtime: f.runtime, context: (scope, runtime) => ({
      context: { ...f.ctx, scope, game: { ...f.ctx.game, runtime } }, openKit: () => undefined, closeKit: () => undefined,
    }) };
  const session = new HybridRuntimeSession(new Map([['primary', resident]]), [{ slug: f.slug, entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Native }) }], f.parent);
  try {
    await session.prepare('primary'); await session.enter({ instance: 'primary', slug: f.slug }); session.leave();
    expect(order).toEqual(['world', 'kit', 'play']); expect(install).toHaveBeenCalledOnce(); expect(f.tool).toHaveBeenCalledOnce();
  } finally { install.mockRestore(); f.parent.dispose(); }
});


test('declared held rows emit through actual platform admission and their exact schema bridge', () => {
  const schema = namedJsonSchema(HeldArmsSchema);
  const emitted = emitPlatformSections(new Map([['held/arms', rows]])), bytes = emitted.files.get('sections/held/arms.json');
  if (bytes === undefined) throw new Error('Missing held section');
  expect(validateNamedJsonSchema(schema, bytes)).toEqual(rows);
  const duplicate = { ...rows, tools: ['tool.fei-zhua', 'tool.fei-zhua'] };
  expect(() => validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(duplicate)))).toThrow();
  expect(() => emitPlatformSections(new Map([['held/arms', duplicate]]))).toThrow();
});

import { expect, test, vi } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { App } from '../src/engine/app/app';
import { heldSwordWorld } from './fixtures/heldNativeSword';
import { Sword } from '../src/game/weapons/Sword';
import { Scope } from '../src/engine/app/scope';
import { ToonLook } from '../src/engine/render/families/toon';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { HeldClaims } from '../src/game/loadout/claims';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { prepareHeldClaimsEntry, installHeldClaimsEntry } from '../src/game/shardfile/heldClaimsEntry';
import * as compiler from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import { HELD_ARMS } from '../src/shards/driftwood-isle/generators/heldArms';
import { DRIFTWOOD_SWORDS } from '../src/shards/driftwood-isle/generators/items';
import { legacyDouble } from './fake/FakeGame';

type Looks = Awaited<ReturnType<typeof compiler.runtimeLookMaterials>>;
function fixture() {
  const parent = new Scope('kit-parent'), scope = parent.child('kit-entry');
  const rows = { ...HELD_ARMS, slug: 'kit-fixture', claims: [] };
  const source = { ...emptyShardfile({ slug: rows.slug, name: 'Kit fixture', author: 'Fixture', revision: 1, seed: 7 }), items: parseItems(DRIFTWOOD_SWORDS),runtime:{entry:'runtime/fixture.ts',binds:['items' as const]} };
  const product = createShardProduct({ slug: rows.slug, revision: 1, shardfile: source, sections: new Map([['held/arms', rows]]), files: new Map(),
    read: () => Promise.reject(new Error('No geometry claimed in fixture')) });
  const app=new App(),native=heldSwordWorld();scope.onDispose(native.dispose);
  parent.onDispose(()=>{app.engineScope.dispose();});
  const runtime = legacyDouble<ShardRuntime>({ world: legacyDouble<NonNullable<ShardRuntime['world']>>(native.world) });
  const weapon = vi.fn<ShardContext['rows']['weapon']>();
  const ctx = legacyDouble<ShardContext>({ app,scope, product, game: legacyDouble<ShardContext['game']>({ runtime }),
    rows: legacyDouble<ShardContext['rows']>({ weapon }) });
  const materials = new Map(Object.values(rows.look.materials).map(id => [id, new MeshBasicMaterial()]));
  const looks: Looks = { toon: new ToonLook(), materials, setParam: vi.fn<Looks['setParam']>(), setTexture: vi.fn<Looks['setTexture']>(),
    textures: new Map(), compile: () => new MeshBasicMaterial(), bindMeshMap: () => new MeshBasicMaterial(), tick: () => undefined,
    outline: () => [], graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } }, surfaces: null };
  const dispose = (): void => { parent.dispose(); for (const material of materials.values()) material.dispose(); };
  return { parent, scope, rows, ctx, runtime, weapon, looks, dispose, native };
}

test('claim phases use the actual entered preparation and preserve native weapon order', async () => {
  const f = fixture(), compile = vi.spyOn(compiler, 'runtimeLookMaterials').mockResolvedValue(f.looks);
  try {
    expect(() => installHeldClaimsEntry(f.ctx, 'kit.claims')).toThrow('Missing live entry owner');
    expect(f.weapon).not.toHaveBeenCalled();
    await prepareHeldClaimsEntry(f.ctx, 'kit.claims');
    const claims = entryOwner(f.scope, 'claims', 'kit.claims');
    expect(claims).toBeInstanceOf(HeldClaims); expect(claims).toBe(HeldClaims.current(f.rows.slug));
    expect(f.weapon).not.toHaveBeenCalled();
    installHeldClaimsEntry(f.ctx, 'kit.claims');
    expect(f.weapon).toHaveBeenCalledOnce();
    expect(f.weapon.mock.calls[0]?.[0]).toMatchObject([{ id: 'weapon.sword' }, { id: 'weapon.sword-iron' }]);
    expect(f.runtime.buildEquipment).toBeTypeOf('function');
    const other = f.parent.child('other-entry');
    expect(() => entryOwner(other, 'claims', 'kit.claims')).toThrow('Missing live entry owner');
    f.scope.dispose();
    expect(() => entryOwner(f.scope, 'claims', 'kit.claims')).toThrow('ended');
    expect(() => HeldClaims.current(f.rows.slug)).toThrow('not prepared');
  } finally { compile.mockRestore(); f.dispose(); }
});

test.each([false, true])('retired claim preparation never publishes a late loan (ancestor: %s)', async ancestor => {
  const f = fixture(); let finish: ((value: Looks) => void) | undefined;
  const pending = new Promise<Looks>(resolve => { finish = resolve; });
  const compile = vi.spyOn(compiler, 'runtimeLookMaterials').mockReturnValue(pending);
  let retirement: Generator | undefined;
  try {
    const preparing = prepareHeldClaimsEntry(f.ctx, 'kit.claims');
    if (ancestor) {
      f.parent.onDispose(() => undefined); retirement = f.parent.disposeSteps(); retirement.next();
      expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    } else f.scope.dispose();
    if (finish === undefined) throw new Error('Missing preparation resolver'); finish(f.looks);
    await expect(preparing).rejects.toThrow(ancestor ? 'owner ended during preparation' : 'scope unloaded during preparation');
    expect(f.weapon).not.toHaveBeenCalled();
    expect(() => entryOwner(f.scope, 'claims', 'kit.claims')).toThrow('ended');
  } finally {
    if (retirement !== undefined) for (const _step of retirement) { /* Drain the actual original owner. */ }
    compile.mockRestore(); f.dispose();
  }
  expect(() => HeldClaims.current(f.rows.slug)).toThrow('not prepared');
});


test('both native Toon swords use the shared factory with their original arm loans and order', async () => {
  const f=fixture(),compile=vi.spyOn(compiler,'runtimeLookMaterials').mockResolvedValue(f.looks);
  try {
    await prepareHeldClaimsEntry(f.ctx,'kit.claims');installHeldClaimsEntry(f.ctx,'kit.claims');
    const build=f.runtime.buildEquipment;if(build===undefined)throw new Error('Missing original builder');
    const iron=heldSwordWorld();
    try {
      const built=await build({raycast:()=>null},false,{arms:f.native.arms,ironArms:iron.arms});
      expect(built.primary).toBeInstanceOf(Sword);expect(built.extras).toHaveLength(1);
      const extra=built.extras?.[0];expect(extra).toBeInstanceOf(Sword);
      if(!(built.primary instanceof Sword)||!(extra instanceof Sword))throw new Error('Missing native swords');
      expect(built.primary.model.getObjectById(f.native.arms.root.id)).toBe(f.native.arms.root);
      expect(extra.model.getObjectById(iron.arms.root.id)).toBe(iron.arms.root);
      expect([built.primary.id,extra.id]).toEqual(['sword','sword-iron']);
      expect([built.primary.row.id,extra.row.id]).toEqual(['weapon.sword','weapon.sword-iron']);
      expect(built.rifle).toBeNull();expect(built.secondary).toBeNull();
    } finally {iron.dispose();}
  } finally {compile.mockRestore();f.dispose();}
});

import { BladeSet } from '../src/game/weapons/mountedBlade';
import { HeldClaims } from '../src/game/loadout/claims';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import * as geometryTools from '../src/game/plugin/geometry';
import loadout from '../src/shards/nalati-grasslands/data/loadout.json' with { type: 'json' };
import { originalHeldMetadata } from './fixtures/nalati-held-original';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the emitted GLB against its original authoring geometry.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { parse } from 'valibot';
import { PackedSpecimenSchema } from '../src/format/specimenCatalogue';
import { MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSabre as authorSabre, SABRE_PROFILE as authorProfile, PASS_LEFT, PASS_RIGHT } from '../src/shards/nalati-grasslands/generators/sabre';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import { nalatiSabrePool, SABRE_POOL_NAME } from '../src/shards/nalati-grasslands/generators/sabrePool';

const { glb: poolGlb, rows } = nalatiSabrePool();

const { held: heldWeapons } = originalHeldMetadata();

const {polearm:_polearm,blade:_blade,programs:_programs,compiled:_compiled,...weaponPower}=heldWeapons;

const blade = new BladeSet({file:loadout.blade.file,item:'weapon.sabre'});

test('re-entry rehydrates an evicted real blade pool before synchronous consumers',async()=>{
  const parent=new Scope('retired-held-cache'),scope=parent.child('first-entry'),material=new MeshBasicMaterial();
  const source={...emptyShardfile({slug:'sabre-test',name:'Sabre',author:'Fixture',revision:1,seed:1}),items:parseItems(items)};
  const bookFile='models/gear-book.json',book={rows:[{key:'reward',model:{id:'fixture/reward',name:'Reward',file:'fixture.ts',category:'gear',pipeline:'code',defaults:{}},source:{kind:'packed'}}],
    packed:{bin:'/assets/fixture/gear.bin',bytes:0,rows:[{key:'reward',parts:[]}]},materials:{}};
  const data={...rows,program:heldWeapons.programs.blade,power:{...weaponPower,program:heldWeapons.programs.power},parts:heldWeapons.blade};
  const read=vi.fn((hash:string)=>Promise.resolve(new TextEncoder().encode(JSON.stringify(hash==='blade'?data:book))));
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map(),
    files:new Map([[bookFile,{hash:'book',url:'/fixture/book'}],[loadout.blade.file,{hash:'blade',url:'/fixture/blade'}],[SABRE_POOL_NAME,{hash:'sabre-pool',url:'/fixture/sabre-pool.glb'}]]),read});
  const held=HeldClaims.fromProductSlots(product,{version:1,id:'retired-kit',slots:[
    {id:'blade',kind:'blade',item:'weapon.sabre',source:{kind:'passes',file:loadout.blade.file}}],
    registration:['blade'],equipment:{primary:'blade',extras:[]},selection:{unlock:[]},mount:[],refills:[],upgrades:[]},bookFile);
  const runtime=legacyDouble<ShardRuntime>({world:legacyDouble<NonNullable<ShardRuntime['world']>>({})});
  const ctx=legacyDouble<ShardContext>({scope,product,app:legacyDouble<ShardContext['app']>({equipment:null}),game:legacyDouble<ShardContext['game']>({runtime})});
  const baseline=new Set(app.assets.retained().map(row=>row.key)),native=held.blade('blade');
  const packed=vi.spyOn(geometryTools,'fetchLaneBake').mockResolvedValue(new Uint8Array());
  const load=vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(url=>new GLTFLoader().parseAsync(Uint8Array.from(url==='/fixture/sabre-pool.glb'?poolGlb:readFileSync(`public${url}`)).buffer,''));
  const releaseCopies=():void=>{const rig=native.build(material,material);rig.sword.dispose();rig.arms.dispose();for(const extra of rig.extras??[])extra.geometry.dispose();};
  const evict=():void=>{for(const row of app.assets.retained())if(!baseline.has(row.key))expect(app.assets.evictCached(row.key)).toBe(true);};
  try {
    await held.prepareSlotSources(ctx);releaseCopies();
    expect(app.assets.retained().filter(row=>!baseline.has(row.key)).length).toBeGreaterThanOrEqual(3);
    scope.dispose();evict();
    expect(()=>native.build(material,material)).toThrow('Missing blade part sword');
    await held.prepareSlotSources({...ctx,scope:parent.child('entry-after-cache-retirement')});
    expect(releaseCopies).not.toThrow();expect(load).toHaveBeenCalledTimes(2);
    expect(packed).toHaveBeenCalledOnce();
    expect(read.mock.calls.filter(([hash])=>hash==='book')).toHaveLength(1);
  } finally {parent.dispose();evict();load.mockRestore();packed.mockRestore();material.dispose();}
});

test('baked sabre preserves every move, contact, mounted coefficient and mutable geometry channel', async () => {
  const key = (row: typeof PASS_LEFT.keys[number]) => ({ t: row.t, pos: row.pos.toArray(), q: row.q.toArray() });
  for (const [name, move] of [['left', PASS_LEFT], ['right', PASS_RIGHT]] as const) {
    expect(rows.moves.passes[name]).toEqual({ ...move, keys: move.keys.map(key), trail: { ...move.trail, color: move.trail.color.toArray() } });
  }
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(poolGlb).buffer, '');
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  const material = new MeshBasicMaterial();
  try {
    await blade.prepare({ shardfile: { ...emptyShardfile({ slug: 'sabre-test', name: 'Sabre', author: 'Wildshard', revision: 1, seed: 1 }), items: parseItems(items) }, hasFile: () => false, url: (name: string) => name, file: () => Promise.resolve(new TextEncoder().encode(JSON.stringify({...rows,program:heldWeapons.programs.blade,power:{...weaponPower,program:heldWeapons.programs.power},parts:heldWeapons.blade}))) });
    expect(blade.profile()).toEqual(authorProfile);
    const before = authorSabre(material, material), after = blade.build(material, material), second = blade.build(material, material);
    expect({ tipY: after.tipY, baseY: after.baseY, tipX: after.tipX }).toEqual({ tipY: before.tipY, baseY: before.baseY, tipX: before.tipX });
    const oldParts = [before.sword, before.arms, ...(before.extras ?? []).map(part => part.geometry)];
    const parts = [after.sword, after.arms, ...(after.extras ?? []).map(part => part.geometry)];
    for (const [index, part] of parts.entries()) {
      const original = oldParts[index];
      if (original === undefined) throw new Error('Missing authored part');
      expect(Object.keys(part.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const name of Object.keys(original.attributes)) expect(part.getAttribute(name).array).toEqual(original.getAttribute(name).array);
      expect(part.index?.array).toEqual(original.index?.array); expect(part.groups).toEqual(original.groups);
      part.dispose(); original.dispose();
    }
    expect(second.sword).not.toBe(after.sword);
    expect(second.sword.getAttribute('color').array).not.toBe(after.sword.getAttribute('color').array);
    second.sword.dispose(); second.arms.dispose(); for (const part of second.extras ?? []) part.geometry.dispose();
  } finally { load.mockRestore(); material.dispose(); }
});

test('Nalati gear rows decode all eight cards and independent bow paints', async () => {
  // oxlint-disable-next-line import/no-nodejs-modules -- Decode this job's portable packed geometry.
  const { inflateSync } = await import('node:zlib');
  const { unshuffleLanes, bakedGeometryBytes } = await import('../src/game/plugin/geometry');
  const { defineSpecimenCatalogue } = await import('../src/game/models/specimenCatalogue');
  const { modelContext, paramsOf } = await import('../src/engine/models/model');
  const { SkyRig } = await import('../src/engine/world/skyRig');
  const { Rng } = await import('../src/engine/core/rng');
  const { Object3D, Mesh, Vector3, BufferGeometry, BufferAttribute } = await import('three');
  const { default: gear } = await import('../src/shards/nalati-grasslands/data/gear.generated.json');
  const bake = parse(PackedSpecimenSchema, gear.packed);
  const bytes = unshuffleLanes(new Uint8Array(inflateSync(readFileSync(`public${gear.packed.bin}`))));
  expect(bytes.length).toBe(gear.packed.bytes);
  expect(bake.rows.flatMap(row => row.parts).reduce((sum, part) => sum + bakedGeometryBytes(part.geometry), 0)).toBe(bytes.length);
  const catalogue = defineSpecimenCatalogue<Record<string, object>>(gear.catalogue.map(row => ({ key: row.key, model: row.model, source: row.source })), gear.packed, gear.materials);
  catalogue.usePacked(bytes);
  expect(gear.catalogue.map(row => row.key)).toEqual(['bow', 'arrow', 'sabre', 'spear', 'javelin', 'goldenBow', 'naizagai', 'ar15']);
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new Vector3(0, 1, 0));
  const setup = vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  try {
    const context = modelContext(sky);
    for (const row of gear.catalogue) {
      const model = catalogue.model(row.key), object = model.build(context, model.defaults, new Rng(0));
      if (!(object instanceof Object3D)) throw new Error('Gear is a baked scene');
      expect(object.children.length).toBeGreaterThan(0);
    }
    const bow = catalogue.model('bow');
    const build = (variant: string) => {
      const group = bow.build(context, paramsOf(bow, variant, undefined), new Rng(0));
      if (!(group instanceof Object3D)) throw new Error('Bow is a baked scene');
      const mesh = group.children[0]; if (!(mesh instanceof Mesh)) throw new Error('Bow has no geometry');
      const geometry: unknown = mesh.geometry;
      if (!(geometry instanceof BufferGeometry)) throw new Error('Bow has no buffer geometry');
      return geometry;
    };
    const plain = build('recurve'), gold = build('golden'), second = build('recurve');
    const attribute = (geometry: typeof plain, name: string) => {
      const value: unknown = geometry.getAttribute(name);
      if (!(value instanceof BufferAttribute)) throw new Error('Gear attribute is not unpacked');
      return value.array;
    };
    expect(attribute(plain, 'position')).toEqual(attribute(gold, 'position'));
    expect(attribute(plain, 'color')).not.toEqual(attribute(gold, 'color'));
    expect(attribute(plain, 'color')).not.toBe(attribute(second, 'color'));
  } finally { setup.mockRestore(); }
});

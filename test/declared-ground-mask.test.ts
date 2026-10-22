import { expect,test } from 'vitest';
import { zlibSync } from 'fflate';
import * as v from 'valibot';
import { declaredGround } from '../src/game/shard/manifest';
import { GroundRowsSchema } from '../src/format/terrain';
import { WaterSchema } from '../src/format/water';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { createBakedTerrainField,installDeclaredBakedTerrain,bakedTerrainSource } from '../src/engine/world/bakedTerrainField';
import { basinBody } from '../src/engine/world/water/body';
import { readScalarChannel } from '../src/engine/world/scalarChannel';
import geography from '../src/shards/nalati-grasslands/boot/geography.generated.json' with { type: 'json' };
import layout from '../src/shards/nalati-grasslands/boot/layout.generated.json' with { type: 'json' };
import { GROUND,TERRAIN } from '../src/shards/nalati-grasslands/world/geography';
import nalati from '../src/shards/nalati-grasslands/manifest';

const encode = (values: Float32Array | Float64Array): string => btoa(String.fromCodePoint(...zlibSync(new Uint8Array(values.buffer))));
const lattice = { res: 2,size: 500,values: { type: 'f32',count: 4,data: encode(new Float32Array([0,.25,.75,1])) } };
const rows = { terrain: { flat: 3,seed: 17 },water: 2,trails: [],cabinSites: [],mask: lattice,bodies: [{ id: 'water',kind: 'terrain-basin' }] };

test('mask and ground-only basin use the same field, clamping, live water and independent declarations', () => {
  const first = declaredGround(rows),second = declaredGround(rows),body = first.water?.[0];
  if (body === undefined) throw new Error('Missing declared basin');
  expect(first.terrain).not.toBe(second.terrain);
  for (const x of [-1000,-250,-0,0,249.999,250,1000]) for (const z of [-1000,-250,-0,0,250,1000]) {
    const expected = basinBody('water',first.terrain);
    expect(Object.is(body.restAt(x,z),expected.restAt(x,z))).toBe(true);
    expect(body.inside(x,z,1)).toBe(expected.inside(x,z,1));
    expect(body.surfaceAt(x,z)).toBe(expected.surfaceAt(x,z));
  }
  expect(body.restAt(1000,1000)).toBe(2);
  first.terrain.waterLevel = () => 9;
  expect(body.level).toBe(9);expect(body.restAt(1000,1000)).toBe(9);expect(body.surfaceAt(0,0)).toBe(9);
  expect(second.water?.[0]?.level).toBe(2);
  const authored = structuredClone(rows),detached = declaredGround(authored);
  authored.water = 18;authored.mask.values.data = encode(new Float32Array([0,0,0,0]));
  expect(detached.water?.[0]?.level).toBe(2);expect(detached.terrain.pondMask(250,250)).toBe(1);
});

test('ordinary body order and the original first stream metadata survive intervening basins', () => {
  const ground = declaredGround({ ...rows,bodies: [rows.bodies[0],{ id: 'stream',kind: 'stream',width: 10,points: [{ x: -20,z: 0,level: 4 },{ x: 20,z: 0,level: 8 }] },{ id: 'pool',kind: 'pool',level: 5,shape: { kind: 'circle',x: 30,z: 30,radius: 10 } },{ id: 'sea',kind: 'sea',level: -3,waves: false }] });
  expect(ground.water?.map(body => body.id)).toEqual(['water','stream','pool','sea']);
  expect(ground.terrain.streamAt?.(0,0)).toBe(6);
  expect(ground.terrain.streamAt?.(0,6)).toBeNull();
  expect(ground.water?.[1]?.restAt(251,0)).toBeNull();
  expect(() => declaredGround({ ...rows,bodies: [...rows.bodies,...rows.bodies] })).toThrow();
  expect(() => declaredGround({ ...rows,bodies: [{ id: 'sea',kind: 'sea',level: 0,waves: false },...rows.bodies] })).toThrow();
  expect(v.safeParse(WaterSchema,rows.bodies).success).toBe(false);
});

test('all mask metadata, storage and JSON preconditions refuse before a usable ground escapes', () => {
  for (const mask of [{ ...lattice,res: 1 },{ ...lattice,res: 2.5 },{ ...lattice,size: 0 },{ ...lattice,size: Infinity },{ ...lattice,values: { ...lattice.values,count: 3 } },{ ...lattice,values: { type: 'f64',count: 4,data: encode(new Float64Array([0,0,0,0])) } },{ ...lattice,values: { ...lattice.values,data: encode(new Float32Array([0,0,0])) } },{ ...lattice,values: { ...lattice.values,data: encode(new Float32Array([0,0,0,1.01])) } },{ ...lattice,values: { ...lattice.values,data: encode(new Float32Array([0,0,0,-.01])) } }]) expect(() => declaredGround({ ...rows,mask })).toThrow();
  expect(() => declaredGround({ ...rows,pond: { x: 0,z: 0,r: 3 } })).toThrow('exclusive');
  let calls = 0;const accessor = { ...rows,get mask() { calls++;return lattice; } };
  expect(() => declaredGround(accessor)).toThrow('plain JSON');expect(calls).toBe(0);
  expect(formatJsonSchema(GroundRowsSchema)).toBeDefined();
});

test('actual Nalati metadata, pond, water and required native terrain retain the predecessor laws', () => {
  const values = readScalarChannel(geography.ground.mask?.values);
  if (!(values instanceof Float32Array)) throw new Error('Missing pond samples');
  const trails = [layout.S_ROAD_PTS,layout.N_ROAD_PTS,layout.E_ROAD_PTS,layout.W_ROAD_PTS,layout.SKY_ROAD,layout.CAMP_SPUR,...layout.BOWL_TRACKS,layout.EAGLE_TRAIL,layout.CAVE_TRAIL,layout.ARGYMAQ_TRAIL];
  const original = createBakedTerrainField({ key: 'nalati-grasslands',seed: geography.seed },{ water: geography.river.level,cabinSites: [],trails,mask: { res: geography.res,size: geography.size,values } });
  expect(nalati.ground).toBe(GROUND);expect(nalati.ground.terrain).toBe(TERRAIN);
  expect(TERRAIN.trails).toEqual(trails);expect(bakedTerrainSource(TERRAIN)).toEqual(bakedTerrainSource(original));
  const prior = basinBody('river',original),current = GROUND.water?.[0];
  if (current === undefined) throw new Error('Missing river');
  for (const x of [-500,-251,-250,-0,0,.5,249.999,250,251,500]) for (const z of [-500,-251,-250,-0,0,12,249.999,250,251,500]) {
    expect(Object.is(TERRAIN.pondMask(x,z),original.pondMask(x,z))).toBe(true);
    expect(Object.is(TERRAIN.trailDistance(x,z),original.trailDistance(x,z))).toBe(true);
    expect(TERRAIN.cabinMask(x,z)).toBe(original.cabinMask(x,z));
    expect(current.restAt(x,z)).toBe(prior.restAt(x,z));expect(current.surfaceAt(x,z)).toBe(prior.surfaceAt(x,z));
    for (const y of [geography.river.level-.1,geography.river.level,geography.river.level+.1]) expect(current.inside(x,z,y)).toBe(prior.inside(x,z,y));
  }
  const source = { seed: geography.seed,heightAt: () => 13,normalAt: (): [number,number,number] => [0,1,0],splatAt: (): [number,number,number,number] => [1,0,0,0] };
  installDeclaredBakedTerrain(original,source);expect(original.heightAt(0,0)).toBe(13);
  const isolated = declaredGround(geography.ground).terrain;
  expect(() => isolated.heightAt(0,0)).toThrow('not ready');
  installDeclaredBakedTerrain(isolated,source);expect(isolated.heightAt(0,0)).toBe(13);
});

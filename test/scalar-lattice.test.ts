import { expect,test } from 'vitest';
import * as v from 'valibot';
import { zlibSync } from 'fflate';
import { readScalarLattice } from '../src/engine/world/scalarChannel';
import { ScalarLatticeSchema } from '../src/format/scalarChannel';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import { GroundRowsSchema } from '../src/format/terrain';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';

const encode = (values: Float32Array | Float64Array): string => btoa(String.fromCodePoint(...zlibSync(new Uint8Array(values.buffer,values.byteOffset,values.byteLength))));
const values = new Float32Array([0,-0,.25,2,-3,Math.PI,.5,12,-.5]);
const rows = { res: 3,size: 500,values: { type: 'f32',count: 9,data: encode(values) } };

test('explicit lattice preserves the defining clamp, operation order and signed-zero answers', () => {
  const sample = readScalarLattice(rows),original = bakedSamplers({ res: 3,size: 500,heights: values,seed: 21,landscapeHash: 1,splat: new Uint8Array(0),undergrowth: null }).heightAt;
  for (const x of [-Infinity,-500,-250,-249.999,-0,0,3,249.999,250,500,Infinity,Number.NaN]) for (const z of [-500,-250,-0,0,.25,250,500,Number.NaN]) expect(Object.is(sample(x,z),original(x,z))).toBe(true);
  const authored = structuredClone(rows),first = readScalarLattice(authored),second = readScalarLattice(authored);
  authored.size = 50;authored.values.data = encode(new Float32Array(9).fill(99));
  expect(first(250,250)).toBe(-.5);expect(second(250,250)).toBe(-.5);
  values[0] = 27;expect(first(-250,-250)).toBe(0);values[0] = 0;
});

test('all lattice metadata and finite typed storage are admitted before exposing a sampler', () => {
  for (const input of [{ ...rows,res: 1 },{ ...rows,res: 2.5 },{ ...rows,res: 2049 },{ ...rows,size: 0 },{ ...rows,size: Infinity },{ ...rows,extra: 3 },{ ...rows,values: { ...rows.values,count: 8 } },{ ...rows,values: { ...rows.values,type: 'f64',data: encode(new Float64Array(9)) } },{ ...rows,values: { ...rows.values,data: encode(new Float32Array(8)) } },{ ...rows,values: { ...rows.values,data: encode(new Float32Array(10)) } },{ ...rows,values: { ...rows.values,data: encode(new Float32Array(9).fill(Number.NaN)) } }]) expect(() => readScalarLattice(input)).toThrow();
  let reads = 0;const accessor = { ...rows,get size() { reads++;return 500; } };
  expect(() => readScalarLattice(accessor)).toThrow('plain JSON');expect(reads).toBe(0);
  expect(v.safeParse(ScalarLatticeSchema,rows).success).toBe(true);
});

test('ground mask and explicit raster share one defining schema without weakening either wire', () => {
  expect(formatJsonSchema(ScalarLatticeSchema)).toBeDefined();expect(formatJsonSchema(GroundRowsSchema)).toBeDefined();
  const ground = { terrain: { flat: 0,seed: 1 },trails: [],cabinSites: [],water: 0,bodies: [],mask: rows };
  expect(v.safeParse(GroundRowsSchema,ground).success).toBe(true);
  expect(v.safeParse(GroundRowsSchema,{ ...ground,mask: { ...rows,values: { ...rows.values,count: 8 } } }).success).toBe(false);
});

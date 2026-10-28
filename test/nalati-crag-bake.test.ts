// oxlint-disable-next-line import/no-nodejs-modules -- Compare the admitted geometry with exact-parent runtime hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the shipped compressed crag bake.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the same deflate envelope the browser reads.
import { inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { SceneBakedGeometrySchema } from '@wildshard/format/sceneDressing';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';
import { expect, it } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { createClientScene } from '@wildshard/game/plugin/scene';
import { unshuffleLanes as unshuffleBodyLanes, decodeLaneBytes } from '../src/engine/core/deflate';
import oracle from './fixtures/nalati-crag-bake.json';
import { nalatiCragRows } from './fixtures/nalati-crags';
import { nalatiPhoneCragBank } from '../src/shards/nalati-grasslands/generators/cragRockProgram';

const finite=v.pipe(v.number(),v.finite());
const tierSchema=v.object({meshes:v.array(v.object({key:v.string(),offset:finite,row:SceneBakedGeometrySchema})),
  recipe:PrivateSceneSchema,placements:v.array(v.unknown()),boxes:v.array(finite),colliders:v.array(v.unknown()),
  count:v.record(v.string(),finite),triangles:finite,hulls:v.array(v.unknown())});
const rows=v.parse(v.object({phone:tierSchema,desktop:tierSchema}),nalatiCragRows);

const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

it('the phone bank retains every original word without desktop payload or input mutation',async()=>{
  const original=new Uint8Array(readFileSync('public/assets/nalati/baked/crags.bin')),before=hash(original),metadata=structuredClone(nalatiCragRows);
  const phone=nalatiPhoneCragBank(original,nalatiCragRows),all=unshuffleBodyLanes(new Uint8Array(inflateSync(original)));
  expect(phone.decoded).toBe(3224040);expect(phone.bytes.byteLength).toBeLessThan(original.byteLength);
  expect(await decodeLaneBytes(phone.bytes)).toEqual(all.subarray(0,phone.decoded));
  expect(hash(original)).toBe(before);expect(nalatiCragRows).toStrictEqual(metadata);
});

it('a tier gap or incomplete compressed crag bank refuses before publication',()=>{
  const original=new Uint8Array(readFileSync('public/assets/nalati/baked/crags.bin')),broken=structuredClone(nalatiCragRows),first=broken.phone.meshes[0];
  if(first===undefined)throw new Error('Missing native phone crag');first.offset=4;
  expect(()=>nalatiPhoneCragBank(original,broken)).toThrow('contiguous float32');
  expect(()=>nalatiPhoneCragBank(original.subarray(0,-8),nalatiCragRows)).toThrow();
});

for (const tier of ['phone', 'desktop'] as const) it(`preserves ${tier} crag channels, bounds, hierarchy and ordered hulls`, () => {
  const bytes = unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/crags.bin'))));
  const data = rows[tier], expected = oracle[tier];
  const geometry = new Map(data.meshes.map(part => {
    const packed = readBakedGeometry(bytes, part.offset, v.parse(SceneBakedGeometrySchema, part.row));
    if (!part.row.expand) return [part.key, packed] as const;
    const expanded = packed.toNonIndexed(); packed.dispose(); expanded.computeBoundingBox(); expanded.computeBoundingSphere();
    return [part.key, expanded] as const;
  }));
  const mat = new MeshBasicMaterial();
  const made = createClientScene(data.recipe, { geometry: key => geometry.get(key), materials: new Map([['crag', mat]]) });
  expect(made.root.name).toBe('nalati-crag-rock');
  expect(made.root.children.map(child => ({ name: child.name, castShadow: child.castShadow, receiveShadow: child.receiveShadow })))
    .toEqual(expected.meshes.map(mesh => ({ name: mesh.name, castShadow: true, receiveShadow: true })));
  for (const [i, part] of data.meshes.entries()) {
    const g = geometry.get(part.key);
    if (g === undefined) throw new Error('Missing decoded crag quadrant');
    expect({ attributes: Object.entries(g.attributes).map(([name, a]) => ({ name, itemSize: a.itemSize, count: a.count,
      hash: hash(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)) })),
    index: g.index === null ? null : Array.from(g.index.array),
    box: g.boundingBox === null ? null : { min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() },
    sphere: g.boundingSphere === null ? null : { center: g.boundingSphere.center.toArray(), radius: g.boundingSphere.radius } }).toEqual(expected.meshes[i]?.geometry);
    g.dispose();
  }
  expect(data.count).toEqual(expected.count);
  expect(data.triangles).toBe(expected.triangles);
  expect(data.colliders).toEqual(expected.colliders);
  expect(hash(JSON.stringify(data.hulls))).toBe(expected.hulls);
  expect(data.placements).toHaveLength(data.hulls.length);
  expect(data.boxes).toHaveLength(data.placements.length * 6);
  mat.dispose();
});

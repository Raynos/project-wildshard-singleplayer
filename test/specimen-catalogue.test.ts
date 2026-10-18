// oxlint-disable-next-line import/no-nodejs-modules -- Compare against shipped specimen bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the original committed lane bake.
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { Rng } from '../src/engine/core/rng';
import { modelContext, paramsOf, definedModels } from '../src/engine/models/model';
import { SkyRig } from '../src/engine/world/skyRig';
import { painterlyKnobs } from '../src/engine/world/painterly';
import { unshuffleLanes, readBakedGeometry, bakedGeometryBytes } from '../src/game/plugin/geometry';
import { createPackedSpecimens, defineSpecimenCatalogue, specimenMaterial } from '../src/game/models/specimenCatalogue';
import { PackedSpecimenSchema } from '../src/sdk/kit/specimenSchemas';
import packedRows from '../src/shards/nalati-grasslands/data/placeSpecimens.json' with { type: 'json' };
import campMaterialRows from '../src/shards/nalati-grasslands/data/campMaterials.json' with { type: 'json' };
import * as camp from '../src/shards/nalati-grasslands/models/catalogue';
import * as trail from '../src/shards/driftwood-isle/models/catalogue';
import campData from '../src/shards/nalati-grasslands/boot/specimens.generated.json' with { type: 'json' };
import trailRows from '../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };
import { poiMaterial, texturedMaterial } from '../src/shards/nalati-grasslands/world/modelView';

function testSky(): SkyRig {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  return sky;
}
const binary = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/specimens.bin'))));
const bake = v.parse(PackedSpecimenSchema, { ...packedRows, bin: '/assets/nalati/baked/specimens.bin' });

describe('declared specimen catalogue', () => {
  it('registers all original camp, yurt, bridge and trail definitions without building specimens', () => {
    expect(Object.keys(camp)).toHaveLength(53);
    const trailModels = Object.values(trail).filter(entry => 'id' in entry);
    expect(trailModels).toHaveLength(16);
    expect(trail.coveModels).toBeTypeOf('function');
    expect(Object.keys(trail)).toEqual(expect.arrayContaining(['shoreBoulder', 'smallRock', 'reefRock', 'palm', 'hibiscusBush', 'driftLog', 'pier', 'boat', 'zipline']));
    const ids = new Set(definedModels().map(model => model.id));
    for (const model of [...Object.values(camp), ...trailModels]) expect(ids.has(model.id)).toBe(true);
  });

  it('retains nested parameter defaults and authored variant merges', () => {
    expect(paramsOf(trail.signpost, 'three', undefined)).toEqual({ arrows: [0.45, 0.75, -0.87], labels: ['LOOKOUT', 'WRECK', 'SHRINE'] });
    expect(paramsOf(trail.plankStep, 'dark', undefined)).toEqual({ w: 2.4, roll: 0, yaw: 0, dark: true });
    expect(paramsOf(camp.feltRug, 'palette-3', undefined)).toEqual({ w: 1.5, h: 2.2, pal: 3 });
    expect(paramsOf(camp.yurt, 'felt', undefined)).toEqual({ r: 2.8, flue: false, palette: 2, old: true, base: 'felt', pennant: false });
    expect(camp.campClutter.variants?.map(variant => variant.id)).toEqual(['firewood-tipi', 'dung-cake-stack', 'chopping-block', 'pots-and-a-bucket', 'sacks', 'folded-felts', 'kumis-churn']);
  });

  it('retains own-space fence and signpost colliders without an asset load', () => {
    const ctx = modelContext(null);
    expect(trail.fencePost.colliders?.({}, ctx)).toEqual([{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 0.16, hy: 1.1, hz: 0.16 }]);
    expect(trail.signpost.colliders?.(trail.signpost.defaults, ctx)).toEqual([{ kind: 'box', x: 0, y: 0.7, z: 0, hx: 0.12, hy: 1.7, hz: 0.12 }]);
    expect(trail.fencePost.colliders?.({}, ctx)[0]).not.toBe(trail.fencePost.colliders?.({}, ctx)[0]);
  });

  it('retains inert instance markers without installing shard callbacks', () => {
    const marker: unknown = Reflect.get(camp.herdHorse.build, 'gen');
    expect(marker).toEqual({ id: 'nalati-grasslands/herd-horse', name: 'horse-wild', lod: 'far', look: { rim: 0.8, bands: 0.85 } });
    expect(Reflect.get(camp.kazan.build, 'gen')).toEqual({ id: 'nalati-grasslands/kazan', name: 'cauldron', lod: 'near', look: {} });
  });

  it('refuses arbitrary procedural trail shapes before requesting an asset', () => {
    expect(() => trail.plankStep.build(modelContext(testSky()), { ...trail.plankStep.defaults, w: 15 }, new Rng(1))).toThrow('No authored specimen');
    expect(trailRows.flatMap(row => row.source.variants)).toHaveLength(6);
  });

  it('refuses duplicate catalogue keys and duplicate model identities', () => {
    const row = trailRows[0]; if (row === undefined) throw new Error('Missing trail row');
    expect(() => defineSpecimenCatalogue([row, row])).toThrow('bounded and unique');
    expect(() => defineSpecimenCatalogue([row, { ...row, key: 'different' }])).toThrow('bounded and unique');
  });

  it('refuses callbacks and non-asset source paths at the wire boundary', () => {
    const row = trailRows[0]; if (row === undefined) throw new Error('Missing trail row');
    expect(() => defineSpecimenCatalogue([{ ...row, model: { ...row.model, defaults: { select: () => 'shape' } } }])).toThrow('plain JSON data');
    expect(() => defineSpecimenCatalogue([{ ...row, source: { kind: 'asset', asset: { url: '/src/shard.ts', material: { id: 'test', family: 'lowpoly' } } } }])).toThrow();
  });

  it('refuses truncated binaries and rows that do not cover the binary', () => {
    const packed = createPackedSpecimens(bake), bytes = binary();
    expect(() => packed.use(bytes.subarray(4))).toThrow('byte count differs');
    expect(() => createPackedSpecimens({ ...bake, rows: [] }).use(bytes)).toThrow('do not cover');
  });

  it('decodes every original packed part in order, retaining independent attribute ownership', () => {
    const packed = createPackedSpecimens(bake), bytes = binary(), ctx = modelContext(testSky()); packed.use(bytes);
    const materialRows = Object.fromEntries(Object.entries(campMaterialRows).map(([name, row]) => [name, { id: row.id, family: 'painterly' as const }]));
    const selected = new Set<string>(); let offset = 0;
    for (const row of bake.rows) {
      if (!selected.has(row.key)) {
        selected.add(row.key);
        const parts = packed.parts(row.key, ctx, materialRows), again = packed.parts(row.key, ctx, materialRows);
        expect(parts).toHaveLength(row.parts.length);
        let at = offset;
        for (const [index, part] of row.parts.entries()) {
          const original = readBakedGeometry(bytes, at, part.geometry), expected = part.geometry.expand ? original.toNonIndexed() : original;
          if (part.geometry.expand) { expected.computeBoundingBox(); expected.computeBoundingSphere(); }
          const actual = parts?.[index]?.geometry, second = again?.[index]?.geometry;
          expect(actual?.getIndex()?.array ?? null).toEqual(expected.getIndex()?.array ?? null);
          for (const name of Object.keys(expected.attributes)) {
            expect(actual?.getAttribute(name).array).toEqual(expected.getAttribute(name).array);
            expect(actual?.getAttribute(name).array).not.toBe(second?.getAttribute(name).array);
          }
          expect(parts?.[index]?.material).toBe(again?.[index]?.material);
          expect(actual?.boundingSphere).toEqual(expected.boundingSphere);
          actual?.dispose(); second?.dispose(); expected.dispose(); if (expected !== original) original.dispose();
          at += bakedGeometryBytes(part.geometry);
        }
      }
      for (const part of row.parts) offset += bakedGeometryBytes(part.geometry);
    }
    expect(offset).toBe(bytes.length);
  });

  it('builds the catalogue from the admitted binary on the exact live POI material', () => {
    const catalogue = defineSpecimenCatalogue<{ ribbonPole: object }>(campData.catalogue, campData.packed, campData.materials);
    catalogue.usePacked(binary());
    const sky = testSky(), built = catalogue.model('ribbonPole').build(modelContext(sky), {}, new Rng(1));
    if (!(built instanceof THREE.Group)) throw new Error('Expected lazy group');
    const mesh = built.children[0]; if (!(mesh instanceof THREE.Mesh)) throw new Error('Expected painted specimen');
    expect(mesh.material).toBe(poiMaterial(sky));
    expect(mesh.castShadow).toBe(true); expect(mesh.receiveShadow).toBe(true);
  });

  it('shares material identities with the world and recreates disposed material caches', () => {
    const sky = testSky(), row = campMaterialRows.poi;
    const material = specimenMaterial(sky, row);
    expect(material).toBe(poiMaterial(sky)); expect(material).toBe(texturedMaterial(sky, 'poi'));
    expect(painterlyKnobs(material)?.uPRim.value).toBe(0.35);
    expect(painterlyKnobs(material)?.uPFloorAmt.value).toBe(1);
    expect(specimenMaterial(testSky(), row)).not.toBe(material);
    material.dispose(); expect(specimenMaterial(sky, row)).not.toBe(material);
  });
});

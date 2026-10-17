// oxlint-disable-next-line import/no-nodejs-modules -- compare the pre-conversion runtime's exact attribute bytes
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { bakedActorGeometry, bakedSignLettering } from '../src/shards/nalati-grasslands/world/placeBake';
import { shepherdRider } from '../src/shards/nalati-grasslands/creatures/sheepRaid';
import { SkyRig } from '../src/engine/world/skyRig';
import { modelContext } from '../src/engine/models/model';
import { Rng } from '../src/engine/core/rng';
import { signpostBaked } from '../src/shards/nalati-grasslands/models/catalogue';
import { Mesh, BufferGeometry, BufferAttribute, Material, MeshLambertMaterial, DataTexture, Vector3, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping } from 'three';
import oracle from './fixtures/nalati-poi-paint.json';

const hash = (array: ArrayBufferView): string => createHash('sha256')
  .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');

function testSky(): SkyRig {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  return sky;
}

describe('Nalati fixed POI paint', () => {
  it('retains every parent vertex, normal, colour, UV, index and bound', () => {
    for (const row of oracle.rows) {
      const geometry = bakedActorGeometry(row.key);
      expect(Object.entries(geometry.attributes).map(([name, a]) => ({ name,
        type: a.array.constructor.name, size: a.itemSize, normalized: a.normalized,
        count: a.count, bytes: a.array.byteLength, hash: hash(a.array),
      }))).toEqual(row.attributes);
      expect(geometry.index === null ? null : { type: geometry.index.array.constructor.name,
        count: geometry.index.count, hash: hash(geometry.index.array) }).toEqual(row.index);
      expect(geometry.groups).toEqual(row.groups);
      expect(geometry.boundingBox === null ? null : [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()]).toEqual(row.box);
      expect(geometry.boundingSphere === null ? null : [geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius]).toEqual(row.sphere);
      const second = bakedActorGeometry(row.key);
      expect(second.getAttribute('position').array).not.toBe(geometry.getAttribute('position').array);
      geometry.dispose(); second.dispose();
    }
  });

  it('keeps the two shepherd material slots and independent animated arm', () => {
    const { rider, arm } = shepherdRider(), body = rider.children[0];
    if (!(body instanceof Mesh)) throw new Error('Shepherd body must remain a mesh');
    expect(rider.children).toEqual([body, arm]);
    expect(body.material).toBe(arm.material);
    expect(rider.position.toArray()).toEqual([0, 0.36, 0.28]);
    expect(arm.position.toArray()).toEqual([-0.2, 0.6, 0]);
    const bodyGeometry: unknown = body.geometry, armGeometry: unknown = arm.geometry, material: unknown = body.material;
    if (!(bodyGeometry instanceof BufferGeometry) || !(armGeometry instanceof BufferGeometry) || !(material instanceof Material)) throw new Error('Shepherd keeps plain geometry and one material');
    const bodyPositions: unknown = bodyGeometry.getAttribute('position'), armPositions: unknown = armGeometry.getAttribute('position');
    if (!(bodyPositions instanceof BufferAttribute) || !(armPositions instanceof BufferAttribute)) throw new Error('Shepherd keeps plain attributes');
    expect(bodyPositions.count).toBe(7848);
    expect(armPositions.count).toBe(780);
    bodyGeometry.dispose(); armGeometry.dispose(); material.dispose();
  });

  it('adopts exact atlas pixels and sampling before entering the world', () => {
    const sky = testSky();
    for (const key of ['roads', 'specimen'] as const) {
      const mesh = bakedSignLettering(sky, key), material: unknown = mesh.material, expected = oracle.atlases[key];
      if (!(material instanceof MeshLambertMaterial) || !(material.map instanceof DataTexture)) throw new Error('Sign lettering needs its Lambert atlas');
      const atlas = material.map, image: unknown = atlas.image;
      if (typeof image !== 'object' || image === null) throw new Error('Missing atlas image');
      const pixels: unknown = Reflect.get(image, 'data');
      if (!(pixels instanceof Uint8Array)) throw new Error('Atlas requires exact RGBA8');
      expect(hash(pixels)).toBe(expected.rgbaHash);
      expect([Reflect.get(image, 'width'), Reflect.get(image, 'height')]).toEqual([expected.width, expected.height]);
      expect([atlas.colorSpace, atlas.anisotropy, atlas.flipY, atlas.generateMipmaps, atlas.minFilter, atlas.magFilter, atlas.wrapS, atlas.wrapT])
        .toEqual([SRGBColorSpace, 4, true, true, LinearMipmapLinearFilter, LinearFilter, ClampToEdgeWrapping, ClampToEdgeWrapping]);
      expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
      const geometry: unknown = mesh.geometry;
      if (!(geometry instanceof BufferGeometry)) throw new Error('Sign lettering requires baked geometry');
      geometry.dispose(); atlas.dispose(); material.dispose();
    }
  });

  it('refuses board inputs outside the complete prepared specimen set', () => {
    expect(() => signpostBaked.build(modelContext(testSky()), { boards: [{ text: 'UNBAKED', dir: 0 }] }, new Rng(1)))
      .toThrow('No prepared Nalati sign lettering');
  });
});

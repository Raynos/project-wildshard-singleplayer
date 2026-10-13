import { MeshStandardMaterial, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';
import { HD_URLS, SKY_HD, type SkyHdName } from '../data/files';
import { CARVED, MODEL_FITS } from '../data/modelFrames';
import frames from '../data/skyIsleFrames.json' with { type: 'json' };
import { fitModel, hdGeometry } from './modelIntake';
import { bakeKeeperFigure } from './keeperFigure';

/** Apply each owner's static frame in the original operation order, before emitting immutable geometry. */
export function prepareModelFrame(name: SkyHdName, geometry: BufferGeometry): BufferGeometry {
  const frame = frames.find(row => row.model === name);
  if (frame !== undefined) {
    geometry.translate(-frame.tx, -frame.deck, -frame.tz);
    geometry.scale(frame.k, frame.k, frame.k);
  } else {
    const fit = MODEL_FITS[name];
    if (fit !== undefined) fitModel(geometry, fit);
    if (name === 'crown-dais') {
      geometry.computeBoundingBox();
      geometry.scale(1, CARVED.daisH / Math.max(1e-3, geometry.boundingBox?.max.y ?? 1), 1);
    }
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Normalize meshopt attributes and smooth normals once, preserving each painted source and its exact fitted frame. */
export async function bakePreparedModels(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const primitives: GlbPrimitive[] = [];
  for (const name of SKY_HD) {
    const source = await readSourceModel(read(HD_URLS[name]));
    const model = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
    if (model === null) throw new Error(`Model ${name} has no indexed painted geometry`);
    const pivots = name === 'keeper-hd' ? bakeKeeperFigure(model.geometry.clone()) : undefined;
    if (pivots !== undefined) {
      for (const [index, geometry] of pivots.entries()) {
        if (geometry.getAttribute('position').count === 0) continue;
        const sphere = geometry.boundingSphere;
        if (sphere === null) throw new Error('Missing keeper pivot bounds');
        primitives.push({ name: `keeper-pivot-${String(index)}`, geometry, compactIndex: true, nativeAttributes: true, material: new MeshStandardMaterial(), extras: { sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] } });
      }
    }
    const geometry = prepareModelFrame(name, model.geometry), sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error(`Model ${name} has no fitted bounds`);
    primitives.push({ name, geometry, material: new MeshStandardMaterial(), extras: { sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], ...(pivots === undefined ? {} : { npcCounts: pivots.map(part => part.getAttribute('position').count) }) } });
  }
  return staticGlb(primitives, 'sky-prepared-models');
}

import { MeshStandardMaterial, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';
import { HD_URLS, MODEL_URLS, SKY_HD, type SkyHdName } from '../data/files';
import { CARVED, MODEL_FITS } from '../data/modelFrames';
import frames from '../data/skyIsleFrames.json' with { type: 'json' };
import { facetedGeometry, fitModel, hdGeometry } from './modelIntake';
import { bakeKeeperFigure } from './keeperFigure';
import { bakeVaneParts } from './vane';

/** Standard bounds and group rows for the shared rest-geometry reader. */
function restMetadata(geometry: BufferGeometry): { restBox: number[] | null; restSphere: number[] | null; restGroups: number[][] } {
  const box = geometry.boundingBox, sphere = geometry.boundingSphere;
  return { restBox: box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
    restSphere: sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
    restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]) };
}

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
        primitives.push({ name: `hero-keeper-pivot-${String(index)}`, geometry, compactIndex: true, nativeAttributes: true, material: new MeshStandardMaterial(), extras: { ...restMetadata(geometry), sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] } });
      }
    }
    const geometry = prepareModelFrame(name, model.geometry), sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error(`Model ${name} has no fitted bounds`);
    primitives.push({ name: `hero-${name}`, geometry, nativeAttributes: true, material: new MeshStandardMaterial(), extras: { ...restMetadata(geometry), sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], ...(pivots === undefined ? {} : { npcCounts: pivots.map(part => part.getAttribute('position').count) }) } });
  }
  return staticGlb(primitives, 'sky-prepared-models');
}

async function bakeVanePart(read: (url: string) => Uint8Array, part: 0 | 1): Promise<Uint8Array> {
  const source = facetedGeometry((await readSourceModel(read(MODEL_URLS['wind-vane']))).gltf.scene, 0.6);
  if (source === null) throw new Error('Missing vane source');
  return staticGlb([{ name: 'vane', geometry: bakeVaneParts(source)[part], compactIndex: true, nativeAttributes: true, material: new MeshStandardMaterial() }], 'vane');
}
/** The authored vane post; flat channels stay exact through the standard facet library. */
export const bakeVanePost = (read: (url: string) => Uint8Array): Promise<Uint8Array> => bakeVanePart(read, 0);
/** The authored vane rotor in its local 2.2 metre pivot frame. */
export const bakeVaneRotor = (read: (url: string) => Uint8Array): Promise<Uint8Array> => bakeVanePart(read, 1);

/** Prepared geometry and original atlas rows; the author explicitly names nonempty NPC parts. */
export async function bakePreparedLibrary(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const source = await readSourceModel(read(HD_URLS['keeper-hd']));
  const keeper = hdGeometry(source.gltf.scene, material => source.texture(material) !== null);
  if (keeper === null) throw new Error('Missing keeper author geometry');
  const pivots = bakeKeeperFigure(keeper.geometry).map((geometry, index) => geometry.getAttribute('position').count === 0 ? null : `hero-keeper-pivot-${String(index)}`);
  const rows = { pool: { url: '/assets/far-reach/baked/prepared-models.glb', parts: [...SKY_HD.map(name => `hero-${name}`), ...pivots.filter((part): part is string => part !== null)] },
    models: SKY_HD.map(name => name === 'keeper-hd' ? { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true, pivots }
      : { name, url: HD_URLS[name], geometry: `hero-${name}`, releaseImage: true }) };
  return new TextEncoder().encode(`${JSON.stringify(rows)}\n`);
}

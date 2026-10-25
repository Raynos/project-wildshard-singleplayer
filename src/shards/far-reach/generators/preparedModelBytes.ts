import { MeshStandardMaterial, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';
import { HD_URLS, SKY_HD, type SkyHdName } from './fileInventory';
import { fitModel, hdGeometry, type ModelFrame } from './modelIntake';
import { bakeKeeperFigure } from './keeperFigure';

/** Caller-owned fitting rows; the byte producer never reads a generated source handoff. */
export interface PreparedModelFrameInputs {
  readonly frames: readonly { readonly model: string; readonly tx: number; readonly deck: number; readonly tz: number; readonly k: number }[];
  readonly fits: Readonly<Partial<Record<SkyHdName, ModelFrame>>>;
  readonly daisHeight: number;
}

/** Standard bounds and group rows for the shared rest-geometry reader. */
function restMetadata(geometry: BufferGeometry): { restBox: number[] | null; restSphere: number[] | null; restGroups: number[][] } {
  const box = geometry.boundingBox, sphere = geometry.boundingSphere;
  return { restBox: box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
    restSphere: sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
    restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]) };
}

/** Apply each owner's static frame in the original operation order, before emitting immutable geometry. */
export function prepareModelFrame(name: SkyHdName, geometry: BufferGeometry, inputs: PreparedModelFrameInputs): BufferGeometry {
  const frame = inputs.frames.find(row => row.model === name);
  if (frame !== undefined) {
    geometry.translate(-frame.tx, -frame.deck, -frame.tz);
    geometry.scale(frame.k, frame.k, frame.k);
  } else {
    const fit = inputs.fits[name];
    if (fit !== undefined) fitModel(geometry, fit);
    if (name === 'crown-dais') {
      geometry.computeBoundingBox();
      geometry.scale(1, inputs.daisHeight / Math.max(1e-3, geometry.boundingBox?.max.y ?? 1), 1);
    }
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Normalize meshopt attributes and smooth normals once, preserving each painted source and its exact fitted frame. */
export async function bakePreparedModels(read: (url: string) => Uint8Array, inputs: PreparedModelFrameInputs): Promise<Uint8Array> {
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
    const geometry = prepareModelFrame(name, model.geometry, inputs), sphere = geometry.boundingSphere;
    if (sphere === null) throw new Error(`Model ${name} has no fitted bounds`);
    primitives.push({ name: `hero-${name}`, geometry, nativeAttributes: true, material: new MeshStandardMaterial(), extras: { ...restMetadata(geometry), sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], ...(pivots === undefined ? {} : { npcCounts: pivots.map(part => part.getAttribute('position').count) }) } });
  }
  return staticGlb(primitives, 'sky-prepared-models');
}


/**
 * The homestead's dressing as its models read it (E315 M2): each prop model (../models/woodenCrate.ts, wineBarrel.ts,
 * woodenBucket.ts, hatchet.ts) is built from the loaded scan the buildings set about, colliding as the scan's bounds
 * (`propBox`); the fire pit and the porch lantern are copies of what a building dressed (`dressedCopy`). The buildings
 * themselves are the log kit's (../models/logCabin.ts: `useCabins`, `buildingSpecimen`, `builtBuilding`).
 */
import * as THREE from 'three';
import type { CabinPropKind } from './homestead';
import type { ColliderSpec, ModelContext, ModelPart } from '@wildshard/engine/models/model';
import { cabinsOf } from '../models/logCabin';
import { PROP_BOXES } from './logKit';

const KEY = 'pine-hollow/cabins';

/** a prop kind's parts, their node transforms baked into copies of the scan's geometry (once per shard) */
export function propPart(ctx: ModelContext, kind: CabinPropKind): ModelPart[] {
  return ctx.once(`${KEY}:prop:${kind}`, () => (cabinsOf(ctx).propParts(kind) ?? []).map((p): ModelPart => ({
    geometry: p.geometry.clone().applyMatrix4(p.matrix), material: p.material, castShadow: true, receiveShadow: true,
  })));
}

/** a prop kind's collider in its own frame: the scan's bounds as a box standing on its foot (none for the hatchet) */
export function propBox(kind: CabinPropKind): ColliderSpec[] {
  const d = PROP_BOXES[kind];
  return d === null ? [] : [{ kind: 'box', x: 0, y: d.h / 2, z: 0, hx: d.hw, hy: d.h / 2, hz: d.hd, surface: 'wood' }];
}

/** the fire pit or the porch lantern as a building dressed it (its materials fixed, lit like the rest), a copy at the origin */
export function dressedCopy(ctx: ModelContext, which: 'firePit' | 'lantern'): THREE.Object3D {
  const b = cabinsOf(ctx).buildings.find((x) => x[which] !== null);
  const src = b?.[which];
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  o.traverse((c) => { c.visible = true; }); // the building's detail set may be hidden (far from the camera) as it is copied
  if (which === 'lantern') o.scale.setScalar(1.35);
  return o;
}

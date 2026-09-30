/**
 * Pine Hollow's log buildings and their props, as their models read them (E315 M2): src/world/Cabin.ts builds the three
 * cabins and the mill hamlet on its log kit and draws them itself — the cabins' never-hidden cores merged across the
 * three by material, the hamlet as one merged cluster, the props instanced across the buildings, the detail and far sets
 * dropped with distance, the doors swinging, the fires and lamps on the clock. It hands itself here; each building model
 * (../models/logCabin.ts, huntingLodge.ts …) builds its Explorer specimen through it (`specimen`: the building alone, in
 * its own frame), and each prop model from the same loaded scan.
 */
import * as THREE from 'three';
import type { Cabins, CabinPropKind } from '../../../world/Cabin';
import type { ModelBuild, ModelContext, ModelPart } from '../../../models/model';

const KEY = 'pine-hollow/cabins';

/** hand the built cabins to their models */
export function useCabins(ctx: ModelContext, cabins: Cabins): void { ctx.once(KEY, () => cabins); }

const cabinsOf = (ctx: ModelContext): Cabins => ctx.once<Cabins>(KEY, () => { throw new Error('[cabins] not built (useCabins)'); });

/** building `id` (Cabins.buildings' id: `cabin-1` … or an extra building's) alone, in its own frame */
export function buildingSpecimen(ctx: ModelContext, id: string): ModelBuild {
  const cabins = cabinsOf(ctx);
  const i = cabins.buildings.findIndex((b) => b.id === id);
  return (i === -1 ? null : cabins.specimen(i)) ?? new THREE.Group();
}

/** a prop kind's parts, their node transforms baked into copies of the scan's geometry (once per shard) */
export function propPart(ctx: ModelContext, kind: CabinPropKind): ModelPart[] {
  return ctx.once(`${KEY}:prop:${kind}`, () => (cabinsOf(ctx).propParts(kind) ?? []).map((p): ModelPart => ({
    geometry: p.geometry.clone().applyMatrix4(p.matrix), material: p.material, castShadow: true, receiveShadow: true,
  })));
}

/** the fire pit or the porch lantern as a building dressed it (its materials fixed, lit like the rest), a copy at the origin */
export function dressedCopy(ctx: ModelContext, which: 'firePit' | 'lantern'): THREE.Object3D {
  const b = cabinsOf(ctx).buildings.find((x) => x[which] !== null);
  const src = b?.[which];
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  if (which === 'lantern') o.scale.setScalar(1.35);
  return o;
}

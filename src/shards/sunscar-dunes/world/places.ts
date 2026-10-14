import { addFire, addLampGlow, fireLight } from './fireFx';
import { COOKFIRE, WAYMARK_FIRE } from '../data/fire';
import { type Group, type Mesh, type MeshStandardMaterial, Vector3 } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { CARAVAN } from '../data/layout';
import { LANTERN } from '../data/places';
import { createWorldScene } from '@wildshard/game/plugin/ui';
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import { WORLD, type BakedWorld } from './baked';
import { DUNE_LIBRARY } from './meshes';

/**
 * Signal Dunes' places (SHARD-PLATFORM SF72): the caravan's and the well's code-built parts and every place's colliders
 * are an offline bake (`generators/places.ts`); here are the generated models on the baked frames and what lives: the
 * caravan's lantern glass and cookfire, the well's bucket, rope, jar and crank, the waymarks' oil and fire. A
 * generated model that did not load stands undrawn, its colliders in place, as a baked piece does.
 */

/** Bind declared baked parts and painted models through the shared world-scene ports. */
export const placeScene = (recipe: { readonly scene: unknown; readonly imports: unknown }, baked: BakedWorld, each?: (material: MeshStandardMaterial) => void): ReturnType<typeof createWorldScene> & { colliders: ColliderDesc[] } => {
  const made = createWorldScene({ scene: recipe.scene, imports: recipe.imports }, { geometry: DUNE_LIBRARY.geometry, model: DUNE_LIBRARY.model,
    baked: (piece, only, material) => WORLD.object(piece, only, material, baked),
    ...(each === undefined ? {} : { materialCollectors: new Map([['embers',each]]) }),
  });
  const part = made.baked.get('baked'); if (part === undefined) throw new Error('Missing declared place bake');
  return { ...made, colliders: part.colliders };
};

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; lampAt: Vector3 }

/**
 * The half-buried caravan: the generated wagon (sunk to its axles and tipped by the drift), the crate pair, the sack pile
 * and the pack horse on the baked camp (the barrel, the logbook on the tailboard, the lantern's iron, the tent, the
 * cookfire's stones); the lantern's lit glass and halo and the cookfire live.
 */
export function buildCaravan(baked: BakedWorld, groundAt: (x: number, z: number) => number): CaravanParts {
  const row = REST_SCENES.places.caravan, made = placeScene(row, baked), { root, colliders } = made, { y } = row.anchors;
  const lamp = made.group('live.lamp'), cook = made.group('live.cook');
  if (lamp === null || cook === null) throw new Error('Missing declared caravan anchors');
  // The lantern's glass in its baked iron (loop 4, mockup B), the logbook's warm light in the dusk.
  const cosY = Math.cos(CARAVAN.yaw), sinY = Math.sin(CARAVAN.yaw);
  addLampGlow(lamp, 0.5, (lx, lz) => { // round 10: drawn over the canvas, 2.4 washed the whole wagon
    const x = LANTERN.x + lx, z = LANTERN.z + lz; // the lamp's frame → the caravan's → the world (three's Ry)
    return groundAt(CARAVAN.x + x * cosY + z * sinY, CARAVAN.z - x * sinY + z * cosY) - (y + LANTERN.y);
  });
  // E399 (mockup B): a smouldering cookfire on the lee side, its thin smoke column rising behind the wagon
  addFire(cook, COOKFIRE, { at: new Vector3(...row.anchors.cook), groundAt });
  return { root, colliders, logbookAt: new Vector3(...row.anchors.logbook), lampAt: new Vector3(...row.anchors.lamp) };
}

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

/**
 * The dry well: the generated ring, posts and windlass (C6, Hunyuan3D-2 from `ref-well.jpg`; its bucket and crank cut
 * away) by the baked marker pole, the dark shaft, and the live crank (the whip's pull target) and rope down to a bucket
 * that holds a sealed clay oil jar. `drop` is how far below the axle the bucket hangs.
 */
export function buildWell(baked: BakedWorld): WellParts {
  const row = REST_SCENES.places.well, made = placeScene(row,baked), {root,colliders} = made;
  const bucket = made.group('live.bucket'), rope = made.mesh('live.rope'), jar = made.mesh('live.jar');
  if (bucket === null || rope === null || jar === null) throw new Error('Missing declared well rest parts');
  return {root,colliders,bucket,rope,jar,crankAt:new Vector3(...row.anchors.crank),jarAt:new Vector3(...row.anchors.jar),drop:row.anchors.drop};
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; bowlAt: Vector3; oil: Mesh; glow: (lit: boolean) => void }

/**
 * Waymark `i`: the generated brazier (loop 6, mockup C) on its baked footing, the oil, the baked log crown and a hidden
 * fire (`fireFx.ts`; no light of its own, one rides to the lit waymark nearest the player).
 */
export function buildBrazier(baked: BakedWorld, i: number, groundAt: (x: number, z: number) => number, colliders: ColliderDesc[]): BrazierParts {
  const row = REST_SCENES.places.braziers[i]; if (row === undefined) throw new Error(`no waymark ${String(i)}`);
  const embers: MeshStandardMaterial[] = [], made = placeScene(row,baked,material=>{embers.push(material);}), {root} = made;
  const oil = made.mesh('live.oil'), fire = made.group('fire');
  if (oil === null || fire === null) throw new Error('Missing declared waymark rest parts');
  addFire(fire, WAYMARK_FIRE, {at:new Vector3(...row.anchors.flame),groundAt});
  const light = fireLight(new Vector3(...row.anchors.light));
  return {root,colliders,fire,bowlAt:new Vector3(...row.anchors.bowl),oil,glow:(lit:boolean)=>{
    light(lit); for (const ember of embers) ember.emissiveIntensity = lit ? 1.1 : 0;
  }};
}

import { addFire, addLampGlow, fireLight } from './fireFx';
import { COOKFIRE, WAYMARK_FIRE } from '../data/fire';
import { Group, type Mesh, type MeshStandardMaterial, Vector3, type Object3D } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { BRAZIERS, CARAVAN, WELL } from '../data/layout';
import { CAMP_HD, COOK, HD, LANTERN, WAYMARK_HD, WELL_RIG, type HdPlacement } from '../data/places';
import caravanRows from '../data/caravan.json' with { type: 'json' };
import wellRows from '../data/well.json' with { type: 'json' };
import brazierRows from '../data/braziers.json' with { type: 'json' };
import { createClientScene } from '@wildshard/game/plugin/ui';
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import { bakedPiece, type BakedWorld } from './baked';
import { DUNE_LIBRARY, duneHd } from './meshes';

/**
 * Signal Dunes' places (SHARD-PLATFORM SF72): the caravan's and the well's code-built parts and every place's colliders
 * are an offline bake (`generators/places.ts`); here are the generated models on the baked frames and what lives: the
 * caravan's lantern glass and cookfire, the well's bucket, rope, jar and crank, the waymarks' oil and fire. A
 * generated model that did not load stands undrawn, its colliders in place, as a baked piece does.
 */

/** Place the rows' hero models under `parent` (a model that did not load stands undrawn, a page fault in world/meshes.ts). */
export const placeHd = (parent: Object3D, rows: readonly HdPlacement[]): void => { for (const { model, fit, at: [x, y, z] = [0, 0, 0], rot: [rx, ry, rz] = [0, 0, 0] } of rows) {
  const made = duneHd(model, fit); if (made) { made.position.set(x, y, z); made.rotation.set(rx, ry, rz); parent.add(made); }
} };

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; lampAt: Vector3 }

/**
 * The half-buried caravan: the generated wagon (sunk to its axles and tipped by the drift), the crate pair, the sack pile
 * and the pack horse on the baked camp (the barrel, the logbook on the tailboard, the lantern's iron, the tent, the
 * cookfire's stones); the lantern's lit glass and halo and the cookfire live.
 */
export function buildCaravan(baked: BakedWorld, groundAt: (x: number, z: number) => number): CaravanParts {
  const { root, colliders } = bakedPiece(baked, 'caravan'), { y } = caravanRows.anchors;
  const camp = new Group(); camp.position.set(CARAVAN.x, y, CARAVAN.z); camp.rotation.y = CARAVAN.yaw; root.add(camp);
  placeHd(camp, CAMP_HD); // the wagon, the crates, the sacks and the pack horse (data/places.ts CAMP_HD)
  // The lantern's glass in its baked iron (loop 4, mockup B), the logbook's warm light in the dusk.
  const lamp = new Group(); lamp.position.set(LANTERN.x, LANTERN.y, LANTERN.z); camp.add(lamp);
  const cosY = Math.cos(CARAVAN.yaw), sinY = Math.sin(CARAVAN.yaw);
  addLampGlow(lamp, 0.5, (lx, lz) => { // round 10: drawn over the canvas, 2.4 washed the whole wagon
    const x = LANTERN.x + lx, z = LANTERN.z + lz; // the lamp's frame → the caravan's → the world (three's Ry)
    return groundAt(CARAVAN.x + x * cosY + z * sinY, CARAVAN.z - x * sinY + z * cosY) - (y + LANTERN.y);
  });
  // E399 (mockup B): a smouldering cookfire on the lee side, its thin smoke column rising behind the wagon
  const cook = new Group(); cook.position.set(COOK.x, 0.15, COOK.z); camp.add(cook);
  const cw = new Vector3(COOK.x, 0, COOK.z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(camp.position);
  addFire(cook, COOKFIRE, { at: new Vector3(cw.x, y + 0.15, cw.z), groundAt });
  return { root, colliders, logbookAt: new Vector3(...caravanRows.anchors.logbook), lampAt: new Vector3(...caravanRows.anchors.lamp) };
}

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

/**
 * The dry well: the generated ring, posts and windlass (C6, Hunyuan3D-2 from `ref-well.jpg`; its bucket and crank cut
 * away) by the baked marker pole, the dark shaft, and the live crank (the whip's pull target) and rope down to a bucket
 * that holds a sealed clay oil jar. `drop` is how far below the axle the bucket hangs.
 */
export function buildWell(baked: BakedWorld): WellParts {
  const { root, colliders } = bakedPiece(baked, 'well'), { y } = wellRows.anchors, { r: R, axleY, drop } = WELL_RIG;
  const made = createClientScene(REST_SCENES.well, { geometry: DUNE_LIBRARY.geometry });
  const bucket = made.group('bucket'), rope = made.mesh('rope'), jar = made.mesh('jar');
  if (bucket === null || rope === null || jar === null) throw new Error('Missing declared well rest parts');
  made.root.position.set(WELL.x, y, WELL.z); root.add(made.root);
  return { root, colliders, bucket, rope, jar, crankAt: new Vector3(WELL.x + R + 0.32, y + axleY, WELL.z), jarAt: new Vector3(WELL.x, y + 1.0, WELL.z), drop };
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; bowlAt: Vector3; oil: Mesh; glow: (lit: boolean) => void }

/**
 * Waymark `i`: the generated brazier (loop 6, mockup C) on its baked footing, the oil, the baked log crown and a hidden
 * fire (`fireFx.ts`; no light of its own, one rides to the lit waymark nearest the player).
 */
export function buildBrazier(baked: BakedWorld, i: number, groundAt: (x: number, z: number) => number): BrazierParts {
  const spot = BRAZIERS[i], row = brazierRows.braziers[i]; if (spot === undefined || row === undefined) throw new Error(`no waymark ${String(i)}`);
  const { x, z } = spot, { y } = row, root = new Group(), bowl = HD.brazier * HD.bowlAt;
  root.position.set(x, y, z);
  placeHd(root, WAYMARK_HD);
  const oil = createClientScene(REST_SCENES.oil, { geometry: DUNE_LIBRARY.geometry }).mesh('oil');
  if (oil === null) throw new Error('Missing declared waymark oil'); root.add(oil);
  // the baked charred log crown (generators/places.ts waymarkCrown), its ember lit with the fire
  const embers: MeshStandardMaterial[] = [], logs = bakedPiece(baked, 'braziers', (kind) => kind.brazier === i, (m) => { embers.push(m); }, row.colliders); root.add(logs.root);
  oil.visible = false;
  const fire = new Group(); fire.position.set(0, bowl, 0); fire.visible = false; root.add(fire);
  // The fire (P2 #8): layered flame, glow, embers downwind, a smoke column and a warm pool on the sand.
  addFire(fire, WAYMARK_FIRE, { at: new Vector3(x, y + bowl, z), groundAt });
  const light = fireLight(new Vector3(x, y + bowl + 0.4, z));
  return { root, colliders: logs.colliders, fire, bowlAt: new Vector3(x, y + 1.6, z), oil, glow: (lit: boolean) => {
    light(lit); for (const ember of embers) ember.emissiveIntensity = lit ? 1.1 : 0;
  } };
}

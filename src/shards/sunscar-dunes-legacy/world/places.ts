import { addFire, addLampGlow, COOKFIRE, fireLight, WAYMARK_FIRE } from './fireFx';
import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3, type Material } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { BRAZIERS, CARAVAN, WELL } from '../data/layout';
import { COOK, CRATES, HORSE, LANTERN, WELL_RIG } from '../data/places';
import caravanRows from '../data/caravan.json' with { type: 'json' };
import wellRows from '../data/well.json' with { type: 'json' };
import brazierRows from '../data/braziers.json' with { type: 'json' };
import { bakedColliders } from '@wildshard/game/shardfile/bakedKinds';
import { bakedPiece, type BakedWorld } from './baked';
import { duneHd, duneMaterial, duneMesh, fit, without } from './meshes';

/**
 * Signal Dunes' places (SHARD-PLATFORM SF72): the caravan's and the well's code-built parts and every place's colliders
 * are an offline bake (`generators/places.ts`); here are the generated models on the baked frames and what lives: the
 * caravan's lantern glass and cookfire, the well's bucket, rope, jar and crank, the waymarks' oil, kindling and fire. A
 * generated model that did not load stands undrawn, its colliders in place, as a baked piece does.
 */

// round 2 (R1C-2): sun-greyed wood and worn iron a step lighter; at dusk the old near-black values read as black cut-outs
const WOOD = 0xa07656, IRON = 0x6e5e56, CLAY = 0x7a3a22, KINDLING = 0x6e4a2e, CHARRED = 0x1c120c;
/** The textured hero models' fitted sizes (metres): the wagon's span and turn, the brazier's height and its bowl's
 *  height as a share of it. */
export const HD = { wagon: 6.4, wagonYaw: Math.PI, brazier: 2.5, bowlAt: 0.86 } as const;
const mat = (color: number, extra: Partial<{ metalness: number; side: typeof DoubleSide; emissive: number }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
/** A generated model's painted material a step lighter (round 2, R1C-2: the iron brazier and the well read black at dusk). */
export const litDune = (): MeshStandardMaterial => {
  // the bowls measured 2 against the sand's 31 (check pass): lifted paint and a faint warm self-light, never black on lit sand
  const m = duneMaterial(); m.color.setRGB(4.2, 3.7, 3.2); m.emissive.setRGB(0.07, 0.045, 0.03); m.roughness = 0.7; return m;
};
const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);
const at = (mesh: Mesh, x: number, y: number, z: number, parent: Group): Mesh => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
const vec = ([x = 0, y = 0, z = 0]: readonly number[]): Vector3 => new Vector3(x, y, z);

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; lampAt: Vector3 }

/**
 * The half-buried caravan: the generated wagon (sunk to its axles and tipped by the drift), the crate pair, the sack pile
 * and the pack horse on the baked camp (the barrel, the logbook on the tailboard, the lantern's iron, the tent, the
 * cookfire's stones); the lantern's lit glass and halo and the cookfire live.
 */
export function buildCaravan(baked: BakedWorld, groundAt: (x: number, z: number) => number): CaravanParts {
  const { root, colliders } = bakedPiece(baked, 'caravan'), { y } = caravanRows.anchors;
  const camp = new Group(); camp.position.set(CARAVAN.x, y, CARAVAN.z); camp.rotation.y = CARAVAN.yaw; root.add(camp);
  // The wagon in its own frame (+Z is the front), tipped and sunk. The original top-10's row 7 (art/sunscar-dunes/round-28-camp):
  // wagon-hd2 from mockup B, torn canvas over bare hoops, a planked tailboard, spoked wheels, its tailboard to the logbook's approach
  const wagon = new Group(); wagon.position.set(0, -0.55, 0); wagon.rotation.set(-0.1, 0, 0.13); camp.add(wagon);
  const hdWagon = duneHd('wagon-hd2', { size: HD.wagon, by: 'span', yaw: HD.wagonYaw }); if (hdWagon) wagon.add(hdWagon);
  // row 7: the modelled crate pair (a crate stacked on a larger one, mockup B) and the sack pile (three tied burlap sacks and a strapped bedroll)
  const cratesHd = duneHd('crates-hd', { size: 1.36, by: 'height', yaw: 0.25 }); if (cratesHd) { cratesHd.position.set(CRATES.x, -0.04, CRATES.z); camp.add(cratesHd); }
  const sacksHd = duneHd('sacks-hd', { size: 0.78, by: 'height', yaw: 0.5 }); if (sacksHd) { sacksHd.position.set(2.0, -0.04, -3.85); camp.add(sacksHd); }
  // The pack horse (E399, mockup B): the generated model (art/sunscar-dunes/round-19-horse), its head (model -X) turned along the wagon
  const horse = duneHd('horse-hd', { size: HORSE.h, by: 'height', yaw: HORSE.yaw }); if (horse) { horse.position.set(HORSE.x, 0, HORSE.z); camp.add(horse); }
  // The lantern's glass in its baked iron (loop 4, mockup B), the logbook's warm light in the dusk.
  const lamp = new Group(); lamp.position.set(LANTERN.x, LANTERN.y, LANTERN.z); camp.add(lamp);
  { const glass = new MeshBasicMaterial({ color: 0xffb24a }); glass.color.multiplyScalar(3.2); at(box(0.13, 0.28, 0.13, glass), -0.22, 0.01, 0, lamp); } // round 10 (R9B-9: the lantern peaked at 183, the mockup's 252): a hot centre
  const cosY = Math.cos(CARAVAN.yaw), sinY = Math.sin(CARAVAN.yaw);
  addLampGlow(lamp, 0.5, (lx, lz) => { // round 10: drawn over the canvas, 2.4 washed the whole wagon
    const x = LANTERN.x + lx, z = LANTERN.z + lz; // the lamp's frame → the caravan's → the world (three's Ry)
    return groundAt(CARAVAN.x + x * cosY + z * sinY, CARAVAN.z - x * sinY + z * cosY) - (y + LANTERN.y);
  });
  // E399 (mockup B): a smouldering cookfire on the lee side, its thin smoke column rising behind the wagon
  const cook = new Group(); cook.position.set(COOK.x, 0.15, COOK.z); camp.add(cook);
  const cw = new Vector3(COOK.x, 0, COOK.z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(camp.position);
  addFire(cook, COOKFIRE, { at: new Vector3(cw.x, y + 0.15, cw.z), groundAt });
  return { root, colliders, logbookAt: vec(caravanRows.anchors.logbook), lampAt: vec(caravanRows.anchors.lamp) };
}

/** The generated well's span (metres, the crank end to the far post): its ring then sits on the stones' colliders. */
const WELL_FIT = 3.4;

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crank: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

/**
 * The dry well: the generated ring, posts and windlass (C6, Hunyuan3D-2 from `ref-well.jpg`; its bucket and crank cut
 * away) by the baked marker pole, the dark shaft, and the live crank (the whip's pull target) and rope down to a bucket
 * that holds a sealed clay oil jar. `drop` is how far below the axle the bucket hangs.
 */
export function buildWell(baked: BakedWorld): WellParts {
  const { root, colliders } = bakedPiece(baked, 'well'), { y } = wellRows.anchors, { r: R, axleY, drop } = WELL_RIG, wood = mat(WOOD);
  const well = new Group(); well.position.set(WELL.x, y, WELL.z); root.add(well);
  const generated = duneMesh('dry-well');
  if (generated) {
    const fitted = fit(generated, { size: WELL_FIT, by: 'span' }), maxX = fitted.boundingBox?.max.x ?? 2;
    well.add(new Mesh(without(fitted, (cx, cy, cz) => cx > maxX - 0.3 || (Math.hypot(cx, cz) < 0.5 && cy > 0.75 && cy < 1.95)), litDune()));
  }
  // The shaft: a dark disc inside the ring.
  at(new Mesh(new CylinderGeometry(R - 0.3, R - 0.3, 0.05, 16), new MeshBasicMaterial({ color: 0x0a0605 })), 0, 0.62, 0, well);
  const crank = box(0.07, 0.6, 0.07, mat(IRON, { metalness: 0.1 })); // matte: metal at dusk mirrored the dark sky to black
  const bucket = new Group(); bucket.position.set(0, axleY - drop, 0); well.add(bucket);
  const ropeGeo = new CylinderGeometry(0.02, 0.02, drop, 4); ropeGeo.translate(0, drop / 2, 0);
  const rope = new Mesh(ropeGeo, mat(0x6b5236)); bucket.add(rope); // grows from the bucket up to the axle; scaled down as it winds
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.material.side = DoubleSide; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), mat(CLAY)); jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  return { root, colliders, bucket, rope, jar, crank, crankAt: new Vector3(WELL.x + R + 0.32, y + axleY, WELL.z), jarAt: new Vector3(WELL.x, y + 1.0, WELL.z), drop };
}

/**
 * A crossed stack of kindling for a brazier's bowl (round 1: the unlit bowls read empty and black); `y` the bowl's floor.
 * `crown`: charred logs splaying out over the rim instead (E399, mockup C: the hero brazier's log fire).
 */
export function kindling(y: number, size = 1, crown = false): Group {
  // the crown's logs glow at the ember (council round 2: unlit, they read as a black tent inside the flame)
  // round 18 (row 3, mockup C: the logs burn orange inside the flame): the crown's charred wood carries an ember glow the
  // brazier switches on when lit (`userData.ember`)
  const g = new Group(), wood = crown ? new MeshStandardMaterial({ color: CHARRED, roughness: 0.95, emissive: 0xff4a10, emissiveIntensity: 0 }) : mat(KINDLING), n = crown ? 11 : 5;
  if (crown) g.userData['ember'] = wood;
  // round 8 (mockup C): the crown adds four logs laid low across the bowl at odd angles, charred dark inside the flame (a
  // steep teepee read as a Λ against the flame's core)
  for (let i = 0; i < n; i++) {
    // a teepee: each stick leans in from the bowl's edge, the tips meeting above the rim, so it reads at eye level; the
    // crown adds four crossing logs over seven splayed ends (round 7's splayed ends read as one stub)
    const tee = crown && i >= 7, a = tee ? (i - 7) * 1.9 + 0.4 : (i / Math.min(n, 7)) * Math.PI * 2 + (crown ? (i % 2) * 0.3 : 0);
    const lean = tee ? 0.72 + (i % 2) * 0.16 : crown ? -0.8 - (i % 3) * 0.1 : 0.5, len = (tee ? 0.4 + (i % 2) * 0.06 : crown ? 0.34 + (i % 2) * 0.06 : 0.6) * size;
    const log = new Mesh(new CylinderGeometry(0.03 * size, 0.04 * size, len, 5), wood);
    log.rotation.order = 'YXZ'; log.rotation.set(-lean, a, 0);
    log.position.set(Math.sin(a) * Math.sin(lean) * len * 0.5, y + Math.cos(lean) * len * 0.5, Math.cos(a) * Math.sin(lean) * len * 0.5); g.add(log);
  }
  return g;
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; bowlAt: Vector3; oil: Mesh; glow: (lit: boolean) => void }

/**
 * Waymark `i`: the generated brazier (loop 6, mockup C) on its baked footing, the oil, the charred log crown and a hidden
 * fire (`fireFx.ts`; no light of its own, one rides to the lit waymark nearest the player).
 */
export function buildBrazier(i: number, groundAt: (x: number, z: number) => number): BrazierParts {
  const spot = BRAZIERS[i], row = brazierRows.braziers[i]; if (spot === undefined || row === undefined) throw new Error(`no waymark ${String(i)}`);
  const { x, z } = spot, { y } = row, root = new Group(), bowl = HD.brazier * HD.bowlAt;
  root.position.set(x, y, z);
  const hdBrazier = duneHd('brazier-hd', { size: HD.brazier, by: 'height', floor: 0 }); if (hdBrazier) root.add(hdBrazier);
  const oil = at(new Mesh(new CylinderGeometry(0.33, 0.33, 0.04, 8), new MeshStandardMaterial({ color: 0x1a120c, roughness: 0.2 })), 0, bowl, 0, root);
  const sticks = kindling(bowl - 0.15, 1.6, true); root.add(sticks);
  const ember: unknown = sticks.userData['ember'];
  oil.visible = false;
  const fire = new Group(); fire.position.set(0, bowl, 0); fire.visible = false; root.add(fire);
  // The fire (P2 #8): layered flame, glow, embers downwind, a smoke column and a warm pool on the sand.
  addFire(fire, WAYMARK_FIRE, { at: new Vector3(x, y + bowl, z), groundAt });
  const light = fireLight(new Vector3(x, y + bowl + 0.4, z));
  return { root, colliders: bakedColliders(row.colliders), fire, bowlAt: new Vector3(x, y + 1.6, z), oil, glow: (lit: boolean) => {
    light(lit); if (ember instanceof MeshStandardMaterial) ember.emissiveIntensity = lit ? 1.1 : 0;
  } };
}

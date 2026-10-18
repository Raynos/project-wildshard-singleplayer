// Deterministic presentation placement, evaluated only by the build driver.
import * as THREE from 'three';
import catalogue from '../data/campCatalogue.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { bakedSamplers, parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { modelPoseMatrix } from '@wildshard/engine/models/placementBatch';
import { inPoiClearing } from './clearings';
import { HORSE_PLAINS, KURGANS, SUMMER_YURTS, SNOW_LOTUS, SNOW_LINE } from './layout';

interface ModelPlacement { x: number; y: number; z: number; rot?: number; scale?: number }
const placementMatrix = (pose: ModelPlacement): THREE.Matrix4 => modelPoseMatrix({ ...pose, yaw: pose.rot ?? 0, scale: pose.scale ?? 1 });

function member(name: 'horse-wild' | 'snow-lotus', poses: readonly ModelPlacement[]) {
  const bounds = new THREE.Box3();
  return { draw: 'instanced', inKit: false, placements: poses.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, matrix: placementMatrix(pose).toArray() })),
    boxes: poses.flatMap(pose => { const [w, h, d] = name === 'horse-wild' ? [0.78, 1.75, 2.16] : [0.55, 0.5, 0.56]; bounds.min.set(-w / 2, 0, -d / 2); bounds.max.set(w / 2, h, d / 2); bounds.applyMatrix4(placementMatrix(pose)); return [...bounds.min, ...bounds.max]; }), solid: [], descs: [], floors: [] };
}
function tier(phone: boolean, ground: (x: number, z: number) => number) {
  const HERDS: { x: number; z: number; r: number; n: number }[] = [
    { x: HORSE_PLAINS.x + 8, z: HORSE_PLAINS.z - 6, r: 42, n: phone ? 50 : 80 },
    { x: -16, z: 62, r: 30, n: phone ? 34 : 56 },
    { x: 130, z: 6, r: 30, n: phone ? 34 : 56 },
    { x: -150, z: 24, r: 26, n: phone ? 30 : 48 },
  ];
  /** coats as a tint over the dun far LOD: bay, chestnut, dun, grey, black, a light dun */
  const COATS: [number, number, number][] = [[0.78, 0.55, 0.42], [1.0, 0.62, 0.42], [1, 1, 1], [1.25, 1.22, 1.18], [0.32, 0.3, 0.3], [1.15, 1.08, 0.95]];


  function herdRows() {
    const rng = new Rng(0x4e4d);
    const blocked = (x: number, z: number): boolean =>
      inPoiClearing(x, z, 4) || KURGANS.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 3) || Math.hypot(x - SUMMER_YURTS.x, z - SUMMER_YURTS.z) < 20;
    interface Horse { x: number; z: number; yaw: number; s: number; speed: number; turn: number; c: number }
    interface Herd { x: number; z: number; r: number; horses: Horse[]; mesh: null }
    const herds: Herd[] = HERDS.map((h) => ({ x: h.x, z: h.z, r: h.r, horses: [], mesh: null }));
    let total = 0;
    for (const [hi, h] of HERDS.entries()) {
      const herd = herds[hi];
      if (!herd) continue;
      const heading = rng.range(0, Math.PI * 2);
      for (let i = 0, tries = 0; i < h.n && tries < h.n * 20; tries++) {
        const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * h.r;
        const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
        if (blocked(x, z) || herd.horses.some((q) => Math.hypot(q.x - x, q.z - z) < 2.2)) continue;
        const foal = rng.next() < 0.12;
        herd.horses.push({ x, z, yaw: heading + rng.range(-1.2, 1.2), s: foal ? rng.range(0.58, 0.66) : rng.range(0.95, 1.06), speed: rng.range(0.05, 0.25), turn: rng.range(-0.15, 0.15), c: rng.int(0, COATS.length - 1) });
        i++;
      }
      total += herd.horses.length;
    }

    return { herds, total, random: rng.snapshot(), member: member('horse-wild', herds.flatMap(h => h.horses.map(q => ({ x: q.x, y: ground(q.x, q.z) - 0.04, z: q.z, rot: q.yaw, scale: q.s })))) };
  }
  function lotusRows() {
    const rng = new Rng(0x5107);
    const places: ModelPlacement[] = [];
    const slope = (x: number, z: number): number => { const e = 1; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
    for (const c of SNOW_LOTUS) {
      const want = Math.round(c.n * (phone ? 0.6 : 1));
      for (let i = 0, tries = 0; i < want && tries < want * 25; tries++) {
        const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * c.r;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = ground(x, z);
        if (slope(x, z) > 0.9 || y > SNOW_LINE + 45 || places.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9)) continue;
        places.push({ x, y: y - 0.06, z, rot: rng.range(0, Math.PI * 2), scale: rng.range(0.75, 1.25) });
        i++;
      }
    }

    const binding = catalogue.find(row => row.key === 'snowLotus')?.source.asset?.material;
    if (binding === undefined) throw new Error('Missing authored snow lotus look');
    return { scene: { version: 1, root: 'lotus', materials: [{kind:'port',id:'material',source:'material'}], nodes: [{kind:'mesh',id:'lotus',name:'nalati-model-snow-lotus',geometry:'model',material:'material',missing:'empty',instances:places.length,matrices:places.flatMap(pose=>placementMatrix(pose).toArray()),castShadow:true,receiveShadow:true}] }, poses: places, look: { rim: binding.rim, bands: binding.bands }, member: member('snow-lotus', places) };
  }
  return { horses: herdRows(), lotus: lotusRows() };
}
/** Freeze both device profiles on the same admitted terrain used by play. */
export function decorativeRows(bytes: Uint8Array): object {
  const terrain = parseBakedTerrain(Uint8Array.from(bytes).buffer);
  if (terrain === null) throw new Error('Missing decorative placement terrain');
  const ground = bakedSamplers(terrain).heightAt;
  return { phone: tier(true, ground), desktop: tier(false, ground) };
}

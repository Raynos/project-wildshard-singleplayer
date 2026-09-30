/**
 * Pine Hollow's homestead as models (E315 M2): the three log cabins, the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`), and the props, fire pits and lanterns their builders set about. src/world/Cabin.ts still
 * builds and draws all of it exactly as before (the cores merged across the cabins, the hamlet one merged cluster, the
 * props instanced across the buildings, the detail / far sets and the doors, fires and lamps it runs); `place(…,
 * { drawnInto })` registers each building's copy with its colliders and floors (the old `cabins` piece, split per
 * building) and each prop's copies, so every card counts them, a tap picks the one under the finger and VIEW IN WORLD
 * lands on a real copy. The doors stay the homestead's moving pieces.
 *
 *   placeCabins({ cabins, sky, registry });   // main.ts's cabins step, once `cabins.build()` has run
 */
import * as THREE from 'three';
import { place, type Placed } from '../../../models/place';
import type { ModelDef, Placement } from '../../../models/model';
import { placeSet } from '../../../models/sets';
import type { Cabins, CabinBuilding, CabinPropKind } from '../../../world/Cabin';
import type { WorldRegistry } from '../../../world/registry';
import type { Sky } from '../../../world/Sky';
import { pineModels } from './context';
import { useCabins } from './cabinKit';
import { CABIN_VARIANTS, logCabin } from '../models/logCabin';
import { huntingLodge } from '../models/huntingLodge';
import { traderStall } from '../models/traderStall';
import { millersHouse } from '../models/millersHouse';
import { watermill } from '../models/watermill';
import { hamletShed } from '../models/hamletShed';
import { woodenCrate } from '../models/woodenCrate';
import { wineBarrel } from '../models/wineBarrel';
import { woodenBucket } from '../models/woodenBucket';
import { hatchet } from '../models/hatchet';
import { stoneFirePit } from '../models/stoneFirePit';
import { porchLantern } from '../models/porchLantern';

type Model = ModelDef<Record<string, never>>;
const HAMLET: Readonly<Record<string, Model>> = { 'hunting-lodge': huntingLodge, 'trader-stall': traderStall, 'millers-house': millersHouse, watermill, 'hamlet-shed': hamletShed };
const PROPS: Readonly<Record<CabinPropKind, Model>> = { crate: woodenCrate, barrel: wineBarrel, bucket: woodenBucket, hatchet };

/** the highest deck rectangle over (x, z) of these floors (Cabins.floorHeightAt's test, per building) */
function floorIn(floors: CabinBuilding['floors'], x: number, z: number): number | undefined {
  for (const f of floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
    if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd) return f.y;
  }
  return undefined;
}

/** a building's world box: what its root draws, and its decks' rectangles up to its ridge */
function buildingBox(b: CabinBuilding): Float32Array {
  const box = new THREE.Box3().setFromObject(b.root), v = new THREE.Vector3();
  for (const f of b.floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const lx = sx * f.hw, lz = sz * f.hd;
      box.expandByPoint(v.set(f.x + lx * c + lz * s, f.y - 0.3, f.z - lx * s + lz * c));
      box.expandByPoint(v.set(f.x + lx * c + lz * s, f.y + 4.5, f.z - lx * s + lz * c));
    }
  }
  return Float32Array.from([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]);
}

const at = (m: THREE.Matrix4): Placement<Record<string, never>> => { const e = m.elements; return { x: e[12], y: e[13], z: e[14], matrix: m }; };

export function placeCabins(h: { cabins: Cabins; sky: Sky; registry: WorldRegistry }): void {
  const { cabins, registry } = h;
  const ctx = pineModels(h.sky);
  useCabins(ctx, cabins);
  const hamlet: Placed[] = [];
  for (const b of cabins.buildings) {
    const pl = { x: b.x, y: b.y, z: b.z, yaw: b.rot };
    const piece = { solidFloor: true, floor: (x: number, z: number): number | undefined => floorIn(b.floors, x, z) };
    const drawnInto = { object: b.cluster ?? b.root, boxes: buildingBox(b), colliders: b.colliders };
    const hm = HAMLET[b.id];
    if (hm) hamlet.push(place(hm, [pl], { ctx, draw: 'merged', registry, drawnInto, piece: { ...piece, id: `pine-hollow/${b.id}` } }));
    else {
      const site = b.index;
      place(logCabin, [{ ...pl, variant: CABIN_VARIANTS[site] ?? 'hollow' }], { ctx, draw: 'merged', registry, drawnInto, piece: { ...piece, id: `cabin-${site + 1}` } });
    }
  }
  // the props: the cabins' copies (drawn by the shared instanced meshes) and the hamlet's (the cluster's own)
  for (const [kind, model] of Object.entries(PROPS) as [CabinPropKind, Model][]) {
    for (const cluster of [false, true]) {
      const mats = cabins.buildings.filter((b) => (b.cluster !== null) === cluster).flatMap((b) => b.props[kind]);
      const mesh = cabins.propMeshes.find((m) => m.kind === kind && m.cluster === cluster)?.mesh;
      if (mats.length === 0 || !mesh) continue;
      const boxes = new Float32Array(mats.length * 6), v = new THREE.Vector3();
      mats.forEach((m, i) => { v.setFromMatrixPosition(m); boxes.set([v.x - 0.6, v.y - 0.1, v.z - 0.6, v.x + 0.6, v.y + 1.2, v.z + 0.6], i * 6); });
      const placed = place(model, mats.map(at), { ctx, draw: 'instanced', registry, drawnInto: { object: mesh, boxes }, piece: { id: `${model.id}${cluster ? '#hamlet' : ''}` } });
      if (cluster) hamlet.push(placed);
    }
  }
  // each building's fire pit and porch lantern, drawn in its own root
  for (const [which, model] of [['firePit', stoneFirePit], ['lantern', porchLantern]] as const) {
    for (const b of cabins.buildings) {
      const o = b[which];
      if (!o) continue;
      o.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(o);
      const placed = place(model, [at(o.matrixWorld.clone())], { ctx, draw: 'single', registry,
        drawnInto: { object: o, boxes: Float32Array.from([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) }, piece: { id: `${model.id}@${b.id}` } });
      if (b.cluster) hamlet.push(placed);
    }
  }
  if (hamlet.length > 0) placeSet({ id: 'pine-hollow/mill-hamlet', name: 'Mill hamlet', file: 'src/chunks/pine-hollow/world/cabins.ts', members: hamlet, place: 'pine-hollow/hamlet', registry }); // the named place (M12)
}

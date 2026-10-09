/**
 * Pine Hollow's homestead as models (E315 M2; E347: drawn by `place`): the three log cabins, the mill hamlet's five
 * buildings (the set `pine-hollow/mill-hamlet`), and the props, fire pits and lanterns their builders set about.
 * src/engine/world/Cabin.ts builds each building where it stands (the log kit, ../models/logCabin.ts) and runs what lives in it
 * (doors, fires, lamps, the wheel); here every building's model is placed into a weld (src/engine/models/weld.ts):
 *  - the cabins: each its own unit — its parts merged per material under its root, its detail and far sets dropped with
 *    its distance — and their never-hidden materials welded across the three (one draw per material, a view per cabin)
 *  - the hamlet: one unit — its five buildings' parts welded into one set under the hamlet's root, dropped with its
 *    distance (+ its pad)
 *  - the props (crate, barrel, bucket, hatchet): instanced across each weld, hosted by the building they stand about —
 *    drawn while its detail set is
 * Each building's piece carries its colliders and floors (the old `cabins` piece, split per building), each prop's its
 * copies', so every card counts them, a tap picks the one under the finger and VIEW IN WORLD lands on a real copy. The
 * fire pits and lanterns are drawn by their building (`drawnInto`); the doors stay the homestead's moving pieces.
 *
 *   await placeCabins({ cabins, sky, registry });   // main.ts's cabins step, once `cabins.build()` has run
 */
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelDef, Placement } from '@wildshard/engine/models/model';
import { finishWeld, place, weld, type Placed } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Cabins, CabinBuilding, CabinPropKind } from './homestead';
import { pineModels } from './context';
import { CABIN_VARIANTS, logCabin, useCabins } from '../models/logCabin';
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

const at = (m: THREE.Matrix4, host?: number): Placement<Record<string, never>> => { const e = m.elements; return { x: e[12], y: e[13], z: e[14], matrix: m, ...(host === undefined ? {} : { host }) }; };

export async function placeCabins(h: { cabins: Cabins; sky: Sky; registry: WorldRegistry }): Promise<void> {
  const { cabins, registry } = h;
  const ctx = pineModels(h.sky);
  useCabins(ctx, cabins);
  const detail = TIER_CONFIG.cabinDetailDist;
  // the cabins: each its own unit, their never-hidden materials welded across the three; on the desktop tier each draws its
  // depth near as one proxy (its detail and props included)
  const cabinWeld = weld({ unit: 'copy', parent: cabins.group, detail, near: TIER_CONFIG.cabinDetailShadows });
  // the hamlet: one unit, its five buildings in one set under its root
  const hamletWeld = cabins.cluster === null ? null : weld({ unit: 'whole', parent: cabins.group, root: cabins.cluster, pad: cabins.clusterPad, detail });
  const hamlet: Placed[] = [];
  /** each building's index in its weld (a prop's host) */
  const hostOf = new Map<CabinBuilding, number>();
  for (const b of cabins.buildings) {
    const w = b.hamlet ? hamletWeld : cabinWeld;
    if (w === null) continue;
    if (hostOf.size > 0) await macrotask(); // one building's merge per task (the phone's ~30 ms budget)
    hostOf.set(b, w.size);
    const pl = { x: b.x, y: b.y, z: b.z, yaw: b.rot };
    const piece = { solidFloor: true, floor: (x: number, z: number): number | undefined => floorIn(b.floors, x, z) };
    const hm = HAMLET[b.id];
    if (hm) hamlet.push(place(hm, [pl], { ctx, draw: 'merged', registry, weld: w, piece: { ...piece, id: `pine-hollow/${b.id}` } }));
    else {
      const site = b.index;
      place(logCabin, [{ ...pl, variant: CABIN_VARIANTS[site] ?? 'hollow' }], { ctx, draw: 'merged', registry, weld: w, piece: { ...piece, id: `cabin-${site + 1}` } });
    }
  }
  await macrotask();
  // the welds drawn (the hamlet's set merged here), their bands started, the buildings' pieces registered in order
  finishWeld(cabinWeld);
  if (hamletWeld) finishWeld(hamletWeld);
  // the props: the cabins' copies (one instanced mesh per part across the three) and the hamlet's (its own)
  for (const [kind, model] of Object.entries(PROPS) as [CabinPropKind, Model][]) {
    for (const [w, inHamlet] of [[cabinWeld, false], [hamletWeld, true]] as const) {
      if (w === null) continue;
      const copies = cabins.buildings.filter((b) => b.hamlet === inHamlet).flatMap((b) => b.props[kind].map((m) => at(m, hostOf.get(b))));
      if (copies.length === 0) continue;
      const placed = place(model, copies, { ctx, draw: 'instanced', registry, weld: w, piece: { id: `${model.id}${inHamlet ? '#hamlet' : ''}` } });
      if (inHamlet) hamlet.push(placed);
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
      if (b.hamlet) hamlet.push(placed);
    }
  }
  if (hamlet.length > 0) placeSet({ id: 'pine-hollow/mill-hamlet', name: 'Mill hamlet', file: 'src/shards/pine-hollow/world/cabins.ts', members: hamlet, place: 'pine-hollow/hamlet', registry }); // the named place (M12)
}

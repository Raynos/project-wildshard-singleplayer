/**
 * The dressing's one-off props, merged (PaintKit, the shared POI material): fallen spruce logs and stumps round the
 * gullies, bleached driftwood on the gravel bars, ovoo cairns (stone heaps with a pole bundle and khadag ribbons) and
 * lone ribbon poles at the viewpoints, the sky road's guard fences and gateway, and the loose clutter round the camps
 * (firewood tipis, dung-cake stacks, chopping blocks with log rounds, pots and buckets, sacks, folded felts).
 *
 * Merged into four region meshes (valley / plateau × east / west) so the frustum still drops the ones behind you;
 * the ribbons go into the dressing's own `Flutter` (one cloth draw for all of them).
 *
 * E306 / E315 second pass: each prop is a model (src/shards/nalati-grasslands/models/dressingProps.ts, fence.ts),
 * painted into a kit of its own through one NalatiSet (src/shards/nalati-grasslands/world/painted.ts `into`), in the old order and from
 * the old shared rng stream — so the region meshes are bit-identical — and placed `drawnInto` them (the returned set).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@wildshard/engine/core/rng';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { PaintKit, poiMaterial, texturedMaterial } from '../paint';
import { NalatiSet } from '../painted';
import { Flutter } from '../Flutter';
import { Smoke } from '../Smoke';
import { campClutterSpots, type DressPlan } from './place';
import { fence, fenceRun } from '../../models/fence';
import { fallenLog, logEnds, stump, ovoo, viewpointPole, skyGateway, campClutter } from '../../models/dressingProps';

type Ground = (x: number, z: number) => number;
const ground: Ground = (x, z) => heightAt(x, z);

export interface Statics {
  meshes: THREE.Mesh[]; tris: number; colliders: Collider[]; descs: ColliderDesc[];
  /** the props, painted: `set.register(…)` places them drawnInto the meshes */
  set: NalatiSet;
}

export function buildStatics(sky: Sky, plan: DressPlan, flutter: Flutter): Statics {
  const regions = new Map<number, THREE.BufferGeometry[]>();
  const put = (x: number, z: number, g: THREE.BufferGeometry) => {
    const k = (x < 0 ? 0 : 1) + (z > 60 ? 2 : 0);
    let list = regions.get(k); if (!list) regions.set(k, (list = []));
    list.push(g);
  };
  const descs: ColliderDesc[] = [];
  const rng = new Rng(0x0d7e);
  const set = new NalatiSet(null, { ground, flutter, smoke: new Smoke() });
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });

  // ── logs + driftwood (no AO bake: a lone log has nothing to occlude it; the contact shade does the foot) ──
  for (const l of plan.logs) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const e = logEnds(l.ax, l.az, l.bx, l.bz);
    const made = set.into(kit).paint(fallenLog, on(e.at.x, e.at.z), { ...e.ends, r: l.r, drift: l.drift, rng });
    descs.push(...(made.descs ?? []));
    put((l.ax + l.bx) / 2, (l.az + l.bz) / 2, kit.finish({ ground, aoH: 0.3, aoMin: 0.6, ao: false }));
  }

  // ── stumps ──
  for (const s of plan.stumps) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(stump, on(s.x, s.z), { s: s.s, rng });
    put(s.x, s.z, kit.finish({ ground, aoH: 0.35, ao: false }));
  }

  // ── ovoo cairns: a stone heap, a lashed pole bundle, ribbons ──
  for (const o of plan.ovoos) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const made = set.into(kit).paint(ovoo, on(o.x, o.z), { s: o.s, rng });
    descs.push(...(made.descs ?? []));
    put(o.x, o.z, kit.finish({ ground, aoH: 0.4, ao: { strength: 0.5 } }));
  }

  // ── lone ribbon poles ──
  for (const p of plan.poles) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(viewpointPole, on(p.x, p.z), { rng });
    put(p.x, p.z, kit.finish({ ground, aoH: 0.3, ao: false }));
  }

  // ── the sky road's guard fences (the split-rail fence) + the gateway on the rim ──
  // (the timber is the kit's 'rock' textured layer — props.ts GRAIN — so every run goes into one extra mesh, `wood`)
  const woodGeos: THREE.BufferGeometry[] = [];
  for (const run of plan.fences) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const r = fenceRun(run, { h: 1.05, spacing: 2.6 });
    set.into(kit).paint(fence, on(r.at.x, r.at.z), r.params);
    const g = kit.finishTextured({ ground, aoH: 0.3, ao: false }, 'rock');
    if (g) woodGeos.push(g);
    if (!kit.empty) { const mid = run[Math.floor(run.length / 2)] ?? [0, 0]; put(mid[0], mid[1], kit.finish({ ground, aoH: 0.3, ao: false })); }
  }
  for (const g of plan.gates) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(skyGateway, on(g.x, g.z, g.yaw), { rng });
    put(g.x, g.z, kit.finish({ ground, aoH: 0.4, ao: false }));
  }

  const meshes: THREE.Mesh[] = [];
  let tris = 0;
  for (const [k, list] of regions) {
    if (list.length === 0) continue;
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, poiMaterial(sky));
    m.name = `nalati-dress-props-${k}`;
    m.castShadow = true; m.receiveShadow = true;
    meshes.push(m);
    tris += geo.getAttribute('position').count / 3;
  }
  if (woodGeos.length > 0) {
    const geo = mergeGeometries(woodGeos, false);
    for (const g of woodGeos) g.dispose();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, texturedMaterial(sky, 'rock'));
    m.name = 'nalati-dress-fences';
    m.castShadow = true; m.receiveShadow = true;
    meshes.push(m);
    tris += geo.getAttribute('position').count / 3;
  }
  return { meshes, tris, colliders: set.boxes, descs, set };
}

/**
 * The camps' loose clutter as one merged mesh. Built after the POIs are in (`avoid` = the player's colliders then, the
 * POI agent's set pieces among them), so nothing lands inside a stove, a cart or a rug rack. Each group is the camp
 * clutter model (src/shards/nalati-grasslands/models/dressingProps.ts), placed drawnInto the mesh (`set`).
 */
export function buildCampClutter(sky: Sky, avoid: readonly Collider[]): { mesh: THREE.Mesh | null; colliders: Collider[]; tris: number; spots: number; set: NalatiSet } {
  const rng = new Rng(0xc1a7);
  const kit = new PaintKit(0xc1a8);
  const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
  const spots = campClutterSpots(avoid);
  for (const s of spots) set.paint(campClutter, { x: s.x, y: ground(s.x, s.z), z: s.z, yaw: s.yaw }, { kind: s.kind, rng });
  if (kit.empty) return { mesh: null, colliders: set.boxes, tris: 0, spots: 0, set };
  const mesh = kit.mesh(sky, { ground, aoH: 0.35, ao: { strength: 0.45 } });
  mesh.name = 'nalati-dress-camp-clutter';
  return { mesh, colliders: set.boxes, tris: mesh.geometry.getAttribute('position').count / 3, spots: spots.length, set };
}

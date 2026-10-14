import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { log, plank, rock, rope } from '@wildshard/engine/world/geometryKit';
import { ShipwreckBuilder, WRECK_COLOURS as C, type CargoCopy, type WreckAround } from './shipwreck';
import { addBarrel, addCoil, addCrate } from '../models/cargo';
import { rockGeometry, REEF_ROCK } from '../world/rockKit';
import { addDriftLog, DRIFT } from '../world/driftLogs';
import type { WreckSpec, WreckAnchor, HoldBounds } from '../assets/contracts/wreck';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import { wreckCatalogue } from './wreckCatalogue';

/** Authored draw and native layout of the canonical Wreck Cove site. */
export interface WreckSiteBake {
  geometry: {kit:THREE.BufferGeometry;glow:THREE.BufferGeometry;rocks:THREE.BufferGeometry};
  rows: {spec:WreckSpec;floorY:number;colliders:BoxSpec[];descs:ColliderDesc[];
    anchors:Record<string,WreckAnchor>;holdBounds:HoldBounds;floor:ReturnType<ShipwreckBuilder['floorRows']>;shipBox:number[];
    catalogue:ReturnType<typeof wreckCatalogue>};
}

/** Build the complete Wreck Cove draw with its original ordered surroundings and shared AO. */
export function wreckSite(spec: WreckSpec, heightAt: (x: number, z: number) => number): WreckSiteBake {
  const ship = new ShipwreckBuilder(spec, heightAt);
  const cargo: CargoCopy[] = [], logs: { a: THREE.Vector3; b: THREE.Vector3; r: number; tone: number }[] = [];
  const rocks: { m: THREE.Matrix4; r: number; moss: number; box: THREE.Box3 }[] = [];
  let reefGeometry = new THREE.BufferGeometry();
  const geometry = ship.build((at: WreckAround) => {
    const { kit, rng, sea, colliders, cs, sn, floorY } = at;
    const site = ship.spec, logCopies = logs, reefCopies = rocks, strays = cargo;
    // the strays are the cargo models too (recorded after the hold's)
    const barrel = (m: THREE.Matrix4, lying = false): void => { addBarrel(kit, m, lying); strays.push({ kind: lying ? 'lying' : 'barrel', matrix: m, size: 0 }); };
    const crate = (m: THREE.Matrix4, sz: number, broken = false): void => { addCrate(kit, m, sz, broken); strays.push({ kind: broken ? 'broken' : 'crate', matrix: m, size: sz }); };
    const coil = (m: THREE.Matrix4, r = 0.3): void => { addCoil(kit, m, r); strays.push({ kind: 'coil', matrix: m, size: r }); };
      // ── around the wreck (world space): driftwood piles on the beach, barrels, crates, a net, reef rocks, flotsam ──
      const W0 = new THREE.Matrix4();
      const wm = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
        W0.clone().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
      const hw = (lx: number, lz: number): [number, number] => [site.x + lx * cs + lz * sn, site.z - lx * sn + lz * cs];
      const pile = (px: number, pz: number, n: number, spread: number, seedYaw: number): void => {
        let layer = 0;
        for (let k = 0; k < n; k++) {
          const len = rng.range(2.4, 5.2), r = rng.range(0.14, 0.32), yaw = seedYaw + (k % 2 ? 1.2 : 0) + rng.range(-0.35, 0.35);
          const ox = px + rng.range(-spread, spread), oz = pz + rng.range(-spread, spread);
          const dx = Math.cos(yaw) * len / 2, dz = Math.sin(yaw) * len / 2;
          const ya = heightAt(ox - dx, oz - dz), yb = heightAt(ox + dx, oz + dz), lift = layer * 0.28 + r * 0.8;
          const a = new THREE.Vector3(ox - dx, ya + lift + rng.range(0, 0.15), oz - dz), b = new THREE.Vector3(ox + dx, yb + lift + rng.range(0, 0.15), oz + dz);
          addDriftLog(kit, a, b, r, r * rng.range(0.6, 0.85), { sides: 7, twist: rng.range(0, 1), tone: k, wobble: 0.03 });
          logCopies.push({ a, b, r, tone: k });
          if (rng.next() < 0.45) {                                          // a snapped branch stub
            const m = a.clone().lerp(b, rng.range(0.3, 0.7));
            kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.4, 0.4), rng.range(0.3, 0.6), rng.range(-0.4, 0.4))), r * 0.35, r * 0.2, 5), DRIFT.stub);
          }
          if (rng.next() < 0.3) {                                           // a rope lashed round it
            const m = a.clone().lerp(b, rng.range(0.2, 0.8)), dir = b.clone().sub(a).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            for (let j = 0; j < 3; j++) kit.add(new THREE.TorusGeometry(r + 0.03, 0.03, 3, 8), C.rope, { matrix: new THREE.Matrix4().compose(m.clone().addScaledVector(dir, (j - 1) * 0.08), q, new THREE.Vector3(1, 1, 1)) });
          }
          if (k % 2 === 1) layer++;
        }
        colliders.push({ x: px, z: pz, hw: spread + 0.9, hd: spread + 0.9, rot: 0, yTop: heightAt(px, pz) + 0.6 + layer * 0.28, yBottom: heightAt(px, pz) - 2 });
      };
      // the piles sit on the cove beach west / south-west of the hull (between the path's end and the water)
      // (hull-local x / z: +x = starboard = WSW, the beach; −z = the bow = NNW, toward the crag)
      // E354: the third pile stood on the path's last stretch (its 3.6 m box across x 133.5…137.1 at z ≈ 3.3, a 1.1 m
      // wall both ways); 2 m sternward it lies 1.4 m south of the path
      const piles: [number, number, number, number, number][] = [[9, -9, 7, 1.1, 0.4], [14, 4.5, 6, 1.0, 1.9], [16, -5.5, 5, 0.9, 1.1], [6, -13, 4, 0.8, 0.2]];
      const pileAt: [number, number][] = [];
      for (const [lx, lz, n, s, yw] of piles) { const [x, z] = hw(lx, lz); pile(x, z, n, s, yw); pileAt.push([x, z]); }
      // a net draped over the first pile, a coil and a lantern-less barrel beside it
      {
        const [px, pz] = pileAt[0] ?? [0, 0], cols = 8, rowsN = 6;
        const P = (c: number, r: number): THREE.Vector3 => {
          const x = px - 1.4 + (c / (cols - 1)) * 2.8, z = pz - 1.0 + (r / (rowsN - 1)) * 2.0;
          const cx = (c / (cols - 1)) * 2 - 1, cz = (r / (rowsN - 1)) * 2 - 1;
          return new THREE.Vector3(x, heightAt(x, z) + 0.05 + Math.max(0, 1 - cx * cx) * Math.max(0, 1 - cz * cz * 0.8) * 0.75 + 0.05, z);
        };
        for (let c = 0; c < cols; c++) for (let r = 0; r + 1 < rowsN; r++) kit.add(rope([P(c, r), P(c, r + 1)], 0.02, 3), C.net, { jitter: 0.05 });
        for (let r = 0; r < rowsN; r++) for (let c = 0; c + 1 < cols; c++) kit.add(rope([P(c, r), P(c + 1, r)], 0.02, 3), C.net, { jitter: 0.05 });
      }
      const loose: [number, number, 'barrel' | 'lying' | 'crate' | 'broken' | 'coil', number][] = [
        [10.8, -6.2, 'barrel', 0], [11.6, -5.4, 'lying', 0.8], [12.2, 2.6, 'crate', 0.4], [13.1, 1.8, 'broken', -0.3],
        [14.4, -4.6, 'coil', 0], [7.2, -10.2, 'barrel', 0], [8.8, -11.6, 'coil', 0], [17.8, -10.4, 'lying', 2.2],
      ];
      for (const [lx, lz, kind, yaw] of loose) {
        const [x, z] = hw(lx, lz), y = heightAt(x, z);
        if (kind === 'barrel') barrel(wm(x, y + 0.42, z, yaw, rng.range(-0.08, 0.08)));
        else if (kind === 'lying') barrel(wm(x, y + 0.3, z, yaw), true);
        else if (kind === 'crate') crate(wm(x, y - 0.05, z, yaw, 0.05), 0.75);
        else if (kind === 'broken') crate(wm(x, y - 0.04, z, yaw), 0.7, true);
        else coil(wm(x, y, z, yaw), 0.34);
        if (kind !== 'coil') colliders.push({ x, z, hw: 0.45, hd: 0.45, rot: -yaw, yTop: y + 0.9, yBottom: y - 1 });
      }
      // reef rocks around the hull in the water (mossy tops), a few in the shallows toward the beach
      const reefs: [number, number, number][] = [
        [-4.2, 3, 1.4], [-4.0, 6, 1.1], [-3.2, 9.4, 1.6], [0.5, 10.6, 1.3], [3.8, 8.5, 1.2], [4.4, 5.2, 0.9], [4.8, 2.5, 1.0],
        [-4.4, -1.5, 0.9], [-3.8, -6.5, 1.2], [4.3, -5.8, 0.8], [6.8, 4, 0.7], [-6.3, 7.5, 0.8], [6.2, 10.5, 1.4], [-2.0, 12.4, 1.1],
        [7.5, -3.8, 0.6], [6.2, 3.2, 0.5], [8.5, 7.0, 0.9],
      ];
      // E114: the reef rocks are rockKit rocks (smooth painted). The draws the old flat-shaded rocks took (the rock, its
      // side colour, one per face) are still burnt, so everything after the rocks is placed as it always was
      const rockRng = new Rng(SEED ^ 0x70c5), reef: THREE.BufferGeometry[] = [];
      for (const [lx, lz, r] of reefs) {
        const [x, z] = hw(lx, lz), y = heightAt(x, z);
        const old = rock(r, 1, rng, 0.62, 0.3);
        rng.next();
        const mossy = rng.next() < 0.6, m = wm(x, y + r * 0.2, z, rng.range(0, 6));
        for (let i = old.getAttribute('position').count / 3; i > 0; i--) rng.next();
        old.dispose();
        const g = rockGeometry(r, rockRng, { squash: 0.62, palette: REEF_ROCK, moss: mossy ? 0.9 : 0.5, ground: -0.2 * r });
        g.applyMatrix4(m); reef.push(g);
        g.computeBoundingBox(); reefCopies.push({ m, r, moss: mossy ? 0.9 : 0.5, box: g.boundingBox?.clone() ?? new THREE.Box3() });
        if (r > 0.9) colliders.push({ x, z, hw: r * 0.8, hd: r * 0.8, rot: 0, yTop: y + r * 0.7, yBottom: y - 2 });
      }
      if (reef.length > 0) {
        // their own smooth normals can't join the flat-shaded kit: all the rocks are one more draw
        reefGeometry = mergeGeometries(reef, false);
        for (const part of reef) part.dispose();
      }
      // flotsam: planks lying in the shallows by the stern, a spar leaning on the hull
      for (let k = 0; k < 6; k++) {
        const [x, z] = hw(rng.range(2, 7), rng.range(4, 13)), yaw = rng.range(0, Math.PI);
        kit.add(plank(rng.range(1.2, 2.4), rng.range(0.22, 0.3), 0.06, rng, 0.02), rng.next() < 0.5 ? C.hullGrey : C.hull, { matrix: wm(x, Math.max(heightAt(x, z) + 0.04, sea + 0.01), z, yaw, 0, rng.range(-0.1, 0.1)) });
      }
      {
        const [x0, z0] = hw(4.6, 7.2), [x1, z1] = hw(2.4, 3.2);
        kit.add(log(new THREE.Vector3(x0, heightAt(x0, z0) + 0.1, z0), new THREE.Vector3(x1, floorY + 1.6, z1), 0.16, 0.12, 6), C.mast);
      }
  });
  const box = ship.shipBox(new THREE.Box3());
  return { geometry: { kit: geometry.geometry, glow: geometry.glow, rocks: reefGeometry },
    rows: { spec, floorY: ship.floorY, colliders: ship.colliders, descs: ship.colliderDescs(),
      anchors: ship.anchors, holdBounds: ship.holdBounds, floor: ship.floorRows(), shipBox: [...box.min, ...box.max],
      catalogue: wreckCatalogue([...ship.cargo,...cargo],logs,rocks) } };
}

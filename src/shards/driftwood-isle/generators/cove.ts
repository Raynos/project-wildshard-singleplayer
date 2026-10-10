/** Original cove dressing, generated offline against the admitted native terrain. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { rock, log, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, bakeLight, type BakedLight } from '@wildshard/engine/world/lowpolyKit';
import { rockGeometry, REEF_ROCK } from '../world/rockKit';
import { ANTE, PASS, ALC_FLOOR, ANTE_FLOOR, RAMP, coveFloorAt, coveHalfWidth, coveCeil, coveWorld, type CoveSpec } from '../world/coveLayout';

// the crag's rock: E310 T2 B, a warmer grey lifted ~25 % from the old charcoal (#50555d): still heavy, never black
const C = {
  rock: '#6a6862', rockB: '#605e59', rockDark: '#4c4a47', rockWet: '#56605f', rockIn: '#5a544d', rockInB: '#655e56',
  grass: '#6fa23e', grassB: '#86b84a', moss: '#5f8a3a', vine: '#4f8a32', vineB: '#6aa640', sand: '#b9a67c', slab: '#7a756c', slabB: '#8a847a',
  star: '#e8622a', starPurple: '#6b3fa0', crystal: '#7ff0ff', crystalB: '#5fd0ff', flame: '#ffc46a', torch: '#5a4230', stala: '#555860',
};

export interface CoveGeometry {
  geometry: Record<'structure' | 'rocks' | 'glow' | 'pools', THREE.BufferGeometry>;
  placements: { m: THREE.Matrix4; r: number; squash: number; moss: number; box: THREE.Box3 }[];
}

export function coveGeometry(spec: CoveSpec, heightAt: (x: number, z: number) => number): CoveGeometry {
    const placements: { m: THREE.Matrix4; r: number; squash: number; moss: number; box: THREE.Box3 }[] = [];
    const kit = new LowPolyKit(SEED ^ 0xc0e5), rng = kit.rng;
    const glow = new LowPolyKit(SEED ^ 0xc0e6);
    const lights: BakedLight[] = [];
    const cave = spec.cave;
    const m4 = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1): THREE.Matrix4 =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
    const boulder = (x: number, y: number, z: number, r: number, side: string, top: string, squash = 0.8, rough = 0.28): void =>
      kit.addTopped(rock(r, 1, rng, squash, rough), side, top, { matrix: m4(x, y, z, rng.range(0, 6.28)), minY: 0.6, jitter: 0.08 });
    // E114: the loose outdoor rocks (tidepool rims, the plunge pool) are rockKit rocks (smooth painted); the crag and the
    // cave walls stay as they are (they are structure). The draws `boulder` would take are burnt, so everything after
    // is placed as it always was.
    const rockRng = new Rng(SEED ^ 0x70c7), smoothRocks: THREE.BufferGeometry[] = [];
    const looseRock = (x: number, y: number, z: number, r: number, top: string, squash = 0.8): void => {
      const old = rock(r, 1, rng, squash, 0.28), m = m4(x, y, z, rng.range(0, 6.28));
      for (let i = old.getAttribute('position').count / 3; i > 0; i--) rng.next();
      old.dispose();
      const g = rockGeometry(r, rockRng, { squash, palette: REEF_ROCK, moss: top === C.moss ? 0.8 : 0.3, ground: -0.2 * r });
      g.applyMatrix4(m); smoothRocks.push(g);
      g.computeBoundingBox(); placements.push({ m, r, squash, moss: top === C.moss ? 0.8 : 0.3, box: g.boundingBox?.clone() ?? new THREE.Box3() });
    };
    const starfish = (x: number, y: number, z: number, r: number, col: string): void => {
      const v: number[] = [], rot = rng.range(0, 6.28);
      for (let k = 0; k < 5; k++) {
        const a0 = rot + (k / 5) * Math.PI * 2, tipX = x + Math.cos(a0) * r, tipZ = z + Math.sin(a0) * r;
        const lx = x + Math.cos(a0 + Math.PI / 5) * r * 0.35, lz = z + Math.sin(a0 + Math.PI / 5) * r * 0.35, rx = x + Math.cos(a0 - Math.PI / 5) * r * 0.35, rz = z + Math.sin(a0 - Math.PI / 5) * r * 0.35;
        v.push(x, y + r * 0.22, z, rx, y + 0.01, rz, tipX, y + 0.01, tipZ, x, y + r * 0.22, z, tipX, y + 0.01, tipZ, lx, y + 0.01, lz);
      }
      kit.add(tris(v), col, { jitter: 0.08 });
    };

    // ── tidepools: a rim of dark rocks, the water disc a hand under the sand line, starfish on the rim ──
    const poolParts: THREE.BufferGeometry[] = [];
    for (const p of spec.pools) {
      const gy = heightAt(p.x, p.z), nR = Math.round(p.r * 3.2);
      for (let i = 0; i < nR; i++) {
        const a = (i / nR) * Math.PI * 2 + rng.range(-0.2, 0.2), rr = p.r + rng.range(-0.1, 0.35);
        const rx = p.x + Math.cos(a) * rr, rz = p.z + Math.sin(a) * rr, r = rng.range(0.22, 0.5);
        rng.next();                                                     // the old rim rock's side colour
        looseRock(rx, heightAt(rx, rz) + r * 0.2, rz, r, rng.next() < 0.4 ? C.moss : C.rockB, 0.65);
        if (rng.next() < 0.28) starfish(rx + rng.range(-0.2, 0.2), heightAt(rx, rz) + 0.16, rz + rng.range(-0.2, 0.2), rng.range(0.12, 0.2), rng.next() < 0.7 ? C.star : C.starPurple);
      }
      const disc = new THREE.CircleGeometry(p.r + 0.05, 10);
      disc.rotateX(-Math.PI / 2); disc.translate(p.x, gy + 0.03, p.z);
      poolParts.push(disc);
      if (rng.next() < 0.7) starfish(p.x + rng.range(-0.4, 0.4), gy - 0.02, p.z + rng.range(-0.4, 0.4), rng.range(0.14, 0.22), C.star);
    }

    // ── the cascade: a ribbon of quads hugging the crag face, foam bands scroll down it; a plunge pool at the foot ──
    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot;
      const w = spec.fall.width;
      const dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz), sx = -dz / len, sz = dx / len;
      for (let i = 0; i < 9; i++) {
        const u = rng.range(0.05, 0.95), side = i % 2 ? 1 : -1, r = rng.range(0.35, 0.8);
        const x = tx + dx * u + sx * side * (w * 0.7 + rng.range(0, 0.5)), z = tz + dz * u + sz * side * (w * 0.7 + rng.range(0, 0.5));
        looseRock(x, heightAt(x, z) + r * 0.25, z, r, C.moss, 0.7);
      }
      const px = fx + (dx / len) * 1.2, pz = fz + (dz / len) * 1.2, py = heightAt(fx, fz);
      const disc = new THREE.CircleGeometry(2.4, 12); disc.rotateX(-Math.PI / 2); disc.translate(px, py + 0.05, pz);
      poolParts.push(disc);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rng.range(-0.2, 0.2), x = px + Math.cos(a) * 2.6, z = pz + Math.sin(a) * 2.6, r = rng.range(0.3, 0.6);
        looseRock(x, heightAt(x, z) + r * 0.25, z, r, C.moss, 0.7);
      }
    }

    // ── the sea cave ──
    const W = (lx: number, lz: number) => coveWorld(cave, lx, lz);
    const at = (lx: number, y: number, lz: number): THREE.Vector3 => { const [x, z] = W(lx, lz); return new THREE.Vector3(x, y, z); };
    // walls: two courses of boulders down each side, their inner faces on the half-width line
    for (let lz = -0.2; lz < cave.depth + 0.4; lz += 1.05) {
      const hw = coveHalfWidth(lz), fl = coveFloorAt(lz), ce = coveCeil(lz);
      for (const side of [-1, 1]) {
        for (const [dy, rr] of [[0.35, rng.range(0.95, 1.25)], [1.7, rng.range(0.9, 1.2)], [ce - 0.2, rng.range(0.9, 1.15)]] as const) {
          const p = at(side * (hw + rr * 0.72), fl + dy, lz + rng.range(-0.2, 0.2));
          boulder(p.x, p.y, p.z, rr, rng.next() < 0.5 ? C.rockIn : C.rockInB, C.rockWet, 0.9, 0.22);
        }
      }
      // the roof: a row of boulders across, a little arch to it
      for (let lx = -hw + 0.5; lx <= hw - 0.3; lx += 1.2) {
        const rr = rng.range(0.9, 1.25), arch = 0.35 * (1 - (lx / hw) ** 2);
        const p = at(lx, fl + ce + rr * 0.55 + arch, lz + rng.range(-0.2, 0.2));
        boulder(p.x, p.y, p.z, rr, C.rockIn, C.rockInB, 0.75, 0.22);
      }
    }
    // the back wall of the alcove + a big rock burying the rising ground in its corner
    for (const lx of [-1.4, 0, 1.4]) { const p = at(lx, ALC_FLOOR + 1.0, cave.depth + 0.9); boulder(p.x, p.y, p.z, 1.3, C.rockIn, C.rockWet, 0.95, 0.2); }
    { const p = at(-1.9, ALC_FLOOR + 0.2, cave.depth - 0.4); boulder(p.x, p.y, p.z, 1.0, C.rockInB, C.rockWet, 0.8); }
    // the passage's shoulders: the wall steps in from the antechamber to the 2.5 m throat
    for (const side of [-1, 1]) for (const lz of [PASS.z0 - 0.15, PASS.z1 + 0.1]) {
      const p = at(side * (PASS.hw + 1.0), ANTE_FLOOR + 1.3, lz); boulder(p.x, p.y, p.z, 1.2, C.rockInB, C.rockWet, 1.0, 0.18);
    }
    // the outer mass: big grass-topped boulders heaped over and around the vault so it reads as the crag's foot
    const mass: [number, number, number, number][] = [
      [-5.2, 1.2, 0.8, 2.6], [5.2, 1.4, 0.8, 2.6], [-5.5, 2.4, 4.0, 2.8], [5.4, 2.4, 4.2, 2.9], [-4.5, 3.0, 7.6, 2.6], [4.6, 3.2, 7.8, 2.5],
      [-2.4, 5.4, 1.8, 2.5], [2.3, 5.5, 2.0, 2.6], [0, 5.9, 4.6, 2.9], [-2.6, 5.6, 7.2, 2.7], [2.4, 5.8, 7.4, 2.6], [0, 6.2, 9.8, 2.8],
      [-3.8, 4.4, -0.6, 1.6], [3.9, 4.2, -0.5, 1.7], [-6.8, 0.6, -1.2, 1.5], [6.9, 0.8, -1.0, 1.6],
    ];
    for (const [lx, dy, lz, r] of mass) { const p = at(lx, ANTE_FLOOR + dy, lz); boulder(p.x, p.y, p.z, r, rng.next() < 0.5 ? C.rock : C.rockB, rng.next() < 0.5 ? C.grass : C.grassB, 0.8, 0.25); }
    // the mouth arch: wet rocks low, a lintel of three over the opening
    for (const [lx, dy, r] of [[-2.9, 0.5, 0.9], [2.9, 0.4, 0.95], [-2.7, 2.0, 0.85], [2.8, 2.1, 0.85], [-1.6, 3.7, 0.9], [0, 4.0, 0.95], [1.6, 3.7, 0.9]] as const) {
      const p = at(lx, ANTE_FLOOR + dy, -0.3); boulder(p.x, p.y, p.z, r, dy < 1 ? C.rockWet : C.rock, C.moss, 0.85, 0.2);
    }
    // the floor: rock slabs over a sand bed, the ramp up to the alcove, a tide pool in the antechamber
    {
      const sandV: number[] = [];
      const quad = (lx0: number, lz0: number, lx1: number, lz1: number) => {
        const a = at(lx0, coveFloorAt(lz0) - 0.03, lz0), b = at(lx1, coveFloorAt(lz0) - 0.03, lz0), c = at(lx1, coveFloorAt(lz1) - 0.03, lz1), d = at(lx0, coveFloorAt(lz1) - 0.03, lz1);
        sandV.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
      };
      for (let lz = -0.8; lz < cave.depth; lz += 0.5) { const hw = coveHalfWidth(lz + 0.25) + 0.3; quad(-hw, lz, hw, lz + 0.5); }
      kit.add(tris(sandV), C.sand, { jitter: 0.06 });
      for (let i = 0; i < 26; i++) {
        const lz = rng.range(-0.3, cave.depth - 0.4), hw = coveHalfWidth(lz) - 0.2, lx = rng.range(-hw, hw), r = rng.range(0.45, 0.85);
        if (Math.hypot(lx + 1.3, lz - 2.2) < 1.2) continue;                                  // the tide pool
        const p = at(lx, coveFloorAt(lz) - 0.07, lz);
        kit.add(new THREE.CylinderGeometry(r, r * 1.05, 0.14, rng.int(5, 7)), rng.next() < 0.5 ? C.slab : C.slabB, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)), wobble: 0.03, jitter: 0.07 });
      }
      for (let k = 0; k < 4; k++) {                                                            // steps up the ramp
        const lz = RAMP.z0 + (k + 0.5) * (RAMP.z1 - RAMP.z0) / 4, p = at(0, coveFloorAt(lz) - 0.08, lz);
        kit.add(new THREE.BoxGeometry(PASS.hw * 1.7, 0.18, 0.32), C.slabB, { matrix: m4(p.x, p.y, p.z, cave.yaw + rng.range(-0.05, 0.05)), wobble: 0.02 });
      }
      const pp = at(-1.3, ANTE_FLOOR + 0.005, 2.2);
      const disc = new THREE.CircleGeometry(0.95, 9); disc.rotateX(-Math.PI / 2); disc.translate(pp.x, pp.y, pp.z);
      poolParts.push(disc);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, q = at(-1.3 + Math.cos(a) * 1.05, ANTE_FLOOR, 2.2 + Math.sin(a) * 1.05); boulder(q.x, q.y + 0.05, q.z, rng.range(0.18, 0.3), C.rockWet, C.moss, 0.6); }
      starfish(pp.x + 0.3, ANTE_FLOOR - 0.02, pp.z - 0.2, 0.16, C.starPurple);
    }
    // stalactites from the roof, a few stalagmites
    for (let i = 0; i < 16; i++) {
      const lz = rng.range(0.4, cave.depth - 0.3), hw = coveHalfWidth(lz) - 0.35, lx = rng.range(-hw, hw), len = rng.range(0.35, 1.1), r = rng.range(0.07, 0.18);
      const p = at(lx, coveFloorAt(lz) + coveCeil(lz) + 0.2, lz);
      kit.add(new THREE.ConeGeometry(r, len, 5).rotateX(Math.PI).translate(0, -len / 2, 0), C.stala, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)), jitter: 0.08 });
    }
    for (const [lx, lz, h] of [[2.2, 4.4, 0.7], [-2.3, 0.9, 0.5], [1.6, 8.3, 0.6]] as const) {
      const p = at(lx, coveFloorAt(lz), lz); kit.add(new THREE.ConeGeometry(0.18, h, 5).translate(0, h / 2, 0), C.stala, { matrix: m4(p.x, p.y, p.z, rng.range(0, 6)) });
    }
    // vines hanging over the mouth and down the outer face
    for (let i = 0; i < 24; i++) {
      const lx = rng.range(-3.6, 3.6), lz = rng.range(-0.9, -0.4), top = ANTE_FLOOR + 3.9 + rng.range(0, 0.9) - Math.abs(lx) * 0.25, len = rng.range(0.8, 2.6), w = rng.range(0.07, 0.13);
      const a = at(lx, top, lz), b = at(lx + rng.range(-0.15, 0.15), top - len, lz - rng.range(0.0, 0.2));
      const [ox, oz] = [Math.cos(cave.yaw) * w, -Math.sin(cave.yaw) * w];
      kit.add(tris([a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz, b.x, b.y, b.z]), rng.next() < 0.5 ? C.vine : C.vineB, { jitter: 0.1 });
      if (rng.next() < 0.6) for (let k = 1; k < 4; k++) {                                   // leaves along the strand
        const q = a.clone().lerp(b, k / 4), s = 0.12;
        kit.add(tris([q.x, q.y, q.z, q.x + ox * 2.2, q.y - s, q.z + oz * 2.2 - s * 0.5, q.x - ox * 0.4, q.y - s * 1.6, q.z - oz * 0.4]), C.vineB, { jitter: 0.1 });
      }
    }
    // the torch by the mouth: a lashed pole, a pitch head, the flame (glow) and its light baked on the rocks
    {
      const p = at(3.1, heightAt(...W(3.1, -1.1)), -1.1);
      kit.add(log(p, p.clone().add(new THREE.Vector3(0.05, 1.9, 0)), 0.06, 0.05, 5), C.torch);
      kit.add(new THREE.CylinderGeometry(0.1, 0.07, 0.25, 6).translate(p.x + 0.05, p.y + 1.95, p.z), '#2c241e');
      glow.add(new THREE.OctahedronGeometry(0.13, 0).scale(1, 1.9, 1).translate(p.x + 0.05, p.y + 2.25, p.z), C.flame, { jitter: 0 });
      glow.add(new THREE.OctahedronGeometry(0.17, 0).scale(1, 1.3, 1).translate(p.x + 0.05, p.y + 2.15, p.z), '#ff8a2a', { jitter: 0 });
      lights.push({ x: p.x, y: p.y + 2.2, z: p.z, color: '#ffae55', range: 5.5, intensity: 1.2 });
    }
    // a wall torch in the antechamber (its warm light is what you see from the beach), on an iron bracket
    {
      const p = at(ANTE.hw - 0.25, ANTE_FLOOR + 1.7, 3.0);
      kit.add(new THREE.BoxGeometry(0.06, 0.06, 0.4).translate(0, 0, 0), '#3a3c42', { matrix: m4(p.x, p.y - 0.1, p.z, cave.yaw + Math.PI / 2) });
      kit.add(log(p.clone().add(new THREE.Vector3(0, -0.35, 0)), p.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.05, 0.045, 5), C.torch);
      glow.add(new THREE.OctahedronGeometry(0.11, 0).scale(1, 1.9, 1).translate(p.x, p.y + 0.45, p.z), C.flame, { jitter: 0 });
      glow.add(new THREE.OctahedronGeometry(0.15, 0).scale(1, 1.3, 1).translate(p.x, p.y + 0.36, p.z), '#ff8a2a', { jitter: 0 });
      lights.push({ x: p.x - 0.4, y: p.y + 0.4, z: p.z, color: '#ffa850', range: 7.5, intensity: 1.4 });
    }
    // glowing crystal clusters in the alcove (and one at the passage, so the way in reads from the mouth)
    const crystals: [number, number, number][] = [[-1.5, 8.2, 1], [1.5, 8.0, 1], [0.3, 8.6, 1.2], [-1.1, 6.9, 0.7], [1.9, 5.0, 0.6], [-2.4, 3.6, 0.5]];
    for (const [lx, lz, s] of crystals) {
      const p = at(lx, coveFloorAt(lz), lz);
      for (let k = 0; k < 5; k++) {
        const h = rng.range(0.25, 0.7) * s, r = rng.range(0.05, 0.1) * s;
        const g = new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0);
        glow.add(g, k % 2 ? C.crystal : C.crystalB, { matrix: m4(p.x + rng.range(-0.2, 0.2) * s, p.y - 0.02, p.z + rng.range(-0.2, 0.2) * s, rng.range(0, 6), rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)), jitter: 0.1 });
      }
      lights.push({ x: p.x, y: p.y + 0.4, z: p.z, color: '#6fe6ff', range: 3.6 + s * 1.2, intensity: 1.2 * s });
    }

    const structure = kit.finish({ ao: { ground: heightAt, cell: 0.25, strength: 0.6 } });
    bakeLight(structure, lights);
    if (smoothRocks.length === 0 || poolParts.length === 0) throw new Error('Cove geometry requires its native rocks and pools');
    const rocks = mergeGeometries(smoothRocks, false);
    for (const part of smoothRocks) part.dispose();
    const glowGeometry = glow.finish({ ao: false });
    const gc = glowGeometry.getAttribute('color');
    for (let i = 0; i < gc.count; i++) gc.setXYZ(i, gc.getX(i) * 2.6, gc.getY(i) * 2.6, gc.getZ(i) * 2.6);
    const pools = mergeGeometries(poolParts, false);
    for (const part of poolParts) part.dispose();
    pools.computeBoundingSphere();
    return { geometry: { structure, rocks, glow: glowGeometry, pools }, placements };
}

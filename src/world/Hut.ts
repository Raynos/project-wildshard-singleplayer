/**
 * Hut — the castaway's thatched hut on the plateau (Driftwood Isle, remaster M2). A plank cabin on log stilts with a
 * wrap-around porch and railing, board-and-batten walls, shuttered windows, a deep hip roof of layered golden thatch with
 * a ragged fringe, and steps down the front. You can walk in: a hammock, a table with a chart and a candle, stools,
 * shelves of jars, a barrel, crates, a net and oars on the walls, a rug, a hanging lantern (its light baked into the
 * vertex colours; the flames are one unlit draw). Porch: crates, a barrel, a rope coil, a fishing rod, a door lantern.
 *
 *   const hut = new Hut(sky, { x, z, rot }).build();        // rot: which way the door faces (0 = −z)
 *   scene.add(hut.group); player.colliders.push(...hut.colliders);
 *   player.platforms.push((x, z) => hut.floorHeightAt(x, z)); // porch + floor + steps are walkable
 *
 * Frame: hut-local x right, z toward the back, the door at −z; world = origin + R_y(rot) · local. `anchors` (world
 * coords, y = floor, yaw = world facing, 0 = +Z): npc (the castaway's spot by his campfire in front of the steps, facing
 * the path), hutChest (against the back wall inside, facing the door), door (the doorway), porch (the porch in front of
 * the door).
 */
import * as THREE from 'three';
import { heightAt } from './Heightfield';
import { SEED } from '../core/config';
import { LowPolyKit, log, plank, rope, tris, bakeLight, lowPolyMaterial, type BakedLight } from './lowpolyKit';
import type { Collider } from '../player/Player';
import { boxDesc, type ColliderDesc } from './registry';
import type { Sky } from './Sky';

export interface HutSpec { x: number; z: number; rot: number }
export interface HutAnchor { x: number; y: number; z: number; yaw: number }

const C = {
  board: '#a07b50', boardB: '#8f6d46', boardDark: '#6e5234', batten: '#5e452e', post: '#5a4230', log: '#6b4e33',
  thatch: '#c9a355', thatchB: '#b89346', thatchDark: '#9c7a38', thatchLight: '#dcbb6c',
  deck: '#b08f62', deckB: '#9d7d54', dark: '#2e241c', shutter: '#6d8a8f', shutterB: '#5b777c',
  cloth: '#d8ccb0', clothB: '#c9b995', rug: '#a8453a', rugB: '#d0a24a', jar: '#8fb7a8', jarB: '#c98f52', rope: '#b99d6c',
  barrel: '#8a5a34', band: '#3b3b3f', crate: '#a47b4b', crateB: '#8b6538', brass: '#b08a3a', paper: '#e8dcc0', flame: '#ffc46a', iron: '#3a3c42',
};

const W = 6.4, D = 5.4;              // cabin footprint
const PORCH = 2.2;                    // porch depth around the front and sides
const WALL_H = 2.6, DOOR_W = 1.1;
const LIFT = 1.1;                     // floor over the ground at the centre
const TABLE = { x: -1.5, z: 0.9, w: 1.4, d: 0.85, h: 0.82, yaw: 0.05 }; // the chart table inside (hut-local, top over the floor)

export class Hut {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  anchors: Record<string, HutAnchor> = {};
  floorY = 0;
  private cos = 1; private sin = 0;
  private deck = { w: 0, d: 0, z: 0 };
  private steps = { z0: 0, len: 0, w: 0, n: 0, top: 0 };

  constructor(private sky: Sky, private spec: HutSpec) { this.cos = Math.cos(spec.rot); this.sin = Math.sin(spec.rot); }

  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }
  private M(lx: number, y: number, lz: number, yaw = 0, rx = 0, rz = 0): THREE.Matrix4 {
    const [x, z] = this.toWorld(lx, lz);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, this.spec.rot + yaw, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  }
  private V(lx: number, y: number, lz: number): THREE.Vector3 { const [x, z] = this.toWorld(lx, lz); return new THREE.Vector3(x, y, z); }

  build(): this {
    const kit = new LowPolyKit(SEED ^ 0x4077), rng = kit.rng;
    const glow = new LowPolyKit(SEED ^ 0x4078);
    const lamps: BakedLight[] = [];
    const ground = heightAt(this.spec.x, this.spec.z);
    const fy = ground + LIFT; this.floorY = fy;
    const box = (w: number, h: number, d: number, lx: number, y: number, lz: number, col: string, yaw = 0, jitter = 0.06, rx = 0, rz = 0) =>
      kit.add(new THREE.BoxGeometry(w, h, d), col, { matrix: this.M(lx, y, lz, yaw, rx, rz), jitter });
    const collider = (lx: number, lz: number, hw: number, hd: number, yBottom: number, yTop: number) => {
      const [wx, wz] = this.toWorld(lx, lz);
      this.colliders.push({ x: wx, z: wz, hw, hd, rot: -this.spec.rot, yBottom, yTop });
    };

    // ── the deck: cabin floor + porch on the front and both sides, plank by plank, on log joists and stilts ──
    const deckW = W + PORCH * 2, deckD = D + PORCH, deckZ = -PORCH / 2;
    this.deck = { w: deckW, d: deckD, z: deckZ };
    for (let px = -deckW / 2 + 0.2; px < deckW / 2; px += 0.4) {
      kit.add(plank(deckD - 0.04, 0.36, 0.08, rng, 0.012).rotateY(Math.PI / 2), rng.next() < 0.3 ? C.deckB : C.deck, { matrix: this.M(px, fy - 0.04 + rng.range(-0.008, 0.008), deckZ), jitter: 0.06 });
    }
    for (const lz of [deckZ - deckD / 2 + 0.3, deckZ, deckZ + deckD / 2 - 0.3]) kit.add(log(this.V(-deckW / 2, fy - 0.2, lz), this.V(deckW / 2, fy - 0.2, lz), 0.14, 0.14, 6), C.log);
    for (const sx of [-deckW / 2 + 0.3, -deckW / 6, deckW / 6, deckW / 2 - 0.3]) for (const sz of [deckZ - deckD / 2 + 0.3, deckZ, deckZ + deckD / 2 - 0.3]) {
      const top = this.V(sx, fy - 0.15, sz), gy = heightAt(top.x, top.z) - 0.4;
      kit.add(log(new THREE.Vector3(top.x, gy, top.z), top, 0.16, 0.14, 6, rng.range(0, 1)), C.log, { jitter: 0.05 });
      if (sz === deckZ && Math.abs(sx) > 1) {                                           // a diagonal brace
        const s = sx > 0 ? -1 : 1, foot = this.V(sx + s * 1.2, 0, sz); foot.y = heightAt(foot.x, foot.z);
        kit.add(log(foot, this.V(sx, fy - 0.3, sz), 0.07, 0.07, 5), C.post);
      }
    }
    // ── walls: vertical boards with battens; the door gap in the front, two windows with shutters ──
    const board = (lx: number, lz: number, alongX: boolean, h: number, y0: number): void => {
      const w = rng.range(0.26, 0.32);
      // plank(): length on x, thickness on y, width on z → stood up (length on y, width on z), turned to the wall
      kit.add(plank(h, w, 0.07, rng, 0.01).rotateZ(Math.PI / 2), rng.next() < 0.25 ? C.boardB : rng.next() < 0.1 ? C.boardDark : C.board, { matrix: this.M(lx, y0 + h / 2, lz, alongX ? Math.PI / 2 : 0), jitter: 0.05 });
    };
    const win = { w: 0.95, y0: fy + 1.0, y1: fy + 1.9 };
    for (let x = -W / 2 + 0.15; x < W / 2; x += 0.3) {
      const inDoor = Math.abs(x) < DOOR_W / 2, inWin = Math.abs(Math.abs(x) - 2.0) < win.w / 2;
      if (inDoor) board(x, -D / 2, true, WALL_H - 2.1, fy + 2.1);
      else if (inWin) { board(x, -D / 2, true, win.y0 - fy, fy); board(x, -D / 2, true, fy + WALL_H - win.y1, win.y1); }
      else board(x, -D / 2, true, WALL_H, fy);
      board(x, D / 2, true, WALL_H, fy);
    }
    for (let z = -D / 2 + 0.15; z < D / 2; z += 0.3) {
      const inWin = Math.abs(z - 0.4) < win.w / 2;
      for (const side of [-1, 1]) {
        if (inWin && side > 0) { board(side * W / 2, z, false, win.y0 - fy, fy); board(side * W / 2, z, false, fy + WALL_H - win.y1, win.y1); }
        else board(side * W / 2, z, false, WALL_H, fy);
      }
    }
    // battens, sill plates, the door frame, window frames + shutters, corner posts
    for (const y of [fy + 0.06, fy + WALL_H - 0.08]) {
      box(W + 0.2, 0.12, 0.12, 0, y, -D / 2 - 0.06, C.batten); box(W + 0.2, 0.12, 0.12, 0, y, D / 2 + 0.06, C.batten);
      box(0.12, 0.12, D + 0.2, -W / 2 - 0.06, y, 0, C.batten); box(0.12, 0.12, D + 0.2, W / 2 + 0.06, y, 0, C.batten);
    }
    for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as const) kit.add(log(this.V(px, fy - 0.1, pz), this.V(px, fy + WALL_H + 0.25, pz), 0.14, 0.13, 6), C.log);
    for (const s of [-1, 1]) box(0.12, 2.15, 0.16, s * (DOOR_W / 2 + 0.06), fy + 1.07, -D / 2 - 0.02, C.batten);
    box(DOOR_W + 0.36, 0.14, 0.18, 0, fy + 2.14, -D / 2 - 0.02, C.batten);
    // the door itself, swung open against the inside wall
    box(0.07, 2.0, DOOR_W - 0.08, -DOOR_W / 2 - 0.1, fy + 1.0, -D / 2 + DOOR_W / 2 + 0.02, C.boardB, 0, 0.04);
    for (const [wx, wz, alongX] of [[-2.0, -D / 2, true], [2.0, -D / 2, true], [W / 2, 0.4, false]] as const) {
      const out = alongX ? -1 : 1;
      const frame = (w: number, h: number, dx: number, dy: number) => alongX ? box(w, h, 0.12, wx + dx, dy, wz + out * 0.02, C.batten) : box(0.12, h, w, wx + out * 0.02, dy, wz + dx, C.batten);
      frame(win.w + 0.2, 0.1, 0, win.y0 - 0.02); frame(win.w + 0.2, 0.1, 0, win.y1 + 0.02); frame(0.1, win.y1 - win.y0, -win.w / 2 - 0.05, (win.y0 + win.y1) / 2); frame(0.1, win.y1 - win.y0, win.w / 2 + 0.05, (win.y0 + win.y1) / 2);
      for (const s of [-1, 1]) {                                                         // shutters, propped open
        const cy = (win.y0 + win.y1) / 2, sw = win.w / 2 + 0.02;
        if (alongX) box(sw, win.y1 - win.y0 + 0.06, 0.05, wx + s * (win.w / 2 + sw / 2 + 0.1), cy, wz - 0.12, rng.next() < 0.5 ? C.shutter : C.shutterB, 0, 0.05);
        else box(0.05, win.y1 - win.y0 + 0.06, sw, wx + 0.12, cy, wz + s * (win.w / 2 + sw / 2 + 0.1), rng.next() < 0.5 ? C.shutter : C.shutterB, 0, 0.05);
      }
    }
    // wall colliders (the door gap stays open)
    const wallC = (lx: number, lz: number, hw: number, hd: number) => collider(lx, lz, hw, hd, fy, fy + WALL_H);
    wallC(-(W / 2 + DOOR_W / 2) / 2, -D / 2, (W / 2 - DOOR_W / 2) / 2, 0.1); wallC((W / 2 + DOOR_W / 2) / 2, -D / 2, (W / 2 - DOOR_W / 2) / 2, 0.1);
    wallC(0, D / 2, W / 2, 0.1); wallC(-W / 2, 0, 0.1, D / 2); wallC(W / 2, 0, 0.1, D / 2);

    // ── the roof: a wide eave skirt over the porch, two thatch layers, the cap, a ridge bundle, a ragged fringe ──
    const eaveY = fy + WALL_H + 0.1;
    const hip = (w: number, d: number, h: number, y: number, zc: number, col: string): void => {
      const ridge = Math.max(0, w - d) / 2;
      const A = [-w / 2, y, -d / 2 + zc], B = [w / 2, y, -d / 2 + zc], Cc = [w / 2, y, d / 2 + zc], Dd = [-w / 2, y, d / 2 + zc], R1 = [-ridge, y + h, zc], R2 = [ridge, y + h, zc];
      const v = [...A, ...B, ...R2, ...A, ...R2, ...R1, ...Cc, ...Dd, ...R1, ...Cc, ...R1, ...R2, ...B, ...Cc, ...R2, ...Dd, ...A, ...R1];
      const g = tris(v);
      // subdivide each face into thatch courses: jitter the colour per band by splitting along height
      kit.add(g, col, { matrix: this.M(0, 0, 0), jitter: 0.1 });
    };
    hip(deckW + 1.2, deckD + 1.4, 1.5, eaveY - 0.12, deckZ, C.thatchDark);
    hip(deckW + 1.2, deckD + 1.4, 1.5, eaveY, deckZ, C.thatch);
    hip(deckW + 0.2, deckD + 0.4, 1.35, eaveY + 0.55, deckZ + 0.1, C.thatchB);
    hip(W + 1.2, D + 1.2, 2.3, eaveY + 1.3, 0, C.thatchLight);
    kit.add(log(this.V(-(W + 1.2 - (D + 1.2)) / 2 - 0.5, eaveY + 3.62, 0), this.V((W + 1.2 - (D + 1.2)) / 2 + 0.5, eaveY + 3.62, 0), 0.22, 0.22, 6), C.thatchDark);
    for (const s of [-1, 1]) kit.add(rope([this.V(s * 0.9, eaveY + 3.5, -0.25), this.V(s * 0.9, eaveY + 3.8, 0), this.V(s * 0.9, eaveY + 3.5, 0.25)], 0.03), C.rope);
    // the fringe: ragged straw tips hanging off the eave all the way round
    {
      const ew = (deckW + 1.2) / 2, ed = (deckD + 1.4) / 2;
      const edge = (x0: number, z0: number, x1: number, z1: number) => {
        const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.16);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n, len = rng.range(0.18, 0.42);
          const a = this.V(x0 + (x1 - x0) * t0, eaveY - 0.1, z0 + (z1 - z0) * t0), b = this.V(x0 + (x1 - x0) * t1, eaveY - 0.1, z0 + (z1 - z0) * t1);
          const m = a.clone().lerp(b, 0.5).setY(eaveY - 0.1 - len);
          kit.add(tris([a.x, a.y, a.z, b.x, b.y, b.z, m.x, m.y, m.z]), rng.next() < 0.5 ? C.thatchDark : C.thatchB, { jitter: 0.1 });
        }
      };
      edge(-ew, -ed + deckZ, ew, -ed + deckZ); edge(ew, -ed + deckZ, ew, ed + deckZ); edge(ew, ed + deckZ, -ew, ed + deckZ); edge(-ew, ed + deckZ, -ew, -ed + deckZ);
    }
    // porch posts holding the eave
    for (const [px, pz] of [[-deckW / 2 + 0.35, -deckD / 2 + deckZ + 0.35], [deckW / 2 - 0.35, -deckD / 2 + deckZ + 0.35], [-deckW / 2 + 0.35, D / 2 - 0.4], [deckW / 2 - 0.35, D / 2 - 0.4], [-DOOR_W / 2 - 0.7, -deckD / 2 + deckZ + 0.35], [DOOR_W / 2 + 0.7, -deckD / 2 + deckZ + 0.35]] as const) {
      kit.add(log(this.V(px, fy, pz), this.V(px, eaveY + 0.1, pz), 0.11, 0.1, 6, rng.range(0, 1)), C.log);
      collider(px, pz, 0.12, 0.12, fy, fy + WALL_H);
    }
    // ── porch railing (a gap for the steps) ──
    const railY = fy + 0.95;
    const rail = (lx: number, lz: number, len: number, alongX: boolean) => {
      const a = alongX ? this.V(lx - len / 2, railY, lz) : this.V(lx, railY, lz - len / 2), b = alongX ? this.V(lx + len / 2, railY, lz) : this.V(lx, railY, lz + len / 2);
      kit.add(log(a, b, 0.05, 0.05, 5), C.post);
      kit.add(log(a.clone().setY(railY - 0.45), b.clone().setY(railY - 0.45), 0.04, 0.04, 5), C.post);
      const n = Math.max(2, Math.round(len / 0.9));
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); kit.add(log(p.clone().setY(fy), p.clone().setY(railY + 0.06), 0.055, 0.05, 5), C.log); }
      // an X between the rails every other bay
      for (let i = 0; i < n; i += 2) { const p = a.clone().lerp(b, i / n), q = a.clone().lerp(b, (i + 1) / n); kit.add(log(p.clone().setY(fy + 0.05), q.clone().setY(railY - 0.45), 0.03, 0.03, 4), C.batten); }
      collider(lx, lz, alongX ? len / 2 : 0.08, alongX ? 0.08 : len / 2, fy, railY + 0.1);
    };
    const frontZ = -deckD / 2 + deckZ + 0.12, stepsW = 1.6;
    rail(-(deckW / 4 + stepsW / 4), frontZ, deckW / 2 - stepsW / 2, true);
    rail((deckW / 4 + stepsW / 4), frontZ, deckW / 2 - stepsW / 2, true);
    rail(-deckW / 2 + 0.12, deckZ, deckD - 0.3, false);
    rail(deckW / 2 - 0.12, deckZ, deckD - 0.3, false);
    // ── steps down the front: log stringers, plank treads ──
    const stepsZ0 = -deckD / 2 + deckZ, nSteps = 4;
    for (let i = 0; i < nSteps; i++) {
      const y = fy - (i + 1) * (LIFT / nSteps) + 0.05, z = stepsZ0 - (i + 0.5) * 0.4;
      kit.add(plank(stepsW, 0.4, 0.09, rng, 0.012), i % 2 ? C.deckB : C.deck, { matrix: this.M(0, y, z) });
    }
    for (const s of [-1, 1]) { const top = this.V(s * (stepsW / 2 - 0.05), fy - 0.1, stepsZ0), foot = this.V(s * (stepsW / 2 - 0.05), 0, stepsZ0 - nSteps * 0.4 - 0.1); foot.y = heightAt(foot.x, foot.z) - 0.05; kit.add(log(top, foot, 0.08, 0.08, 5), C.log); }
    this.steps = { z0: stepsZ0, len: nSteps * 0.4, w: stepsW, n: nSteps, top: fy - LIFT / nSteps + 0.05 + 0.045 };

    // ── inside: rug, hammock, table + chart + candle, stools, shelves, barrel, crates, net + oars, hanging lantern ──
    {
      box(2.2, 0.02, 1.5, 0.2, fy + 0.012, -0.3, C.rug, 0.1, 0.04);
      box(1.7, 0.024, 1.0, 0.2, fy + 0.02, -0.3, C.rugB, 0.1, 0.03);
      // the hammock slung corner to corner along the right wall
      const h0 = this.V(W / 2 - 0.25, fy + 1.55, -D / 2 + 0.6), h1 = this.V(W / 2 - 0.25, fy + 1.55, D / 2 - 0.6);
      const sag = (t: number) => h0.clone().lerp(h1, t).setY(fy + 1.55 - Math.sin(t * Math.PI) * 0.75);
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8, a = sag(t0), b = sag(t1), wA = Math.sin(t0 * Math.PI) * 0.42 + 0.05, wB = Math.sin(t1 * Math.PI) * 0.42 + 0.05;
        const [ox, oz] = [this.cos, -this.sin];
        kit.add(tris([a.x - ox * wA, a.y + 0.05, a.z - oz * wA, a.x + ox * wA, a.y + 0.05, a.z + oz * wA, b.x + ox * wB, b.y + 0.05, b.z + oz * wB,
          a.x - ox * wA, a.y + 0.05, a.z - oz * wA, b.x + ox * wB, b.y + 0.05, b.z + oz * wB, b.x - ox * wB, b.y + 0.05, b.z - oz * wB]), k % 2 ? C.cloth : C.clothB, { jitter: 0.04 });
      }
      kit.add(rope([h0, h0.clone().add(new THREE.Vector3(0, 0.6, 0))], 0.02), C.rope); kit.add(rope([h1, h1.clone().add(new THREE.Vector3(0, 0.6, 0))], 0.02), C.rope);
      // table, chart, candle, stools
      const tx = TABLE.x, tz = TABLE.z;
      box(TABLE.w, 0.07, TABLE.d, tx, fy + 0.78, tz, C.boardB, TABLE.yaw);
      for (const [dx, dz] of [[-0.6, -0.34], [0.6, -0.34], [-0.6, 0.34], [0.6, 0.34]] as const) box(0.08, 0.76, 0.08, tx + dx, fy + 0.38, tz + dz, C.post);
      box(0.6, 0.01, 0.44, tx - 0.15, fy + 0.82, tz, C.paper, 0.2, 0.04);
      kit.add(new THREE.CylinderGeometry(0.035, 0.035, 0.46, 5).rotateZ(Math.PI / 2), C.paper, { matrix: this.M(tx + 0.35, fy + 0.85, tz + 0.2, 0.3) });
      kit.add(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 6), C.paper, { matrix: this.M(tx + 0.45, fy + 0.87, tz - 0.2) });
      glow.add(new THREE.OctahedronGeometry(0.025, 0).scale(1, 1.8, 1), C.flame, { matrix: this.M(tx + 0.45, fy + 0.96, tz - 0.2), jitter: 0 });
      const cp = this.V(tx + 0.45, fy + 1.0, tz - 0.2); lamps.push({ x: cp.x, y: cp.y, z: cp.z, color: '#ffb35c', range: 2.4, intensity: 0.9 });
      for (const [sx, sz] of [[tx - 0.3, tz - 0.8], [tx + 0.7, tz - 0.75]] as const) { kit.add(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 7), C.boardB, { matrix: this.M(sx, fy + 0.46, sz) }); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; kit.add(log(this.V(sx + Math.cos(a) * 0.13, fy, sz + Math.sin(a) * 0.13), this.V(sx + Math.cos(a) * 0.1, fy + 0.44, sz + Math.sin(a) * 0.1), 0.025, 0.025, 4), C.post); } }
      // shelves on the back wall with jars and bottles
      for (const y of [fy + 1.25, fy + 1.75]) {
        box(1.6, 0.05, 0.3, -1.6, y, D / 2 - 0.22, C.boardDark);
        for (let k = 0; k < 5; k++) { const h = rng.range(0.14, 0.26); kit.add(new THREE.CylinderGeometry(rng.range(0.05, 0.08), rng.range(0.06, 0.09), h, 6), rng.next() < 0.5 ? C.jar : C.jarB, { matrix: this.M(-2.2 + k * 0.3 + rng.range(-0.05, 0.05), y + 0.025 + h / 2, D / 2 - 0.22) }); }
      }
      // barrel + crates in the back-right corner, a net and crossed oars on the left wall
      {
        const g = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 9), p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) { const k = 1 + 0.12 * (1 - (p.getY(i) / 0.4) ** 2); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
        kit.add(g, C.barrel, { matrix: this.M(W / 2 - 0.5, fy + 0.4, D / 2 - 0.55) });
        for (const y of [0.13, 0.67]) kit.add(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 9), C.band, { matrix: this.M(W / 2 - 0.5, fy + y, D / 2 - 0.55) });
        box(0.6, 0.6, 0.6, W / 2 - 1.25, fy + 0.3, D / 2 - 0.45, C.crate, 0.15); box(0.45, 0.45, 0.45, W / 2 - 1.25, fy + 0.83, D / 2 - 0.45, C.crateB, -0.2);
        collider(W / 2 - 0.9, D / 2 - 0.5, 0.75, 0.4, fy, fy + 1.1);
      }
      for (let r = 0; r < 5; r++) kit.add(rope([this.V(-W / 2 + 0.1, fy + 2.2 - r * 0.28, -1.8), this.V(-W / 2 + 0.12, fy + 2.1 - r * 0.28 - 0.12, -0.9), this.V(-W / 2 + 0.1, fy + 2.2 - r * 0.28, 0)], 0.012, 3), C.rope);
      for (let c = 0; c < 6; c++) { const z = -1.8 + c * 0.36; kit.add(rope([this.V(-W / 2 + 0.1, fy + 2.25, z), this.V(-W / 2 + 0.12, fy + 1.0, z + 0.05)], 0.012, 3), C.rope); }
      for (const s of [-1, 1]) {
        const a = this.V(-W / 2 + 0.12, fy + 0.3, 1.4 + s * 0.5), b = this.V(-W / 2 + 0.12, fy + 2.2, 1.4 - s * 0.5);
        kit.add(log(a, b, 0.03, 0.03, 5), C.boardB);
        kit.add(new THREE.BoxGeometry(0.03, 0.5, 0.14), C.boardB, { matrix: new THREE.Matrix4().compose(a.clone().lerp(b, 0.12), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)) });
      }
      // the lantern hanging from the ridge beam
      const lp = this.V(0.2, fy + 2.05, 0.1);
      kit.add(rope([lp.clone().add(new THREE.Vector3(0, 0.3, 0)), lp.clone().add(new THREE.Vector3(0, 1.4, 0))], 0.012), C.iron);
      kit.add(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 6), C.brass, { matrix: this.M(0.2, fy + 1.9, 0.1) });
      kit.add(new THREE.CylinderGeometry(0.05, 0.11, 0.1, 6), C.brass, { matrix: this.M(0.2, fy + 2.2, 0.1) });
      glow.add(new THREE.OctahedronGeometry(0.07, 0).scale(1, 1.6, 1), C.flame, { matrix: this.M(0.2, fy + 2.04, 0.1), jitter: 0 });
      lamps.push({ x: lp.x, y: lp.y, z: lp.z, color: '#ffb561', range: 5.0, intensity: 1.1 });
    }
    // ── the porch: crates, a barrel, a rope coil, a fishing rod, a lantern by the door ──
    {
      const pz = -D / 2 - 0.9;
      box(0.62, 0.62, 0.62, -2.6, fy + 0.31, pz, C.crate, 0.2); box(0.5, 0.5, 0.5, -2.55, fy + 0.87, pz + 0.05, C.crateB, -0.25); box(0.55, 0.5, 0.55, -3.3, fy + 0.25, pz + 0.15, C.crateB, 0.5);
      collider(-2.9, pz, 0.75, 0.45, fy, fy + 1.1);
      const g = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 9);
      kit.add(g, C.barrel, { matrix: this.M(3.0, fy + 0.4, pz) });
      for (const y of [0.13, 0.67]) kit.add(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 9), C.band, { matrix: this.M(3.0, fy + y, pz) });
      collider(3.0, pz, 0.35, 0.35, fy, fy + 0.85);
      for (let k = 0; k < 3; k++) kit.add(new THREE.TorusGeometry(0.28 - k * 0.06, 0.035, 4, 10).rotateX(Math.PI / 2), C.rope, { matrix: this.M(2.2, fy + 0.04 + k * 0.05, pz - 0.2) });
      kit.add(log(this.V(3.5, fy, pz + 0.3), this.V(3.3, fy + 2.6, pz + 0.35), 0.022, 0.012, 4), C.boardB);
      kit.add(rope([this.V(3.3, fy + 2.6, pz + 0.35), this.V(3.45, fy + 1.4, pz + 0.2), this.V(3.4, fy + 0.3, pz)], 0.006, 3), C.paper);
      const lp = this.V(DOOR_W / 2 + 0.35, fy + 1.95, -D / 2 - 0.2);
      kit.add(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 6), C.brass, { matrix: this.M(DOOR_W / 2 + 0.35, fy + 1.82, -D / 2 - 0.2) });
      kit.add(new THREE.CylinderGeometry(0.04, 0.09, 0.08, 6), C.brass, { matrix: this.M(DOOR_W / 2 + 0.35, fy + 2.08, -D / 2 - 0.2) });
      box(0.05, 0.05, 0.3, DOOR_W / 2 + 0.35, fy + 2.14, -D / 2 - 0.08, C.iron);
      glow.add(new THREE.OctahedronGeometry(0.06, 0).scale(1, 1.6, 1), C.flame, { matrix: this.M(DOOR_W / 2 + 0.35, fy + 1.94, -D / 2 - 0.2), jitter: 0 });
      lamps.push({ x: lp.x, y: lp.y, z: lp.z, color: '#ffb561', range: 3.2, intensity: 0.8 });
    }

    // ── meshes ──
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.2, strength: 0.62 } });
    bakeLight(geo, lamps);
    this.mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    const gGeo = glow.finish({ ao: false });
    const gc = gGeo.getAttribute('color');
    for (let i = 0; i < gc.count; i++) gc.setXYZ(i, gc.getX(i) * 3, gc.getY(i) * 3, gc.getZ(i) * 3);
    const flames = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    flames.name = 'hut-flames';
    this.group.add(flames);

    // ── anchors ──
    const A = (lx: number, lz: number, y: number, yaw: number): HutAnchor => { const [x, z] = this.toWorld(lx, lz); return { x, y, z, yaw: this.spec.rot + yaw }; };
    const [nx, nz] = this.toWorld(2.4, -8.2);
    this.anchors['npc'] = A(2.4, -8.2, heightAt(nx, nz), Math.PI + 0.35);
    this.anchors['hutChest'] = A(0.9, D / 2 - 0.55, fy, Math.PI);
    this.anchors['door'] = A(0, -D / 2, fy, Math.PI);
    this.anchors['porch'] = A(0, -D / 2 - 1.1, fy, Math.PI);
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/physics/pieces.ts turns it into Rapier colliders.
   * The deck (cabin floor + porch) is one slab whose top is the floor; the front steps are the four treads the mesh
   * draws (0.275 m each, the top one 0.18 m under the deck); the chart table is solid (it had no box before).
   */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    const yaw = this.spec.rot, fy = this.floorY, slab = 0.15;
    const at = (lx: number, y: number, lz: number) => { const [x, z] = this.toWorld(lx, lz); return { x, y, z }; };
    out.push({ kind: 'box', ...at(0, fy - slab, this.deck.z), hx: this.deck.w / 2, hy: slab, hz: this.deck.d / 2, yaw });
    const { z0, len, w, n, top } = this.steps, rise = LIFT / n;
    out.push({ kind: 'treads', from: at(0, top - n * rise, z0 - len), to: at(0, top, z0), width: w, count: n });
    out.push({ kind: 'box', ...at(TABLE.x, fy + TABLE.h / 2, TABLE.z), hx: TABLE.w / 2, hy: TABLE.h / 2, hz: TABLE.d / 2, yaw: yaw + TABLE.yaw });
    return out;
  }

  /** deck / floor height under (x, z), the steps ramp down in front, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * this.sin + dz * this.cos, lx = dx * this.cos - dz * this.sin;
    if (Math.abs(lx) <= this.deck.w / 2 && Math.abs(lz - this.deck.z) <= this.deck.d / 2) return this.floorY;
    if (Math.abs(lx) <= this.steps.w / 2 && lz < this.steps.z0 && lz > this.steps.z0 - this.steps.len) {
      const t = (this.steps.z0 - lz) / this.steps.len; // 0 at the deck → 1 at the ground
      return this.floorY - t * LIFT;
    }
    return undefined;
  }
}

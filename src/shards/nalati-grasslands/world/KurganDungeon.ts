import { app } from '@wildshard/engine/app/runtime';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import { HeightPatch } from '../runtime/heightPatch';
import { bakedActorGeometry } from './placeBake';

import type { BossViewBinding } from '@wildshard/sdk/phasedBoss';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import * as THREE from 'three';
import layout from '../data/kurganLayout.generated.json' with { type: 'json' };

const { DUNGEON, CH, DROMOS_END, COFFIN, PEDESTAL, NICHES, STREAMS } = layout;

/** The chamber the Golden King's views draw on: its lid, shafts, niches, rings, pours, beam, dome, painted arc and heap. */
export type KingChamber = Pick<KurganDungeon, 'setLid' | 'setShaft' | 'setNicheStatue' | 'showHeap' | 'sandAt' | 'rings' | 'streams' | 'beam' | 'dome' | 'arc'>;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3();
const n = (value: number | undefined): number => value ?? 0;

/**
 * The Golden King fight's view bindings (SF27): every view the platform fight (data/goldenKing.generated.json) names, drawn on
 * the kurgan chamber's meshes in its local frame, and the King's gold glow on his body's materials. View only: nothing
 * here moves the fight.
 */
export function goldenKingViews(d: KingChamber, king: () => Animal | null, tuning: { readonly reach: number; readonly ringMax: number; readonly beamRadius: number }): BossViewBinding {
  d.dome.mesh.scale.setScalar(1.75);
  d.dome.mat.uniforms.uAlpha.value = 0.9;
  return {
    'arena.lid.open': (open) => { d.setLid(n(open)); },
    'arena.shaft': (i, strength) => { d.setShaft(n(i), n(strength)); },
    'arena.fx.hide': () => {
      for (const r of d.rings) r.mesh.visible = false;
      for (const s of d.streams) { s.mesh.visible = false; s.tell.visible = false; }
      d.beam.mesh.visible = false; d.beam.line.visible = false; d.dome.mesh.visible = false; d.arc.mesh.visible = false;
    },
    'arena.shield': (on) => { d.dome.mesh.visible = on === 1; },
    'arena.shield.at': (x, y, z) => { d.dome.mesh.position.set(n(x) - DUNGEON.x, n(y) - DUNGEON.y, n(z) - DUNGEON.z); },
    'adds.spot': (i, on) => { d.setNicheStatue(n(i), on === 1); },
    'boss.glow': (k) => {
      const body = king();
      if (!body) return;
      const mats = Array.isArray(body.mesh.material) ? body.mesh.material : [body.mesh.material];
      for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.setRGB(1.0, 0.62, 0.16); m.emissiveIntensity = n(k); }
    },
    'strike.arc': (x, floorY, z, yaw) => {
      const arc = d.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(n(x) - DUNGEON.x, n(floorY) - DUNGEON.y + 0.04, n(z) - DUNGEON.z);
      arc.mesh.rotation.y = n(yaw) - Math.PI / 2;
      arc.mesh.scale.setScalar(tuning.reach * 1.15);
    },
    'strike.arc.off': () => { d.arc.mesh.visible = false; },
    'hazard.ring': (i, cx, cz, r) => {
      const vis = d.rings[n(i)];
      if (!vis) return;
      vis.mesh.visible = true;
      vis.mesh.position.set(n(cx) - DUNGEON.x, 0.06, n(cz) - DUNGEON.z);
      vis.mesh.scale.setScalar(n(r));
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(n(r), tuning.ringMax * 0.7, tuning.ringMax));
    },
    'hazard.ring.off': (i) => { const vis = d.rings[n(i)]; if (vis) vis.mesh.visible = false; },
    'hazard.ring.tell': (x, floorS, z, charge) => {
      const ring = d.rings[1];
      if (!ring) return;
      ring.mesh.visible = true;
      ring.mesh.position.set(n(x) - DUNGEON.x, n(floorS) - DUNGEON.y + 0.05, n(z) - DUNGEON.z);
      ring.mesh.scale.setScalar(2.4 - 1.6 * n(charge));
      ring.mat.uniforms.uAlpha.value = 0.4 + 0.6 * n(charge);
    },
    'hazard.pour.off': (i) => { const vis = d.streams[n(i)]; if (vis) { vis.mesh.visible = false; vis.tell.visible = false; } },
    'hazard.pour.tell': (i, t) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = true; vis.tellMat.uniforms.uAlpha.value = Math.min(1, n(t) * 2) * 0.9;
      vis.tell.position.y = d.sandAt(vis.x, vis.z) + 0.05;
    },
    'hazard.pour.fall': (i, k) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = false;
      vis.mesh.visible = true;
      vis.mat.uniforms.uAlpha.value = n(k);
    },
    'hazard.sweep': (cx, cz, angle, dir, k) => {
      const b = d.beam, R = tuning.beamRadius, a = n(angle);
      const top = _w.set(COFFIN.x + 0.3, 6.2, COFFIN.z + 0.1);
      _v.set(n(cx), 0, n(cz));
      const len = _v.distanceTo(top);
      b.mesh.visible = true;
      b.mesh.position.copy(_v);
      b.mesh.scale.set(1, len, 1);
      b.mesh.quaternion.setFromUnitVectors(_h.set(0, 1, 0), top.sub(_v).normalize());
      b.mat.uniforms.uAlpha.value = 0.7 * n(k);
      b.line.visible = true;
      b.line.rotation.y = n(dir) > 0 ? a - Math.PI / 2 : a - Math.PI / 2 - Math.PI * 0.6;
      b.line.scale.set(R / 6, 1, R * 0.85 / 6);
      b.line.position.set(0, 0.05, -0.5);
      b.lineMat.uniforms.uAlpha.value = 0.55 * n(k);
    },
    'hazard.sweep.off': () => { d.beam.mesh.visible = false; d.beam.line.visible = false; },
    'victory.heap': (on, x, z) => {
      if (on !== 1) { d.showHeap(false); return; }
      d.showHeap(true, n(x) - DUNGEON.x, n(z) - DUNGEON.z);
    },
  };
}

// Baked fabric; the remaining attachments are driven by the live encounter.
const { STATIC_TRIANGLES, SAND_N, DW, DOOR_W, DOOR_H, FALLEN } = layout.FABRIC;
const SAND = new THREE.Color('#a88c62');

interface Stream { mesh: THREE.Mesh; mat: FxMaterial; tell: THREE.Mesh; tellMat: FxMaterial; x: number; z: number }
interface Ring { mesh: THREE.Mesh; mat: FxMaterial }

/** Baked tomb fabric with the live seal, sand and encounter-driven view attachments. */
export class KurganDungeon {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  /** true while the player is in the dromos or the chamber (the fight hides the outdoor world then) */
  inside = false;
  /** walkable heights: the floor (+ the sand drifts), the coffin plinth, the fallen beams, the pedestal step */
  readonly floorHeightAt = (x: number, z: number): number | undefined => this.floorAt(x, z);

  readonly niches = NICHES;
  readonly streams: Stream[] = [];
  readonly rings: Ring[] = [];
  declare beam: { mesh: THREE.Mesh; mat: FxMaterial; line: THREE.Mesh; lineMat: FxMaterial };
  declare dome: { mesh: THREE.Mesh; mat: FxMaterial };
  declare arc: { mesh: THREE.Mesh; mat: FxMaterial };
  private shafts: { mesh: THREE.Mesh; mat: FxMaterial; base: number; target: number }[] = [];
  declare private flames: FxMaterial;
  declare private curtain: { mesh: THREE.Mesh; mat: FxMaterial; k: number; target: number };
  private sealCollider: Collider;
  declare private lid: THREE.Mesh;
  private statues: THREE.Mesh[] = [];
  declare private heap: THREE.Mesh;
  private fx: FxMaterial[] = [];
  // the sand drifts: a heightfield over the chamber floor (SAND_N × SAND_N cells), drawn as one displaced grid
  private sandH = new Float32Array(SAND_N * SAND_N);
  declare private sandMesh: THREE.Mesh;
  private sandLight = new Float32Array((SAND_N + 1) * (SAND_N + 1) * 3);
  private sandDirty = false;
  /** the drifts' collision (P1): rebuilt with the drawn grid */
  private sandPatch: HeightPatch | null = null;
  private sandAcc = 0;
  private staticMaterial: THREE.MeshBasicMaterial | null = null;
  private staticBuilt = false;

  constructor() {
    this.group.name = 'kurgan-dungeon';
    this.group.visible = false;
    this.group.position.set(DUNGEON.x, DUNGEON.y, DUNGEON.z);
    this.sealCollider = { x: DUNGEON.x, z: DUNGEON.z + CH + 0.1, hw: DOOR_W + 0.3, hd: 0.25, rot: 0, yTop: DUNGEON.y - 50, yBottom: DUNGEON.y - 51 };
  }

  // ── frames ──
  local(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 { return out.set(p.x - DUNGEON.x, p.y - DUNGEON.y, p.z - DUNGEON.z); }
  world(lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 { return out.set(DUNGEON.x + lx, DUNGEON.y + ly, DUNGEON.z + lz); }
  inChamber(p: THREE.Vector3): boolean { const x = p.x - DUNGEON.x, z = p.z - DUNGEON.z, y = p.y - DUNGEON.y; return Math.abs(x) < CH && Math.abs(z) < CH && y > -3 && y < 8; }
  inDromos(p: THREE.Vector3): boolean { const x = p.x - DUNGEON.x, z = p.z - DUNGEON.z, y = p.y - DUNGEON.y; return Math.abs(x) < DW + 0.5 && z >= CH && z < DROMOS_END + 1 && y > -3 && y < 8; }
  inVolume(p: THREE.Vector3): boolean { return this.inChamber(p) || this.inDromos(p); }

  build(lazyStatic = false): this {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) { /* every part now */ }
    return this;
  }

  /** Restore baked attachments a piece per task, retaining the original child order. */
  async buildSliced(lazyStatic: boolean, yieldTask: () => Promise<void>): Promise<this> {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) await yieldTask();
    return this;
  }

  private *buildSteps(lazyStatic: boolean): Generator<void, void> {
    let ms = 0, t0 = diagnosticNow();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.staticMaterial = mat;
    if (!lazyStatic) this.buildStatic();
    this.tris = STATIC_TRIANGLES;
    const pause = function* pause(): Generator<void, void> { ms += diagnosticNow() - t0; yield; t0 = diagnosticNow(); };
    this.lid = new THREE.Mesh(bakedActorGeometry('dungeon:lid'), mat);
    this.lid.position.set(COFFIN.x, COFFIN.plinthH + COFFIN.h + 0.09, COFFIN.z);
    this.lid.frustumCulled = false; this.group.add(this.lid);
    for (const i of NICHES.keys()) {
      yield* pause();
      const mesh = new THREE.Mesh(bakedActorGeometry(`dungeon:statue:${String(i)}`), mat);
      mesh.frustumCulled = false; this.statues.push(mesh); this.group.add(mesh);
    }
    yield* pause();
    this.heap = new THREE.Mesh(bakedActorGeometry('dungeon:heap'), mat);
    this.heap.visible = false; this.group.add(this.heap);
    yield* pause();
    this.buildSand(mat);
    this.buildFx();
    this.buildColliders();
    ms += diagnosticNow() - t0;
    this.buildMs = Math.round(ms);
  }

  private buildStatic(): void {
    if (this.staticBuilt) return;
    if (this.staticMaterial === null) throw new Error('The dungeon must build before entry');
    const mesh = new THREE.Mesh(bakedActorGeometry('dungeon:interior'), this.staticMaterial);
    mesh.name = 'kurgan-interior'; mesh.frustumCulled = false;
    this.group.add(mesh);
    this.group.children.pop(); this.group.children.unshift(mesh);
    this.staticBuilt = true;
  }

  /** Materialize the hidden baked interior at the existing entry boundary. */
  async buildStaticSliced(yieldTask: () => Promise<void>): Promise<void> {
    this.buildStatic();
    await yieldTask();
  }
  buildMs = 0; tris = 0;

  private buildSand(mat: THREE.MeshBasicMaterial): void {
    const g = bakedActorGeometry('dungeon:sand'), light = g.getAttribute('light');
    this.sandLight = Float32Array.from(light.array);
    g.deleteAttribute('light');
    const pos = g.getAttribute('position');
    if (pos instanceof THREE.BufferAttribute) pos.setUsage(THREE.DynamicDrawUsage);
    this.sandMesh = new THREE.Mesh(g, mat);
    this.sandMesh.frustumCulled = false;
    this.sandMesh.visible = false;
    this.group.add(this.sandMesh);
  }

  private buildFx(): void {
    const add = <T extends THREE.Object3D>(o: T, order = 10): T => { o.renderOrder = order; o.frustumCulled = false; this.group.add(o); return o; };
    const reg = (m: FxMaterial) => { this.fx.push(m); return m; };
    // the two light shafts: the looter's hole on the coffin, and the pedestal's (lit at the victory)
    const shaft = (x: number, z: number, base: number) => {
      const g = bakedActorGeometry(`dungeon:shaft:${String(this.shafts.length)}`);
      const mat = reg(fxMaterial(FX.shaft, new THREE.Color(1.0, 0.86, 0.58), base));
      const m = add(new THREE.Mesh(g, mat), 12);
      m.position.set(x, 0, z); m.rotation.z = 0.1;
      this.shafts.push({ mesh: m, mat, base, target: base });
    };
    shaft(COFFIN.x + 0.3, COFFIN.z + 0.1, 0.38);
    shaft(PEDESTAL.x, PEDESTAL.z, 0.0);
    // flames: one merged mesh of crossed cards over the braziers and the dromos lamps
    {
      const g = bakedActorGeometry('dungeon:flames');
      this.flames = reg(fxMaterial(FX.flame, new THREE.Color(1.3, 0.55, 0.15), 1));
      add(new THREE.Mesh(g, this.flames), 13);
    }
    // gold rings (the sunburst): flat annuli on the floor, radius set per use
    for (let i = 0; i < 2; i++) {
      const g = bakedActorGeometry('dungeon:ring');
      const mat = reg(fxMaterial(FX.ring, new THREE.Color(3.2, 2.1, 0.6), 0));
      mat.uniforms.uP.value.x = 0.9;
      mat.depthTest = false;                           // the ring reads over the drifts and the rugs
      const m = add(new THREE.Mesh(g, mat), 14); m.visible = false;
      this.rings.push({ mesh: m, mat });
    }
    // sand streams (+ their floor shimmer tell)
    for (const s of STREAMS) {
      const g = bakedActorGeometry('dungeon:stream');
      const mat = reg(fxMaterial(FX.stream, new THREE.Color(0.95, 0.78, 0.48), 0, false));
      const m = add(new THREE.Mesh(g, mat), 11); m.position.set(s.x, 0, s.z); m.visible = false;
      const tg = bakedActorGeometry('dungeon:tell');
      const tellMat = reg(fxMaterial(FX.decal, new THREE.Color(1.6, 1.15, 0.4), 0));
      tellMat.uniforms.uP.value.set(0, 0.6, 0, 0);
      const tell = add(new THREE.Mesh(tg, tellMat), 14); tell.position.set(s.x, 0.04, s.z); tell.visible = false;
      this.streams.push({ mesh: m, mat, tell, tellMat, x: s.x, z: s.z });
    }
    // the sun beam (phase III) and the thin gold line of its path
    {
      const g = bakedActorGeometry('dungeon:beam');
      const mat = reg(fxMaterial(FX.beam, new THREE.Color(1.5, 1.0, 0.4), 0));
      const mesh = add(new THREE.Mesh(g, mat), 12); mesh.visible = false;
      const lg = bakedActorGeometry('dungeon:line');
      const lineMat = reg(fxMaterial(FX.ring, new THREE.Color(1.8, 1.25, 0.4), 0));
      lineMat.uniforms.uP.value.x = 0.8;
      const line = add(new THREE.Mesh(lg, lineMat), 14); line.position.y = 0.05; line.visible = false;
      this.beam = { mesh, mat, line, lineMat };
    }
    // the shield dome (phase II) and the painted arc of the wide strike
    {
      const g = bakedActorGeometry('dungeon:dome');
      const mat = reg(fxMaterial(FX.dome, new THREE.Color(1.5, 1.05, 0.35), 0));
      const mesh = add(new THREE.Mesh(g, mat), 15); mesh.visible = false;
      this.dome = { mesh, mat };
      const ag = bakedActorGeometry('dungeon:arc');
      const amat = reg(fxMaterial(FX.decal, new THREE.Color(1.8, 0.5, 0.15), 0));
      amat.uniforms.uP.value.set(0.25, 0.5, 0, 0);
      const arc = add(new THREE.Mesh(ag, amat), 14); arc.visible = false;
      this.arc = { mesh: arc, mat: amat };
    }
    // the seal: a curtain of sand pouring over the chamber door
    {
      const g = bakedActorGeometry('dungeon:seal');
      const mat = reg(fxMaterial(FX.curtain, new THREE.Color(0.9, 0.72, 0.45), 0, false));
      const mesh = add(new THREE.Mesh(g, mat), 11); mesh.position.set(0, 0, CH + 0.05); mesh.visible = false;
      this.curtain = { mesh, mat, k: 0, target: 0 };
    }
  }

  private buildColliders(): void {
    this.colliders.push(...layout.COLLISION.boxes.map(box => ({ ...box })), this.sealCollider);
  }

  /**
   * NALATI-MERGE P1: the interior into the world registry — the walls, ceiling and floor slabs as boxes (larch; the
   * pedestal stone, the braziers metal), the coffin plinth + a step onto it and the pedestal's step as slabs, the fallen
   * beams as capsules; the seal as a piece that follows the (still) interior group and collides only while sealed; the
   * sand drifts as a heightfield rebuilt with the drawn grid. `floorHeightAt` stays for placement.
   */
  register(registry: WorldRegistry): void {
    const Y0 = DUNGEON.y;
    // JSON has one zero; the original box conversion negates its zero yaw.
    const descs = structuredClone(layout.COLLISION.descs) as ColliderDesc[];
    for (const desc of descs) if (desc.kind === 'box' && desc.yaw === 0) desc.yaw = -0;
    registry.add({ id: 'nalati-kurgan-dungeon', name: 'The Golden King\'s tomb', category: 'buildings', file: 'src/shards/nalati-grasslands/world/KurganDungeon.ts', surface: 'wood', colliders: descs, floor: this.floorHeightAt, solidFloor: true });
    // the seal: its box in the interior group's frame (the group stands at DUNGEON, never moves)
    registry.add({
      id: 'nalati-kurgan-seal', name: 'The sand seal', category: 'buildings', file: 'src/shards/nalati-grasslands/world/KurganDungeon.ts', surface: 'sand', follows: this.group,
      colliders: [{ kind: 'box', x: 0, y: DOOR_H / 2, z: CH + 0.1, hx: DOOR_W + 0.3, hy: DOOR_H / 2 + 1, hz: 0.25 }], active: () => this.sealed,
    });
    const ph = app.physics;
    if (ph) this.sandPatch = new HeightPatch(ph, { x: DUNGEON.x, y: Y0, z: DUNGEON.z, size: CH * 2, res: SAND_N + 1, material: 'sand', owner: this });
  }

  // ── walkable heights ──
  private floorAt(x: number, z: number): number | undefined {
    const lx = x - DUNGEON.x, lz = z - DUNGEON.z;
    const inCh = Math.abs(lx) <= CH + 1.4 && Math.abs(lz) <= CH, inDr = Math.abs(lx) <= DW + 0.2 && lz >= CH - 0.1 && lz <= DROMOS_END + 0.6;
    if (!inCh && !inDr) return undefined;
    let y = 0;
    if (inCh) {
      y = this.sandAt(lx, lz);
      // the coffin plinth
      if (Math.abs(lx - COFFIN.x) < COFFIN.wid / 2 + 0.65 && Math.abs(lz - COFFIN.z) < COFFIN.len / 2 + 0.6) y = Math.max(y, COFFIN.plinthH);
      // the pedestal's step
      if (Math.abs(lx - PEDESTAL.x) < 0.8 && Math.abs(lz - PEDESTAL.z) < 0.7) y = Math.max(y, 0.18);
      // the fallen beams (their round tops)
      for (const f of FALLEN) {
        const ax = f.a.x, az = f.a.z, bx = f.b.x, bz = f.b.z;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        const u = Math.max(0, Math.min(1, ((lx - ax) * dx + (lz - az) * dz) / L2));
        const d = Math.hypot(lx - (ax + dx * u), lz - (az + dz * u));
        if (d < f.r) y = Math.max(y, f.r + Math.sqrt(f.r * f.r - d * d) - 0.02);
      }
    }
    return DUNGEON.y + y;
  }

  /** sand depth (m) at a chamber-local point */
  sandAt(lx: number, lz: number): number {
    const fx = (lx + CH) / (CH * 2) * SAND_N - 0.5, fz = (lz + CH) / (CH * 2) * SAND_N - 0.5;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const h = (i: number, j: number) => (i < 0 || j < 0 || i >= SAND_N || j >= SAND_N ? 0 : this.sandH[j * SAND_N + i] ?? 0);
    return (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz;
  }
  /** pile sand: a soft mound of radius r (m) rising by dh (m) at its centre, capped at `max` */
  addSand(lx: number, lz: number, r: number, dh: number, max = 1.0): void {
    const cell = (CH * 2) / SAND_N;
    const i0 = Math.max(0, Math.floor((lx - r + CH) / cell)), i1 = Math.min(SAND_N - 1, Math.ceil((lx + r + CH) / cell));
    const j0 = Math.max(0, Math.floor((lz - r + CH) / cell)), j1 = Math.min(SAND_N - 1, Math.ceil((lz + r + CH) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -CH + (i + 0.5) * cell, cz = -CH + (j + 0.5) * cell, d = Math.hypot(cx - lx, cz - lz) / r;
      if (d >= 1) continue;
      const k = j * SAND_N + i;
      this.sandH[k] = Math.min(max, (this.sandH[k] ?? 0) + dh * (1 - d * d) * (1 - d * d));
    }
    this.sandDirty = true;
  }
  clearSand(): void { this.sandH.fill(0); this.sandDirty = true; }
  /** the drifts drain away (the victory): `rate` m/s */
  drainSand(dt: number, rate = 0.25): void {
    let any = false;
    for (let k = 0; k < this.sandH.length; k++) { const h = this.sandH[k] ?? 0; if (h > 0) { this.sandH[k] = Math.max(0, h - rate * dt); any = true; } }
    if (any) this.sandDirty = true;
  }

  private writeSand(): void {
    const g = this.sandMesh.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
    const N1 = SAND_N + 1;
    const grid = this.sandPatch ? new Float32Array(N1 * N1) : null;
    let any = false;
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const v = j * N1 + i;
      // vertex height = the mean of the (up to) four cells round it
      let s = 0, c = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < SAND_N && cj < SAND_N) { s += this.sandH[cj * SAND_N + ci] ?? 0; c++; } }
      const h = c > 0 ? s / c : 0;
      if (h > 0.01) any = true;
      if (grid) grid[v] = h;
      pos.setY(v, h > 0.01 ? h : -0.05);
      const k = 0.85 + 0.25 * Math.min(1, h / 0.6);
      col.setXYZ(v, SAND.r * k * (this.sandLight[v * 3] ?? 1), SAND.g * k * (this.sandLight[v * 3 + 1] ?? 1), SAND.b * k * (this.sandLight[v * 3 + 2] ?? 1));
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.sandMesh.visible = any;
    if (grid) this.sandPatch?.set(grid);   // P1: the drifts are walkable as real geometry (row j = z, column i = x)
  }

  // ── state the fight drives ──
  setSealed(on: boolean): void {
    this.curtain.target = on ? 1 : 0;
    this.sealCollider.yBottom = on ? DUNGEON.y - 1 : DUNGEON.y - 51;
    this.sealCollider.yTop = on ? DUNGEON.y + DOOR_H + 1 : DUNGEON.y - 50;
  }
  get sealed(): boolean { return this.curtain.target > 0.5; }
  /** the coffin lid: 0 closed … 1 slid off and leaning on the coffin's side */
  setLid(open: number): void {
    const k = THREE.MathUtils.clamp(open, 0, 1);
    const slide = THREE.MathUtils.smoothstep(k, 0, 0.7), tip = THREE.MathUtils.smoothstep(k, 0.55, 1);
    this.lid.position.set(COFFIN.x + slide * (COFFIN.wid * 0.85), COFFIN.plinthH + COFFIN.h + 0.09 - tip * 0.75, COFFIN.z + slide * 0.2);
    this.lid.rotation.set(0, 0.06 * slide, -tip * 1.15);
  }
  setNicheStatue(i: number, on: boolean): void { const s = this.statues[i]; if (s) s.visible = on; }
  /** 0 = the looter's-hole shaft, 1 = the pedestal shaft; strength 0..1.5 (eased) */
  setShaft(i: number, strength: number): void { const s = this.shafts[i]; if (s) s.target = strength; }
  showHeap(on: boolean, lx = COFFIN.x + 1.8, lz = COFFIN.z + 2.6): void { this.heap.visible = on; this.heap.position.set(lx, this.sandAt(lx, lz), lz); }
  /** show / hide the whole interior (it lives in the sky — see the header) */
  setVisible(on: boolean): void {
    if (on && !this.staticBuilt) this.buildStatic();
    this.group.visible = on;
  }

  update(dt: number, t: number): void {
    if (!this.group.visible) return;
    for (const m of this.fx) m.uniforms.uTime.value = t;
    for (const s of this.shafts) {
      const a = s.mat.uniforms.uAlpha;
      a.value += (s.target - a.value) * Math.min(1, dt * 1.5);
      s.mesh.visible = a.value > 0.01;
    }
    const c = this.curtain;
    c.k += (c.target - c.k) * Math.min(1, dt * (c.target > c.k ? 3 : 1.2));
    c.mat.uniforms.uAlpha.value = c.k;
    c.mesh.visible = c.k > 0.02;
    this.flames.uniforms.uAlpha.value = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.sandAcc += dt;
    if (this.sandDirty && this.sandAcc > 1 / 15) { this.sandAcc = 0; this.sandDirty = false; this.writeSand(); }
  }
}

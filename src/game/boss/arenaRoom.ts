/** Client-only arena attachments and deformable floor, driven by scene and encounter rows. */
import * as THREE from 'three';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { fxMaterial, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { HeightPatch } from '@wildshard/engine/physics/heightPatch';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { createClientScene } from '../plugin/ui';
import { bossFight, type BossViewBinding, type PhasedBossBrain, type PhasedBossFight } from '../plugin/bossPhase';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import type { ShardContext } from '../plugin/context';
import { bindRuntimeBoss } from '../plugin/headless';
import { installBossEncounter, type Boss } from '../Boss';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { ReturnProgram } from '../population/returnProgram';
import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { BossEncounterDefinitionSchema } from '@wildshard/format/bossEncounter';
import { VariantBowPower } from '../weapons/bowVariant';
import type { MountedLoadout } from '../loadout/mounted';
import { enteredAdventurePersistence } from '../quest/chapterBindings';
import { modelContext, type ModelDef } from '@wildshard/engine/models/model';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { Rng } from '@wildshard/engine/core/rng';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import { macrotask } from '@wildshard/engine/boot/plan';
import { listenPage } from '@wildshard/engine/input/dom';

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite,finite,finite]);
const point = v.strictObject({ x: finite, z: finite });
const box = v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite });
const list = <S extends v.GenericSchema>(schema: S) => v.pipe(v.array(schema), v.maxLength(256));
export const ArenaRoomPortalSchema = v.strictObject({
  signal: rowId, spawn: v.strictObject({ x: finite, z: finite, yaw: finite }), end: finite,
  exitOffset: finite, slow: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  fade: v.strictObject({ out: finite, hold: finite, in: finite }),
  keep: rowId, near: finite, floor: v.strictObject({ tolerance: finite, depth: finite }),
});
/** Native owners borrowed by an arena portal, without author callbacks. */
export interface ArenaRoomPortalWorld {
  readonly game: Pick<Game, 'scene' | 'camera'>;
  readonly player: Pick<Player, 'position' | 'velocity' | 'yaw' | 'pitch' | 'moveScale'>;
  readonly animals: Pick<AnimalManager, 'calm' | 'group'>;
}
/** Client-only entry/exit lifecycle of the existing arena host. AS observes
 * the actual room floor and entrance; the host owns fades, isolation, movement
 * and the single ordered boss/room update. Row data chooses all room policy. */
export class ArenaRoomPortal {
  inside = false;
  private readonly rows;
  private readonly keep: RegExp;
  private hidden: THREE.Object3D[] = [];
  private calmWas = false;
  private locked = false; private slow = false;
  private elapsed = 0; private fade = -1; private pending: 'enter' | 'exit' | null = null;
  private boss: Boss | null = null; private ui: BossBar | null = null;
  private fight: ReturnType<typeof arenaRoomFight> | null = null;
  constructor(private readonly world: ArenaRoomPortalWorld, private readonly room: BossArenaRoom, input: unknown,
    private readonly program: ReturnProgram, private readonly entrance: { readonly x: number; readonly y: number; readonly z: number; readonly facing: number } | null) {
    this.rows = v.parse(ArenaRoomPortalSchema, input); this.keep = new RegExp(this.rows.keep, 'i');
  }
  bind(boss: Boss, ui: BossBar, fight: ReturnType<typeof arenaRoomFight>): void { this.boss = boss; this.ui = ui; this.fight = fight; }
  setLocked(on: boolean): void { this.locked = on; this.move(); }
  private move(): void { this.world.player.moveScale = this.locked ? 0 : this.slow ? this.rows.slow : 1; }
  enter(immediate = false, atZ = this.rows.spawn.z): void {
    if (!immediate) { this.ui?.fade(true, this.rows.fade.out); this.fade = this.rows.fade.hold; this.pending = 'enter'; return; }
    const { game, player, animals } = this.world, origin = this.room.rows.origin;
    this.room.world(this.rows.spawn.x, 0, atZ, player.position);
    player.velocity.set(0,0,0); player.yaw = this.rows.spawn.yaw; player.pitch = 0;
    this.inside = true; this.room.setVisible(true); this.hidden = [];
    for (const object of game.scene.children) {
      if (!object.visible || object === this.room.group || object === animals.group || object === game.camera || object instanceof THREE.Light || this.keep.test(object.name) || object.type === 'Points'
        || object.position.distanceToSquared(new THREE.Vector3(origin.x,origin.y,origin.z)) < this.rows.near ** 2) continue;
      object.visible = false; this.hidden.push(object);
    }
    this.calmWas = animals.calm; animals.calm = true; this.fight?.setPresent(true); this.boss?.arm();
  }
  leave(teleport: boolean, immediate = false): void {
    if (teleport && !immediate) { this.ui?.fade(true, this.rows.fade.out); this.fade = this.rows.fade.hold; this.pending = 'exit'; return; }
    const { player, animals } = this.world, e = this.entrance;
    if (teleport && e !== null) {
      player.position.set(e.x - Math.sin(e.facing) * this.rows.exitOffset, e.y, e.z - Math.cos(e.facing) * this.rows.exitOffset);
      player.yaw = e.facing; player.pitch = 0; player.velocity.set(0,0,0);
    }
    this.inside = false; this.room.setVisible(false);
    for (const object of this.hidden) object.visible = true;
    this.hidden = []; animals.calm = this.calmWas; this.boss?.disarm(); this.fight?.setPresent(false);
    this.slow = false; this.locked = false; this.move();
  }
  update(dt: number, t: number): void {
    if (this.fade >= 0) {
      this.fade -= dt;
      if (this.fade < 0) { const pending = this.pending; this.pending = null; if (pending === 'enter') this.enter(true); else if (pending === 'exit') this.leave(true,true); this.ui?.fade(false,this.rows.fade.in); }
      return;
    }
    const p = this.world.player.position, origin = this.room.rows.origin;
    this.elapsed += dt;
    if (this.elapsed >= .1 - 1e-9) {
      const e = this.entrance, z = p.z - origin.z, floor = this.room.floorHeightAt(p.x,p.z);
      const result = this.program.project(this.rows.signal, { px: p.x, pz: p.z, y: p.y, ex: e?.x ?? 0, ey: e?.y ?? 0, ez: e?.z ?? 0, facing: e?.facing ?? 0,
        volume: Number(this.room.inVolume(p)), inside: Number(this.inside), corridor: z, land: this.rows.end, engaged: Number(this.boss?.engaged === true),
        sand: this.room.inChamber(p) ? this.room.sandAt(p.x-origin.x,z) : 0, floor: floor ?? origin.y, cy: origin.y });
      this.elapsed = 0;
      if (!this.inside) { if (e !== null && result['enter'] === 1) this.enter(); }
      else if (result['exit'] !== 0) { this.leave(result['exit'] === 2); return; }
      if (this.inside) { this.slow = result['slow'] === 1; this.move(); }
    }
    if (!this.inside) return;
    const floor = this.room.floorHeightAt(p.x,p.z);
    if (floor !== undefined && p.y < floor-this.rows.floor.tolerance && p.y > floor-this.rows.floor.depth) { p.y = floor; if (this.world.player.velocity.y < 0) this.world.player.velocity.y = 0; }
    this.boss?.update(dt,t); this.room.update(dt,t);
  }
}
/** Data admission precedes any scene or physics allocation. */
export const ArenaRoomSchema = v.strictObject({
 id: rowId, name: rowId, file: rowId, sealId: rowId, sealName: rowId,
 origin: v.strictObject({ x: finite, y: finite, z: finite }),
 halfWidth: positive, corridorHalfWidth: positive, corridorEnd: positive,
 doorHalfWidth: positive, doorHeight: positive, sandCells: v.pipe(positive, v.integer(), v.maxValue(256)), sandColor: rowId, triangles: finite,
 cover: v.strictObject({ x: finite, z: finite, wid: positive, len: positive, plinthH: finite, h: finite }), pedestal: point,
 beams: list(v.strictObject({ a: point, b: point, r: positive })),
 collision: v.strictObject({ boxes: list(box), descs: list(v.unknown()) }),
 glowColor: triple, beamTop: triple, coverMotion: v.strictObject({ closed: triple, slide: triple, tip: triple, slideRotation: triple, tipRotation: triple }),
 markers: list(rowId), shafts: list(v.strictObject({ id: rowId, base: finite })),
 streams: list(v.strictObject({ id: rowId, tell: rowId, x: finite, z: finite })),
 lid: rowId, heap: rowId, sand: rowId, flames: rowId, rings: list(rowId), beam: rowId, line: rowId, dome: rowId, arc: rowId, seal: rowId,
 view: v.strictObject({ scene: v.unknown(), static: v.unknown(), fx: list(v.strictObject({ id: rowId, mode: finite,
  color: v.tuple([finite,finite,finite]), alpha: finite, additive: v.boolean(), depthTest: v.boolean(), p: v.tuple([finite,finite,finite,finite]) })) }),
});
/** Baked scene ids, local placement and walkable surfaces; no executable hooks. */
export type ArenaRoomRows = v.InferOutput<typeof ArenaRoomSchema>;
interface Stream { mesh: THREE.Mesh; mat: FxMaterial; tell: THREE.Mesh; tellMat: FxMaterial; x: number; z: number }
interface Ring { mesh: THREE.Mesh; mat: FxMaterial }


export class BossArenaRoom {
  group: THREE.Object3D = new THREE.Group();
  readonly colliders: Collider[] = [];

  readonly floorHeightAt = (x: number, z: number): number | undefined => this.floorAt(x, z);

  readonly streams: Stream[] = [];
  readonly rings: Ring[] = [];
  declare beam: { mesh: THREE.Mesh; mat: FxMaterial; line: THREE.Mesh; lineMat: FxMaterial };
  declare dome: { mesh: THREE.Mesh; mat: FxMaterial };
  declare arc: { mesh: THREE.Mesh; mat: FxMaterial };
  private shafts: { mesh: THREE.Mesh; mat: FxMaterial; target: number }[] = [];
  declare private flames: FxMaterial;
  declare private curtain: { mesh: THREE.Mesh; mat: FxMaterial; k: number; target: number };
  private sealCollider: Collider;
  declare private lid: THREE.Mesh;
  private statues: THREE.Mesh[] = [];
  declare private heap: THREE.Mesh;
  private fx: FxMaterial[] = [];
  // the sand drifts: a heightfield over the chamber floor (this.rows.sandCells × this.rows.sandCells cells), drawn as one displaced grid
  private sandH: Float32Array;
  declare private sandMesh: THREE.Mesh;
  private sandLight: Float32Array;
  private readonly sandColor: THREE.Color;
  actor: Animal | null = null;
  private sandDirty = false;
  private sandPatch: HeightPatch | null = null;
  private sandAcc = 0;
  private staticMaterial: THREE.MeshBasicMaterial | null = null;
  private staticBuilt = false;

  readonly rows: ArenaRoomRows;
  constructor(input: unknown, private readonly geometry: ReadonlyMap<string, THREE.BufferGeometry>) {
    const rows = v.parse(ArenaRoomSchema, input); this.rows = rows;
    this.sandH = new Float32Array(rows.sandCells * rows.sandCells);
    this.sandLight = new Float32Array((rows.sandCells + 1) ** 2 * 3);
    this.sandColor = new THREE.Color(rows.sandColor);
    this.sealCollider = { x: this.rows.origin.x, z: this.rows.origin.z + this.rows.halfWidth + 0.1, hw: this.rows.doorHalfWidth + 0.3, hd: 0.25, rot: 0, yTop: this.rows.origin.y - 50, yBottom: this.rows.origin.y - 51 };
  }


  // Local frames.
  world(lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 { return out.set(this.rows.origin.x + lx, this.rows.origin.y + ly, this.rows.origin.z + lz); }
  inChamber(p: THREE.Vector3): boolean { const x = p.x - this.rows.origin.x, z = p.z - this.rows.origin.z, y = p.y - this.rows.origin.y; return Math.abs(x) < this.rows.halfWidth && Math.abs(z) < this.rows.halfWidth && y > -3 && y < 8; }
  inDromos(p: THREE.Vector3): boolean { const x = p.x - this.rows.origin.x, z = p.z - this.rows.origin.z, y = p.y - this.rows.origin.y; return Math.abs(x) < this.rows.corridorHalfWidth + 0.5 && z >= this.rows.halfWidth && z < this.rows.corridorEnd + 1 && y > -3 && y < 8; }
  inVolume(p: THREE.Vector3): boolean { return this.inChamber(p) || this.inDromos(p); }

  build(lazyStatic = false): this {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) { /* every part now */ }
    return this;
  }

  async buildSliced(lazyStatic: boolean, yieldTask: () => Promise<void>): Promise<this> {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) await yieldTask();
    return this;
  }

  private *buildSteps(lazyStatic: boolean): Generator<void, void> {
    const t0 = diagnosticNow();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.staticMaterial = mat;
    const materials = new Map<string, THREE.Material>([['fabric', mat]]);
    for (const row of this.rows.view.fx) {
      const mode = row.mode;
      if (mode !== 0 && mode !== 1 && mode !== 2 && mode !== 3 && mode !== 4 && mode !== 5 && mode !== 6 && mode !== 7) throw new Error('Invalid chamber effect');
      const material = fxMaterial(mode, new THREE.Color().fromArray(row.color), row.alpha, row.additive);
      material.depthTest = row.depthTest; material.uniforms.uP.value.fromArray(row.p);
      materials.set(row.id, material); this.fx.push(material);
    }
    const recipe = this.rows.view.scene;
    const scene = createClientScene(recipe, { geometry: this.geometry, materials });
    this.group = scene.root;
    const effect = (id: string): Ring => {
      const part: unknown = scene.parts.get(id), material = materials.get(id);
      if (!chamberMesh(part) || !(material instanceof THREE.ShaderMaterial) || !this.fx.includes(material as FxMaterial)) throw new Error('Missing chamber effect');
      return { mesh: part, mat: material as FxMaterial };
    };
    const mesh = (id: string): THREE.Mesh => { const part: unknown = scene.parts.get(id); if (!chamberMesh(part)) throw new Error('Missing chamber part'); return part; };
    this.lid = mesh(this.rows.lid); this.heap = mesh(this.rows.heap); this.sandMesh = mesh(this.rows.sand);
    this.statues = this.rows.markers.map(id => mesh(id));
    const sand = this.sandMesh.geometry;
    this.sandLight = Float32Array.from(sand.getAttribute('light').array); sand.deleteAttribute('light');
    const position = sand.getAttribute('position'); if (position instanceof THREE.BufferAttribute) position.setUsage(THREE.DynamicDrawUsage);
    this.shafts = this.rows.shafts.map(row => Object.assign(effect(row.id), { target: row.base }));
    this.flames = effect(this.rows.flames).mat;
    this.rings.push(...this.rows.rings.map(id => effect(id)));
    this.streams.push(...this.rows.streams.map(spot => { const stream = effect(spot.id), tell = effect(spot.tell); return Object.assign(stream, { tell: tell.mesh, tellMat: tell.mat, x: spot.x, z: spot.z }); }));
    const beam = effect(this.rows.beam), line = effect(this.rows.line); this.beam = { ...beam, line: line.mesh, lineMat: line.mat };
    this.dome = effect(this.rows.dome); this.arc = effect(this.rows.arc); this.curtain = { ...effect(this.rows.seal), k: 0, target: 0 };
    this.colliders.push(...structuredClone(this.rows.collision.boxes), this.sealCollider);
    if (!lazyStatic) this.buildStatic();
    this.tris = this.rows.triangles; this.buildMs = Math.round(diagnosticNow() - t0);
    yield;
  }

  private buildStatic(): void {
    if (this.staticBuilt) return;
    if (this.staticMaterial === null) throw new Error('The dungeon must build before entry');
    const scene = createClientScene(this.rows.view.static, { geometry: this.geometry, materials: new Map([['fabric', this.staticMaterial]]) });
    this.group.add(scene.root);
    this.group.children.pop(); this.group.children.unshift(scene.root);
    this.staticBuilt = true;
  }

  async buildStaticSliced(yieldTask: () => Promise<void>): Promise<void> { this.buildStatic(); await yieldTask(); }
  buildMs = 0; tris = 0;

  register(registry: WorldRegistry): void {
    const Y0 = this.rows.origin.y;
    // JSON has one zero; the original box conversion negates its zero yaw.
    const descs = readColliderRows(this.rows.collision.descs, { kinds: ['box', 'capsule'], surfaces: ['wood', 'stone', 'metal', 'sand'] });
    for (const desc of descs) if (desc.kind === 'box' && desc.yaw === 0) desc.yaw = -0;
    registry.add({ id: this.rows.id, name: this.rows.name, category: 'buildings', file: this.rows.file, surface: 'wood', colliders: descs, floor: this.floorHeightAt, solidFloor: true });
    // the seal: its box in the interior group's frame (the group stands at this.rows.origin, never moves)
    registry.add({
      id: this.rows.sealId, name: this.rows.sealName, category: 'buildings', file: this.rows.file, surface: 'sand', follows: this.group,
      colliders: [{ kind: 'box', x: 0, y: this.rows.doorHeight / 2, z: this.rows.halfWidth + 0.1, hx: this.rows.doorHalfWidth + 0.3, hy: this.rows.doorHeight / 2 + 1, hz: 0.25 }], active: () => this.sealed,
    });
    const ph = app.physics;
    if (ph) this.sandPatch = new HeightPatch(ph, { x: this.rows.origin.x, y: Y0, z: this.rows.origin.z, size: this.rows.halfWidth * 2, res: this.rows.sandCells + 1, material: 'sand', owner: this });
  }

  // Walkable heights.
  private floorAt(x: number, z: number): number | undefined {
    const lx = x - this.rows.origin.x, lz = z - this.rows.origin.z;
    const inCh = Math.abs(lx) <= this.rows.halfWidth + 1.4 && Math.abs(lz) <= this.rows.halfWidth, inDr = Math.abs(lx) <= this.rows.corridorHalfWidth + 0.2 && lz >= this.rows.halfWidth - 0.1 && lz <= this.rows.corridorEnd + 0.6;
    if (!inCh && !inDr) return undefined;
    let y = 0;
    if (inCh) {
      y = this.sandAt(lx, lz);
      // the coffin plinth
      if (Math.abs(lx - this.rows.cover.x) < this.rows.cover.wid / 2 + 0.65 && Math.abs(lz - this.rows.cover.z) < this.rows.cover.len / 2 + 0.6) y = Math.max(y, this.rows.cover.plinthH);
      // the pedestal's step
      if (Math.abs(lx - this.rows.pedestal.x) < 0.8 && Math.abs(lz - this.rows.pedestal.z) < 0.7) y = Math.max(y, 0.18);
      // the fallen beams (their round tops)
      for (const f of this.rows.beams) {
        const ax = f.a.x, az = f.a.z, bx = f.b.x, bz = f.b.z;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        const u = Math.max(0, Math.min(1, ((lx - ax) * dx + (lz - az) * dz) / L2));
        const d = Math.hypot(lx - (ax + dx * u), lz - (az + dz * u));
        if (d < f.r) y = Math.max(y, f.r + Math.sqrt(f.r * f.r - d * d) - 0.02);
      }
    }
    return this.rows.origin.y + y;
  }

  sandAt(lx: number, lz: number): number {
    const fx = (lx + this.rows.halfWidth) / (this.rows.halfWidth * 2) * this.rows.sandCells - 0.5, fz = (lz + this.rows.halfWidth) / (this.rows.halfWidth * 2) * this.rows.sandCells - 0.5;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const h = (i: number, j: number) => (i < 0 || j < 0 || i >= this.rows.sandCells || j >= this.rows.sandCells ? 0 : this.sandH[j * this.rows.sandCells + i] ?? 0);
    return (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz;
  }
  addSand(lx: number, lz: number, r: number, dh: number, max = 1.0): void {
    const cell = (this.rows.halfWidth * 2) / this.rows.sandCells;
    const i0 = Math.max(0, Math.floor((lx - r + this.rows.halfWidth) / cell)), i1 = Math.min(this.rows.sandCells - 1, Math.ceil((lx + r + this.rows.halfWidth) / cell));
    const j0 = Math.max(0, Math.floor((lz - r + this.rows.halfWidth) / cell)), j1 = Math.min(this.rows.sandCells - 1, Math.ceil((lz + r + this.rows.halfWidth) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -this.rows.halfWidth + (i + 0.5) * cell, cz = -this.rows.halfWidth + (j + 0.5) * cell, d = Math.hypot(cx - lx, cz - lz) / r;
      if (d >= 1) continue;
      const k = j * this.rows.sandCells + i;
      this.sandH[k] = Math.min(max, (this.sandH[k] ?? 0) + dh * (1 - d * d) * (1 - d * d));
    }
    this.sandDirty = true;
  }
  clearSand(): void { this.sandH.fill(0); this.sandDirty = true; }
  drainSand(dt: number, rate = 0.25): void {
    let any = false;
    for (let k = 0; k < this.sandH.length; k++) { const h = this.sandH[k] ?? 0; if (h > 0) { this.sandH[k] = Math.max(0, h - rate * dt); any = true; } }
    if (any) this.sandDirty = true;
  }

  private writeSand(): void {
    const g = this.sandMesh.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
    const N1 = this.rows.sandCells + 1;
    const grid = this.sandPatch ? new Float32Array(N1 * N1) : null;
    let any = false;
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const vertex = j * N1 + i;
      // vertex height = the mean of the (up to) four cells round it
      let s = 0, c = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < this.rows.sandCells && cj < this.rows.sandCells) { s += this.sandH[cj * this.rows.sandCells + ci] ?? 0; c++; } }
      const h = c > 0 ? s / c : 0;
      if (h > 0.01) any = true;
      if (grid) grid[vertex] = h;
      pos.setY(vertex, h > 0.01 ? h : -0.05);
      const k = 0.85 + 0.25 * Math.min(1, h / 0.6);
      col.setXYZ(vertex, this.sandColor.r * k * (this.sandLight[vertex * 3] ?? 1), this.sandColor.g * k * (this.sandLight[vertex * 3 + 1] ?? 1), this.sandColor.b * k * (this.sandLight[vertex * 3 + 2] ?? 1));
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.sandMesh.visible = any;
    if (grid) this.sandPatch?.set(grid);   // P1: the drifts are walkable as real geometry (row j = z, column i = x)
  }

  // State the fight drives.
  setSealed(on: boolean): void {
    this.curtain.target = on ? 1 : 0;
    this.sealCollider.yBottom = on ? this.rows.origin.y - 1 : this.rows.origin.y - 51;
    this.sealCollider.yTop = on ? this.rows.origin.y + this.rows.doorHeight + 1 : this.rows.origin.y - 50;
  }
  get sealed(): boolean { return this.curtain.target > 0.5; }
  setLid(open: number): void {
    const k = THREE.MathUtils.clamp(open, 0, 1);
    const slide = THREE.MathUtils.smoothstep(k, 0, 0.7), tip = THREE.MathUtils.smoothstep(k, 0.55, 1);
    const motion = this.rows.coverMotion;
    this.lid.position.set(motion.closed[0] + motion.slide[0] * slide + motion.tip[0] * tip, motion.closed[1] + motion.slide[1] * slide + motion.tip[1] * tip, motion.closed[2] + motion.slide[2] * slide + motion.tip[2] * tip);
    this.lid.rotation.set(motion.slideRotation[0] * slide + motion.tipRotation[0] * tip, motion.slideRotation[1] * slide + motion.tipRotation[1] * tip, motion.slideRotation[2] * slide + motion.tipRotation[2] * tip);
  }
  setNicheStatue(i: number, on: boolean): void { const s = this.statues[i]; if (s) s.visible = on; }
  setShaft(i: number, strength: number): void { const s = this.shafts[i]; if (s) s.target = strength; }
  showHeap(on: boolean, lx = this.rows.cover.x + 1.8, lz = this.rows.cover.z + 2.6): void { this.heap.visible = on; this.heap.position.set(lx, this.sandAt(lx, lz), lz); }
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


const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3();
function chamberMesh(value: unknown): value is THREE.Mesh { return value instanceof THREE.Mesh; }
const n = (value: number | undefined): number => value ?? 0;


export function arenaRoomViews(d: BossArenaRoom, tuning: { readonly reach: number; readonly ringMax: number; readonly beamRadius: number }): BossViewBinding {
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
    'arena.shield.at': (x, y, z) => { d.dome.mesh.position.set(n(x) - d.rows.origin.x, n(y) - d.rows.origin.y, n(z) - d.rows.origin.z); },
    'adds.spot': (i, on) => { d.setNicheStatue(n(i), on === 1); },
    'boss.glow': (k) => {
      const body = d.actor;
      if (!body) return;
      const mats = Array.isArray(body.mesh.material) ? body.mesh.material : [body.mesh.material];
      for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.fromArray(d.rows.glowColor); m.emissiveIntensity = n(k); }
    },
    'strike.arc': (x, floorY, z, yaw) => {
      const arc = d.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(n(x) - d.rows.origin.x, n(floorY) - d.rows.origin.y + 0.04, n(z) - d.rows.origin.z);
      arc.mesh.rotation.y = n(yaw) - Math.PI / 2;
      arc.mesh.scale.setScalar(tuning.reach * 1.15);
    },
    'strike.arc.off': () => { d.arc.mesh.visible = false; },
    'hazard.ring': (i, cx, cz, r) => {
      const vis = d.rings[n(i)];
      if (!vis) return;
      vis.mesh.visible = true;
      vis.mesh.position.set(n(cx) - d.rows.origin.x, 0.06, n(cz) - d.rows.origin.z);
      vis.mesh.scale.setScalar(n(r));
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(n(r), tuning.ringMax * 0.7, tuning.ringMax));
    },
    'hazard.ring.off': (i) => { const vis = d.rings[n(i)]; if (vis) vis.mesh.visible = false; },
    'hazard.ring.tell': (x, floorS, z, charge) => {
      const ring = d.rings[1];
      if (!ring) return;
      ring.mesh.visible = true;
      ring.mesh.position.set(n(x) - d.rows.origin.x, n(floorS) - d.rows.origin.y + 0.05, n(z) - d.rows.origin.z);
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
      const top = _w.fromArray(d.rows.beamTop);
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
      d.showHeap(true, n(x) - d.rows.origin.x, n(z) - d.rows.origin.z);
    },
  };
}

/** Built-in body binding for row-driven arena fights. Species adapters observe
 * the shared fight's brain rather than installing a shard decision owner. */
const arenaBrains = new WeakMap<Animal, PhasedBossBrain<Animal>>();
export function arenaRoomBrain(actor: Animal): PhasedBossBrain<Animal> | undefined { return arenaBrains.get(actor); }

export const ArenaFightPageSchema = v.strictObject({
  profile: v.unknown(), body: rowId, identity: v.picklist(['runtime', 'declared']),
  add: v.strictObject({ kind: rowId, variant: rowId, memory: v.record(rowId, finite) }),
  damageTag: v.custom<CombatTag>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value)),
  maxZ: finite, reward: triple, respawn: triple, yaw: finite,
  presentation: v.strictObject({ reach: finite, ringMax: finite, beamRadius: finite }),
  cuts: v.pipe(v.array(CreatureStrikeSchema), v.minLength(1), v.maxLength(16)),
  hazards: v.record(rowId, CreatureStrikeSchema),
});
/** Client-only adapter over the existing boss host: admitted body rows, floor,
 * strikes and arena presentation. All public author inputs are data and ids. */
export function arenaRoomFight(ctx: ShardContext, dungeon: BossArenaRoom, input: unknown): {
  phased: PhasedBossFight<Animal>; script: BossScript; body: () => Animal | null; setPresent: (on: boolean) => void; devKill: () => void;
} {
  const rows = v.parse(ArenaFightPageSchema, input), profile = parseBossProfile(rows.profile);
  if (profile.pattern !== 'arena') throw new Error('Arena room requires an arena boss profile');
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Arena fight requires its actual page owners');
  const { animals } = play, { player } = world, owner = bindRuntimeBoss(ctx, ctx.product.shardfile, rows.body, undefined, { identity: rows.identity });
  const cuts = rows.cuts.map(strikeFromData), hazards = new Map(Object.entries(rows.hazards).map(([id, row]) => [id, strikeFromData(row)]));
  const contacts = new StrikeRunner();
  const floor = (actor: Animal): void => { actor.levelGround = true; actor.sampleTerrain(); };
  const retire = (actor: Animal): void => {
    if (dungeon.actor === actor) dungeon.actor = null;
    actor.hidden = true; actor.mesh.visible = false; actor.position.y = -9999;
    const index = animals.animals.indexOf(actor); if (index !== -1) animals.animals.splice(index, 1);
    actor.mesh.removeFromParent();
  };
  const phased = bossFight<Animal>(profile, {
    arena: { floorAt: dungeon.floorHeightAt, pile: (x, z, r, dh, cap) => { dungeon.addSand(x, z, r, dh, cap); },
      clear: () => { dungeon.clearSand(); }, drain: (dt, rate) => { dungeon.drainSand(dt, rate); },
      inArena: p => dungeon.inChamber(p) && p.z < rows.maxZ, seal: on => { dungeon.setSealed(on); } },
    body: { spawn: () => {
      const actor = owner.spawn(); if (actor === null) return null;
      dungeon.actor = actor; actor.herd = -1; floor(actor); return actor;
    }, retire, bind: (actor, brain) => { arenaBrains.set(actor, brain); },
    ready: (actor, floorY) => { actor.yOffset = floorY - actor.position.y; actor.mesh.visible = true; } },
    spawnAdd: (_i, x, z, yaw) => {
      const actor = animals.spawn(rows.add.kind, x, z, yaw, rows.add.variant);
      actor.herd = -1; floor(actor); Object.assign(actor.mem, rows.add.memory);
      actor.yOffset = dungeon.rows.origin.y - actor.position.y; return actor;
    },
    player: { get position() { return player.position; }, dash: (x, z, seconds) => { player.dash(x, z, seconds); } },
    hurt: (amount, throughWalls = false) => {
      const actor = phased.body(), target = ctx.app.player;
      if (actor === null || target === null || (!throughWalls && !canReach(actor, player.position, ctx.app.physics))) return;
      ctx.app.combat.hit({ source: 'env', sourceTags: [rows.damageTag, 'feel.blow', 'cover.checked'], target, amount,
        point: actor.position, dir: new THREE.Vector3(), cause: { kind: actor.kind, label: actor.label } });
    },
    cut: (i, actor, hit) => {
      const strike = cuts[i] ?? cuts[0];
      return strike !== undefined && contacts.contact(strike, { actor, target: player.position, hit, canReach: () => canReach(actor, player.position, ctx.app.physics) });
    },
    hazard: (id, from, hit, options) => {
      const strike = hazards.get(id); if (strike === undefined) throw new Error('Missing arena hazard strike');
      const noop = (): void => undefined;
      const actor = { position: from, scale: 1, yaw: 0, alive: true, dims: { bodyY: 1.2, bodyRadius: .1 },
        headWorld: (out: THREE.Vector3) => out.copy(from).add(new THREE.Vector3(0, 1.2, 0)), startAttack: noop, cancelAttack: noop, setMotion: noop };
      contacts.contact(strike, { actor, target: player.position, hit, ...options, canReach: () => canReach(actor, player.position, ctx.app.physics) });
    },
    rng: () => ctx.app.rng.stream('ai').next(), feed: line => { play.hud.killFeed(line); },
    views: arenaRoomViews(dungeon, rows.presentation),
    rewardPoint: () => new THREE.Vector3().fromArray(rows.reward),
    respawnPoint: () => ({ pos: new THREE.Vector3().fromArray(rows.respawn), yaw: rows.yaw }),
  });
  return { phased, script: phased.script, body: phased.body, devKill: phased.kill,
    setPresent: on => {
      const body = phased.body(), bodies = body === null ? phased.adds() : [body, ...phased.adds()];
      for (const actor of bodies) {
        const index = animals.animals.indexOf(actor);
        if (on && index === -1 && !actor.hidden) { animals.animals.push(actor); animals.group.add(actor.mesh); }
        if (!on && index !== -1) { animals.animals.splice(index, 1); actor.mesh.removeFromParent(); }
      }
    } };
}

/** The interior encounter borrows native equipment and specimen resources;
 * every authored phase, reward, power and placement is admitted data. */
export const ArenaRoomEncounterSchema = v.object({
  definition: BossEncounterDefinitionSchema,
    reward: v.strictObject({ tier: rowId, name: rowId, flavour: v.string(), prompt: rowId }),
    page: ArenaFightPageSchema, portal: ArenaRoomPortalSchema,
  client: v.strictObject({ light: v.strictObject({ colour: finite, drop: finite }),
      prewarm: v.strictObject({ kind: rowId, variant: rowId }), system: rowId, debugZ: finite }),
  program: ReturnProgramSchema,
});
export class ArenaRoomEncounter {
  readonly spareLight: THREE.PointLight;
  boss: Boss | null = null;
  fight: ReturnType<typeof arenaRoomFight> | null = null;
  ui: BossBar | null = null;
  private portal: ArenaRoomPortal | null = null;
  power: VariantBowPower | null = null;
  private skipKeys = false; private skipTouch = false;
  private readonly rows;
  get inside(): boolean { return this.portal?.inside ?? false; }
  constructor(readonly dungeon: BossArenaRoom, input: unknown,
    private readonly entrance: { readonly x: number; readonly y: number; readonly z: number; readonly facing: number } | null) {
    this.rows = v.parse(ArenaRoomEncounterSchema,input);
    this.spareLight = new THREE.PointLight(this.rows.client.light.colour,0,1,2);
    const at = dungeon.rows.origin; this.spareLight.position.set(at.x,at.y-this.rows.client.light.drop,at.z);
  }
  /** The native scheduler owns slicing; an author cannot supply a build hook. */
  async buildSliced(world: { readonly scene: THREE.Scene; readonly registry: WorldRegistry }): Promise<this> {
    const lazy = memorySaverOn();
    await this.dungeon.buildSliced(true,macrotask); await macrotask();
    world.scene.add(this.dungeon.group,this.spareLight); this.dungeon.register(world.registry);
    if (!lazy) { await macrotask(); await this.dungeon.buildStaticSliced(macrotask); }
    return this;
  }
  /** Concrete entered services supply native effects, never shard callbacks. */
  bind(ctx: ShardContext, kit: MountedLoadout, rewardModel: ModelDef<object>, powerRows: unknown): void {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Arena encounter requires its entered native kit');
    const { game,sky,player } = world, row = this.rows, scope = game.levelScope;
    this.portal = new ArenaRoomPortal({ game,player,animals: play.animals },this.dungeon,row.portal,ReturnProgram.page(this.rows.program,scope),this.entrance);
    try { play.animals.factory.model(row.client.prewarm.kind,row.client.prewarm.variant); } catch (error: unknown) { console.warn('Arena adds did not prewarm',error); }
    const power = this.power = new VariantBowPower(game.scene,game.camera,powerRows);
    const persistence = enteredAdventurePersistence(ctx.scope);
    this.fight = arenaRoomFight(ctx,this.dungeon,row.page);
    const encounter = installBossEncounter({ definition: row.definition,reward: row.reward },() => {
      if (this.fight === null) throw new Error('Missing native arena fight'); return this.fight.script;
    }, { game,player,scope,chunkId: ctx.product.slug,interactables: runtime.interactables,spareLight: this.spareLight,persistence: persistence.bosses,
      reward: { model: () => {
        const object = rewardModel.build(modelContext(sky),rewardModel.defaults,new Rng(0));
        if (!(object instanceof THREE.Object3D)) throw new Error('Arena reward requires a native scene specimen'); return object;
      }, grant: () => { kit.upgradeBow(play.weapons,power); } },
      lockInput: on => { this.portal?.setLocked(on); play.weapons.setEnabled(!on); },
      respawn: (at,yaw) => { player.position.copy(at); player.velocity.set(0,0,0); player.yaw = yaw; player.pitch = 0; kit.refill(); },
      skipHeld: () => this.skipKeys || this.skipTouch || ctx.app.input.held('jump') || ctx.app.input.held('use'),
      toast: text => { play.hud.toast(text); }, feed: text => { play.hud.killFeed(text); }, pickupHum: on => { play.audio.pickupHum(on); },
      music: event => { if (event === 'death' || event === 'pickup') play.music.sting(event); else if (event === 'victory') play.music.sting('chunk'); else play.music.combat(1); },
    });
    this.boss = encounter.boss; this.ui = encounter.ui; this.portal.bind(encounter.boss,encounter.ui,this.fight);
    encounter.fight.reset(0); this.fight.setPresent(false);
    if (encounter.boss.rewardTaken) kit.upgradeBow(play.weapons,power);
    listenPage(scope,'keydown',event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = true; });
    listenPage(scope,'keyup',event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = false; });
    listenPage(scope,'pointerdown',() => { this.skipTouch = true; });
    listenPage(scope,'pointerup',() => { this.skipTouch = false; });
    listenPage(scope,'pointercancel',() => { this.skipTouch = false; });
    game.app.addSystem({ id: row.client.system,phase: 'update',after: ['hud.combat'],before: ['first hints','main.frame'],run: dt => { this.power?.update(dt); } },scope);
  }
  devStartAt(phase: number): void { this.portal?.enter(true,this.rows.client.debugZ); this.boss?.devStartAt(phase); }
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }
  update(dt: number, t: number): void { this.portal?.update(dt,t); }
}

/** Immutable resource ids used by the native arena's admitted private scenes. */
export function arenaRoomGeometryIds(input: unknown): readonly string[] {
  const room = v.parse(ArenaRoomSchema,input);
  return [...new Set([parsePrivateScene(room.view.scene),parsePrivateScene(room.view.static)].flatMap(scene => scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : [])))];
}
/** The native arena constructs its own resource map and owns build slicing. */
export function buildArenaRoomEncounter(ctx: ShardContext, room: unknown, encounter: unknown,
  geometry: readonly (readonly [string,THREE.BufferGeometry])[], entrance: { readonly x: number; readonly y: number; readonly z: number; readonly facing: number } | null): Promise<ArenaRoomEncounter> {
  const world = ctx.game.runtime?.world; if (world === undefined || world === null) throw new Error('Arena build requires its entered world');
  return new ArenaRoomEncounter(new BossArenaRoom(room,new Map(geometry)),encounter,entrance).buildSliced({ scene: world.game.scene,registry: ctx.app.registry });
}

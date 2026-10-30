import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { arenaSealCollider } from './arenaCollision';
import * as THREE from 'three';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { fxMaterial, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { HeightPatch } from '@wildshard/engine/physics/heightPatch';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { createClientScene } from '../plugin/scene';
import { bossFight, type BossViewBinding, type PhasedBossBrain, type PhasedBossFight } from '../plugin/bossPhase';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { ArenaRoomSpeciesControlSchema } from '@wildshard/format/speciesBookRows';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import type { ShardContext } from '../plugin/context';
import type { FixedDraws } from '../models/fixedDraws';
import { bindRuntimeBoss } from '../plugin/headless';
import { installBossEncounter, type Boss } from '../Boss';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { ReturnProgram } from '../population/returnProgram';
import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { BossEncounterDefinitionSchema, type BossEncounterDefinitionRows } from '@wildshard/format/bossEncounter';
import type { ReturnProjectionV2RowsInput, ReturnProjectionV2Rows } from '@wildshard/format/returnProjectionV2';
import type { HeldSlotKit, HeldClaims } from '../loadout/claims';
import { enteredAdventurePersistence } from '../quest/chapterBindings';
import { modelContext, type ModelDef, type ModelContext } from '@wildshard/engine/models/model';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { Rng } from '@wildshard/engine/core/rng';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { gpuOnlyAttributes } from '@wildshard/engine/core/gpuOnly';
import { listenPage } from '@wildshard/engine/input/dom';
import type { ArenaScriptData } from '@wildshard/format/arenaScriptRows';
import type { TargetHit } from '@wildshard/engine/combat/types';
import type { AimTarget } from '@wildshard/engine/player/AimTargets';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { TIER } from '@wildshard/engine/core/tier';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { WeatherReactions } from '../weather/reactions';
import { wildEnv } from '../population/pageGroups';
import { ArenaFireView, ArenaWhirlsView } from './arenaFire';
import { ArenaPortalLaw } from './arenaPortal';
import { ArenaRoomGround } from './arenaGround';
import { arenaBoundary, arenaTie } from './arenaAnswers';
import { OpenArenaFight, readArenaScriptData } from './openArenaFight';
import { ArenaSceneView, CloudBody, type PatrolEncounterView } from './encounterView';
import {entryOwner, lateEntryOwner, presentEntryOwner} from '../shardfile/entryOwners';
import { prepareLentLooks } from '../shardfile/lentLooks';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ArcWeaponPower } from '../weapons/arcPower';
import type { CosmeticFinishLocker } from '../loadout/cosmeticFinishes';
import { pageRidingMount, respawnPageMounted,installArenaBoundary } from '../riding/client';
import type { Mount } from '../riding/mount';
/** ArenaRoomEncounter.contact's reach anchor (scratch) */
const _openW = new THREE.Vector3();
/** Client-only arena attachments and deformable floor, driven by scene and encounter rows. */

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite,finite,finite]);
const planarPoint = v.strictObject({ x: finite, z: finite });
const box = v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite });
const list = <S extends v.GenericSchema>(schema: S) => v.pipe(v.array(schema), v.maxLength(256));
export const ArenaRoomPortalSchema: v.GenericSchema<BoundedArenaPortalInput, BoundedArenaPortal> = v.strictObject({
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
  /** the portal's decisions and fade (renderer-free, CI12) */
  private readonly law: ArenaPortalLaw;
  get inside(): boolean { return this.law.inside; }
  private readonly rows;
  private readonly keep: RegExp;
  private hidden: THREE.Object3D[] = [];
  private calmWas = false;
  private locked = false; private slow = false;
  private boss: Boss | null = null; private ui: BossBar | null = null;
  private fight: ReturnType<typeof arenaRoomFight> | null = null;
  constructor(private readonly world: ArenaRoomPortalWorld, private readonly room: BossArenaRoom, input: unknown,
    program: ReturnProgram, private readonly entrance: { readonly x: number; readonly y: number; readonly z: number; readonly facing: number } | null) {
    this.rows = v.parse(ArenaRoomPortalSchema, input); this.keep = new RegExp(this.rows.keep, 'i');
    this.law = new ArenaPortalLaw(program, this.rows, entrance);
  }
  bind(boss: Boss, ui: BossBar, fight: ReturnType<typeof arenaRoomFight>): void { this.boss = boss; this.ui = ui; this.fight = fight; }
  setLocked(on: boolean): void { this.locked = on; this.move(); }
  private move(): void { this.world.player.moveScale = this.locked ? 0 : this.slow ? this.rows.slow : 1; }
  enter(immediate = false, atZ: number = this.rows.spawn.z): void {
    if (!immediate) { this.ui?.fade(true, this.rows.fade.out); this.law.begin('enter', this.rows.fade.hold); return; }
    const { game, player, animals } = this.world, origin = this.room.rows.origin;
    this.room.world(this.rows.spawn.x, 0, atZ, player.position);
    player.velocity.set(0,0,0); player.yaw = this.rows.spawn.yaw; player.pitch = 0;
    this.law.inside = true; this.room.setVisible(true); this.hidden = [];
    for (const object of game.scene.children) {
      if (!object.visible || object === this.room.group || object === animals.group || object === game.camera || object instanceof THREE.Light || this.keep.test(object.name) || object.type === 'Points'
        || object.position.distanceToSquared(new THREE.Vector3(origin.x,origin.y,origin.z)) < this.rows.near ** 2) continue;
      object.visible = false; this.hidden.push(object);
    }
    this.calmWas = animals.calm; animals.calm = true; this.fight?.setPresent(true); this.boss?.arm();
  }
  leave(teleport: boolean, immediate = false): void {
    if (teleport && !immediate) { this.ui?.fade(true, this.rows.fade.out); this.law.begin('exit', this.rows.fade.hold); return; }
    const { player, animals } = this.world, e = this.entrance;
    if (teleport && e !== null) {
      player.position.set(e.x - Math.sin(e.facing) * this.rows.exitOffset, e.y, e.z - Math.cos(e.facing) * this.rows.exitOffset);
      player.yaw = e.facing; player.pitch = 0; player.velocity.set(0,0,0);
    }
    this.law.inside = false; this.room.setVisible(false);
    for (const object of this.hidden) object.visible = true;
    this.hidden = []; animals.calm = this.calmWas; this.boss?.disarm(); this.fight?.setPresent(false);
    this.slow = false; this.locked = false; this.move();
  }
  update(dt: number, t: number): void {
    const p = this.world.player.position, origin = this.room.rows.origin;
    const step = this.law.step(dt, () => {
      const z = p.z - origin.z, floor = this.room.floorHeightAt(p.x,p.z);
      return { px: p.x, py: p.y, pz: p.z, floor, volume: this.room.inVolume(p), engaged: this.boss?.engaged === true,
        sand: this.room.inChamber(p) ? this.room.sandAt(p.x-origin.x,z) : 0, originY: origin.y, originZ: origin.z };
    });
    if (step.kind === 'fading') return;
    if (step.kind === 'faded') { if (step.pending === 'enter') this.enter(true); else if (step.pending === 'exit') this.leave(true,true); this.ui?.fade(false,this.rows.fade.in); return; }
    if (step.kind === 'decided') {
      if (!this.inside) { if (this.entrance !== null && step.enter) this.enter(); }
      else if (step.exit !== 0) { this.leave(step.exit === 2); return; }
      if (this.inside) { this.slow = step.slow; this.move(); }
    }
    if (!this.inside) return;
    const floor = this.room.floorHeightAt(p.x,p.z);
    if (floor !== undefined && p.y < floor-this.rows.floor.tolerance && p.y > floor-this.rows.floor.depth) { p.y = floor; if (this.world.player.velocity.y < 0) this.world.player.velocity.y = 0; }
    this.boss?.update(dt,t); this.room.update(dt,t);
  }
}
/** Data admission precedes any scene or physics allocation. */
export const ArenaRoomSchema: v.GenericSchema<BoundedArenaRoomInput, BoundedArenaRoom> = v.strictObject({
 id: rowId, name: rowId, file: rowId, sealId: rowId, sealName: rowId,
 origin: v.strictObject({ x: finite, y: finite, z: finite }),
 halfWidth: positive, corridorHalfWidth: positive, corridorEnd: positive,
 doorHalfWidth: positive, doorHeight: positive, sandCells: v.pipe(positive, v.integer(), v.maxValue(256)), sandColor: rowId, triangles: finite,
 cover: v.strictObject({ x: finite, z: finite, wid: positive, len: positive, plinthH: finite, h: finite }), pedestal: planarPoint,
 beams: list(v.strictObject({ a: planarPoint, b: planarPoint, r: positive })),
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
  /** the room's ground: its volumes, floor and sand drifts (renderer-free, CI12) */
  readonly ground: ArenaRoomGround;
  declare private sandMesh: THREE.Mesh;
  private sandLight: Float32Array;
  private readonly sandColor: THREE.Color;
  actor: Animal | null = null;
  private sandPatch: HeightPatch | null = null;
  private staticMaterial: THREE.MeshBasicMaterial | null = null;
  private staticBuilt = false;

  readonly rows: ArenaRoomRows;
  constructor(input: unknown, private readonly geometry: ReadonlyMap<string, THREE.BufferGeometry>) {
    const rows = v.parse(ArenaRoomSchema, input); this.rows = rows;
    this.ground = new ArenaRoomGround(rows);
    this.sandLight = new Float32Array((rows.sandCells + 1) ** 2 * 3);
    this.sandColor = new THREE.Color(rows.sandColor);
    this.sealCollider = { x: this.rows.origin.x, z: this.rows.origin.z + this.rows.halfWidth + 0.1, hw: this.rows.doorHalfWidth + 0.3, hd: 0.25, rot: 0, yTop: this.rows.origin.y - 50, yBottom: this.rows.origin.y - 51 };
  }


  // Local frames.
  world(lx: number, ly: number, lz: number, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 { return out.set(this.rows.origin.x + lx, this.rows.origin.y + ly, this.rows.origin.z + lz); }
  inChamber(p: THREE.Vector3): boolean { return this.ground.inChamber(p); }
  inDromos(p: THREE.Vector3): boolean { return this.ground.inDromos(p); }
  inVolume(p: THREE.Vector3): boolean { return this.ground.inVolume(p); }

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
      colliders: [arenaSealCollider(this.rows)], active: () => this.sealed,
    });
    const ph = app.physics;
    if (ph) this.sandPatch = new HeightPatch(ph, { x: this.rows.origin.x, y: Y0, z: this.rows.origin.z, size: this.rows.halfWidth * 2, res: this.rows.sandCells + 1, material: 'sand', owner: this });
  }

  // Walkable heights.
  private floorAt(x: number, z: number): number | undefined { return this.ground.floorAt(x, z); }

  sandAt(lx: number, lz: number): number { return this.ground.sandAt(lx, lz); }
  addSand(lx: number, lz: number, r: number, dh: number, max = 1.0): void { this.ground.addSand(lx, lz, r, dh, max); }
  clearSand(): void { this.ground.clearSand(); }
  drainSand(dt: number, rate = 0.25): void { this.ground.drainSand(dt, rate); }

  private writeSand(): void {
    const g = this.sandMesh.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
    const N1 = this.rows.sandCells + 1;
    const grid = this.sandPatch ? new Float32Array(N1 * N1) : null;
    let any = false;
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const vertex = j * N1 + i;
      // vertex height = the mean of the (up to) four cells round it
      let s = 0, c = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < this.rows.sandCells && cj < this.rows.sandCells) { s += this.ground.sand[cj * this.rows.sandCells + ci] ?? 0; c++; } }
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
  showHeap(on: boolean, lx: number = this.rows.cover.x + 1.8, lz: number = this.rows.cover.z + 2.6): void { this.heap.visible = on; this.heap.position.set(lx, this.sandAt(lx, lz), lz); }
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
    if (this.ground.pace(dt)) this.writeSand();
  }
}


const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3();
function chamberMesh(value: unknown): value is THREE.Mesh { return value instanceof THREE.Mesh; }
const valueOrZero = (value: number | undefined): number => value ?? 0;


export function arenaRoomViews(d: BossArenaRoom, tuning: { readonly reach: number; readonly ringMax: number; readonly beamRadius: number }): BossViewBinding {
  d.dome.mesh.scale.setScalar(1.75);
  d.dome.mat.uniforms.uAlpha.value = 0.9;
  return {
    'arena.lid.open': (open) => { d.setLid(valueOrZero(open)); },
    'arena.shaft': (i, strength) => { d.setShaft(valueOrZero(i), valueOrZero(strength)); },
    'arena.fx.hide': () => {
      for (const r of d.rings) r.mesh.visible = false;
      for (const s of d.streams) { s.mesh.visible = false; s.tell.visible = false; }
      d.beam.mesh.visible = false; d.beam.line.visible = false; d.dome.mesh.visible = false; d.arc.mesh.visible = false;
    },
    'arena.shield': (on) => { d.dome.mesh.visible = on === 1; },
    'arena.shield.at': (x, y, z) => { d.dome.mesh.position.set(valueOrZero(x) - d.rows.origin.x, valueOrZero(y) - d.rows.origin.y, valueOrZero(z) - d.rows.origin.z); },
    'adds.spot': (i, on) => { d.setNicheStatue(valueOrZero(i), on === 1); },
    'boss.glow': (k) => {
      const body = d.actor;
      if (!body) return;
      const mats = Array.isArray(body.mesh.material) ? body.mesh.material : [body.mesh.material];
      for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.fromArray(d.rows.glowColor); m.emissiveIntensity = valueOrZero(k); }
    },
    'strike.arc': (x, floorY, z, yaw) => {
      const arc = d.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(valueOrZero(x) - d.rows.origin.x, valueOrZero(floorY) - d.rows.origin.y + 0.04, valueOrZero(z) - d.rows.origin.z);
      arc.mesh.rotation.y = valueOrZero(yaw) - Math.PI / 2;
      arc.mesh.scale.setScalar(tuning.reach * 1.15);
    },
    'strike.arc.off': () => { d.arc.mesh.visible = false; },
    'hazard.ring': (i, cx, cz, r) => {
      const vis = d.rings[valueOrZero(i)];
      if (!vis) return;
      vis.mesh.visible = true;
      vis.mesh.position.set(valueOrZero(cx) - d.rows.origin.x, 0.06, valueOrZero(cz) - d.rows.origin.z);
      vis.mesh.scale.setScalar(valueOrZero(r));
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(valueOrZero(r), tuning.ringMax * 0.7, tuning.ringMax));
    },
    'hazard.ring.off': (i) => { const vis = d.rings[valueOrZero(i)]; if (vis) vis.mesh.visible = false; },
    'hazard.ring.tell': (x, floorS, z, charge) => {
      const ring = d.rings[1];
      if (!ring) return;
      ring.mesh.visible = true;
      ring.mesh.position.set(valueOrZero(x) - d.rows.origin.x, valueOrZero(floorS) - d.rows.origin.y + 0.05, valueOrZero(z) - d.rows.origin.z);
      ring.mesh.scale.setScalar(2.4 - 1.6 * valueOrZero(charge));
      ring.mat.uniforms.uAlpha.value = 0.4 + 0.6 * valueOrZero(charge);
    },
    'hazard.pour.off': (i) => { const vis = d.streams[valueOrZero(i)]; if (vis) { vis.mesh.visible = false; vis.tell.visible = false; } },
    'hazard.pour.tell': (i, t) => {
      const vis = d.streams[valueOrZero(i)];
      if (!vis) return;
      vis.tell.visible = true; vis.tellMat.uniforms.uAlpha.value = Math.min(1, valueOrZero(t) * 2) * 0.9;
      vis.tell.position.y = d.sandAt(vis.x, vis.z) + 0.05;
    },
    'hazard.pour.fall': (i, k) => {
      const vis = d.streams[valueOrZero(i)];
      if (!vis) return;
      vis.tell.visible = false;
      vis.mesh.visible = true;
      vis.mat.uniforms.uAlpha.value = valueOrZero(k);
    },
    'hazard.sweep': (cx, cz, angle, dir, k) => {
      const b = d.beam, R = tuning.beamRadius, a = valueOrZero(angle);
      const top = _w.fromArray(d.rows.beamTop);
      _v.set(valueOrZero(cx), 0, valueOrZero(cz));
      const len = _v.distanceTo(top);
      b.mesh.visible = true;
      b.mesh.position.copy(_v);
      b.mesh.scale.set(1, len, 1);
      b.mesh.quaternion.setFromUnitVectors(_h.set(0, 1, 0), top.sub(_v).normalize());
      b.mat.uniforms.uAlpha.value = 0.7 * valueOrZero(k);
      b.line.visible = true;
      b.line.rotation.y = valueOrZero(dir) > 0 ? a - Math.PI / 2 : a - Math.PI / 2 - Math.PI * 0.6;
      b.line.scale.set(R / 6, 1, R * 0.85 / 6);
      b.line.position.set(0, 0.05, -0.5);
      b.lineMat.uniforms.uAlpha.value = 0.55 * valueOrZero(k);
    },
    'hazard.sweep.off': () => { d.beam.mesh.visible = false; d.beam.line.visible = false; },
    'victory.heap': (on, x, z) => {
      if (on !== 1) { d.showHeap(false); return; }
      d.showHeap(true, valueOrZero(x) - d.rows.origin.x, valueOrZero(z) - d.rows.origin.z);
    },
  };
}

/** Built-in body binding for row-driven arena fights. Species adapters observe
 * the shared fight's brain rather than installing a shard decision owner. */
const arenaBrains = new WeakMap<Animal, PhasedBossBrain<Animal>>();
export function arenaRoomBrain(actor: Animal): PhasedBossBrain<Animal> | undefined { return arenaBrains.get(actor); }

/** Row-selected controls over the original arena brain; no other fight/body
 * owner is installed. Nullish defaults retain authored order and lazy height. */
export function arenaRoomSpeciesControl(input:unknown):Pick<SpeciesDef,'think'|'act'|'damageMul'>{
  const rows=v.parse(ArenaRoomSpeciesControlSchema,input),initial=rows.initialize;
  if(new Set(initial.defaults.map(row=>row.field)).size!==initial.defaults.length
    ||initial.defaults.some(row=>row.field===initial.flag))throw new Error('Invalid arena species initialization');
  return{
    think:(actor,context)=>{
      const memory=actor.mem;
      if(memory[initial.flag]!==1){memory[initial.flag]=1;
        for(const row of initial.defaults)memory[row.field]??=row.source==='height'?context.heightAt(actor.position.x,actor.position.z):row.value;
      }
      arenaRoomBrain(actor)?.think(actor,context);
    },
    act:(actor,context)=>{arenaRoomBrain(actor)?.act(actor,context);},
    damageMul:(actor,point)=>arenaRoomBrain(actor)?.damageMul(actor,point)??1,
  };
}

export const ArenaFightPageSchema: v.GenericSchema<BoundedArenaFightInput, BoundedArenaFight> = v.strictObject({
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
export const ArenaRoomEncounterSchema: v.GenericSchema<BoundedArenaEncounterInput, BoundedArenaEncounter> = v.object({
  definition: BossEncounterDefinitionSchema,
    reward: v.strictObject({ tier: rowId, name: rowId, flavour: v.string(), prompt: rowId }),
    page: ArenaFightPageSchema, portal: ArenaRoomPortalSchema,
  client: v.strictObject({ light: v.strictObject({ colour: finite, drop: finite }),
      prewarm: v.strictObject({ kind: rowId, variant: rowId }), system: rowId, debugZ: finite }),
  program: ReturnProgramSchema,
});
/** Read schema-checked named products; no validator is imported into play. */
/** Native cloud resources are identical for an entered fight and its specimen. */
function arenaScriptCloud(scene: THREE.Scene, state: Readonly<Record<string,number>>, data: ArenaScriptData): CloudBody {
  const g = data.geometry;
  return new CloudBody(scene,{ ...g.body,geometry: { ...g.body.geometry,eyes: g.eyes },poses: g.poses,
    puffs: { ...g.body.puffs,rows: g[TIER].puffs } },state,new Map([['place',{ ...data.arena.body,ground: heightAt(data.arena.ground.x,data.arena.ground.z) }]]));
}
export interface OpenArenaWorld { readonly game: Game; readonly player: Player; readonly weather: WeatherReactions; readonly air: WeatherContinuation; readonly tieSpot: THREE.Vector3 | null }

/**
 * G808: the arena's spare light (the reward's slot, dark until the victory) is a LightPool light of the scene it lights.
 * A raw scene light counted in every lit program's key: two arenas in a grid region raised the page from 5 to 7 point
 * lights, so a crossing into Nalati linked 83 of its 142 programs a second time, once per light count. A region's pool
 * is mirrored onto the page's reserved lights (regionalWorld.ts), so the page count never moves; a solo page's pool is
 * fixed after its first render. Same colour, reach, decay and place; dark, so nothing it lights changes.
 */
function pooledSpare(scene:THREE.Scene,colour:THREE.ColorRepresentation,at:THREE.Vector3):THREE.PointLight{
  const light=LightPool.for(scene).acquire(colour,0,1,2);light.position.copy(at);return light;
}

export class ArenaRoomEncounter {
  /** the reward's light slot, dark until the victory (Boss.ts): a LightPool light once the arena is in its scene */
  spareLight:THREE.PointLight;
  private readonly room:BossArenaRoom|null;
  get dungeon():BossArenaRoom{if(this.room===null)throw new Error('Open arena has no room');return this.room;}
  boss:Boss|null=null;ui:BossBar|null=null;
  fight:ReturnType<typeof arenaRoomFight>|null=null;
  power:ReturnType<HeldSlotKit['bowPower']>|ArcWeaponPower|null=null;
  riders:PatrolEncounterView|null=null;mount:Mount|null=null;
  private readonly rows:v.InferOutput<typeof ArenaRoomEncounterSchema>|null;
  private readonly openRows:ArenaScriptData|null;
  private readonly openWorld:OpenArenaWorld|null;
  private readonly projection:OpenArenaFight|null;
  private readonly prompt:Interactable|null;
  private readonly contacts=new Map<string,StrikeSpec>();private readonly strikes=new StrikeRunner();
  private portal:ArenaRoomPortal|null=null;private context:ShardContext|null=null;private kit:HeldSlotKit|null=null;
  private skipKeys=false;private skipTouch=false;private hurtWhy='';private hurtT=0;
  private readonly entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number}|null;
  get world():OpenArenaWorld{if(this.openWorld===null)throw new Error('Not an open arena');return this.openWorld;}
  get data():ArenaScriptData{if(this.openRows===null)throw new Error('Not an open arena');return this.openRows;}
  get openFight():OpenArenaFight{if(this.projection===null)throw new Error('Not an open arena');return this.projection;}
  get inside():boolean{return this.portal?.inside??false;}
  get tied():boolean{return this.projection?.tied??false;}
  get player():Player{return this.world.player;}
  get engaged():boolean{return this.boss?.engaged===true;}
  constructor(dungeon:BossArenaRoom,input:unknown,entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number}|null);
  constructor(open:{readonly kind:'open';readonly world:OpenArenaWorld;readonly rows:ArenaScriptData});
  constructor(source:BossArenaRoom|{readonly kind:'open';readonly world:OpenArenaWorld;readonly rows:ArenaScriptData},input?:unknown,entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number}|null=null){
    this.entrance=entrance;
    if(source instanceof BossArenaRoom){
      this.room=source;this.rows=v.parse(ArenaRoomEncounterSchema,input);this.openRows=null;this.openWorld=null;this.projection=null;this.prompt=null;
      this.spareLight=new THREE.PointLight(this.rows.client.light.colour,0,1,2);const at=source.rows.origin;this.spareLight.position.set(at.x,at.y-this.rows.client.light.drop,at.z);
    }else{
      this.room=null;this.rows=null;this.openWorld=source.world;this.openRows=source.rows;
      for(const [name,row]of Object.entries(source.rows.contacts))this.contacts.set(name,strikeFromData(row));
      // the fight's numbers live in openArenaFight.ts (the Node simulation fights the same); the page lends it its world and
      // looks, the world's parts read when the fight uses them (the weather owner publishes after the arena is built)
      const world=source.world,rows=source.rows,scene=world.game.scene;
      const projection=this.projection=new OpenArenaFight({scope:world.game.levelScope,get weather(){return world.weather;},get tieSpot(){return world.tieSpot;},ai:()=>app.rng.stream('ai'),
        fog:()=>world.game.scene.fog,get camera(){return world.game.camera;},wild:wildEnv,phone:TIER==='phone'},this,rows,{
        body:pose=>arenaScriptCloud(scene,pose,rows),arena:()=>new ArenaSceneView(scene,rows.geometry.arena),
        whirls:(arena,windLaw,author,scope)=>new ArenaWhirlsView(rows.whirls,windLaw,[arena.mesh('funnel0'),arena.mesh('funnel1'),arena.mesh('funnel2')],arena.instances('debris'),author,scope),
        whirlsPreflight:(whirls,bindings)=>{ArenaWhirlsView.preflight(whirls,bindings);},
        fire:()=>new ArenaFireView(scene,rows.arenaFire,(TIER==='phone'?rows.geometry.phone:rows.geometry.desktop).flames)});
      this.spareLight=pooledSpare(source.world.game.scene,source.rows.view.light.colour,new THREE.Vector3(source.rows.arena.body.x,source.rows.view.light.y,source.rows.arena.body.z));
      const spot=projection.cairnSpot();this.prompt={position:new THREE.Vector3(spot.x,spot.y+source.rows.view.promptLift,spot.z),radius:0,label:source.rows.lines.tie,onInteract:()=>{this.tie();}};
    }
  }
  async buildSliced(world:{readonly scene:THREE.Scene;readonly registry:WorldRegistry}):Promise<this>{
    const dungeon=this.room;if(dungeon===null)throw new Error('Open arena is already constructed');
    await dungeon.buildSliced(true,macrotask);await macrotask();world.scene.add(dungeon.group);this.spareLight=pooledSpare(world.scene,this.spareLight.color,this.spareLight.position);dungeon.register(world.registry);
    return this;
  }
  riderOwner():PatrolEncounterView|null{return this.riders;}
  mounted():boolean{return this.mount?.mounted===true;}
  throwRider():void{if(this.mount?.mounted===true)this.openFight.dismount(this.mount,this.context?.scope??this.openFight.scope);}
  horseSteed(amount:number):void{if(this.mount!==null)this.mount.steed=Math.max(0,this.mount.steed+amount);}
  toast(message:string):void{this.context?.game.runtime?.play?.hud.toast(message);}
  feed(message:string):void{this.context?.game.runtime?.play?.hud.killFeed(message);}
  hurt(amount:number,why:string):void{
    const ctx=this.context,target=ctx?.app.player;if(ctx===null||ctx.scope.disposed||target===undefined||target===null)return;
    const say=why!==this.hurtWhy||this.hurtT<=0;if(say){this.hurtWhy=why;this.hurtT=this.data.view.notice;}
    ctx.app.combat.hit({source:'env',sourceTags:[`boss.${this.data.record.kind}`,'feel.jolt','cover.checked'],target,amount,point:this.player.position.clone(),dir:new THREE.Vector3(),cause:{kind:this.data.record.kind,label:this.data.definition.name},toast:say?why:''});
  }
  contact(name:string,origin:THREE.Vector3,amount:number,why:string):boolean{
    const row=this.contacts.get(name),target=this.player.position;
    if(!this.data.whole.includes(name)){
      if(row===undefined)throw new Error('Missing arena contact');
      if(!this.strikes.contains(row,{actor:{position:origin,scale:1,yaw:0},target}))return false;
      if(!row.tags.includes('cover.exempt')){
        const anchor={position:origin,scale:1,alive:true,dims:{bodyY:1.2,bodyRadius:.1},headWorld:(out:THREE.Vector3)=>out.copy(origin).add(_openW.set(0,1.2,0))};
        if(!canReach(anchor,target,this.world.game.app.physics))return false;
      }
    }this.hurt(amount,why);return true;
  }
  bind(ctx:ShardContext,kit:HeldSlotKit,rewardModel:ModelDef<object>,equipment?:{readonly arsenal:HeldClaims;readonly locker:CosmeticFinishLocker}):void{
    const runtime=ctx.game.runtime,play=runtime?.play,nativeWorld=runtime?.world,world=this.openWorld??nativeWorld,open=this.openRows,room=this.rows;
    if(nativeWorld===undefined||nativeWorld===null||runtime===undefined||play===undefined||play===null||world===undefined||world===null||open!==null&&equipment===undefined)throw new Error('Arena encounter needs its actual entered owners');
    const health=ctx.app.player;installEnteredRuntimeService(ctx,entered=>{health?.checkpoint(entered,()=>this.onPlayerDeath(),()=>ctx.app.player===health);});
    const {game,player}=world,scope=open===null?game.levelScope:ctx.scope;this.context=ctx;this.kit=kit;
    let blade:ArcWeaponPower|null=null,bow:ReturnType<HeldSlotKit['bowPower']>|null=null;
    if(open===null){
      if(room===null||this.room===null)throw new Error('Missing closed arena rows');
      this.portal=new ArenaRoomPortal({game,player,animals:play.animals},this.dungeon,room.portal,ReturnProgram.page(room.program,game.levelScope),this.entrance);
      try{play.animals.factory.model(room.client.prewarm.kind,room.client.prewarm.variant);}catch(error:unknown){console.warn('Arena adds did not prewarm',error);}
      this.power=bow=kit.bowPower('bow-reward');this.fight=arenaRoomFight(ctx,this.dungeon,room.page);
    }else{
      if(equipment===undefined)throw new Error('Missing open arena equipment');this.mount=pageRidingMount(ctx);
      this.power=blade=new(equipment.arsenal.blade('blade').Power)({scene:game.scene,player,camera:game.camera,animals:play.animals,weather:this.world.weather,scope:ctx.scope});
    }
    const row=open??room;if(row===null)throw new Error('Missing arena rows');
    const saved=enteredAdventurePersistence(ctx.scope),script=this.projection??this.fight?.script;if(script===undefined)throw new Error('Missing arena script');
    const encounter=installBossEncounter({definition:row.definition,reward:row.reward},()=>script,{game,player,spareLight:this.spareLight,scope,chunkId:ctx.product.slug,interactables:runtime.interactables,persistence:saved.bosses,
      reward:{model:()=>{const object=rewardModel.build(modelContext(open===null?nativeWorld.sky:game.sky),rewardModel.defaults,new Rng(0));if(!(object instanceof THREE.Object3D))throw new Error('Arena reward requires a native scene specimen');return object;},grant:()=>{
        if(open===null)kit.upgradeBow('bow-reward',play.weapons);else{if(blade===null||equipment===undefined)throw new Error('Missing arena reward equipment');kit.upgradeBlade('blade-reward',play.weapons,blade);equipment.locker.own(open.skin.id);play.hud.toast(open.skin.toast);}
      }},
      lockInput:on=>{if(open===null){this.portal?.setLocked(on);play.weapons.setEnabled(!on);}else{play.weapons.setEnabled(!on);player.moveScale=on?0:1;}},
      respawn:(at,yaw)=>{if(open===null){player.position.copy(at);player.velocity.set(0,0,0);player.yaw=yaw;player.pitch=0;}else respawnPageMounted(ctx,at,yaw,open.view.respawn);kit.refill();},
      skipHeld:()=>this.skipKeys||this.skipTouch||ctx.app.input.held('jump')||ctx.app.input.held('use'),toast:text=>{play.hud.toast(text);},feed:text=>{play.hud.killFeed(text);},pickupHum:on=>{play.audio.pickupHum(on);},
      music:event=>{if(event==='death'||event==='pickup')play.music.sting(event);else if(event==='victory')play.music.sting('chunk');else play.music.combat(1);}});
    this.boss=encounter.boss;this.ui=encounter.ui;
    if(open===null){
      if(this.fight===null||this.portal===null||room===null)throw new Error('Missing room fight');this.portal.bind(encounter.boss,encounter.ui,this.fight);encounter.fight.reset(0);this.fight.setPresent(false);
      if(encounter.boss.rewardTaken)kit.upgradeBow('bow-reward',play.weapons);
    }else{
      if(this.prompt===null||this.projection===null)throw new Error('Missing open arena projection');runtime.interactables.push(this.prompt);
      if(encounter.boss.rewardTaken){if(blade===null)throw new Error('Missing open arena power');kit.upgradeBlade('blade-reward',play.weapons,blade);}
      installArenaBoundary(ctx.scope,this.projection.boundary);this.projection.lendView(ctx.scope);
    }
    listenPage(scope,'keydown',event=>{if(event instanceof KeyboardEvent&&event.code==='Enter')this.skipKeys=true;});listenPage(scope,'keyup',event=>{if(event instanceof KeyboardEvent&&event.code==='Enter')this.skipKeys=false;});
    listenPage(scope,'pointerdown',()=>{this.skipTouch=true;});listenPage(scope,'pointerup',()=>{this.skipTouch=false;});listenPage(scope,'pointercancel',()=>{this.skipTouch=false;});
    if(open!==null)ctx.debug.expose(open.view.debug,this);
    if(open===null&&room!==null)game.app.addSystem({id:room.client.system,phase:'update',after:['hud.combat'],before:['first hints','main.frame'],run:dt=>{bow?.update(dt);}},scope);
  }
  private tie():void{
    const boss=this.boss;if(boss===null)return;const fight=this.openFight;
    // the tie answer's order is arenaTie's (renderer-free, CI12)
    arenaTie(fight.life,{engaged:this.engaged,victory:boss.state==='victory',hit:boss.reward!==null,mounted:this.mounted(),storm:this.world.weather.stormActive},this.data.tieLines,
      {boss,fight,toast:line=>{this.toast(line);}});
  }
  devStartAt(phase:number):void{
    if(this.openRows===null){this.portal?.enter(true,this.rows?.client.debugZ);this.boss?.devStartAt(phase);return;}
    this.world.air.force(this.data.weather.storm,.1);const at=this.openFight.respawnPoint(),ctx=this.context;if(ctx!==null)respawnPageMounted(ctx,at.pos,at.yaw,this.data.view.respawn);this.openFight.tied=true;this.boss?.devStartAt(phase);
  }
  onPlayerDeath():boolean{return this.boss?.onPlayerDeath()??false;}
  update(dt:number,t:number):void{
    if(this.openRows===null){this.portal?.update(dt,t);return;}
    this.power?.update(dt,t);this.hurtT-=dt;const boss=this.boss;if(boss===null||this.context===null||this.kit===null)return;
    const fight=this.openFight;if(boss.state!=='dormant'||fight.body.visible)boss.update(dt,t);else fight.update(dt,t,false);
    const answer=fight.takeBoundary();if(answer===null)return;const prompt=this.prompt;if(prompt===null)throw new Error('Missing open arena prompt');
    // the boundary answer's order is arenaBoundary's (renderer-free, CI12)
    const p=this.player.position,scope=this.context.scope;
    arenaBoundary(answer,this.data.lines,this.data.record,{boss,fight,prompt,player:p,toast:line=>{this.toast(line);},
      wall:()=>{this.contact('wall',p,this.data.view.wallDamage,this.data.lines.wall);},clear:()=>{this.world.air.force(this.data.weather.clearing);},
      get persistence(){return enteredAdventurePersistence(scope);}});
  }
  target(origin:THREE.Vector3,dir:THREE.Vector3,max:number,hit:TargetHit|null):TargetHit|null{return this.openFight.target(origin,dir,max,hit);}
  lockTarget():AimTarget|null{return this.openFight.lockTarget();}
}

/** Immutable resource ids used by the native arena's admitted private scenes. */
function arenaRoomGeometryIds(input: unknown): readonly string[] {
  const room = v.parse(ArenaRoomSchema,input);
  return [...new Set([parsePrivateScene(room.view.scene),parsePrivateScene(room.view.static)].flatMap(scene => scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : [])))];
}
/** The native arena constructs its own resource map from the world's loaded fixed draws (every admitted geometry id is
 *  found before any copy is made) and owns build slicing. */
export function buildArenaRoomEncounter(input:{readonly kind:'open';readonly ports:Parameters<typeof buildOpenArenaEncounter>[0];readonly rows:Parameters<typeof buildOpenArenaEncounter>[1]}):Promise<ArenaRoomEncounter>;
export function buildArenaRoomEncounter(ctx: ShardContext, room: unknown, encounter: unknown,
  draws: Pick<FixedDraws, 'ready' | 'handle'>, entrance: { readonly x: number; readonly y: number; readonly z: number; readonly facing: number } | null):Promise<ArenaRoomEncounter>;
export function buildArenaRoomEncounter(ctx:ShardContext|{readonly kind:'open';readonly ports:Parameters<typeof buildOpenArenaEncounter>[0];readonly rows:Parameters<typeof buildOpenArenaEncounter>[1]},room?:unknown,encounter?:unknown,
  draws?:Pick<FixedDraws,'ready'|'handle'>,entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number}|null=null):Promise<ArenaRoomEncounter>{
  if('kind' in ctx)return buildOpenArenaEncounter(ctx.ports,ctx.rows);
  const world = ctx.game.runtime?.world; if (world === undefined || world === null) throw new Error('Arena build requires its entered world');
  if (draws===undefined||!draws.ready) throw new Error('Arena build requires its loaded fixed draws');
  const handles = arenaRoomGeometryIds(room).map(id => [id, draws.handle(id)] as const);
  const geometry = new Map(handles.map(([id, handle]) => [id, handle.copy()]));
  const dungeon = new BossArenaRoom(room,geometry);
  const sand = parsePrivateScene(dungeon.rows.view.scene).nodes.find(node => node.id === dungeon.rows.sand);
  if (sand?.kind !== 'mesh') throw new Error('Missing chamber sand geometry');
  // These are private draw copies, never the rebuild templates. Sand rewrites
  // positions/colours; the other shapes only move or change material uniforms.
  for (const [id, shape] of geometry) if (id !== sand.geometry) gpuOnlyAttributes(shape, 'arena.room');
  return new ArenaRoomEncounter(dungeon,encounter,entrance).buildSliced({ scene: world.game.scene,registry: ctx.app.registry });
}

async function buildOpenArenaEncounter(ports: {readonly scope:Scope;readonly weatherContext?:ShardContext;readonly context:Pick<ModelContext,'sky'>}, stage:{readonly id:string;readonly files:{readonly fight:string;readonly geometry:string};readonly weather:string;readonly anchor:string}):Promise<ArenaRoomEncounter> {
  const scope = ports.scope, ctx = ports.weatherContext, runtime = ctx?.game.runtime, world = runtime?.world;
  if (ctx === undefined || runtime === undefined || world === undefined || world === null || ctx.scope !== scope)
    throw new Error('World arena needs its original construction context');
  const product = ctx.product, game = world.game, player = world.player, sky = world.sky, root = game.scene, owner = game.levelScope;
  const read = product.json, answer = ctx.answer, point = entryOwner(scope, 'world-point', stage.anchor);
  const x = point?.x, y = point?.y, z = point?.z, weatherLoan = lateEntryOwner(scope, 'world-weather', stage.weather);
  let weather: { readonly rig: ReturnType<typeof weatherLoan>; readonly storm: WeatherReactions; readonly air: WeatherContinuation } | undefined;
  const live = (): void => {
    if (scope.disposed || scope.disposing || owner.disposed || owner.disposing) throw new Error('World arena owner left');
    if (ports.weatherContext !== ctx || ctx.scope !== scope || ctx.product !== product || product.json !== read || ctx.answer !== answer
      || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game || world.player !== player || world.sky !== sky
      || game.scene !== root || game.levelScope !== owner || ports.context.sky !== sky
      || entryOwner(scope, 'world-point', stage.anchor) !== point
      || point?.x !== x || point?.y !== y || point?.z !== z) throw new Error('World arena owners changed');
  };
  const weatherOwner = (): NonNullable<typeof weather> => {
    live();
    const rig = weatherLoan(), storm = rig.storm, air = rig.weather;
    if (weather !== undefined && (weather.rig !== rig || weather.storm !== storm || weather.air !== air))
      throw new Error('World arena owners changed');
    if (storm === null) throw new Error('World arena needs its original storm');
    weather ??= { rig, storm, air };
    return weather;
  };
  const constructionLive = (): void => {
    live();
    if (weather !== undefined || presentEntryOwner(scope, 'world-weather', stage.weather) !== null) weatherOwner();
  };
  constructionLive();
  const data = await readArenaScriptData(product, stage.files); constructionLive();
  for (const program of [data.programs.attack, data.programs.wind]) {
    if (ReturnProgram.prepareMemory(program, owner)) { await buildYield(owner); constructionLive(); }
  }
  // G639: the fight's programmes admit in their own build slices, into the same level-scope cache the encounter's
  // constructor reads (one Nalati world-hook frame held the read, both admissions and the views: 136 ms at phone 4x)
  for (const program of [data.programs.attack, data.programs.wind]) { await buildYield(owner); constructionLive(); ReturnProgram.page(program, owner); }
  await buildYield(owner); constructionLive();
  // its fire and cloud looks compile a build step each first: inside the constructor they shared one frame (~50 ms of a
  // 133 ms Nalati world-hook frame at phone 4x)
  await prepareLentLooks([data.arenaFire.flameLook, data.arenaFire.smokeLook, data.geometry.body.puffs.look]); constructionLive();
  const encounter = new ArenaRoomEncounter({kind:'open',world:{game,player,
    get weather() { return weatherOwner().storm; }, get air() { return weatherOwner().air; },tieSpot:point},rows:data}); constructionLive();
  ctx.answer('weather.storm-hold', held => Math.max(held, Number(encounter.engaged))); constructionLive();
  return encounter;
}

/** Complete admitted data, independent of validator implementation metadata. */
type BoundedArenaPortalInput = BoundedArenaPortal;
interface BoundedArenaPortalFields {
    signal: string;
    spawn: {
        x: number;
        z: number;
        yaw: number;
    };
    end: number;
    exitOffset: number;
    slow: number;
    fade: {
        out: number;
        hold: number;
        in: number;
    };
    keep: string;
    near: number;
    floor: {
        tolerance: number;
        depth: number;
    };
}
type BoundedArenaPortal = { [Key in keyof BoundedArenaPortalFields]: BoundedArenaPortalFields[Key] };
type BoundedArenaRoomInput = BoundedArenaRoom;
interface BoundedArenaRoomFields {
    id: string;
    name: string;
    file: string;
    sealId: string;
    sealName: string;
    origin: {
        x: number;
        y: number;
        z: number;
    };
    halfWidth: number;
    corridorHalfWidth: number;
    corridorEnd: number;
    doorHalfWidth: number;
    doorHeight: number;
    sandCells: number;
    sandColor: string;
    triangles: number;
    cover: {
        x: number;
        z: number;
        wid: number;
        len: number;
        plinthH: number;
        h: number;
    };
    pedestal: {
        x: number;
        z: number;
    };
    beams: {
        a: {
            x: number;
            z: number;
        };
        b: {
            x: number;
            z: number;
        };
        r: number;
    }[];
    collision: {
        boxes: {
            x: number;
            z: number;
            hw: number;
            hd: number;
            rot: number;
            yTop: number;
            yBottom: number;
        }[];
        descs: unknown[];
    };
    glowColor: [
        number,
        number,
        number
    ];
    beamTop: [
        number,
        number,
        number
    ];
    coverMotion: {
        closed: [
            number,
            number,
            number
        ];
        slide: [
            number,
            number,
            number
        ];
        tip: [
            number,
            number,
            number
        ];
        slideRotation: [
            number,
            number,
            number
        ];
        tipRotation: [
            number,
            number,
            number
        ];
    };
    markers: string[];
    shafts: {
        id: string;
        base: number;
    }[];
    streams: {
        id: string;
        tell: string;
        x: number;
        z: number;
    }[];
    lid: string;
    heap: string;
    sand: string;
    flames: string;
    rings: string[];
    beam: string;
    line: string;
    dome: string;
    arc: string;
    seal: string;
    view: {
        scene: unknown;
        static: unknown;
        fx: {
            id: string;
            mode: number;
            color: [
                number,
                number,
                number
            ];
            alpha: number;
            additive: boolean;
            depthTest: boolean;
            p: [
                number,
                number,
                number,
                number
            ];
        }[];
    };
}
type BoundedArenaRoom = { [Key in keyof BoundedArenaRoomFields]: BoundedArenaRoomFields[Key] };
type BoundedArenaFightInput = BoundedArenaFight;
interface BoundedArenaFightFields {
    profile: unknown;
    body: string;
    identity: "runtime" | "declared";
    add: {
        kind: string;
        variant: string;
        memory: Record<string, number>;
    };
    damageTag: `${string}.${string}`;
    maxZ: number;
    reward: [
        number,
        number,
        number
    ];
    respawn: [
        number,
        number,
        number
    ];
    yaw: number;
    presentation: {
        reach: number;
        ringMax: number;
        beamRadius: number;
    };
    cuts: {
        id: string;
        shape: {
            kind: "arc";
            radius: number;
            halfAngle: number;
            yawOffset?: number;
        } | {
            kind: "lane";
            length: number;
            width: number;
        } | {
            kind: "ring";
            inner: number;
            outer: number;
        } | {
            kind: "wedge";
            length: number;
            halfAngle: number;
        } | {
            kind: "point";
            radius: number;
            exclusive?: boolean;
        } | {
            kind: "sphere";
            radius: number;
        };
        windup: number;
        active: number;
        recover: number;
        cooldown: number;
        range: number | null;
        damage: number;
        tags: `${string}.${string}`[];
        weight: {
            kind: "constant";
            value: number;
        } | {
            kind: "horizontal-distance";
            above: number;
            far: number;
            near: number;
        };
        units?: "world" | "actor";
        alternatives?: ({
            kind: "arc";
            radius: number;
            halfAngle: number;
            yawOffset?: number;
        } | {
            kind: "lane";
            length: number;
            width: number;
        } | {
            kind: "ring";
            inner: number;
            outer: number;
        } | {
            kind: "wedge";
            length: number;
            halfAngle: number;
        } | {
            kind: "point";
            radius: number;
            exclusive?: boolean;
        } | {
            kind: "sphere";
            radius: number;
        })[];
        motion?: {
            speed?: number;
            delay?: number;
            track?: "none" | "lead" | "follow";
            overshoot?: number;
            skid?: number;
        };
        eligibility?: {
            maxDy?: number;
            jumpDodges?: boolean;
        };
    }[];
    hazards: Record<string, {
            id: string;
            shape: {
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            };
            windup: number;
            active: number;
            recover: number;
            cooldown: number;
            range: number | null;
            damage: number;
            tags: `${string}.${string}`[];
            weight: {
                kind: "constant";
                value: number;
            } | {
                kind: "horizontal-distance";
                above: number;
                far: number;
                near: number;
            };
            units?: "world" | "actor";
            alternatives?: ({
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            })[];
            motion?: {
                speed?: number;
                delay?: number;
                track?: "none" | "lead" | "follow";
                overshoot?: number;
                skid?: number;
            };
            eligibility?: {
                maxDy?: number;
                jumpDodges?: boolean;
            };
        }>;
}
type BoundedArenaFight = { [Key in keyof BoundedArenaFightFields]: BoundedArenaFightFields[Key] };
interface BoundedArenaEncounterInputFields {
    definition: BossEncounterDefinitionRows;
    reward: {
        tier: string;
        name: string;
        flavour: string;
        prompt: string;
    };
    page: {
        profile: unknown;
        body: string;
        identity: "runtime" | "declared";
        add: {
            kind: string;
            variant: string;
            memory: Record<string, number>;
        };
        damageTag: `${string}.${string}`;
        maxZ: number;
        reward: [
            number,
            number,
            number
        ];
        respawn: [
            number,
            number,
            number
        ];
        yaw: number;
        presentation: {
            reach: number;
            ringMax: number;
            beamRadius: number;
        };
        cuts: {
            id: string;
            shape: {
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            };
            windup: number;
            active: number;
            recover: number;
            cooldown: number;
            range: number | null;
            damage: number;
            tags: `${string}.${string}`[];
            weight: {
                kind: "constant";
                value: number;
            } | {
                kind: "horizontal-distance";
                above: number;
                far: number;
                near: number;
            };
            units?: "world" | "actor";
            alternatives?: ({
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            })[];
            motion?: {
                speed?: number;
                delay?: number;
                track?: "none" | "lead" | "follow";
                overshoot?: number;
                skid?: number;
            };
            eligibility?: {
                maxDy?: number;
                jumpDodges?: boolean;
            };
        }[];
        hazards: Record<string, {
                id: string;
                shape: {
                    kind: "arc";
                    radius: number;
                    halfAngle: number;
                    yawOffset?: number;
                } | {
                    kind: "lane";
                    length: number;
                    width: number;
                } | {
                    kind: "ring";
                    inner: number;
                    outer: number;
                } | {
                    kind: "wedge";
                    length: number;
                    halfAngle: number;
                } | {
                    kind: "point";
                    radius: number;
                    exclusive?: boolean;
                } | {
                    kind: "sphere";
                    radius: number;
                };
                windup: number;
                active: number;
                recover: number;
                cooldown: number;
                range: number | null;
                damage: number;
                tags: `${string}.${string}`[];
                weight: {
                    kind: "constant";
                    value: number;
                } | {
                    kind: "horizontal-distance";
                    above: number;
                    far: number;
                    near: number;
                };
                units?: "world" | "actor";
                alternatives?: ({
                    kind: "arc";
                    radius: number;
                    halfAngle: number;
                    yawOffset?: number;
                } | {
                    kind: "lane";
                    length: number;
                    width: number;
                } | {
                    kind: "ring";
                    inner: number;
                    outer: number;
                } | {
                    kind: "wedge";
                    length: number;
                    halfAngle: number;
                } | {
                    kind: "point";
                    radius: number;
                    exclusive?: boolean;
                } | {
                    kind: "sphere";
                    radius: number;
                })[];
                motion?: {
                    speed?: number;
                    delay?: number;
                    track?: "none" | "lead" | "follow";
                    overshoot?: number;
                    skid?: number;
                };
                eligibility?: {
                    maxDy?: number;
                    jumpDodges?: boolean;
                };
            }>;
    };
    portal: {
        signal: string;
        spawn: {
            x: number;
            z: number;
            yaw: number;
        };
        end: number;
        exitOffset: number;
        slow: number;
        fade: {
            out: number;
            hold: number;
            in: number;
        };
        keep: string;
        near: number;
        floor: {
            tolerance: number;
            depth: number;
        };
    };
    client: {
        light: {
            colour: number;
            drop: number;
        };
        prewarm: {
            kind: string;
            variant: string;
        };
        system: string;
        debugZ: number;
    };
    program: {
        script: unknown;
        bytes: string;
        v2?: ReturnProjectionV2RowsInput;
    };
}
type BoundedArenaEncounterInput = { [Key in keyof BoundedArenaEncounterInputFields]: BoundedArenaEncounterInputFields[Key] };
interface BoundedArenaEncounterFields {
    definition: BossEncounterDefinitionRows;
    reward: {
        tier: string;
        name: string;
        flavour: string;
        prompt: string;
    };
    page: {
        profile: unknown;
        body: string;
        identity: "runtime" | "declared";
        add: {
            kind: string;
            variant: string;
            memory: Record<string, number>;
        };
        damageTag: `${string}.${string}`;
        maxZ: number;
        reward: [
            number,
            number,
            number
        ];
        respawn: [
            number,
            number,
            number
        ];
        yaw: number;
        presentation: {
            reach: number;
            ringMax: number;
            beamRadius: number;
        };
        cuts: {
            id: string;
            shape: {
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            };
            windup: number;
            active: number;
            recover: number;
            cooldown: number;
            range: number | null;
            damage: number;
            tags: `${string}.${string}`[];
            weight: {
                kind: "constant";
                value: number;
            } | {
                kind: "horizontal-distance";
                above: number;
                far: number;
                near: number;
            };
            units?: "world" | "actor";
            alternatives?: ({
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            })[];
            motion?: {
                speed?: number;
                delay?: number;
                track?: "none" | "lead" | "follow";
                overshoot?: number;
                skid?: number;
            };
            eligibility?: {
                maxDy?: number;
                jumpDodges?: boolean;
            };
        }[];
        hazards: Record<string, {
                id: string;
                shape: {
                    kind: "arc";
                    radius: number;
                    halfAngle: number;
                    yawOffset?: number;
                } | {
                    kind: "lane";
                    length: number;
                    width: number;
                } | {
                    kind: "ring";
                    inner: number;
                    outer: number;
                } | {
                    kind: "wedge";
                    length: number;
                    halfAngle: number;
                } | {
                    kind: "point";
                    radius: number;
                    exclusive?: boolean;
                } | {
                    kind: "sphere";
                    radius: number;
                };
                windup: number;
                active: number;
                recover: number;
                cooldown: number;
                range: number | null;
                damage: number;
                tags: `${string}.${string}`[];
                weight: {
                    kind: "constant";
                    value: number;
                } | {
                    kind: "horizontal-distance";
                    above: number;
                    far: number;
                    near: number;
                };
                units?: "world" | "actor";
                alternatives?: ({
                    kind: "arc";
                    radius: number;
                    halfAngle: number;
                    yawOffset?: number;
                } | {
                    kind: "lane";
                    length: number;
                    width: number;
                } | {
                    kind: "ring";
                    inner: number;
                    outer: number;
                } | {
                    kind: "wedge";
                    length: number;
                    halfAngle: number;
                } | {
                    kind: "point";
                    radius: number;
                    exclusive?: boolean;
                } | {
                    kind: "sphere";
                    radius: number;
                })[];
                motion?: {
                    speed?: number;
                    delay?: number;
                    track?: "none" | "lead" | "follow";
                    overshoot?: number;
                    skid?: number;
                };
                eligibility?: {
                    maxDy?: number;
                    jumpDodges?: boolean;
                };
            }>;
    };
    portal: {
        signal: string;
        spawn: {
            x: number;
            z: number;
            yaw: number;
        };
        end: number;
        exitOffset: number;
        slow: number;
        fade: {
            out: number;
            hold: number;
            in: number;
        };
        keep: string;
        near: number;
        floor: {
            tolerance: number;
            depth: number;
        };
    };
    client: {
        light: {
            colour: number;
            drop: number;
        };
        prewarm: {
            kind: string;
            variant: string;
        };
        system: string;
        debugZ: number;
    };
    program: {
        script: unknown;
        bytes: string;
        v2?: ReturnProjectionV2Rows;
    };
}
type BoundedArenaEncounter = { [Key in keyof BoundedArenaEncounterFields]: BoundedArenaEncounterFields[Key] };

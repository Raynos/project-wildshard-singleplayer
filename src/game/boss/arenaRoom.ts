import { installEnteredRuntimeService } from '../shard/retainedHooks';
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
import { ReturnProgram, ProjectedState } from '../population/returnProgram';
import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { BossEncounterDefinitionSchema } from '@wildshard/format/bossEncounter';
import type { HeldSlotKit, HeldClaims } from '../loadout/claims';
import { enteredAdventurePersistence } from '../quest/chapterBindings';
import { modelContext, type ModelDef, type ModelContext } from '@wildshard/engine/models/model';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import { Rng } from '@wildshard/engine/core/rng';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { listenPage } from '@wildshard/engine/input/dom';
import type { ArenaScriptData,ArenaScriptRows,ArenaScriptFightFile } from '@wildshard/format/arenaScriptRows';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import type { AimTarget } from '@wildshard/engine/player/AimTargets';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { TIER } from '@wildshard/engine/core/tier';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { wind } from '@wildshard/engine/world/steppeWind';
import { installChannelPrograms } from '../plugin/channelPrograms';
import type { WeatherReactions } from '../weather/reactions';
import type { ShardProduct } from '../shardfile/shardProduct';
import { wildEnv } from '../population/pageGroups';
import { setEliteDamage } from '@wildshard/engine/entities/eliteBrain';
import { CellField } from '../systems/cellField';
import { ArenaFireView, ArenaWhirlsView } from './arenaFire';
import { ArenaSceneView, CloudBody, type PatrolEncounterView } from './encounterView';
import { ARENA_BURNT_PER_FRAME, ARENA_VIEW, arenaChainTell } from '@wildshard/format/arenaView';
import {entryOwner, lateEntryOwner, presentEntryOwner} from '../shardfile/entryOwners';
import { lendViewArray, lendViewCell, lendViewDraw, lendViewFrame, lendViewTell, lendViewValues } from '../shardfile/clientViewProgram';
import type { Scope } from '@wildshard/engine/app/scope';
import type { GroundTell } from '../Elite';
import type { ArcWeaponPower } from '../weapons/arcPower';
import type { CosmeticFinishLocker } from '../loadout/cosmeticFinishes';
import { pageRidingMount, respawnPageMounted,installArenaBoundary,type ArenaBoundary } from '../riding/client';
import type { Mount } from '../riding/mount';
import {V2_ACTION_OPS,type V2ActionBinding} from '@wildshard/format/scriptActionsV2';
import {prepareV2WorldActions,type V2WorldActionLoan} from '../shardfile/worldActionsV2';
/** Client-only arena attachments and deformable floor, driven by scene and encounter rows. */

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite,finite,finite]);
const planarPoint = v.strictObject({ x: finite, z: finite });
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
/** Read schema-checked named products; no validator is imported into play. */
export async function readArenaScriptData(product: Pick<ShardProduct,'json'>, files: { fight: string; geometry: string }): Promise<ArenaScriptData> {
  const [root,geometry]=await Promise.all([product.json<ArenaScriptFightFile>(files.fight),product.json<ArenaScriptData['geometry']>(files.geometry)]);
  return {...root.arenaScript,programs:root.programs,arenaFire:root.arenaFire,geometry};
}
/** Native cloud resources are identical for an entered fight and its specimen. */
function arenaScriptCloud(scene: THREE.Scene, state: Readonly<Record<string,number>>, data: ArenaScriptData): CloudBody {
  const g = data.geometry;
  return new CloudBody(scene,{ ...g.body,geometry: { ...g.body.geometry,eyes: g.eyes },poses: g.poses,
    puffs: { ...g.body.puffs,rows: g[TIER].puffs } },state,new Map([['place',{ ...data.arena.body,ground: heightAt(data.arena.ground.x,data.arena.ground.z) }]]));
}
export interface OpenArenaWorld { readonly game: Game; readonly player: Player; readonly weather: WeatherReactions; readonly air: WeatherContinuation; readonly tieSpot: THREE.Vector3 | null }
interface SupportActor { readonly a: Animal; readonly lane: GroundTell; readonly law: ProjectedState }
interface Chain { readonly tell:GroundTell; readonly row:ArenaScriptData['clocks']['landings'][number] }
const _openV = new THREE.Vector3(), _openW = new THREE.Vector3(), _openRAY = new THREE.Ray(), _openSPH = new THREE.Sphere(), _openHITP = new THREE.Vector3();
class OpenArenaProjection implements BossScript {
  private readonly data: ArenaScriptData;
  readonly body: CloudBody;
  /** the body's pose, set by the fight and read by its channel rows */
  readonly pose:ArenaScriptRows['pose'];
  get phase(): number { return this.life.value('phase'); }
  get hp(): number { return this.life.value('hp'); }
  private set hp(hp: number) { this.life.event('support',{ hp,broke: Number(this.domeBroken) }); }
  private get invuln(): boolean { return this.life.value('invuln')===1; }
  private get fighting(): boolean { return this.life.value('fighting')===1; }
  private get open(): boolean { return this.life.value('open')===1; }
  private get victoryT(): number { return this.life.value('victoryT'); }
  // the spear
  readonly spearAt = new THREE.Vector3();
  // phase II
  private stormRiders: SupportActor[] = [];
  private readonly support: ProjectedState;
  private readonly memberOutputs: readonly string[];
  private get domeBroken(): boolean { return this.life.value('broke')===1; }
  private set domeBroken(on: boolean) { this.life.event('support',{ hp: this.hp,broke: Number(on) }); }
  // phase III
  private readonly field: CellField;
  private fireOn = false;
  private readonly fire: ArenaFireView;
  /** the scorch decals' draw, the burnt-out cells not yet drawn, the frame's share of them, a reset the fire view has not
   *  seen yet, and the fire view's slot (R6: behaviour/titanFireView draws the flames, smoke and scorch) */
  private readonly scorch: THREE.InstancedMesh;
  private readonly burntQueue: number[] = [];
  private readonly burnt = new Float32Array(1 + ARENA_BURNT_PER_FRAME);
  private fireClear = false;
  private fireFrame: ((dt: number, time: number) => boolean) | null = null;
  private readonly chains: Chain[];
  private get chainLeft(): number { return this.clocks.value(this.data.clocks.left); }
  readonly clocks:ProjectedState;
  readonly scope:Scope;
  private readonly clockRandom=app.rng.stream('ai');
  private readonly whirls: ArenaWhirlsView;
  // the seal
  private readonly arena: ArenaSceneView;
  private get sealed(): boolean { return this.life.value('sealed')===1; }
  private hazardDt = 0;
  readonly boundary: ArenaBoundary;
  private boundaryEffect: Readonly<Record<string,number>> | null = null;
  private readonly author: ReturnProgram;
  readonly life: ProjectedState;
  private readonly fightDraw: ReturnType<typeof installChannelPrograms>;
  private readonly viewRead = { fighting: 0, victoryT: -1, phase: 0, domeBroken: 0, open: 0, flash: 0 };
  /** Nalati zero R6: the tells and pose run in the fight's view module at its frame slot (format/arenaView), lent in the
   *  entered encounter's bind; its cells are the eased pose and the aim's operands */
  private view: { readonly frame: (dt: number, time: number) => void; readonly cells: Record<'bend' | 'raise' | 'castL' | 'struck' | 'alpha', { value: number }> } | null = null;

  constructor(private readonly ctx: OpenArenaWorld, private readonly host: ArenaRoomEncounter, data: ArenaScriptData) {
    this.scope=ctx.game.levelScope;this.data = data; this.pose={...data.pose};
    const scene = ctx.game.scene;
    const clocks=this.data.clocks;
    const state=clocks.frame.initial,outputs=clocks.frame.outputs,channels=data.programs.attack.v2?.channels,retain=Object.entries(clocks.frame.retain),slots=clocks.landings.flatMap(row=>[row.on,row.t,row.x,row.z]);
    if(clocks.frame.parameters[clocks.count]!==clocks.landings.length||new Set(slots).size!==slots.length||outputs===undefined
      ||[clocks.left,...slots,...retain.map(([,slot])=>slot)].some(key=>!Object.hasOwn(state,key))
      ||new Set(retain.map(([,slot])=>slot)).size!==Object.keys(state).length
      ||[...retain.map(([channel])=>channel),'strike','stuck','hurt','spread',clocks.spear,...clocks.landings.flatMap(row=>[row.strike,row.hurt])].some(key=>!outputs.includes(key))
      ||channels!==undefined&&outputs.some(key=>!channels.includes(key))
      ||Object.keys(clocks.clear).length!==slots.length||slots.some(key=>!Object.hasOwn(clocks.clear,key)||!Object.is(clocks.clear[key],state[key])))throw new Error('Invalid encounter clock bank');
    const actors=data.support.actors;
    if(actors===undefined||Object.entries(data.support.commit).some(([slot,value])=>!Object.hasOwn(data.support.member,slot)||!Number.isFinite(value)))throw new Error('Invalid support actor binding');
    this.memberOutputs=['show','alpha','hurt',...Object.values(actors.memory)];
    const bindings=ReturnProgram.projectionBindings(data.programs.attack);
    ProjectedState.preflight(data.script.fight,bindings);
    ProjectedState.preflight(clocks.frame,bindings);ProjectedState.preflight({...data.support,signal:'couple',outputs:['index','hp','mask','broke']},bindings);
    ProjectedState.preflight({initial:{...data.support.member,theta:0},parameters:data.support.parameters,signals:data.support.signals,signal:'member',outputsEvents:{member:this.memberOutputs,damage:['alpha']}},bindings);
    ArenaWhirlsView.preflight(data.whirls,bindings);
    const windBindings=ReturnProgram.projectionBindings(data.programs.wind);
    for(const law of data.whirls.laws)ProjectedState.preflight(law,windBindings);
    if(data.field.contact!==undefined)ProjectedState.preflight(data.field.contact.law,windBindings);
    if(Object.entries(data.field.channels).some(([kind,channel])=>!Object.values(kind==='state'?windBindings.script.fields:windBindings.script.channels).includes(channel))||Object.values(data.field.signals).some(signal=>!Object.values(windBindings.script.signals).includes(signal)))throw new Error('Missing cell field program binding');
    if(data.programs.attack.v2===undefined||Object.values(data.commands).some(signal=>!Object.values(bindings.script.signals).includes(signal)))throw new Error('Missing encounter command program');
    this.author=ReturnProgram.page(this.data.programs.attack,ctx.game.levelScope);
    this.clocks=new ProjectedState(clocks.frame,this.author);
    const windLaw = ReturnProgram.page(this.data.programs.wind, ctx.game.levelScope);
    this.field = new CellField(this.data.field, windLaw, app.rng.stream('ai'));
    this.boundary = { field: this.field,boundary: data.boundary,mask: 0 };
    this.life = new ProjectedState(this.data.script.fight,this.author);
    this.support = new ProjectedState({...this.data.support,signal:'couple',outputs:['index','hp','mask','broke']},this.author);
    this.body = arenaScriptCloud(scene, this.pose, data);
    this.fightDraw = installChannelPrograms(this.data.geometry.poses, this.data.view.group, new Map<string,unknown>([
      ['pose',this.pose],['alpha',this.body.alpha],['flash',this.body.flash],['fight',this.viewRead],
    ]));
    const arena = this.arena = new ArenaSceneView(scene, this.data.geometry.arena);
    this.chains=clocks.landings.map((row,i)=>({tell:arena.tell('chain',i),row}));
    this.whirls = new ArenaWhirlsView(this.data.whirls, windLaw, [arena.mesh('funnel0'), arena.mesh('funnel1'), arena.mesh('funnel2')], arena.instances('debris'),this.author,this.scope);
    this.fire = new ArenaFireView(scene, this.data.arenaFire, (TIER === 'phone' ? this.data.geometry.phone : this.data.geometry.desktop).flames);
    this.scorch = arena.instances('scorch'); this.scorch.count = 0;
    const target = data.view.target;
    this.heartTarget = { kind: data.definition.id,position: new THREE.Vector3(),alive: true,damageFor: () => target.damage,applyDamage: amount => this.hitHeart(amount) };
    this.heartHit = { animal: this.heartTarget,point: new THREE.Vector3(),distance: 0,headshot: false };
    this.heartLock = { kind: data.definition.id,position: new THREE.Vector3(),alive: true,lockable: true,lockRange: target.range,dims: { bodyY: 0,bodyRadius: target.closed } };
  }

  /** Lend the view module (format/arenaView) what it samples and writes, then the frame slot it runs at, for `scope`'s life. */
  lendView(scope: Scope): void {
    const { sources, cells: ids, tells } = ARENA_VIEW, pose = this.pose;
    lendViewValues(scope, sources.life, field => this.life.value(field));
    lendViewValues(scope, sources.clocks, field => this.clocks.value(field));
    lendViewValues(scope, sources.pose, field => field === 'bend' ? pose.bend : field === 'raise' ? pose.raise : field === 'castL' ? pose.castL : Number.NaN);
    lendViewValues(scope, sources.spear, field => field === 'x' ? this.spearAt.x : field === 'z' ? this.spearAt.z : Number.NaN);
    const cells = { bend: { value: pose.bend }, raise: { value: pose.raise }, castL: { value: pose.castL }, struck: { value: 0 }, alpha: { value: 0 } };
    for (const key of ['bend', 'raise', 'castL', 'struck', 'alpha'] as const) lendViewCell(scope, ids[key], cells[key]);
    lendViewTell(scope, tells.spear, this.arena.tell('spear')); lendViewTell(scope, tells.fork, this.arena.tell('fork'));
    for (const [i, chain] of this.chains.entries()) lendViewTell(scope, arenaChainTell(i), chain.tell);
    const view = { frame: lendViewFrame(scope, ARENA_VIEW.slot).frame, cells };
    // the grass fire: its field (modes, lifetimes, the ground under each cell, this frame's burnt-out cells), its values
    // and its draws, at the fire's own slot
    const fire = ARENA_VIEW.fire, field = this.field, ground = new Float32Array(field.length), smoke = this.data.arenaFire.cells?.smoke;
    for (let c = 0; c < field.length; c++) ground[c] = heightAt(field.x(c), field.z(c));
    const smokeRate = smoke === undefined ? 0 : TIER === 'phone' ? smoke[0] : smoke[1];
    const values: Readonly<Record<string, () => number>> = { on: () => Number(this.fireOn), clear: () => Number(this.fireClear), windX: () => wind.dirX,
      windZ: () => wind.dirZ, windSpeed: () => wind.speed, smokeCap: () => this.fire.smoke.instanceMatrix.count, smokeRate: () => smokeRate,
      scorchCap: () => this.scorch.instanceMatrix.count };
    lendViewValues(scope, fire.values, name => values[name]?.() ?? Number.NaN);
    lendViewArray(scope, fire.arrays.modes, () => field.modeCells); lendViewArray(scope, fire.arrays.lifetimes, () => field.lifetimeCells);
    lendViewArray(scope, fire.arrays.ground, () => ground); lendViewArray(scope, fire.arrays.burnt, () => this.burnt);
    lendViewDraw(scope, fire.draws.flames, this.fire.flames); lendViewDraw(scope, fire.draws.smoke, this.fire.smoke); lendViewDraw(scope, fire.draws.scorch, this.scorch);
    const fireFrame = lendViewFrame(scope, fire.slot).frame;
    this.fireFrame = fireFrame; scope.onDispose(() => { if (this.fireFrame === fireFrame) this.fireFrame = null; });
    this.whirls.bindView(scope);
    this.view = view; scope.onDispose(() => { if (this.view === view) this.view = null; });
  }

  // ── BossScript ──
  get hpFrac(): number { return Math.max(0, this.hp / this.data.place.heartHp); }
  get shielded(): boolean { return this.life.value(this.data.script.fight.retainEvents.step.shield)===1; }
  get dead(): boolean { return this.hp <= 0; }
  get heartOpen(): boolean {
    return this.open;
  }
  inArena(_p: THREE.Vector3): boolean { return this.life.value(this.data.script.fight.retainEvents.step.enter)===1; }
  /** the strip is tied (the cairn's prompt) — the threshold */
  get tied(): boolean { return this.life.value('tied')===1; }
  set tied(on: boolean) { this.life.event('tied',{ amount: Number(on) }); }
  seal(on: boolean): void { this.life.event('seal',{ amount: Number(on) }); }
  clampHp(share: number): void { this.life.event('clamp',{ share }); }
  setInvulnerable(on: boolean): void { this.life.event('invulnerable',{ amount: Number(on) }); }
  private point(respawn: boolean): { x: number; z: number; yaw: number } {
    const at = this.cairnSpot(), center = this.data.arena.center, body = this.data.arena.body;
    const answer = this.life.event('point',{ x: at.x,z: at.z,cx: center.x,cz: center.z,bodyX: body.x,bodyZ: body.z,amount: Number(respawn) });
    return { x: answer['x'] ?? at.x,z: answer['z'] ?? at.z,yaw: answer['yaw'] ?? 0 };
  }
  rewardPoint(): THREE.Vector3 { const p = this.point(false); return new THREE.Vector3(p.x,heightAt(p.x,p.z)+this.data.view.reward.lift,p.z); }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } { const p = this.point(true); return { pos: new THREE.Vector3(p.x,heightAt(p.x,p.z),p.z),yaw: p.yaw }; }
  cairnSpot(): THREE.Vector3 { return this.ctx.tieSpot ?? new THREE.Vector3(this.data.arena.anchor.x, heightAt(this.data.arena.anchor.x, this.data.arena.anchor.z), this.data.arena.anchor.z); }

  reset(phase: number): void {
    this.life.restart({ phase,share: this.data.phases[phase]?.at ?? 1,tied: Number(this.tied),sealed: Number(this.sealed) }); this.clocks.reset();
    this.boundaryEffect = null; this.hazardDt = 0; this.boundary.mask = 0;
    const b = this.body;
    Object.assign(this.pose,this.data.pose);
    b.alpha.value = 1; b.part(this.data.view.dome).visible = false;
    b.setVisible(false);
    this.arena.tell('spear').hide(); this.arena.tell('fork').hide(); this.body.aim(null, 0);
    this.clearRiders();
    this.domeBroken = false; this.support.reset();
    this.clearFire();
    this.clocks.set(this.data.clocks.clear);for (const c of this.chains) c.tell.hide();
    this.whirls.reset();
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const b = this.body; if (!b.visible) b.setVisible(true);
    if (this.life.event('introClock',{t})['zzzzIntroTick']===1) {
      const answer = this.life.event('intro',{ t,amount: Number(short) });
      this.pose.rise = this.life.value(this.data.script.fight.retainEvents.intro.rise); this.pose.kneel = this.life.value(this.data.script.fight.retainEvents.intro.kneel);
      b.alpha.value = this.life.value(this.data.script.fight.retainEvents.intro.alpha); b.flash.value = answer['flash'] ?? b.flash.value;
      if (answer['strike']===1) this.bolt(this.data.arena.center.x+this.data.view.introBolt.x,this.data.arena.center.z+this.data.view.introBolt.z);
    }
    return b.focusWorld(_openHITP);
  }

  begin(phase: number): void {
    this.phaseEffects(this.life.event('begin',{ phase }));
  }

  enterPhase(phase: number): void {
    this.phaseEffects(this.life.event('phase',{ phase }));
  }
  private phaseEffects(row: Readonly<Record<string,number>>): void {
    this.clocks.set({ mode: row['mode'] ?? 0, cd: row['cd'] ?? 0 }); this.arena.tell('spear').hide(); this.arena.tell('fork').hide(); this.body.aim(null, 0);
    this.pose.bend = this.data.pose.bend; this.pose.raise = this.data.pose.raise; this.pose.rise = row['rise'] ?? this.pose.rise;
    this.whirls.arm(row['mask'] ?? 0);
    if (row['arm'] === 1) { this.domeBroken = false; this.spawnRiders(); } else this.clearRiders();
    if (row['spread'] === 1) {
      this.fireOn = true;
      const p = this.host.player.position;
      for (const seed of this.data.seeds) this.ignite(p.x + seed.x, p.z + seed.z);
    }
    const line = this.data.phaseLines[row['index'] ?? -1]; if (line) this.host.feed(line);
  }

  takeBoundary(): Readonly<Record<string,number>> | null { const effect = this.boundaryEffect; this.boundaryEffect = null; return effect; }
  update(dt: number, t: number, fighting: boolean): void {
    const b = this.body, p = this.host.player.position;
    const boss = this.host.boss, center = this.data.arena.center;
    const decision = this.life.step(dt,{ px: p.x,pz: p.z,cx: center.x,cz: center.z,radius: this.data.place.arenaRadius,
      mounted: Number(this.host.mounted()),fighting: Number(fighting),mode: this.clocks.value('mode'),
      engaged: Number(this.host.engaged),storm: Number(this.ctx.weather.stormActive),armed: Number(boss?.state==='armed'),victory: Number(boss?.state==='victory') });
    this.hazardDt = decision.dt;
    if (decision.dt>0) {
      this.boundaryEffect = decision.values; this.boundary.mask = this.life.value(this.data.script.fight.retainEvents.step.mask);
      if (decision.values['show']===0) b.setVisible(false);
    }
    this.arena.update(dt, t, this.sealed);   // the wall rises / falls with the seal
    if (!b.visible && this.victoryT < 0) { this.updateFire(dt, t, false); return; }
    Object.assign(this.viewRead, { fighting: Number(fighting), victoryT: this.victoryT, phase: this.phase, domeBroken: Number(this.domeBroken), open: Number(this.heartOpen), flash: this.ctx.weather.flash });
    this.fightDraw.evaluate({ time: t, delta: dt, values: {} });
    const fog = this.ctx.game.scene.fog;
    if (fog) b.fogColour.copy(fog.color);
    // the dome
    b.part(this.data.view.dome).visible = b.visible && this.life.value(this.data.script.fight.retainEvents.step.dome)===1;
    if (this.life.value(this.data.script.fight.retainEvents.step.active)===1 && this.fighting) {
      const step = this.clocks.step(dt, { phase: this.phase, fighting: Number(fighting), px: p.x, pz: p.z }, this.clockRandom);
      if (this.life.value(this.data.script.fight.retainEvents.step.weapon)===1) this.updateSpear(step.values[this.data.clocks.spear]===1?step.values:undefined);
      if (this.life.value(this.data.script.fight.retainEvents.step.arm)===1 && step.dt>0) this.updateRiders(step.dt);
      if (this.life.value(this.data.script.fight.retainEvents.step.spread)===1 && step.dt>0) this.updateChains(step.values);
    }
    if (decision.dt>0) this.life.event('tell',{ t,mode: this.clocks.value('mode'),spearT: this.clocks.value('t'),chainLeft: this.chainLeft,bend: this.pose.bend,raise: this.pose.raise });
    // the frame slot: the view module eases the pose and draws the spear, fork and chain rings (behaviour titanView);
    // the aim's operands are captured here, before the whirls and the fire (a reset during their contact keeps them)
    let struck = 0, alpha = 0;
    const view = this.view;
    if (view !== null) {
      view.frame(dt, t); const c = view.cells;
      this.pose.bend = c.bend.value; this.pose.raise = c.raise.value; this.pose.castL = c.castL.value; struck = c.struck.value; alpha = c.alpha.value;
    }
    this.updateWhirls(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    this.updateFire(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    // the spear in his hand (raised) or stuck in the meadow
    b.aim(struck===1 ? this.spearAt : null,b.visible ? alpha : 0);
    b.update(t, this.ctx.game.camera);
  }

  victory(): void {
    this.life.event('victory');
    this.clocks.set({ mode: 0 }); this.arena.tell('spear').hide(); this.arena.tell('fork').hide();
    this.clocks.set(this.data.clocks.clear);for (const c of this.chains) c.tell.hide();
    for (const l of this.arena.tells('lane')) l.hide();
    this.clearRiders();
    // the rain puts the fire out: every burning cell goes to black
    for (const cell of this.field.deactivate()) this.addScorch(cell);
    this.fireOn = false;
    this.whirls.arm(0);
  }

  // ── the heart as a target (main's Targets chain) ──

  private readonly heartTarget: TargetAnimal;
  private readonly heartHit: TargetHit;
  private readonly heartLock: AimTarget;
  lockTarget(): AimTarget | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return null;
    this.body.focusWorld(this.heartLock.position); this.heartLock.alive = !this.dead;
    return this.heartLock;
  }

  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return hit;
    const best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist;
    this.body.focusWorld(_openHITP);
    _openSPH.set(_openHITP, this.heartOpen ? this.data.view.target.open : this.data.view.target.closed);
    _openRAY.set(origin, dir);
    if (_openRAY.intersectSphere(_openSPH, _openV) === null) return hit;
    const d = _openV.distanceTo(origin);
    if (d > best) return hit;
    this.heartTarget.position.copy(_openHITP); this.heartTarget.alive = !this.dead;
    this.heartHit.point.copy(_openV); this.heartHit.distance = d; this.heartHit.headshot = this.heartOpen;
    return this.heartHit;
  }

  private hitHeart(amount: number): boolean {
    const answer = this.life.event('damage',{ amount,mode: this.clocks.value('mode') });
    if (answer['show']===1) this.host.toast(this.data.immuneLines[answer['index'] ?? 0] ?? '');
    if (answer['flash']===1) this.body.flash.value = 1;
    return this.dead;
  }

  // ── I · the Sky Spear ──

  private updateSpear(answer: Readonly<Record<string, number>> | undefined): void {
    if (answer !== undefined) {
      const n = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing attack decision'); return value; };
      this.spearAt.x = this.clocks.value('x'); this.spearAt.z = this.clocks.value('z');
      if (n('strike') === 1) {
        this.spearAt.y = heightAt(this.spearAt.x, this.spearAt.z); this.bolt(this.spearAt.x, this.spearAt.z);
        if (n('hurt') === 1 && this.host.contact('spear', this.spearAt, this.data.tuning.spearDamage, this.data.lines.spear)) this.host.throwRider();
        if (n('spread') === 1) this.ignite(this.spearAt.x, this.spearAt.z);
      }
      if (n('stuck') === 1) this.host.feed(this.data.lines.spearStuck);
    }
  }

  // ── II · the Three Winds ──

  private spawnRiders(): void {
    this.clearRiders();
    const gr = this.host.riderOwner();
    if (gr === null) { this.domeBroken = true; return; }
    for (const [i, site] of this.data.supportSites.entries()) {
      const { x, z } = site;
      const a = gr.spawnRider({ x, z, yaw: 0, variant: this.data.view.quietVariant, quiet: true });
      if (a === null) continue;
      const lane = this.arena.tells('lane')[i];
      if (lane === undefined) continue;
      const rows=this.data.support,actors=rows.actors;if(actors===undefined)throw new Error('Missing support actor rows');
      const law=new ProjectedState({initial:{...rows.member,theta:site.theta},parameters:rows.parameters,signals:rows.signals,signal:'member',outputsEvents:{member:this.memberOutputs,damage:['alpha']}},this.author),player=this.host.player.position;
      a.maxHp=actors.hp;a.hp=actors.hp;
      setEliteDamage(a,(body,point)=>law.event('damage',{x:point.x,z:point.z,px:player.x,pz:player.z,radius:body.scale})['alpha']??1);
      const r: SupportActor = { a,lane,law };
      this.stormRiders.push(r);
    }
  }

  private clearRiders(): void {
    const gr = this.host.riderOwner();
    for (const r of this.stormRiders) { setEliteDamage(r.a,()=>1);r.lane.hide(); if (r.a.alive && gr !== null) { r.a.alive = false; gr.dissolve(r.a); } }
    this.stormRiders = [];
    for (const l of this.arena.tells('lane')) l.hide();
  }

  private updateRiders(dt: number): void {
    const p=this.host.player.position,riders=this.stormRiders,rows=this.data.support;
    const frame={dt,px:p.x,pz:p.z,hp:this.hp,invuln:Number(this.invuln)};
    const state=this.support.project({...frame,count:riders.length},app.rng.stream('ai'),riders.map(({a,law})=>({x:a.position.x,z:a.position.z,hit:Number(a.alive),mode:law.value('mode')})));
    const selected=riders[state['index']??-1];
    if(selected!==undefined){
      selected.law.set(rows.commit);
      selected.law.set(Object.fromEntries(['x0','z0','x1','z1'].map(key=>[key,state[key]??0] as const)));
    }
    this.hp=state['hp']??this.hp;
    for(let i=riders.length-1;i>=0;i--){
      const r=riders[i];if(r===undefined)continue;
      if(((state['mask']??0)&(1<<i))!==0){
        setEliteDamage(r.a,()=>1);r.lane.hide();riders.splice(i,1);
        this.host.feed(riders.length>0?this.data.lines.riderBreaks+this.data.view.remaining.replace('{count}',String(riders.length)):this.data.lines.lastRider);continue;
      }
      const a=r.a,answer=r.law.project({...frame,ax:a.position.x,az:a.position.z});
      const n=(key:string):number=>{const value=answer[key];if(value===undefined)throw new Error('Missing support decision');return value;};
      for(const [slot,channel]of Object.entries(rows.actors?.memory??{}))a.mem[slot]=n(channel);
      if(n('show')===1)r.lane.lane(r.law.value('x0'),r.law.value('z0'),r.law.value('x1'),r.law.value('z1'),4.2,n('alpha'));else r.lane.hide();
      if(n('hurt')===1&&this.host.contact('wind',a.position,this.data.tuning.chargeDamage,this.data.lines.charge))this.host.throwRider();
    }
    if(state['broke']===1&&!this.domeBroken){this.domeBroken=true;this.body.flash.value=1;}
  }

  // ── III · the grass fire + chain lightning ──

  /** A native contact/result remains a synchronous barrier. Only its original
   * concrete field or current entered mount is lent for this one request. */
  private command(signal:string,frame:Readonly<Record<string,number>>,loan:Extract<V2WorldActionLoan,{kind:'mount'|'cell-field'}>):void {
    const project=this.author.prepareWorld;if(project===undefined)throw new Error('Missing encounter command transport');
    const binding:V2ActionBinding={identity:'arena',handle:1,targets:new Map([[1,{identity:loan.target,kind:loan.kind==='cell-field'?'cell-field':'mount'}]]),operations:new Set([loan.kind==='cell-field'?V2_ACTION_OPS.ignite:V2_ACTION_OPS.dismount]),maxCommands:1,bounds:{coordinate:Number.MAX_VALUE,velocity:0}};
    const prepared=project(signal,frame,new Map([[1,binding]])),effects=prepareV2WorldActions(prepared.actions,[loan]);
    if(Object.keys(prepared.values).length>0||prepared.actions.length!==1)throw new Error('Invalid encounter command result');
    effects.validate();prepared.accept();for(const apply of effects.operations)apply();
  }
  dismount(mount:Mount,scope:Scope):void {this.command(this.data.commands.dismount,{}, {binding:'arena',target:'mount',kind:'mount',scope,owner:mount});}
  private ignite(x:number,z:number):void {this.command(this.data.commands.ignite,{x,z},{binding:'arena',target:'field',kind:'cell-field',scope:this.scope,owner:this.field});}
  private addScorch(c: number): void {
    this.burntQueue.push(c);
    wildEnv.trample(this.field.x(c), this.field.z(c), this.data.tuning.cell * 0.6, 1, 0, 0);   // the grass burnt flat
  }
  private clearFire(): void { this.field.clear(); this.burntQueue.length = 0; this.fireClear = true; this.fireOn = false; }

  private updateFire(dt: number, t: number, live: boolean, thinkDt = 0): void {
    this.fire.update(t, wind.dirX, wind.dirZ, wind.speed, this.body.fogColour, this.body.flash.value);
    if (this.fireOn && live) for (const cell of this.field.update(dt, { wx: wind.dirX, wz: wind.dirZ })) this.addScorch(cell);
    // the fire slot: the view module draws the smoke, the burning cells' flames and up to a frame's share of the burnt-out
    // cells' scorch; what it has not run for (its lane's rate can skip a frame) waits for the frame it runs
    const n = Math.min(ARENA_BURNT_PER_FRAME, this.burntQueue.length); this.burnt[0] = n;
    for (let k = 0; k < n; k++) this.burnt[1 + k] = this.burntQueue[k] ?? 0;
    if (this.fireFrame?.(dt, t) === true) { this.burntQueue.splice(0, n); this.fireClear = false; }
    if (!this.fireOn || !live || thinkDt <= 0) return;
    // the player in fire: 8 / s; the horse panics near it
    const p = this.host.player.position;
    const contact = this.field.sense(thinkDt, p, { mounted: Number(this.host.mounted()) });
    if ((contact['hurt'] ?? 0) > 0) this.host.contact('fire', p, contact['hurt'] ?? 0, this.data.lines.burning);
    if ((contact['speed'] ?? 0) < 0) this.host.horseSteed(contact['speed'] ?? 0);
  }

  private updateChains(values:Readonly<Record<string,number>>):void {
    const p=this.host.player.position;
    for(const chain of this.chains)if(values[chain.row.strike]===1){
      const x=this.clocks.value(chain.row.x),z=this.clocks.value(chain.row.z);
      chain.tell.hide();this.bolt(x,z);this.ignite(x,z);
      if(values[chain.row.hurt]===1)this.host.contact('chain',_openV.set(x,p.y,z),this.data.tuning.chainDamage,this.data.lines.chain);
    }
  }

  // ── whirlwinds: touching one lifts you out of the saddle ──

  private updateWhirls(dt: number, t: number, live: boolean, thinkDt: number): void {
    const p = this.host.player.position;
    const hits = this.whirls.update(dt, t, live, thinkDt, { wx: wind.dirX, wz: wind.dirZ, px: p.x, pz: p.z });
    for (const at of hits) if (this.host.contact('whirl', at, this.data.tuning.whirlDamage, this.data.lines.whirl)) this.host.throwRider();
  }

  // ── a strike from the sky ──
  private bolt(x: number, z: number): void {
    const y = heightAt(x, z);
    this.ctx.weather.raise(this.data.weather.strike, { x, y, z, kind: 0 });
    this.ctx.weather.flash = 1;
    this.body.flash.value = 1;
    wildEnv.onEvent('lightning', x, z);
  }

}

export class ArenaRoomEncounter {
  readonly spareLight:THREE.PointLight;
  private readonly room:BossArenaRoom|null;
  get dungeon():BossArenaRoom{if(this.room===null)throw new Error('Open arena has no room');return this.room;}
  boss:Boss|null=null;ui:BossBar|null=null;
  fight:ReturnType<typeof arenaRoomFight>|null=null;
  power:ReturnType<HeldSlotKit['bowPower']>|ArcWeaponPower|null=null;
  riders:PatrolEncounterView|null=null;mount:Mount|null=null;
  private readonly rows:v.InferOutput<typeof ArenaRoomEncounterSchema>|null;
  private readonly openRows:ArenaScriptData|null;
  private readonly openWorld:OpenArenaWorld|null;
  private readonly projection:OpenArenaProjection|null;
  private readonly prompt:Interactable|null;
  private readonly contacts=new Map<string,StrikeSpec>();private readonly strikes=new StrikeRunner();
  private portal:ArenaRoomPortal|null=null;private context:ShardContext|null=null;private kit:HeldSlotKit|null=null;
  private skipKeys=false;private skipTouch=false;private hurtWhy='';private hurtT=0;
  private readonly entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number}|null;
  get world():OpenArenaWorld{if(this.openWorld===null)throw new Error('Not an open arena');return this.openWorld;}
  get data():ArenaScriptData{if(this.openRows===null)throw new Error('Not an open arena');return this.openRows;}
  get openFight():OpenArenaProjection{if(this.projection===null)throw new Error('Not an open arena');return this.projection;}
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
      const projection=this.projection=new OpenArenaProjection(source.world,this,source.rows);
      this.spareLight=new THREE.PointLight(source.rows.view.light.colour,0,1,2);this.spareLight.position.set(source.rows.arena.body.x,source.rows.view.light.y,source.rows.arena.body.z);source.world.game.scene.add(this.spareLight);
      const spot=projection.cairnSpot();this.prompt={position:new THREE.Vector3(spot.x,spot.y+source.rows.view.promptLift,spot.z),radius:0,label:source.rows.lines.tie,onInteract:()=>{this.tie();}};
    }
  }
  async buildSliced(world:{readonly scene:THREE.Scene;readonly registry:WorldRegistry}):Promise<this>{
    const dungeon=this.room;if(dungeon===null)throw new Error('Open arena is already constructed');
    await dungeon.buildSliced(true,macrotask);await macrotask();world.scene.add(dungeon.group,this.spareLight);dungeon.register(world.registry);
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
    const answer=fight.life.event('tie',{engaged:Number(this.engaged),victory:Number(boss.state==='victory'),hit:Number(boss.reward!==null),mounted:Number(this.mounted()),storm:Number(this.world.weather.stormActive)});
    if(answer['arm']===1){fight.tied=true;if(answer['disarm']===1)boss.disarm();boss.arm();}const line=this.data.tieLines[answer['index']??-1];if(line)this.toast(line);
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
    prompt.radius=answer['radius']??0;prompt.label=answer['label']===1?this.data.lines.tieOnFoot:answer['label']===2?this.data.lines.tieQuiet:this.data.lines.tie;
    if(answer['disarm']===1){fight.tied=false;boss.disarm();}const p=this.player.position;p.x=answer['x']??p.x;p.z=answer['z']??p.z;
    if(answer['hurt']===1)this.contact('wall',p,this.data.view.wallDamage,this.data.lines.wall);
    if(answer['clear']===1){fight.tied=false;this.world.air.force(this.data.weather.clearing);const saved=enteredAdventurePersistence(this.context.scope);saved.kill(this.data.record.kind,this.data.record.variant);saved.feat(this.data.record.kind);}
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
  return new ArenaRoomEncounter(new BossArenaRoom(room,geometry),encounter,entrance).buildSliced({ scene: world.game.scene,registry: ctx.app.registry });
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
  // G639: the fight's programmes admit in their own build slices, into the same level-scope cache the encounter's
  // constructor reads (one Nalati world-hook frame held the read, both admissions and the views: 136 ms at phone 4x)
  for (const program of [data.programs.attack, data.programs.wind]) { await buildYield(owner); constructionLive(); ReturnProgram.page(program, owner); }
  await buildYield(owner); constructionLive();
  const encounter = new ArenaRoomEncounter({kind:'open',world:{game,player,
    get weather() { return weatherOwner().storm; }, get air() { return weatherOwner().air; },tieSpot:point},rows:data}); constructionLive();
  ctx.answer('weather.storm-hold', held => Math.max(held, Number(encounter.engaged))); constructionLive();
  return encounter;
}

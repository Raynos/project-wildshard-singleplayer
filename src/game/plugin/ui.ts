import { ktx2TranscodeSupport } from '@wildshard/engine/core/ktx2';
import type { MoverView } from './mover';
import "../quest/presentation.css";
import { parseClientChannels, type ClientChannelProgram, type ClientChannelProperty } from '@wildshard/format/clientChannels';
import { AdditiveBlending, Euler, PerspectiveCamera, Quaternion, Scene, ShaderMaterial, Vector3, Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { ParticlePool, pointScale } from '@wildshard/engine/fx/ParticlePool';
import { CLIENT_SCRIPT_LIMITS, type ClientScriptFrame } from '@wildshard/engine/script/client';
import type { SystemSpec } from '@wildshard/engine/app/systems';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { Events } from '@wildshard/engine/events/events';
import type { HudVerbs, LevelContext } from '@wildshard/engine/level/context';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import type { MapMark } from '@wildshard/engine/ui/Minimap';
import { Flags } from '@wildshard/engine/world/interact/flags';
import type { MoverPose } from '@wildshard/engine/physics/mover';
import type { Place, Interactable } from '@wildshard/engine/world/interact/types';
import { QuestState, type QuestDef, type QuestStep, type NpcDef } from '@wildshard/engine/quest/core';
import { QuestChip, NpcTalk, placesWithDiscovery, type LiveMarker, type PlacePoint, type Places, type NpcTalkOpts } from '@wildshard/engine/quest/view';
import { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { QuestRewardBeat, type QuestRewardSpec, type QuestRewardPlayer } from '../quest/reward';
import { createLevelInstallation } from '@wildshard/engine/level/installation';
import { type ShardContext, gridCells, pageGridInstance, type PageMode, sourceManifest } from './context';
import type { BossDefinition, BossSaved, BossScript } from '@wildshard/engine/ai/BossBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { CoinBurst } from '../loot/CoinBurst';
import { DirectorBossBrain } from './director';
import { bindRuntimeQuest, type RuntimeBoss, type RuntimeCoins, type RuntimeQuestPorts } from './headless';
import { type Shardfile, parseShardfile } from '@wildshard/format/shardSchema';
import { npcDef, type NpcRow } from './quests';
import { parseBossProfile, type MarkedBossPresentation } from '@wildshard/format/bossProfiles';
import { bossFight, type HeldBossBrain } from './bossPhase';
import { installEnteredRuntimeService, retainsRuntimeServices } from '../shard/retainedHooks';
import type { EffectDef } from '@wildshard/engine/combat/effects/types';
import { STARTER_EFFECT_ROWS } from '../systems/effects/starter.generated';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { bindPlayerEffects, type EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import { StatusIcons } from '../systems/effects/view';
import { GridAssembly, type GridCell } from '../grid/assembly';
import { pageGridIntents } from '../grid/intent';
import { DEVSERVER, gridMode, type MenuMode } from '../grid/menu';
import { findShard, game } from '../shard/registry';
import { chooseShardEntry, shardEntries } from '../shard/entryMode';
import { travel } from '../travel/travel';
import { PageResidency } from '../grid/pageResidency';
import { gridRecovery, recoveryCatalogue, type GridRecoveryRecord } from '../grid/recovery';
import { app as pageApp } from '@wildshard/engine/app/runtime';
import { setPageMode } from '../grid/pageMode';
import type { SaveStore } from '@wildshard/engine/saves/store';
import type { ShardManifest } from '../shard/manifest';
import { runtimeAccountedBytes } from '@wildshard/format/runtimeCost';
import { ResidencyAllocator } from '../grid/allocator';
import { MemoryAdmission } from '@wildshard/format/product';
import { isDev } from '@wildshard/engine/core/devMode';
import { contentCost } from '@wildshard/format/contentCost';
import { CONTENT_CAPS, _applyChunkConstants } from '@wildshard/engine/core/config';
import type { App } from '@wildshard/engine/app/app';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { configureLevel } from '@wildshard/engine/level/selection';
import { installShards, shards } from '../shard/list';
import { toLevelSpec } from '../shard/spec';
import { SHARDFILE_VERSION } from '@wildshard/format/version';
import { emptyLook } from '../shardfile/emptyLook';
import { shardfileLook } from '../shardfile/look';
import { admitProduct, boundedResponse, browserContentHash, browserProductCache, type AdmittedProduct, type ProductOptions } from '../shardfile/product';
import { ClientAssets } from '../shardfile/clientAssets';
import type { ShardfileClientBindings } from '../shardfile/client';
import { clientGround } from '../shardfile/clientGround';
import { shardfileWater } from '../shardfile/water';
import { clientResidency } from '../shardfile/clientResidency';
import { firstPartyInstance } from '../grid/instances';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { preflightShardfile } from '@wildshard/format/preflight';



/**
 * The client-script view adapter (SHARD-PLATFORM SF25, the render side; G66 "frozen, but alive-looking"). sp-x5's
 * `ClientScriptLane` runs presentation-only AssemblyScript and hands back detached frames (`offset`, `rotation`,
 * `scale`, particle requests); this adapter is the only thing that turns them into pixels:
 *
 * - **pose on top of the pose**: each frame, after the views have written their own pose (a creature view's sim sync,
 *   a placed panel), `apply` composes the script's offset (in the target's own frame), rotation and scale on top of it;
 *   `restore` puts the exact base back before the next sim sync, so a live entity's sim pose is never replaced and a
 *   static one never drifts. A frame is eased in over a few render frames (the lane ticks at 60 / divisor Hz).
 * - **particles**: every emitter's requests spawn into one pooled `THREE.Points` draw (the engine's `ParticlePool`),
 *   sized to the declared live limits (never above the lane's global ceiling), so the cost is one draw whatever the count.
 *   Their look (colour, size, velocity, gravity) is the emitter's numeric recipe; lifetimes are the lane's.
 * - **scope-owned**: disposal restores every base pose and frees the pool's geometry and material.
 *
 * The adapter never reads or writes a simulation: it sees the lane's copies and the view objects only.
 */





type Vec3 = readonly [number, number, number];
/** The part of a client lane the adapter reads: detached frames, nothing else. */
export interface ClientScriptFrames { readonly frames: () => readonly ClientScriptFrame[] }
/** One admitted emitter's numeric look (sp-x5's `platform.particles` recipe) and its declared live limit. */
export interface ClientScriptEmitterLook { readonly id: number; readonly live: number; readonly colour: Vec3; readonly size: number; readonly velocity: Vec3; readonly gravity: number }
/** One bound visual: the view object a pose composes onto (null: particles only) and where its particles start. */
export interface ClientScriptViewTarget {
  readonly entity: number;
  readonly object: Object3D | null;
  /** the particle origin in the adapter root's space */
  readonly anchor: (out: Vector3) => Vector3;
  readonly emitters: readonly ClientScriptEmitterLook[];
}
/** The adapter's readout (tests, the debug panel). */
export interface ClientScriptViewState { readonly targets: number; readonly posed: number; readonly particles: number; readonly capacity: number; readonly tick: number }

const VERTEX = /* glsl */ `
attribute vec3 aColour; attribute float aSize; attribute float aAlpha;
uniform float uScale; varying vec3 vColour; varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vColour = aColour; vAlpha = aAlpha;
}`;
const FRAGMENT = /* glsl */ `
varying vec3 vColour; varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p);
  if (d > 1.0 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(vColour, vAlpha * (1.0 - d));
}`;
const PARK_Y = -10_000;

interface Posed { readonly target: ClientScriptViewTarget; readonly object: Object3D; readonly base: { p: Vector3; q: Quaternion; s: Vector3 }; saved: boolean;
  /** the eased pose being drawn */ readonly offset: Vector3; readonly rotation: Vector3; readonly scale: Vector3 }

/** a deterministic jitter in [-1, 1] from integers (no clock, no Math.random) */
function jitter(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Applies one client lane's frames to its bound views and particles; disposed with `scope`. */
export class ClientScriptViews {
  private readonly lane: ClientScriptFrames;
  private readonly targets: ReadonlyMap<number, ClientScriptViewTarget>;
  private readonly posed: readonly Posed[];
  private readonly pool: ParticlePool<'aColour' | 'aSize' | 'aAlpha'> | null;
  private readonly lifetimes: Float32Array;
  private readonly gravity: Float32Array;
  private readonly material: ShaderMaterial | null;
  private seen = -1;
  private alive = 0;
  private disposed = false;
  private readonly _v = new Vector3();
  private readonly _q = new Quaternion();
  private readonly _e = new Euler();

  constructor(lane: ClientScriptFrames, targets: readonly ClientScriptViewTarget[], ports: { root: Object3D; scope: Scope }) {
    this.lane = lane;
    this.targets = new Map(targets.map((t) => [t.entity, t]));
    if (this.targets.size !== targets.length) throw new Error('client script views: one view per bound entity');
    this.posed = targets.flatMap((target): Posed[] => target.object === null ? [] : [{ target, object: target.object, saved: false,
      base: { p: new Vector3(), q: new Quaternion(), s: new Vector3(1, 1, 1) }, offset: new Vector3(), rotation: new Vector3(), scale: new Vector3(1, 1, 1) }]);
    const capacity = Math.min(CLIENT_SCRIPT_LIMITS.particlesLive, targets.reduce((n, t) => n + t.emitters.reduce((m, e) => m + e.live, 0), 0));
    this.lifetimes = new Float32Array(capacity); this.gravity = new Float32Array(capacity);
    if (capacity > 0) {
      const material = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: AdditiveBlending });
      const pool = new ParticlePool({ capacity, material, renderOrder: 6, parkY: PARK_Y,
        attributes: { aColour: { itemSize: 3, dynamic: true }, aSize: { itemSize: 1, dynamic: true }, aAlpha: { itemSize: 1, dynamic: true } } });
      pool.points.name = 'client-script-particles';
      const scale = material.uniforms['uScale'];
      pool.points.onBeforeRender = (renderer, _scene, camera) => { if (scale !== undefined && camera instanceof PerspectiveCamera) scale.value = pointScale(renderer, camera); };
      ports.root.add(pool.points);
      this.pool = pool; this.material = material;
    } else { this.pool = null; this.material = null; }
    ports.scope.onDispose(() => { this.dispose(); });
  }

  /** Put every composed view back to the base it had before `apply` (run before the views write their own pose). */
  restore(): void {
    for (const p of this.posed) {
      if (!p.saved) continue;
      p.object.position.copy(p.base.p); p.object.quaternion.copy(p.base.q); p.object.scale.copy(p.base.s); p.saved = false;
    }
  }

  /** Compose the latest frames onto the views and advance the particles by `dt` seconds (run after the views' own pose). */
  apply(dt: number): void {
    if (this.disposed) return;
    this.restore();
    const frames = this.lane.frames(), ease = 1 - Math.exp(-Math.max(0, dt) * 14);
    const byEntity = new Map(frames.map((f) => [f.entity, f]));
    for (const p of this.posed) {
      const frame = byEntity.get(p.target.entity), o = p.object;
      if (frame !== undefined) {
        p.offset.lerp(this._v.fromArray(frame.offset), ease); p.rotation.lerp(this._v.fromArray(frame.rotation), ease); p.scale.lerp(this._v.fromArray(frame.scale), ease);
      }
      p.base.p.copy(o.position); p.base.q.copy(o.quaternion); p.base.s.copy(o.scale); p.saved = true;
      o.position.add(this._v.copy(p.offset).applyQuaternion(p.base.q));
      o.quaternion.multiply(this._q.setFromEuler(this._e.set(p.rotation.x, p.rotation.y, p.rotation.z, 'YXZ')));
      o.scale.multiply(p.scale);
    }
    const tick = frames[0]?.tick ?? -1;
    if (tick > this.seen) { this.seen = tick; for (const frame of frames) this.emit(frame); }
    this.particles(dt);
  }

  private emit(frame: ClientScriptFrame): void {
    const pool = this.pool, target = this.targets.get(frame.entity);
    if (pool === null || target === undefined) return;
    for (const request of frame.particles) {
      const look = target.emitters.find((e) => e.id === request.emitter); if (look === undefined) continue;
      const at = target.anchor(this._v);
      for (let k = 0; k < request.count; k++) {
        const i = pool.claim(), j = (n: number): number => jitter(frame.tick, frame.entity * 31 + k, n);
        if (this.lifetimes[i] === undefined) continue;
        if ((this.lifetimes[i] ?? 0) <= 0) this.alive++;
        pool.place(i, { x: at.x + j(1) * 0.15, y: at.y + j(2) * 0.08, z: at.z + j(3) * 0.15 });
        pool.vel[i * 3] = look.velocity[0] * (1 + j(4) * 0.25) + j(5) * 0.1; pool.vel[i * 3 + 1] = look.velocity[1] * (1 + j(6) * 0.25); pool.vel[i * 3 + 2] = look.velocity[2] * (1 + j(7) * 0.25) + j(8) * 0.1;
        pool.life[i] = request.lifetimeTicks / 60; this.lifetimes[i] = request.lifetimeTicks / 60; this.gravity[i] = look.gravity;
        pool.data.aColour.set(look.colour, i * 3); pool.data.aSize[i] = look.size; pool.data.aAlpha[i] = 1;
      }
    }
  }

  private particles(dt: number): void {
    const pool = this.pool; if (pool === null || this.alive === 0) return;
    const { pos, vel, life } = pool, alpha = pool.data.aAlpha;
    for (let i = 0; i < pool.capacity; i++) {
      const total = this.lifetimes[i] ?? 0; if (total <= 0) continue;
      const left = (life[i] ?? 0) - dt;
      if (left <= 0) { life[i] = 0; this.lifetimes[i] = 0; alpha[i] = 0; pos[i * 3 + 1] = PARK_Y; this.alive--; continue; }
      life[i] = left;
      vel[i * 3 + 1] = (vel[i * 3 + 1] ?? 0) + (this.gravity[i] ?? 0) * dt;
      pos[i * 3] = (pos[i * 3] ?? 0) + (vel[i * 3] ?? 0) * dt; pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + (vel[i * 3 + 1] ?? 0) * dt; pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + (vel[i * 3 + 2] ?? 0) * dt;
      const u = left / total; alpha[i] = Math.min(1, u * 3) * Math.min(1, (1 - u) * 6 + 0.2);
    }
    pool.posAttr.needsUpdate = true; pool.attr.aColour.needsUpdate = true; pool.attr.aSize.needsUpdate = true; pool.attr.aAlpha.needsUpdate = true;
  }

  state(): ClientScriptViewState {
    return { targets: this.targets.size, posed: this.posed.length, particles: this.alive, capacity: this.pool?.capacity ?? 0, tick: this.seen };
  }

  /** Restore every base pose and free the particle draw; further `apply` calls draw nothing. */
  dispose(): void {
    if (this.disposed) return;
    this.restore(); this.disposed = true;
    const pool = this.pool;
    if (pool !== null) { pool.points.removeFromParent(); pool.points.geometry.dispose(); }
    this.material?.dispose();
  }
}

/** Run the adapter in the page's frame: restore at input (before the views' sim sync), compose at late. */
export function driveClientScriptViews(views: ClientScriptViews, ports: { system: (spec: { id: string; phase: 'input' | 'late'; run: (dt: number) => void }) => void; id: string }): void {
  ports.system({ id: `${ports.id}.restore`, phase: 'input', run: () => { views.restore(); } });
  ports.system({ id: `${ports.id}.apply`, phase: 'late', run: (dt) => { views.apply(dt); } });
}

/** World position and label for a quest objective, with an optional dialogue NPC. */
export interface QuestTarget {
  position: Vector3;
  label: string;
  short?: string;
  npc?: QuestPresentationNpc;
}
/** Authored dialogue and proximity hooks for a quest giver or step target. */
export interface QuestPresentationNpc {
  npc: NpcDef;
  at: Vector3;
  label: string;
  speaker: NpcTalkOpts['speaker'];
  radius?: number;
  /** A target NPC is offered only during this step; omit for a persistent quest giver. */
  step?: string;
  onOpen?: NonNullable<NpcTalkOpts['onOpen']>;
  onDone?: NonNullable<NpcTalkOpts['onDone']>;
}
/** A quest step with its display title and world target. */
export interface PresentedQuestStep extends Omit<QuestStep, 'objective'> {
  title: string;
  target: QuestTarget;
}
/** Quest data whose steps have authored presentation targets. */
export interface PresentedQuestDef extends Omit<QuestDef, 'steps'> { steps: PresentedQuestStep[] }
/** Scoped marker, dialogue, reward and toast choices for the existing quest UI. */
export interface QuestPresentationOptions {
  flags?: Flags;
  /** Resolve existing POI-local markers; simple target positions need no resolver. */
  place?: (at: Place) => { x: number; y: number; z: number };
  introTitle?: string;
  npc?: QuestPresentationNpc;
  npcs?: QuestPresentationNpc[];
  places?: PlacePoint[];
  reward?: QuestRewardSpec | false;
  /** Existing adventures can retain their authored beat strings and leftovers. */
  stepToast?: (step: QuestStep, previous: QuestStep | null, quest: QuestState) => string;
  stepCompleteToast?: false | ((step: QuestStep) => string);
  completeToast?: (quest: QuestState) => string;
  chip?: () => { label: string; count: string };
  markers?: () => LiveMarker[];
  worldPins?: boolean;
  mapMarkers?: boolean;
  minimapMarks?: boolean;
}
/** Owned play services required to present a quest without owning its state. */
export interface QuestPresentationHost {
  scope: Scope;
  player: QuestRewardPlayer;
  toast: (text: string) => void;
  sting: () => void;
  pin?: HudVerbs['pin'];
  fullMap?: { setQuest?: (source: () => MapQuest | null) => void; addQuest?: (source: () => MapQuest | null) => () => void; addPois?: (source: () => MapPoi[]) => () => void };
  minimap?: { addMarks: (source: () => readonly MapMark[]) => () => void } | null;
  prompts?: NpcTalk['prompt'][];
  stowWeapon?: (on: boolean) => void;
  setViewmodel?: (on: boolean) => void;
  dayNight?: { phase: number } | null;
}
/** The live quest presentation and its entered-scope update/disposal ports. */
export interface QuestPresentation {
  quest: QuestState;
  chip: QuestChip;
  markers: () => LiveMarker[];
  places: Places | null;
  reward: QuestRewardBeat | null;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}
/** Structural play-context port; a ShardContext supplies all of it. */
export interface QuestPresentationContext {
  scope: Scope;
  app: { events: Events };
  manifest: { slug: string };
  system: (spec: SystemSpec) => void;
  hud: Pick<HudVerbs, 'pin'>;
  game: { runtime?: {
    world: { player: QuestRewardPlayer; sky: { dayNight?: { phase: number } | null } } | null;
    play: {
      hud: { toast: (text: string) => void };
      music: { sting: (name: 'chunk') => void };
      weapons: { visible: boolean; stowed: boolean };
      fullMap: NonNullable<QuestPresentationHost['fullMap']>;
      minimap?: QuestPresentationHost['minimap'];
    } | null;
    interactables: NpcTalk['prompt'][];
  } };
}

/** Shared wiring for older adventures that own their frame order. New shards use installQuestPresentation. */
export function presentQuest(host: QuestPresentationHost, quest: QuestState, options: QuestPresentationOptions = {}): QuestPresentation {
  const scope = host.scope.child(`quest.${quest.def.id}`);
  const resolve = options.place ?? ((at: Place) => {
    if (at.poi !== 'world' || at.anchor !== undefined) throw new Error('Quest POI markers require a place resolver');
    return { x: at.x, y: (at.y ?? 0) + (at.dy ?? 0), z: at.z };
  });
  const markers = (): LiveMarker[] => quest.markers().map((m) => {
    const p = resolve(m.at);
    return { id: m.id, label: m.label, short: m.short ?? m.label, x: p.x, z: p.z };
  });
  const chip = new QuestChip({ chip: options.chip ?? (() => quest.chip()), markers: options.markers ?? markers });
  scope.onDispose(() => { chip.line.scope.dispose(); });
  const onStep: NonNullable<QuestState['onStep']> = (step, prev) => {
    if (prev && typeof options.stepCompleteToast === 'function') host.toast(options.stepCompleteToast(prev));
    if (step) host.toast(options.stepToast?.(step, prev, quest) ?? (prev === null ? `New quest · ${quest.def.title}` : `Objective · ${quest.objective()}`));
    host.sting();
  };
  const onComplete = (): void => { host.toast(options.completeToast?.(quest) ?? `Quest complete · ${quest.def.title}`); };
  scope.onDispose(quest.observe({ step: onStep, complete: onComplete }));
  const card = (): MapQuest => ({ title: quest.isStarted ? quest.def.title : options.introTitle ?? quest.def.title, objective: quest.objective(), hint: quest.isComplete ? '' : quest.hint() });
  if (host.fullMap?.addQuest) scope.onDispose(host.fullMap.addQuest(card));
  else host.fullMap?.setQuest?.(card);
  const flags = options.flags ?? quest.flags;
  const places = options.places ? placesWithDiscovery(options.places, flags, host.toast, markers) : null;
  if (options.mapMarkers !== false && host.fullMap?.addPois) scope.onDispose(host.fullMap.addPois(() => places?.mapPois() ?? markers().map((m) => ({ x: m.x, z: m.z, label: m.label, short: m.short, kind: 'quest' }))));
  if (options.minimapMarks !== false && host.minimap) scope.onDispose(host.minimap.addMarks(() => markers().map((m) => ({ x: m.x, z: m.z, color: '#8fe3ff' }))));

  const pins = new Map<string, { root: HTMLElement; distance: HTMLElement; position: Vector3 }>();
  if (options.worldPins !== false && host.pin) {
    const all = [...(quest.def.intro?.markers ?? []), ...quest.def.steps.flatMap((step) => step.markers ?? [])];
    for (const m of all) {
      // The same id can occur at a different position in a later step; projection reads the active marker.
      if (pins.has(m.id)) continue;
      const root = document.createElement('span'); root.className = 'ws-quest-pin';
      const label = document.createElement('span'), distance = document.createElement('b');
      root.append(label, distance);
      const position = new Vector3(); pins.set(m.id, { root, distance, position });
      host.pin(() => {
        if (scope.disposed || practiceRoom.open) return null;
        const active = quest.markers().find((a) => a.id === m.id);
        if (!active) return null;
        const at = resolve(active.at); position.set(at.x, at.y + 2.2, at.z);
        label.textContent = active.short ?? active.label;
        return position;
      }, root);
      scope.onDispose(() => { root.remove(); });
    }
  }
  const npcs = [...(options.npc ? [options.npc] : []), ...(options.npcs ?? [])];
  const dialogue = npcs.length > 0 ? new DialogueBox(scope.child('dialogue')) : null;
  const talks = dialogue ? npcs.map((npc) => {
    const talk = new NpcTalk({ ...npc, radius: npc.radius ?? 3.2, flags, dialogue });
    const prompt = { ...talk.prompt, get radius() { return npc.step === undefined || quest.current?.id === npc.step || talk.talking ? talk.prompt.radius : 0; } };
    host.prompts?.push(prompt);
    scope.onDispose(() => {
      const i = host.prompts?.indexOf(prompt) ?? -1; if (i >= 0) host.prompts?.splice(i, 1);
      npc.speaker.talking = false;
    });
    return talk;
  }) : [];
  let stowed = false;
  scope.onDispose(() => { if (stowed) host.stowWeapon?.(false); });
  const reward = options.reward !== undefined && options.reward !== false ? new QuestRewardBeat({ ...host, scope, objective: chip.line.root }, options.reward) : null;
  const update = (dt: number, t: number): void => {
    if (scope.disposed || practiceRoom.open) return;
    chip.update(t, host.player);
    places?.update(host.player.position.x, host.player.position.z, host.player.position.y);
    for (const pin of pins.values()) pin.distance.textContent = `${Math.round(Math.hypot(pin.position.x - host.player.position.x, pin.position.z - host.player.position.z))} m`;
    dialogue?.update(dt); for (const talk of talks) talk.update(host.player.position);
    const talking = talks.some((talk) => talk.talking);
    if (talking !== stowed) { stowed = talking; host.stowWeapon?.(stowed); }
    reward?.update(dt);
  };
  return { quest, chip, markers, places, reward, update, dispose: () => { scope.dispose(); } };
}

/** One call in play(ctx): Wendell's chip, MAP card, diamonds, world pins, discovery, dialogue and reward. */
export function installQuestPresentation(ctx: QuestPresentationContext, source: QuestState | QuestDef | PresentedQuestDef, options: QuestPresentationOptions = {}): QuestPresentation {
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (!runtime || !world || !play || ctx.scope.disposed) throw new Error('Quest presentation requires a live play host');
  const flags = options.flags ?? (source instanceof QuestState ? source.flags : new Flags(ctx.manifest.slug));
  const def: QuestDef | null = source instanceof QuestState ? null : { ...source, steps: source.steps.map((s) => {
    if (!('target' in s)) return s;
    const { target, title, ...step } = s;
    return { ...step, objective: title, markers: s.markers ?? [{ id: s.id, label: target.label, ...(target.short === undefined ? {} : { short: target.short }), at: { poi: 'world', x: target.position.x, y: target.position.y, z: target.position.z } }] };
  }) };
  const quest = source instanceof QuestState ? source : new QuestState(def ?? source as QuestDef, flags, ctx.app.events, ctx.scope);
  const targetNpcs = source instanceof QuestState ? [] : source.steps.flatMap((s) => 'target' in s && s.target.npc ? [{ ...s.target.npc, step: s.id }] : []);
  const targetPlaces = source instanceof QuestState ? [] : source.steps.flatMap((s) => 'target' in s ? [{ id: `${source.id}.${s.id}`, label: s.target.label, x: s.target.position.x, y: s.target.position.y, z: s.target.position.z, r: 12 }] : []);
  const alreadyComplete = quest.isComplete;
  const reward: QuestRewardSpec | false = options.reward ?? { kicker: 'Quest complete', title: quest.def.title, subtitle: '', when: () => !alreadyComplete && quest.isComplete, finish: () => undefined };
  const presentation = presentQuest({ scope: ctx.scope, player: world.player, toast: (text) => { play.hud.toast(text); }, sting: () => { play.music.sting('chunk'); },
    pin: ctx.hud.pin, fullMap: play.fullMap, minimap: play.minimap ?? null, prompts: runtime.interactables,
    dayNight: world.sky.dayNight ?? null, setViewmodel: (on) => { play.weapons.visible = on; }, stowWeapon: (on) => { play.weapons.stowed = on; } }, quest, { ...options, flags, reward,
      stepCompleteToast: options.stepCompleteToast ?? ((step) => `Step complete · ${step.chip ?? step.objective}`),
      places: options.places ?? targetPlaces, npcs: [...(options.npcs ?? []), ...targetNpcs] });
  ctx.system({ id: `game.quest.${quest.def.id}`, phase: 'update', when: (app) => app.state === 'play', run: presentation.update });
  if (!(source instanceof QuestState)) {
    const disposeView = presentation.dispose;
    presentation.dispose = () => { disposeView(); quest.dispose(); };
  }
  return presentation;
}

/** Keep quest state resident while rebuilding its ordinary presentation and input in each entered cell scope. */
export function installEnteredQuestPresentation(context: ShardContext, quest: QuestState, options: QuestPresentationOptions = {}): () => QuestPresentation | null {
  if (!retainsRuntimeServices(context)) throw new Error('Entered quest presentation needs a retained context');
  let current: QuestPresentation | null = null;
  installEnteredRuntimeService(context, scope => {
    // A fresh ordinary installation binds pins and systems to this entry without registering new retained installers.
    const installation = createLevelInstallation(context.app, scope, context.app.levelAdapters, () => context.progress);
    const presentation = installQuestPresentation({ ...context, ...installation.context }, quest, options);
    current = presentation;
    scope.onDispose(() => { presentation.dispose(); if (current === presentation) current = null; });
  });
  return () => current;
}


/** A detached visual observation; only these numeric values and the clock cross the presentation boundary. */
export interface ClientChannelObservation { readonly time: number; readonly delta: number; readonly values: readonly number[] }
/** Read-only visual output; property getters expose no writable storage or authoritative object. */
export type ClientChannelFrame = Readonly<Partial<Record<ClientChannelProperty, number>>>;
/** A capability-limited numeric lane; it has no state setter, physics port, event writer or player reference. */
export function createClientChannels(input: unknown): {
  readonly reads: readonly string[]; readonly frame: ClientChannelFrame; evaluate: (observation: ClientChannelObservation) => void;
} {
  const program = parseClientChannels([input])[0]; if (program === undefined) throw new Error('Missing client channel program');
  const nodes = structuredClone(program.nodes), scratch = new Float64Array(nodes.length), published = new Float64Array(nodes.length), reads = new Float64Array(program.reads.length);
  const slots = structuredClone(program.locals ?? []), locals = new Float64Array(slots.length), previous = new Float64Array(slots.length), next = new Float64Array(slots.length);
  let initialized = false;
  const frame: Partial<Record<ClientChannelProperty, number>> = {};
  for (const channel of program.channels) Object.defineProperty(frame, channel.property, { enumerable: true, get: () => published[channel.value] });
  Object.freeze(frame);
  const evaluate = (observation: ClientChannelObservation): void => {
    const { time, delta, values } = observation;
    if (!Number.isFinite(time) || !Number.isFinite(delta) || delta < 0 || Math.abs(time) > 1e12 || delta > 1e12 || values.length !== reads.length) throw new Error('Invalid copied client observation');
    for (let i = 0; i < reads.length; i++) { const value = values[i]; if (value === undefined || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Invalid copied client state'); reads[i] = value; }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]; if (slot === undefined) throw new Error('Missing private client slot');
      previous[i] = initialized ? locals[i] ?? Number.NaN : slot.initial.op === 'constant' ? slot.initial.value : reads[slot.initial.index] ?? Number.NaN;
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]; if (node === undefined) throw new Error('Missing client expression');
      const a = 'a' in node ? scratch[node.a] ?? Number.NaN : 0, b = 'b' in node ? scratch[node.b] ?? Number.NaN : 0;
      let value: number;
      switch (node.op) {
        case 'constant': value = node.value; break;
        case 'clock': value = node.value === 'time' ? time : delta; break;
        case 'read': value = reads[node.index] ?? Number.NaN; break;
        case 'local': value = previous[node.index] ?? Number.NaN; break;
        case 'neg': value = -a; break;
        case 'sin': value = Math.sin(a); break;
        case 'cos': value = Math.cos(a); break;
        case 'sqrt': value = Math.sqrt(a); break;
        case 'abs': value = Math.abs(a); break;
        case 'add': value = a + b; break;
        case 'sub': value = a - b; break;
        case 'mul': value = a * b; break;
        case 'div': value = a / b; break;
        case 'mod': value = a % b; break;
        case 'min': value = Math.min(a, b); break;
        case 'max': value = Math.max(a, b); break;
        case 'atan2': value = Math.atan2(a, b); break;
        case 'hypot': value = Math.hypot(a, b); break;
        case 'hypot3': value = Math.hypot(a, b, scratch[node.c] ?? Number.NaN); break;
        case 'sample': {
          const last = node.keys.at(-1); if (last === undefined) throw new Error('Missing keyframe endpoint');
          value = last[1];
          for (let segment = 1; segment < node.keys.length; segment++) {
            const start = node.keys[segment - 1], end = node.keys[segment];
            if (start === undefined || end === undefined) throw new Error('Missing keyframe segment');
            if (a > end[0]) continue;
            const u = Math.max(0, Math.min(1, (a - start[0]) / Math.max(1e-6, end[0] - start[0])));
            const eased = node.interpolation === 'smoothstep' ? u * u * (3 - 2 * u) : u;
            value = start[1] + (end[1] - start[1]) * eased; break;
          }
          break;
        }
        case 'gt': value = Number(a > b); break;
        case 'select': value = (scratch[node.test] ?? Number.NaN) !== 0 ? scratch[node.yes] ?? Number.NaN : scratch[node.no] ?? Number.NaN; break;
        default: throw new Error('Unknown client operation');
      }
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Non-finite or excessive client expression');
      scratch[i] = value;
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]; if (slot === undefined) throw new Error('Missing private client slot');
      next[i] = scratch[slot.next] ?? Number.NaN;
    }
    published.set(scratch); locals.set(next); initialized = true;
  };
  return Object.freeze({ reads: Object.freeze([...program.reads]), frame, evaluate });
}

/** Bind admitted numeric outputs only to named private scene objects; authoritative player/shared objects refuse. */
export function createClientChannelView(input: unknown, targets: ReadonlyMap<string, unknown>): ReturnType<typeof createClientChannels> {
  const program = parseClientChannels([input])[0];
  if (program?.bindings === undefined) throw new Error('Missing visual channel bindings');
  const bindings = program.bindings.map(binding => {
    const object = targets.get(binding.target);
    if (!(object instanceof Object3D)) throw new Error('Client channel target must be a private scene object');
    return { ...binding, object };
  });
  const lane = createClientChannels(program);
  const evaluate = (observation: ClientChannelObservation): void => {
    lane.evaluate(observation);
    for (const binding of bindings) {
      const { object, property, order } = binding, value = lane.frame[property];
      if (value === undefined) throw new Error('Missing bound visual channel');
      if (order !== undefined) object.rotation.order = order;
      switch (property) {
        case 'x': object.position.x = value; break;
        case 'y': object.position.y = value; break;
        case 'z': object.position.z = value; break;
        case 'pitch': object.rotation.x = value; break;
        case 'yaw': object.rotation.y = value; break;
        case 'roll': object.rotation.z = value; break;
        case 'scaleX': object.scale.x = value; break;
        case 'scaleY': object.scale.y = value; break;
        case 'scaleZ': object.scale.z = value; break;
        case 'visible': object.visible = value !== 0; break;
        default: throw new Error('Unknown visual channel target');
      }
    }
  };
  return Object.freeze({ reads: lane.reads, frame: lane.frame, evaluate });
}

/** Copy only the fixed mover ABI's published observations, never its world or module memory. */
function moverChannelValues(reads: readonly string[], pose: MoverPose, fields: Readonly<Record<number, number>>): number[] {
  return reads.map(read => {
      if (read === 'enabled') return Number(pose.enabled);
      if (read.startsWith('position.')) {
        const axis = read.slice(9); if (axis === 'x' || axis === 'y' || axis === 'z') return pose.position[axis];
      }
      if (read.startsWith('euler.')) {
        const axis = read.slice(6); if (axis === 'x' || axis === 'y' || axis === 'z') return pose.euler[axis];
      }
      const field = /^field\.([1-6])$/u.exec(read), key = field?.[1];
      const value = key === undefined ? undefined : fields[Number(key)];
      if (value === undefined) throw new Error('Missing copied mover field');
      return value;
  });
}

/** Project copied mover observations through an admitted visual program; native bodies and script clocks stay external. */
export function moverChannelView(program: ClientChannelProgram, targets: ReadonlyMap<string, unknown>,
  observed?: (frame: ClientChannelFrame) => void): MoverView {
  if (program.mover === undefined) throw new Error('Missing declared mover channel source');
  const view = createClientChannelView(program, targets);
  return { pose: (pose, fields) => {
    const values = moverChannelValues(view.reads, pose, fields);
    view.evaluate({ time: 0, delta: 0, values }); observed?.(view.frame);
  } };
}

/** Bind declared visual programs to borrowed native movers without allocating bodies, clocks or authority. */
export function moverChannelViews(programs: readonly ClientChannelProgram[], targets: ReadonlyMap<string, unknown>,
  nativeOwners: readonly string[], observed?: (id: string, frame: ClientChannelFrame) => void): ReadonlyMap<string, MoverView> {
  if (nativeOwners.length > 32 || new Set(nativeOwners).size !== nativeOwners.length) throw new Error('Invalid native mover view owners');
  const views = new Map<string, MoverView>(nativeOwners.map(id => [id, { pose: () => undefined }]));
  const bound = new Set<string>();
  for (const program of programs) {
    const id = program.mover;
    if (id === undefined || program.bindings === undefined) continue;
    if (!views.has(id) || bound.has(id)) throw new Error('Mover channels require one borrowed native owner');
    bound.add(id); views.set(id, moverChannelView(program, targets, frame => { observed?.(id, frame); }));
  }
  return views;
}

/** A channel-owned prompt: copied coordinates plus a separately bound real input action. */
export function createClientChannelPrompt(input: unknown,
  bind: (action: NonNullable<ClientChannelProgram['prompt']>['action']) => (spot: Interactable) => void): {
    readonly spot: Interactable; readonly reads: readonly string[]; readonly evaluate: (observation: ClientChannelObservation) => void;
  } {
  const program = parseClientChannels([input])[0];
  if (program?.prompt === undefined) throw new Error('Missing declared client prompt');
  const declaration = structuredClone(program.prompt), action = bind(Object.freeze(declaration.action));
  const lane = createClientChannels(program);
  const spot: Interactable = { label: declaration.label, radius: declaration.radius,
    position: new Vector3(...declaration.at), onInteract: () => undefined };
  spot.onInteract = () => { action(spot); };
  const evaluate = (observation: ClientChannelObservation): void => {
    lane.evaluate(observation);
    const { x, y, z } = lane.frame;
    if (x === undefined || y === undefined || z === undefined) throw new Error('Missing prompt coordinates');
    spot.position.set(x, y, z);
  };
  return Object.freeze({ spot, reads: lane.reads, evaluate });
}
/** Normal input prompts driven only by admitted copied mover poses; evaluating them never commands a mover. */
export function moverChannelPrompts(programs: readonly ClientChannelProgram[],
  bind: (action: NonNullable<ClientChannelProgram['prompt']>['action']) => (spot: Interactable) => void): {
    readonly interactables: readonly Interactable[]; readonly update: (pose: (id: string) => MoverPose) => void;
  } {
  const rows = parseClientChannels(programs).flatMap(program => {
    if (program.prompt === undefined || program.mover === undefined) return [];
    return [{ id: program.mover, lane: createClientChannelPrompt(program, bind) }];
  });
  return Object.freeze({ interactables: Object.freeze(rows.map(row => row.lane.spot)), update: (pose: (id: string) => MoverPose) => {
    for (const row of rows) row.lane.evaluate({ time: 0, delta: 0, values: moverChannelValues(row.lane.reads, pose(row.id), {}) });
  } });
}

/** A quest's coin reward: the burst that flies the coins to the player, `pay`, which pays once per save, and `spawn`, any other coins through the same burst. */
export interface QuestReward { readonly burst: CoinBurst; readonly pay: () => undefined; readonly spawn: (amount: number, toast: string) => void }

/**
 * A declared quest's coin reward (SHARD-PLATFORM M3; Signal Dunes and Sky Reach): `amount` coins burst out of the player through the platform purse
 * (`coins`), the `toast` after the last lands; `paid` / `markPaid` are the save's once-only record (a quest flag, a shard
 * save). The burst lives on the play scene, or on a scene of its own headless.
 */
export function questReward(ctx: ShardContext, o: { readonly player: Vector3; readonly coins: RuntimeCoins; readonly amount: number; readonly paid: () => boolean; readonly markPaid: () => void; readonly toast: string }): QuestReward {
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  const spawn = (amount: number, toast: string): void => { burst.spawn(o.player, amount, o.coins, () => { ctx.game.runtime?.play?.hud.toast(toast); }); };
  const pay = (): undefined => {
    if (o.paid()) return undefined;
    o.markPaid(); spawn(o.amount, o.toast);
    return undefined;
  };
  return { burst, pay, spawn };
}

/**
 * A quest's one-call presentation with its coin reward (ENGINE §20): the chip, markers, MAP card, places and step toasts,
 * the held reward beat (`reward`, shown while the quest is complete and `unpaid` holds) that pays; entered
 * for a retained home, installed in plain play, absent headless (the reward then pays at once on completion). A quest
 * still open toasts `newQuest` on the first frame. The burst animates under the system `id` and is freed with the level.
 */
export function presentRewardedQuest(ctx: ShardContext, quest: QuestState, reward: QuestReward, o: { readonly id: string; readonly player: Vector3; readonly unpaid: () => boolean; readonly newQuest: string; readonly presentation: Omit<QuestPresentationOptions, 'reward'>; readonly beat: Omit<QuestRewardSpec, 'when' | 'finish'> }): () => QuestPresentation | null {
  const runtime = ctx.game.runtime, live = runtime?.world && runtime.play ? runtime : null, { burst, pay } = reward;
  const presentation: QuestPresentationOptions = { ...o.presentation, reward: { ...o.beat, when: () => o.unpaid() && quest.isComplete, finish: pay } };
  const entered = live !== null && retainsRuntimeServices(ctx) ? installEnteredQuestPresentation(ctx, quest, presentation) : null;
  const view = live === null || entered !== null ? null : installQuestPresentation(ctx, quest, presentation);
  ctx.scope.onDispose(quest.observe({ complete: () => { if (live === null) pay(); } }));
  if (!quest.isComplete) ctx.game.runtime?.play?.hud.toast(o.newQuest);
  ctx.system({ id: o.id, phase: 'update', run: (dt) => { burst.update(dt, o.player); } });
  ctx.scope.onDispose(() => { burst.update(3, o.player); burst.dispose(); });
  return () => entered === null ? view : entered();
}

/** A rewarded quest's strings: the reward's toast, the new-quest toast's lead, the quest's title and the beat's kicker and subtitle. */
export interface RewardedQuestStrings { readonly reward: string; readonly newQuest: string; readonly quest: string; readonly rewardKicker: string; readonly rewardSubtitle: string }
/** What `installRewardedQuest` is lent beyond the runtime quest's ports (flags, facts, marker places). */
export interface RewardedQuestPorts extends RuntimeQuestPorts {
  /** The declared quest's id and the reward burst's system id. */
  readonly id: string; readonly rewardId: string;
  readonly strings: RewardedQuestStrings;
  readonly player: Vector3; readonly coins: RuntimeCoins;
  /** The save's once-only reward record. */
  readonly paid: () => boolean; readonly markPaid: () => void;
  /** Whether the held reward beat still shows (absent: unpaid when the quest was bound). */
  readonly unpaid?: () => boolean;
  /** The quest-giver: its row and its installed figure, made after the reward and before the presentation (absent or null: none). */
  readonly npc?: () => { readonly row: NpcRow; readonly figure: Pick<QuestPresentationNpc, 'speaker'> & { readonly head: Vector3 }; readonly label: string } | null;
  /** The presentation's other options (the places, their discovery flags). */
  readonly presentation: Omit<QuestPresentationOptions, 'reward' | 'npc' | 'introTitle'>;
  /** The reward beat's held view (absent: the player's own). */
  readonly beat?: Pick<QuestRewardSpec, 'at' | 'yaw' | 'pitch' | 'holdSeconds'>;
}
/**
 * A shard's declared quest with its coin reward in one call (SHARD-PLATFORM M3; Signal Dunes and Sky Reach): the
 * shardfile's quest bound over the shard's flags, its coins once per save through the purse, its quest-giver, and the
 * rewarded presentation (`presentRewardedQuest`) titled by the quest's strings.
 */
export function installRewardedQuest(ctx: ShardContext, source: Shardfile, o: RewardedQuestPorts): { quest: QuestState; reward: QuestReward; view: () => QuestPresentation | null } {
  const { strings: s, player } = o;
  const bound = bindRuntimeQuest(ctx, source, o.id, { flags: o.flags, ...(o.facts === undefined ? {} : { facts: o.facts }), ...(o.place === undefined ? {} : { place: o.place }) });
  const quest = bound.state, paidAtLoad = o.paid();
  const reward = questReward(ctx, { player, coins: o.coins, amount: bound.reward.coins, paid: o.paid, markPaid: o.markPaid, toast: s.reward });
  const giver = o.npc?.() ?? null, npc = giver === null ? null
    : { npc: npcDef(giver.row), at: giver.figure.head, label: giver.label, speaker: giver.figure.speaker, radius: giver.row.talkRadius };
  const view = presentRewardedQuest(ctx, quest, reward, { id: o.rewardId, player, unpaid: o.unpaid ?? (() => !paidAtLoad), newQuest: `${s.newQuest} · ${s.quest}`,
    presentation: { ...o.presentation, introTitle: s.quest, ...(npc === null ? {} : { npc }) },
    beat: { kicker: s.rewardKicker, title: s.quest, subtitle: s.rewardSubtitle, ...o.beat } });
  return { quest, reward, view };
}

/** What a boss row's browser encounter is given: its rows, its view-free script, its body and its record. */
export interface BossViewSpec {
  readonly definition: BossDefinition;
  /** The encounter's authored stage rows (`DirectorBossBrain`). */
  readonly stages: unknown;
  readonly script: BossScript;
  /** The player's live position (the arena check, the reward's target). */
  readonly player: Vector3;
  /** The boss's live body: a hit on it is refused while `shielded`. */
  readonly body: () => Animal | null;
  readonly shielded: () => boolean;
  readonly saved: BossSaved;
  readonly persist: (value: BossSaved) => void;
  /** The first fall's reward (absent: the victory callback pays it). */
  readonly spawnReward?: () => void;
  /** Toast the brain's own lines on the HUD (a later fall's); absent, the shard's victory callback says it. */
  readonly toast?: boolean;
}

/**
 * A boss row's encounter in the browser (SHARD-PLATFORM BR-2), the twin of `installBossRow` in the renderer-free host:
 * the engine's `BossBrain` under its authored stages over the shard's view-free script, with the engine's `BossBar` (boss
 * bar, name card, skip hold), the player's weapons locked through the intro, respawn / face-toward on the player's motor,
 * its toasts on the HUD when asked, and `damage.modify` refusing hits on the body while the script is shielded. Signal's Dune Matriarch
 * and Sky Reach's Storm Roc are these.
 */
export class BossView extends DirectorBossBrain {
  private readonly pinned: () => Animal | null;
  constructor(ctx: ShardContext, spec: BossViewSpec) {
    const bar = new BossBar(), motor = (): { position: Vector3; yaw: number } | null => ctx.game.runtime?.world?.player ?? null;
    ctx.scope.onDispose(() => { bar.scope.dispose(); });
    ctx.answer('damage.modify', (request) => { const body = spec.body(); return request !== null && body !== null && request.target === body.combatActor() && spec.shielded() ? null : request; });
    super(spec.definition, spec.script, { events: ctx.app.events, player: { position: spec.player },
      lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); }, skipHeld: () => ctx.app.input.held('skip'),
      respawn: (pos, yaw) => { const m = motor(); if (m) { m.position.copy(pos); m.yaw = yaw; } },
      faceToward: (target) => { const m = motor(); if (m) m.yaw = Math.atan2(m.position.x - target.x, m.position.z - target.z); },
      spawnReward: () => { spec.spawnReward?.(); }, toast: spec.toast === true ? (message) => { ctx.game.runtime?.play?.hud.toast(message); } : undefined,
      persist: spec.persist }, bar, spec.saved, spec.stages);
    this.pinned = spec.body;
  }
  /** The boss's body is drawn at any distance (no tier draw-distance shrink), whichever body is up this frame. */
  override update(dt: number, t: number): void {
    const body = this.pinned();
    if (body !== null) body.drawPinned = true;
    super.update(dt, t);
  }
}

/**
 * Registers a browser boss with the level's encounters under `id`: armed now when `armed`, answering the health model's
 * death checkpoint, updated each frame. `summon` arms a dormant boss (`onSummon` runs then, e.g. its summons toast).
 */
export function installBossView<T extends BossView>(ctx: ShardContext, id: string, brain: T, armed: boolean, onSummon?: () => void): { boss: T; summon: () => void } {
  const live = ctx.app.encounters.boss(id, brain, ctx.scope);
  if (armed) live.arm();
  ctx.answer('death.checkpoint', (value) => live.onPlayerDeath() || value === true);
  ctx.system({ id, phase: 'update', run: (dt, t) => { live.update(dt, t); } });
  return { boss: live, summon: () => { if (live.state === 'dormant') { live.arm(); onSummon?.(); } } };
}

/** A body boss's rows: its encounter definition, its authored stages and its spawned or held fight profile. */
export interface RowBossRows { readonly definition: BossDefinition; readonly stages: unknown; readonly profile: unknown }
/** A boss record: the saved state to start from and how it persists. */
export interface RowBossRecord { readonly saved: BossSaved; readonly persist: (value: BossSaved) => void }
/**
 * What a `RowBossView` is lent. A spawned body (a fresh body per checkpoint): the bound body row, its arena
 * presentation (reward floor, respawn, toasts), its coins through the purse, the shard's weather view (made over the
 * play scene, run with the storm's strength each frame) and the victory's beat. A held body: the retained body, its
 * brain and the victory callback, which pays and toasts itself.
 */
export type RowBossPorts = { readonly player: Vector3; readonly record: RowBossRecord } & ({
  readonly body: RuntimeBoss; readonly presentation: MarkedBossPresentation; readonly reward: number; readonly coins: RuntimeCoins;
  readonly weather?: (scene: Scene) => (dt: number, strength: number) => void; readonly onDown?: () => void;
} | { readonly held: Animal | null; readonly brain: HeldBossBrain | null; readonly victory: (at: Vector3) => void });

interface RowBossMade { readonly spec: BossViewSpec; readonly at: Vector3 | null; readonly weather: { storm: number }; readonly after: () => void }
function rowBossSpec(ctx: ShardContext, rows: RowBossRows, ports: RowBossPorts): RowBossMade {
  const profile = parseBossProfile(rows.profile), { player, record } = ports, saved = record.saved;
  const base = { definition: rows.definition, stages: rows.stages, player, saved, persist: record.persist };
  if ('held' in ports) {
    if (profile.pattern !== 'held') throw new Error(`${rows.definition.id} requires its declared held-body pattern`);
    const fight = bossFight(profile, { body: ports.held, brain: ports.brain, victory: ports.victory });
    return { spec: { ...base, script: fight.script, body: () => ports.held, shielded: fight.shielded }, at: null, weather: { storm: 0 }, after: () => undefined };
  }
  if (profile.pattern !== 'spawned') throw new Error(`${rows.definition.id} requires its declared spawned-body pattern`);
  const look = ports.presentation, body = ports.body, onDown = ports.onDown;
  const at = new Vector3(body.row.at[0], look.floor, body.row.at[1]);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene), weather = ports.weather?.(scene);
  const fight = bossFight<Animal>(profile, { body: { spawn: (previous) => body.spawn(previous), retire: (a) => { body.retire(a); } }, rewardPoint: at,
    respawnPoint: () => ({ pos: new Vector3(look.respawn.x, ctx.manifest.ground.terrain?.heightAt(look.respawn.x, look.respawn.z) ?? 0, look.respawn.z), yaw: look.respawn.yaw }),
    victory: () => { ctx.game.runtime?.play?.hud.toast(saved.rewardTaken ? look.toasts.rewardAgain : look.toasts.reward); onDown?.(); },
    update: (dt, strength) => { weather?.(dt, strength); burst.update(dt, player); } });
  return { at, weather: fight.weather, spec: { ...base, script: fight.script, body: fight.body, shielded: fight.invulnerable, toast: true,
    spawnReward: () => { saved.rewardTaken = true; record.persist(saved); burst.spawn(player, ports.reward, ports.coins, () => undefined); } },
    after: () => {
      if (saved.defeated) onDown?.();
      ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); const animal = fight.body(); if (animal) body.retire(animal); fight.adopt(null); });
    } };
}

/**
 * A declared body boss in the browser (SHARD-PLATFORM SF27; Signal's Dune Matriarch, spawned, and Sky Reach's Storm Roc,
 * held): its profile through the platform's view-free `bossFight`, the `BossView` over it. A spawned body adds the
 * presentation row's views (the shard's weather, the reward's coin burst from the arena floor, the respawn on the
 * ground) and its toasts; the view refuses hits while the fight is invulnerable.
 */
export class RowBossView extends BossView {
  /** The arena's reward point (a spawned body's spot on the floor; null held). */
  readonly at: Vector3 | null;
  /** The storm's strength 0..1 (captures and tests read it). */
  readonly weather: { storm: number };
  /** The boss's body while it is up. */
  readonly body: () => Animal | null;
  constructor(ctx: ShardContext, rows: RowBossRows, ports: RowBossPorts) {
    const made = rowBossSpec(ctx, rows, ports);
    super(ctx, made.spec);
    this.at = made.at; this.weather = made.weather; this.body = made.spec.body;
    made.after();
  }
}

/** Existing starter tuning; only the authored stun is applied by normal play, and importing installs no effects. */
export const STARTER_EFFECTS: readonly EffectDef[] = STARTER_EFFECT_ROWS;

type StatusMovement = Parameters<typeof bindPlayerEffects>[0]['movement'];
type StarterContext = Pick<LevelContext, 'app' | 'scope' | 'system' | 'on'> & { hud: Pick<LevelContext['hud'], 'widget'> };
/** An optional entered installer retires observers and icons while statuses remain player-owned. */
export function installStarterEffects(ctx: StarterContext, host: { player: StatusMovement & { position: Vector3 }; health: Actor | null; effects: EffectService | null },
  entered?: (install: (scope: Scope) => void) => void): void {
  const { player, health, effects } = host;
  if (health === null || effects === null) throw new Error('Starter effects need player health and effects services');
  if (entered === undefined) bindPlayerEffects({ effects, target: health, movement: player, combat: ctx.app.combat, position: () => player.position, scope: ctx.scope });
  let iconScope: Scope | undefined;
  let icons: StatusIcons | null = null;
  if (entered !== undefined) entered((scope) => {
    iconScope = scope;
    scope.onDispose(() => { icons?.root.remove(); icons = null; if (iconScope === scope) iconScope = undefined; });
  });
  ctx.system({ id: 'engine.effects.status', phase: 'update', run: () => {
    const active = effects.active(health);
    const status = active.some((effect) => effect.def.tags.some((tag) => tag.startsWith('status.')));
    if (status && icons === null) {
      icons = new StatusIcons();
      if (entered === undefined) ctx.hud.widget('band.3', icons.root, 80);
      else if (iconScope !== undefined) hudSlots.widget('band.3', icons.root, 80, iconScope);
    }
    if (icons !== null) { icons.update(active); icons.root.style.display = status ? '' : 'none'; }
  } });
  if (entered === undefined) ctx.on('player.died', ({ actor }) => {
    if (actor !== health) return;
    for (const effect of effects.active(health)) if (effect.def.tags.some((tag) => tag.startsWith('status.'))) effects.remove(health, effect.def.id);
  });
  ctx.scope.onDispose(() => { icons?.root.remove(); });
}

/**
 * Infinite Wildshard's way in (SF21a). The catalogue's home cell boots through the normal shard flow as page mode
 * `'grid'`; its live grid session borrows that world and transfers the traveller between admitted frames. A title tap
 * or a validated recovery record selects the home before normal memory admission and descriptor hydration.
 *
 *   title tap  → enterGrid()               the one-shot intent, then a fresh document for the home cell
 *   boot       → bootPageMode(slug)         consumes the tap or uses validated recovery; the URL drops to the bare title
 *                                           URL, so an unrecorded reload (or an iOS kill's restart) lands on the title
 *   alive beat → pageMode()                 AliveInfo.mode, so the title can say the grid ended unexpectedly
 */


/** the home cell of the grid this device would assemble now (Developer and DEVSERVER apply at grid start) */
export function gridHome(mode?: MenuMode): GridCell {
  const assembly = new GridAssembly(gridMode(DEVSERVER, mode));
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('The grid catalogue has no home cell at (0, 0)');
  return home;
}

/** The title's Infinite Wildshard tap: write the one-shot intent, then open the home cell in a fresh document. */
export function enterGrid(): void {
  // A deliberate new player attempt starts a new guard window; automatic reloads cannot clear it.
  if (!gridRecovery(pageApp.saves).clearLoop()) throw new Error('Grid recovery guard could not be cleared');
  clearGridRecovery();
  const home = gridHome();
  const target = findShard(home.slug);
  if (target === undefined) throw new Error(`The grid's home cell names no shard: ${home.slug}`);
  // INFINITE WILDSHARD enters the catalogue home, never SHARD SELECT's frozen LEGACY copy.
  chooseShardEntry(target.slug, 'shardfile');
  pageGridIntents().set({ instance: home.instance, slug: target.slug });
  travel({ to: target.slug, mode: 'enter' });
}


/** The boot's one read of the tap intent (used or not), overridden by validated recovery before ordinary admission.
 * In grid mode the address becomes the bare title URL, preventing an unrecorded automatic restart. */
export function bootPageMode(slug: string): PageMode {
  let intent = null;
  try { intent = pageGridIntents().consume(slug); } catch { /* blocked storage: no intent, the normal shard flow */ }
  const recovery = pageGridRecovery();
  if (recovery !== null && [slug].includes(recovery.slug)) intent = { instance: recovery.instance, slug: recovery.slug, at: recovery.at };
  const mode: PageMode = intent === null ? 'shard' : 'grid';
  setPageMode(mode);
  if (intent !== null) gridCells.enter({ instance: intent.instance, slug: intent.slug }); // the home cell: the page starts inside it
  if (mode === 'grid' && typeof history !== 'undefined') {
    try { history.replaceState(history.state, '', new URL(location.pathname, location.origin)); } catch { /* a sandboxed frame: the URL stays */ }
  }
  return mode;
}


/** The title page's boot: a stale intent is consumed and dropped, never kept for a later page. */
export function dropGridIntent(): void {
  try { pageGridIntents().consume(''); } catch { /* nothing to drop */ }
}

/** Page-local selection is installed explicitly by the composition root, never by importing this module. */
let selected: NonNullable<GridRecoveryRecord> | null = null;
let refused = false;
let loop = false;

/** A validated current catalogue's default home and road lane, used when recovery metadata is unsafe. */
export function safeGridRecovery(assembly: GridAssembly, now: number): NonNullable<GridRecoveryRecord> {
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('Recovery catalogue requires a home cell');
  return { instance: home.instance, slug: home.slug, catalogue: recoveryCatalogue(assembly), at: now, reason: 'gpu',
    road: { x: home.origin.x + assembly.pitch / 2 + 3.6, z: home.origin.z, yaw: 0 } };
}

/** Consume recovery metadata before routing/hydration; ordinary boot and unsupported future records select nothing. */
export function consumeGridRecovery(options: { assembly?: GridAssembly; saves?: SaveStore; now?: () => number; unexpected?: boolean } = {}): NonNullable<GridRecoveryRecord> | null {
  const assembly = options.assembly ?? new GridAssembly(gridMode(DEVSERVER));
  const now = options.now ?? Date.now;
  const result = gridRecovery(options.saves ?? pageApp.saves, now).consume(assembly, options.unexpected);
  loop = result.kind === 'loop';
  refused = result.kind === 'refused' || loop;
  selected = result.kind === 'resume' ? result.record : result.kind === 'fallback' ? safeGridRecovery(assembly, now()) : null;
  return selected;
}

/** Same-document handoff to ordinary admission and the live road placement; progress is read from real saves. */
export function pageGridRecovery(): NonNullable<GridRecoveryRecord> | null { return selected; }
/** A failed recovery boot returns to the title and must not supply a selection to another boot. */
export function clearGridRecovery(): void { selected = null; refused = false; loop = false; }
/** Future or unconsumed metadata cannot enter a renderer on this boot. */
export function gridRecoveryRefused(): boolean { return refused; }
/** A repeated failing recovery opens the existing shard picker, never another automatic boot. */
export function gridRecoveryLoop(): boolean { return loop; }

/** The composition root passes this selection to hydration and startSession; its grid intent has already been consumed. */
export interface PageResidencyBoot {
  readonly mode: PageMode;
  readonly instance: string | null;
  readonly residency?: PageResidency;
  /** G216: one trusted page policy also reaches data-only SHARD SELECT validation and its warning surface. */
  readonly memory: MemoryAdmission;
  /** Validated recovery uses the ordinary owner, then returns to the road. */
  readonly recovery?: NonNullable<GridRecoveryRecord>;
}

/**
 * G144's single grid boot seam. Call before descriptor hydration and any world construction. Opaque homes must supply
 * reviewed measurements here, since their hybrid data hook runs after bootstrap. Data homes are admitted by the loader
 * against their declared sim cost, then their actual library and tile claims. The root disposes failed hydration; the
 * successful session installs the owner's level lifetime.
 */
export function preparePageResidency(manifest: Pick<ShardManifest, 'slug' | 'shardfile' | 'runtimeCost'>, configuredSlug?: string, memory = new MemoryAdmission(isDev)): PageResidencyBoot {
  const mode = bootPageMode(configuredSlug ?? manifest.slug);
  const measuredHome = configuredSlug === undefined && manifest.shardfile === undefined;
  if (mode !== 'grid' && (!measuredHome || manifest.runtimeCost === undefined)) return { mode, instance: null, memory };
  const instance = mode === 'grid' ? pageGridInstance() : manifest.slug;
  if (instance === null) throw new Error('Grid residency requires the consumed home instance');
  const residency = new PageResidency(new ResidencyAllocator({ memory }));
  try {
    if (measuredHome) {
      if (manifest.runtimeCost === undefined) throw new Error('Grid runtime home requires reviewed memory measurements before bootstrap');
      const bytes = runtimeAccountedBytes(manifest.runtimeCost), row = manifest.runtimeCost;
      const cost = contentCost({ l0: 0, l1: 0, far: 0, libraries: 0, sims: bytes, commons: 0, overlap: CONTENT_CAPS.overlap });
      if (!memory.accept({ stage: 'runtime', owner: instance, id: `sim:${instance}`, claimedBytes: bytes,
        accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading,
        measured: { webContentBytes: Math.ceil(row.webContentMB * 1_000_000), glBytes: Math.ceil(row.glMB * 1_000_000), engineBaseBytes: Math.ceil(row.engineBaseMB * 1_000_000),
          ...(row.residentBaseMB === undefined ? {} : { residentBaseBytes: Math.ceil(row.residentBaseMB * 1_000_000) }),
          rev: row.rev, device: row.device, evidence: row.evidence } })) throw new Error('Home residency admission deferred by the shared budget');
      // A matched increment subtracts the persistent composer; it cannot cover that page component again.
      residency.admitHome(instance, bytes, row.residentBaseMB === undefined);
    }
    const recovery = mode === 'grid' ? pageGridRecovery() : null;
    return { mode, instance, residency, memory, ...(recovery === null ? {} : { recovery }) };
  } catch (error) { residency.dispose(); throw error; }
}

/** Validate before allocating a level. Content bindings belong to the full loader. */
export function emptyShardfileSource(input: unknown): ShardManifest {
  preflightShardfile(input);
  if (typeof input === 'object' && input !== null && 'version' in input && input.version !== SHARDFILE_VERSION) throw new Error(`Shardfile version ${String(input.version)} requires a compatible client (this client supports ${SHARDFILE_VERSION})`);
  const source = parseShardfile(input);
  if (source.meshCollision !== null) throw new Error('Compiled mesh collision runtime and entry admission pending');
  if (source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  // The look (SF10b) is the one content kind bound here: day keys and a LUT, the LUT's file the only file allowed.
  const lut = source.look.grade.lut;
  const lutOnly = source.files.every((f) => f.hash === lut) && source.requires.commons.every((h) => `commons:${h}` === lut);
  const newContent = (source.directors?.length ?? 0) + source.movers.length + source.crowds.length + source.clientScripts.bindings.length + source.water.length + source.creatures.spawns.length + source.creatures.brains.length + source.encounters.length + source.ledger.length + source.audio.cues.length + source.audio.routing.length + Object.values(source.quests).reduce((sum, rows) => sum + rows.length, 0);
  if ((source.modes?.traverse.length ?? 0) > 0 || source.items.rows.length + source.items.contexts.length > 0 || source.props !== null || source.targets.panels.length + source.targets.interactions.length > 0 || Object.keys(source.look.materials).length + Object.keys(source.look.familyLooks).length > 0 || newContent > 0 || source.hooks.conditions.length + source.hooks.scenes.length > 0 || source.plumbing !== null || source.navigation !== null || source.terrain !== null || source.audio.ambience !== null || source.audio.score !== 'silent' || source.audio.music !== undefined || source.audio.samples !== undefined || source.audio.zones !== undefined || Object.values(source.rows).reduce((sum, rows) => sum + rows.length, 0) + source.ui.length + source.tiles.length + source.library.filter((ref) => ref !== lut).length + source.requires.capabilities.length + source.sim.scripts.length + source.sim.bindings.length + source.look.families.length > 0 || !lutOnly || source.far !== null || source.state.shared.length + source.state.player.length > 0) throw new Error('This client supports empty shardfiles only; content requires the full shardfile loader');
  return sourceManifest(source);
}


/** Admit every immutable byte before creating a normal Game level source; scopes own all staged content bindings. */
export async function shardfileSource(input: unknown, options: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const ownedOptions = withPageMemory(options, bindings);
  return clientSource(await admitProduct(input, ownedOptions), ownedOptions, bindings);
}

function withPageMemory(options: ProductOptions, bindings: ShardfileClientBindings): ProductOptions {
  const memory = bindings.residency?.memory ?? options.memory;
  if (bindings.residency !== undefined && options.memory !== undefined && memory !== options.memory) throw new Error('Shardfile admission must share the page memory policy');
  return memory === undefined ? options : { ...options, memory };
}

function clientSource(admitted: AdmittedProduct, options: ProductOptions, bindings: ShardfileClientBindings): ShardManifest {
  const source = admitted.source;
  if (bindings.trustedRuntime === true && (!options.firstParty || source.runtime === null)) throw new Error('Empty hybrid policy requires a trusted first-party runtime declaration');
  if (bindings.audioOwner === 'runtime' && (!options.firstParty || source.runtime === null)) throw new Error('Runtime audio ownership requires a trusted first-party runtime declaration');
  if (bindings.worldOwner === 'runtime' && (!options.firstParty || source.runtime === null)) throw new Error('Runtime world ownership requires a trusted first-party runtime declaration');
  if (!options.firstParty && admitted.instance === undefined) throw new Error('Outside shardfile is missing its admitted save identity');
  const ownedBindings = { ...bindings,
    ...(bindings.allocator === undefined && bindings.residency === undefined && options.memory !== undefined ? { allocator: new ResidencyAllocator({ memory: options.memory }) } : {}),
    ...(options.firstParty ? {} : { instance: admitted.instance ?? '' }) };
  const residency = clientResidency(source, ownedBindings);
  const assets = new ClientAssets(source, admitted.assets, options);
  const manifest = sourceManifest(source, admitted.assets);
  const clientBindings = { ...ownedBindings, allocator: residency.allocator };
  return { ...manifest, ...(source.presentation === undefined ? { biome: 'Authored world', blurb: source.identity.name } : {}),
    // Traversal belongs to the platform, independently of authored item rows or Developer mode.
    loadout: { weapons: [], tools: ['tool.hoverboard'], start: ['tool.hoverboard'] },
    ...(manifest.navigation === undefined ? {} : { navigation: manifest.navigation }),
    ground: { ...(source.terrain === null && source.meshCollision === null && !source.entryways.some(entry => entry.kind === 'socketLift' || entry.kind === 'portalLink') ? {} : { structures: true }), paths: 'plugin', terrain: clientGround(source, assets.retained), water: shardfileWater(source.water) },
    species: source.rows.species.map((row) => row.kind), uses: ['spawns', 'quests', 'bosses', 'elites', 'swim', 'hover', 'explore', 'practice'],
    loot: { coins: source.rows.loot.length > 0 },
    creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
    render: () => Promise.resolve(source.look.keys.length === 0 ? emptyLook(source.look.dayOverride) : shardfileLook(source.look, assets.retained)),
    load: async () => { const { ShardfileClient } = await import('../shardfile/client'); return { default: class extends ShardfileClient { constructor() { super(source, assets, clientBindings); } } }; },
  };
}

/** Select a fully admitted external product before the ordinary session starts; first-party discovery remains installed. */
export async function installShardfileProduct(input: unknown, providedOptions: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const options = withPageMemory(providedOptions, bindings);
  const admitted = await admitProduct(input, options);
  if (admitted.source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  const source = clientSource(admitted, options, bindings);
  return selectSource(source, options.firstParty);
}

function selectSource(source: ShardManifest, firstParty: boolean): ShardManifest {
  const list = new Map(firstParty ? shards().map((manifest) => [manifest.slug.replace(/^_/u, ''), manifest]) : []);
  list.set(source.slug.replace(/^_/u, ''), source); installShards([...list.values()]);
  game.shard = source; _applyChunkConstants(source); configureLevel(toLevelSpec(source)); return source;
}

/** Admit a built first-party descriptor before the normal session, preserving picker identity and its canonical save instance. */
export async function installManifestShardfile(manifest: ShardManifest, providedOptions: ProductOptions, bindings: ShardfileClientBindings): Promise<ShardManifest> {
  const options = withPageMemory(providedOptions, bindings);
  if (manifest.shardfile === undefined) return manifest;
  if (!options.firstParty) throw new Error('Manifest shardfile descriptors require first-party provenance');
  const url = new URL(manifest.shardfile, options.base);
  if (url.origin !== new URL(options.base).origin || url.search !== '' || url.hash !== '') throw new Error('Manifest shardfile must be an unqualified same-origin source');
  const productOptions = { ...options, base: new URL('.', url).href };
  let input: unknown;
  if (options.offline) {
    options.progress?.({ phase: 'descriptor', detail: 'Reading visited shard descriptor', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 1 });
    const visited = await options.cache?.product(productOptions.base);
    if (visited?.firstParty !== true) throw new Error('First-party shardfile has not been visited offline');
    input = visited.source;
  } else {
    let bytesRead = 0;
    options.progress?.({ phase: 'descriptor', detail: 'Fetching shard descriptor', bytesRead, bytesTotal: 0, filesDone: 0, filesTotal: 1 });
    const response = await options.fetch(url.href), length = Number(response.headers.get('content-length'));
    const bytesTotal = Number.isSafeInteger(length) && length > 0 ? length : 0;
    const bytes = await boundedResponse(response, limits.sourceBytes, (size) => {
      bytesRead += size; options.progress?.({ phase: 'descriptor', detail: 'Reading shard descriptor', bytesRead, bytesTotal, filesDone: 0, filesTotal: 1 });
    });
    options.progress?.({ phase: 'descriptor', detail: 'Parsing shard descriptor', bytesRead, bytesTotal: bytesRead, filesDone: 1, filesTotal: 1 });
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  const source = parseShardfile(input);
  const { slug: authoredIdentity } = source.identity, expectedIdentity = manifest.slug.replace(/^_/u, '');
  if (authoredIdentity !== expectedIdentity) throw new Error('Manifest and shardfile identities differ');
  if (source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition');
  const admitted = await admitProduct(source, productOptions);
  const client = clientSource(admitted, productOptions, { ...bindings, instance: bindings.residency === undefined ? firstPartyInstance(manifest.slug) : bindings.instance });
  const { image: _unadmittedImage, ...mapLook } = manifest.minimap ?? {};
  return selectSource({ ...client,
    slug: manifest.slug, name: manifest.name, order: manifest.order, status: manifest.status, label: manifest.label,
    ...(source.presentation === undefined ? { biome: manifest.biome, blurb: manifest.blurb, card: manifest.card } : {}),
    // SF65 (G241): the picker's ways in survive admission (the admitted manifest's client `load` is not legacy TypeScript)
    entries: shardEntries(manifest),
    // Keep the authored map look; image bytes come exclusively from the admitted product (SF66).
    minimap: { ...mapLook, ...client.minimap },
    // and its listed places, the full map's pins (SF66): the admitted source has none
    ...(manifest.pois === undefined ? {} : { pois: manifest.pois }),
  }, true);
}

/** Browser connectivity and visited-product storage feed the same admission path as headless validation. */
export function browserShardfileOptions(base: string, firstParty = false): ProductOptions {
  return { base, firstParty, textures: ktx2TranscodeSupport(), offline: !navigator.onLine, hash: browserContentHash, fetch: (url) => fetch(url),
    ...(typeof caches === 'undefined' ? {} : { cache: browserProductCache(caches) }),
  };
}

/** Project an empty shardfile into the same engine spec consumed by legacy sources. */
export function shardfileLevelSpec(input: unknown): LevelSpec { return toLevelSpec(emptyShardfileSource(input)); }

/** Load through an installed engine driver; the ordinary unloadLevel owns every resource. */
export async function loadShardfile(app: App, input: unknown): Promise<void> {
  await app.loadLevel(shardfileLevelSpec(input), {});
}

/** The prebuilt client's HTML supplies data, without a second boot loop or URL switch. */
export function configuredShardfile(document: Pick<Document, 'getElementById'>): Shardfile | null {
  const element = document.getElementById('ws-shardfile');
  if (element === null) return null;
  const text = element.textContent;
  // Reject excessive character counts before creating a UTF-8 copy or parsing the inline source.
  if (text.length > limits.sourceBytes || new TextEncoder().encode(text).length > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap');
  return parseShardfile(JSON.parse(text));
}

/** Select a validated external source before the normal session starts. */
export function installShardfileSource(input: unknown): ShardManifest {
  const source = emptyShardfileSource(input);
  installShards([source]);
  game.shard = source;
  _applyChunkConstants(source);
  configureLevel(toLevelSpec(source));
  return source;
}

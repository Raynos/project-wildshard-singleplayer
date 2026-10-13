import { parseClientChannels, type ClientChannelProperty } from '@wildshard/format/clientChannels';
import "../quest/presentation.css";
import { AdditiveBlending, Euler, PerspectiveCamera, Quaternion, Scene, ShaderMaterial, Vector3, type Object3D } from "three";
import type { Scope } from "@wildshard/engine/app/scope";
import { ParticlePool, pointScale } from "@wildshard/engine/fx/ParticlePool";
import { CLIENT_SCRIPT_LIMITS, type ClientScriptFrame } from "@wildshard/engine/script/client";
import type { SystemSpec } from "@wildshard/engine/app/systems";
import { practiceRoom } from "@wildshard/engine/core/practiceRoom";
import type { Events } from "@wildshard/engine/events/events";
import type { HudVerbs } from "@wildshard/engine/level/context";
import type { MapPoi, MapQuest } from "@wildshard/engine/ui/Map";
import type { MapMark } from "@wildshard/engine/ui/Minimap";
import { Flags } from "@wildshard/engine/world/interact/flags";
import type { Place } from "@wildshard/engine/world/interact/types";
import { QuestState, type QuestDef, type QuestStep, type NpcDef } from "@wildshard/engine/quest/core";
import { QuestChip, NpcTalk, placesWithDiscovery, type LiveMarker, type PlacePoint, type Places, type NpcTalkOpts } from "@wildshard/engine/quest/view";
import { DialogueBox } from "@wildshard/engine/quest/view/ui";
import { QuestRewardBeat, type QuestRewardSpec, type QuestRewardPlayer } from "../quest/reward";
import { createLevelInstallation } from "@wildshard/engine/level/installation";
import type { ShardContext } from "./context";
import type { BossDefinition, BossSaved, BossScript } from "@wildshard/engine/ai/BossBrain";
import type { Animal } from "@wildshard/engine/entities/AnimalView";
import { BossBar } from "@wildshard/engine/ui/BossBar";
import { CoinBurst } from "../loot/CoinBurst";
import { DirectorBossBrain } from "./director";
import type { RuntimeCoins } from "./headless";
import { installEnteredRuntimeService, retainsRuntimeServices } from "./lifecycle";

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
  const frame: Partial<Record<ClientChannelProperty, number>> = {};
  for (const channel of program.channels) Object.defineProperty(frame, channel.property, { enumerable: true, get: () => published[channel.value] });
  Object.freeze(frame);
  const evaluate = (observation: ClientChannelObservation): void => {
    const { time, delta, values } = observation;
    if (!Number.isFinite(time) || !Number.isFinite(delta) || delta < 0 || Math.abs(time) > 1e12 || delta > 1e12 || values.length !== reads.length) throw new Error('Invalid copied client observation');
    for (let i = 0; i < reads.length; i++) { const value = values[i]; if (value === undefined || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Invalid copied client state'); reads[i] = value; }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]; if (node === undefined) throw new Error('Missing client expression');
      const a = 'a' in node ? scratch[node.a] ?? Number.NaN : 0, b = 'b' in node ? scratch[node.b] ?? Number.NaN : 0;
      let value: number;
      switch (node.op) {
        case 'constant': value = node.value; break;
        case 'clock': value = node.value === 'time' ? time : delta; break;
        case 'read': value = reads[node.index] ?? Number.NaN; break;
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
        case 'gt': value = Number(a > b); break;
        case 'select': value = (scratch[node.test] ?? Number.NaN) !== 0 ? scratch[node.yes] ?? Number.NaN : scratch[node.no] ?? Number.NaN; break;
        default: throw new Error('Unknown client operation');
      }
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Non-finite or excessive client expression');
      scratch[i] = value;
    }
    published.set(scratch);
  };
  return Object.freeze({ reads: Object.freeze([...program.reads]), frame, evaluate });
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

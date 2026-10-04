import { harnessPins, setCurrentProbe } from '../app/identity';
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import type { Animal } from '../entities/AnimalView';
import type { AnimalManager } from '../entities/AnimalManager';
import type { EquipmentService } from '../combat/EquipmentService';
import type { WeaponState } from '../combat/Weapon';
import type { TrainingArena } from '../practice/TrainingArena';
import type { HUD } from '../ui/HUD';
import type { Audio } from '../audio/Audio';
import type { Music } from '../audio/Music';
import type { Interactable } from '../world/interact/types';
import { floorBelow } from '../physics/query';
import type { Navmesh } from '../physics/navmesh';
import { Rng } from '../core/rng';
import { TIER } from '../core/tier';
import { tap } from '../core/harnessTap';
import { ExternalTimerBaseline } from './timerBaseline';
import { poseBudgets } from '../render/budgetReport';
import { scopeRegistrations, registrationTimerIds, disposalErrorMessages, type ScopeCensus } from '../app/scope';
import type { AppState, Phase } from '../app/systems';

declare const __BUILD_ID__: string;
export interface Vec3 { x: number; y: number; z: number }
export interface ProbeNav {
  randomPoint: (near: Vec3, min: number, max: number) => Vec3 | null;
  path: (a: Vec3, b: Vec3) => Vec3[] | null;
}
export interface Saves { read: string[]; written: string[] }
export interface SoundLog { event: Record<string, number>; ambient: string[] }
export interface GpuBytes { textures: number; renderbuffers: number; buffers: number; total: number }
export interface ResourceCounts {
  listeners: { window: number; document: number; canvas: number; other: number };
  timers: { timeouts: number; intervals: number; raf: number };
  timerIds?: { timeouts: number[]; intervals: number[]; raf: number[] };
  stacks: { listeners: string[]; timers: string[] };
}
export interface LeakCensus {
  geometries: number; textures: number; programs: number; bodies: number; colliders: number;
  listeners: ResourceCounts['listeners']; timers: ResourceCounts['timers'];
  audio: { activeVoices: number; beds: number; buses: number };
  systems: { input: number; fixed: { pre: number; step: number; post: number }; update: number; late: number; render: number }; events: { listeners: number; answerers: number };
  dom: { hud: number; body: number }; sceneObjects: number;
}
export interface LeakResult { before: LeakCensus; after: LeakCensus; disposalErrors: string[]; scope: ScopeCensus; stacks: ResourceCounts['stacks']; retained: ReturnType<World['game']['app']['assets']['retained']>; gpu: object }
export interface HarnessPins {
  seed: number;
  capture: number | null;
  /** Observations from the browser init script; never populated by game behaviour. */
  lane?: string;
  sha?: string;
  browser?: string;
  errors?: string[];
  saves?: Saves;
  audioRequests?: string[];
  gpuBytes?: () => GpuBytes;
  heapMB?: () => number;
  resources?: () => ResourceCounts;
}
export type ProbeWorld = World & {
  animals: AnimalManager; weapons: EquipmentService; hud: HUD; audio: Audio; music: Music; arena: TrainingArena;
  interactables: readonly Interactable[];
} & Record<string, unknown>;
export interface ProbePose { name?: string; x?: number; y?: number; z?: number; yaw?: number; pitch?: number }
export interface WalkLeg {
  name: string;
  start: { x: number; z: number; y?: number; yaw: number; hover?: boolean };
  waypoints: { x: number; z: number; jump?: boolean | number; jumpAt?: number }[];
  timeout?: number;
  stuckSeconds?: number;
  inside?: { x0: number; x1: number; z0: number; z1: number; floor: number };
}
export interface WalkResult {
  name: string; stuck: { wp: number; x: number; y: number; z: number }[];
  end: Vec3; maxY: number; out: number; seconds: number; trace: number[][];
}
export type CombatTarget = Animal | TrainingArena['targets'][number];
export interface GameplayState {
  appState: string; clockNow: number;
  player: { pos: Vec3; yaw: number; pitch: number; vel: Vec3; health: number };
  weapon: { id: string; state: WeaponState; ammo: number | null };
  creatures: { id: string; kind: string; pos: Vec3; hp: number; brain: string }[];
  quest: unknown;
}
export interface Fingerprint {
  schema: 1; lane: string; sha: string; build: string; shard: string; tier: string;
  viewport: { w: number; h: number; dpr: number; touch: boolean };
  renderer: string; browser: string; errors: string[]; steps: string[];
  systems: ReturnType<World['game']['systemLabels']>;
  appStates: AppState[];
  registry: { id: string; category: string; surface: string; floor: boolean; solidFloor: boolean; follows: boolean;
    shapes: { cuboid: number; ball: number; capsule: number; convex: number; trimesh: number; treads: number } }[];
  registryModels: { models: number; sets: number };
  physics: { fixed: number; kinematic: number; dynamic: number; colliders: number };
  scene: { totals: { mesh: number; instanced: number; instances: number; skinned: number; points: number; lines: number; sprites: number; lights: number; batched: number };
    named: { path: string; type: string; n: number }[] };
  render: { programs: number; programKeys: string; memory: { geometries: number; textures: number } };
  gpuBytes: GpuBytes;
  audio: { requests: string[]; state: { style: string; set: string; mood: string }; beds?: readonly string[]; score?: string };
  hud: { cls: string; spot: string; shown: boolean }[];
  saves: Saves;
  facade?: { multiDraw: boolean; batches: number; instances: number };
  playMs: number; stepMs: Record<string, number>; heapMB: number;
}
export interface ProbeDeps {
  bootSteps: Record<string, number>; health: () => number; quest: () => unknown;
  /** The retained level world used for leak counts when active frame worlds can be replaced and freed. */
  leakPhysics?: World['physics'];
}
export interface ProbeApp {
  readonly state: AppState;
  readonly systems: Readonly<Record<Phase, readonly string[]>>;
  readonly clock: Readonly<{ now: number; real: number; frame: number; mode: 'live' | 'capture' }>;
  readonly rngSeed: number;
  readonly census: Readonly<{ engine: Readonly<ScopeCensus>; level: Readonly<ScopeCensus> }>;
}
export interface EngineProbe<W extends ProbeWorld = ProbeWorld> {
  version: 1; world: W; shard: { slug: string } & Record<string, unknown>; boot: Fingerprint;
  fingerprint: () => Fingerprint;
  pose: (p: ProbePose) => Promise<void>;
  walkLeg: (leg: WalkLeg) => Promise<WalkResult>;
  combat: { equip: (id: string) => void; target: (kind: string, near: { x: number; z: number; y?: number }) => CombatTarget;
    hold: (animal: CombatTarget, on: boolean) => void; hits: { kind: string; amount: number }[]; kills: string[] };
  arena: () => void;
  state: () => GameplayState;
  onResume: (fn: () => void) => void;
  saves: Saves;
  sounds: () => SoundLog;
  used: () => string[];
  nav: ProbeNav | null;
  leak: () => Promise<LeakResult>;
  budgets: (poses?: readonly string[]) => ReturnType<typeof poseBudgets>;
  readonly app: ProbeApp;
}

const rounded = (n: number): number => Math.round(n * 1000) / 1000;
const point = (v: Vec3): Vec3 => ({ x: rounded(v.x), y: rounded(v.y), z: rounded(v.z) });

/** F3n: an independent harness-seeded stream; only the physics navmesh decides what is walkable. */
export function createProbeNav(mesh: Pick<Navmesh, 'randomPointNear' | 'findPath'>, seed: number): ProbeNav {
  const rng = new Rng(seed), radius = 0.38; // Player.ts's capsule radius; choose a layer that covers it.
  return {
    randomPoint: (near, min, max) => {
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) throw new RangeError('nav randomPoint: invalid distance band');
      // navcat bounds polygons rather than their sampled points, so reject samples outside the requested band.
      for (let attempt = 0; attempt < 64; attempt++) {
        const candidate = mesh.randomPointNear(near, rng.range(min, max), radius, () => rng.next());
        if (!candidate) return null;
        const distance = Math.hypot(candidate.x - near.x, candidate.z - near.z);
        if (distance >= min && distance <= max) return { x: candidate.x, y: candidate.y, z: candidate.z };
      }
      return null;
    },
    path: (a, b) => mesh.findPath(a, b, radius)?.map((v) => ({ x: v.x, y: v.y, z: v.z })) ?? null,
  };
}
/** Authored harness values use a level-keyed scoped exposure, without reading browser globals. */
const isFlagsReader = (value: unknown): value is (() => unknown) => typeof value === 'function';
function authoredQuestFlags(world: ProbeWorld): string[] {
  const read: unknown = world.game.app.debug.snapshot()[`harness.quest.${world.game.level.id}`];
  const flags: unknown = isFlagsReader(read) ? read() : [];
  return Array.isArray(flags) ? flags.filter((flag): flag is string => typeof flag === 'string').sort() : [];
}

/** Synchronous SHA-256: boot is captured in the ready task, without an async digest barrier. */
export function programHash(input: string): string {
  const primes: number[] = [];
  for (let p = 2; primes.length < 64; p++) if (!primes.some((d) => d <= Math.sqrt(p) && p % d === 0)) primes.push(p);
  const fraction = (n: number): number => ((n - Math.floor(n)) * 4294967296) >>> 0;
  const k = primes.map((p) => fraction(Math.cbrt(p)));
  const h = primes.slice(0, 8).map((p) => fraction(Math.sqrt(p)));
  const raw = new TextEncoder().encode(input), length = Math.ceil((raw.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length); bytes.set(raw); bytes[raw.length] = 128;
  const view = new DataView(bytes.buffer); view.setUint32(length - 8, Math.floor(raw.length / 536870912)); view.setUint32(length - 4, raw.length * 8);
  const r = (v: number, n: number): number => (v >>> n) | (v << (32 - n));
  for (let offset = 0; offset < length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15] ?? 0, b = w[i - 2] ?? 0; w[i] = ((w[i - 16] ?? 0) + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + (w[i - 7] ?? 0) + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, j = 0] = h;
    for (let i = 0; i < 64; i++) {
      const t = (j + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + (k[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const u = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      j = g; g = f; f = e; e = (d + t) >>> 0; d = c; c = b; b = a; a = (t + u) >>> 0;
    }
    [a, b, c, d, e, f, g, j].forEach((v, i) => { h[i] = ((h[i] ?? 0) + v) >>> 0; });
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}
/** Cache keys contain JavaScript callback source, which changes under bundling; linked GLSL is the stable input. */
export function compiledProgramHash<Shader>(programs: readonly { vertexShader: Shader; fragmentShader: Shader }[], read: (shader: Shader) => string | null): string {
  const sources = programs.map((program) => {
    const vertex = read(program.vertexShader), fragment = read(program.fragmentShader);
    if (vertex === null || fragment === null) throw new Error('Compiled program source unavailable');
    return JSON.stringify([vertex, fragment]);
  }).sort();
  return programHash(sources.join('\n'));
}

function fingerprint(world: ProbeWorld, deps: ProbeDeps, saves: Saves): Fingerprint {
  const { game, registry, physics, music, audio } = world, pins = harnessPins();
  const totals = { mesh: 0, instanced: 0, instances: 0, skinned: 0, points: 0, lines: 0, sprites: 0, lights: 0, batched: 0 };
  const named: Fingerprint['scene']['named'] = [];
  game.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) totals.mesh++;
    if (o instanceof THREE.InstancedMesh) { totals.instanced++; totals.instances += o.count; }
    if (o instanceof THREE.SkinnedMesh) totals.skinned++;
    if (o instanceof THREE.Points) totals.points++;
    if (o instanceof THREE.Line) totals.lines++;
    if (o instanceof THREE.Sprite) totals.sprites++;
    if (o instanceof THREE.Light) totals.lights++;
    if (o instanceof THREE.BatchedMesh) totals.batched++;
    if (!o.name || o === game.scene) return;
    let depth = 0, parent = o.parent; const path = [o.name];
    while (parent && parent !== game.scene) { depth++; if (parent.name) path.unshift(parent.name); parent = parent.parent; }
    if (depth > 1) return;
    let n = 0; o.traverse((child) => { if (child !== o && child instanceof THREE.Mesh) n++; });
    named.push({ path: path.join('/'), type: o.type, n });
  });
  named.sort((a, b) => a.path.localeCompare(b.path));
  const counts = { fixed: 0, kinematic: 0, dynamic: 0, colliders: physics.world.colliders.len() };
  physics.world.bodies.forEach((b) => { if (b.isFixed()) counts.fixed++; else if (b.isKinematic()) counts.kinematic++; else if (b.isDynamic()) counts.dynamic++; });
  const pieces = registry.pieceList().map((p) => {
    const shapes = { cuboid: 0, ball: 0, capsule: 0, convex: 0, trimesh: 0, treads: 0 };
    for (const c of p.colliders ?? []) { const key = c.kind === 'box' ? 'cuboid' : c.kind === 'hull' ? 'convex' : c.kind; shapes[key]++; }
    return { id: p.id, category: p.category, surface: p.surface ?? 'wood', floor: p.floor !== undefined, solidFloor: p.solidFloor === true, follows: p.follows !== undefined, shapes };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const gl = game.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer: unknown = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const programs = game.renderer.info.programs ?? [];
  const hud = Array.from(document.querySelectorAll<HTMLElement>('#hud [class]')).flatMap((el) => {
    const cls = Array.from(el.classList).filter((c) => c.startsWith('ws-')).sort().join(' ');
    if (!cls) return [];
    const css = getComputedStyle(el);
    return [{ cls, spot: Array.from(el.classList).find((c) => c.startsWith('at-')) ?? '', shown: css.display !== 'none' && css.visibility !== 'hidden' }];
  }).sort((a, b) => a.cls.localeCompare(b.cls) || a.spot.localeCompare(b.spot));
  const build = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';
  const record: Fingerprint = {
    schema: 1, lane: pins?.lane ?? '', sha: pins?.sha ?? build.split('-')[0] ?? '', build, shard: world.game.level.id, tier: TIER,
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, touch: navigator.maxTouchPoints > 0 },
    renderer: typeof renderer === 'string' ? renderer : '', browser: pins?.browser ?? navigator.userAgent, errors: [...(pins?.errors ?? [])],
    steps: Object.keys(deps.bootSteps), systems: game.systemLabels(), appStates: [...game.app.stateHistory], registry: pieces, registryModels: { models: registry.models().length, sets: registry.sets.length },
    physics: counts, scene: { totals, named },
    render: { programs: programs.length, programKeys: compiledProgramHash(programs, (shader) => gl.getShaderSource(shader)), memory: { ...game.renderer.info.memory } },
    gpuBytes: pins?.gpuBytes?.() ?? { textures: 0, renderbuffers: 0, buffers: 0, total: 0 },
    audio: { requests: [...new Set(pins?.audioRequests)].map((url) => url.replace(/\?v=[^&]*$/, '')).sort(), state: { style: music.genre, set: audio.samples.set, mood: music.state.mode } },
    hud, saves: { read: [...new Set(saves.read)].sort(), written: [...new Set(saves.written)].sort() },
    playMs: performance.now(), stepMs: { ...deps.bootSteps }, heapMB: pins?.heapMB?.() ?? 0,
  };
  if (audio.bedIds !== undefined) record.audio.beds = audio.bedIds;
  if (music.scoreId !== undefined) record.audio.score = music.scoreId;
  const facade = game.scene.getObjectByName('facade');
  if (facade !== undefined) {
    let batches = 0, instances = 0;
    facade.traverse((o) => { if (o instanceof THREE.BatchedMesh) batches++; if (o instanceof THREE.InstancedMesh) instances += o.count; });
    record.facade = { multiDraw: gl.getExtension('WEBGL_multi_draw') !== null, batches, instances };
  }
  return record;
}

export function installProbe<W extends ProbeWorld>(world: W, deps: ProbeDeps): EngineProbe<W> {
  const pins = harnessPins(), saves = pins?.saves ?? { read: [], written: [] };
  const hits: { kind: string; amount: number }[] = [], kills: string[] = [], labels: string[] = [];
  let events: Record<string, number> = {}; const ambient = new Set<string>();
  let resume: (() => void) | null = null;
  tap.hit = null; tap.kill = null; tap.use = null; tap.sound = null; tap.resumed = null;
  if (pins) {
    tap.hit = (kind, amount) => { hits.push({ kind, amount }); };
    tap.kill = (kind) => { kills.push(kind); };
    tap.use = (label) => { labels.push(label); };
    tap.sound = (id, kind) => { if (kind === 'ambient') ambient.add(id); else if (tap.ambientDepth === 0) events[id] = (events[id] ?? 0) + 1; };
    tap.resumed = () => { const fn = resume; resume = null; fn?.(); };
  }
  const requireHarness = (): void => { if (!pins) throw new Error('Probe control requires the harness pins'); };
  const { game } = world, app = game.app;
  const raw = pins?.resources?.(), owned = scopeRegistrations((scope) => scope.belongsTo(game.levelScope)), retainedAtBoot = scopeRegistrations((scope) => !scope.belongsTo(game.levelScope));
  const retainedListeners = { window: 0, document: 0, canvas: 0, other: 0 }, retainedTimers = { timeouts: 0, intervals: 0, raf: 0 };
  const externalTimers = raw?.timerIds ? new ExternalTimerBaseline(raw.timerIds, registrationTimerIds()) : null;
  if (raw) {
    for (const key of Object.keys(retainedListeners) as (keyof typeof retainedListeners)[]) retainedListeners[key] = raw.listeners[key] - owned.listeners[key] - retainedAtBoot.listeners[key];
  }
  const bodyBaseline = [...document.body.children].filter((node) => !app.ui.hud.ownerOf(node)?.belongsTo(game.levelScope)).length;
  const baseline: LeakCensus = {
    geometries: 0, textures: 0, programs: 0, bodies: 0, colliders: 0,
    listeners: { window: 0, document: 0, canvas: 0, other: 0 }, timers: { timeouts: 0, intervals: 0, raf: 0 },
    audio: { activeVoices: 0, beds: 0, buses: 0 }, systems: { input: 0, fixed: { pre: 0, step: 0, post: 0 }, update: 0, late: 0, render: 0 },
    events: app.events.census(game.levelScope), dom: { hud: 0, body: 0 }, sceneObjects: 0,
  };
  const leakPhysics = deps.leakPhysics ?? world.physics;
  const retainedPhysics = { bodies: leakPhysics.world.bodies.len() - game.levelScope.census.bodies,
    colliders: leakPhysics.world.colliders.len() - game.levelScope.census.colliders };
  app.debug.leakBaseline = { ...baseline };
  app.debug.expose('leakBaseline', app.debug.leakBaseline);
  const engineSystemIds = new Set(Object.values(app.systemsByPhase()).flat().filter((system) => !game.levelSystemIds().includes(system.id)).map((system) => system.id));
  const census = (): LeakCensus => {
    const resources = pins?.resources?.();
    if (!resources) throw new Error('Leak census requires independent harness resource counters');
    const gpu = game.retainedGpuCounts(), listeners = { ...resources.listeners }, timers = { ...resources.timers };
    const retainedNow = scopeRegistrations((scope) => !scope.belongsTo(game.levelScope));
    if (!externalTimers || !resources.timerIds) throw new Error('Leak census requires independent live timer identities');
    const externalNow = externalTimers.live(resources.timerIds);
    retainedTimers.timeouts = externalNow.timeouts; retainedTimers.intervals = externalNow.intervals;
    for (const key of Object.keys(listeners) as (keyof typeof listeners)[]) listeners[key] -= retainedListeners[key] + retainedNow.listeners[key];
    for (const key of Object.keys(timers) as (keyof typeof timers)[]) timers[key] -= retainedTimers[key] + retainedNow.timers[key];
    let objects = 0; game.scene.traverse(() => { objects++; });
    const audio = world.audio.census();
    const phases = app.systemsByPhase(), phaseCount = (phase: Phase): number => phases[phase].filter((s) => !engineSystemIds.has(s.id)).length;
    return { geometries: game.renderer.info.memory.geometries - gpu.geometries, textures: game.renderer.info.memory.textures - gpu.textures,
      programs: (game.renderer.info.programs?.length ?? 0) - gpu.programs,
      bodies: leakPhysics.world.bodies.len() - retainedPhysics.bodies, colliders: leakPhysics.world.colliders.len() - retainedPhysics.colliders,
      listeners, timers, audio: { ...audio, buses: 0 },
      systems: { input: phaseCount('input'), fixed: { pre: phaseCount('fixed.pre'), step: phaseCount('fixed.step'), post: phaseCount('fixed.post') },
        update: phaseCount('update'), late: phaseCount('late'), render: phaseCount('render') },
      events: app.events.census(), dom: { hud: document.querySelectorAll('#hud *').length - game.retainedHudCount(), body: document.body.children.length - bodyBaseline },
      sceneObjects: objects - game.retainedSceneObjects() };
  };
  const mesh = app.navmesh, query = mesh ? createProbeNav(mesh, pins?.seed ?? 0x2545f491) : null;
  const nav: ProbeNav | null = query ? {
    randomPoint: (near, min, max) => { requireHarness(); return query.randomPoint(near, min, max); },
    path: (a, b) => { requireHarness(); return query.path(a, b); },
  } : null;
  const land = (): void => {
    const p = world.player, top = p.position.y + 2.5;
    const floor = floorBelow(world.physics, p.position.x, p.position.z, top, 2.6);
    if (floor !== undefined) p.spawn(p.position.x, p.position.z, p.yaw, Math.max(p.position.y, floor));
  };
  const pose = async (p: ProbePose): Promise<void> => {
    requireHarness(); const pl = world.player, spawn = world.game.level.spawn;
    pl.spawn(p.x ?? spawn.x, p.z ?? spawn.z, p.yaw ?? spawn.yaw, p.y);
    land(); pl.pitch = p.pitch ?? 0; pl.velocity.set(0, 0, 0); game.app.input.clear();
    await new Promise<void>((resolve) => { app.engineScope.raf(() => { resolve(); }); });
  };
  const handles: EngineProbe['shard'] = { slug: world.game.level.id };
  const authored: unknown = app.debug.snapshot()[`harness.shard.${world.game.level.id}`];
  if (authored !== null && typeof authored === 'object') Object.assign(handles, authored);
  const probe: EngineProbe<W> = {
    app: Object.freeze({
      get state() { return app.state; },
      get systems() {
        const phases = app.systemsByPhase();
        return Object.freeze({ input: Object.freeze(phases.input.map((s) => s.id)), 'fixed.pre': Object.freeze(phases['fixed.pre'].map((s) => s.id)),
          'fixed.step': Object.freeze(phases['fixed.step'].map((s) => s.id)), 'fixed.post': Object.freeze(phases['fixed.post'].map((s) => s.id)),
          update: Object.freeze(phases.update.map((s) => s.id)), late: Object.freeze(phases.late.map((s) => s.id)), render: Object.freeze(phases.render.map((s) => s.id)) });
      },
      get clock() { return Object.freeze({ now: app.clock.now, real: app.clock.real, frame: app.clock.frame, mode: app.clock.mode }); },
      get rngSeed() { return app.rng.seedValue; },
      get census() { return Object.freeze({ engine: Object.freeze(app.engineScope.census), level: Object.freeze(game.levelScope.census) }); },
    }),
    version: 1, world, get shard() { return { ...handles, ...app.debug.scopedSnapshot(), slug: world.game.level.id }; },
    boot: fingerprint(world, deps, saves), fingerprint: () => fingerprint(world, deps, saves), pose, nav,
    budgets: (poses = []) => poseBudgets(world.game.level.id, TIER, world.game.level.budgets, poses),
    leak: async () => {
      requireHarness();
      if (!pins?.resources) throw new Error('Leak census requires independent harness resource counters');
      let disposalErrors: string[] = [];
      try { await app.unloadLevel(); } catch (error) { disposalErrors = disposalErrorMessages(error); }
      await new Promise<void>((resolve) => { app.engineScope.raf(() => { app.engineScope.raf(() => { resolve(); }); }); });
      return { before: structuredClone(baseline), after: census(), disposalErrors, scope: game.levelScope.census,
        stacks: pins.resources().stacks, retained: app.assets.retained(), gpu: game.gpuResourceDiagnostics() };
    },
    walkLeg: async (leg) => {
      requireHarness();
      const p = world.player, held = world.animals.animals.map((a) => a.harnessHold);
      for (const a of world.animals.animals) a.harnessHold = true;
      try {
        if (!leg.inside) await pose({ ...leg.start, pitch: -0.12 });
        if (leg.start.hover === true) p.setHover(true);
        const trace: number[][] = [], stuck: WalkResult['stuck'] = [];
        let wi = 0, t = 0, jumpT = 0, jump2 = false, lastProg = { t: 0, d: Infinity }, out = 0, maxY = p.position.y;
        const t0 = performance.now();
        await new Promise<void>((resolve) => {
          let stop: () => void = () => { /* assigned before any simulation frame */ };
          const tick = (dt: number): void => {
            if (world.hud.paused) { game.app.input.clear(); return; }
            if (wi >= leg.waypoints.length || t > (leg.timeout ?? 60)) { game.app.input.clear(); stop(); resolve(); return; }
            t += dt; const wp = leg.waypoints[wi]; if (!wp) { stop(); resolve(); return; }
            const dx = wp.x - p.position.x, dz = wp.z - p.position.z, d = Math.hypot(dx, dz), q = p.position;
            trace.push([rounded(t), rounded(q.x), rounded(q.y), rounded(q.z), rounded(p.velocity.y), p.onGround ? 1 : 0, p.onPlatform ? 1 : 0, p.swimming ? 1 : 0, p.sliding ? 1 : 0, wi]);
            maxY = Math.max(maxY, q.y); const box = leg.inside;
            if (box && (q.x < box.x0 || q.x > box.x1 || q.z < box.z0 || q.z > box.z1 || q.y < box.floor)) out++;
            if (d < 0.8) { wi++; lastProg = { t, d: Infinity }; game.app.input.setHeld('jump', false); jumpT = 0; jump2 = false; }
            else if (d < lastProg.d - 0.3) lastProg = { t, d };
            else if (box && t - lastProg.t > 1.2) { wi++; lastProg = { t, d: Infinity }; game.app.input.setHeld('jump', false); jumpT = 0; jump2 = false; }
            else if (t - lastProg.t > (leg.stuckSeconds ?? 2)) { stuck.push({ wp: wi, ...point(q) }); p.spawn(wp.x, wp.z, p.yaw); land(); wi++; lastProg = { t, d: Infinity }; }
            p.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
            const jumps = wp.jump === true ? 1 : typeof wp.jump === 'number' ? wp.jump : 0;
            if (jumps > 0 && d < (wp.jumpAt ?? 1.6) && jumpT === 0) { game.app.input.setHeld('jump', true); jumpT = 1; }
            else if (jumpT > 0 && jumpT++ > 3) game.app.input.setHeld('jump', false);
            if (jumps > 1 && jumpT > 5 && !jump2 && p.velocity.y < 1.5) { game.app.input.setHeld('jump', true); jump2 = true; jumpT = 1; }
            if (jumps === 0) jumpT = 0;
          };
          stop = world.game.watchFrames(tick);
        });
        return { name: leg.name, stuck, end: point(p.position), maxY: rounded(maxY), out, seconds: (performance.now() - t0) / 1000, trace };
      } finally { game.app.input.clear(); if (leg.start.hover === true) p.setHover(false); world.animals.animals.forEach((a, i) => { a.harnessHold = held[i] ?? false; }); }
    },
    combat: {
      equip: (id) => { requireHarness(); const weapon = world.weapons.list.find((w) => w.id === id); if (!weapon) throw new Error(`Weapon ${id} absent from ${world.game.level.id}`); world.weapons.select(weapon.id, true); },
      target: (kind, near) => {
        requireHarness(); const candidates: CombatTarget[] = kind === 'training-dummy' ? world.arena.targets : world.animals.animals;
        const target = candidates.filter((a) => a.alive && a.kind === kind).sort((a, b) => Math.hypot(a.position.x - near.x, a.position.z - near.z) - Math.hypot(b.position.x - near.x, b.position.z - near.z))[0];
        if (!target) throw new Error(`No live ${kind} in ${world.game.level.id}`);
        target.harnessHold = true; return target;
      },
      hold: (a, on) => { requireHarness(); a.harnessHold = on; }, hits, kills,
    },
    arena: () => { requireHarness(); world.hud.enterArenaNow(); },
    state: () => ({
      appState: world.game.app.state, clockNow: world.game.app.clock.now,
      player: { pos: point(world.player.position), yaw: world.player.yaw, pitch: world.player.pitch, vel: point(world.player.velocity), health: deps.health() },
      weapon: { id: world.weapons.current.id, state: { ...world.weapons.current.state }, ammo: world.weapons.current.state.ammo ?? null },
      creatures: world.animals.animals.map((a, i) => ({ id: `${a.kind}:${i}`, kind: a.kind, pos: point(a.position), hp: a.hp, brain: a.state })).sort((a, b) => a.id.localeCompare(b.id)),
      quest: { adventure: deps.quest(), level: authoredQuestFlags(world) },
    }),
    onResume: (fn) => { requireHarness(); resume = fn; }, saves,
    sounds: () => { const log = { event: events, ambient: [...ambient].sort() }; events = {}; ambient.clear(); return log; },
    used: () => labels.splice(0),
  };
  setCurrentProbe(probe);
  return probe;
}

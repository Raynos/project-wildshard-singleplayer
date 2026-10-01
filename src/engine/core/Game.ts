import { app } from '../app/runtime';
import { Scope } from '../app/scope';
import { SceneOwnership } from '../app/sceneOwnership';
import { UploadOwnership } from '../render/uploadOwnership';
import type { Phase } from '../app/systems';
import { currentScope } from '../app/legacyCapture';
import * as THREE from 'three';
import {
  EffectComposer, type RenderPass, EffectPass, BloomEffect, SMAAEffect, FXAAEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode, BlendFunction, GodRaysEffect, LUT3DEffect, KernelSize, SMAAPreset, EdgeDetectionMode, ChromaticAberrationEffect, HueSaturationEffect, BrightnessContrastEffect, NoiseEffect,
  type Effect, type Pass,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { EngineEffects, LookComposition, LookStrategy } from '../render/look';
import { resolveTierKnobs, type LevelSpec, type TierKnobs } from '../level/spec';
import { installAtmosphere } from '../world/Atmosphere';
import { setAnisotropy } from './assets';
import { Sky } from '../world/Sky';
import { GradeEffect } from './Grade';
import { activeGrade } from '../world/lookFlags';
import { VolumetricsEffect, makeNoiseTexture } from './Volumetrics';
import { getActiveChunk } from '#game/shard/registry';
import { TIER, TIER_CONFIG, frameCapFps, phonePictureCuts, type Tier } from './tier';
import { installLookV2Fog } from '#shards/nalati-grasslands/look/fog';
import { buildLookV2Chain } from '#shards/nalati-grasslands/look/grade';
import { chunkShadowCasters } from '../world/shadowChunks';
import { PERFLOAD, snapshotPrograms, newProgramsSince, describeProgram, perfLog, dumpPrograms, parallelCompile } from '../boot/perflog';
import { sceneJobs, shadowJobs, backgroundJob, postJobs, runPrecompile } from '../boot/precompile';
import { worldTime } from './time';
import { installViewport, viewportHeight } from './viewport';
import { FIXED_STEP } from './fixedStep';
import { SHADOW_LAYER } from './shadowLayer';
import { WorldRenderPass } from './worldDepth';
import { makeSystem, setLoopState, systemFault, type GameSystem } from './faults';
import { frameCost } from './frameCost';
import { recordGpuCheckpoint, traceBootPasses } from '../boot/gpuTrace';
import { exploreEntryPending, recordExploreFrame, recordBootCheckpoint, bootTraceActive } from '../boot/bootTrace';
import { cullPlaced } from '../models/place';

/** the world's pace during a hit-stop (not 0: nothing downstream has to cope with a zero dt) */
const HIT_STOP_SCALE = 0.04;
/** the frame cap's tolerance for vsync timestamp jitter (see Game.start) */
const FRAME_CAP_SLACK_MS = 4;
const MAX_FIXED_STEPS = 3; // per frame; past it the backlog is dropped (a stall never replays as a burst)
/** E153: the boot's warm-up draws of the world, one per quarter-turn (Game.warmTurn) */
const WARM_TURNS = 4;
/** the three slots of one fixed step, in order: `pre` readies the world, `step` advances it, `post` moves against it */
export type FixedPhase = 'pre' | 'step' | 'post';

/**
 * E142 (the 30-fps-at-2× lane): the god rays' passes only while the sun can be in the picture. GodRaysEffect.update
 * copies the scene's depth at full size, draws the sun disc + halo into it (depth-tested), blurs that and marches the
 * rays toward the sun's screen point — every frame, though with the sun outside the view the mask is empty and the rays
 * are black, which the SCREEN blend leaves as the image. So: while the sun's bounds are outside the camera's frustum (or
 * it is hidden, or the rays are at 0), the passes are skipped and the rays' target is cleared once. The same picture;
 * −0.06…−0.15 ms on the M5 at 1206×2622 at the six E142 poses (the sun was out of view at all of them).
 */
function skipRaysOffscreen(rays: GodRaysEffect, camera: THREE.Camera, disc: THREE.Mesh): void {
  const update = rays.update.bind(rays);
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4(), box = new THREE.Box3(), sphere = new THREE.Sphere(), v = new THREE.Vector3();
  const clearColor = new THREE.Color();
  const target: unknown = Reflect.get(rays, 'renderTargetB'); // the rays' output (`rays.texture`'s target; not in the typings)
  if (!(target instanceof THREE.WebGLRenderTarget)) return;
  let cleared = false;
  const inView = (): boolean => {
    if (!disc.visible || rays.blendMode.opacity.value <= 0) return false;
    // the disc's world bounds, and each child's (the halo sprite faces the camera: its half-diagonal around its centre)
    box.makeEmpty();
    disc.traverseVisible((o) => {
      if (o instanceof THREE.Sprite) {
        o.getWorldPosition(v);
        const e = o.matrixWorld.elements, r = Math.hypot(e[0], e[1], e[2]) * Math.SQRT1_2;
        box.expandByPoint(v.clone().addScalar(r)); box.expandByPoint(v.clone().addScalar(-r));
      } else box.expandByObject(o, false);
    });
    if (box.isEmpty()) return false;
    box.getBoundingSphere(sphere);
    frustum.setFromProjectionMatrix(m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return frustum.intersectsSphere(sphere);
  };
  rays.update = (renderer, inputBuffer, deltaTime) => {
    if (inView()) { cleared = false; update(renderer, inputBuffer, deltaTime); return; }
    if (cleared) return;
    const prev = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.setClearColor(clearColor, alpha);
    renderer.setRenderTarget(prev);
    cleared = true;
  };
}

export class Game {
  readonly app = app;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private _composer: EffectComposer | null = null;
  private _sky: Sky | null = null;
  // oxlint-disable-next-line typescript/no-deprecated -- Clock→Timer changes getDelta semantics; migrate separately
  clock = new THREE.Clock();
  // Frame phases (PHYSICS P2 / ENGINE-FIT E2): input → fixed steps (pre → step → post, × 0‥3) → update (`onUpdate`) → late → render.
  // Every entry is a GameSystem (src/engine/core/faults.ts, E133): called inside its own try/catch, switched off if it keeps throwing.
  readonly engineScope = app.engineScope.child('game');
  readonly levelScope = currentScope()?.resources ?? new Scope('level');
  get tier(): Tier { return TIER; }
  private ownership: SceneOwnership | null = null;
  private readonly uploads = new UploadOwnership(this.levelScope, app.assets);
  readonly leakBaseline = new Scope('baseline').census;
  hudBaseline = 0;
  hudRetained: ReadonlySet<Element> = new Set();
  retainedHudCount(): number {
    const legacy = currentScope();
    return [...document.querySelectorAll('#hud *')].filter((node) => {
      const owner = legacy?.nodeOwners.get(node);
      return this.hudRetained.has(node) || (owner !== undefined && !owner.belongsTo(this.levelScope));
    }).length;
  }
  /** Snapshot the engine rig before any level geometry is built. */
  retainEngineScene(): void {
    this.ownership = new SceneOwnership(this.scene, this.levelScope, this.app.assets);
    this.ownership.retain(this.scene);
  }
  captureLevelResources(): void { this.ownership?.retainContainer(this._composer); this.ownership?.capture(); }
  retainKitResources(): void {
    this.ownership?.retain(this.camera);
    this.ownership?.retainContainer(this._composer);
    this.ownership?.retainContainer(this._sky);
  }
  retainedSceneObjects(): number { return this.ownership?.retainedNodeCount() ?? 0; }
  retainedGpuCounts(): { geometries: number; textures: number; programs: number } {
    const live = this.uploads.resources();
    const textures = new Set<unknown>(), programs = new Set<unknown>();
    let geometries = 0;
    for (const resource of this.app.assets.retainedResources()) {
      if (resource instanceof THREE.BufferGeometry && live.has(resource)) geometries++;
      const value: unknown = this.renderer.properties.get(resource);
      if (typeof value !== 'object' || value === null) continue;
      const props = value;
      if (resource instanceof THREE.Texture) {
        const texture: unknown = Reflect.get(props, '__webglTexture'); if (texture !== undefined) textures.add(texture);
      }
      if (resource instanceof THREE.Material) {
        const compiled: unknown = Reflect.get(props, 'programs');
        if (compiled instanceof Map) for (const program of compiled.values()) programs.add(program);
      }
    }
    return { geometries, textures: textures.size, programs: programs.size };
  }
  gpuResourceDiagnostics(): object {
    const retained = new Set<object>(this.app.assets.retainedResources());
    const live = this.uploads.resources();
    const read = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
    return { total: { ...this.renderer.info.memory, programs: this.renderer.info.programs?.length ?? 0 },
      retained: this.retainedGpuCounts(), resources: [...live].map((resource) => {
        const props: unknown = this.renderer.properties.get(resource);
        const compiled = read(props, 'programs'), source = read(resource, 'source'), image = read(source, 'data');
        return { type: resource.constructor.name, uuid: read(resource, 'uuid'), name: read(resource, 'name'),
          retained: retained.has(resource), texture: read(props, '__webglTexture') !== undefined,
          programs: compiled instanceof Map ? [...compiled.values()].map((p: unknown) => read(p, 'id')) : [],
          source: read(source, 'uuid'), image: { width: read(image, 'width'), height: read(image, 'height'), src: read(image, 'src') },
          allocation: read(resource, '__f8Allocation') };
      }) };
  }
  unloadLevel(): void {
    if (this.levelScope.disposed) return;
    this.captureLevelResources();
    this.app.setState('loading');
    this.frameGate = () => false;
    this.levelScope.dispose();
    this.app.events.emit('level.unloaded', { id: this.levelId });
  }
  registrationScope = this.engineScope;
  private readonly fixed: Record<FixedPhase, Phase> = { pre: 'fixed.pre', step: 'fixed.step', post: 'fixed.post' };
  private readonly faultSystems = new Map<string, GameSystem<(dt: number, t: number) => void>>();
  private anonymous = 0;
  /** E357 F2: list order is the execution order; observation never registers a system. */
  systemLabels(): Record<'input' | 'fixed.pre' | 'fixed.step' | 'fixed.post' | 'update' | 'late', string[]> {
    const phases = this.app.systemsByPhase();
    return {
      input: phases.input.map((s) => s.id),
      'fixed.pre': phases['fixed.pre'].map((s) => s.id),
      'fixed.step': phases['fixed.step'].map((s) => s.id),
      'fixed.post': phases['fixed.post'].map((s) => s.id),
      update: phases.update.map((s) => s.id),
      late: phases.late.map((s) => s.id),
    };
  }
  levelSystemIds(): string[] { return this.app.systemIds(this.levelScope); }
  /** The bootstrap boundary: everything registered next belongs to the level. */
  beginLevelSystems(): void {
    this.registrationScope = this.levelScope; this.app.levelScope = this.levelScope;
    const legacy = currentScope(); if (legacy) legacy.owner = this.levelScope;
  }
  /** the sky + the draw: core (a throw there that repeats is fatal, faults.ts) */
  private readonly renderSystem = makeSystem(null, 'render', true, 'render');
  /** frames drawn since start() (the fault streak counts in these) */
  private frameNo = 0;
  /** true once a core system died (faults.ts 'fatal'): the loop stops; the fatal modal is up */
  dead = false;
  private fixedAcc = 0;
  /** 0‥1: how far this frame's render sits past the last fixed step (interpolate anything the fixed step moves) */
  alpha = 0;
  /** fixed steps run this frame (0 during most of a hit-stop) */
  fixedSteps = 0;
  stats = { fps: 0, frames: 0, acc: 0 };
  /** last 120 frame times in ms (ring; `frameI` is the next slot) — the perf meter reads p50/p95 from it */
  frameMs = new Float32Array(120); frameI = 0;
  /** the same frames' main-thread time in ms (input → the frame submitted), slot for slot with `frameMs` (src/engine/ui/perfProbe.ts) */
  workMs = new Float32Array(120);
  /** …of which the game logic (input → fixed steps → updaters → late) and the draw's CPU side (sky + composer.render) */
  updateMs = new Float32Array(120); renderMs = new Float32Array(120);
  /** frames drawn since start() */
  frameCount = 0;
  /** E357 F2: simulation time observed only on a drawn frame; the wall clock still runs behind menus. */
  private _frameTime = 0;
  get frameTime(): number { return this._frameTime; }
  /** draw calls / triangles of the last whole frame (all composer passes) */
  lastFrame = { calls: 0, triangles: 0 };
  /** WebGL context loss bookkeeping (iOS drops the context in the background); the perf meter shows it */
  gl = { lostAt: 0, restoredAt: 0, events: 0 };
  /** Return false to skip a whole frame (updaters + render): a menu covering the canvas, a still title on a phone. */
  frameGate: () => boolean = () => true;
  /** GPU recovery (src/engine/core/GpuRecovery.ts): true while the WebGL context is lost or being rebuilt — no tick, no draw, not even a forced frame */
  hold = false;
  /** Restart the frame loop if it has not run for a second (a browser that dropped its animation frame across an app switch). Set by start(). */
  kickLoop: () => void = () => undefined;
  /**
   * E183: draw ONE whole frame (the systems' step and the draw) at the next animation frame even though the gate is shut —
   * what a return from the background already does. main.ts asks for it once while the title idles, so the first frame's
   * one-time work (a system's lazy first step, first-sight texture uploads) is paid under the title art, not on the tap.
   */
  primeFrame: () => void = () => undefined;
  private captures: { maxW: number; resolve: (c: HTMLCanvasElement) => void }[] = [];
  /** A copy of the next rendered frame, at most `maxW` px wide (the review inbox's screenshot, src/engine/ui/Feedback.ts). The drawing
   *  buffer is not preserved, so the copy is taken in the same task as composer.render(); it resolves on the next frame drawn. */
  captureFrame(maxW: number): Promise<HTMLCanvasElement> { return new Promise((resolve) => { this.captures.push({ maxW, resolve }); }); }
  private flushCaptures(): void {
    const src = this.canvas;
    for (const { maxW, resolve } of this.captures.splice(0)) {
      const k = Math.min(1, maxW / Math.max(1, src.width));
      const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
      c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
      resolve(c);
    }
  }
  /**
   * A small still of the world as it stands, now: one frame rendered and copied in the same task (the drawing buffer
   * is not preserved). The app-switch resume screen's backdrop, taken as the page hides (E61, GpuRecovery.ts). Null
   * before the composer exists or on a dead context.
   */
  /** A shard's per-frame render uniforms, re-read for the camera as it stands now: a render outside the loop from a
   *  moved camera (Model Explorer's catalog thumbnail) must call it first. Nine Dragon's silk fog is measured from the
   *  camera `frame()` saw, so a thumbnail fogged from the turntable's eye came out a white silhouette (E289). */
  shardFrame(): void { this.camera.updateMatrixWorld(); this.lookStrategy?.frame?.(0, this.clock.elapsedTime); }

  snapshot(maxW: number): HTMLCanvasElement | null {
    if (this._composer === null || this.hold || this.renderer.getContext().isContextLost()) return null;
    this.lookStrategy?.frame?.(0, this.clock.elapsedTime);
    this._composer.render(0);
    const src = this.canvas, k = Math.min(1, maxW / Math.max(1, src.width));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  private renderPass!: RenderPass;
  volumetrics!: VolumetricsEffect;
  /** runtime handles on the colour chain (set by buildComposer) — the day/night clock + weather retune them (src/engine/world/DayNight.ts) */
  post: { grade: GradeEffect; saturation: HueSaturationEffect; contrast: BrightnessContrastEffect; bloom: BloomEffect } | null = null;
  /** the post chain — set by buildComposer(); resize() and the loop hold the nullable field directly */
  get composer(): EffectComposer { if (this._composer === null) throw new Error('Game.composer read before buildComposer()'); return this._composer; }
  /** the sky — set by buildSky() */
  get sky(): Sky { if (this._sky === null) throw new Error('Game.sky read before buildSky()'); return this._sky; }

  readonly level: LevelSpec;
  constructor(public canvas: HTMLCanvasElement, context: WebGL2RenderingContext, level: LevelSpec) {
    this.level = level;
    this.app.scene = this.scene;
    this.app.render = this;
    const legacy = currentScope(); if (legacy) legacy.owner = this.engineScope;
    installAtmosphere(getActiveChunk().style === 'painterly', level.atmosphere); // the painterly shard's air: aerial perspective + cloud shadows
    if (getActiveChunk().style === 'painterly') installLookV2Fog(); // Nalati: the fog coloured from the panorama (src/shards/nalati-grasslands/look/fog.ts)
    installViewport(); // --ws-vh: the real height (an iOS home-screen app reports innerHeight a status bar short — viewport.ts)
    const tracedBoot = bootTraceActive();
    if (tracedBoot) recordBootCheckpoint('renderer:before', { userAgent: navigator.userAgent.slice(0, 250), devicePixelRatio: window.devicePixelRatio });
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, stencil: false, depth: true });
    } catch (error) {
      if (tracedBoot) recordBootCheckpoint('renderer:failed', { message: error instanceof Error ? error.message.slice(0, 250) : String(error).slice(0, 250) });
      throw error;
    }
    if (tracedBoot) recordGpuCheckpoint(this.renderer, 'renderer:created');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_CONFIG.dpr));
    this.renderer.setSize(window.innerWidth, viewportHeight());
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composer
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoft: it renders PCF anyway, and the type is in every program's cache key
    setAnisotropy(this.renderer);
    // Three keeps its generated shadow materials in WebGLShadowMap's renderer cache, outside the scene graph.
    const draw = this.renderer.renderBufferDirect.bind(this.renderer);
    this.renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      if ((material instanceof THREE.MeshDepthMaterial || material instanceof THREE.MeshDistanceMaterial) &&
        material !== object.customDepthMaterial && material !== object.customDistanceMaterial) {
        const key = `renderer:shadow:${material.uuid}`;
        if (!app.assets.has(key)) {
          app.assets.register(key, material, { retain: true });
          const released = (): void => { app.assets.forgetDisposed(key); material.removeEventListener('dispose', released); };
          material.addEventListener('dispose', released);
        }
      }
      draw(camera, scene, geometry, material, object, group);
    };
    this.uploads.attach(this.renderer);
    // shadow-only casters (shadowLayer.ts): the shadow pass tests layers against the view camera, so the view camera sees
    // SHADOW_LAYER while — and only while — the shadow maps draw. Before this the cabins' depth proxies (PLAY-PERF lever
    // 12, 46868b5) were never drawn: the cabins cast no wall / roof shadow at all.
    const shadowMap = this.renderer.shadowMap, renderShadows = shadowMap.render.bind(shadowMap);
    shadowMap.render = (lights, scene, camera) => {
      const mask = camera.layers.mask;
      camera.layers.enable(SHADOW_LAYER);
      try { renderShadows(lights, scene, camera); } finally { camera.layers.mask = mask; }
    };
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / viewportHeight(), 0.08, 2600);
    window.addEventListener('resize', () => this.resize());
  }

  /** the shard's render strategy (ShardManifest.render), loaded by buildSky; null = the engine's chain as it is */
  private lookStrategy: LookStrategy | null = null;
  private levelId = '';
  /** where the strategy put its passes (asked once, in buildComposer) */
  private composition: LookComposition | null = null;

  async buildSky(): Promise<Sky> {
    this.levelId = this.level.id;
    const render = this.level.look?.() ?? null; // the render code downloads while the sky builds; buildComposer reads both
    this.lookStrategy = await render;
    this._sky = await new Sky(this.scene, this.camera, this.renderer).build(this.lookStrategy?.backdrop, { level: this.level, tier: TIER, look: this.app.gradeFor(getActiveChunk()).look });
    this.levelScope.onDispose(() => { this.lookStrategy?.dispose?.(); this.lookStrategy = null; });
    return this._sky;
  }

  /**
   * The colour chain's pass: the engine's `order` — or, with a shard render strategy, the order it composes from the
   * engine's effects (and its own), asked here, once, when every effect is built (ShardManifest.LookStrategy.compose).
   */
  private colourPass(composer: EffectComposer, order: Effect[], fx: Omit<EngineEffects, 'order'>): EffectPass {
    const R = this.lookStrategy;
    if (R === null) return new EffectPass(this.camera, ...order);
    const scope = this.levelScope.child('look');
    this.composition = R.compose({ app: this.app, scope, debug: { expose: (name, value) => { scope.onDispose(this.app.debug.scopedExpose(name, value)); } }, renderer: this.renderer, scene: this.scene, camera: this.camera, composer, tier: TIER, fx: { ...fx, order } });
    return new EffectPass(this.camera, ...(this.composition.chain ?? order));
  }

  /** the strategy's passes into their slots around the engine's (ShardManifest.LookComposition): scene → AO → colour → SMAA */
  private placeShardPasses(composer: EffectComposer, colour: EffectPass): void {
    const C = this.composition;
    if (C === null) return;
    const insert = (passes: Pass[] | undefined, at: number): void => { for (const [i, p] of (passes ?? []).entries()) composer.addPass(p, at + i); };
    insert(C.beforeChain, composer.passes.indexOf(colour));
    insert(C.afterChain, composer.passes.indexOf(colour) + 1);
    insert(C.afterScene, composer.passes.indexOf(this.renderPass) + 1);
    insert(C.beforeScene, 0);
  }

  private renderKnobs(): TierKnobs {
    const kit: TierKnobs = {};
    for (const schema of this.app.levelRegistrations.knobSchemas()) Object.assign(kit, schema.defaults);
    return resolveTierKnobs({ ao: TIER_CONFIG.ao, slices: phonePictureCuts(), warmTurns: WARM_TURNS }, kit, this.level.tiers, TIER);
  }

  buildComposer(): void {
    if (getActiveChunk().style === 'painterly') { this._composer = buildLookV2Chain(this.renderer, this.scene, this.camera); return; } // Nalati: MSAA → the one grade (src/shards/nalati-grasslands/look/grade.ts)
    const { atmosphere: A } = getActiveChunk();
    const { grade: G, look } = activeGrade(getActiveChunk()); // + the look loop's layer (PH-L1 / L4)
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    // the scene pass keeps the world's depth for the depth readers below (AO, the volumetric march, the god rays' sun mask):
    // the viewmodels' depth clear used to leave them the weapon alone (worldDepth.ts)
    // E142: on Pine Hollow's phone tier the viewmodels draw into near depth slices instead of clearing, so the world's
    // depth needs no mid-pass copy (worldDepth.ts)
    const level = getActiveChunk(), knobs = this.renderKnobs();
    const slices = knobs.slices ?? phonePictureCuts(); // E142 / E189: Pine Hollow's and Driftwood's phone tier
    this.renderPass = new WorldRenderPass(this.scene, this.camera, composer, slices);
    composer.addPass(this.renderPass);

    let aoPass: N8AOPostPass | null = null;
    // A level's tier data can keep its compositor below the transient boot peak.
    if (knobs.ao ?? TIER_CONFIG.ao) {
      const ao = new N8AOPostPass(this.scene, this.camera, window.innerWidth, viewportHeight());
      aoPass = ao;
      ao.configuration.aoRadius = 2.5;
      ao.configuration.distanceFalloff = 1.0;
      ao.configuration.intensity = 2.5;
      ao.configuration.halfRes = true;
      ao.configuration.screenSpaceRadius = false;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color(0.05, 0.06, 0.05);
      // n8ao's transparency pre-passes hide each mesh with `visible = was && material.transparent && …`. On a
      // multi-material mesh (an animal's fur / hard / eye, the rifle pickup) `material.transparent` is undefined, the
      // result is `undefined`, three draws it, and every rig on screen was drawn a second time into the depth-write
      // pass — 200–350 extra desktop draws at the Pine Hollow poses. Opaque ones now sit that pass out; n8ao's own
      // AO-only render mode is unchanged by it (5 m from a boar: max Δ 5, the frame-to-frame noise 17). PINE-HOLLOW PH-P2.
      //
      // Its first pre-pass (the transparents that write no depth: glass, clouds, water, smoke, particles, the pickup orb —
      // 20–40 desktop draws) is skipped as well (PH-P2): the compositer takes max(that pass's alpha, (1 − the
      // depth-writing pass's alpha) × [no depth-writing transparent drew there]), which is 1 — no AO — wherever no
      // depth-writing transparent (the viewmodels, the pickup item, lantern glass) drew, whatever the first pass held. It
      // could only matter where a depth-free transparent lies in front of one of those, and a same-instant A/B at the
      // perf poses, day and rain, shows no pixel past the frame noise. `aoLeanTransparency = false` draws it again.
      const opaqueMulti: THREE.Object3D[] = [];
      const lean: THREE.Object3D[] = [];
      const renderTransparency = ao.renderTransparency.bind(ao);
      ao.renderTransparency = (renderer) => {
        this.scene.traverseVisible((o) => {
          const m = (o as Partial<THREE.Mesh>).material;
          if (m === undefined) return;
          if (Array.isArray(m)) { if (o instanceof THREE.Mesh && m.every((x) => !x.transparent)) opaqueMulti.push(o); return; }
          if (this.aoLeanTransparency && m.transparent && !m.depthWrite && o.userData['treatAsOpaque'] !== true) lean.push(o);
        });
        for (const o of opaqueMulti) o.visible = false;
        for (const o of lean) o.userData['treatAsOpaque'] = true; // n8ao's own opt-out of both pre-passes
        // its two renderer.render calls re-drew every shadow cascade too (autoUpdate), cleared and refilled with only the
        // meshes it left visible — after the main pass had used them, so nothing saw it: skip the redraw (Water.ts does too)
        const autoShadows = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        try { renderTransparency(renderer); } finally {
          renderer.shadowMap.autoUpdate = autoShadows;
          for (const o of opaqueMulti) o.visible = true;
          opaqueMulti.length = 0;
          for (const o of lean) delete o.userData['treatAsOpaque'];
          lean.length = 0;
        }
      };
      composer.addPass(ao);
    }

    const vol = new VolumetricsEffect(this.camera, makeNoiseTexture(), TIER_CONFIG.volumetricSteps, TIER_CONFIG.volumetricScale);
    vol.setSun(this.sky.sunDir, new THREE.Color(...A.volumetricSunColor));
    if (this.scene.fog) vol.setFogColor((this.scene.fog as THREE.Fog).color);
    if (A.volumetric) vol.setMedium(A.volumetric);
    this.volumetrics = vol;
    // the colour chain, built by a factory: an Effect belongs to one EffectPass, so each chain gets its own instances
    // E189 (Jake's picks from the before / after boards, progress/282–283, 2026-09-26: "no regression"): Driftwood's phone
    // frame runs one FXAA pass on the graded frame instead of SMAA's three, and leaves out its faint (12 %) god rays. The
    // warm iPhone's grass frame was 48 ms with the post chain and 17 without; desktop keeps SMAA and the rays
    const dwPhone = level.style === 'toon' && TIER === 'phone';
    const aa = knobs.aa ?? (TIER_CONFIG.smaa === 'off' ? 'off' : dwPhone ? 'fxaa' : 'smaa');
    const fxaa = aa === 'fxaa' ? new FXAAEffect() : null;
    const raysOn = !dwPhone;
    const chain = (clean: boolean): EffectPass => {
      const godRays = new GodRaysEffect(this.camera, this.sky.sunDisc, {
        blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, density: 0.96, decay: 0.95, weight: 0.5,
        exposure: 0.4, samples: TIER_CONFIG.godRaysSamples, clampMax: 1.0, resolutionScale: TIER_CONFIG.godRaysScale,
      });
      if (knobs.skipRaysOffscreen ?? phonePictureCuts()) skipRaysOffscreen(godRays, this.camera, this.sky.sunDisc); // the disc off screen = no rays to draw (E142, E189)
      const bloom = new BloomEffect({ intensity: G.bloomIntensity, luminanceThreshold: G.bloomThreshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.6, levels: TIER_CONFIG.bloomLevels });
      const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
      const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
      const grade = new HueSaturationEffect({ saturation: G.saturation });
      const contrast = new BrightnessContrastEffect({ brightness: G.brightness, contrast: G.contrast });
      const split = new GradeEffect(G, look);
      if (!clean) this.grade = split;
      this.post = { grade: split, saturation: grade, contrast, bloom };
      if (!clean) {
        const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.35 });
        const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
        grain.blendMode.opacity.value = 0.12;
        this.sky.attachPost({ vol, rays: godRays, hueSat: grade }); // Pine Hollow's clock (PH-L2) turns the shafts, the rays and the saturation with the hour; a fixed sky ignores it
        // a PBR shard's learned LUT (lut.ts, per shard — PINE-HOLLOW PH-L4) ends its grade, before the grain; no file = no
        // LUT, the chain as before. The low-poly shard's `?post=cinematic` A/B stays the pre-LUT chain.
        const lut = this.sky.lut && getActiveChunk().style !== 'toon' ? new LUT3DEffect(this.sky.lut, { inputColorSpace: THREE.SRGBColorSpace, tetrahedralInterpolation: true }) : null;
        // one EffectPass for the whole chain: one program and one full-screen pass fewer per frame
        const order: Effect[] = lut ? [vol, godRays, bloom, chroma, vignette, tone, grade, contrast, split, lut, grain]
          : [vol, godRays, bloom, chroma, vignette, tone, grade, contrast, split, grain];
        return this.colourPass(composer, order, { ao: aoPass, vol, godRays, bloom, chroma, vignette, tone, saturation: grade, contrast, grade: split, lut, grain });
      }
      // the stylized look (DRIFTWOOD-REMASTER L5): no volumetric haze, grain or fringe washing the toon bands to low
      // contrast — the colour-ramp fog does the aerial perspective; the god rays stay faint, the vignette light
      godRays.blendMode.opacity.value = 0.12; // faint: looking into a midday sun must not wash the sand and lagoon to white
      bloom.luminanceMaterial.smoothing = 0.08; // bloom only what is really over 1.0 (the def's threshold): the sun, glints, glyphs, fireflies
      vignette.darkness = 0.35;
      // the learned LUT (X1, src/engine/world/lut.ts) is the last grade step: the palette fitted to the mockups. Always on — the
      // user locked it in (E85); only Debug ▸ Look ▸ Learned LUT Off (the fit's own captures) builds without it
      const lut = this.sky.lut ? new LUT3DEffect(this.sky.lut, { inputColorSpace: THREE.SRGBColorSpace, tetrahedralInterpolation: true }) : null;
      const order: Effect[] = [...(raysOn ? [godRays] : []), bloom, vignette, tone, grade, contrast, split, ...(lut ? [lut] : [])];
      return this.colourPass(composer, order, { ao: aoPass, vol, godRays, bloom, chroma: null, vignette, tone, saturation: grade, contrast, grade: split, lut, grain: null });
    };
    // the low-poly shard runs the clean L5 chain (E88, the user's Look Lab pick); every other shard keeps the original
    // haze + grain + fringe chain
    const colour = chain(getActiveChunk().style === 'toon');
    composer.addPass(colour);
    this.placeShardPasses(composer, colour); // a shard's own passes around the engine's (none without a render strategy)
    // FXAA reads its pass's input image, so it gets a pass of its own on the graded frame (EffectPass orders effects by kind)
    if (fxaa !== null) composer.addPass(new EffectPass(this.camera, fxaa));
    if (aa === 'smaa') {
      const smaa = new SMAAEffect({ preset: TIER_CONFIG.smaa === 'high' ? SMAAPreset.HIGH : SMAAPreset.LOW, edgeDetectionMode: EdgeDetectionMode.COLOR });
      composer.addPass(new EffectPass(this.camera, smaa));
    }
    // the depth slices: every depth reader reads the scene target's own depth texture (the world + the weapon, no copy)
    const sceneDepth = composer.inputBuffer.depthTexture;
    if (slices && sceneDepth !== null) for (const p of composer.passes) if (p !== this.renderPass) p.setDepthTexture(sceneDepth);
    this._composer = composer;
  }

  /**
   * Every frame, after the fixed steps. `label` names the system in error reports (default: the function's name); `core`
   * marks one the game cannot run without — if it keeps throwing the loop stops and the fatal modal goes up, where any
   * other system is just switched off (src/engine/core/faults.ts).
   */
  private register(phase: Phase, fn: (dt: number, t: number) => void, label?: string, core = false, scope = this.registrationScope): void {
    const id = label === 'main' ? 'main.frame' : label ?? `engine.core.callback.${String(this.anonymous++)}`;
    this.app.addSystem({ id, phase, run: fn, core }, scope);
    this.faultSystems.set(id, makeSystem(fn, id, core, id));
    scope.onDispose(() => { this.faultSystems.delete(id); });
  }
  onUpdate(fn: (dt: number, t: number) => void, label?: string, core = false): void { this.register('update', fn, label, core); }
  /** E357 F2: a temporary harness observer of simulation frames, removed when its walk finishes. */
  watchFrames(fn: (dt: number) => void): () => void {
    const scope = this.levelScope.child('observer');
    this.register('update', fn, 'harness.walk', false, scope);
    return () => { scope.dispose(); };
  }
  /** First in the frame: read controls into intents the fixed steps consume (the player's move, a queued jump). */
  onInput(fn: (dt: number) => void, label?: string, core = false): void { this.register('input', fn, label, core); }
  /** Once per fixed step (dt = FIXED_STEP), in phase order. */
  onFixed(phase: FixedPhase, fn: (dt: number) => void, label?: string, core = false): void { this.register(this.fixed[phase], fn, label, core); }
  /** After every updater: things that pose from this frame's final state (the camera from the interpolated player). */
  onLate(fn: (dt: number) => void, label?: string, core = false): void { this.register('late', fn, label, core); }

  /** a system threw (one try/catch per call, below): count it, report it; a core system that keeps failing stops the loop */
  private fault(s: GameSystem<unknown>, e: unknown): void {
    if (s.label !== 'engine.events') this.app.events.emit('fault', { source: s.label, message: e instanceof Error ? e.message : String(e), error: e });
    if (systemFault(s, e, this.frameNo, performance.now()) === 'fatal' && !this.dead) { this.dead = true; this.app.setState('error'); setLoopState('dead'); }
  }
  /** (a method, not the field: the loop's early-out narrows `this.dead` to false for the rest of the frame) */
  private isDead(): boolean { return this.dead; }
  /** one fixed phase, each system guarded */
  private runPhase(phase: Phase, dt = FIXED_STEP, t = this.clock.elapsedTime): void {
    if (this.app.state === 'paused') return;
    const on = frameCost.on; // the dev fps panel's timing rows (src/engine/core/frameCost.ts): one boolean read while it is closed
    for (const spec of this.app.systemsByPhase()[phase]) {
      if (!this.app.scheduler.runs(spec)) continue;
      if (spec.when && !spec.when(this.app)) continue;
      let s = this.faultSystems.get(spec.id);
      if (!s) { s = makeSystem(spec.run, spec.id, spec.core ?? false, spec.id); this.faultSystems.set(spec.id, s); }
      if (!s.on) continue;
      const t0 = on ? performance.now() : 0;
      try { spec.run(dt, t); } catch (e) { this.fault(s, e); }
      if (on) frameCost.system(s.label, performance.now() - t0);
    }
    this.flushEvents(phase);
  }
  private readonly eventSystem = makeSystem(null, 'engine.events', false, 'engine.events');
  private flushEvents(phase: Phase): void {
    try { this.app.events.flush(phase); } catch (error) { this.fault(this.eventSystem, error); }
  }

  /** Run the fixed steps this frame's (scaled) dt owes: hit-stop slows them with everything else. */
  private runFixed(dt: number): void {
    if ('app' in this && this.app.state === 'paused') { this.fixedSteps = 0; return; }
    this.fixedAcc += dt;
    let n = 0;
    while (this.fixedAcc >= FIXED_STEP && n < MAX_FIXED_STEPS) {
      this.runPhase(this.fixed.pre);
      this.runPhase(this.fixed.step);
      this.runPhase(this.fixed.post);
      this.fixedAcc -= FIXED_STEP; n++;
    }
    if (n === MAX_FIXED_STEPS && this.fixedAcc >= FIXED_STEP) this.fixedAcc %= FIXED_STEP;
    this.alpha = this.fixedAcc / FIXED_STEP;
    this.fixedSteps = n;
  }

  private stopLeft = 0;
  /**
   * Hit-stop (C2): for `seconds` of real time every updater gets `dt × HIT_STOP_SCALE` — the swing, the target, the
   * player hang on the contact frame — while `worldTime.realDt` (src/engine/core/time.ts) keeps the real step for what must keep
   * moving (particles, camera shake). Overlapping stops take the longer. The sky and the post chain always run real time.
   */
  hitStop(seconds: number): void { this.stopLeft = Math.max(this.stopLeft, seconds); }
  /** skip n8ao's depth-free transparency pre-pass (buildComposer; PH-P2) — a live switch for A/B captures */
  aoLeanTransparency = true;
  /** the PBR chain's split-tone / look grade (buildComposer; its uniforms are live — the look loop tunes them in place) */
  grade: GradeEffect | null = null;

  /**
   * Build every program the first frame would otherwise compile in one stall — the scene's
   * materials, the shadow-depth variants, the sky background and the post chain — with progress
   * (src/engine/boot/precompile.ts). Returns the distinct material count.
   */
  async precompile(onProgress?: (done: number, total: number, detail: string) => void): Promise<number> {
    const tracedBoot = bootTraceActive();
    if (tracedBoot) recordGpuCheckpoint(this.renderer, 'compile:before');
    // r186 removed PCFSoftShadowMap: the first shadow pass silently flips the type to PCF, and
    // shadowMapType is in every program's cache key — so everything compiled here would be
    // compiled AGAIN by the first frame (desktop 105 → 179 programs). Settle it before compiling.
    // oxlint-disable-next-line typescript/no-deprecated -- the guard exists to migrate away from the deprecated value
    if (this.renderer.shadowMap.type === THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // E153: island-wide casters draw into each shadow map in pieces, culled per cascade (shadowChunks.ts)
    const cut = chunkShadowCasters(this.scene);
    if (cut.meshes > 0) console.info(`[shadow] ${String(cut.meshes)} casters in ${String(cut.pieces)} pieces (${String(cut.tris)} tris)`);
    const rt = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const { jobs, materials } = sceneJobs(this.scene, rt);
    jobs.push(...shadowJobs(this.scene, rt));
    const bg = backgroundJob(this.scene, rt);
    if (bg) jobs.push(bg);
    jobs.push(...postJobs(this.composer, rt));
    if (PERFLOAD) perfLog('precompile:start', 0, this.renderer, `${materials} materials · ${jobs.length} jobs · parallel=${parallelCompile(this.renderer)}`);
    const report = await runPrecompile(this.renderer, this.camera, jobs, materials, onProgress);
    if (tracedBoot) recordGpuCheckpoint(this.renderer, 'compile:after');
    return report.materials;
  }

  /**
   * The first frames, as a step: a scene-only draw (shadow-depth programs + the GPU's first draw of
   * every pipeline), then the full composer (screen-quad shaders compileAsync cannot reach).
   */
  async firstFrame(onProgress?: (done: number, total: number, detail: string) => void): Promise<void> {
    const frame = (): Promise<void> => new Promise((resolve) => { requestAnimationFrame(() => { setTimeout(resolve, 0); }); }); // rAF alone resumes before the paint
    // Large instanced worlds may request culling before the first draw and fewer warm views.
    const tracedBoot = bootTraceActive();
    const checkpoint = (operation: string): void => { if (tracedBoot) recordGpuCheckpoint(this.renderer, operation); };
    const warmTurns = this.renderKnobs().warmTurns ?? WARM_TURNS;
    onProgress?.(0, warmTurns + 2, 'world + shadows');
    await frame();
    checkpoint('cull:before');
    if (this.level.boot.cullBeforeFirstDraw === true) this.lookStrategy?.frame?.(0.016, 0);
    checkpoint('cull:after');
    // into the composer's input buffer, not the canvas: the canvas target would be a second set of program variants
    const target = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const prev = this.renderer.getRenderTarget();
    let t0 = performance.now(); let before = PERFLOAD ? snapshotPrograms(this.renderer) : null;
    this.renderer.setRenderTarget(target);
    checkpoint('world:before');
    this.renderer.render(this.scene, this.camera);
    checkpoint('world:submitted');
    this.renderer.setRenderTarget(prev);
    if (before) perfLog('firstFrame:world', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | '));
    await frame();
    checkpoint('world:next-frame');
    // E153: the world once facing each way, so a turn finds every pipeline built (warmTurn)
    for (let k = 1; k <= warmTurns; k++) {
      onProgress?.(k, warmTurns + 2, `world, turned ${String(k * 360 / WARM_TURNS)}°`);
      t0 = performance.now(); before = PERFLOAD ? snapshotPrograms(this.renderer) : null;
      this.warmTurn(k, target);
      if (before) perfLog(`firstFrame:turn${String(k)}`, performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | '));
      await frame();
    }
    onProgress?.(warmTurns + 1, warmTurns + 2, 'post chain');
    t0 = performance.now(); before = PERFLOAD ? snapshotPrograms(this.renderer) : null;
    this.lookStrategy?.frame?.(0.016, 0);
    checkpoint('post:before');
    if (tracedBoot) traceBootPasses(this.composer.passes, checkpoint, () => { this.composer.render(0.016); });
    else this.composer.render(0.016);
    checkpoint('post:submitted');
    if (before) perfLog('firstFrame:post', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | '));
    await frame();
    checkpoint('post:next-frame');
    if (PERFLOAD) { t0 = performance.now(); before = snapshotPrograms(this.renderer); this.composer.render(0.016); perfLog('secondFrame', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | ')); console.info(`[perfload] programs:\n${dumpPrograms(this.renderer).join('\n')}`); }
  }

  /**
   * E153: one draw of the world turned `k` quarter-turns from where the player looks, through a 100° square view, with the
   * shadows placed for that view. The precompile links every program, but the GPU builds a program's pipeline for each
   * target, blend state and vertex layout only at its first draw (Metal: ANGLE's render-pipeline states, WebKit / iOS
   * build them on the draw). The boot's one frame drew only what faces the spawn, so turning around built the rest in
   * play — the waterfall behind the pier, a caster's depth variant in a cascade: 25–35 ms hitches on the M5 with a cold
   * shader cache, several times that on a phone. Four quarter-turns at 100° cover the circle.
   */
  private warmTurn(k: number, target: THREE.WebGLRenderTarget | null): void {
    const cam = this.camera, sky = this._sky, r = this.renderer;
    const q = cam.quaternion.clone(), fov = cam.fov, aspect = cam.aspect;
    const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    const prev = r.getRenderTarget();
    try {
      cam.fov = 100; cam.aspect = 1; cam.updateProjectionMatrix(); sky?.csm.updateFrustums();
      cam.quaternion.setFromEuler(new THREE.Euler(0, yaw + k * Math.PI * 2 / WARM_TURNS, 0, 'YXZ'));
      cam.updateMatrixWorld(true);
      sky?.warmShadows();
      r.setRenderTarget(target);
      r.render(this.scene, cam);
    } finally {
      r.setRenderTarget(prev);
      cam.quaternion.copy(q); cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      sky?.csm.updateFrustums();
      sky?.warmShadows();
    }
  }

  resize(): void {
    const w = window.innerWidth, h = viewportHeight();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this._composer?.setSize(w, h); // a resize can land before buildComposer() / buildSky()
    this._sky?.csm.updateFrustums();
  }

  start(): void {
    const composer = this.composer, sky = this.sky; // both built before start() (buildComposer reads the sky)
    this.clock.start();
    this.renderer.info.autoReset = false; // the composer renders several passes per frame: count the whole frame
    // Returning from the background: draw one frame at once (bypassing the gate). The 1–2 s of black on an
    // iOS app switch is iOS restoring a suspended standalone web app before any of this runs — investigated
    // and accepted (overlay / mirror / hidden canvas / wake lock / keep-alive audio made no difference).
    let forceFrame = false;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') forceFrame = true; });
    this.canvas.addEventListener('webglcontextlost', () => { this.gl.lostAt = performance.now(); this.gl.events++; console.warn('[gl] context lost'); });
    this.canvas.addEventListener('webglcontextrestored', () => { this.gl.restoredAt = performance.now(); console.warn('[gl] context restored after', Math.round(this.gl.restoredAt - this.gl.lostAt), 'ms'); });
    // (A timer-driven loop was tried for iOS Low Power Mode: timers are throttled to ~30 ms there too. rAF it is.)
    const schedule = (fn: () => void) => { requestAnimationFrame(fn); };
    // One chain only: every animation-frame callback of a frame gets the same timestamp, so a second chain (kickLoop
    // restarting a loop that was merely paused) finds its frame taken and ends there.
    let lastNow = -1, lastRun = performance.now();
    // The frame cap (tier.ts frameCapFps; E193: every shard at a locked 30 on mobile). The animation frame
    // still comes every vsync; a frame is drawn only once 1/cap has passed since the last one drawn, less a slack under
    // one vsync of the fastest display (4 ms < 8.3 ms at 120 Hz) to absorb timestamp jitter. So it draws every 2nd vsync
    // at 60 Hz, every 4th at 120 Hz, every one at 30 (iOS Low Power), and never two vsyncs running: no 30 ↔ 60 judder.
    // A skipped vsync does nothing at all — not even the clock — so the drawn frame's dt is the whole 33 ms, the fixed
    // steps catch up (2 × 1/60), and input read in that frame has everything since the last one.
    let lastDrawn = -Infinity;
    const loop = (now?: number) => {
      if (now !== undefined) { if (now === lastNow) return; lastNow = now; }
      if (this.dead) return; // a core system died (faults.ts): the fatal modal is up, nothing more to draw
      schedule(loop);
      lastRun = performance.now();
      const cap = frameCapFps();
      if (cap > 0 && !forceFrame) {
        const t = now ?? lastRun;
        if (t - lastDrawn < 1000 / cap - FRAME_CAP_SLACK_MS) return;
        lastDrawn = t;
      }
      if (this.hold) { this.clock.getDelta(); return; } // the context is lost / being rebuilt (GpuRecovery.ts): a draw now would re-link every program in one stall
      if (!forceFrame && !this.frameGate()) { this.clock.getDelta(); return; } // keep the clock moving so the next frame's dt is sane
      forceFrame = false;
      this.renderer.info.reset();
      const liveDt = Math.min(0.1, this.clock.getDelta());
      const realDt = this.app.clock.delta(liveDt);
      const t = this.app.clock.mode === 'capture' ? this.app.clock.real + realDt : this.clock.elapsedTime;
      // world time scale (hit-stop): updaters see the scaled step, realDt stays in worldTime for particles / camera
      let scale = 1;
      if (this.stopLeft > 0) { this.stopLeft -= realDt; scale = HIT_STOP_SCALE; }
      this.app.clock.timeScale = scale;
      this.app.clock.tick(liveDt);
      worldTime.scale = scale; worldTime.realDt = realDt;
      const dt = realDt * scale;
      this._frameTime += dt;
      this.frameNo++;
      this.app.events.beginFrame();
      // the dev fps panel's timing rows (src/engine/core/frameCost.ts): each system timed by its label only while the panel is open
      const on = frameCost.on;
      if (on) frameCost.begin();
      // each system in its own try/catch (faults.ts): one that throws is counted, reported and, if it keeps at it, switched off
      this.runPhase('input', dt, t);
      this.runFixed(dt);
      this.runPhase('update', dt, t);
      this.runPhase('late', dt, t);
      if (this.isDead()) return; // a core system died in this frame's steps
      const renderAt = performance.now();
      try {
        sky.update(realDt);
        // planet + sun disc travel with the camera so they stay "infinitely" far
        sky.clouds.position.copy(this.camera.position); sky.planet.position.copy(this.camera.position).addScaledVector(sky.planetDir, 1700); sky.sunDisc.position.copy(this.camera.position).addScaledVector(sky.sunDir, 1500);
        this.lookStrategy?.frame?.(realDt, t); // a shard's per-frame uniforms, with the camera final (ShardManifest.LookStrategy)
        cullPlaced(this.camera); // placed models' per-copy culling and LODs for this view (src/engine/models/place.ts; nothing when none cull)
        composer.render(realDt);
        if (exploreEntryPending() && !this.renderer.getContext().isContextLost()) recordExploreFrame();
      } catch (e) { this.fault(this.renderSystem, e); return; }
      this.flushEvents('render');
      if (this.captures.length > 0) this.flushCaptures();
      const done = performance.now(), work = done - lastRun;
      this.workMs[this.frameI] = work; this.frameCount++;
      this.updateMs[this.frameI] = renderAt - lastRun; this.renderMs[this.frameI] = done - renderAt;
      if (on) frameCost.end(realDt * 1000, renderAt - lastRun, done - renderAt, cap > 0 ? 1000 / cap : 0);
      this.lastFrame.calls = this.renderer.info.render.calls; this.lastFrame.triangles = this.renderer.info.render.triangles;
      this.frameMs[this.frameI] = realDt * 1000; this.frameI = (this.frameI + 1) % this.frameMs.length;
      this.stats.frames++; this.stats.acc += realDt;
      if (this.stats.acc >= 0.5) { this.stats.fps = Math.round(this.stats.frames / this.stats.acc); this.stats.frames = 0; this.stats.acc = 0; }
    };
    this.kickLoop = () => { if (!this.dead && performance.now() - lastRun > 1000) requestAnimationFrame(loop); };
    this.primeFrame = () => { if (!this.dead) forceFrame = true; };
    setLoopState('running');
    loop();
  }

  /** Stop the page engine and release its renderer and scopes. */
  dispose(): void {
    this.dead = true;
    this.levelScope.dispose();
    this.engineScope.dispose();
    this.scene.traverse((o) => { (o as Partial<THREE.Mesh>).geometry?.dispose(); });
    try { this._composer?.dispose(); } catch (e) { console.warn('[shard] the composer did not dispose', e); }
    try { this.lookStrategy?.dispose?.(); } catch (e) { console.warn('[shard] the render strategy did not dispose', e); }
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.scene.clear();
  }
}

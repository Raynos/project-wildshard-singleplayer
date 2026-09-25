import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode, BlendFunction, GodRaysEffect, LUT3DEffect, KernelSize, SMAAPreset, EdgeDetectionMode, ChromaticAberrationEffect, HueSaturationEffect, BrightnessContrastEffect, NoiseEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { installAtmosphere } from '../world/Atmosphere';
import { setAnisotropy } from './assets';
import { Sky } from '../world/Sky';
import { GradeEffect } from './Grade';
import { VolumetricsEffect, makeNoiseTexture } from './Volumetrics';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG, frameCapFps } from './tier';
import { PERFLOAD, snapshotPrograms, newProgramsSince, describeProgram, perfLog, dumpPrograms, parallelCompile } from '../boot/perflog';
import { sceneJobs, shadowJobs, backgroundJob, postJobs, runPrecompile } from '../boot/precompile';
import { worldTime } from './time';
import { setting, settingFromUrl } from '../ui/Settings';
import { GPU_MODE } from '../gpu/flag';
import type { GpuPath } from '../gpu/GpuPath';
import { installViewport, viewportHeight } from './viewport';
import { FIXED_STEP } from './fixedStep';
import { SHADOW_LAYER } from './shadowLayer';

/** the world's pace during a hit-stop (not 0: nothing downstream has to cope with a zero dt) */
const HIT_STOP_SCALE = 0.04;
/** the frame cap's tolerance for vsync timestamp jitter (see Game.start) */
const FRAME_CAP_SLACK_MS = 4;
const MAX_FIXED_STEPS = 3; // per frame; past it the backlog is dropped (a stall never replays as a burst)
/** the three slots of one fixed step, in order: `pre` readies the world, `step` advances it, `post` moves against it */
export type FixedPhase = 'pre' | 'step' | 'post';

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private _composer: EffectComposer | null = null;
  private _sky: Sky | null = null;
  /** ?gpu=webgpu (src/gpu/): the WebGPURenderer path draws the canvas; `renderer` is then an offscreen WebGL one for legacy callers */
  gpu: GpuPath | null = null;
  private gpuReady: Promise<GpuPath> | null = null;
  // oxlint-disable-next-line typescript/no-deprecated -- Clock→Timer changes getDelta semantics; migrate separately
  clock = new THREE.Clock();
  private updaters: ((dt: number, t: number) => void)[] = [];
  // Frame phases (PHYSICS P2 / ENGINE-FIT E2): input → fixed steps (pre → step → post, × 0‥3) → update (`onUpdate`) → late → render
  private inputs: ((dt: number) => void)[] = [];
  private fixed: Record<FixedPhase, ((dt: number) => void)[]> = { pre: [], step: [], post: [] };
  private lates: ((dt: number) => void)[] = [];
  private fixedAcc = 0;
  /** 0‥1: how far this frame's render sits past the last fixed step (interpolate anything the fixed step moves) */
  alpha = 0;
  /** fixed steps run this frame (0 during most of a hit-stop) */
  fixedSteps = 0;
  stats = { fps: 0, frames: 0, acc: 0 };
  /** last 120 frame times in ms (ring; `frameI` is the next slot) — the perf meter reads p50/p95 from it */
  frameMs = new Float32Array(120); frameI = 0;
  /** draw calls / triangles of the last whole frame (all composer passes) */
  lastFrame = { calls: 0, triangles: 0 };
  /** WebGL context loss bookkeeping (iOS drops the context in the background); the perf meter shows it */
  gl = { lostAt: 0, restoredAt: 0, events: 0 };
  /** Return false to skip a whole frame (updaters + render): a menu covering the canvas, a still title on a phone. */
  frameGate: () => boolean = () => true;
  /** GPU recovery (src/core/GpuRecovery.ts): true while the WebGL context is lost or being rebuilt — no tick, no draw, not even a forced frame */
  hold = false;
  /** Restart the frame loop if it has not run for a second (a browser that dropped its animation frame across an app switch). Set by start(). */
  kickLoop: () => void = () => undefined;
  private captures: { maxW: number; resolve: (c: HTMLCanvasElement) => void }[] = [];
  /** A copy of the next rendered frame, at most `maxW` px wide (the review inbox's screenshot, src/ui/Feedback.ts). The drawing
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
  snapshot(maxW: number): HTMLCanvasElement | null {
    if (this._composer === null || this.hold || this.renderer.getContext().isContextLost()) return null;
    this._composer.render(0);
    const src = this.canvas, k = Math.min(1, maxW / Math.max(1, src.width));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  private renderPass!: RenderPass;
  volumetrics!: VolumetricsEffect;
  /** the post chain — set by buildComposer(); resize() and the loop hold the nullable field directly */
  get composer(): EffectComposer { if (this._composer === null) throw new Error('Game.composer read before buildComposer()'); return this._composer; }
  /** the sky — set by buildSky() */
  get sky(): Sky { if (this._sky === null) throw new Error('Game.sky read before buildSky()'); return this._sky; }

  constructor(public canvas: HTMLCanvasElement) {
    installAtmosphere();
    installViewport(); // --ws-vh: the real height (an iOS home-screen app reports innerHeight a status bar short — viewport.ts)
    this.renderer = new THREE.WebGLRenderer({ canvas: GPU_MODE ? document.createElement('canvas') : canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_CONFIG.dpr));
    this.renderer.setSize(window.innerWidth, viewportHeight());
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composer
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoft: it renders PCF anyway, and the type is in every program's cache key
    setAnisotropy(this.renderer);
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
    const mode = GPU_MODE;
    if (mode) this.gpuReady = import('../gpu/GpuPath').then((m) => m.GpuPath.create(canvas, mode));
  }

  async buildSky(): Promise<Sky> {
    if (this.gpuReady) { this.gpu = await this.gpuReady; this.resize(); }
    this._sky = await new Sky(this.scene, this.camera, this.renderer).build();
    return this._sky;
  }

  buildComposer(): void {
    const { grade: G, atmosphere: A } = getActiveChunk();
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    if (TIER_CONFIG.ao) {
      const ao = new N8AOPostPass(this.scene, this.camera, window.innerWidth, viewportHeight());
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
    this.volumetrics = vol;
    // the colour chain, built by a factory: an Effect belongs to one EffectPass, so each chain gets its own instances
    const chain = (clean: boolean): EffectPass => {
      const godRays = new GodRaysEffect(this.camera, this.sky.sunDisc, {
        blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, density: 0.96, decay: 0.95, weight: 0.5,
        exposure: 0.4, samples: TIER_CONFIG.godRaysSamples, clampMax: 1.0, resolutionScale: TIER_CONFIG.godRaysScale,
      });
      const bloom = new BloomEffect({ intensity: G.bloomIntensity, luminanceThreshold: G.bloomThreshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.6, levels: TIER_CONFIG.bloomLevels });
      const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
      const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
      const grade = new HueSaturationEffect({ saturation: G.saturation });
      const contrast = new BrightnessContrastEffect({ brightness: G.brightness, contrast: G.contrast });
      const split = new GradeEffect(G);
      if (!clean) {
        const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.35 });
        const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
        grain.blendMode.opacity.value = 0.12;
        this.sky.attachPost({ vol, rays: godRays, hueSat: grade }); // Pine Hollow's clock (PH-L2) turns the shafts, the rays and the saturation with the hour; a fixed sky ignores it
        // a PBR shard's learned LUT (lut.ts, per shard — PINE-HOLLOW PH-L4) ends its grade, before the grain; no file = no
        // LUT, the chain as before. The low-poly shard's `?post=cinematic` A/B stays the pre-LUT chain.
        const lut = this.sky.lut && getActiveChunk().style !== 'lowpoly' ? new LUT3DEffect(this.sky.lut, { inputColorSpace: THREE.SRGBColorSpace, tetrahedralInterpolation: true }) : null;
        // one EffectPass for the whole chain: one program and one full-screen pass fewer per frame
        return lut ? new EffectPass(this.camera, vol, godRays, bloom, chroma, vignette, tone, grade, contrast, split, lut, grain)
          : new EffectPass(this.camera, vol, godRays, bloom, chroma, vignette, tone, grade, contrast, split, grain);
      }
      // the stylized look (DRIFTWOOD-REMASTER L5): no volumetric haze, grain or fringe washing the toon bands to low
      // contrast — the colour-ramp fog does the aerial perspective; the god rays stay faint, the vignette light
      godRays.blendMode.opacity.value = 0.12; // faint: looking into a midday sun must not wash the sand and lagoon to white
      bloom.luminanceMaterial.smoothing = 0.08; // bloom only what is really over 1.0 (the def's threshold): the sun, glints, glyphs, fireflies
      vignette.darkness = 0.35;
      // the learned LUT (X1, src/world/lut.ts) is the last grade step: the palette fitted to the mockups. Always on — the
      // user locked it in (E85); only `?nolut` (the fit's own captures) builds without it
      const lut = this.sky.lut ? new LUT3DEffect(this.sky.lut, { inputColorSpace: THREE.SRGBColorSpace, tetrahedralInterpolation: true }) : null;
      return lut ? new EffectPass(this.camera, godRays, bloom, vignette, tone, grade, contrast, split, lut) : new EffectPass(this.camera, godRays, bloom, vignette, tone, grade, contrast, split);
    };
    // the low-poly shard runs the clean L5 chain — locked in (E88, the user's Look Lab pick); only `?post=cinematic` builds
    // the original haze + grain + fringe chain there, which every other shard keeps
    composer.addPass(chain(getActiveChunk().style === 'lowpoly' && !(settingFromUrl('post') && setting('post') === 'cinematic')));
    if (TIER_CONFIG.smaa !== 'off') {
      const smaa = new SMAAEffect({ preset: TIER_CONFIG.smaa === 'high' ? SMAAPreset.HIGH : SMAAPreset.LOW, edgeDetectionMode: EdgeDetectionMode.COLOR });
      composer.addPass(new EffectPass(this.camera, smaa));
    }
    this._composer = composer;
    this.gpu?.build(this.scene, this.camera, this.sky, this.renderer);
  }

  onUpdate(fn: (dt: number, t: number) => void): void { this.updaters.push(fn); }
  /** First in the frame: read controls into intents the fixed steps consume (the player's move, a queued jump). */
  onInput(fn: (dt: number) => void): void { this.inputs.push(fn); }
  /** Once per fixed step (dt = FIXED_STEP), in phase order. */
  onFixed(phase: FixedPhase, fn: (dt: number) => void): void { this.fixed[phase].push(fn); }
  /** After every updater: things that pose from this frame's final state (the camera from the interpolated player). */
  onLate(fn: (dt: number) => void): void { this.lates.push(fn); }

  /** Run the fixed steps this frame's (scaled) dt owes: hit-stop slows them with everything else. */
  private runFixed(dt: number): void {
    this.fixedAcc += dt;
    let n = 0;
    while (this.fixedAcc >= FIXED_STEP && n < MAX_FIXED_STEPS) {
      for (const f of this.fixed.pre) f(FIXED_STEP);
      for (const f of this.fixed.step) f(FIXED_STEP);
      for (const f of this.fixed.post) f(FIXED_STEP);
      this.fixedAcc -= FIXED_STEP; n++;
    }
    if (n === MAX_FIXED_STEPS && this.fixedAcc >= FIXED_STEP) this.fixedAcc %= FIXED_STEP;
    this.alpha = this.fixedAcc / FIXED_STEP;
    this.fixedSteps = n;
  }

  private stopLeft = 0;
  /**
   * Hit-stop (C2): for `seconds` of real time every updater gets `dt × HIT_STOP_SCALE` — the swing, the target, the
   * player hang on the contact frame — while `worldTime.realDt` (src/core/time.ts) keeps the real step for what must keep
   * moving (particles, camera shake). Overlapping stops take the longer. The sky and the post chain always run real time.
   */
  hitStop(seconds: number): void { this.stopLeft = Math.max(this.stopLeft, seconds); }
  /** skip n8ao's depth-free transparency pre-pass (buildComposer; PH-P2) — a live switch for A/B captures */
  aoLeanTransparency = true;

  /**
   * Build every program the first frame would otherwise compile in one stall — the scene's
   * materials, the shadow-depth variants, the sky background and the post chain — with progress
   * (src/boot/precompile.ts). Returns the distinct material count.
   */
  async precompile(onProgress?: (done: number, total: number, detail: string) => void): Promise<number> {
    if (this.gpu) return this.gpu.precompile(onProgress);
    // r186 removed PCFSoftShadowMap: the first shadow pass silently flips the type to PCF, and
    // shadowMapType is in every program's cache key — so everything compiled here would be
    // compiled AGAIN by the first frame (desktop 105 → 179 programs). Settle it before compiling.
    // oxlint-disable-next-line typescript/no-deprecated -- the guard exists to migrate away from the deprecated value
    if (this.renderer.shadowMap.type === THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const rt = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const { jobs, materials } = sceneJobs(this.scene, rt);
    jobs.push(...shadowJobs(this.scene, rt));
    const bg = backgroundJob(this.scene, rt);
    if (bg) jobs.push(bg);
    if (!(PERFLOAD && new URLSearchParams(location.search).has('nopost'))) jobs.push(...postJobs(this.composer, rt)); // ?nopost=1: let the first frame show which post programs are real
    if (PERFLOAD) perfLog('precompile:start', 0, this.renderer, `${materials} materials · ${jobs.length} jobs · parallel=${parallelCompile(this.renderer)}`);
    const report = await runPrecompile(this.renderer, this.camera, jobs, materials, onProgress);
    return report.materials;
  }

  /**
   * The first frames, as a step: a scene-only draw (shadow-depth programs + the GPU's first draw of
   * every pipeline), then the full composer (screen-quad shaders compileAsync cannot reach).
   */
  async firstFrame(onProgress?: (done: number, total: number, detail: string) => void): Promise<void> {
    if (this.gpu) { await this.gpu.firstFrame(onProgress); return; }
    const frame = (): Promise<void> => new Promise((resolve) => { requestAnimationFrame(() => { setTimeout(resolve, 0); }); }); // rAF alone resumes before the paint
    onProgress?.(0, 2, 'world + shadows');
    await frame();
    // into the composer's input buffer, not the canvas: the canvas target would be a second set of program variants
    const target = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const prev = this.renderer.getRenderTarget();
    let t0 = performance.now(); let before = PERFLOAD ? snapshotPrograms(this.renderer) : null;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
    if (before) perfLog('firstFrame:world', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | '));
    await frame();
    onProgress?.(1, 2, 'post chain');
    t0 = performance.now(); before = PERFLOAD ? snapshotPrograms(this.renderer) : null;
    this.composer.render(0.016);
    if (before) perfLog('firstFrame:post', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | '));
    await frame();
    if (PERFLOAD) { t0 = performance.now(); before = snapshotPrograms(this.renderer); this.composer.render(0.016); perfLog('secondFrame', performance.now() - t0, this.renderer, newProgramsSince(this.renderer, before).map(describeProgram).join(' | ')); console.info(`[perfload] programs:\n${dumpPrograms(this.renderer).join('\n')}`); }
  }

  resize(): void {
    const w = window.innerWidth, h = viewportHeight();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this._composer?.setSize(w, h); // a resize can land before buildComposer() / buildSky()
    this.gpu?.resize(w, h);
    this._sky?.csm.updateFrustums();
  }

  start(): void {
    const composer = this.composer, sky = this.sky, gpu = this.gpu; // both built before start() (buildComposer reads the sky)
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
    // The frame cap (tier.ts frameCapFps; PINE-HOLLOW PH-P1: Pine Hollow's phone tier at a locked 30). The animation frame
    // still comes every vsync; a frame is drawn only once 1/cap has passed since the last one drawn, less a slack under
    // one vsync of the fastest display (4 ms < 8.3 ms at 120 Hz) to absorb timestamp jitter. So it draws every 2nd vsync
    // at 60 Hz, every 4th at 120 Hz, every one at 30 (iOS Low Power), and never two vsyncs running: no 30 ↔ 60 judder.
    // A skipped vsync does nothing at all — not even the clock — so the drawn frame's dt is the whole 33 ms, the fixed
    // steps catch up (2 × 1/60), and input read in that frame has everything since the last one.
    const slug = getActiveChunk().slug;
    let lastDrawn = -Infinity;
    const loop = (now?: number) => {
      if (now !== undefined) { if (now === lastNow) return; lastNow = now; }
      schedule(loop);
      lastRun = performance.now();
      const cap = frameCapFps(slug);
      if (cap > 0 && !forceFrame) {
        const t = now ?? lastRun;
        if (t - lastDrawn < 1000 / cap - FRAME_CAP_SLACK_MS) return;
        lastDrawn = t;
      }
      if (this.hold) { this.clock.getDelta(); return; } // the context is lost / being rebuilt (GpuRecovery.ts): a draw now would re-link every program in one stall
      if (!forceFrame && !this.frameGate()) { this.clock.getDelta(); return; } // keep the clock moving so the next frame's dt is sane
      forceFrame = false;
      this.renderer.info.reset();
      const realDt = Math.min(0.1, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      // world time scale (hit-stop): updaters see the scaled step, realDt stays in worldTime for particles / camera
      let scale = 1;
      if (this.stopLeft > 0) { this.stopLeft -= realDt; scale = HIT_STOP_SCALE; }
      worldTime.scale = scale; worldTime.realDt = realDt;
      const dt = realDt * scale;
      for (const u of this.inputs) u(dt);
      this.runFixed(dt);
      for (const u of this.updaters) u(dt, t);
      for (const u of this.lates) u(dt);
      sky.update(realDt);
      // planet + sun disc travel with the camera so they stay "infinitely" far
      sky.clouds.position.copy(this.camera.position); sky.planet.position.copy(this.camera.position).addScaledVector(sky.planetDir, 1700); sky.sunDisc.position.copy(this.camera.position).addScaledVector(sky.sunDir, 1500);
      if (gpu) gpu.render(); else composer.render(realDt);
      if (this.captures.length > 0) this.flushCaptures();
      if (gpu) { this.lastFrame.calls = gpu.info.calls; this.lastFrame.triangles = gpu.info.triangles; }
      else { this.lastFrame.calls = this.renderer.info.render.calls; this.lastFrame.triangles = this.renderer.info.render.triangles; }
      this.frameMs[this.frameI] = realDt * 1000; this.frameI = (this.frameI + 1) % this.frameMs.length;
      this.stats.frames++; this.stats.acc += realDt;
      if (this.stats.acc >= 0.5) { this.stats.fps = Math.round(this.stats.frames / this.stats.acc); this.stats.frames = 0; this.stats.acc = 0; }
    };
    this.kickLoop = () => { if (performance.now() - lastRun > 1000) requestAnimationFrame(loop); };
    loop();
  }
}

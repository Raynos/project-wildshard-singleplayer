import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode, BlendFunction, GodRaysEffect, KernelSize, SMAAPreset, EdgeDetectionMode, ChromaticAberrationEffect, HueSaturationEffect, BrightnessContrastEffect, NoiseEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { installAtmosphere } from '../world/Atmosphere';
import { setAnisotropy } from './assets';
import { Sky } from '../world/Sky';
import { GradeEffect } from './Grade';
import { VolumetricsEffect, makeNoiseTexture } from './Volumetrics';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from './tier';
import { PERFLOAD, snapshotPrograms, newProgramsSince, describeProgram, perfLog, dumpPrograms, parallelCompile } from '../boot/perflog';
import { sceneJobs, shadowJobs, backgroundJob, postJobs, runPrecompile } from '../boot/precompile';

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private _composer: EffectComposer | null = null;
  private _sky: Sky | null = null;
  // oxlint-disable-next-line typescript/no-deprecated -- Clock→Timer changes getDelta semantics; migrate separately
  clock = new THREE.Clock();
  private updaters: ((dt: number, t: number) => void)[] = [];
  stats = { fps: 0, frames: 0, acc: 0 };
  /** last 120 frame times in ms (ring; `frameI` is the next slot) — the perf meter reads p50/p95 from it */
  frameMs = new Float32Array(120); frameI = 0;
  /** draw calls / triangles of the last whole frame (all composer passes) */
  lastFrame = { calls: 0, triangles: 0 };
  /** WebGL context loss bookkeeping (iOS drops the context in the background); the perf meter shows it */
  gl = { lostAt: 0, restoredAt: 0, events: 0 };
  /** Return false to skip a whole frame (updaters + render): a menu covering the canvas, a still title on a phone. */
  frameGate: () => boolean = () => true;
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
  private renderPass!: RenderPass;
  volumetrics!: VolumetricsEffect;
  /** runtime handles on the colour chain (set by buildComposer) — the day/night clock + weather retune them (src/world/DayNight.ts) */
  post: { grade: GradeEffect; saturation: HueSaturationEffect; contrast: BrightnessContrastEffect; bloom: BloomEffect } | null = null;
  /** the post chain — set by buildComposer(); resize() and the loop hold the nullable field directly */
  get composer(): EffectComposer { if (this._composer === null) throw new Error('Game.composer read before buildComposer()'); return this._composer; }
  /** the sky — set by buildSky() */
  get sky(): Sky { if (this._sky === null) throw new Error('Game.sky read before buildSky()'); return this._sky; }

  constructor(public canvas: HTMLCanvasElement) {
    installAtmosphere();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_CONFIG.dpr));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composer
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoft: it renders PCF anyway, and the type is in every program's cache key
    setAnisotropy(this.renderer);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 2600);
    window.addEventListener('resize', () => this.resize());
  }

  async buildSky(): Promise<Sky> {
    this._sky = await new Sky(this.scene, this.camera, this.renderer).build();
    return this._sky;
  }

  buildComposer(): void {
    const { grade: G, atmosphere: A } = getActiveChunk();
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    if (TIER_CONFIG.ao) {
      const ao = new N8AOPostPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
      ao.configuration.aoRadius = 2.5;
      ao.configuration.distanceFalloff = 1.0;
      ao.configuration.intensity = 2.5;
      ao.configuration.halfRes = true;
      ao.configuration.screenSpaceRadius = false;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color(0.05, 0.06, 0.05);
      composer.addPass(ao);
    }

    const vol = new VolumetricsEffect(this.camera, makeNoiseTexture(), TIER_CONFIG.volumetricSteps, TIER_CONFIG.volumetricScale);
    vol.setSun(this.sky.sunDir, new THREE.Color(...A.volumetricSunColor));
    if (this.scene.fog) vol.setFogColor((this.scene.fog as THREE.Fog).color);
    if (A.volumetric) vol.setMedium(A.volumetric);
    this.volumetrics = vol;
    const godRays = new GodRaysEffect(this.camera, this.sky.sunDisc, {
      blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, density: 0.96, decay: 0.95, weight: 0.5,
      exposure: 0.4, samples: TIER_CONFIG.godRaysSamples, clampMax: 1.0, resolutionScale: TIER_CONFIG.godRaysScale,
    });
    const bloom = new BloomEffect({ intensity: G.bloomIntensity, luminanceThreshold: G.bloomThreshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.6, levels: TIER_CONFIG.bloomLevels });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.35 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const grade = new HueSaturationEffect({ saturation: G.saturation });
    const contrast = new BrightnessContrastEffect({ brightness: G.brightness, contrast: G.contrast });
    const split = new GradeEffect(G);
    this.post = { grade: split, saturation: grade, contrast, bloom };
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = 0.12;
    // one EffectPass for the whole chain: one program and one full-screen pass fewer per frame
    composer.addPass(new EffectPass(this.camera, vol, godRays, bloom, chroma, vignette, tone, grade, contrast, split, grain));
    if (TIER_CONFIG.smaa !== 'off') {
      const smaa = new SMAAEffect({ preset: TIER_CONFIG.smaa === 'high' ? SMAAPreset.HIGH : SMAAPreset.LOW, edgeDetectionMode: EdgeDetectionMode.COLOR });
      composer.addPass(new EffectPass(this.camera, smaa));
    }
    this._composer = composer;
  }

  onUpdate(fn: (dt: number, t: number) => void): void { this.updaters.push(fn); }

  /**
   * Build every program the first frame would otherwise compile in one stall — the scene's
   * materials, the shadow-depth variants, the sky background and the post chain — with progress
   * (src/boot/precompile.ts). Returns the distinct material count.
   */
  async precompile(onProgress?: (done: number, total: number, detail: string) => void): Promise<number> {
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
    const w = window.innerWidth, h = window.innerHeight;
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
    const loop = () => {
      schedule(loop);
      if (!forceFrame && !this.frameGate()) { this.clock.getDelta(); return; } // keep the clock moving so the next frame's dt is sane
      forceFrame = false;
      this.renderer.info.reset();
      const dt = Math.min(0.1, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, t);
      sky.update(dt);
      // planet + sun disc travel with the camera so they stay "infinitely" far
      sky.clouds.position.copy(this.camera.position); sky.planet.position.copy(this.camera.position).addScaledVector(sky.planetDir, 1700); sky.sunDisc.position.copy(this.camera.position).addScaledVector(sky.sunDir, 1500);
      composer.render(dt);
      if (this.captures.length > 0) this.flushCaptures();
      this.lastFrame.calls = this.renderer.info.render.calls; this.lastFrame.triangles = this.renderer.info.render.triangles;
      this.frameMs[this.frameI] = dt * 1000; this.frameI = (this.frameI + 1) % this.frameMs.length;
      this.stats.frames++; this.stats.acc += dt;
      if (this.stats.acc >= 0.5) { this.stats.fps = Math.round(this.stats.frames / this.stats.acc); this.stats.frames = 0; this.stats.acc = 0; }
    };
    loop();
  }
}

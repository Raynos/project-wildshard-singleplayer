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

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  sky!: Sky;
  clock = new THREE.Clock();
  private updaters: ((dt: number, t: number) => void)[] = [];
  stats = { fps: 0, frames: 0, acc: 0 };
  /** last 120 frame times in ms (ring; `frameI` is the next slot) — the perf meter reads p50/p95 from it */
  frameMs = new Float32Array(120); frameI = 0;
  /** draw calls / triangles of the last whole frame (all composer passes) */
  lastFrame = { calls: 0, triangles: 0 };
  /** Return false to skip a whole frame (updaters + render): a menu covering the canvas, a still title on a phone. */
  frameGate: () => boolean = () => true;
  private renderPass!: RenderPass;
  volumetrics!: VolumetricsEffect;

  constructor(public canvas: HTMLCanvasElement) {
    installAtmosphere();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_CONFIG.dpr));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the composer
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setAnisotropy(this.renderer);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 2600);
    window.addEventListener('resize', () => this.resize());
  }

  async buildSky() {
    this.sky = await new Sky(this.scene, this.camera, this.renderer).build();
    return this.sky;
  }

  buildComposer() {
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

    const vol = new VolumetricsEffect(this.camera, makeNoiseTexture());
    vol.setSun(this.sky.sunDir, new THREE.Color(...A.volumetricSunColor));
    if (this.scene.fog) vol.setFogColor((this.scene.fog as THREE.Fog).color);
    this.volumetrics = vol;
    const godRays = new GodRaysEffect(this.camera, this.sky.sunDisc, {
      blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, density: 0.96, decay: 0.95, weight: 0.5,
      exposure: 0.4, samples: 60, clampMax: 1.0, resolutionScale: 0.5,
    });
    const bloom = new BloomEffect({ intensity: G.bloomIntensity, luminanceThreshold: G.bloomThreshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.6 });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.35 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const grade = new HueSaturationEffect({ saturation: G.saturation });
    const contrast = new BrightnessContrastEffect({ brightness: G.brightness, contrast: G.contrast });
    const split = new GradeEffect(G);
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = 0.12;
    composer.addPass(new EffectPass(this.camera, vol));
    composer.addPass(new EffectPass(this.camera, godRays, bloom, chroma, vignette, tone, grade, contrast, split, grain));
    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH, edgeDetectionMode: EdgeDetectionMode.COLOR });
    composer.addPass(new EffectPass(this.camera, smaa));
    this.composer = composer;
  }

  onUpdate(fn: (dt: number, t: number) => void) { this.updaters.push(fn); }

  /**
   * Compile every material in the scene in batches of two, reporting progress, instead of letting
   * the first render() build ~100 programs in one synchronous stall (minutes on iOS). Ported from
   * trials-gauntlet-demo `compileMaterials`: detached non-recursive clones restrict each batch
   * without touching live visibility, compiled against the composer's scene target (program
   * variants depend on the output colour space / tone mapping of the target they render to).
   * Returns the distinct material count.
   */
  async precompile(onProgress?: (done: number, total: number) => void): Promise<number> {
    const mats: THREE.Material[] = [];
    const seen = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) if (!seen.has(mat)) { seen.add(mat); mats.push(mat); }
    });
    const r = this.renderer;
    const target = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const chunk = 2;
    for (let i = 0; i < mats.length; i += chunk) {
      const keep = new Set(mats.slice(i, i + chunk));
      const batch = new THREE.Group();
      this.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const material = mesh.material;
        if (!material) return;
        const selected = (Array.isArray(material) ? material : [material]).filter((m) => keep.has(m));
        if (!selected.length) return;
        const copy = mesh.clone(false);
        copy.material = Array.isArray(material) ? selected : selected[0]!;
        batch.add(copy);
      });
      const prev = r.getRenderTarget();
      let pending: Promise<unknown>;
      try { r.setRenderTarget(target); pending = r.compileAsync(batch, this.camera, this.scene); } finally { r.setRenderTarget(prev); }
      await pending;
      onProgress?.(Math.min(mats.length, i + chunk), mats.length);
      await new Promise((res) => requestAnimationFrame(() => res(undefined)));
    }
    return mats.length;
  }

  /**
   * The first frames, as a step: a scene-only draw (shadow-depth programs + the GPU's first draw of
   * every pipeline), then the full composer (screen-quad shaders compileAsync cannot reach).
   */
  async firstFrame(onProgress?: (done: number, total: number, detail: string) => void) {
    const frame = () => new Promise((res) => requestAnimationFrame(() => res(undefined)));
    onProgress?.(0, 2, 'world + shadows');
    // into the composer's input buffer, not the canvas: the canvas target would be a second set of program variants
    const target = (this.composer as unknown as { inputBuffer?: THREE.WebGLRenderTarget }).inputBuffer ?? null;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
    await frame();
    onProgress?.(1, 2, 'post chain');
    this.composer.render(0.016);
    await frame();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.sky?.csm?.updateFrustums();
  }

  start() {
    this.clock.start();
    this.renderer.info.autoReset = false; // the composer renders several passes per frame: count the whole frame
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.frameGate()) { this.clock.getDelta(); return; } // keep the clock moving so the next frame's dt is sane
      this.renderer.info.reset();
      const dt = Math.min(0.1, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, t);
      this.sky?.update(dt);
      // planet + sun disc travel with the camera so they stay "infinitely" far
      if (this.sky) { this.sky.clouds.position.copy(this.camera.position); this.sky.planet.position.copy(this.camera.position).addScaledVector(this.sky.planetDir, 1700); this.sky.sunDisc.position.copy(this.camera.position).addScaledVector(this.sky.sunDir, 1500); }
      this.composer.render(dt);
      this.lastFrame.calls = this.renderer.info.render.calls; this.lastFrame.triangles = this.renderer.info.render.triangles;
      this.frameMs[this.frameI] = dt * 1000; this.frameI = (this.frameI + 1) % this.frameMs.length;
      this.stats.frames++; this.stats.acc += dt;
      if (this.stats.acc >= 0.5) { this.stats.fps = Math.round(this.stats.frames / this.stats.acc); this.stats.frames = 0; this.stats.acc = 0; }
    };
    loop();
  }
}

/**
 * The WebGPU renderer path (`?gpu=webgpu`, src/gpu/flag.ts) — WebGPURenderer + TSL node materials + a TSL post chain,
 * running the real game. Driftwood Isle first; the WebGL path stays the default and is untouched.
 *
 *   const gpu = await GpuPath.create(canvas, mode);  // Game's constructor starts it, Game.buildSky() awaits it
 *   gpu.build(scene, camera, sky, gl);                 // Game.buildComposer(): library, fog, shadows, environment, post
 *   await gpu.precompile(onProgress);                // Game.precompile(): every pipeline before the first frame
 *   gpu.render();                                    // Game's loop, instead of composer.render()
 *   gpu.resize(w, h); gpu.info                       // calls / triangles of the last frame (+ GPU ms with timestamps)
 *
 * How it runs the game without touching the game's modules:
 * - Game keeps an OFFSCREEN WebGLRenderer as `game.renderer`, so every legacy caller (Sky's PMREM, TreeFactory,
 *   the weapons' `update(dt, renderer, camera)`, setAnisotropy) keeps working; nothing ever renders to it per frame.
 * - The visible canvas belongs to the WebGPURenderer. Its NodeLibrary (GpuLibrary below) turns each WebGL material
 *   into a node material when a pipeline is built: MeshStandard / MeshPhysical → the toon lighting model (toon.ts);
 *   materials with a GLSL patch or a ShaderMaterial → a TSL port from src/gpu/ (by identity or by their
 *   customProgramCacheKey); anything without a port draws nothing and is logged once (`gpu.skipped`).
 * - The shared `{ value }` uniforms (toonUniforms, fogUniforms, each module's own) are read every render (bridge.ts).
 */
import * as THREE from 'three';
import {
  NodeMaterial, MeshBasicNodeMaterial, PMREMGenerator, StandardNodeLibrary, TimestampQuery, WebGPURenderer, type RenderPipeline,
} from 'three/webgpu';
import { bool } from 'three/tsl';
import { CSMShadowNode } from 'three/examples/jsm/csm/CSMShadowNode.js';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from '../core/tier';
import type { Sky } from '../world/Sky';
import type { GpuMode } from './flag';
import { installToonLibrary, setToonSun } from './toon';
import { shardFog } from './fog';
import { cumulusMaterial, giantBodyMaterial, giantRingMaterial, skyDomeMaterial } from './sky';
import { buildPost } from './post';
import { portByKey, setLegacyRenderer, type Port } from './ports';
import { installPorts } from './materials';
import { registerOcean } from './ocean';
import { fixScene } from './compat';
import { isTwinnedPointsMaterial, shaderPortFor, syncTwins, twinPoints } from './effects';

/** ?gpudbg=noshadow,notoon — A/B switches for chasing a WebGL ↔ WebGPU difference */
const DBG = new Set((new URLSearchParams(location.search).get('gpudbg') ?? '').split(','));

/** the library: WebGL material → node material, with the src/gpu ports first */
class GpuLibrary extends StandardNodeLibrary {
  /** ports by material identity (the sky's ShaderMaterials) */
  readonly byIdentity = new WeakMap<THREE.Material, Port>();
  /** built ports, one per WebGL material */
  private built = new WeakMap<THREE.Material, NodeMaterial>();
  readonly skipped = new Map<string, number>();

  override fromMaterial(material: THREE.Material): NodeMaterial {
    if (material instanceof NodeMaterial) return material;
    const hit = this.built.get(material);
    if (hit) return hit;
    const base = (): NodeMaterial => this.baseFor(material);
    const key = programKey(material);
    const port = this.byIdentity.get(material) ?? portByKey(key);
    if (port) { const m = port(material, base); this.built.set(material, m); return m; }
    const shader = shaderPortFor(material);
    if (shader) { const m = shader(); this.built.set(material, m); return m; }
    if (isTwinnedPointsMaterial(material)) return this.masked(); // drawn by its sprite twin (effects.ts)
    return base();
  }

  /** three's own conversion (the toon classes for Standard / Physical), or a draw-nothing material when there is none */
  private baseFor(material: THREE.Material): NodeMaterial {
    if (this.getMaterialNodeClass(material.type) !== null) return super.fromMaterial(material);
    const tag = `${material.type}:${programKey(material)}${material instanceof THREE.ShaderMaterial ? ` «${material.fragmentShader.replaceAll(/\s+/g, ' ').slice(0, 90)}»` : ''}`;
    const n = this.skipped.get(tag) ?? 0;
    if (n === 0) console.warn(`[gpu] no TSL port for ${tag} — not drawn`);
    this.skipped.set(tag, n + 1);
    return this.masked();
  }

  private masked(): NodeMaterial {
    const skip = new MeshBasicNodeMaterial();
    skip.maskNode = bool(false);
    return skip;
  }
}

/** an object's single material, typed (unknown when there is none) */
function materialOf(o: THREE.Object3D): unknown { return o instanceof THREE.Mesh ? (o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material : null; }

/** a material's own program key (Sky.setupMaterial appends '|csm'); '' for the default key (the onBeforeCompile source) */
function programKey(m: THREE.Material): string {
  if (!Object.hasOwn(m, 'customProgramCacheKey') && !Object.hasOwn(Object.getPrototypeOf(m) as object, 'customProgramCacheKey')) return '';
  const k = m.customProgramCacheKey();
  return k.includes('{') ? '' : (k.split('|')[0] ?? '');
}

export class GpuPath {
  readonly renderer: WebGPURenderer;
  private library = new GpuLibrary();
  private post: { pipeline: RenderPipeline } | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  readonly timestamps: boolean;
  /** the last frame: draw calls, triangles, GPU ms (0 when the adapter has no timestamp queries) */
  readonly info = { calls: 0, triangles: 0, gpuMs: 0, backend: '' };
  get skipped(): ReadonlyMap<string, number> { return this.library.skipped; }

  private constructor(canvas: HTMLCanvasElement, mode: GpuMode, timestamps: boolean) {
    this.timestamps = timestamps;
    this.renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: mode === 'webgpu-gl', powerPreference: 'high-performance', trackTimestamp: timestamps });
    this.renderer.library = this.library;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_CONFIG.dpr));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight); // Game.resize() sets the real size
    this.renderer.toneMapping = THREE.NoToneMapping; // AgX runs in the post chain (post.ts)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !DBG.has('noshadow');
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
  }

  static async create(canvas: HTMLCanvasElement, mode: GpuMode): Promise<GpuPath> {
    let timestamps = false;
    if (mode === 'webgpu' && 'gpu' in navigator) {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      timestamps = adapter?.features.has('timestamp-query') === true;
    }
    const gpu = new GpuPath(canvas, mode, timestamps);
    await gpu.renderer.init();
    const backend = gpu.renderer.backend as { isWebGPUBackend?: boolean };
    gpu.info.backend = backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
    console.info(`[gpu] WebGPURenderer ready · backend ${gpu.info.backend} · timestamps ${timestamps}`);
    return gpu;
  }

  /** everything that needs the sky: the toon sun, the CSM shadow node, fog, the environment, the sky ports, the post chain */
  build(scene: THREE.Scene, camera: THREE.PerspectiveCamera, sky: Sky, legacy: THREE.WebGLRenderer): void {
    this.scene = scene; this.camera = camera;
    setLegacyRenderer(legacy);
    installPorts();
    registerOcean();
    const stylized = getActiveChunk().style === 'lowpoly';
    if (stylized && !DBG.has('notoon')) installToonLibrary(this.library);

    // the sun: the WebGL CSM's first light carries a CSMShadowNode (one shadow node, N cascades); its other lights
    // are the WebGL path's per-cascade copies and must not light the scene a second time
    const [sun, ...rest] = sky.csm.lights;
    if (!sun) throw new Error('[gpu] the sky has no sun light');
    setToonSun(sun);
    for (const l of rest) { l.visible = false; l.castShadow = false; }
    const csm = new CSMShadowNode(sun, { cascades: TIER_CONFIG.cascades, maxFar: TIER_CONFIG.shadowFar, mode: 'practical', lightMargin: TIER_CONFIG.shadowMargin });
    csm.fade = true;
    sun.shadow.shadowNode = csm;

    if (scene.fog) scene.fogNode = shardFog(scene.fog, stylized);

    // the sky's ShaderMaterials, by identity
    const st = sky.stylized;
    if (st) {
      this.portShader(materialOf(st.dome), skyDomeMaterial);
      this.portShader(materialOf(st.clouds), cumulusMaterial);
      st.envScene.traverse((o) => { this.portShader(materialOf(o), skyDomeMaterial); });
      // the environment: the dome through the WebGPU PMREM (replaces Sky.refreshEnvironment's WebGL one; DayNight calls it)
      sky.refreshEnvironment = () => { this.refreshEnvironment(st.envScene); };
      this.refreshEnvironment(st.envScene);
    }
    const [body, ring] = sky.planet.children;
    if (body) this.portShader(materialOf(body), giantBodyMaterial);
    if (ring) this.portShader(materialOf(ring), giantRingMaterial);

    const lut: unknown = Reflect.get(sky, 'lut'); // (Sky.lut: the look-agent's learned LUT, X1 — absent on older trees)
    this.post = buildPost(this.renderer, scene, camera, { sunDisc: sky.sunDisc, lut: lut instanceof THREE.Data3DTexture ? lut : null });
  }

  private portShader(mat: unknown, fn: (m: THREE.ShaderMaterial) => NodeMaterial): void {
    if (mat instanceof THREE.ShaderMaterial) this.library.byIdentity.set(mat, (src) => fn(src as THREE.ShaderMaterial));
  }

  private pmrem: PMREMGenerator | null = null;
  private envRT: THREE.RenderTarget | null = null;
  private refreshEnvironment(envScene: THREE.Scene): void {
    if (!this.scene) return;
    this.pmrem ??= new PMREMGenerator(this.renderer);
    const rt = this.pmrem.fromScene(envScene, 0, 1, 3000, { size: 64 });
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  /** compile every pipeline the first frame needs (scene + post) */
  async precompile(onProgress?: (done: number, total: number, detail: string) => void): Promise<number> {
    const { scene, camera } = this;
    if (!scene || !camera) return 0;
    fixScene(scene, this.info.backend === 'webgpu'); twinPoints(scene);
    onProgress?.(0, 1, 'webgpu pipelines');
    const t0 = performance.now();
    await this.renderer.compileAsync(scene, camera);
    console.info(`[gpu] compileAsync ${Math.round(performance.now() - t0)} ms`);
    onProgress?.(1, 1, 'webgpu pipelines');
    return 0;
  }

  async firstFrame(onProgress?: (done: number, total: number, detail: string) => void): Promise<void> {
    onProgress?.(0, 1, 'first frame');
    const t0 = performance.now();
    this.render();
    await new Promise<void>((resolve) => { requestAnimationFrame(() => { resolve(); }); });
    console.info(`[gpu] first frame ${Math.round(performance.now() - t0)} ms`);
    onProgress?.(1, 1, 'first frame');
  }

  private pendingTimestamp = false;
  private frame = 0;
  render(): void {
    if (!this.post || !this.scene) return;
    if (this.frame++ % 120 === 0) { fixScene(this.scene, this.info.backend === 'webgpu'); twinPoints(this.scene); }
    syncTwins();
    this.renderer.info.reset();
    this.post.pipeline.render();
    const r = this.renderer.info.render;
    this.info.calls = r.drawCalls; this.info.triangles = r.triangles;
    if (this.timestamps && !this.pendingTimestamp) {
      this.pendingTimestamp = true;
      void this.resolveGpuMs();
    }
  }

  private async resolveGpuMs(): Promise<void> {
    try { this.info.gpuMs = (await this.renderer.resolveTimestampsAsync(TimestampQuery.RENDER)) ?? 0; } catch { this.info.gpuMs = 0; }
    this.pendingTimestamp = false;
  }

  resize(w: number, h: number): void { this.renderer.setSize(w, h); }
}

// Nine Dragon Stack look lab P2 "neon" (E169): the LIGHT of 界画霓虹 Jiehua Neon on a short wet plaza street —
// SDF neon calligraphy, the 晕染 bleed bloom, three wet-ground streak methods, lanterns, amber windows, drizzle.
// dev/nd-lab-neon.html. Driven by captures through window.__lab (no URL switches): ready, set(patch), shot(name),
// time(t), pixelRatio(r), bench(n), stats(), overdraw(), snapshot(w, h, q).
import { Mesh, type Object3D, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderTarget, WebGLRenderer, Vector3 } from 'three';
import { BleedPipeline, type BleedLook } from './bleed';
import { GlyphAtlas } from './glyphs';
import { GATE_Z, buildScene } from './scene';
import { LabShared } from './shared';
import { DEFAULT_LOOK, type SignLook } from './signs';
import { DEFAULT_GROUND, type GroundLook, type StreakMode } from './wetground';

interface Shot { eye: readonly [number, number, number]; look: readonly [number, number, number]; vfov: number }
const SHOTS: Readonly<Record<string, Shot>> = {
  spawn: { eye: [0.6, 1.7, 3], look: [-0.1, 2.6, GATE_Z], vfov: 72 },
  low: { eye: [0.4, 1.35, 1], look: [0, 2.2, GATE_Z], vfov: 70 },
  signs: { eye: [0.3, 1.7, 1], look: [-3.2, 6.5, -14], vfov: 62 },
  ground: { eye: [0.5, 1.7, 2], look: [0, -0.6, -12], vfov: 74 },
  lantern: { eye: [0.2, 2.2, -4.5], look: [0.6, 5.2, -10], vfov: 46 },
};

interface LabPatch {
  streak?: StreakMode;
  spill?: boolean;
  sign?: Partial<SignLook>;
  ground?: Partial<GroundLook>;
  bleed?: Partial<BleedLook>;
  hide?: string[];
}
interface LabStats { calls: number; triangles: number; width: number; height: number; pixelRatio: number; atlasMs: number; emitters: number }
interface LabApi {
  ready: Promise<void>;
  set: (p: LabPatch) => void;
  shot: (name: string) => Promise<void>;
  time: (t: number | null) => void;
  pixelRatio: (r: number | null) => void;
  bench: (frames: number) => Promise<number>;
  stats: () => LabStats;
  snapshot: (w: number, h: number, quality: number) => string;
  shots: () => string[];
  nanScan: () => number;
  overdraw: () => { mean: number; max: number; covered: number; maxX: number; maxY: number; over8: number };
  /** ms of one extra run of a pass (the slope of k repeats vs 1), GPU-synced: 'bloom' | 'composite' | 'cards' | 'tubes' | 'lanterns' | 'mirror' | 'world' */
  probe: (pass: string, k: number) => Promise<number>;
  /** build a throwaway atlas for `chars` (load-time cost of a bigger word list) */
  atlasTest: (chars: string) => { ms: number; size: number; glyphs: number };
}
declare global { interface Window { __lab?: LabApi } }

const SIGN_CHARS = '九龍牙科旅館火鍋茶麻雀當舖藥房樓麵';

async function loadFonts(): Promise<void> {
  const all = document.fonts.load('700 64px "LXGW WenKai TC"', SIGN_CHARS);
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 9000); })]);
}

const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
  let k = 0;
  const step = (): void => { if (++k >= n) resolve(); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

async function main(): Promise<void> {
  const canvas = document.getElementById('lab-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('nd-lab-neon: no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  await loadFonts();
  const shared = new LabShared();
  const atlas = new GlyphAtlas(Array.from(SIGN_CHARS));
  const lab = buildScene(shared, atlas);
  const scene = new Scene();
  for (const o of lab.objects) scene.add(o);
  const camera = new PerspectiveCamera(74, 1, 0.1, 600);
  const pipe = new BleedPipeline(renderer, shared);
  let signLook: SignLook = { ...DEFAULT_LOOK };
  let groundLook: GroundLook = { ...DEFAULT_GROUND };
  lab.ground.setMode('cards');
  lab.ground.setLook(groundLook);

  let frozen: number | null = null;
  let prOverride: number | null = null;
  let shot: Shot = SHOTS['spawn'] ?? { eye: [0, 1.7, 3], look: [0, 3, -27], vfov: 74 };
  let t = 0;

  const applyShot = (s: Shot): void => {
    shot = s;
    camera.position.set(...s.eye);
    camera.lookAt(new Vector3(...s.look));
    camera.fov = s.vfov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    shared.setLights(lab.emitters, camera.position);
  };
  const resize = (): void => {
    const pr = prOverride ?? Math.min(window.devicePixelRatio, 3);
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const W = Math.round(w * pr), H = Math.round(h * pr);
    pipe.setSize(W, H, pr);
    lab.ground.setSize(W, H);
  };
  window.addEventListener('resize', resize);
  resize();
  applyShot(shot);

  const renderFrame = (dt: number): void => {
    t = frozen ?? t + dt;
    shared.u.uTime.value = t;
    shared.u.uCam.value.copy(camera.position);
    renderer.info.reset();
    lab.ground.renderMirror(renderer, scene, camera);
    pipe.render(scene, camera, lab.ground.mode === 'screen', 0x000000);
  };
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    renderFrame(dt);
    requestAnimationFrame(loop);
  };

  window.__lab = {
    ready: nextFrames(3),
    set: (p) => {
      if (p.streak !== undefined) { lab.ground.setMode(p.streak); lab.ground.setLook(groundLook); }
      if (p.spill !== undefined) {
        const v = p.spill ? 1 : 0;
        for (const m of [lab.washMat, lab.ground.material]) { const s = m.uniforms['uSpillOn']; if (s !== undefined) s.value = v; }
      }
      if (p.sign !== undefined) { signLook = { ...signLook, ...p.sign }; lab.signs.setLook(signLook); }
      if (p.ground !== undefined) { groundLook = { ...groundLook, ...p.ground }; lab.ground.setLook(groundLook); }
      if (p.bleed !== undefined) pipe.look = { ...pipe.look, ...p.bleed };
      if (p.hide !== undefined) {
        const hide = new Set(p.hide);
        lab.signs.boardMat.visible = !hide.has('signs');
        lab.signs.tubeMat.visible = !hide.has('signs');
        lab.lanterns.material.visible = !hide.has('lanterns');
        lab.cardMesh.visible = !hide.has('cards') && lab.ground.mode === 'cards';
      }
    },
    shot: async (name) => {
      const s = SHOTS[name];
      if (s === undefined) throw new Error(`no shot ${name}`);
      applyShot(s);
      await nextFrames(3);
    },
    time: (tt) => { frozen = tt; },
    pixelRatio: (r) => { prOverride = r; resize(); },
    stats: () => ({
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      width: renderer.domElement.width, height: renderer.domElement.height, pixelRatio: renderer.getPixelRatio(),
      atlasMs: atlas.buildMs, emitters: lab.emitters.length,
    }),
    bench: async (frames) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      renderFrame(0.016);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      await nextFrames(2);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        renderFrame(0.016);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - t0) / frames;
    },
    snapshot: (w, h, quality) => {
      renderFrame(0.016);
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const c2 = out.getContext('2d');
      if (c2 === null) throw new Error('2d canvas unavailable');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(renderer.domElement, 0, 0, w, h);
      return out.toDataURL('image/jpeg', quality);
    },
    shots: () => Object.keys(SHOTS),
    nanScan: () => { renderFrame(0.016); return pipe.nanScan(); },
    atlasTest: (chars) => {
      const list = [...new Set(Array.from(chars))];
      const at = new GlyphAtlas(list);
      at.texture.dispose();
      return { ms: at.buildMs, size: at.size, glyphs: list.length };
    },
    probe: async (pass, k) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const only = (o: Object3D | null, fn: () => void): void => {
        if (o === null) { fn(); return; }
        const vis = scene.children.map((c) => c.visible);
        for (const c of scene.children) c.visible = c === o;
        fn();
        scene.children.forEach((c, i) => { c.visible = vis[i] ?? true; });
      };
      const target: Record<string, Object3D> = { cards: lab.cardMesh, tubes: lab.tubeMesh, lanterns: lab.lanternMesh };
      const run = (n: number): void => {
        renderFrame(0.016);
        for (let i = 0; i < n; i++) {
          if (pass === 'bloom') pipe.bloom();
          else if (pass === 'composite') pipe.composite(camera, false);
          else if (pass === 'mirror') { lab.ground.setMode('planar'); lab.ground.renderMirror(renderer, scene, camera); }
          else if (pass === 'world') pipe.drawScene(scene, camera, 0, true);
          else only(target[pass] ?? null, () => { pipe.drawScene(scene, camera, 0, false); });
        }
        renderer.setRenderTarget(null);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      };
      const time = async (n: number): Promise<number> => {
        run(n);
        await nextFrames(2);
        const t0 = performance.now();
        for (let f = 0; f < 20; f++) run(n);
        return (performance.now() - t0) / 20;
      };
      const mode = lab.ground.mode;
      const a = await time(0), b = await time(k);
      lab.ground.setMode(mode);
      return (b - a) / k;
    },
    overdraw: () => {
      const W = 402, H = 874;
      const rt = new WebGLRenderTarget(W, H, { depthBuffer: true });
      const additive = new Set<Object3D>([lab.cardMesh, lab.tubeMesh]);
      const opaque = scene.children.filter((o) => !additive.has(o));
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.autoClear = false;
      for (const o of additive) o.visible = false;
      const cw: ShaderMaterial[] = [];
      for (const o of opaque) {
        if (!(o instanceof Mesh)) continue;
        const m: unknown = o.material;
        if (m instanceof ShaderMaterial) { cw.push(m); m.colorWrite = false; }
      }
      renderer.render(scene, camera);
      for (const m of cw) m.colorWrite = true;
      for (const o of opaque) o.visible = false;
      for (const o of additive) o.visible = true;
      lab.cardMesh.visible = lab.ground.mode === 'cards';
      shared.u.uCount.value = 1;
      renderer.render(scene, camera);
      shared.u.uCount.value = 0;
      for (const o of opaque) o.visible = true;
      const px = new Uint8Array(W * H * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      rt.dispose();
      let sum = 0, max = 0, cov = 0, at = 0, over8 = 0;
      for (let i = 0; i < W * H; i++) { const v = px[i * 4] ?? 0; sum += v; if (v > max) { max = v; at = i; } if (v > 0) cov++; if (v > 8) over8++; }
      return { mean: sum / (W * H), max, covered: cov / (W * H), maxX: at % W, maxY: H - 1 - Math.floor(at / W), over8: over8 / (W * H) };
    },
  };
  void shot;
  requestAnimationFrame(loop);
}

main().catch((e: unknown) => {
  console.error(e);
  const el = document.getElementById('lab-overlay');
  if (el !== null) el.textContent = `nd-lab-neon failed: ${String(e)}`;
});

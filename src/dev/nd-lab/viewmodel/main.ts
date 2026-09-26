// Lab P8 "viewmodel" (E169): the first-person Neon Jian, gloved hands, sleeves and the Fei Zhua gauntlet, remastered,
// over a backdrop plate of the clean room (a capture with the weapon off), through the clean room's bloom and grade.
// Driven headless through window.__ndVm (no URL switches): ready, shot(name), set(key, value), play(move), pose(move,
// t), step(frames, dt), clock(on), trail(look), plate(on), pixelRatio(r), stats(), bench(n), snapshot(w, h, q), loaded.
import { LinearMipmapLinearFilter, SRGBColorSpace, ShaderMaterial, type Texture, TextureLoader, Vector2, WebGLRenderer } from 'three';
import { ASSET_BASE } from './assets';
import { weaveTexture } from './materials';
import { LabPost } from './post';
import { type MoveName, type VmLayout, type VmState, Viewmodel } from './viewmodel';

interface LabShot { plate: string; pitch: number }
const SHOTS: Readonly<Record<string, LabShot>> = {
  'loop-1': { plate: 'loop-1', pitch: 5 },
  spawn: { plate: 'spawn', pitch: -4 },
  'stair-street': { plate: 'stair-street', pitch: 10 },
};

interface VmLabApi {
  ready: Promise<void>;
  loaded: () => string[];
  shot: (name: string) => Promise<void>;
  set: (key: string, value: number) => void;
  play: (m: MoveName) => void;
  pose: (m: MoveName | null, t: number) => void;
  step: (frames: number, dt: number) => void;
  clock: (on: boolean) => void;
  trail: (look: 'ink' | 'light') => void;
  plate: (on: boolean) => void;
  pixelRatio: (r: number) => void;
  stats: () => { calls: number; triangles: number; width: number; height: number; vmTris: number };
  bench: (frames: number) => Promise<number>;
  snapshot: (w: number, h: number, q: number) => string;
}
declare global { interface Window { __ndVm?: VmLabApi } }

async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, '九龍鎮邪敕令印')));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 8000); })]);
}

/** a scalar layout field by name; false = not a layout key */
function setLayout(L: VmLayout, key: string, v: number): boolean {
  switch (key) {
    case 'guardDepth': L.guardDepth = v; break;
    case 'roll': L.roll = v; break;
    case 'wristDepth': L.wristDepth = v; break;
    case 'armRoll': L.armRoll = v; break;
    case 'elbowDepth': L.elbowDepth = v; break;
    case 'fov': L.fov = v; break;
    default: return false;
  }
  return true;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('lab-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('no #lab-canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.info.autoReset = false;
  await loadFonts();
  const silk = weaveTexture();
  const vm = new Viewmodel(silk);
  await vm.load();
  const post = new LabPost(renderer, silk);
  const texLoader = new TextureLoader();
  const plates = new Map<string, Texture>();
  const plateTex = async (name: string): Promise<Texture | null> => {
    const have = plates.get(name);
    if (have !== undefined) return have;
    try {
      const t = await texLoader.loadAsync(`${ASSET_BASE}plates/${name}-plate.jpg`);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearMipmapLinearFilter;
      plates.set(name, t);
      return t;
    } catch {
      return null;
    }
  };
  let plate: Texture | null = await plateTex('loop-1');
  let plateOn = true;
  let pr: number | null = null;
  const resize = (): void => {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const r = pr ?? Math.min(window.devicePixelRatio || 1, 3);
    renderer.setPixelRatio(r);
    renderer.setSize(w, h, false);
    vm.layout(w / h);
    const bw = Math.round(w * r), bh = Math.round(h * r);
    vm.u.uLinePx.value = Math.max(1.0, 1.6 * (r / 2));
    vm.u.uHullPx.value = Math.max(1.0, 2.4 * (r / 2));
    vm.u.uRes.value.set(bw, bh);
    for (const m of vm.materials) {
      const res = m.uniforms['uRes'];
      if (res !== undefined && res.value instanceof Vector2) res.value.set(bw, bh);
      const px = m.uniforms['uPx'];
      if (px !== undefined) px.value = 7 * r;
    }
    post.setSize(bw, bh, r);
  };
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  let clockOn = true;
  const state: VmState = { t: 0, walk: 0, speed: 0, lookVel: new Vector2(), hook: 0, aimNdc: null };
  const frame = (dt: number): void => {
    t += dt;
    state.t = t;
    vm.update(dt, state);
    renderer.info.reset();
    post.render(plateOn ? plate : null, vm.scene, vm.camera, t);
  };
  // keyboard for a human at the page: 1 light, 2 heavy, 3 parry, 4 draw, 5 sheathe, W walk
  window.addEventListener('keydown', (e) => {
    const moves: Readonly<Record<string, MoveName>> = { Digit1: 'light', Digit2: 'heavy', Digit3: 'parry', Digit4: 'draw', Digit5: 'sheathe' };
    const m = moves[e.code];
    if (m !== undefined) vm.play(m);
    if (e.code === 'KeyW') state.speed = state.speed > 0 ? 0 : 1;
  });
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
    last = now;
    if (clockOn) {
      if (state.speed > 0) state.walk += dt * 5.2;
      frame(dt);
    }
    requestAnimationFrame(loop);
  };
  // settle the cloth before the first frame
  for (let i = 0; i < 90; i++) { vm.update(1 / 60, state); t += 1 / 60; }
  frame(1 / 60);

  const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
    let k = 0;
    const step = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  window.__ndVm = {
    ready: nextFrames(3),
    loaded: () => [...vm.loaded],
    shot: async (name) => {
      const s = SHOTS[name];
      if (s === undefined) throw new Error(`no shot ${name}`);
      plate = await plateTex(s.plate);
      const p = (s.pitch * Math.PI) / 180;
      vm.gravity.set(0, -Math.cos(p), -Math.sin(p)).multiplyScalar(9.8);
      await nextFrames(2);
    },
    set: (key, value) => {
      const L: VmLayout = vm.layoutPortrait;
      const vec: Readonly<Record<string, Vector2>> = { guard: L.guard, tip: L.tip, wrist: L.wrist, elbow: L.elbow };
      const m = /^(guard|tip|wrist|elbow)([XY])$/u.exec(key);
      if (m !== null) {
        const v = vec[m[1] ?? ''];
        if (v !== undefined) { if (m[2] === 'X') v.x = value; else v.y = value; }
        vm.relayout();
        return;
      }
      if (setLayout(L, key, value)) {
        vm.relayout();
        return;
      }
      const tune = vm.u.uTune.value;
      if (key === 'crease') tune.x = value;
      else if (key === 'wear') tune.y = value;
      else if (key === 'ao') tune.z = value;
      else if (key === 'env') tune.w = value;
      else if (key === 'spill') vm.u.uSpill.value.w = value;
      else if (key === 'hullPx') vm.u.uHullPx.value = value;
      else if (key === 'linePx') vm.u.uLinePx.value = value;
      else if (key === 'sutra') vm.u.uSutra.value = value;
      else if (key === 'exposure') vm.u.uExposure.value = value;
      else if (key === 'detail') vm.u.uDetail.value = value;
      else if (key === 'breeze') vm.breeze = value;
      else if (key === 'walk') state.speed = value;
      else if (key === 'vm') vm.scene.visible = value > 0.5;
      else if (key === 'keyX' || key === 'keyY' || key === 'keyZ') {
        const kv = vm.u.uKey.value;
        if (key === 'keyX') kv.x = value; else if (key === 'keyY') kv.y = value; else kv.z = value;
        kv.normalize();
      }
      else if (key === 'halo' || key === 'haloPx') {
        const hm = vm.halo.material;
        if (hm instanceof ShaderMaterial) {
          const u = hm.uniforms[key === 'halo' ? 'uGain' : 'uPx'];
          if (u !== undefined) u.value = value;
        }
      } else if (key === 'emit') vm.setEmit(value);
      else if (key === 'bloomTight' || key === 'bloomWide') {
        const b = post.mComp.uniforms['uBloom']?.value as Vector2 | undefined;
        if (b !== undefined) { if (key === 'bloomTight') b.x = value; else b.y = value; }
      } else throw new Error(`unknown key ${key}`);
    },
    play: (m) => { vm.play(m); },
    pose: (m, tt) => { vm.pose(m, tt); },
    step: (frames, dt) => { for (let i = 0; i < frames; i++) { if (state.speed > 0) state.walk += dt * 5.2; frame(dt); } },
    clock: (on) => { clockOn = on; last = performance.now(); },
    trail: (look) => { vm.setTrailLook(look); },
    plate: (on) => { plateOn = on; },
    pixelRatio: (r) => { pr = r; resize(); },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height, vmTris: vm.tris }),
    bench: async (frames) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      frame(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      await nextFrames(2);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        frame(1 / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - t0) / frames;
    },
    snapshot: (w, h, q) => {
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const c2 = out.getContext('2d');
      if (c2 === null) throw new Error('2d canvas unavailable');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(renderer.domElement, 0, 0, w, h);
      return out.toDataURL('image/jpeg', q);
    },
  };
  requestAnimationFrame(loop);
}

main().catch((e: unknown) => {
  console.error(e);
  document.body.textContent = `vm lab failed: ${String(e)}`;
});

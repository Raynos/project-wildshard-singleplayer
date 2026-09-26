// Lab P4 "hero" (E169): dev/nd-lab-hero.html. The things the eye lands on first — the Neon Jian + Fei Zhua viewmodel,
// the paifang, the banyan, a mahjong table with players and the crowd kit — on a stub of Lantern Square (wet
// flagstones, the balustrade, a few ruled tower faces), rendered through a copy of the clean room's Jiehua program and
// post (base/). Driven headless through window.__ndHero (no URL switches): ready, shot, set, guard, snapshot, bench, stats.
import { type BufferGeometry, InstancedMesh, Matrix4, Mesh, type Object3D, PerspectiveCamera, Quaternion, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { K, Kit, type Look } from './base/kit';
import { Pipeline } from './base/post';
import { SignAtlas, SignBuilder } from './base/signs';
import { Shared, jiehuaMaterial, neonMaterial, skyMaterial } from './base/style';
import { Rng } from './base/util';
import { buildBanyan } from './banyan';
import { mahjong, mahjongSeats, person } from './figures';
import { glbBox, guardMatrix, loadGlb } from './glb';
import { KitX, merge } from './kitx';
import { buildLantern, buildPaifang } from './paifang';
import { Viewmodel } from './viewmodel';

const Y0 = 125;
const EYE = 1.62;
const GATE = { x: 7.6, z: -18.5, posts: [0.6, 4.85, 10.35, 14.6] as const, s: 1.25 };
const BANYAN = { x: 15.2, z: -12.6, r: 4.1 };

interface LabShot { at: readonly [number, number, number]; yaw: number; pitch: number; hfov: number; hook?: number }
const SHOTS: Readonly<Record<string, LabShot>> = {
  spawn: { at: [1.35, Y0, 6], yaw: 11, pitch: 5, hfov: 56 },
  wide: { at: [2.2, Y0, 19], yaw: 10, pitch: 5, hfov: 60 },
  gatecmp: { at: [1.6, Y0, 2], yaw: 9, pitch: 13, hfov: 58 },
  banyancmp: { at: [4.5, Y0, 6], yaw: 24, pitch: 12, hfov: 60 },
  gate: { at: [6.2, Y0, -2], yaw: 4, pitch: 14, hfov: 60 },
  banyan: { at: [5.5, Y0, 0], yaw: 42, pitch: 12, hfov: 62 },
  mahjong: { at: [3.0, Y0, 2.0], yaw: 29, pitch: -7, hfov: 40 },
  hook: { at: [1.35, Y0, 6], yaw: 11, pitch: 5, hfov: 56, hook: 0.3 },
};

interface HeroLabStats { calls: number; triangles: number; width: number; height: number; vmTris: number; props: Record<string, number> }
interface HeroLabApi {
  ready: Promise<void>;
  shot: (name: string) => Promise<void>;
  set: (key: string, value: number) => void;
  guard: (which: string) => Promise<string>;
  pixelRatio: (r: number | null) => void;
  vm: (on: boolean) => void;
  world: (on: boolean) => void;
  stats: () => HeroLabStats;
  bench: (frames: number) => Promise<number>;
  snapshot: (w: number, h: number, quality: number) => string;
}
declare global { interface Window { __ndHero?: HeroLabApi } }

async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, '九龍疊城萬家燈火天下一家鎮邪敕')));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 8000); })]);
}

/** the stub of Lantern Square the hero props stand on: plaza, street, balustrade over the Well, ruled tower faces */
function buildStage(k: Kit): void {
  k.quad(new Vector3(0, Y0, 20), new Vector3(1, 0, 0), new Vector3(0, 0, -1), 30, 40, { wash: 0xa8a8a2, kind: K.flag, wet: 1, line: 0 });
  k.quad(new Vector3(0.5, Y0, -20), new Vector3(1, 0, 0), new Vector3(0, 0, -1), 14.5, 120, { wash: 0xa8a8a2, kind: K.flag, wet: 1, line: 0 });
  const stone: Look = { wash: 0x94918a, line: 1 };
  // the balustrade along the Well's lip (x = 0.2), z 20 → -40
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const z = 20 - i * 2.3;
    k.box(0.2, Y0, z, 0.62, 0.16, 2.3, { ...stone, line: 2 });
    k.box(0.2, Y0 + 0.16, z, 0.36, 0.86, 0.36, stone);
    k.lathe(0.2, Y0 + 1.02, z, [[0.2, 0], [0.22, 0.08], [0.19, 0.18], [0.1, 0.28], [0.02, 0.34]], 8, stone, true, 0);
    if (i < n) {
      k.box(0.2, Y0 + 0.16, z - 1.15, 0.16, 0.6, 1.94, { wash: 0x8c8983, kind: K.panel, line: 1 });
      k.box(0.2, Y0 + 0.76, z - 1.15, 0.26, 0.12, 2.0, stone);
    }
  }
  // tower faces: east of the street behind the banyan, west across the Well, and the far street canyon
  const rng = new Rng(4);
  const face = (x0: number, z0: number, w: number, d: number, h: number): void => {
    k.box(x0 + w / 2, Y0, z0 - d / 2, w, h, d, { wash: rng.pick([0x8d96a3, 0x838c9b, 0x979ba2, 0x7f8794, 0x938f86]), kind: K.facade, row: 3.2, col: 2.4, seed: rng.range(0, 50), line: 1 });
  };
  face(30, 20, 20, 40, 60);
  face(17, -24, 16, 30, 70);
  face(15.5, -54, 16, 60, 90);
  face(-16, -60, 16, 80, 110);
  face(-40, 20, 14, 60, 90);
  face(-8, -120, 26, 30, 120);
}

async function main(): Promise<void> {
  const canvas = document.getElementById('lab-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('lab: no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  const shared = new Shared();
  await loadFonts();

  const atlas = new SignAtlas();
  const signs = new SignBuilder(atlas);
  const scene = new Scene();
  const mat = jiehuaMaterial(shared);
  const reflect = (o: Object3D): Object3D => { o.layers.enable(1); return o; };
  const stage = new Kit();
  buildStage(stage);
  scene.add(new Mesh(stage.build(), mat));

  // ── the hero props ──
  const gk = new Kit(), gx = new KitX();
  const lk = new Kit(), lx = new KitX();
  const lantern = (x: number, y: number, z: number, s: number): void => { buildLantern(lk, lx, x, y, z, s); };
  buildPaifang(gk, gx, signs, lantern, { x: GATE.x, y: Y0, z: GATE.z, posts: GATE.posts, s: GATE.s, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null });
  const gate = new Mesh(merge([gk.build(), gx.build()]), mat);
  scene.add(reflect(gate));
  // lantern strings over the square and down the street
  const str = new Kit();
  const string = (a: Vector3, b: Vector3, spacing: number): void => {
    const len = a.distanceTo(b);
    const nn = Math.max(2, Math.round(len / spacing));
    const sag = len * 0.07;
    const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
    for (let i = 0; i < nn; i++) str.beam(at(i / nn), at((i + 1) / nn), 0.02, 0.02, { wash: 0x2a2c31, line: 0.5 });
    for (let i = 1; i < nn; i++) { const p = at(i / nn); lantern(p.x, p.y, p.z, 0.75); }
  };
  string(new Vector3(-1.1, Y0 + 9.2, 2.5), new Vector3(30, Y0 + 9.5, -1), 2.6);
  for (let z = -30; z > -110; z -= 10) string(new Vector3(0.3, Y0 + 7 + (z % 3), z), new Vector3(15, Y0 + 7.5, z - 2), 2.0);
  const lanterns = new Mesh(merge([lk.build(), lx.build(), str.build()]), mat);
  scene.add(reflect(lanterns));

  const bk = new Kit(), bx = new KitX();
  buildBanyan(bk, bx, { x: BANYAN.x, y: Y0, z: BANYAN.z, r: BANYAN.r, seed: 7, height: 11, spread: 7 });
  const banyan = new Mesh(merge([bk.build(), bx.build()]), mat);
  scene.add(reflect(banyan));
  // the hybrid: a TRELLIS trunk + planter (bark / stone ramp) under the procedural canopy, roots and ribbons
  const hk = new Kit(), hx = new KitX();
  buildBanyan(hk, hx, { x: BANYAN.x, y: Y0, z: BANYAN.z, r: BANYAN.r, seed: 7, height: 11, spread: 7, trunk: false });
  const trunkBox = await glbBox('/assets/nine-dragon/lab/banyan-trunk.glb');
  const trunkScale = (BANYAN.r * 2 + 0.4) / Math.max(1e-3, (trunkBox.max.x - trunkBox.min.x) * 0.72);
  const trunkGeo = await loadGlb('/assets/nine-dragon/lab/banyan-trunk.glb', {
    kind: 0, line: 0, ao: 0.8, ramp: [0x3e3226, 0x4d3e30, 0x5c4b3b, 0x6b5a48, 0x8f8b83, 0xa9a59c], hues: { green: 0x4d6a48 },
    matrix: new Matrix4().makeTranslation(BANYAN.x, Y0, BANYAN.z).multiply(new Matrix4().makeRotationY(0.6)).multiply(new Matrix4().makeScale(trunkScale, trunkScale * 0.95, trunkScale)),
  });
  const hybrid = new Mesh(merge([trunkGeo, hk.build(), hx.build()]), mat);
  hybrid.visible = false;
  scene.add(reflect(hybrid));

  const rng = new Rng(9);
  const pk = new Kit(), px = new KitX();
  mahjong(pk, px, rng, 8.8, Y0, -8.6, 0.25, 4, 0x6f8fa8);
  mahjong(pk, px, rng, 11.6, Y0, -5.0, -0.3, 3, 0xb8352a);
  mahjong(pk, px, rng, 8.4, Y0, -3.4, 0.1, 4, 0x6f8fa8);
  const cx = new KitX();
  const umbrellas = [0x1d1f25, 0x1d1f25, 0xa23a28, 0x2a2c31];
  for (let i = 0; i < 30; i++) {
    const z = rng.range(-80, -19);
    const x = rng.range(2.0, 13.5);
    const walking = rng.chance(0.7);
    person(cx, rng, x, Y0, z, rng.chance(0.5) ? Math.PI + rng.range(-0.2, 0.2) : rng.range(-0.2, 0.2), { pose: walking ? 'walk' : 'stand', umbrella: rng.chance(0.3) ? rng.pick(umbrellas) : null });
  }
  for (let i = 0; i < 6; i++) person(cx, rng, rng.range(2.5, 6.5), Y0, rng.range(-17, -6), rng.range(0, 6.28), { pose: rng.chance(0.5) ? 'walk' : 'stand', umbrella: rng.chance(0.3) ? 0x1d1f25 : null });
  const tables = new Mesh(merge([pk.build(), px.build()]), mat);
  scene.add(tables);
  const crowd = new Mesh(cx.build(), mat);
  scene.add(crowd);
  // the TRELLIS crowd: instanced walkers (umbrella) and seated players (with their stools), colour-ramped to the ink:
  // two tones per model (dark coats; the concept's beige / grey jackets), one instanced draw each
  const HUES = { skin: 0xc9a58a, red: 0xa23a28, blue: 0x5d7f9e, green: 0x3e5a4a };
  const DARK = [0x1f2126, 0x2a2c31, 0x3b3f4a, 0x55585f, 0x6b6f78, 0x8a8f96];
  const LIGHT = [0x3a3630, 0x5a5448, 0x7a7262, 0x958c78, 0xafa590, 0xc6bea8];
  const person3 = (name: string, ramp: readonly number[]): Promise<BufferGeometry> => loadGlb(`/assets/nine-dragon/lab/${name}.glb`, { kind: 0, line: 0, ao: 0.6, ramp, hues: HUES });
  const [walkD, walkL, sitD, sitL] = await Promise.all([person3('walker', DARK), person3('walker', LIGHT), person3('sitter', DARK), person3('sitter', LIGHT)]);
  const tk = new Kit(), tx = new KitX();
  const tableSpots: [number, number, number, number][] = [[8.8, -8.6, 0.25, 4], [11.6, -5.0, -0.3, 3], [8.4, -3.4, 0.1, 4]];
  const trng = new Rng(9);
  for (const [x, z, r] of tableSpots) mahjong(tk, tx, trng, x, Y0, z, r, 0, 0x6f8fa8, false);
  const up = new Vector3(0, 1, 0);
  const at = (x: number, z: number, yaw: number, sc = 1): Matrix4 => new Matrix4().compose(new Vector3(x, Y0, z), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(sc, sc, sc));
  const seats = tableSpots.flatMap(([x, z, r, n]) => mahjongSeats(x, z, r).slice(0, n)).map((st) => at(st.x, st.z, st.yaw));
  const wr = new Rng(21);
  const walks: Matrix4[] = [];
  for (let i = 0; i < 36; i++) {
    const street = i < 30;
    const x = street ? wr.range(2.0, 13.5) : wr.range(2.5, 6.5);
    const z = street ? wr.range(-80, -19) : wr.range(-17, -6);
    walks.push(at(x, z, wr.chance(0.5) ? Math.PI + wr.range(-0.3, 0.3) : wr.range(-0.3, 0.3), wr.range(0.94, 1.04)));
  }
  const inst = (g: BufferGeometry, ms: readonly Matrix4[]): InstancedMesh => {
    const im = new InstancedMesh(g, mat, Math.max(1, ms.length));
    ms.forEach((m, i) => { im.setMatrixAt(i, m); });
    im.count = ms.length;
    im.computeBoundingSphere();
    return im;
  };
  const tcrowdParts = [
    inst(sitD, seats.filter((_, i) => i % 3 !== 1)), inst(sitL, seats.filter((_, i) => i % 3 === 1)),
    inst(walkD, walks.filter((_, i) => i % 10 < 7)), inst(walkL, walks.filter((_, i) => i % 10 >= 7)),
    new Mesh(merge([tk.build(), tx.build()]), mat),
  ];
  for (const o of tcrowdParts) scene.add(o);
  crowd.visible = false;
  tables.visible = false;

  const neon = neonMaterial(shared, atlas.textures);
  atlas.finish();
  scene.add(reflect(new Mesh(signs.build(), neon)));
  const sky = new Mesh(new SphereGeometry(900, 32, 16), skyMaterial(shared));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // ── camera, viewmodel ──
  const camera = new PerspectiveCamera(60, 1, 0.1, 1200);
  const vm = new Viewmodel(shared.u.uSilk.value);
  const pipe = new Pipeline(renderer, shared, Y0);
  let hfov = 56;
  let pr: number | null = null;
  let t = 0;
  let hook = 0;
  let vmOn = true;
  let guardTilt = 0;
  let guardLen = 0.135;
  let guardDx = -0.004;
  let guardDy = 0.006;
  let guardClip = 0.2;
  /** the TRELLIS dragon head (the default); the procedural head stays as the fallback */
  const loadGuard = async (which: string): Promise<string> => {
    const url = `/assets/nine-dragon/lab/${which}.glb`;
    const box = await glbBox(url);
    const g = await loadGlb(url, { kind: 20, wash: 0xba9444, lumLo: 0.2, lumHi: 1.35, ao: 0.9, clipBack: guardClip, matrix: guardMatrix(box, guardLen, guardDx, guardDy, guardTilt) });
    vm.setGuard(g);
    return `${which}: ${Math.round((g.index?.count ?? 0) / 3)} tris`;
  };
  try { await loadGuard('guard'); } catch (e: unknown) { console.warn('lab hero: TRELLIS guard failed, procedural head kept', e); }
  const empty = new Scene();
  const resize = (): void => {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const r = pr ?? Math.min(window.devicePixelRatio || 1, 3);
    renderer.setPixelRatio(r);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI : 56;
    camera.updateProjectionMatrix();
    vm.layout(aspect);
    const bw = Math.round(w * r), bh = Math.round(h * r);
    shared.u.uLinePx.value = Math.max(1.0, 1.75 * (r / 2));
    vm.u.uLinePx.value = Math.max(1.0, 1.6 * (r / 2));
    vm.u.uHullPx.value = Math.max(1.0, 2.4 * (r / 2));
    vm.u.uRes.value.set(bw, bh);
    pipe.setSize(bw, bh, Math.max(0.9, 1.6 * (r / 2)));
  };
  window.addEventListener('resize', resize);
  resize();
  const place = (s: LabShot): void => {
    hfov = s.hfov;
    hook = s.hook ?? 0;
    resize();
    const eye = new Vector3(s.at[0], s.at[1] + EYE, s.at[2]);
    const yaw = (s.yaw * Math.PI) / 180, pitch = (s.pitch * Math.PI) / 180;
    const f = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.position.copy(eye);
    camera.lookAt(eye.clone().add(f));
    camera.updateMatrixWorld();
    shared.u.uCam.value.copy(eye);
  };
  place(SHOTS['spawn'] ?? { at: [1.35, Y0, 6], yaw: 11, pitch: 5, hfov: 56 });
  const renderFrame = (dt: number): void => {
    renderer.info.reset();
    t += dt;
    shared.u.uTime.value = 6.5;
    vm.update(dt, { t: 6.5 + t, walk: 0, speed: 0, lookVel: new Vector2(), slash: -1, heavy: false, hook, aimNdc: hook > 0 ? new Vector2(-0.1, 0.35) : null });
    pipe.render(scene, camera, vmOn ? vm.scene : empty, vm.camera);
  };
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    renderFrame(dt);
    requestAnimationFrame(loop);
  };
  renderer.compile(scene, camera);
  renderer.compile(vm.scene, vm.camera);
  requestAnimationFrame(loop);
  const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
    let k = 0;
    const step = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const layoutKeys = new Set(['elbowDepth', 'guardX', 'guardY', 'tipX', 'tipY', 'guardDepth', 'roll', 'wristX', 'wristY', 'wristDepth', 'elbowX', 'elbowY', 'armRoll', 'fov']);
  window.__ndHero = {
    ready: nextFrames(4),
    shot: async (name) => {
      const s = SHOTS[name];
      if (s === undefined) throw new Error(`no shot ${name}`);
      place(s);
      await nextFrames(3);
    },
    set: (key, value) => {
      const L = vm.layoutPortrait;
      if (layoutKeys.has(key)) {
        if (key === 'guardX') L.guard.x = value; else if (key === 'guardY') L.guard.y = value;
        else if (key === 'tipX') L.tip.x = value; else if (key === 'tipY') L.tip.y = value;
        else if (key === 'guardDepth') L.guardDepth = value; else if (key === 'roll') L.roll = value;
        else if (key === 'wristX') L.wrist.x = value; else if (key === 'wristY') L.wrist.y = value;
        else if (key === 'wristDepth') L.wristDepth = value; else if (key === 'elbowX') L.elbow.x = value;
        else if (key === 'elbowY') L.elbow.y = value; else if (key === 'armRoll') L.armRoll = value;
        else if (key === 'elbowDepth') L.elbowDepth = value;
        else L.fov = value;
        vm.relayout();
      } else if (key === 'hullPx') vm.u.uHullPx.value = value;
      else if (key === 'bloom') pipe.uComp.uBloom.value = value;
      else if (key === 'clearDepth') pipe.clearDepthA = value >= 0.5;
      else if (key === 'lines') pipe.uComp.uLines.value = value;
      else if (key === 'guardTilt') guardTilt = value;
      else if (key === 'guardLen') guardLen = value;
      else if (key === 'guardDx') guardDx = value;
      else if (key === 'guardDy') guardDy = value;
      else if (key === 'guardClip') guardClip = value;
      else if (key === 'banyan') { banyan.visible = value < 0.5; hybrid.visible = value >= 0.5; }
      else if (key === 'crowd') { const on = value >= 0.5; for (const o of tcrowdParts) o.visible = on; crowd.visible = !on; tables.visible = !on; }
      else if (key === 'sutra') { shared.setSutra(value); vm.u.uSutra.value = value; }
    },
    guard: (which) => {
      if (which === 'procedural') { vm.resetGuard(); return Promise.resolve('procedural'); }
      return loadGuard(which);
    },
    pixelRatio: (r) => { pr = r; resize(); },
    vm: (on) => { vmOn = on; },
    world: (on) => { scene.visible = on; },
    stats: () => {
      const tris = (m: Mesh): number => ((m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3) * (m instanceof InstancedMesh ? m.count : 1);
      const props: Record<string, number> = { gate: tris(gate), lanternsAndStrings: tris(lanterns), banyan: tris(banyan), banyanHybrid: tris(hybrid), proceduralCrowdAndTables: tris(crowd) + tris(tables) };
      props['trellisCrowdAndTables'] = tcrowdParts.reduce((acc, m) => acc + tris(m), 0);
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height, vmTris: vm.tris, props };
    },
    bench: async (frames) => {
      const gl = renderer.getContext();
      const pxl = new Uint8Array(4);
      renderFrame(0.016);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxl);
      await nextFrames(2);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        renderFrame(0.016);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxl);
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
  };
}

main().catch((e: unknown) => { console.error(e); });

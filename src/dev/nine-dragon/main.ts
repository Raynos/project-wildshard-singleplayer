// Nine Dragon Stack (九龍疊城), shard 4 — the clean-room spawn: Lantern Square at +125 m in 界画霓虹 Jiehua Neon, the
// Neon Jian and the Fei Zhua in first person, the baseline phone HUD. dev/nine-dragon.html; captures drive it through
// window.__nd (no URL switches): ready, shot(name), hud(on), style('jiehua' | 'sutra'), time(t), pixelRatio(r), bench(n).
import {
  BufferGeometry, Float32BufferAttribute, InstancedMesh, Mesh, type Object3D, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry,
  Uint32BufferAttribute, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { Ctx, type Piece } from './ctx';
import { PIECES } from './dressing';
import { Hud, type HudButton } from './hud';
import { Kit } from './kit';
import { WELL, Y0 } from './layout';
import { Player } from './player';
import { Pipeline } from './post';
import { acKit, lanternKit } from './props';
import { SHOTS, type Shot } from './shots';
import { SignAtlas, SignBuilder } from './signs';
import { buildSquare } from './square';
import {
  Shared, jiehuaMaterial, lineMaterial, neonMaterial, rainMaterial, screenMaterial, sheetMaterial, skyMaterial, steamMaterial,
} from './style';
import { WORDS, buildTowers, droneKit, trainKit } from './towers';
import { chars, clamp, smooth } from './util';
import { CABLE, buildWell, gondolaKit, wellSheets } from './well';
import { Viewmodel, buildClaw } from './weapon';

interface NdStats { calls: number; triangles: number; width: number; height: number; pixelRatio: number; hooks: number }
interface NdApi {
  ready: Promise<void>;
  shot: (name: string) => Promise<void>;
  hud: (on: boolean) => void;
  style: (s: 'jiehua' | 'sutra') => void;
  time: (t: number | null) => void;
  pixelRatio: (r: number | null) => void;
  stats: () => NdStats;
  bench: (frames: number) => Promise<number>;
  shots: () => string[];
  debug: () => unknown;
  budget: () => string[];
  /** debug: 0 no silhouettes, 1 normal, 2 silhouettes only (black on white); weapon on / off */
  lines: (mode: number) => void;
  atlas: () => string;
  weapon: (on: boolean) => void;
  /** render one frame and hand it back as a JPEG data URL at w × h (the canvas downscaled: supersampled) */
  snapshot: (w: number, h: number, quality: number) => string;
}
declare global { interface Window { __nd?: NdApi } }

const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"', '400 12px "JetBrains Mono"', '700 18px "Rajdhani"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, `${FONT_CHARS}ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`)));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 9000); })]);
}

function sheetsGeometry(): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], band: number[] = [], alpha: number[] = [], idx: number[] = [];
  let n = 0;
  for (const s of wellSheets) {
    for (const dy of [0, -5]) {
      const y = s.y + dy;
      const pts: [number, number, number, number][] = [[WELL.x0, WELL.z1, 0, 0], [WELL.x1, WELL.z1, 1, 0], [WELL.x1, WELL.z0, 1, 1], [WELL.x0, WELL.z0, 0, 1]];
      for (const [x, z, u, v] of pts) { pos.push(x, y, z); uv.push(u, v); band.push(s.band); alpha.push(s.a * (dy === 0 ? 1 : 0.7)); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aBand', new Float32BufferAttribute(band, 1));
  g.setAttribute('aAlpha', new Float32BufferAttribute(alpha, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

function rainGeometry(count: number): BufferGeometry {
  const seed: number[] = [], corner: number[] = [], pos: number[] = [], idx: number[] = [];
  let s = 1234567;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const a = rnd(), b = rnd(), c = rnd();
    for (const [cx, cy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]] as const) { seed.push(a, b, c); corner.push(cx, cy); pos.push(0, 0, 0); }
    const k = i * 4;
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}

function steamGeometry(points: readonly Vector3[]): BufferGeometry {
  const center: number[] = [], corner: number[] = [], seed: number[] = [], pos: number[] = [], idx: number[] = [];
  let n = 0;
  points.forEach((p, pi) => {
    for (let j = 0; j < 6; j++) {
      const sd = (pi * 0.37 + j / 6) % 1;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { center.push(p.x, p.y, p.z); corner.push(cx, cy); seed.push(sd); pos.push(p.x, p.y, p.z); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new Float32BufferAttribute(center, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}

function ribbonGeometry(segs: number): BufferGeometry {
  const t: number[] = [], pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) { t.push(i / segs, -1, i / segs, 1); pos.push(0, 0, 0, 0, 0, 0); }
  for (let i = 0; i < segs; i++) { const k = i * 2; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new Float32BufferAttribute(t, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('nd-canvas');
  const overlay = document.getElementById('nd-overlay');
  if (!(canvas instanceof HTMLCanvasElement) || overlay === null) throw new Error('nine-dragon: page is missing its canvas / overlay');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  const shared = new Shared();
  await loadFonts();

  // ── the world ──
  const atlas = new SignAtlas();
  const signs = new SignBuilder(atlas);
  const ctx = new Ctx(signs);
  buildSquare(ctx);
  buildTowers(ctx);
  buildWell(ctx);
  const scene = new Scene();
  const mat = jiehuaMaterial(shared);
  const matA = jiehuaMaterial(shared, { alphaCut: true });
  const reflect = (o: Object3D): Object3D => { o.layers.enable(1); return o; };
  for (const [name, kit] of ctx.kits) {
    if (kit.vertexCount === 0) continue;
    const m = new Mesh(kit.build(), mat);
    scene.add(ctx.reflective.has(name) ? reflect(m) : m);
  }
  for (const [, kit] of ctx.alphaKits) if (kit.vertexCount > 0) scene.add(new Mesh(kit.build(), matA));
  const lanterns = new InstancedMesh(lanternKit().build(), mat, ctx.lanterns.length);
  ctx.lanterns.forEach((m, i) => { lanterns.setMatrixAt(i, m); });
  lanterns.computeBoundingSphere();
  scene.add(reflect(lanterns));
  // the instanced dressing: one InstancedMesh per piece and region (and per material when a piece has ruled bars)
  let instances = 0;
  const triBudget: string[] = [];
  const pieceGeo = new Map<Piece, { opaque: BufferGeometry | null; alpha: BufferGeometry | null }>();
  for (const [key, list] of ctx.inst) {
    const piece = key.slice(0, key.indexOf('@')) as Piece;
    let geo = pieceGeo.get(piece);
    if (geo === undefined) {
      const kits = PIECES[piece]();
      geo = { opaque: kits.opaque?.build() ?? null, alpha: kits.alpha?.build() ?? null };
      pieceGeo.set(piece, geo);
    }
    for (const [g, m] of [[geo.opaque, mat], [geo.alpha, matA]] as const) {
      if (g === null) continue;
      const im = new InstancedMesh(g, m, list.length);
      list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
      im.computeBoundingSphere();
      scene.add(im);
    }
    instances += list.length;
    const tri = ((geo.opaque?.index?.count ?? 0) + (geo.alpha?.index?.count ?? 0)) / 3;
    triBudget.push(`${key} ${list.length} x ${tri} = ${Math.round(list.length * tri / 1000)}k`);
  }
  for (const [name, kit] of ctx.kits) triBudget.push(`kit ${name} ${Math.round(kit.vertexCount / 4000)}k`);
  const acs = new InstancedMesh(acKit().build(), mat, ctx.acs.length);
  ctx.acs.forEach((m, i) => { acs.setMatrixAt(i, m); });
  acs.computeBoundingSphere();
  scene.add(acs);
  // movers: the train, the gondola, the drones (their lights in small neon meshes)
  const neon = neonMaterial(shared, atlas.textures);
  const train = new Mesh(trainKit().build(), mat);
  scene.add(reflect(train));
  const gondola = new Mesh(gondolaKit().build(), mat);
  scene.add(gondola);
  const drones: { body: Mesh; lights: Mesh; phase: number; r: number; y: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const body = new Mesh(droneKit().build(), mat);
    const lb = new SignBuilder(atlas);
    lb.light(new Vector3(1.3, 0.6, 1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xff3b30, 10, 2, 0.1);
    lb.light(new Vector3(-1.3, 0.6, -1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xffffff, 10, 2, 0.6);
    lb.light(new Vector3(0, -0.3, 0.82), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.3, 0.2, 0x3fe6ff, 6, 1);
    const lights = new Mesh(lb.build(), neon);
    body.add(lights);
    scene.add(body);
    drones.push({ body, lights, phase: i * 2.4, r: 22 + i * 14, y: Y0 + 58 + i * 16 });
  }
  const signMesh = new Mesh(signs.build(), neon);
  scene.add(reflect(signMesh));
  const sky = new Mesh(new SphereGeometry(900, 32, 16), skyMaterial(shared));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  const screen = new Mesh(new PlaneGeometry(58, 80), screenMaterial(shared, 58, 80, 3.1));
  screen.rotation.x = Math.PI / 2;
  screen.position.set(1, Y0 + 29.85, -64);
  scene.add(screen);
  const screen2 = new Mesh(new PlaneGeometry(70, 64), screenMaterial(shared, 70, 64, 11.7));
  screen2.rotation.x = Math.PI / 2;
  screen2.position.set(78, Y0 + 48.45, 6);
  scene.add(screen2);
  const sheets = new Mesh(sheetsGeometry(), sheetMaterial(shared));
  sheets.renderOrder = 2;
  scene.add(sheets);
  const rain = new Mesh(rainGeometry(2400), rainMaterial(shared));
  rain.frustumCulled = false;
  rain.renderOrder = 4;
  scene.add(rain);
  const steam = new Mesh(steamGeometry(ctx.steam), steamMaterial(shared));
  steam.frustumCulled = false;
  steam.renderOrder = 3;
  scene.add(steam);
  const lineMat = lineMaterial(shared);
  const line = new Mesh(ribbonGeometry(40), lineMat.mat);
  line.frustumCulled = false;
  line.renderOrder = 5;
  line.visible = false;
  scene.add(line);
  const clawKit = new Kit();
  buildClaw(clawKit, 1);
  const claw = new Mesh(clawKit.build(), mat);
  claw.scale.setScalar(2.2);
  claw.visible = false;
  scene.add(claw);
  const hooks = ctx.hooks;

  // ── camera, viewmodel, frame ──
  const camera = new PerspectiveCamera(60, 1, 0.1, 1200);
  const vm = new Viewmodel(shared, atlas);
  atlas.finish();
  const pipe = new Pipeline(renderer, shared, Y0);
  const hud = new Hud(overlay, ctx.map);
  const player = new Player(canvas);
  player.place(1.45, Y0, 6, 8, 5);
  let fovP = 62, fovL = 56;
  let prOverride: number | null = null;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const resize = (): void => {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const pr = prOverride ?? Math.min(window.devicePixelRatio || 1, coarse ? 2 : 3);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? (2 * Math.atan(Math.tan((fovP * Math.PI) / 360) / aspect) * 180) / Math.PI : fovL;
    camera.updateProjectionMatrix();
    vm.layout(aspect);
    const bw = Math.round(w * pr), bh = Math.round(h * pr);
    shared.u.uLinePx.value = Math.max(1.0, 1.75 * (pr / 2));
    pipe.setSize(bw, bh, Math.max(0.9, 1.6 * (pr / 2)));
  };
  window.addEventListener('resize', resize);
  resize();

  // ── state ──
  let t = 0;
  let frozen: number | null = null;
  let paused = false;
  let slash = -1, heavy = false, attackHeld = -1;
  let hookPhase = 0;
  let hookFrozen: number | null = null;
  let hookTarget: Vector3 | null = null;
  let locked: Vector3 | null = null;
  let zipOnBite = false;
  let fpsAcc = 0, fpsN = 0, fps = 60, ms = 16.7;
  let hudOn = true;

  const bestHook = (maxAngle = 0.62, maxDist = 70): Vector3 | null => {
    const eye = player.eye(), f = player.forward();
    let best: Vector3 | null = null, bestScore = Infinity;
    for (const h of hooks) {
      const d = h.clone().sub(eye);
      const dist = d.length();
      if (dist > maxDist || dist < 2) continue;
      const ang = Math.acos(clamp(d.normalize().dot(f), -1, 1));
      if (ang > maxAngle) continue;
      const score = ang + dist * 0.004;
      if (score < bestScore) { bestScore = score; best = h; }
    }
    return best;
  };
  const fire = (target: Vector3 | null, zip: boolean): void => {
    if (target === null || hookPhase > 0) return;
    hookTarget = target;
    hookPhase = 0.0001;
    zipOnBite = zip;
  };
  const onButton = (b: HudButton): void => {
    if (b === 'attack') { if (slash < 0) { slash = 0; heavy = false; } attackHeld = 0; }
    else if (b === 'attack-up') attackHeld = -1;
    else if (b === 'lock') locked = locked === null ? bestHook() : null;
    else if (b === 'jump') { if (locked !== null) fire(locked, true); else player.hop(); }
    else if (b === 'dodge') player.dodge();
    else if (b === 'pause') paused = !paused;
  };
  hud.onButton = onButton;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') { hudOn = !hudOn; hud.setVisible(hudOn); }
    else if (e.code === 'KeyF') fire(locked ?? bestHook(), false);
    else if (e.code === 'KeyL') onButton('lock');
    else if (e.code === 'Space') onButton('jump');
    else if (e.code === 'KeyQ') onButton('dodge');
    else if (e.code === 'Digit1') shared.setSutra(0);
    else if (e.code === 'Digit2') shared.setSutra(1);
    else if (e.code === 'KeyP') hud.setPerf(true);
  });
  canvas.addEventListener('click', () => { if (slash < 0) { slash = 0; heavy = false; } });

  const muzzleWorld = (): Vector3 => {
    const n = vm.muzzleNdc();
    const p = new Vector3(n.x, n.y, 0.5).unproject(camera);
    return camera.position.clone().add(p.sub(camera.position).normalize().multiplyScalar(0.55));
  };

  const place = (dt: number): void => {
    const tt = frozen ?? t;
    // camera
    const eye = player.eye();
    camera.position.copy(eye);
    camera.lookAt(eye.clone().add(player.forward()));
    camera.updateMatrixWorld();
    shared.u.uTime.value = tt;
    shared.u.uCam.value.copy(eye);
    // movers
    const tx = -100 + ((tt * 16) % 300);
    train.position.set(tx, Y0 + 25.5, -27);
    const gx = CABLE.x0 + 5 + (CABLE.x1 - CABLE.x0 - 10) * (0.5 + 0.5 * Math.sin(tt * 0.12 - 0.62));
    gondola.position.set(gx, CABLE.y + ((gx - CABLE.x0) / (CABLE.x1 - CABLE.x0)) * 0.8, CABLE.z);
    for (const d of drones) {
      const a = tt * 0.045 + d.phase;
      d.body.position.set(8 + Math.cos(a) * d.r, d.y + Math.sin(tt * 0.3 + d.phase) * 1.5, -8 + Math.sin(a) * d.r);
      d.body.rotation.y = -a;
    }
    // hook: fly, bite, reel (or zip)
    const hp = hookFrozen ?? hookPhase;
    let aimNdc: Vector2 | null = null;
    if (hp > 0 && hookTarget !== null) {
      const start = muzzleWorld();
      const fly = smooth(0, 0.3, hp), back = smooth(0.55, 1, hp);
      const clawAt = start.clone().lerp(hookTarget, fly * (1 - back));
      line.visible = hp < 0.98;
      claw.visible = hp > 0.02 && hp < 0.97;
      claw.position.copy(clawAt);
      const dir = hookTarget.clone().sub(start).normalize();
      claw.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
      lineMat.u.uA.value.copy(start);
      lineMat.u.uB.value.copy(clawAt);
      lineMat.u.uSag.value = hp < 0.3 ? 0.4 * (1 - fly) : hp < 0.55 ? 0.02 : 0.25 * back;
      const tp = hookTarget.clone().project(camera);
      aimNdc = new Vector2(tp.x, tp.y);
      if (hookFrozen === null) {
        const before = hookPhase;
        hookPhase += dt / 1.5;
        if (before < 0.3 && hookPhase >= 0.3 && zipOnBite) player.zipTo(hookTarget);
        if (hookPhase >= 1) { hookPhase = 0; hookTarget = null; locked = null; }
      }
    } else {
      line.visible = false;
      claw.visible = false;
    }
    // slash
    if (slash >= 0 && frozen === null) {
      slash += dt / (heavy ? 0.5 : 0.34);
      if (attackHeld >= 0) attackHeld += dt;
      if (slash >= 1) {
        slash = -1;
        if (attackHeld > 0.25) { slash = 0; heavy = true; }
      }
    }
    vm.update(dt, { t: tt, walk: player.walk, speed: player.speed, lookVel: player.lookVel.clone().multiplyScalar(0.05), slash, heavy, hook: hp, aimNdc });
    const L = shared.u.uLightDir.value.clone().transformDirection(camera.matrixWorldInverse);
    for (const m of vm.materials) {
      const ld = m.uniforms['uLightDir'];
      if (ld !== undefined && ld !== shared.u.uLightDir) (ld.value as Vector3).copy(L);
    }
    for (const d of drones) d.lights.visible = true;
  };

  const renderFrame = (dt: number): void => {
    renderer.info.reset();
    place(dt);
    pipe.render(scene, camera, vm.scene, vm.camera);
  };

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
    last = now;
    if (!paused && frozen === null) t += dt;
    const look = hud.consumeLook();
    if (look.lengthSq() > 0) player.look(look.x * 1.3, look.y * 1.3);
    if (!paused) player.update(dt, hud.move);
    renderFrame(dt);
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; ms = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0; }
    let reticle: Vector2 | null = null;
    const show = locked ?? (hookPhase > 0 ? hookTarget : null);
    if (show !== null) {
      const p = show.clone().project(camera);
      if (p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1) reticle = new Vector2((p.x * 0.5 + 0.5) * window.innerWidth, (0.5 - p.y * 0.5) * window.innerHeight);
    }
    hud.update({ x: player.pos.x, z: player.pos.z, yaw: player.yaw, fps, ms, reticle, locked: locked !== null }, dt);
    requestAnimationFrame(loop);
  };

  // compile everything before the first visible frame
  renderer.compile(scene, camera);
  renderer.compile(vm.scene, vm.camera);
  renderFrame(0.016);

  const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
    let k = 0;
    const step = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const applyShot = (s: Shot): void => {
    fovP = s.hfovPortrait;
    fovL = s.vfovLandscape;
    resize();
    player.place(s.at[0], s.at[1], s.at[2], s.yaw, s.pitch);
    slash = -1;
    locked = null;
    if (s.hook === undefined) { hookFrozen = null; hookPhase = 0; hookTarget = null; }
    else {
      place(0);
      const near = s.hookNear;
      hookTarget = near === undefined ? bestHook(1.2, 90) : hooks.reduce<Vector3 | null>((best, h) => (best === null || h.distanceTo(new Vector3(...near)) < best.distanceTo(new Vector3(...near)) ? h : best), null);
      hookFrozen = hookTarget === null ? null : s.hook;
      locked = hookTarget;
    }
  };
  window.__nd = {
    ready: nextFrames(3),
    shot: async (name) => {
      const s = SHOTS[name];
      if (s === undefined) throw new Error(`no shot ${name}`);
      applyShot(s);
      await nextFrames(3);
    },
    hud: (on) => { hudOn = on; hud.setVisible(on); },
    style: (s) => { shared.setSutra(s === 'sutra' ? 1 : 0); },
    time: (tt) => { frozen = tt; },
    pixelRatio: (r) => { prOverride = r; resize(); },
    stats: () => ({
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      width: renderer.domElement.width, height: renderer.domElement.height, pixelRatio: renderer.getPixelRatio(), hooks: hooks.length,
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
    shots: () => Object.keys(SHOTS),
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
    budget: () => triBudget,
    lines: (mode) => { pipe.uComp.uLines.value = mode; },
    atlas: () => atlas.dump(),
    weapon: (on) => { vm.scene.visible = on; },
    debug: () => ({ hookTarget: hookTarget?.toArray() ?? null, hookFrozen, hookPhase, line: line.visible, claw: claw.position.toArray(), a: lineMat.u.uA.value.toArray(), b: lineMat.u.uB.value.toArray() }),
  };
  requestAnimationFrame(loop);
}

main().catch((e: unknown) => {
  console.error(e);
  const el = document.getElementById('nd-overlay');
  if (el !== null) el.textContent = `nine-dragon failed: ${String(e)}`;
});

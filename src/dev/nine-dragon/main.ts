// Nine Dragon Stack (九龍疊城), shard 4 — the clean-room spawn: Lantern Square at +125 m in 界画霓虹 Jiehua Neon, the
// Neon Jian and the Fei Zhua in first person, the baseline phone HUD. dev/nine-dragon.html; captures drive it through
// window.__nd (no URL switches): ready, shot(name), hud(on), style('jiehua' | 'sutra'), time(t), pixelRatio(r), bench(n).
import {
  BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, type Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, SphereGeometry, Vector4,
  Uint32BufferAttribute, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { Ctx, type Piece } from './ctx';
import { type Emitter, bakeSpill } from './emitters';
import { GlyphAtlas } from './glyphs';
import { Lanterns } from './lanterns';
import { NeonSigns } from './neonsigns';
import { buildStreaks } from './streaks';
import { buildFacade, type FacadeStats } from './facade/batch';
import { facadeUniforms } from './facade/material';
import { PIECES } from './dressing';
import { Hud, type HudButton } from './hud';
import { WELL, Y0 } from './layout';
import { Player } from './player';
import { loadPaint } from './paint';
import { Pipeline } from './post';
import { acKit } from './props';
import { SHOTS, type Shot } from './shots';
import { tintUmbrella } from './crowd';
import { banyanOut } from './banyan';
import { buildCanopy } from './canopy';
import { loadSquareProps } from './props3d';
import { SignAtlas, SignBuilder } from './signs';
import { buildSquare } from './square';
import {
  type LookName, Shared, jiehuaMaterial, lineMaterial, neonMaterial, screenMaterial, sheetMaterial, skyMaterial, steamMaterial,
} from './style';
import { WORDS, buildTowers, droneKit, trainKit } from './towers';
import { Rng, chars, clamp, smooth } from './util';
import { CABLE, buildWell, gondolaKit, wellSheets } from './well';
import { type VmLayout, Viewmodel } from './vm/viewmodel';
import { buildClaw } from './hero/weapon-parts';
import { KitX, merge } from './hero/kitx';
import { loadGlb } from './hero/glb';

interface NdStats { calls: number; triangles: number; width: number; height: number; pixelRatio: number; hooks: number }
interface NdApi {
  ready: Promise<void>;
  shot: (name: string) => Promise<void>;
  hud: (on: boolean) => void;
  style: (s: LookName) => void;
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
  /** the paint strengths (paint.ts uPaintK: master, flagstones, walls, wood / lacquer / tiles); [0, …] = the flat washes */
  paint: (k: [number, number, number, number]) => void;
  /** render one frame and hand it back as a JPEG data URL at w × h (the canvas downscaled: supersampled) */
  snapshot: (w: number, h: number, quality: number) => string;
  /** framing work: an ad-hoc camera (a Shot not in SHOTS), and the viewmodel's layout (portrait / landscape, merged) */
  view: (s: Shot) => Promise<void>;
  vmLayout: (portrait: Partial<VmLayoutJson>, landscape: Partial<VmLayoutJson>) => void;
}
interface VmLayoutJson { guard: [number, number]; tip: [number, number]; guardDepth: number; roll: number; wrist: [number, number]; wristDepth: number; elbow: [number, number]; armRoll: number; elbowDepth: number; fov: number }
const tuneLayout = (L: VmLayout, j: Partial<VmLayoutJson>): VmLayout => ({
  guard: j.guard === undefined ? L.guard : new Vector2(...j.guard), tip: j.tip === undefined ? L.tip : new Vector2(...j.tip),
  guardDepth: j.guardDepth ?? L.guardDepth, roll: j.roll ?? L.roll, wrist: j.wrist === undefined ? L.wrist : new Vector2(...j.wrist),
  wristDepth: j.wristDepth ?? L.wristDepth, elbow: j.elbow === undefined ? L.elbow : new Vector2(...j.elbow), armRoll: j.armRoll ?? L.armRoll,
  elbowDepth: j.elbowDepth ?? L.elbowDepth, fov: j.fov ?? L.fov,
});
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
  // the painted surfaces (paint.ts, lab P5): one texture array, loaded with the fonts (the placeholder until then)
  const [paint] = await Promise.all([loadPaint('/assets/nine-dragon/lab/tex', Math.min(8, renderer.capabilities.getMaxAnisotropy())), loadFonts()]);
  shared.u.uPaint.value = paint.tex;

  // ── the world ──
  const atlas = new SignAtlas();
  const signs = new SignBuilder(atlas);
  const glyphs = new GlyphAtlas(chars(FONT_CHARS));
  const neonSigns = new NeonSigns(shared, glyphs);
  signs.calligraphy = neonSigns;
  shared.u.uGroundY.value = Y0;
  shared.u.uShaft.value.set(WELL.x0, WELL.z0, WELL.x1, WELL.z1);
  shared.u.uShaftK.value.y = Y0;
  const ctx = new Ctx(signs);
  buildSquare(ctx);
  buildTowers(ctx);
  buildWell(ctx);
  // the facade grammar's sign slots, filled with real calligraphy (SDF neon for blades, lightboxes for flat ones)
  const slotRng = new Rng(4242);
  const bladesKit = ctx.kit('facade-signs');
  for (const s of ctx.fd.signs) {
    const word = slotRng.pick(WORDS);
    const color = `#${s.color.toString(16).padStart(6, '0')}`;
    const size = Math.min(s.size, s.blade ? 1.2 : 0.8);
    ctx.signs.place({ at: s.at, normal: s.normal, size, spec: { text: word, color, vertical: s.blade, style: s.blade || slotRng.chance(0.5) ? 'tube' : 'box' }, blade: s.blade }, s.blade ? null : bladesKit);
  }
  const scene = new Scene();
  const mat = jiehuaMaterial(shared);
  const matA = jiehuaMaterial(shared, { alphaCut: true });
  // paper lanterns (one instanced draw) and every emitter: neon signs, lightboxes, lanterns, lit shopfronts
  const paper = new Lanterns(shared);
  const tmpP = new Vector3(), tmpQ = new Quaternion(), tmpS = new Vector3();
  for (const m of ctx.lanterns) { m.decompose(tmpP, tmpQ, tmpS); paper.hang(tmpP.clone(), tmpS.x); }
  const emitters: Emitter[] = [...neonSigns.emitters, ...signs.lights, ...paper.emitters, ...ctx.emitters];
  const kitGeos: BufferGeometry[] = [];
  for (const [name, kit] of ctx.kits) {
    const kx = ctx.kitxs.get(name);
    if (kx !== undefined && kx.vertexCount > 0) kitGeos.push(kit.vertexCount > 0 ? merge([kit.build(), kx.build()]) : kx.build());
    else if (kit.vertexCount > 0) kitGeos.push(kit.build());
  }
  for (const [name, kx] of ctx.kitxs) if (!ctx.kits.has(name) && kx.vertexCount > 0) kitGeos.push(kx.build());
  const alphaGeos: BufferGeometry[] = [];
  for (const [, kit] of ctx.alphaKits) if (kit.vertexCount > 0) alphaGeos.push(kit.build());
  bakeSpill(kitGeos, emitters);
  // dome B: the banyan's painted leaf-card canopy (canopy.ts, from the organic lab) on the tree's planned lumps
  for (const m of await buildCanopy(shared, banyanOut.plan?.lumps ?? [], emitters)) scene.add(m);
  // dome B: the square's TRELLIS props (props3d.ts, from the organic lab): guardian lions, glazed pots, lantern trios
  for (const m of await loadSquareProps(mat)) scene.add(m);
  for (const g of kitGeos) scene.add(new Mesh(g, mat));
  for (const g of alphaGeos) scene.add(new Mesh(g, matA));
  scene.add(paper.build());
  const facade = buildFacade(ctx.fd, facadeUniforms(shared), { clutterFar: [55, 85] });
  scene.add(facade.group);
  const facadeStats: FacadeStats = facade.stats;
  const neonMeshes = neonSigns.build();
  scene.add(neonMeshes.boards, neonMeshes.tubes);
  // the wet-ground streaks: cards for the emitters over the square, its street and the ledges at its level
  const onSquare = emitters.filter((e) => e.at.y > Y0 + 0.3 && e.at.y < Y0 + 45 && e.at.x > WELL.x0 - 2 && e.at.x < 40 && e.at.z > -170 && e.at.z < 30);
  // …and the lit windows of the walls round the square and up the street: the targets' ground is combed with fine warm
  // streaks between the neon ones (one card each, no spill: the window already glows)
  const wu = new Vector3(), wn = new Vector3(), wc = new Vector3(), wp = new Vector3();
  let windowCards = 0;
  const WHITE = new Color(1, 1, 1);
  for (const w of ctx.fd.windows) {
    if (w.win.y <= 0) continue;
    w.m.extractBasis(wu, wc, wn);
    const ww = wu.length(), wh = wc.length();
    wp.setFromMatrixPosition(w.m).addScaledVector(wc, 0.5);
    if (wp.y < Y0 + 0.5 || wp.y > Y0 + 28 || wp.x < WELL.x1 - 1 || wp.x > 40 || wp.z < -170 || wp.z > 30) continue;
    // it must face the square / the street's axis (x ≈ 6.5)
    const axis = new Vector3(6.5, wp.y, Math.min(Math.max(wp.z, -170), 10));
    if (wn.normalize().dot(axis.sub(wp)) <= 0) continue;
    onSquare.push({ at: wp.clone(), color: w.light.clone().lerp(WHITE, 0.3).multiplyScalar(w.win.y), w: ww, h: wh, power: 0.07, spill: 0 });
    windowCards++;
  }
  scene.add(buildStreaks(shared, onSquare, new Vector4(WELL.x0 + 5, WELL.z0 + 5, WELL.x1, WELL.z1 - 5)));
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
  scene.add(train);
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
  scene.add(new Mesh(signs.build(), neon));
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
  const clawKit = new KitX();
  buildClaw(clawKit, 1);
  const claw = new Mesh(clawKit.build(), mat);
  claw.scale.setScalar(2.2);
  claw.visible = false;
  scene.add(claw);
  const hooks = ctx.hooks;

  // ── camera, viewmodel, frame ──
  const camera = new PerspectiveCamera(60, 1, 0.1, 1200);
  // the first person (lab P8, vm/): the procedural jian + its heat halo, the Blender-remastered dragon guard, the gloved
  // hand and sleeve, verlet tassel + talisman, the Fei Zhua gauntlet with its talons as a separate part, the 飞白 trail
  const vm = new Viewmodel(shared.u.uSilk.value);
  await vm.load();
  // the TRELLIS crowd, colour-ramped to the ink (two tones per model, one instanced draw each)
  const HUES = { skin: 0xc9a58a, red: 0xa23a28, blue: 0x5d7f9e, green: 0x3e5a4a };
  const DARK = [0x1f2126, 0x2a2c31, 0x3b3f4a, 0x55585f, 0x6b6f78, 0x8a8f96];
  const LIGHT = [0x3a3630, 0x5a5448, 0x7a7262, 0x958c78, 0xafa590, 0xc6bea8];
  const person3 = (name: string, ramp: readonly number[]): Promise<BufferGeometry> => loadGlb(`/assets/nine-dragon/lab/${name}.glb`, { kind: 0, line: 0, ao: 0.6, ramp, hues: HUES });
  try {
    const [walkD, walkL, sitD, sitL] = await Promise.all([person3('walker', DARK), person3('walker', LIGHT), person3('sitter', DARK), person3('sitter', LIGHT)]);
    const inst = (g: BufferGeometry, ms: readonly Matrix4[]): void => {
      if (ms.length === 0) return;
      const im = new InstancedMesh(g, mat, ms.length);
      ms.forEach((m, i) => { im.setMatrixAt(i, m); });
      im.computeBoundingSphere();
      scene.add(im);
    };
    // dome B (crowd.ts): one walker in ten under a red oil-paper umbrella, one in ten under an ochre one
    inst(walkD, ctx.walkers.filter((_, i) => i % 10 < 7 && i % 10 !== 2));
    inst(walkL, ctx.walkers.filter((_, i) => i % 10 >= 7 && i % 10 !== 8));
    inst(tintUmbrella(walkD, 0x9a2e1c), ctx.walkers.filter((_, i) => i % 10 === 2));
    inst(tintUmbrella(walkL, 0xb07a34), ctx.walkers.filter((_, i) => i % 10 === 8));
    inst(sitD, ctx.sitters.filter((_, i) => i % 3 !== 1));
    inst(sitL, ctx.sitters.filter((_, i) => i % 3 === 1));
  } catch (e: unknown) { console.warn('nine-dragon: the TRELLIS crowd failed to load', e); }
  atlas.finish();
  const pipe = new Pipeline(renderer, shared);
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
    vm.u.uLinePx.value = Math.max(1.0, 1.6 * (pr / 2));
    vm.u.uHullPx.value = Math.max(1.0, 2.4 * (pr / 2));
    const bw = Math.round(w * pr), bh = Math.round(h * pr);
    vm.u.uRes.value.set(bw, bh);
    // the halo and the trail carry their own screen-size uniforms
    for (const m of vm.materials) {
      const res = m.uniforms['uRes'];
      if (res !== undefined && res.value instanceof Vector2) res.value.set(bw, bh);
      const px = m.uniforms['uPx'];
      if (px !== undefined) px.value = 7 * pr;
    }
    shared.u.uDpr.value = pr / 3;
    pipe.setSize(bw, bh, 1, pr);
  };
  window.addEventListener('resize', resize);
  resize();

  // ── state ──
  let t = 0;
  let frozen: number | null = null;
  let paused = false;
  // attack: a tap is the light cut, holding past 0.3 s the heavy chop (vm.play runs the move; P8's MOVES)
  let attackHeld = -1, heavyFired = false;
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
    if (b === 'attack') { attackHeld = 0; heavyFired = false; }
    else if (b === 'attack-up') { if (attackHeld >= 0 && !heavyFired) vm.play('light'); attackHeld = -1; }
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
    else if (e.code === 'Digit1') { shared.setLook('jiehua'); vm.u.uSutra.value = 0; }
    else if (e.code === 'Digit2') { shared.setLook('sutra'); vm.u.uSutra.value = 1; }
    else if (e.code === 'Digit3') { shared.setLook('silk'); vm.u.uSutra.value = 0; }
    else if (e.code === 'KeyP') hud.setPerf(true);
    else if (e.code === 'KeyE') vm.play('parry');
    else if (e.code === 'KeyR') vm.play('draw');
  });
  canvas.addEventListener('click', () => { vm.play('light'); });

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
    shared.u.uNear.value = camera.near;
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
    // the held attack becomes the heavy chop
    if (attackHeld >= 0 && frozen === null) {
      attackHeld += dt;
      if (attackHeld > 0.3 && !heavyFired) { heavyFired = true; vm.play('heavy'); }
    }
    // gravity in view space, so the tassel and the talisman hang true at any pitch
    vm.gravity.set(0, -Math.cos(player.pitch), -Math.sin(player.pitch)).multiplyScalar(9.8);
    vm.update(dt, { t: tt, walk: player.walk, speed: player.speed, lookVel: player.lookVel.clone().multiplyScalar(0.05), hook: hp, aimNdc });
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
    vm.scene.visible = s.weapon !== false;
    attackHeld = -1;
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
    style: (s) => { shared.setLook(s); vm.u.uSutra.value = s === 'sutra' ? 1 : 0; },
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
    budget: () => [...triBudget, `facade ${JSON.stringify(facadeStats)}`, `streak cards ${onSquare.length} (${windowCards} lit windows)`],
    lines: (mode) => { pipe.uComp.uLines.value = mode; },
    atlas: () => atlas.dump(),
    weapon: (on) => { vm.scene.visible = on; },
    paint: (k) => { shared.u.uPaintK.value.set(...k); },
    view: async (s) => { applyShot(s); await nextFrames(3); },
    vmLayout: (lp, ll) => { vm.layoutPortrait = tuneLayout(vm.layoutPortrait, lp); vm.layoutLandscape = tuneLayout(vm.layoutLandscape, ll); vm.relayout(); },
    debug: () => ({ hookTarget: hookTarget?.toArray() ?? null, hookFrozen, hookPhase, line: line.visible, claw: claw.position.toArray(), a: lineMat.u.uA.value.toArray(), b: lineMat.u.uB.value.toArray() }),
  };
  requestAnimationFrame(loop);
}

main().catch((e: unknown) => {
  console.error(e);
  const el = document.getElementById('nd-overlay');
  if (el !== null) el.textContent = `nine-dragon failed: ${String(e)}`;
});

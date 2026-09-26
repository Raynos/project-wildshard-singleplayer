// The Nine Dragon Stack fragment's world (P0-5c), built for the engine: Lantern Square at +125 m, the Well's rim and its
// upper galleries, the stair-street stub and the towers round them — what the clean room built in its page
// (src/dev/nine-dragon/main.ts), without its camera, player, HUD, viewmodel or post. Everything is added under one
// Group; `update(t, camera)` drives the shared uniforms (time, the eye for the materials' baked silk fog) and the
// movers. The look (materials, signs, neon, streaks, light) is look/'s; this file only assembles it.
import {
  BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Mesh, type Object3D, type PerspectiveCamera, PlaneGeometry, Quaternion,
  SphereGeometry, Uint32BufferAttribute, Vector3, Vector4, type WebGLRenderer,
} from 'three';
import { Ctx, type Piece } from './ctx';
import { type Emitter, bakeSpill } from '../look/emitters';
import { GlyphAtlas } from '../look/glyphs';
import { Lanterns } from '../look/lanterns';
import { NeonSigns } from '../look/neonsigns';
import { buildStreaks, stairStreaks } from '../look/streaks';
import { buildFacade } from './facade/batch';
import { facadeUniforms } from '../look/facadeMaterial';
import { PIECES } from './dressing';
import { STAIR, WELL, Y0 } from '../layout';
import { FACE_N, FACE_S, FAR_X, FLIGHTS, LANDINGS, RISE, RUN, TOP_Y } from './stairstreet';
import { loadPaint } from '../look/paint';
import { SCROLL, loadScroll, scrollMaterial } from '../look/scroll';
import { installLight } from '../look/light/install';
import { glowUniforms } from '../look/light/glow';
import { gradeUniforms } from '../look/light/grade';
import { acKit } from './props';
import { Crowd, tintUmbrella } from './crowd';
import { banyanOut } from './banyan';
import { buildCanopy } from './canopy';
import { loadSquareProps } from './props3d';
import { SignAtlas, SignBuilder } from '../look/signs';
import { buildSquare } from './square';
import { Shared, jiehuaMaterial, neonMaterial, sheetMaterial, skyMaterial, steamMaterial } from '../look/style';
import { WORDS, buildTowers, droneKit, trainKit } from './towers';
import { Rng, chars } from '../util';
import { CABLE, SHAFT, WELL_RECTS, buildWell, gondolaKit, wellSheets } from './well';
import { merge } from './hero/kitx';
import { loadGlb } from './hero/glb';
import { InstanceCuller } from './cull';

/** an instanced batch whose bounding sphere is wider than this (m) is culled per instance */
const CULL_R = 40;

const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

/** the sign faces are drawn into canvases: their fonts must be in before the atlas is (9 s cap, then system fallbacks) */
async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, FONT_CHARS)));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 9000); })]);
}

/** the silk fog sheets across the Well at each stratum gap (their heights come from well.ts), over both of its rects —
 *  the main shaft and the canyon's run north (dome C's WELL_RECTS) */
function sheetsGeometry(): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], band: number[] = [], alpha: number[] = [], idx: number[] = [];
  let n = 0;
  for (const s of wellSheets) {
    for (const r of WELL_RECTS) {
      for (const dy of [0, -5]) {
        const y = s.y + dy;
        const pts: [number, number, number, number][] = [[r.x0, r.z1, 0, 0], [r.x1, r.z1, 1, 0], [r.x1, r.z0, 1, 1], [r.x0, r.z0, 0, 1]];
        for (const [x, z, u, v] of pts) { pos.push(x, y, z); uv.push(u, v); band.push(s.band); alpha.push(s.a * (dy === 0 ? 1 : 0.7)); }
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
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

/** soft steam billboards over the noodle stall's pots */
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

export interface NineDragonWorld {
  /** everything the fragment draws (add it to the engine's scene) */
  readonly root: Group;
  /** the look's shared uniforms (time, the eye, the silk fog, the paint, the light pools) */
  readonly shared: Shared;
  /** the build's context: its layout records (hooks, the map's floor plan, the crowd) */
  readonly ctx: Ctx;
  /** per frame: time (s) and the camera the frame is drawn from */
  update: (t: number, camera: PerspectiveCamera) => void;
  /**
   * per frame, with the camera as it is drawn (the render hook's `frame`, after the updaters and the late hooks): the
   * world-wide instanced batches culled per instance (world/cull.ts) and the crowd's figures picked (crowd.ts)
   */
  cull: (camera: PerspectiveCamera) => void;
  /** the per-instance culling (its `stats` for the budget ruler) */
  readonly culler: InstanceCuller;
}

/** build the fragment's world; `progress(0..1)` as it goes */
export async function buildNineDragonWorld(renderer: WebGLRenderer, progress: (f: number) => void = () => undefined): Promise<NineDragonWorld> {
  const shared = new Shared();
  const root = new Group();
  root.name = 'nine-dragon-stack';
  const [paint] = await Promise.all([loadPaint('/assets/nine-dragon/lab/tex', Math.min(8, renderer.capabilities.getMaxAnisotropy())), loadFonts()]);
  shared.u.uPaint.value = paint.tex;
  progress(0.15);

  // ── the layout: the square, the towers, the Well ──
  const atlas = new SignAtlas();
  const signs = new SignBuilder(atlas);
  const glyphs = new GlyphAtlas(chars(FONT_CHARS));
  const neonSigns = new NeonSigns(shared, glyphs);
  signs.calligraphy = neonSigns;
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
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
  progress(0.4);

  // ── the kits into meshes: one merged geometry per kit, the neon spill baked into their vertices ──
  const mat = jiehuaMaterial(shared);
  const matA = jiehuaMaterial(shared, { alphaCut: true });
  const paper = new Lanterns(shared);
  const tmpP = new Vector3(), tmpQ = new Quaternion(), tmpS = new Vector3();
  for (const m of ctx.lanterns) { m.decompose(tmpP, tmpQ, tmpS); paper.hang(tmpP.clone(), tmpS.x); }
  const emitters: Emitter[] = [...neonSigns.emitters, ...signs.lights, ...paper.emitters, ...ctx.emitters];
  // every mesh is named by what built it (`kit:<name>`, `facade`, `crowd`, …): the budget ruler sorts them into lanes
  const named = <T extends Object3D>(o: T, name: string): T => { o.name = name; return o; };
  const kitGeos: [string, BufferGeometry][] = [];
  for (const [name, kit] of ctx.kits) {
    const kx = ctx.kitxs.get(name);
    if (kx !== undefined && kx.vertexCount > 0) kitGeos.push([name, kit.vertexCount > 0 ? merge([kit.build(), kx.build()]) : kx.build()]);
    else if (kit.vertexCount > 0) kitGeos.push([name, kit.build()]);
  }
  for (const [name, kx] of ctx.kitxs) if (!ctx.kits.has(name) && kx.vertexCount > 0) kitGeos.push([name, kx.build()]);
  const alphaGeos: [string, BufferGeometry][] = [];
  for (const [name, kit] of ctx.alphaKits) if (kit.vertexCount > 0) alphaGeos.push([name, kit.build()]);
  bakeSpill(kitGeos.map(([, g]) => g), emitters);
  for (const m of await buildCanopy(shared, banyanOut.plan?.lumps ?? [], emitters)) root.add(named(m, 'canopy'));
  for (const m of await loadSquareProps(mat)) root.add(named(m, 'props3d'));
  // (a kit with a draw distance, ctx.far(name, m), is shown / hidden by the culler below)
  const farKits: [Mesh, number][] = [];
  const kitMesh = (name: string, g: BufferGeometry, m: typeof mat): void => {
    const mesh = named(new Mesh(g, m), `kit:${name}`);
    root.add(mesh);
    const far = ctx.farOf.get(name);
    if (far !== undefined) farKits.push([mesh, far]);
  };
  for (const [name, g] of kitGeos) kitMesh(name, g, mat);
  for (const [name, g] of alphaGeos) kitMesh(name, g, matA);
  root.add(named(paper.build(), 'lanterns'));
  const facade = buildFacade(ctx.fd, facadeUniforms(shared), { clutterFar: [55, 85] });
  root.add(named(facade.group, 'facade'));
  const neonMeshes = neonSigns.build();
  root.add(named(neonMeshes.boards, 'neon'), named(neonMeshes.tubes, 'neon'));
  progress(0.6);

  // the wet-ground streaks: the emitters over the square and its street, and the lit windows facing them
  const onSquare = emitters.filter((e) => e.at.y > Y0 + 0.3 && e.at.y < Y0 + 45 && e.at.x > WELL.x0 - 2 && e.at.x < 40 && e.at.z > -170 && e.at.z < 30);
  const wu = new Vector3(), wn = new Vector3(), wc = new Vector3(), wp = new Vector3();
  const WHITE = new Color(1, 1, 1);
  for (const w of ctx.fd.windows) {
    if (w.win.y <= 0) continue;
    w.m.extractBasis(wu, wc, wn);
    wp.setFromMatrixPosition(w.m).addScaledVector(wc, 0.5);
    if (wp.y < Y0 + 0.5 || wp.y > Y0 + 28 || wp.x < WELL.x1 - 1 || wp.x > 40 || wp.z < -170 || wp.z > 30) continue;
    const axis = new Vector3(6.5, wp.y, Math.min(Math.max(wp.z, -170), 10));
    if (wn.normalize().dot(axis.sub(wp)) <= 0) continue;
    onSquare.push({ at: wp.clone(), color: w.light.clone().lerp(WHITE, 0.3).multiplyScalar(w.win.y), w: wu.length(), h: wc.length(), power: 0.07, spill: 0 });
  }
  root.add(named(buildStreaks(shared, onSquare, new Vector4(WELL.x0 + 5, WELL.z0 + 5, WELL.x1, WELL.z1 - 5)), 'streaks'));
  // the stair-street's: its treads and landings under the emitters over it (the render agent's)
  const onStair = emitters.filter((e) => e.at.x > STAIR.x0 - 4 && e.at.x < FAR_X && e.at.z > FACE_N - 6 && e.at.z < FACE_S + 6 && e.at.y > Y0 + 0.3 && e.at.y < TOP_Y + 40);
  for (const m of stairStreaks(shared, onStair, { flights: FLIGHTS, landings: LANDINGS, rise: RISE, run: RUN, z0: STAIR.z0, z1: STAIR.z1 })) root.add(named(m, 'streaks-stair'));

  // the instanced dressing: one InstancedMesh per piece and region
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
      root.add(named(im, `inst:${key}`));
    }
  }
  const acs = new InstancedMesh(acKit().build(), mat, ctx.acs.length);
  ctx.acs.forEach((m, i) => { acs.setMatrixAt(i, m); });
  acs.computeBoundingSphere();
  root.add(named(acs, 'inst:ac'));

  // movers: the train, the gondola, the drones (their lights in small neon meshes)
  const neon = neonMaterial(shared, atlas.textures);
  const train = new Mesh(trainKit().build(), mat);
  const gondola = new Mesh(gondolaKit().build(), mat);
  root.add(named(train, 'movers'), named(gondola, 'movers'));
  const drones: { body: Mesh; phase: number; r: number; y: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const body = new Mesh(droneKit().build(), mat);
    const lb = new SignBuilder(atlas);
    lb.light(new Vector3(1.3, 0.6, 1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xff3b30, 10, 2, 0.1);
    lb.light(new Vector3(-1.3, 0.6, -1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xffffff, 10, 2, 0.6);
    lb.light(new Vector3(0, -0.3, 0.82), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.3, 0.2, 0x3fe6ff, 6, 1);
    body.add(new Mesh(lb.build(), neon));
    root.add(named(body, 'movers'));
    drones.push({ body, phase: i * 2.4, r: 22 + i * 14, y: Y0 + 58 + i * 16 });
  }
  root.add(named(new Mesh(signs.build(), neon), 'signs'));

  // the painted sky, the LED sky screens (lab P7's 千里江山图 scroll), the Well's silk sheets, the stall's steam
  const sky = new Mesh(new SphereGeometry(900, 32, 16), skyMaterial(shared));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(named(sky, 'sky'));
  const scrollTex = await loadScroll('/assets/nine-dragon/lab/organic/scroll.webp');
  const screen = new Mesh(new PlaneGeometry(58, 80), scrollMaterial(shared, scrollTex, 58, 80, SCROLL).mat);
  screen.rotation.x = Math.PI / 2;
  screen.position.set(1, Y0 + 29.85, -64);
  const screen2 = new Mesh(new PlaneGeometry(70, 64), scrollMaterial(shared, scrollTex, 70, 64, { ...SCROLL, offset: 97 }).mat);
  screen2.rotation.x = Math.PI / 2;
  screen2.position.set(78, Y0 + 48.45, 6);
  root.add(named(screen, 'screens'), named(screen2, 'screens'));
  const sheets = new Mesh(sheetsGeometry(), sheetMaterial(shared));
  sheets.renderOrder = 2;
  const steam = new Mesh(steamGeometry(ctx.steam), steamMaterial(shared));
  steam.frustumCulled = false;
  steam.renderOrder = 3;
  root.add(named(sheets, 'sheets'), named(steam, 'steam'));
  progress(0.75);

  // the TRELLIS crowd, colour-ramped to the ink (two tones per model, one instanced draw each); scenery only
  const HUES = { skin: 0xc9a58a, red: 0xa23a28, blue: 0x5d7f9e, green: 0x3e5a4a };
  const DARK = [0x1f2126, 0x2a2c31, 0x3b3f4a, 0x55585f, 0x6b6f78, 0x8a8f96];
  const LIGHT = [0x3a3630, 0x5a5448, 0x7a7262, 0x958c78, 0xafa590, 0xc6bea8];
  const person3 = (name: string, ramp: readonly number[]): Promise<BufferGeometry> => loadGlb(`/assets/nine-dragon/lab/${name}.glb`, { kind: 0, line: 0, ao: 0.6, ramp, hues: HUES });
  const [walkD, walkL, sitD, sitL] = await Promise.all([person3('walker', DARK), person3('walker', LIGHT), person3('sitter', DARK), person3('sitter', LIGHT)]);
  // dome B (crowd.ts `Crowd`): per-figure frustum culling + a distance LOD (a ~320-tri far copy past 35 m, none past
  // 130 m); its meshes start empty, so the InstanceCuller below leaves them alone
  const crowd = new Crowd(mat);
  crowd.add(walkD, ctx.walkers.filter((_, i) => i % 10 < 7 && i % 10 !== 2));
  crowd.add(walkL, ctx.walkers.filter((_, i) => i % 10 >= 7 && i % 10 !== 8));
  crowd.add(tintUmbrella(walkD, 0x9a2e1c), ctx.walkers.filter((_, i) => i % 10 === 2));
  crowd.add(tintUmbrella(walkL, 0xb07a34), ctx.walkers.filter((_, i) => i % 10 === 8));
  crowd.add(sitD, ctx.sitters.filter((_, i) => i % 3 !== 1));
  crowd.add(sitL, ctx.sitters.filter((_, i) => i % 3 === 1));
  for (const im of crowd.meshes) root.add(named(im, 'crowd'));
  atlas.finish();

  // the light pools (lab P6): baked from every emitter + lit window into the shared uniforms. The window glow and the
  // LUT belong to the clean room's post, so they get stand-in uniforms here (the engine's composer draws the frame)
  const light = installLight({
    u: shared.u, pipe: { glow: glowUniforms(), grade: gradeUniforms() }, lanterns: paper.emitters, ctxEmitters: ctx.emitters,
    signs: [...neonSigns.emitters, ...signs.lights], windows: ctx.fd.windows,
  });
  await light.ready;
  progress(1);

  // the world-wide instanced batches (the facade dressing, the lanterns, the crowd, the instanced dressing: bounding
  // spheres past CULL_R, which three's per-object test never drops) are culled per instance against the view; the
  // facade's small clutter also past 85 m, where its shader has shrunk it into the wall (clutterFar above)
  const culler = new InstanceCuller();
  const small = new Set<Object3D>(facade.small);
  const isBatch = (o: Object3D): o is InstancedMesh => o instanceof InstancedMesh;
  root.traverse((o) => {
    // (a batch that culls itself — the crowd, the lanterns' near / far buckets — is never culled as a whole)
    if (!isBatch(o) || !o.frustumCulled) return;
    if (o.boundingSphere === null) o.computeBoundingSphere();
    if ((o.boundingSphere?.radius ?? 0) < CULL_R) return;
    culler.add(o, small.has(o) ? 85 : Number.POSITIVE_INFINITY);
  });
  for (const [mesh, far] of farKits) culler.addFar(mesh, far);

  const update = (t: number, camera: PerspectiveCamera): void => {
    shared.u.uTime.value = t;
    shared.u.uNear.value = camera.near;
    shared.u.uCam.value.setFromMatrixPosition(camera.matrixWorld);
    train.position.set(-100 + ((t * 16) % 300), Y0 + 25.5, -27);
    const gx = CABLE.x0 + 5 + (CABLE.x1 - CABLE.x0 - 10) * (0.5 + 0.5 * Math.sin(t * 0.12 - 0.62));
    gondola.position.set(gx, CABLE.y + ((gx - CABLE.x0) / (CABLE.x1 - CABLE.x0)) * 0.8, CABLE.z);
    for (const d of drones) {
      const a = t * 0.045 + d.phase;
      d.body.position.set(8 + Math.cos(a) * d.r, d.y + Math.sin(t * 0.3 + d.phase) * 1.5, -8 + Math.sin(a) * d.r);
      d.body.rotation.y = -a;
    }
  };
  const cull = (camera: PerspectiveCamera): void => {
    culler.update(camera);
    crowd.update(camera);
  };
  return { root, shared, ctx, update, cull, culler };
}

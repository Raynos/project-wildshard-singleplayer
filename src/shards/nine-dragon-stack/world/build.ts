// The Nine Dragon Stack fragment's world (P0-5c), built for the engine: Lantern Square at +125 m, the Well's rim and its
// upper galleries, the stair-street stub and the towers round them — what the clean room built in its page
// (the dev labs (deleted in E357 F7)), without its camera, player, HUD, viewmodel or post. Everything is added under one
// Group; `update(t, camera)` drives the shared uniforms (time, the eye for the materials' baked silk fog) and the
// movers. The look (materials, signs, neon, streaks, light) is look/'s; this file only assembles it.
// (E306 / E315 M4) Every reusable thing in it is a model (../models/: the facade's pieces, the square's lions and sets,
// the crowd, the paper lanterns, the Fei Zhua hook, the wall kit, the movers), placed through `place` under the root;
// the instanced ones are handed to the fragment's own cullers (world/cull.ts, crowd.ts `Crowd`, look/lanterns.ts
// `Lanterns`). The kits — the square, the towers, the Well's bands — are the fragment's built fabric (world).
import {
  BufferGeometry, Color, Float32BufferAttribute, Group, type Matrix4, Mesh, type Object3D, type PerspectiveCamera, PlaneGeometry, Quaternion,
  SphereGeometry, Uint32BufferAttribute, Vector3, Vector4,
} from 'three';
import { Ctx, type Piece } from './ctx';
import { Kit } from './kit';
import { brassDragonHook, drumStool, inkFigure, mahjongTableModel, parkedScooter } from '../models/inKit';
import { paifang } from '../models/paifang';
import { banyan, earthGodShrine, kowloonSteleModel } from '../models/banyan';
import { hawkerStallModel, noodleStallModel } from '../models/stalls';
import { registerSigns } from '../models/signs';
import { placeRegionSets } from './sets';
import { lotusFinial } from '../models/lotusFinial';
import { laundryLineModel } from '../models/laundry';
import { landingPlanterModel } from '../models/landingPlanter';
import { wellBalustrade } from '../models/wellBalustrade';
import { lampPostModel, lotusPostModel } from '../models/bridgePosts';
import { type InKitPlaced, registerInKit } from './inKit';
import { type Emitter, bakeSpill } from '../look/emitters';
import { GlyphAtlas } from '../look/glyphs';
import { Lanterns } from '../look/lanterns';
import { NeonSigns } from '../look/neonsigns';
import { buildStreaks, stairStreaks } from '../look/streaks';
import { buildFacade, nameDraws } from './facade/batch';
import { facadeUniforms } from '../look/facadeMaterial';
import { STAIR, WELL, Y0 } from '../layout';
import { FACE_N, FACE_S, FAR_X, FLIGHTS, LANDINGS, RISE, RUN, TOP_Y } from './stairstreet';
import { loadPaint } from '../look/paint';
import { SCROLL, loadScroll, scrollMaterial } from '../look/scroll';
import { installLight } from '../look/light/install';
import { glowUniforms } from '../look/light/glow';
import { gradeUniforms } from '../look/light/grade';
import { Crowd, dealCrowd } from './crowd';
import { banyanOut } from './banyan';
import { buildCanopy } from './canopy';
import { placeSquareProps } from './squareProps';
import { SignAtlas, SignBuilder } from '../look/signs';
import { buildSquare } from './square';
import { Shared, jiehuaMaterial, neonMaterial, sheetMaterial, skyMaterial, steamMaterial } from '../look/style';
import { buildTowers } from './towers';
import { WORDS } from './words';
import { chars } from '../util';
import type { NdTier } from '../tier';
import { resourceScope } from '@wildshard/engine/app/resources';
import { gpuOnlyAttributes } from '@wildshard/engine/core/gpuOnly';
import { Rng } from '@wildshard/engine/core/rng';
import type { ModelDef, Placement } from '@wildshard/engine/models/model';
import { type HandedBatch, type InstancedCuller, type Placed, place } from '@wildshard/engine/models/place';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { ndModelContext } from './modelLook';
import { paperLantern } from '../models/paperLantern';
import { airConBox, galleryPlant } from '../models/wallKit';
import { cableGondola, drone, monorailTrain } from '../models/movers';
import { buildPortals } from './portals';
import type { PortalSlot } from './portalRide';
import { feiZhuaAt, feiZhuaHook, loadFeiZhuaHook } from '../models/feiZhuaHook';
import { loadCrowd, mahjongSitter, sitterGeometry, umbrellaWalker, walkerGeometry } from '../models/crowd';
import { buildWell } from './well';
import { loadLayoutBake, restoreLayout } from './layoutBake';
import { buildEntryDecks } from './entries';
import { wellSheets } from './well-lower';
import { CABLE, SHAFT, WELL_RECTS } from './well-plan';
import { merge } from './hero/kitx';
import { type InstanceLevel, InstanceCuller } from './cull';
import { lodReady } from './lod';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';

/** an instanced batch whose bounding sphere is wider than this (m) is culled per instance */
const CULL_R = 40;

/** the wall kit's model per piece (ctx.put's pieces that are placed: models/wallKit.ts) */
const WALL_KIT: Readonly<Partial<Record<Piece, ModelDef<object>>>> = { plant: galleryPlant };

/** a placement from a copy's matrix (its translation is where it stands) */
const at = (m: Matrix4, color?: Color): Placement<object> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m, ...(color === undefined ? {} : { color }) });

const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

/** the sign faces are drawn into canvases: their fonts must be in before the atlas is (9 s cap, then system fallbacks) */
async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, FONT_CHARS)));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { resourceScope().timeout(9000, resolve); })]);
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
  readonly ctx: { readonly hooks: readonly Vector3[] };
  /** per frame: time (s) and the camera the frame is drawn from */
  update: (t: number, camera: PerspectiveCamera) => void;
  /**
   * per frame, with the camera as it is drawn (the render hook's `frame`, after the updaters and the late hooks): the
   * world-wide instanced batches culled per instance (world/cull.ts) and the crowd's figures picked (crowd.ts)
   */
  cull: (camera: PerspectiveCamera) => void;
  /** the per-instance culling (its `stats` for the budget ruler) */
  readonly culler: InstanceCuller;
  /** G200: whether the decks' open ends are closed by their standalone balustrades (world/entries.ts; the colliders follow) */
  readonly entryCaps?: boolean;
  /** G224: the portals' ride step (world/portalRide.ts sets it in play), run by `update` with the frame's dt */
  readonly portal?: PortalSlot;
}

/** build the fragment's world; `progress(0..1)` as it goes */
export async function buildNineDragonWorld(renderer: Renderer, progress: (f: number, detail?: string) => void, tier: NdTier, opts: { caps?: boolean } = {}): Promise<NineDragonWorld> {
  const shared = new Shared();
  const root = new Group();
  root.name = 'nine-dragon-stack';
  const phaseProfile: { name: string; ms: number }[] = [];
  const phaseDone = (name: string, start: number): void => { phaseProfile.push({ name, ms: Math.round(performance.now() - start) }); };
  progress(0, 'paint + fonts');
  const layoutReady = loadLayoutBake();
  const paintStart = performance.now();
  const paintReady = loadPaint('/assets/nine-dragon/paint', Math.min(8, renderer.capabilities.getMaxAnisotropy()), tier, (f) => { progress(f * 0.15, 'paint + fonts'); })
    .then((paint) => { phaseDone('paint', paintStart); return paint; });
  const fontsStart = performance.now();
  const fontsReady = loadFonts().then(() => { phaseDone('fonts', fontsStart); return undefined; });
  const [paint] = await Promise.all([paintReady, fontsReady]);
  shared.u.uPaint.value = paint.tex;
  progress(0.15, 'layout: square');

  // ── the layout: the square, the towers, the Well ──
  const atlas = new SignAtlas(tier);
  const signs = new SignBuilder(atlas);
  const glyphs = new GlyphAtlas(chars(FONT_CHARS), tier);
  const neonSigns = new NeonSigns(shared, glyphs);
  signs.calligraphy = neonSigns;
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
  shared.u.uShaftK.value.y = Y0;
  const ctx = new Ctx(signs);
  // the models' context (world/modelLook.ts): the look fills in as each phase makes its part
  const nd = ndModelContext(renderer);
  nd.look.calligraphy = neonSigns;
  // the fragment's instanced models are culled per copy here (world/cull.ts), taken as `place` hands them over and set up
  // at the end, once the world is whole
  const culler = new InstanceCuller();
  const handed: HandedBatch[] = [];
  const batches: InstancedCuller = { take: (b) => { handed.push(b); } };
  // G285: the layout's offline bake (../generators/layout.ts, world/layoutBake.ts); the builders run live only without it
  const layout = await layoutReady;
  if (layout !== null) {
    progress(0.2, 'layout: baked');
    restoreLayout(layout, ctx);
  } else {
    buildSquare(ctx);
    progress(0.2, 'layout: towers');
    await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
    buildTowers(ctx);
    progress(0.25, 'layout: well');
    await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
    buildWell(ctx);
  }
  // SF51-g: the four landing decks at road height (world/entries.ts), each with its portal to the square (G224)
  // G200: played alone (no road beyond the decks) each deck's open end gets its balustrade and brazier
  const entryCaps = opts.caps === true;
  buildEntryDecks(ctx, entryCaps);
  const portals = buildPortals(ctx, shared);
  root.add(portals.root);
  progress(0.3, 'signs');
  await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
  // the facade grammar's sign slots, filled with real calligraphy (SDF neon for blades, lightboxes for flat ones)
  const slotRng = new Rng(4242);
  const bladesKit = ctx.kit('facade-signs');
  for (const s of ctx.fd.signs) {
    const word = slotRng.pick(WORDS);
    const color = `#${s.color.toString(16).padStart(6, '0')}`;
    const size = Math.min(s.size, s.blade ? 1.2 : 0.8);
    ctx.signs.place({ at: s.at, normal: s.normal, size, spec: { text: word, color, vertical: s.blade, style: s.blade || slotRng.chance(0.5) ? 'tube' : 'box' }, blade: s.blade }, s.blade ? null : bladesKit);
  }
  progress(0.4, 'geometry conversion');

  // ── the kits into meshes: one merged geometry per kit, the neon spill baked into their vertices ──
  // (which kit each Kit object is: the models drawn into the kits name theirs by object, a folded kit's parts by its fold)
  const kitName = new Map<Kit, string>();
  for (const [name, k] of ctx.kits) {
    kitName.set(k, name);
    if ('extra' in k && Array.isArray(k.extra)) for (const e of k.extra) if (e instanceof Kit) kitName.set(e, name);
  }
  const mat = jiehuaMaterial(shared);
  const matA = jiehuaMaterial(shared, { alphaCut: true });
  const paper = new Lanterns(shared);
  nd.look.mat = mat;
  nd.look.lantern = paper.material;
  const tmpP = new Vector3(), tmpQ = new Quaternion(), tmpS = new Vector3();
  for (const m of ctx.lanterns) { m.decompose(tmpP, tmpQ, tmpS); paper.hang(tmpP.clone(), tmpS.x); }
  const emitters: Emitter[] = [...neonSigns.emitters, ...signs.lights, ...paper.emitters, ...ctx.emitters];
  // every mesh is named by what built it (`kit:<name>`, `facade`, `crowd`, …): the budget ruler sorts them into lanes
  const named = <T extends Object3D>(o: T, name: string): T => { o.name = name; return o; };
  const kitGeos: [string, BufferGeometry][] = [];
  const kitProfile: { name: string; ms: number; vertices: number }[] = [];
  const processed = new Set<string>();
  const kitTotal = ctx.kits.size + ctx.kitxs.size + ctx.alphaKits.size;
  let kitsDone = 0;
  let lastYield = performance.now();
  const converted = async (): Promise<void> => {
    kitsDone++;
    progress(0.4 + 0.12 * kitsDone / Math.max(1, kitTotal), `geometry ${kitsDone}/${kitTotal}`);
    if (performance.now() - lastYield < 30) return;
    await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
    lastYield = performance.now();
  };
  for (const [name, kit] of ctx.kits) {
    progress(0.4 + 0.12 * kitsDone / Math.max(1, kitTotal), `geometry ${kitsDone + 1}/${kitTotal}: ${name}`);
    const tKit = performance.now();
    const kx = ctx.kitxs.get(name);
    if (kx !== undefined && kx.vertexCount > 0) kitGeos.push([name, kit.vertexCount > 0 ? merge([kit.build(), kx.build()]) : kx.build()]);
    else if (kit.vertexCount > 0) kitGeos.push([name, kit.build()]);
    processed.add(name);
    kitProfile.push({ name, ms: Math.round(performance.now() - tKit), vertices: kit.vertexCount + (kx?.vertexCount ?? 0) });
    kit.release();
    kx?.release();
    ctx.kits.delete(name);
    ctx.kitxs.delete(name);
    await converted();
  }
  for (const [name, kx] of ctx.kitxs) {
    progress(0.4 + 0.12 * kitsDone / Math.max(1, kitTotal), `geometry ${kitsDone + 1}/${kitTotal}: ${name}`);
    const tKit = performance.now();
    if (!processed.has(name) && kx.vertexCount > 0) kitGeos.push([name, kx.build()]);
    kitProfile.push({ name, ms: Math.round(performance.now() - tKit), vertices: kx.vertexCount });
    kx.release();
    ctx.kitxs.delete(name);
    await converted();
  }
  const alphaGeos: [string, BufferGeometry][] = [];
  for (const [name, kit] of ctx.alphaKits) {
    progress(0.4 + 0.12 * kitsDone / Math.max(1, kitTotal), `geometry ${kitsDone + 1}/${kitTotal}: ${name}`);
    const tKit = performance.now();
    if (kit.vertexCount > 0) alphaGeos.push([name, kit.build()]);
    kitProfile.push({ name, ms: Math.round(performance.now() - tKit), vertices: kit.vertexCount });
    kit.release();
    ctx.alphaKits.delete(name);
    await converted();
  }
  // Each Kit/KitX still owns its large JS number[] buffers after build() copies them into typed geometry.
  // No later phase reads the builders; release them before the facade and texture uploads add to the peak.
  ctx.kits.clear();
  ctx.kitxs.clear();
  ctx.alphaKits.clear();
  Reflect.set(window, '__ndKitProfile', kitProfile);
  await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); }); // let the loading panel paint and GC run
  progress(0.52, 'neon spill + canopy');
  let phaseStart = performance.now();
  await bakeSpill(kitGeos.map(([, g]) => g), emitters);
  phaseDone('neon spill', phaseStart);
  phaseStart = performance.now();
  const crown = await buildCanopy(shared, banyanOut.plan?.lumps ?? [], emitters);
  for (const m of crown) { gpuOnlyAttributes(m.geometry, STATIC_GEOMETRY); root.add(named(m, 'canopy')); }
  // (the banyan model's specimen wears the same crown, models/banyan.ts)
  const [core, cards, depth] = crown.map((m) => (Array.isArray(m.material) ? undefined : m.material));
  if (core !== undefined && cards !== undefined && depth !== undefined) nd.look.canopy = { core, cards, depth };
  phaseDone('canopy', phaseStart);
  phaseStart = performance.now();
  // (E283, Jake's pick) the distance LODs are the models' own (models/: meshoptimizer copies of the sculpts, their error
  // under SCULPT_PX px where each starts, world/lod.ts; the facade dressing's and the balustrade's thin parts dropped where
  // they are ~half a pixel wide), handed to the culler with their batches
  const canLod = await lodReady();
  nd.look.canLod = canLod;
  const squareSets = await placeSquareProps({ ctx: nd.ctx, look: nd.look, culler: batches, root });
  phaseDone('square props', phaseStart);
  // (a kit with a draw distance, ctx.far(name, m), is shown / hidden by the culler below)
  const farKits: [Mesh, number][] = [];
  const kitMeshes = new Map<string, Mesh>();
  const kitMesh = (name: string, g: BufferGeometry, m: typeof mat): void => {
    // (E264: the kits are ~100 MB of vertex data at the phone's World Explorer peak; nothing rewrites them after the build)
    gpuOnlyAttributes(g, STATIC_GEOMETRY);
    const mesh = named(new Mesh(g, m), `kit:${name}`);
    root.add(mesh);
    if (m === mat) kitMeshes.set(name, mesh);
    const far = ctx.farOf.get(name);
    if (far !== undefined) farKits.push([mesh, far]);
  };
  for (const [name, g] of kitGeos) kitMesh(name, g, mat);
  for (const [name, g] of alphaGeos) kitMesh(name, g, matA);
  // the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and
  // brush-drawn figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts)
  // registered on their kits' meshes
  const meshOfKit = (k: Kit): Mesh | undefined => kitMeshes.get(kitName.get(k) ?? '');
  const IN_KIT = new Set([brassDragonHook.id, drumStool.id, parkedScooter.id, mahjongTableModel.id, inkFigure.id, paifang.id, banyan.id, earthGodShrine.id, kowloonSteleModel.id, noodleStallModel.id, hawkerStallModel.id, lotusFinial.id, laundryLineModel.id, landingPlanterModel.id, wellBalustrade.id, lotusPostModel.id, lampPostModel.id]);
  const inKit = ctx.inKit.filter((c) => !IN_KIT.has(c.model));
  if (inKit.length > 0) throw new Error(`nine-dragon: '${inKit[0]?.model}' is drawn into a kit but is no model here (world/build.ts)`);
  const inKitPlaced: InKitPlaced[] = [
    ...registerInKit(nd.ctx, ctx.inKit, brassDragonHook, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, drumStool, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, parkedScooter, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, mahjongTableModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, inkFigure, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, paifang, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, banyan, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, earthGodShrine, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, kowloonSteleModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, noodleStallModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, hawkerStallModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, lotusFinial, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, laundryLineModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, landingPlanterModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, wellBalustrade, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, lotusPostModel, meshOfKit),
    ...registerInKit(nd.ctx, ctx.inKit, lampPostModel, meshOfKit),
  ];
  const lanterns = place(paperLantern, paper.placements(), { ctx: nd.ctx, draw: 'instanced', culler: paper, parent: root, piece: { id: 'nds-lanterns' } });
  lanterns.object.name = 'lanterns';
  progress(0.56, 'facade batches');
  phaseStart = performance.now();
  // E271/E272: facade instancing on every platform; multi-draw was removed after physical iOS memory kills.
  // Permanent evidence: docs/audits/nine-dragon-mobile-multidraw.md.
  const facade = await buildFacade(ctx.fd, facadeUniforms(shared), { ctx: nd.ctx, look: nd.look, culler: batches }, { clutterFar: [55, 85] });
  phaseDone('facade', phaseStart);
  const isMesh = (o: Object3D | undefined): o is Mesh => o instanceof Mesh;
  const shell = facade.group.getObjectByName('facade-shell');
  if (isMesh(shell)) gpuOnlyAttributes(shell.geometry, STATIC_GEOMETRY);
  root.add(named(facade.group, 'facade'));
  const neonMeshes = neonSigns.build();
  root.add(named(neonMeshes.boards, 'neon'), named(neonMeshes.tubes, 'neon'));
  progress(0.6, 'streaks + dressing');
  phaseStart = performance.now();

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

  // the wall kit: one InstancedMesh per piece and region (models/wallKit.ts)
  const wellKit: Placed[] = [];
  for (const [key, list] of ctx.inst) {
    const piece = key.slice(0, key.indexOf('@')) as Piece;
    const model = WALL_KIT[piece];
    if (model === undefined) throw new Error(`nine-dragon: the wall kit's '${piece}' is no model yet (models/wallKit.ts)`);
    const placed = place(model, list.map((it) => at(it.m, it.c)), { ctx: nd.ctx, draw: 'instanced', culler: batches, parent: root, piece: { id: `nds-inst-${key}` } });
    nameDraws(placed, `inst:${key}`);
    if (!key.endsWith('@town')) wellKit.push(placed);
  }
  // the fragment's named places as Sets (../places.ts, world/sets.ts): what each region's kits carry
  placeRegionSets(inKitPlaced, { ...squareSets, well: wellKit });
  if (ctx.acs.length > 0) nameDraws(place(airConBox, ctx.acs.map((m) => at(m)), { ctx: nd.ctx, draw: 'instanced', culler: batches, parent: root, piece: { id: 'nds-inst-ac' } }), 'inst:ac');

  // movers: the train, the gondola, the drones (models/movers.ts), each placed where the update puts it at t = 0
  const neon = neonMaterial(shared, atlas.textures);
  nd.look.neon = { mat: neon, atlas };
  /** a mover's copies (one object each: the world moves them), named for the budget lanes */
  const movers = (model: ModelDef<object>, pls: readonly Placement<object>[], id: string): Object3D[] => {
    const placed = place(model, pls, { ctx: nd.ctx, draw: 'single', parent: root, piece: { id } });
    const copies = pls.length === 1 ? [placed.object] : [...placed.object.children];
    named(placed.object, 'movers');
    for (const o of copies) named(o, 'movers');
    return copies;
  };
  const one = (list: readonly Object3D[]): Object3D => list[0] ?? new Group();
  const gx0 = CABLE.x0 + 5 + (CABLE.x1 - CABLE.x0 - 10) * (0.5 + 0.5 * Math.sin(-0.62));
  const train = one(movers(monorailTrain, [{ x: -100, y: Y0 + 25.5, z: -27 }], 'nds-train'));
  const gondola = one(movers(cableGondola, [{ x: gx0, y: CABLE.y + ((gx0 - CABLE.x0) / (CABLE.x1 - CABLE.x0)) * 0.8, z: CABLE.z }], 'nds-gondola'));
  const droneAt = [0, 1].map((i) => ({ phase: i * 2.4, r: 22 + i * 14, y: Y0 + 58 + i * 16 }));
  const bodies = movers(drone, droneAt.map((d) => ({ x: 8 + Math.cos(d.phase) * d.r, y: d.y + Math.sin(d.phase) * 1.5, z: -8 + Math.sin(d.phase) * d.r, yaw: -d.phase })), 'nds-drones');
  const drones = droneAt.flatMap((d, i) => { const body = bodies[i]; return body === undefined ? [] : [{ body, ...d }]; });
  const signsMesh = named(new Mesh(signs.build(), neon), 'signs');
  root.add(signsMesh);
  // every sign hung is a copy of the sign model (models/signs.ts), registered where it is drawn
  registerSigns(nd.ctx, signs.placed, { atlas: signsMesh, neon: neonMeshes.boards });

  // the painted sky, the LED sky screens (lab P7's 千里江山图 scroll), the Well's silk sheets, the stall's steam
  const sky = new Mesh(new SphereGeometry(900, 32, 16), skyMaterial(shared));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(named(sky, 'sky'));
  const scrollTex = await loadScroll('/assets/nine-dragon/lab/organic/scroll.webp');
  const screen = new Mesh(new PlaneGeometry(58, 80), scrollMaterial(shared, scrollTex, 58, 80, SCROLL).mat);
  screen.rotation.x = Math.PI / 2;
  screen.position.set(1, Y0 + 29.85, -64);
  // (the stair-street's own screen over x 43…113 at +173 is gone: from the square and landing 1 it was a flat teal
  // ceiling over the stair paifang, where every C target paints blue-hour sky; E281 stair pass 3's experiment)
  root.add(named(screen, 'screens'));
  const sheets = new Mesh(sheetsGeometry(), sheetMaterial(shared));
  sheets.renderOrder = 2;
  const steam = new Mesh(steamGeometry(ctx.steam), steamMaterial(shared));
  steam.frustumCulled = false;
  steam.renderOrder = 3;
  root.add(named(sheets, 'sheets'), named(steam, 'steam'));
  progress(0.75, 'crowd models');
  phaseDone('streaks + dressing', phaseStart);

  // the TRELLIS crowd (models/crowd.ts: the casts in their ramps and dyes), dealt to its colourways (crowd.ts `dealCrowd`)
  await loadCrowd(nd.look);
  phaseStart = performance.now();
  // The lab's 18k-triangle cast-brass dragon has a production placement at three close Well hooks (models/feiZhuaHook.ts).
  // One instanced draw keeps it within the phone budget; the underlying procedural brackets and collision-free ring
  // anchors stay.
  await loadFeiZhuaHook(nd.look);
  if (nd.look.hookMat !== null) {
    const mounts = ctx.hookMounts.filter((m) => m.ring.y > Y0 - 23 && m.ring.y < Y0 + 14)
      .sort((a, b) => a.ring.distanceToSquared(new Vector3(-16, Y0 - 2, -24)) - b.ring.distanceToSquared(new Vector3(-16, Y0 - 2, -24)))
      .slice(0, 3);
    if (mounts.length > 0) nameDraws(place(feiZhuaHook, mounts.map(({ ring, out }) => at(feiZhuaAt(ring, out))), { ctx: nd.ctx, draw: 'instanced', culler: batches, parent: root, piece: { id: 'nds-fei-zhua-hooks' } }), 'glb:dragon-hook');
  }
  // dome B (crowd.ts `Crowd`): per-figure frustum culling + a distance LOD (the E283 middle copies, a ~320-tri far copy
  // past 35 m, none past 130 m); its meshes start empty, so the batch culler leaves them alone
  const crowd = new Crowd();
  const dealt = dealCrowd(ctx.walkers, ctx.sitters, { walker: (k) => walkerGeometry(nd.ctx, k), sitter: (k) => sitterGeometry(nd.ctx, k) });
  if (dealt.walkers.length > 0) place(umbrellaWalker, dealt.walkers.flatMap(([pick, mats]) => mats.map((m) => ({ ...at(m), variant: pick }))), { ctx: nd.ctx, draw: 'instanced', culler: crowd, parent: root, piece: { id: 'nds-crowd-walkers' } }).object.name = 'crowd';
  if (dealt.sitters.length > 0) place(mahjongSitter, dealt.sitters.flatMap(([pick, mats]) => mats.map((m) => ({ ...at(m), variant: pick }))), { ctx: nd.ctx, draw: 'instanced', culler: crowd, parent: root, piece: { id: 'nds-crowd-sitters' } }).object.name = 'crowd';
  atlas.finish();
  phaseDone('crowd + atlas', phaseStart);

  // the light pools (lab P6): baked from every emitter + lit window into the shared uniforms. The window glow and the
  // LUT belong to the clean room's post, so they get stand-in uniforms here (the engine's composer draws the frame)
  progress(0.9, 'light volume');
  const light = installLight({
    u: shared.u, pipe: { glow: glowUniforms(), grade: gradeUniforms() }, lanterns: paper.emitters, ctxEmitters: ctx.emitters,
    signs: [...neonSigns.emitters, ...signs.lights], windows: ctx.fd.windows,
  });
  await light.ready;
  progress(0.95, 'culling');

  // the world-wide instanced batches (the facade dressing, the wall kit, the square's props: bounding spheres past CULL_R,
  // which three's per-object test never drops) are culled per instance against the view; the facade's small clutter also
  // past 85 m, where its shader has shrunk it into the wall (its `cull.far`). A batch with a distance LOD is taken
  // whatever its size (the culler deals its instances out to the copies); one without, within CULL_R, three culls whole.
  // (The crowd and the paper lanterns cull themselves; the facade's windows are drawn whole — E283: packing and
  // re-uploading the ~4 k one-quad windows in view cost more than drawing all ~10 k.)
  for (const b of handed) {
    const base = b.levels[0]?.mesh ?? null;
    if (base === null || !base.frustumCulled) continue;
    // (a sculpt's LOD without the simplifier is its full geometry: left out, as before)
    const lods: InstanceLevel[] = b.levels.slice(1).flatMap((l) => (l.mesh !== null && l.mesh.geometry !== base.geometry ? [{ mesh: l.mesh, from: l.from }] : []));
    if (base.boundingSphere === null) base.computeBoundingSphere();
    if ((base.boundingSphere?.radius ?? 0) < CULL_R && lods.length === 0) continue;
    culler.add(base, b.cull.far ?? Number.POSITIVE_INFINITY, lods);
  }
  for (const [mesh, far] of farKits) culler.addFar(mesh, far);
  progress(1, 'world ready');
  Reflect.set(window, '__ndPhaseProfile', phaseProfile);

  let lastT = -1;
  const portal: PortalSlot = { step: null };
  const update = (t: number, camera: PerspectiveCamera): void => {
    if (lastT >= 0) portal.step?.(Math.max(0, t - lastT));
    lastT = t;
    shared.u.uTime.value = t;
    shared.u.uNear.value = camera.near;
    shared.u.uCam.value.setFromMatrixPosition(camera.matrixWorld);
    shared.bandWindow();
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
  // The playable world only needs hook points from the build context. Retaining the full Ctx kept its
  // facade grammar, instance placement lists and atlas canvases alive alongside the finished meshes.
  return { root, shared, ctx: { hooks: ctx.hooks }, update, cull, culler, entryCaps, portal };
}

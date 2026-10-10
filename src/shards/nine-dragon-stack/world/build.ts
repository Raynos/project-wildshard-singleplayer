// The Nine Dragon Stack fragment's world (P0-5c), built for the engine: Lantern Square at +125 m, the Well's rim and its
// upper galleries, the stair-street stub and the towers round them — what the clean room built in its page
// (the dev labs (deleted in E357 F7)), without its camera, player, HUD, viewmodel or post. Everything is added under one
// Group; `update(t, camera)` drives the shared uniforms (time, the eye for the materials' baked silk fog) and the
// movers. The look (materials, signs, neon, streaks, light) is look/'s; this file only assembles it.
// (E306 / E315 M4) Every reusable thing in it is a model (../models/: the facade's pieces, the square's lions and sets,
// the crowd, the paper lanterns, the Fei Zhua hook, the wall kit, the movers), placed through `place` under the root;
// the instanced ones are handed to the fragment's own cullers (the SDK's instance culler and figure crowd, look/lanterns.ts
// `Lanterns`). The kits — the square, the towers, the Well's bands — are the fragment's built fabric (world).
import {
  Color, Group, type Matrix4, Mesh, type Object3D, type PerspectiveCamera, PlaneGeometry, Quaternion, SphereGeometry, Vector3, Vector4,
} from 'three';
import { Ctx, type InKit, type Piece } from './ctx';
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
import { type Emitter, bakeSpill } from '@wildshard/sdk/looks/vertexSpill';
import { GlyphField, NeonText } from '@wildshard/sdk/looks/neonText';
import { Lanterns } from '../look/lanterns';
import { buildStreaks, stairStreaks } from '../look/streaks';
import { buildFacade, nameDraws } from './facade/batch';
import { facadeUniforms } from '../look/facadeMaterial';
import { STAIR, WELL, Y0 } from '../layout';
import { FACE_N, FACE_S, FAR_X, FLIGHTS, LANDINGS, RISE, RUN, TOP_Y } from './stairPlan';
import { loadPaint } from '../look/paint';
import { SCROLL, loadScroll, scrollMaterial } from '../look/scroll';
import { installLight } from '../look/light/install';
import { glowUniforms } from '../look/light/glow';
import { gradeUniforms } from '../look/light/grade';
import { dealCrowd } from './crowd';
import { FigureCrowd } from '@wildshard/sdk/cull/figureCrowd';
import { CROWD_LEVELS } from '../data/lod';
import { buildCanopy } from './canopy';
import { placeSquareProps } from './squareProps';
import { SignAtlas, SignBuilder } from '@wildshard/sdk/looks/signs';
import { KitSigns } from '../look/signs';
import { KAI_STACK, NEON_LOOK, SIGN_COLOUR, SIGN_STYLES, type SignStyle } from '../data/signs';
import { ADD_KEEP_ALPHA, EMIT_FOG, FOG_GLSL, NOISE_GLSL, Shared, jiehuaMaterial, neonMaterial, sheetMaterial, skyMaterial, steamMaterial } from '../look/style';
import { WORDS } from './words';
import { chars } from '../util';
import { glyphLayout, signLayout, type NdTier } from '../tier';
import { resourceScope } from '@wildshard/engine/app/resources';
import { gpuOnlyAttributes } from '@wildshard/engine/core/gpuOnly';
import { Rng } from '@wildshard/engine/core/rng';
import type { ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
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
import { loadLayoutBake, restoreLayout } from './layoutBake';
import { loadSpecimens } from './specimens';
import { buildEntryDecks } from './entries';
import { CABLE, SHAFT, WELL_RECTS, wellSheets } from './wellBounds';
import { merge } from './hero/kitx';
import { type InstanceCullerView, InstanceCuller } from '@wildshard/sdk/cull/instanceCuller';
import { cullHandedBatches } from '@wildshard/sdk/cull/handedBatches';
import { convertKits } from '@wildshard/sdk/kit/kitConvert';
import { waitForFonts } from '@wildshard/sdk/looks/fontWait';
import { mistSheetsGeometry, steamPuffsGeometry } from '@wildshard/sdk/looks/mistGeometry';
import { type MoverPath, moveAlong } from '@wildshard/sdk/props/pathMovers';
import { type RunningMover, placeMovers } from '@wildshard/sdk/props/moverCopies';
import { FONT_LOAD, KIT_YIELD_MS, MOVERS, SHEET_LAYERS, STEAM_PUFFS } from '../data/worldDressing';
import { lodReady } from '@wildshard/sdk/cull/meshLod';
import { addKitMeshes } from '@wildshard/sdk/kit/kitMeshes';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';

/** an instanced batch whose bounding sphere is wider than this (m) is culled per instance */
const CULL_R = 40;

/** the wall kit's model per piece (ctx.put's pieces that are placed: models/wallKit.ts) */
const WALL_KIT: Readonly<Partial<Record<Piece, ModelDef<object>>>> = { plant: galleryPlant };

/** the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and brush-drawn
 *  figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts), registered on
 *  their kits' meshes in this order */
/** one model drawn into the kits: its id, and its copies registered on their kits' meshes */
interface InKitModel { readonly id: string; readonly register: (nd: ModelContext, copies: readonly InKit[], meshOf: (k: Kit) => Mesh | undefined) => InKitPlaced[] }
const inKitModel = <P extends object>(model: ModelDef<P>): InKitModel => ({ id: model.id, register: (nd, copies, meshOf) => registerInKit(nd, copies, model, meshOf) });
const IN_KIT: readonly InKitModel[] = [
  inKitModel(brassDragonHook), inKitModel(drumStool), inKitModel(parkedScooter), inKitModel(mahjongTableModel), inKitModel(inkFigure), inKitModel(paifang), inKitModel(banyan), inKitModel(earthGodShrine),
  inKitModel(kowloonSteleModel), inKitModel(noodleStallModel), inKitModel(hawkerStallModel), inKitModel(lotusFinial), inKitModel(laundryLineModel), inKitModel(landingPlanterModel), inKitModel(wellBalustrade), inKitModel(lotusPostModel), inKitModel(lampPostModel),
];

/** a placement from a copy's matrix (its translation is where it stands) */
const at = (m: Matrix4, color?: Color): Placement<object> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m, ...(color === undefined ? {} : { color }) });

const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

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
   * world-wide instanced batches culled per instance (@wildshard/sdk/cull/instanceCuller) and the crowd's figures picked
   */
  cull: (camera: PerspectiveCamera) => void;
  /** the per-instance culling (its `stats` for the budget ruler) */
  readonly culler: InstanceCullerView;
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
  // G285: the code-built models' geometry and the canopy's (world/specimens.ts), fetched with the layout
  const specimensReady = loadSpecimens('boot');
  const paintStart = performance.now();
  const paintReady = loadPaint('/assets/nine-dragon/paint', Math.min(8, renderer.capabilities.getMaxAnisotropy()), tier, (f) => { progress(f * 0.15, 'paint + fonts'); })
    .then((paint) => { phaseDone('paint', paintStart); return paint; });
  const fontsStart = performance.now();
  const fontsReady = waitForFonts(FONT_LOAD.specs, FONT_CHARS, FONT_LOAD.capMs).then(() => { phaseDone('fonts', fontsStart); return undefined; });
  const [paint] = await Promise.all([paintReady, fontsReady]);
  shared.u.uPaint.value = paint.tex;
  progress(0.15, 'layout: square');

  // ── the layout: the square, the towers, the Well ──
  const atlas = new SignAtlas<SignStyle>(SIGN_STYLES, { ...signLayout(tier), ...SIGN_COLOUR[tier] }, 'Nine Dragon sign atlas (GPU only)');
  const signs = new SignBuilder(atlas);
  const glyphs = new GlyphField(chars(FONT_CHARS), glyphLayout(tier), KAI_STACK);
  // the neon is fogged by the clean room's banded silk (FOG_GLSL), emissive at half strength
  const neonSigns = new NeonText({ uniforms: shared.u, glsl: { noise: NOISE_GLSL, fog: `${FOG_GLSL}\n#define signFog(w) silkFog(w, 1.0)\n`, emitFog: EMIT_FOG }, blending: ADD_KEEP_ALPHA, look: NEON_LOOK }, glyphs);
  signs.calligraphy = neonSigns;
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
  shared.u.uShaftK.value.y = Y0;
  const ctx = new Ctx(new KitSigns(signs));
  // the models' context (world/modelLook.ts): the look fills in as each phase makes its part
  const nd = ndModelContext(renderer);
  nd.look.calligraphy = neonSigns;
  // the fragment's instanced models are culled per copy here (the SDK instance culler), taken as `place` hands them over and set up
  // at the end, once the world is whole
  const culler = new InstanceCuller();
  const handed: HandedBatch[] = [];
  const batches: InstancedCuller = { take: (b) => { handed.push(b); } };
  // G285: the layout (the square, the towers, the Well) is an offline bake (../generators/layout.ts, world/layoutBake.ts):
  // the page restores it and has no live builders to fall back on
  const layout = await layoutReady;
  const specimens = await specimensReady;
  nd.look.specimens = specimens;
  progress(0.2, 'layout: baked');
  restoreLayout(layout, ctx);
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
  const { solid: kitGeos, alpha: alphaGeos, profile: kitProfile } = await convertKits({ solid: ctx.kits, swept: ctx.kitxs, alpha: ctx.alphaKits }, merge, (done, total, name) => {
    progress(0.4 + 0.12 * done / Math.max(1, total), name === undefined ? `geometry ${done}/${total}` : `geometry ${done + 1}/${total}: ${name}`);
  }, KIT_YIELD_MS);
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
  const crown = await buildCanopy(shared, specimens.has('canopy:cards') ? { cards: specimens.take('canopy:cards'), core: specimens.take('canopy:core') } : null, emitters);
  for (const m of crown) { gpuOnlyAttributes(m.geometry, STATIC_GEOMETRY); root.add(named(m, 'canopy')); }
  // (the banyan model's specimen wears the same crown, models/banyan.ts)
  const [core, cards, depth] = crown.map((m) => (Array.isArray(m.material) ? undefined : m.material));
  if (core !== undefined && cards !== undefined && depth !== undefined) nd.look.canopy = { core, cards, depth };
  phaseDone('canopy', phaseStart);
  phaseStart = performance.now();
  // (E283, Jake's pick) the distance LODs are the models' own (models/: meshoptimizer copies of the sculpts, their error
  // under SCULPT_PX px where each starts, data/lod.ts; the facade dressing's and the balustrade's thin parts dropped where
  // they are ~half a pixel wide), handed to the culler with their batches
  const canLod = await lodReady();
  nd.look.canLod = canLod;
  const squareSets = await placeSquareProps({ ctx: nd.ctx, look: nd.look, culler: batches, root });
  phaseDone('square props', phaseStart);
  // (a kit with a draw distance, ctx.far(name, m), is shown / hidden by the culler below; E264: the kits are ~100 MB of
  // vertex data at the phone's World Explorer peak, GPU-only once built)
  const kits = addKitMeshes(root, { solid: kitGeos, alpha: alphaGeos }, { solid: mat, alpha: matA }, ctx.farOf, STATIC_GEOMETRY);
  // the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and
  // brush-drawn figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts)
  // registered on their kits' meshes
  const meshOfKit = (k: Kit): Mesh | undefined => kits.byName.get(kitName.get(k) ?? '');
  const inKit = ctx.inKit.filter((c) => !IN_KIT.some((m) => m.id === c.model));
  if (inKit.length > 0) throw new Error(`nine-dragon: '${inKit[0]?.model}' is drawn into a kit but is no model here (world/build.ts)`);
  const inKitPlaced: InKitPlaced[] = IN_KIT.flatMap((model) => model.register(nd.ctx, ctx.inKit, meshOfKit));
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
  const movers = (model: ModelDef<object>, paths: readonly MoverPath[], id: string): RunningMover[] => placeMovers(model, paths, { ctx: nd.ctx, parent: root, id, name: 'movers' });
  const running = [
    ...movers(monorailTrain, [{ kind: 'loop', ...MOVERS.train, y: Y0 + MOVERS.train.y }], 'nds-train'),
    ...movers(cableGondola, [{ kind: 'cable', ...CABLE, ...MOVERS.gondola }], 'nds-gondola'),
    ...movers(drone, MOVERS.drones.map((d): MoverPath => ({ kind: 'orbit', x: d.x, y: Y0 + d.y, z: d.z, r: d.r, rate: d.rate, phase: d.phase, bob: d.bob, bobRate: d.bobRate })), 'nds-drones'),
  ];
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
  const sheets = new Mesh(mistSheetsGeometry(wellSheets, WELL_RECTS, SHEET_LAYERS), sheetMaterial(shared));
  sheets.renderOrder = 2;
  const steam = new Mesh(steamPuffsGeometry(ctx.steam, STEAM_PUFFS.perPoint, STEAM_PUFFS.stride), steamMaterial(shared));
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
  // dome B (the SDK's figure crowd, data/lod.ts CROWD_LEVELS): per-figure frustum culling + a distance LOD (the E283 middle copies, a ~320-tri far copy
  // past 35 m, none past 130 m); its meshes start empty, so the batch culler leaves them alone
  const crowd = new FigureCrowd(CROWD_LEVELS);
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
  cullHandedBatches(culler, handed, CULL_R);
  for (const [mesh, far] of kits.far) culler.addFar(mesh, far);
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
    for (const m of running) moveAlong(m.body, m.path, t);
  };
  const cull = (camera: PerspectiveCamera): void => {
    culler.update(camera);
    crowd.update(camera);
  };
  // The playable world only needs hook points from the build context. Retaining the full Ctx kept its
  // facade grammar, instance placement lists and atlas canvases alive alongside the finished meshes.
  return { root, shared, ctx: { hooks: ctx.hooks }, update, cull, culler, entryCaps, portal };
}

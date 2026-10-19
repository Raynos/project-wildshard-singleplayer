import type { GeometryBoot } from '../runtime/productSections.generated';
import { fetchDeflatedBytes } from '@wildshard/engine/core/deflate';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { bindLowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
// The Nine Dragon Stack fragment's world (P0-5c), built for the engine: Lantern Square at +125 m, the Well's rim and its
// upper galleries, the stair-street stub and the towers round them — what the clean room built in its page
// (the dev labs (deleted in E357 F7)), without its camera, player, HUD, viewmodel or post. Everything is added under one
// Group; `update(t, camera)` drives the shared uniforms (time, the eye for the materials' baked silk fog) and the
// movers. The look (materials, signs, neon, streaks, light) is look/'s; this file only assembles it.
// (E306 / E315 M4) Every reusable thing in it is a model (../models/: the facade's pieces, the square's lions and sets,
// the crowd, the paper lanterns, the Fei Zhua hook, the wall kit, the movers), placed through `place` under the root;
// Model placement owns per-copy culling and distance LODs. The kits — the square, the towers, the Well's bands — are the fragment's built fabric (world).
import {
  Box3, ClampToEdgeWrapping, Data3DTexture, LinearFilter, Color, Group, Matrix4, Mesh, type Object3D, type PerspectiveCamera, PlaneGeometry, Quaternion, SphereGeometry, Vector3,
} from 'three';
import type { InKit, Piece } from './ctx';
import { inkFigure } from '../models/inKit';
import { FACADE_BAKED, FACADE_MODELS, brassDragonHook, drumStool, mahjongTableModel, parkedScooter, paifang, hawkerStallModel, noodleStallModel, lotusFinial, laundryLineModel, landingPlanterModel, wellBalustrade, lampPostModel, lotusPostModel, airConBox, galleryPlant } from '../models/catalogue';
import { banyan, earthGodShrine, kowloonSteleModel } from '../models/banyan';
import { registerSigns } from '../models/signs';
import { placeSet } from '@wildshard/engine/models/sets';
import { type DrawnPlaced as InKitPlaced, registerDrawnInto } from '../runtime/kit/drawnInto';
import { Lanterns } from '../look/lanterns';
import { createSceneBuffers } from '@wildshard/game/shardfile/sceneBuffers';
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';
import { namePlacedDraws as nameDraws } from '../runtime/cull/placedDraws';
import { jiehuaMaterial as facadeMaterial, windowMaterial, facadeUniforms, syncArchitecture } from '../look/facadeMaterial';
import { loadPaint } from '../look/paint';
import { loadTextureRow } from '@wildshard/engine/core/assets';
import metadata, { Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../boot/lookTypes.generated';
import { placeSquareProps } from './squareProps';
import { Shared, restoreWeave } from '../look/style';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';
import { gpuOnlyAttributes, gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import type { ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
import { type Placed, place, placeSliced } from '@wildshard/engine/models/place';
import { slicer } from '@wildshard/engine/boot/plan';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { ndModelContext, loadSpecimens, takeSpecimen } from './modelLook';
import { paperLantern } from '../models/paperLantern';
import { cableGondola, drone, monorailTrain } from '../models/movers';
import { buildPortals } from './portals';
import type { PortalSlot } from './portalRide';
import { feiZhuaAt, feiZhuaHook, loadFeiZhuaHook } from '../models/feiZhuaHook';
import { loadCrowd, mahjongSitter, umbrellaWalker } from '../models/crowd';
import { loadLayoutBake, restoreLayout } from './layoutBake';
import { loadCast, loadFixedRows, loadSignAtlas, loadSpill, loadFacadeWindows } from './casts';
import declarations from '../data/declarations.generated.json' with { type: 'json' };
import { type RunningMover, placeMovers } from '../runtime/props/moverCopies';

import { addKitMeshes } from '../runtime/kit/kitMeshes';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const canopyRows = metadata.looks.canopy as LookRows['canopy'];
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';


/** the wall kit's model per piece (ctx.put's pieces that are placed: models/wallKit.ts) */
const WALL_KIT: Readonly<Partial<Record<Piece, ModelDef<Record<string, unknown>>>>> = { plant: galleryPlant };

/** the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and brush-drawn
 *  figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts), registered on
 *  their kits' meshes in this order */
/** one model drawn into the kits: its id, and its copies registered on their kits' meshes */
interface InKitModel { readonly id: string; readonly register: (nd: ModelContext, copies: readonly InKit[], meshOf: (k: string) => Mesh | undefined) => InKitPlaced[] }
const inKitModel = <P extends object>(model: ModelDef<P>): InKitModel => ({ id: model.id, register: (nd, copies, meshOf) => registerDrawnInto(nd, copies, model, meshOf, 'nds-') });
const IN_KIT: readonly InKitModel[] = [
  inKitModel(brassDragonHook), inKitModel(drumStool), inKitModel(parkedScooter), inKitModel(mahjongTableModel), inKitModel(inkFigure), inKitModel(paifang), inKitModel(banyan), inKitModel(earthGodShrine),
  inKitModel(kowloonSteleModel), inKitModel(noodleStallModel), inKitModel(hawkerStallModel), inKitModel(lotusFinial), inKitModel(laundryLineModel), inKitModel(landingPlanterModel), inKitModel(wellBalustrade), inKitModel(lotusPostModel), inKitModel(lampPostModel),
];

/** a placement from a copy's matrix (its translation is where it stands) */
const at = <P extends object = object>(m: Matrix4, color?: Color): Placement<P> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m, ...(color === undefined ? {} : { color }) });

export interface NineDragonWorld {
  /** everything the fragment draws (add it to the engine's scene) */
  readonly root: Group;
  /** the look's shared uniforms (time, the eye, the silk fog, the paint, the light pools) */
  readonly shared: Shared;
  /** the build's context: its layout records (hooks, the map's floor plan, the crowd) */
  readonly ctx: { readonly rimZ: number; readonly hooks: readonly Vector3[] };
  /** per frame: time (s) and the camera the frame is drawn from */
  update: (t: number, camera: PerspectiveCamera) => void;
  /**
   * per frame, with the camera as it is drawn (the render hook's `frame`, after the updaters and the late hooks): the
   * whole-kit draw distances; model placement owns instance culling
   */
  cull: (camera: PerspectiveCamera) => void;
  /** G200: whether the decks' open ends are closed by their standalone balustrades (world/entries.ts; the colliders follow) */
  readonly entryCaps?: boolean;
  /** G224: the portals' ride step (world/portalRide.ts sets it in play), run by `update` with the frame's dt */
  readonly portal?: PortalSlot;
}

/** build the fragment's world; `progress(0..1)` as it goes; `opts.pause` ends a stretch between phases (the plugin's
 *  paced `worldBuildYield`, op-hitch45: in play it waits for a drawn frame when one is due, else it is a timer task) */
export async function buildNineDragonWorld(renderer: Renderer, progress: (f: number, detail?: string) => void, tier: NdTier, opts: { scope: Scope; sky: SkyRig; caps?: boolean; pause: () => Promise<void> }): Promise<NineDragonWorld> {
  const product = await loadFirstPartyProduct('nine-dragon-stack', opts.scope);
  const { world: worldRows, presentation: cardRows, volumes } = await product.json<GeometryBoot>('geometry/layout.json');
  const worldData = new Float64Array(Uint8Array.from(await product.file('geometry/world-f64.bin')).buffer);
  if (worldData.length !== worldRows.records) throw new Error('Nine world record inventory differs');
  const { shaft: SHAFT } = worldRows;
  const shared = new Shared(restoreWeave(await product.file('looks/silk-weave.r8')), (await product.json<{ readonly look: { readonly shared: ConstructorParameters<typeof Shared>[1] } }>('weapons/jian-row.json')).look.shared);
  const root = new Group();
  root.name = 'nine-dragon-stack';
  const phaseProfile: { name: string; ms: number }[] = [];
  const phaseDone = (name: string, start: number): void => { phaseProfile.push({ name, ms: Math.round(performance.now() - start) }); };
  // op-hitch29: the placing below runs in slices (`placeSliced` pauses between a model's levels, copies and parts; `slice()`
  // between the synchronous phases): a ~30 ms task while loading, an 8 ms work slice when a grid cell builds it in play
  const slice = slicer(30);
  progress(0, 'paint + fonts');
  const layoutReady = loadLayoutBake(opts.scope);
  // G285: the code-built models and canopy share the owned geometry library.
  const specimensReady = loadSpecimens(opts.scope, 'boot');
  const paintStart = performance.now();
  const paintReady = loadPaint('/assets/nine-dragon/paint', Math.min(8, renderer.capabilities.getMaxAnisotropy()), tier, (f) => { progress(f * 0.15, 'paint + fonts'); })
    .then((paint) => { phaseDone('paint', paintStart); return paint; });
  const paint = await paintReady;
  shared.u.uPaint.value = paint.tex;
  progress(0.15, 'layout: square');

  // ── the layout: the square, the towers, the Well ──
  const fontsStart = performance.now();
  const atlas = await loadSignAtlas(tier, renderer);
  phaseDone('fonts', fontsStart);
  const signs = atlas;
  // the neon calligraphy: the 'nine-neon-board' and 'nine-neon-tube' looks (data/lookGraphs.json), fogged by the silk
  setLentTexture('nine-neon-tube', 'sdf', atlas.textures.sdf);
  const { fontPx, spread, skeletonSpread } = atlas.glyphLayout;
  setLentParam('nine-neon-tube', 'spread', [spread / fontPx, skeletonSpread / fontPx]);
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
  shared.u.uShaftK.value.y = Y0;
  // the models' context (world/modelLook.ts): the look fills in as each phase makes its part
  const nd = ndModelContext(renderer, opts.scope, opts.sky);
  // G285: the layout (the square, the towers, the Well) is an offline bake (../generators/layout.ts, world/layoutBake.ts):
  // the page restores it and has no live builders to fall back on
  const layout = await layoutReady;
  const specimens = await specimensReady;
  nd.look.specimens = specimens;
  progress(0.2, 'layout: baked');
  // the layout's geometry copies (with their bounds) are made in slices first: the restore then only takes them
  await layout.prepare(() => slice());
  const ctx = restoreLayout(layout);
  // SF51-g: the four landing decks at road height (world/entries.ts), each with its portal to the square (G224)
  // G200: played alone (no road beyond the decks) each deck's open end gets its balustrade and brazier
  const entryCaps = opts.caps === true;
  const [entries, boards, fixed] = await Promise.all([loadCast(entryCaps ? 'entries-capped' : 'entries-open'), loadCast('facade-signs'), loadFixedRows()]);
  ctx.kits.set('entries', entries);
  for (const row of entryCaps ? fixed.lanterns : []) ctx.lanterns.push(new Matrix4().fromArray(row));
  for (const frame of worldRows.portalLanterns) ctx.lanterns.push(new Matrix4().fromArray(worldData, frame));
  const portals = buildPortals();
  root.add(portals.root);
  progress(0.3, 'signs');
  await opts.pause();
  // the facade grammar's sign slots, filled with real calligraphy (SDF neon for blades, lightboxes for flat ones)
  ctx.kits.set('facade-signs', boards);
  progress(0.4, 'geometry conversion');

  // ── the kits into meshes: one merged geometry per kit, the neon spill baked into their vertices ──
  syncArchitecture(shared.u);
  const mat = lentLook('nine-architecture'), matA = lentLook('nine-architecture-cut');
  const paper = new Lanterns(fixed.lantern);
  bindLowPolyMaterial(opts.sky, 'nine-architecture', mat, opts.scope);
  nd.look.lantern = paper.material;
  const tmpP = new Vector3(), tmpQ = new Quaternion(), tmpS = new Vector3();
  for (const m of ctx.lanterns) { m.decompose(tmpP, tmpQ, tmpS); paper.hang(tmpP.clone(), tmpS.x); }
  // every mesh is named by what built it (`kit:<name>`, `facade`, `crowd`, …): the budget ruler sorts them into lanes
  const named = <T extends Object3D>(o: T, name: string): T => { o.name = name; return o; };
  const kitGeos = [...ctx.kits].flatMap(([name, geometry]) => geometry === null ? [] : [[name, geometry] as const]);
  const alphaGeos = [...ctx.alphaKits];
  Reflect.set(window, '__ndKitProfile', [...kitGeos, ...alphaGeos].map(([name, geometry]) => ({ name, ms: 0, vertices: geometry.getAttribute('position').count })));
  ctx.kits.clear();
  ctx.alphaKits.clear();
  await opts.pause(); // let the loading panel paint and GC run (in play: a drawn frame)
  progress(0.52, 'neon spill + canopy');
  let phaseStart = performance.now();
  await loadSpill(kitGeos, tier, entryCaps);
  phaseDone('neon spill', phaseStart);
  phaseStart = performance.now();
  const canopy = specimens.has('canopy:cards') ? { cards: takeSpecimen(specimens, 'canopy:cards'), core: takeSpecimen(specimens, 'canopy:core') } : null;
  if (canopy !== null) await loadSpill([['canopy-cards', canopy.cards], ['canopy-core', canopy.core]], tier, entryCaps);
  const crown: Mesh[] = [];
  if (canopy !== null) {
    const leafAtlas = opts.scope.own(await loadTextureRow(canopyRows.atlas)), image: unknown = leafAtlas.image;
    if (typeof image !== 'object' || image === null || !('width' in image) || !('height' in image)
      || typeof image.width !== 'number' || typeof image.height !== 'number' || image.width <= 0 || image.height <= 0) throw new Error('Canopy atlas needs its pixel dimensions');
    setLentTexture('nine-canopy-cards', 'atlas', leafAtlas);
    setLentParam('nine-canopy-cards', 'atlasSize', [image.width, image.height]);
    for (const row of canopyRows.draws) {
      const mesh = new Mesh(canopy[row.geometry], lentLook(row.look));
      mesh.material.setValues(row.state); mesh.renderOrder = row.order; crown.push(mesh);
    }
  }
  for (const m of crown) { gpuOnlyAttributes(m.geometry, STATIC_GEOMETRY); root.add(named(m, 'canopy')); }
  // (the banyan model's specimen wears the same crown, models/banyan.ts)
  const [core, cards, depth] = crown.map((m) => (Array.isArray(m.material) ? undefined : m.material));
  if (core !== undefined && cards !== undefined && depth !== undefined) nd.look.canopy = { core, cards, depth };
  phaseDone('canopy', phaseStart);
  phaseStart = performance.now();
  // (E283, Jake's pick) the distance LODs are the models' own (models/: meshoptimizer copies of the sculpts, their error
  // under SCULPT_PX px where each starts, data/lod.ts; the facade dressing's and the balustrade's thin parts dropped where
  // they are ~half a pixel wide), handed to the culler with their batches
  const squareSets = await placeSquareProps({ ctx: nd.ctx, look: nd.look, root, rows: worldRows, records: worldData, sets: ctx.sets, due: slice.due });
  phaseDone('square props', phaseStart);
  await slice();
  // (a kit with a draw distance, ctx.far(name, m), is shown / hidden by the culler below; E264: the kits are ~100 MB of
  // vertex data at the phone's World Explorer peak, GPU-only once built)
  const kits = addKitMeshes(root, { solid: kitGeos, alpha: alphaGeos }, { solid: mat, alpha: matA }, ctx.farOf, STATIC_GEOMETRY);
  // the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and
  // brush-drawn figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts)
  // registered on their kits' meshes
  const meshOfKit = (name: string): Mesh | undefined => kits.byName.get(name);
  const inKit = ctx.inKit.filter((c) => !IN_KIT.some((m) => m.id === c.model));
  if (inKit.length > 0) throw new Error(`nine-dragon: '${inKit[0]?.model}' is drawn into a kit but is no model here (world/build.ts)`);
  await slice();
  const inKitPlaced: InKitPlaced[] = [];
  for (const model of IN_KIT) { inKitPlaced.push(...model.register(nd.ctx, ctx.inKit, meshOfKit)); await slice(); }
  const lanterns = await placeSliced(paperLantern, paper.placements(), { ctx: nd.ctx, draw: 'instanced', cull: { bounds: 'sphere' }, parent: root, piece: { id: 'nds-lanterns' } }, slice.due);
  lanterns.object.name = 'lanterns';
  progress(0.56, 'facade batches');
  phaseStart = performance.now();
  // E271/E272: facade instancing on every platform; multi-draw was removed after physical iOS memory kills.
  // Permanent evidence: docs/audits/nine-dragon-mobile-multidraw.md.
  const facade = new Group(); facade.name = 'facade';
  const uniforms = facadeUniforms(shared), facadeMat = facadeMaterial(uniforms);
  nd.look.facade = { mat: facadeMat, small: facadeMaterial(uniforms, { shrink: [55, 85] }) };
  const poses = (offset: number, count: number): Placement<Record<string, unknown>>[] => Array.from({ length: count }, (_, index) => {
    const offsetAt = offset + index * 19, matrix = new Matrix4().fromArray(worldData, offsetAt);
    return { ...at<Record<string, unknown>>(matrix), color: new Color().fromArray(worldData, offsetAt + 16) };
  });
  const shell = ctx.fd.shell === null ? null : new Mesh(ctx.fd.shell, facadeMat);
  if (shell !== null) {
    shell.name = 'facade-shell'; facade.add(shell); ctx.fd.shell = null;
    for (const row of worldRows.facade.baked) {
      const model = FACADE_BAKED[row.id]; if (model === undefined) throw new Error(`Missing facade model ${row.id}`);
      place(model, poses(row.poses, row.count), { ctx: nd.ctx, draw: 'merged', drawnInto: { object: shell, boxes: Float32Array.from(worldData.subarray(row.boxes, row.boxes + row.count * 6)) }, piece: { id: `nds-facade-${row.id}`, name: model.name } });
    }
    gpuOnlyAttributes(shell.geometry, STATIC_GEOMETRY);
  }
  for (const row of worldRows.facade.drawn) {
    const model = FACADE_MODELS[row.id]; if (model === undefined) throw new Error(`Missing facade model ${row.id}`);
    nameDraws(await placeSliced(model, poses(row.poses, row.count), { ctx: nd.ctx, draw: 'instanced', cull: { bounds: 'sphere', ...(row.small ? { far: 85 } : {}) }, parent: facade, piece: { id: `nds-facade-${row.id}`, name: model.name } }, slice.due), `facade-${row.id}`);
  }
  facade.add(...await loadFacadeWindows(windowMaterial(uniforms)));
  root.add(facade); phaseDone('facade', phaseStart);
  await slice();
  const neonMeshes = { boards: new Mesh(signs.geometry('neon-world-boards'), lentLook('nine-neon-board')), tubes: new Mesh(signs.geometry('neon-world-tubes'), lentLook('nine-neon-tube')) };
  neonMeshes.tubes.renderOrder = 5;
  root.add(named(neonMeshes.boards, 'neon'), named(neonMeshes.tubes, 'neon'));
  await slice();
  progress(0.6, 'streaks + dressing');
  phaseStart = performance.now();

  const presentation = cardRows[entryCaps ? 'capped' : 'open'];
  const streakMaterial = lentLook('nine-streaks'); Object.assign(streakMaterial, { transparent: true, ...BLEND_ADD_KEEP_ALPHA });
  const streaks = createSceneBuffers(presentation.streaks, streakMaterial, opts.scope);
  for (const mesh of streaks.children) mesh.renderOrder = 4;
  root.add(streaks);
  const haloMaterial = lentLook('nine-halo'); haloMaterial.setValues((metadata.looks.light as LookRows['light']).haloState);
  const halos = createSceneBuffers(presentation.halos, haloMaterial, opts.scope);
  halos.visible = tier === 'phone';
  for (const mesh of halos.children) mesh.renderOrder = 5;
  root.add(halos);
  await slice();

  // the wall kit: one InstancedMesh per piece and region (models/wallKit.ts)
  const wellKit: Placed[] = [];
  for (const [key, list] of ctx.inst) {
    const piece = key.slice(0, key.indexOf('@')) as Piece;
    const model = WALL_KIT[piece];
    if (model === undefined) throw new Error(`nine-dragon: the wall kit's '${piece}' is no model yet (models/wallKit.ts)`);
    const placed = await placeSliced(model, list.map((it) => at<Record<string, unknown>>(it.m, it.c)), { ctx: nd.ctx, draw: 'instanced', cull: { bounds: 'sphere' }, parent: root, piece: { id: `nds-inst-${key}` } }, slice.due);
    nameDraws(placed, `inst:${key}`);
    if (!key.endsWith('@town')) wellKit.push(placed);
  }
  // the fragment's named places as Sets (../places.ts, world/sets.ts): what each region's kits carry
  const extras = new Map<string, readonly Placed[]>(Object.entries({ ...squareSets, well: wellKit }));
  for (const region of worldRows.regions) {
    const members = [...inKitPlaced.filter(copy => region.kits.includes(copy.kit)).map(copy => copy.placed), ...extras.get(region.extra) ?? []];
    if (members.length > 0) placeSet({ id: region.id, name: region.name, place: region.place, file: 'src/shards/nine-dragon-stack/generators/worldRows.ts', members });
  }
  if (ctx.acs.length > 0) nameDraws(await placeSliced(airConBox, ctx.acs.map((m) => at<Record<string, unknown>>(m)), { ctx: nd.ctx, draw: 'instanced', cull: { bounds: 'sphere' }, parent: root, piece: { id: 'nds-inst-ac' } }, slice.due), 'inst:ac');
  await slice();

  // movers: the train, the gondola, the drones (models/movers.ts), each placed where the update puts it at t = 0
  // the sign atlas's lightboxes, lights and beacons: the 'nine-neon' look (data/lookGraphs.json), fogged by the silk
  const neon = lentLook('nine-neon');
  setLentTexture('nine-neon', 'mono', atlas.textures.mono);
  setLentTexture('nine-neon', 'colour', atlas.textures.colour);
  nd.look.neon = { mat: neon, atlas };
  const movers = (model: ModelDef<object>, programs: readonly unknown[], id: string): RunningMover[] => placeMovers(model, programs, { ctx: nd.ctx, parent: root, id, name: 'movers' });
  const running = [
    ...movers(monorailTrain, declarations.clientChannels.slice(0, 1), 'nds-train'),
    ...movers(cableGondola, declarations.clientChannels.slice(1, 2), 'nds-gondola'),
    ...movers(drone, declarations.clientChannels.slice(2), 'nds-drones'),
  ];
  await slice();
  const signsMesh = named(new Mesh(signs.geometry('world'), neon), 'signs');
  root.add(signsMesh);
  // every sign hung is a copy of the sign model (models/signs.ts), registered where it is drawn
  registerSigns(nd.ctx, signs, { atlas: signsMesh, neon: neonMeshes.boards });
  await slice();

  // the painted sky, the LED sky screens (lab P7's 千里江山图 scroll), the Well's silk sheets, the stall's steam
  // (the 'nine-sky' look, data/lookGraphs.json) a sphere the frame keeps on the eye (look/render.ts), inside the far plane
  const sky = new Mesh(new SphereGeometry(2000, 32, 16), lentLook('nine-sky'));
  setLentTexture('nine-sky', 'silk', shared.u.uSilk.value);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(named(sky, 'sky'));
  const scrollTex = opts.scope.own(await loadTextureRow({ url: '/assets/nine-dragon/lab/organic/scroll.webp', srgb: true, wrapT: ClampToEdgeWrapping, anisotropy: 4 }));
  setLentTexture('nine-scroll', 'scroll', scrollTex);
  const screen = new Mesh(new PlaneGeometry(58, 80), lentLook('nine-scroll'));
  screen.rotation.x = Math.PI / 2;
  screen.position.set(1, Y0 + 29.85, -64);
  // (the stair-street's own screen over x 43…113 at +173 is gone: from the square and landing 1 it was a flat teal
  // ceiling over the stair paifang, where every C target paints blue-hour sky; E281 stair pass 3's experiment)
  root.add(named(screen, 'screens'));
  if (worldRows.sheets.length > 0) {
    const sheets = new Mesh(takeSpecimen(specimens, 'mist:sheets'), lentLook('nine-mist-sheet'));
    sheets.renderOrder = 2;
    root.add(named(sheets, 'sheets'));
  }
  const steam = new Mesh(takeSpecimen(specimens, 'mist:steam'), lentLook('nine-steam'));
  steam.frustumCulled = false;
  steam.renderOrder = 3;
  root.add(named(steam, 'steam'));
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
    if (mounts.length > 0) nameDraws(await placeSliced(feiZhuaHook, mounts.map(({ ring, out }) => at(feiZhuaAt(ring, out))), { ctx: nd.ctx, draw: 'instanced', cull: { bounds: 'sphere' }, parent: root, piece: { id: 'nds-fei-zhua-hooks' } }, slice.due), 'glb:dragon-hook');
  }
  // Crowd LODs are declared on the models; placement owns their frustum and range.
  const drawCrowd = async <P extends object>(model: ModelDef<P>, rows: readonly { matrix: number; variant: string }[], id: string): Promise<void> => {
    if (rows.length > 0) (await placeSliced(model, rows.map(row => ({ ...at<P>(new Matrix4().fromArray(worldData, row.matrix)), variant: row.variant })), { ctx: nd.ctx, cull: { bounds: 'sphere', from: 'origin', far: 130 }, parent: root, draw: 'instanced', piece: { id } }, slice.due)).object.name = 'crowd';
  };
  await drawCrowd(umbrellaWalker, worldRows.crowd.walkers, 'nds-crowd-walkers');
  await drawCrowd(mahjongSitter, worldRows.crowd.sitters, 'nds-crowd-sitters');
  await slice();
  phaseDone('crowd + atlas', phaseStart);

  // the light pools (lab P6): baked from every emitter + lit window into the shared uniforms. The window glow and the
  // LUT belong to the clean room's post, so they get stand-in uniforms here (the engine's composer draws the frame)
  progress(0.9, 'light volume');
  for (const suffix of ['A', 'B'] as const) {
    const row = volumes[`${tier}-${entryCaps ? 'capped' : 'open'}-${suffix === 'A' ? 0 : 1}`];
    if (row === undefined) throw new Error('Missing irradiance volume row');
    const bytes = await fetchDeflatedBytes(product.url(row.file));
    if (bytes.length !== row.size[0] * row.size[1] * row.size[2] * 4) throw new Error('Irradiance volume size differs');
    const texture = opts.scope.own(new Data3DTexture(bytes, ...row.size)); texture.needsUpdate = true;
    texture.minFilter = texture.magFilter = LinearFilter; texture.unpackAlignment = 1;
    gpuOnlyTexture(texture, 'Nine Dragon light volumes (GPU only)');
    shared.u[`uLpVol${suffix}`].value = texture;
    shared.u[`uLpMin${suffix}`].value.fromArray(row.min); shared.u[`uLpInv${suffix}`].value.fromArray(row.inv);
    shared.u.uLpMax.value = row.maximum;
  }
  const defaults = metadata.looks.light.defaults;
  shared.u.uLpGain.value.set(defaults.poolGain, defaults.sheen, shared.u.uLpGain.value.z, defaults.pools);
  shared.u.uLpSky.value = defaults.wetSky; shared.u.uLpAmb.value = defaults.ambient;
  progress(0.95, 'culling');

  // Model placement owns per-copy LOD and frustum culling in the registry's frame.
  const farMeshes = kits.far.map(([mesh, far]) => ({ mesh, far, box: new Box3().setFromObject(mesh) }));
  const eye = new Vector3();
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
    for (const m of running) m.advance(t);
  };
  const cull = (camera: PerspectiveCamera): void => {
    eye.setFromMatrixPosition(camera.matrixWorld);
    for (const { mesh, far, box } of farMeshes) mesh.visible = box.distanceToPoint(eye) <= far;
  };
  // The playable world only needs hook points from the build context. Retaining the full Ctx kept its
  // facade grammar, instance placement lists and atlas canvases alive alongside the finished meshes.
  return { root, shared, ctx: { hooks: ctx.hooks, rimZ: worldRows.rim.z0 }, update, cull, entryCaps, portal };
}

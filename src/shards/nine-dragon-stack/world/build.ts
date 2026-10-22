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
  Box3, type BufferGeometry, Data3DTexture, LinearFilter, Color, Group, Matrix4, Mesh, type Object3D, type PerspectiveCamera, Vector3,
} from 'three';
import { registerSigns } from '../models/signs';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import { placeSet } from '@wildshard/engine/models/sets';
import { type DrawnPlaced as InKitPlaced, registerDrawnInto } from '../runtime/kit/drawnInto';
import { sharedModelContext, type ModelDef, type Placement } from '@wildshard/engine/models/model';
import { WorldEntry } from '@wildshard/game/shardfile/worldEntry';
import { jiehuaMaterial as facadeMaterial, facadeUniforms, syncLooks } from '../look/facadeMaterial';
import metadata, { Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import { Shared, restoreWeave } from '../look/style';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';
import { gpuOnlyAttributes, gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { type Placed, copiesAt, place } from '@wildshard/engine/models/place';
import { slicer } from '@wildshard/engine/boot/plan';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { ndModelContext, need } from './modelLook';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import { loadLayoutBake, prepareLayout, restoreLayout } from './layoutBake';
import { loadSignAtlas, loadSpill } from './casts';

import { addKitMeshes } from '../runtime/kit/kitMeshes';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
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
  /** where each paper lantern hangs (the lanterns' hum, runtime/audio/ambience.ts) */
  readonly lanterns: readonly Vector3[];
}

/** build the fragment's world; `progress(0..1)` as it goes; `opts.pause` ends a stretch between phases (the plugin's
 *  paced `worldBuildYield`, op-hitch45: in play it waits for a drawn frame when one is due, else it is a timer task) */
export async function buildNineDragonWorld(renderer: Renderer, progress: (f: number, detail?: string) => void, tier: NdTier, opts: { scope: Scope; sky: SkyRig; scenes: SceneHandles; caps?: boolean; pause: () => Promise<void> }): Promise<NineDragonWorld> {
  const product = await loadFirstPartyProduct('nine-dragon-stack', opts.scope);
  const { world: worldRows, volumes } = await product.json<GeometryBoot>('geometry/layout.json');
  const worldData = new Float64Array(Uint8Array.from(await product.file('geometry/world-f64.bin')).buffer);
  if (worldData.length !== worldRows.records) throw new Error('Nine world record inventory differs');
  const { shaft: SHAFT } = worldRows;
  const shared = new Shared(restoreWeave(await product.file('looks/silk-weave.r8')), (await product.json<{ readonly look: { readonly shared: ConstructorParameters<typeof Shared>[1] } }>('weapons/jian-row.json')).look.shared);
  const root = new Group();
  root.name = 'nine-dragon-stack';
  const entry = WorldEntry.admit(product.section('world/scenes').entry, { scenes: opts.scenes, root, tier, variant: opts.caps === true ? 'capped' : 'open' });
  // op-hitch29: the placing below runs in slices (`placeSliced` pauses between a model's levels, copies and parts; `slice()`
  // between the synchronous phases): a ~30 ms task while loading, an 8 ms work slice when a grid cell builds it in play
  const slice = slicer(30);
  progress(0, 'paint + fonts');
  const layoutReady = loadLayoutBake();
  // every code-built model is a row of the world-scene catalogue (generators/worldScenes.ts), placed on the shared context
  const catalogueRows = parseWorldSceneModels(await product.json<unknown>('models/world-scenes.json')), keys = new Map(catalogueRows.models.map(row => [row.id, row.key]));
  const models = { ctx: sharedModelContext(opts.sky, { renderer }), ...defineWorldSceneCatalogue(catalogueRows) };
  progress(0.15, 'layout: square');

  // ── the layout: the square, the towers, the Well ──
  const atlas = await loadSignAtlas(tier, opts.scenes);
  const signs = atlas;
  // the neon calligraphy: the 'nine-neon-board' and 'nine-neon-tube' looks (data/lookGraphs.json), fogged by the silk
  const { fontPx, spread, skeletonSpread } = atlas.glyphLayout;
  setLentParam('nine-neon-tube', 'spread', [spread / fontPx, skeletonSpread / fontPx]);
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
  shared.u.uShaftK.value.y = Y0;
  // the models' context (world/modelLook.ts): the look fills in as each phase makes its part
  const nd = ndModelContext(renderer, opts.sky);
  // G285: the layout (the square, the towers, the Well) is an offline bake (../generators/layout.ts, world/layoutBake.ts):
  // the page restores it and has no live builders to fall back on
  const layout = await layoutReady;
  progress(0.2, 'layout: baked');
  // The scene host owns the geometry; its baked bounds are assigned, no scan (O19).
  prepareLayout(layout, opts.scenes);
  const ctx = restoreLayout(layout, opts.scenes);
  // SF51-g: the four landing decks at road height (world/entries.ts), each with its portal to the square (G224)
  // G200: played alone (no road beyond the decks) each deck's open end gets its balustrade and brazier
  const entryCaps = opts.caps === true;
  const entries = opts.scenes.geometry(entryCaps ? 'casts.entries-capped' : 'casts.entries-open');
  const boards = opts.scenes.geometry('casts.facade-signs');
  ctx.kits.set('entries', entries);
  await entry.run('portals');
  progress(0.3, 'signs');
  await opts.pause();
  // the facade grammar's sign slots, filled with real calligraphy (SDF neon for blades, lightboxes for flat ones)
  ctx.kits.set('facade-signs', boards);
  progress(0.4, 'geometry conversion');

  // ── the kits into meshes: one merged geometry per kit, the neon spill baked into their vertices ──
  syncLooks(shared.u);
  const mat = lentLook('nine-architecture'), matA = lentLook('nine-architecture-cut');
  bindLowPolyMaterial(opts.sky, 'nine-architecture', mat, opts.scope);
  // the paper lanterns hung for this deck ending and the layout's air conditioners: world-scene placements of their
  // catalogue models (generators/worldScenes.ts LAYOUT_PLACEMENTS); the lanterns' hum hangs where each one does
  const lanternId = `nds-lanterns-${entryCaps ? 'capped' : 'open'}`;
  const lanternsAt = parseWorldScenePlacement(await product.json(`world/placements/${lanternId}.json`)).poses.map(({ x, y, z }) => new Vector3(x, y, z));
  // every mesh is named by what built it (`kit:<name>`, `facade`, `crowd`, …): the budget ruler sorts them into lanes
  const named = <T extends Object3D>(o: T, name: string): T => { o.name = name; return o; };
  const kitGeos = [...ctx.kits].flatMap(([name, geometry]) => geometry === null ? [] : [[name, geometry] as const]);
  const alphaGeos = [...ctx.alphaKits];
  ctx.kits.clear();
  ctx.alphaKits.clear();
  await opts.pause(); // let the loading panel paint and GC run (in play: a drawn frame)
  progress(0.52, 'neon spill + canopy');
  await loadSpill(kitGeos, tier, entryCaps);
  // the world's banyan crown and the Well's mist: the catalogue's `dressing` step (its crown spilled like the kits; its
  // leaf atlas, the paint and the scroll are the step's lent textures)
  await entry.run('canopy');
  if (opts.scenes.has('dressing.crown-core')) {
    const crownPart = (id: string): BufferGeometry => { const part = opts.scenes.object(`dressing.${id}`); if (!isMesh(part)) throw new Error(`Nine dressing ${id} is no mesh`); return part.geometry; };
    const crown = [['canopy-cards', crownPart('crown-cards')], ['canopy-core', crownPart('crown-core')]] as const;
    await loadSpill(crown, tier, entryCaps);
    for (const [, geometry] of crown) gpuOnlyAttributes(geometry, STATIC_GEOMETRY);
  }
  await entry.run('dressing');
  // (E283, Jake's pick) the distance LODs are the models' own (models/: meshoptimizer copies of the sculpts, their error
  // under SCULPT_PX px where each starts, data/lod.ts; the facade dressing's and the balustrade's thin parts dropped where
  // they are ~half a pixel wide), handed to the culler with their batches
  // the square's lions and its queued sets; the named places' Sets share them (Lantern Square's panels and lions, the
  // stair-street's and the Well rim's lions), the booths, parasol tables and pavilions are the night market
  const squareSets = { square: [] as Placed[], stair: [] as Placed[], rim: [] as Placed[] }, market: Placed[] = [];
  if (worldRows.lions.length > 0) {
    const lions = await opts.scenes.place('nds-lions'); root.add(lions.object);
    for (const [k, idx] of [['square', worldRows.shares.plaza], ['stair', worldRows.shares.street], ['rim', worldRows.shares.rim]] as const) { const share = copiesAt(lions, idx); if (share !== null) squareSets[k].push(share); }
  }
  // each set is a world-scene placement of its catalogue model at its baked frames (generators/worldScenes.ts SET_PLACEMENTS)
  for (const { name } of worldRows.sets) {
    const placed = await opts.scenes.place(`nds-set-${name}`); root.add(placed.object);
    (name === 'balustrade-panel' ? squareSets.square : market).push(placed);
  }
  if (market.length > 0) placeSet({ id: 'nine-dragon-stack/night-market', name: 'Lantern Square night market', file: 'src/shards/nine-dragon-stack/generators/stalls.ts', place: 'nine-dragon-stack/night-market', members: market });
  await slice();
  // (a kit with a draw distance, ctx.far(name, m), is shown / hidden by the culler below; E264: the kits are ~100 MB of
  // vertex data at the phone's World Explorer peak, GPU-only once built)
  const kits = addKitMeshes(root, { solid: kitGeos, alpha: alphaGeos }, { solid: mat, alpha: matA }, ctx.farOf, STATIC_GEOMETRY);
  // the models drawn into the kits (models/inKit.ts: the brass dragon hooks, stools, scooters, mahjong tables and
  // brush-drawn figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts)
  // registered on their kits' meshes
  const meshOfKit = (name: string): Mesh | undefined => kits.byName.get(name);
  const byId = new Map<string, ModelDef<Record<string, unknown>>>();
  for (const id of new Set(ctx.inKit.map(c => c.model))) byId.set(id, models.model(need(keys.get(id), `the drawn-in model ${id}`)));
  await slice();
  const inKitPlaced: InKitPlaced[] = [];
  // a copy registers on its authored card; one drawn with free params (a laundry line's span and rise) on the default one
  const canonical = (params: object): string => JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const authored = new Set(catalogueRows.models.flatMap(row => row.choices.map(choice => `${row.id}:${canonical(choice.params)}`)));
  const copies = ctx.inKit.map(c => { const row = catalogueRows.models.find(m => m.id === c.model), { params: _free, ...pose } = c.at;
    return row === undefined || authored.has(`${c.model}:${canonical({ ...row.defaults, ...c.at.params })}`) ? c : { ...c, at: pose }; });
  for (const model of byId.values()) { inKitPlaced.push(...registerDrawnInto(models.ctx, copies, model, meshOfKit, 'nds-')); await slice(); }
  const lanterns = await opts.scenes.place(lanternId); root.add(lanterns.object);
  lanterns.object.name = 'lanterns';
  progress(0.56, 'facade batches');
  // E271/E272: facade instancing on every platform; multi-draw was removed after physical iOS memory kills.
  // Permanent evidence: docs/audits/nine-dragon-mobile-multidraw.md.
  const facade = new Group(); facade.name = 'facade';
  const uniforms = facadeUniforms(shared), facadeMat = facadeMaterial(uniforms);
  const poses = (offset: number, count: number): Placement<Record<string, unknown>>[] => Array.from({ length: count }, (_, index) => {
    const offsetAt = offset + index * 19, matrix = new Matrix4().fromArray(worldData, offsetAt);
    return { ...at<Record<string, unknown>>(matrix), color: new Color().fromArray(worldData, offsetAt + 16) };
  });
  const shell = ctx.shell === null ? null : new Mesh(ctx.shell, facadeMat);
  if (shell !== null) {
    shell.name = 'facade-shell'; facade.add(shell); ctx.shell = null;
    for (const row of worldRows.facade.baked) {
      const model = models.model(`facade:${row.id}`);
      place(model, poses(row.poses, row.count), { ctx: models.ctx, draw: 'merged', drawnInto: { object: shell, boxes: Float32Array.from(worldData.subarray(row.boxes, row.boxes + row.count * 6)) }, piece: { id: `nds-facade-${row.id}`, name: model.name } });
    }
    gpuOnlyAttributes(shell.geometry, STATIC_GEOMETRY);
  }
  // the facade's drawn pieces: world-scene placements (generators/worldScenes.ts LAYOUT_PLACEMENTS)
  for (const row of worldRows.facade.drawn) facade.add((await opts.scenes.place(`nds-facade-${row.id}`)).object);
  facade.add(...metadata.windowBindings[entryCaps ? 'capped' : 'open'].map(id => opts.scenes.object(id)));
  root.add(facade);
  await slice();
  const neonMeshes = { boards: new Mesh(signs.geometry('neon-world-boards'), lentLook('nine-neon-board')), tubes: new Mesh(signs.geometry('neon-world-tubes'), lentLook('nine-neon-tube')) };
  neonMeshes.tubes.renderOrder = 5;
  root.add(named(neonMeshes.boards, 'neon'), named(neonMeshes.tubes, 'neon'));
  await slice();
  progress(0.6, 'streaks + dressing');

  // the wet floor's reflection cards and the lanterns' halos: the catalogue's cards step for this deck ending
  await entry.run('cards');
  await slice();

  // the wall kit: one InstancedMesh per piece and region (models/wallKit.ts)
  const wellKit: Placed[] = [];
  for (const [key] of layout.inst) {
    const placed = await opts.scenes.place(`nds-inst-${key}`); root.add(placed.object);
    if (!key.endsWith('@town')) wellKit.push(placed);
  }
  // the fragment's named places as Sets (../places.ts, world/sets.ts): what each region's kits carry
  const extras = new Map<string, readonly Placed[]>(Object.entries({ ...squareSets, well: wellKit }));
  for (const region of worldRows.regions) {
    const members = [...inKitPlaced.filter(copy => region.kits.includes(copy.kit)).map(copy => copy.placed), ...extras.get(region.extra) ?? []];
    if (members.length > 0) placeSet({ id: region.id, name: region.name, place: region.place, file: 'src/shards/nine-dragon-stack/generators/worldRows.ts', members });
  }
  root.add((await opts.scenes.place('nds-inst-ac')).object);
  await slice();

  // movers: the train, the gondola, the drones (models/movers.ts), each placed where the update puts it at t = 0
  // the sign atlas's lightboxes, lights and beacons: the 'nine-neon' look (data/lookGraphs.json), fogged by the silk
  const neon = lentLook('nine-neon');
  nd.look.neon = { mat: neon, atlas };
  const drones = models.project('nds-drones', models.ctx, root);
  // a drone carries its navigation lights (red, white, cyan): neon quads in the sign atlas
  for (const { body } of drones) body.add(new Mesh(atlas.geometry('drone'), neon));
  const running = [...models.project('nds-train', models.ctx, root), ...models.project('nds-gondola', models.ctx, root), ...drones];
  await slice();
  const signsMesh = named(new Mesh(signs.geometry('world'), neon), 'signs');
  root.add(signsMesh);
  // every sign hung is a copy of the sign model (models/signs.ts), registered where it is drawn
  registerSigns(nd.ctx, signs, { atlas: signsMesh, neon: neonMeshes.boards });
  await slice();

  // the painted sky is the dressing step's (generators/worldScenes.ts); its silk is the shared weave
  setLentTexture('nine-sky', 'silk', shared.u.uSilk.value);
  progress(0.75, 'crowd models');

  // the lab's cast-brass dragon hung at three close Well hooks: a world-scene placement of its catalogue model (one
  // instanced draw; the procedural brackets and collision-free ring anchors stay)
  root.add((await opts.scenes.place('nds-fei-zhua-hooks')).object);
  // Crowd LODs are declared on the models; placement owns their frustum and range.
  // the TRELLIS crowd in its colourways: world-scene placements of its catalogue models (generators/worldScenes.ts)
  for (const group of ['walkers', 'sitters'] as const) {
    if (worldRows.crowd[group].length === 0) continue;
    const crowd = await opts.scenes.place(`nds-crowd-${group}`); crowd.object.name = 'crowd'; root.add(crowd.object);
  }
  await slice();

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

  const update = (t: number, camera: PerspectiveCamera): void => {
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
  return { root, shared, ctx: { hooks: ctx.hooks, rimZ: worldRows.rim.z0 }, update, cull, entryCaps, lanterns: lanternsAt };
}

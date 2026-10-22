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
  Data3DTexture, LinearFilter, Group, Mesh, type PerspectiveCamera, Vector3,
} from 'three';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import { sharedModelContext } from '@wildshard/engine/models/model';
import { WorldEntry } from '@wildshard/game/shardfile/worldEntry';
import metadata, { Y0 } from '../boot/metadata.generated.json' with { type: 'json' };
import { Shared, restoreWeave } from '../look/style';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { lentLook, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';
import { gpuOnlyAttributes, gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { slicer } from '@wildshard/engine/boot/plan';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;

export interface NineDragonWorld {
  /** everything the fragment draws (add it to the engine's scene) */
  readonly root: Group;
  /** the look's shared uniforms (time, the eye, the silk fog, the paint, the light pools) */
  readonly shared: Shared;
  /** per frame: time (s) and the camera the frame is drawn from */
  update: (t: number) => void;
  /** per frame, with the camera as drawn: nothing left to cull here (the kits' draw distances are the fabric's weld
   *  culls, model placement owns instance culling); goes with its last caller */
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
  const { shaft: SHAFT } = worldRows;
  const shared = new Shared(restoreWeave(await product.file('looks/silk-weave.r8')), (await product.json<{ readonly look: { readonly shared: ConstructorParameters<typeof Shared>[1] } }>('weapons/jian-row.json')).look.shared);
  const root = new Group();
  root.name = 'nine-dragon-stack';
  const entry = WorldEntry.admit(product.section('world/scenes').entry, { scenes: opts.scenes, root, tier, variant: opts.caps === true ? 'capped' : 'open' });
  // op-hitch29: the placing below runs in slices (`placeSliced` pauses between a model's levels, copies and parts; `slice()`
  // between the synchronous phases): a ~30 ms task while loading, an 8 ms work slice when a grid cell builds it in play
  const slice = slicer(30);
  progress(0, 'paint + fonts');
  // every code-built model is a row of the world-scene catalogue (generators/worldScenes.ts), placed on the shared context
  const catalogueRows = parseWorldSceneModels(await product.json<unknown>('models/world-scenes.json'));
  const models = { ctx: sharedModelContext(opts.sky, { renderer }), ...defineWorldSceneCatalogue(catalogueRows) };
  progress(0.15, 'layout: square');

  // ── the layout: the square, the towers, the Well ──
  shared.u.uGroundY.value = Y0;
  // the shaft's silk mist fills dome C's SHAFT box (the main shaft and its run north)
  shared.u.uShaft.value.set(SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1);
  shared.u.uShaftK.value.y = Y0;
  // G285: the layout (the square, the towers, the Well) is an offline bake (../generators/layout.ts): its kits, the facade's
  // shell, what is drawn into them and the named places are the fabric weld (generators/worldScenes.ts FABRIC)
  progress(0.2, 'layout: baked');
  // SF51-g: the four landing decks at road height (world/entries.ts), each with its portal to the square (G224)
  // G200: played alone (no road beyond the decks) each deck's open end gets its balustrade and brazier
  const entryCaps = opts.caps === true;
  await entry.run('portals');
  progress(0.3, 'signs');
  await opts.pause();
  progress(0.4, 'geometry conversion');

  // ── the kits into meshes: one merged geometry per kit, the neon spill baked into their vertices ──
  bindLowPolyMaterial(opts.sky, 'nine-architecture', lentLook('nine-architecture'), opts.scope);
  // the paper lanterns hung for this deck ending and the layout's air conditioners: world-scene placements of their
  // catalogue models (generators/worldScenes.ts LAYOUT_PLACEMENTS); the lanterns' hum hangs where each one does
  const lanternId = `nds-lanterns-${entryCaps ? 'capped' : 'open'}`;
  const lanternsAt = parseWorldScenePlacement(await product.json(`world/placements/${lanternId}.json`)).poses.map(({ x, y, z }) => new Vector3(x, y, z));
  await opts.pause(); // let the loading panel paint and GC run (in play: a drawn frame)
  progress(0.52, 'canopy');
  // the world's banyan crown and the Well's mist: the catalogue's `dressing` step (the kits' and the crown's neon spill
  // is baked into their geometry, generators/spillBake.ts; the leaf atlas, the paint and the scroll are the step's lent textures)
  await entry.run('canopy');
  if (opts.scenes.has('dressing.crown-core')) for (const id of ['crown-cards', 'crown-core']) {
    const part = opts.scenes.object(`dressing.${id}`); if (!isMesh(part)) throw new Error(`Nine dressing ${id} is no mesh`);
    gpuOnlyAttributes(part.geometry, STATIC_GEOMETRY);
  }
  await entry.run('dressing');
  // (E283, Jake's pick) the distance LODs are the models' own (models/: meshoptimizer copies of the sculpts, their error
  // under SCULPT_PX px where each starts, data/lod.ts; the facade dressing's and the balustrade's thin parts dropped where
  // they are ~half a pixel wide), handed to the culler with their batches
  // the lions and the square's and the night market's sets: world-scene placements of their catalogue models at their
  // baked frames (generators/worldScenes.ts), put under the root by the world entry's `lions` and `sets` rows
  await entry.run('lions');
  await entry.run('sets');
  await slice();
  // the fabric: the kits (E264: ~100 MB of vertex data at the phone's World Explorer peak, GPU-only once built), the facade's
  // shell, the models drawn into them and the named places' Sets; then this ending's entry decks and the sign boards
  await opts.scenes.assemble('fabric');
  await entry.run('kits');
  for (const id of ['fabric.root', `fixed-${entryCaps ? 'capped' : 'open'}.root`]) opts.scenes.object(id).traverse(object => { if (isMesh(object)) gpuOnlyAttributes(object.geometry, STATIC_GEOMETRY); });
  await slice();
  await entry.run('lanterns');
  progress(0.56, 'facade batches');
  // E271/E272: facade instancing on every platform; multi-draw was removed after physical iOS memory kills.
  // Permanent evidence: docs/audits/nine-dragon-mobile-multidraw.md.
  const facade = opts.scenes.object('fabric.facade');
  // the facade's drawn pieces: world-scene placements (generators/worldScenes.ts LAYOUT_PLACEMENTS)
  for (const row of worldRows.facade.drawn) facade.add((await opts.scenes.place(`nds-facade-${row.id}`)).object);
  facade.add(...metadata.windowBindings[entryCaps ? 'capped' : 'open'].map(id => opts.scenes.object(id)));
  await slice();
  progress(0.6, 'streaks + dressing');

  // the wet floor's reflection cards and the lanterns' halos: the catalogue's cards step for this deck ending
  await entry.run('cards');
  await slice();

  // the wall kit: one InstancedMesh per piece and region (models/wallKit.ts)
  await entry.run('wall');
  root.add((await opts.scenes.place('nds-inst-ac')).object);
  await slice();

  // movers: the train, the gondola, the drones (each with its navigation lights), placed where the update puts them at t = 0
  const drones = models.project('nds-drones', models.ctx, root);
  const running = [...models.project('nds-train', models.ctx, root), ...models.project('nds-gondola', models.ctx, root), ...drones];
  await slice();
  // every sign hung is a copy of the sign model drawn into the dressing's sign and neon-board meshes (generators/worldScenes.ts)
  for (const id of ['nds-signs', 'nds-signs-neon']) await opts.scenes.place(id);
  await slice();

  // the painted sky is the dressing step's (generators/worldScenes.ts); its silk is the shared weave
  setLentTexture('nine-sky', 'silk', shared.u.uSilk.value);
  progress(0.75, 'crowd models');

  // the lab's cast-brass dragon hung at three close Well hooks: a world-scene placement of its catalogue model (one
  // instanced draw; the procedural brackets and collision-free ring anchors stay)
  // and the TRELLIS crowd in its colourways (its LODs declared on the models; placement owns their frustum and range): the
  // world entry's `figures` rows
  await entry.run('figures');
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

  progress(1, 'world ready');

  // the movers on the page clock (the clock, the eye and the fog's band window are the look's channel group)
  const update = (t: number): void => { for (const m of running) m.advance(t); };
  return { root, shared, update, cull: () => undefined, entryCaps, lanterns: lanternsAt };
}

import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { WorldEntry } from '@wildshard/game/shardfile/worldEntry';
import { driftwoodRows, driftwoodProduct } from '../runtime/boot/rows';
import { loadIslandCover } from './islandCover';
import { TIER, buildTier } from '@wildshard/engine/core/tier';
import { readDriftwoodBlob, loadFixedGeometry, fixedDraw, fixedGeometryGroups } from '../runtime/boot/blobAssets';
/**
 * Driftwood Isle's world build (E357 S4.1, 08 §4 `level.world`, §6.1 step 2): the ~15 builders `main.ts`'s `edge` step
 * ran behind `isOcean ?`, in the same order with the same arguments and a `slice()` between them (the 30 ms task
 * budget), then the rope bridge's jointed deck, the island's walkway ramps and the Blender spawn cove over the procedural
 * one. The plugin (../plugin.ts) runs it in the level's world stage.
 */
import * as THREE from 'three';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { sites, fencePost, signpost, plankStep, entryDeck } from '../models/catalogue';
import wreckBake from '../data/wreckBake.json' with { type: 'json' };
import { BuildStages, macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { installPagePathRamps } from '@wildshard/game/shardfile/pagePreparation';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import manifest from '../discovery.generated';
import { WaterSurface, waterSurfaceLook } from '@wildshard/game/systems/looks/waterSurface';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { MooringLines } from '../runtime/props/mooringLines';
import * as v from 'valibot';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import { createBuildingCloud } from '@wildshard/game/shardfile/buildingCloud';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { hasLentLook, lentLook, lentLooksOf, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { updateWind } from '@wildshard/engine/world/wind';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import SEABED from '../data/seabedLook.json' with { type: 'json' };
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };
import { createAmbientFlock } from '@wildshard/sdk/looks/ambientFlock';
import { placeRopeBridge } from './RopeBridge';
import type { CoverComposition, EntryLandings } from '../runtime/productSections.generated.d.ts';
import { followToonLook, toonLookState } from '@wildshard/game/looks/toonLook';
import { createStreamedCover } from '@wildshard/game/looks/streamedCover';
import authoredCover from '../data/groundCover.json' with { type: 'json' };
import type { BakedTiles } from '@wildshard/game/shardfile/bakedTiles';
import { LOWERED_SEA } from './sea';
import { modelContext, sharedModelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';

/** What the world build hands the rest of the level: each part it built, nullable off Driftwood (its lists stay lists). */
export type DriftwoodWorld = { [K in keyof BuiltWorld]: BuiltWorld[K] extends readonly unknown[] ? BuiltWorld[K] : BuiltWorld[K] | null };
type BuiltWorld = Awaited<ReturnType<typeof build>>;

/** The handle off Driftwood: nothing built (main.ts's readers keep their `?.` until S4.2–S4.4 move them). */
export function noDriftwoodWorld(): DriftwoodWorld {
  return { ocean: null, pier: null, jetties: [], boat: null, rocks: null, hut: null, lookout: null, wreck: null, shrine: null,
    bushes: null, gulls: null, trailside: null, bridge: null, seabed: null, palmSpecs: [], cove: null, palms: null, cover: null,
    bridgeDeck: null };
}

/** main.ts:366-467's Driftwood builders, lowered as one by G164 (`sea` is the lowered sea at road level). */
export function buildDriftwoodWorld(...args: Parameters<typeof build>): Promise<BuiltWorld> { return build(...args); }
async function build(world: World, viewer: () => THREE.Vector3, progress: StepProgress | undefined, scenes: SceneHandles, baked: ReadonlyMap<string, BakedTiles>) {
  // G164: the whole island lowered, the sea at road level; G170: each declared entry landing is the inner end of an asphalt
  // road deck (the catalogue's entryDeck, generators/entryDeckGeometry.ts) that carries the socket on over it, and a pier / jetty ramps up from it
  const landings = (await driftwoodProduct().json<EntryLandings>('world/entry-landings.json')).rows, fixed = driftwoodRows('custom/fixedLayouts');
  if (fixed.entryDecks.some(({ rect }) => rect.minX >= rect.maxX || rect.minZ >= rect.maxZ)) throw new Error('Entry deck requires a positive footprint');
  const { game, sky, player, registry } = world;
  const entry = WorldEntry.admit(driftwoodProduct().section('world/scenes').entry, { scenes, root: game.scene, tier: game.tier });
  const [{ cutTerrain }, , islandCover, coverCells] = await Promise.all([import('@wildshard/engine/physics/terrain'), loadFixedGeometry(undefined, game.registrationScope),loadIslandCover(),readDriftwoodBlob(`world/cover/cells/${TIER}.bin`)]); // the deferred world code (cut, the live baked heightfield)
  islandCover.wear(world.terrain.mesh.geometry, 0); // E156: the ground wears the cover (its baked bytes, world/islandCover.ts)
  const sea = { level: LOWERED_SEA };
  const slice = slicer(30, progress);
  const assembly = fixed.assembly, total = 15 + assembly.piers.length;
  const stages = new BuildStages({ slice, total, parent: game.scene });
  progress?.set(0, total, 'Preparing world builders'); // between the builders below: a task ends once it has run ~30 ms (the pier … cove were one 0.3–0.5 s task)
  // G170: the ocean is clipped out under each whole road deck (the socket and its landing), not only the socket
  const deckRows = landings.map(({ edge }) => {
    const row = fixed.entryDecks.find(deck => deck.edge === edge);
    if (row === undefined) throw new Error('Missing admitted entry deck');
    return row;
  }), decks = deckRows.map(({ rect }) => rect);
  const oceanRows = driftwoodRows('custom/oceanSurface'), oceanLook = oceanRows.surface.look;
  const grid = createOwnedGeometry(oceanRows.files[buildTier()], { _depth: 'aDepth', _seed: 'aSeed' });
  const [, floor] = await Promise.all([grid.load(), fetch(oceanRows.files.floor, { cache: 'force-cache' }).then(async response => {
    if (!response.ok) throw new Error(`Baked sea floor load failed (${response.status})`);
    return new Uint16Array(await response.arrayBuffer());
  })]);
  if (oceanRows.files.level !== sea.level) throw new Error('The baked ocean is for another sea level');
  toonLookState(driftwoodProduct()).dayLight.uSeaLevel.value = sea.level;
  const ocean = new WaterSurface(oceanRows.surface, waterSurfaceLook(lentLooksOf(oceanLook), oceanLook))
    .draw(grid.take(), { level: sea.level, floor, dry: decks, lent: { night: toonLookState(driftwoodProduct()).dayLight.uToonNight } });
  game.scene.add(ocean.group);
  // the south entry road is a wooden pier over the water; the player spawns on its deck
  // E315 M1: the pier model (../runtime/models/pier.ts) placed through src/engine/models/place.ts, which registers piece `pier`
  // SF46: it starts past the entry socket and ramps up from road height (Jake's SF72 flare; generators/pierSites.ts)
  const placePier = async (id: string) => {
    const placed = await scenes.place(id);
    return { placed, group: placed.object, floorHeightAt: (x: number, z: number) => scenes.floorAt(id, x, z) };
  };
  const firstPier = assembly.piers[0]; if (firstPier === undefined) throw new Error('Missing entry pier');
  const pier = await placePier(firstPier.id);
  // G170: the four asphalt road decks over the water (the catalogue's entryDeck): the platform's socket floor carried on over the
  // declared entry landings (the shardfile's socket-landing proof, installed exactly as declared); each ramp rises from one
  registry.add({ id: 'entry-landings', name: 'Entry landings', category: 'props', file: 'src/shards/driftwood-isle/world/build.ts', surface: 'stone',
    colliders: landings.map(({ box }) => ({ ...box })), solidFloor: true,
    floor: (x, z) => (landings.some(({ box }) => Math.abs(x - box.x) <= box.hx && Math.abs(z - box.z) <= box.hz) ? 0 : undefined) });
  place(entryDeck, deckRows.map(({ placement: { x, y, z, yaw } }) => ({ x, y, z, yaw, params: { deck: 'world' } })), { ctx: modelContext(sky), draw: 'merged', registry,
    piece: { id: 'entry-decks', floor: (x, z) => floorAtRects(fixed.entryFloors, x, z, 'first'), solidFloor: true } });
  const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
  // the little sailboat you arrived in, moored alongside the pier by the spawn (E308: half way down); you can drop into it
  // E315 M1: the sailboat model (../models/boat.ts) placed through src/engine/models/place.ts, which registers
  // piece `boat`: it rides the swell, its colliders (in the boat's own frame) follow it on a kinematic body (P4)
  // SF46 (G164): lowered with everything else, it stays moored by the pier
  const boatPlaced = await scenes.place('harbour.boat'), moorings = new MooringLines(scenes.mesh('moorings.mesh'), [fixed.boat.cleats[0], fixed.boat.cleats[1]]);
  const boat = { placed: boatPlaced, group: boatPlaced.object, ropes: moorings.mesh, floorHeightAt: (x: number, z: number) => scenes.floorAt('harbour.boat', x, z),
    refreshPose: () => { moorings.lift(boatPlaced.object.position.y - fixed.boat.spec.waterY, Math.sin(boatPlaced.object.rotation.x)); } };
  game.scene.add(moorings.mesh);
  await stages.next('Pier and boat');
  // faceted shore boulders along the beach
  // Keep the model's authored copy facts over the finished world draw.
  const rocks = await stages.build('Shore boulders', async () => { await entry.run('shore'); return { placed: entry.placed('rocks.shore.copies') }; });
  // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
  const hut = await stages.build('Hut', () => sites.site('hut', 'world', sharedModelContext(sky, game), registry));
  // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
  const lookout = await stages.build('Lookout', () => sites.site('lookout', 'world', sharedModelContext(sky, game), registry));
  // the shipwreck with the cove's cargo, drift logs and reef rocks: declared copies drawn into the wreck site's meshes
  // (piece `wreck`: the site's colliders and floors; the Wreck cove set)
  const wreck = await stages.build('Wreck', async () => { await entry.run('wreck');
    return { group: scenes.group('wreck.root'), placed: entry.placedIn('wreck'), anchors: structuredClone(wreckBake.anchors), holdBounds: { ...wreckBake.holdBounds }, floorHeightAt: (x: number, z: number) => scenes.floorAt('wreck.ship', x, z) }; });
  // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
  const shrine = await stages.build('Shrine', async () => {
    const ctx = sharedModelContext(sky, game), { baseY, terrace } = fixed.shrine.world;
    const placed = sites.site('shrine', 'world', ctx, registry);
    const resources = scenes, graph = driftwoodRows('custom/fixedLayouts').nativeView.FIREFLY_LOOK, lit = hasLentLook(graph);
    resources.publish('shrine.root', placed.group);
    placed.group.add(createBuildingCloud(resources, { geometry: resources.lend(fixedDraw('shrineFireflies').copy()), material: lit ? resources.lend(lentLook(graph)) : null,
      seeds: false, name: 'shrine-fireflies', at: { point: 'shrine.root', offset: [0, baseY, 0] }, parent: 'shrine.root', center: [0, terrace - baseY, 0], radius: 18, order: 4, visible: lit }));
    const data = v.parse(v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema, initialDusk: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) }), JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await driftwoodProduct().file('world/building-life.json'))));
    const life = new LivingBuildings(resources, data.look); life.add(data.life); life.setDusk(data.initialDusk); life.update(0);
    return { ...placed, update: life.update.bind(life), setDusk: life.setDusk.bind(life) };
  });
  // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
  const jetties: Awaited<ReturnType<typeof placePier>>[] = [];
  for (const row of assembly.piers.slice(1)) {
    const jetty = await placePier(row.id); jetties.push(jetty); await stages.next(row.label);
  }
  await slice();
  if (fixed.foliage.seed !== manifest.seed) throw new Error('Foliage placements require their authored seed');
  const foliage = fixed.foliage.tiers[game.tier];
  const bushes = await stages.build('Bushes', async () => { await entry.run('bushes'); return { placed: entry.placed(`foliage.bushes.${game.tier}`), mesh: scenes.mesh('hibiscus.mesh') }; });
  // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
  const gulls = await stages.build('Gulls', () => createAmbientFlock(driftwoodRows('custom/gullFlock'), { name: fixed.nativeView.GULL_GRAPH_LOOK, geometry: fixedDraw('gull').copy(), material: lentLook(fixed.nativeView.GULL_GRAPH_LOOK).clone(), castShadow: true }, fixed.gullPerches), { objects: value => [value.group] });
  // sand paths between the POIs: plank steps up the crag, rope fences, signposts
  const trail = driftwoodRows('custom/trailside'), trailMesh = scenes.mesh('trail.mesh'), trailContext = modelContext(sky), trailPlaced: Placed[] = [];
  if (trail.posts.pls.length > 0) trailPlaced.push(place(fencePost, trail.posts.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.posts.boxes) }, piece: { id: 'trail-fence-posts' } }));
  if (trail.signs.pls.length > 0) trailPlaced.push(place(signpost, trail.signs.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.signs.boxes) }, piece: { id: 'trail-signposts' } }));
  if (trail.planks.pls.length > 0) trailPlaced.push(place(plankStep, trail.planks.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.planks.boxes) }, piece: { id: 'trail-steps' } }));
  const trailside = { mesh: trailMesh, placed: trailPlaced };
  // E315 M1: its fence posts, signposts and plank steps are models placed drawnInto the trail's weld (pieces `trail-*`, their
  // colliders with them); the trail's own piece keeps its steps' and stairs' treads
  await stages.next('Trailside');
  // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
  const bridge = await stages.build('Rope bridge', () => placeRopeBridge(sky, assembly.bridge, registry));
  // coral, kelp, starfish and a fish school on the lagoon shelf (what you dive for)
  const seabed = await stages.build('Seabed', () => {
    const mesh = scenes.mesh('reef.mesh'), update = followToonLook(driftwoodProduct(), fixed.nativeView.REEF_LOOK);
    const s = REEF_LAYOUT.school, swim = SEABED.swim, centre = { x: s.x, y: s.y, z: s.z };
    const school = createAmbientFlock({ ...swim, count: s.n, wheeling: { ...swim.wheeling, centre: { x: s.x, z: s.z }, radius: s.r, altitude: [s.y, s.y] } },
      { name: SEABED.fishMesh, geometry: fixedDraw('reefFish').copy().rotateY(Math.PI), material: lowPolyLookMaterial(sky, 'still') });
    const tint = new THREE.Color();
    for (const [i, fish] of s.fish.entries()) school.mesh.setColorAt(i, tint.setHex(fish.colour));
    return { mesh, fish: school.mesh, tick: (dt: number) => { update(); school.update(dt, centre); } };
  }, { objects: value => [value.mesh, value.fish] });
  // coconut palms: where they stand (the palm itself is a model, placed below — one draw call, fronds sway in update)
  const palmSpecs = [...foliage.palms.specs];
  await stages.next('Palm placement');
  // Wreck Cove dressing: tidepools (the reef crabs' homes), the cascade + plunge pool, the glowing cave mouth
  // E315 M1: the cove is world (piece `cove`); its reef rocks are the reef-rock model
  const coveRows = driftwoodRows('custom/fixedLayouts').cove, coveView = coveRows.composition;
  const coveSpec = structuredClone(coveRows.spec);
  const cove = { group: scenes.group(coveView.root), placed: [] as Placed[], crabSites: coveSpec.crabSites,
    anchors: structuredClone(coveRows.native.anchors), update: followToonLook(driftwoodProduct(), coveView.look) };
  cove.group.add(scenes.group(coveView.cascade));
  registry.add({ ...coveView.piece, object: cove.group,
    colliders: readColliderRows(coveRows.native.descs, { kinds: ['box', 'treads'], surfaces: ['rock'], requireSurface: true }),
    floor: (x, z) => floorAtRects(coveRows.floors, x, z, 'first') });
  cove.placed.push(await scenes.place('cove.reef'));
  cutTerrain(world.physics, structuredClone(coveRows.native.cuts)); // the drawn terrain pokes up through the sea cave: the physics ground doesn't
  await stages.next('Cove');
  await entry.run('palms'); // The registry borrows the compacted batch and its native boxes.
  const palms = { placed: entry.placed(`foliage.palms.${game.tier}`), mesh: scenes.mesh('palms.mesh'), update: updateWind };
  // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
  const coverComposition = await driftwoodProduct().json<CoverComposition>('world/cover-composition.json');
  const coverPlaced = await scenes.place(coverComposition.placement);
  for (const [kind, slot] of Object.entries(fixedGeometryGroups().cover)) scenes.publish(kind, fixedDraw(slot).copy());
  const cover = Object.assign(createStreamedCover(scenes, authoredCover.GROUND_COVER, coverCells), { placed: [coverPlaced] });
  cover.group.name = coverComposition.name;
  const coverLogs = scenes.mesh(coverComposition.mesh);
  Object.assign(coverLogs.userData, coverComposition.userData); cover.group.add(coverLogs);
  game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, viewer()), 'shard.driftwood.cover');
  ocean.foamAround(oceanRows.foam); // foam rings around every pile, rock and hull standing in the sea (Ocean W2; generators/oceanFoam.ts)
  await stages.next('Palms and ground cover');
  await macrotask();
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  // SF30 activation stays held until SF46 parity: keep the legacy model's live terrain, widths and owners exactly.
  const bridgeDeck = new RopeChain(world.physics, bridge.chainSpec());
  game.onFixed('post', () => { bridgeDeck.capture(); }, 'shard.driftwood.bridge.capture');
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — after the decks register,
  // so none where a deck carries the path (a board there pokes up through the bridge's planks); `ground.paths: 'plugin'`
  installPagePathRamps(registry, { id: 'paths', name: 'Paths' });
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52), drawn by the client plan's baked tiles (world.baked, G532 (4)):
  // here its ground wears the cover it carries, its cover fades into the cover's ground map, the monkeys climb its palms
  await slice(stages.completed + 1, total, 'Bridge physics and paths');
  const island = baked.get('cove'); if (island === undefined) throw new Error('Missing baked cove');
  const looks = fixed.nativeView.ISLAND_LOOKS, reach = fixed.nativeView.ISLAND_TIERS[TIER];
  island.tiles.forEach((tile, i) => { islandCover.wear(tile.geometry, i + 1); });
  for (const [id, c] of [[looks.cover, reach.cover], [looks.coverBig, reach.big]] as const) {
    setLentParam(id, 'fade', [c.near + c.grow, c.far, c.grow]); setLentParam(id, 'groundRect', [...islandCover.groundRect]); setLentTexture(id, 'groundMap', islandCover.ground);
  }
  await entry.run('smallRocks'); // E315 M1: the small-rock model's declared copies, merged into the rocks scene's small weld
  const smallRocks = scenes.mesh('rocks.small');
  palmSpecs.push(...fixed.foliage.islandPalms);
  await slice(total, total, 'Baked island');
  gpuOnlyTrees([ocean.group, pier.group, ...jetties.map(jetty => jetty.group), boat.group, boat.ropes, rocks.placed.object, hut.group, lookout.group,
    wreck.group, shrine.group, bushes.mesh, gulls.group, trailside.mesh, bridge.placed.object, seabed.mesh, seabed.fish, cove.group, palms.mesh, cover.group, island.group, smallRocks], 'driftwood.world', ['position']);
  return { ocean, pier, jetties, boat, rocks, hut, lookout, wreck, shrine, bushes, gulls, trailside, bridge, seabed, palmSpecs, cove, palms, cover, bridgeDeck };
}

const built = new WeakMap<object, DriftwoodWorld>();
/** The plugin hands its world to the staged shell (keyed by the build's `ShardRuntime`). */
export function keepDriftwoodWorld(runtime: object, world: DriftwoodWorld): void { built.set(runtime, world); }
/** main.ts's readers until S4.2–S4.4 move them into the plugin: Driftwood's world, or nothing built off Driftwood. */
export function driftwoodWorld(runtime: object): DriftwoodWorld { return built.get(runtime) ?? noDriftwoodWorld(); }

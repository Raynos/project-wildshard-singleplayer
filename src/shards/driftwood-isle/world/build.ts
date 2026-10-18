import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { driftwoodRows, driftwoodProduct, driftwoodTierShadows } from '../runtime/boot/rows';
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
import { barrel, crate, ropeCoil } from '../runtime/models/cargo';
import { shipwreck, sites, fencePost, signpost, plankStep, shoreBoulder, reefRock } from '../models/catalogue';
import wreckBake from '../data/wreckBake.json' with { type: 'json' };
import { BuildStages, macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import { floorAtRects, type BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { pathRampDescs } from '@wildshard/engine/physics/paths';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import manifest from '../discovery.generated';
import { WaterSurface, waterSurfaceLook } from '@wildshard/sdk/looks/waterSurface';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { MooringLines } from '../runtime/props/mooringLines';
import rockMetadata from '../boot/modelCatalogue.generated.json' with { type: 'json' };
import * as v from 'valibot';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import { createBuildingCloud } from '@wildshard/game/shardfile/buildingCloud';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { hasLentLook, lentLook, lentLooksOf } from '@wildshard/sdk/looks/lentLooks';
import { updateWind } from '@wildshard/engine/world/wind';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import SEABED from '../data/seabedLook.json' with { type: 'json' };
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };
import { createAmbientFlock, type AmbientFlockDraw } from '@wildshard/sdk/looks/ambientFlock';
import { placeRopeBridge } from './RopeBridge';
import type { CustomSections, CoverComposition, EntryLandings } from '../runtime/productSections.generated.d.ts';
import { followToonLook, toonLookState } from '@wildshard/game/looks/toonLook';
import { createStreamedCover, type StreamedCoverHandle } from '@wildshard/game/looks/streamedCover';
import authoredCover from '../data/groundCover.json' with { type: 'json' };
import type { BlenderIsland } from './BlenderIsland';
import { ENTRY_FOOTPRINTS, LOWERED_SEA, SHORE_INNER_FACE, type DryRect } from './sea';
import { entryDeck } from '../runtime/models/entryDeck';
import { modelContext, sharedModelContext } from '@wildshard/engine/models/model';
import { place, type ModelSite, type Placed } from '@wildshard/engine/models/place';

interface Pier { placed: Placed; group: THREE.Object3D; colliders: Collider[]; floorHeightAt: (x: number, z: number) => number | undefined }
interface Boat { placed: Placed; group: THREE.Object3D; ropes: THREE.Mesh; colliders: Collider[]; refreshPose: () => void; floorHeightAt: (x: number, z: number) => number | undefined }
interface Seabed { mesh: THREE.Mesh; fish: THREE.InstancedMesh; tick: (dt: number) => void }
type PalmSpec = CustomSections['custom/fixedLayouts']['foliage']['tiers']['phone']['palms']['specs'][number];

type EntryLanding = EntryLandings['rows'][number];

type Shrine = ModelSite & Pick<LivingBuildings, 'update' | 'setDusk'>;

/** What the world build hands the rest of the level (today's `dressing` handle in main.ts, plus the deck and the cove). */
export interface DriftwoodWorld {
  ocean: WaterSurface | null; pier: Pier | null; jetties: Pier[]; boat: Boat | null; rocks: { placed: Placed; colliders: Collider[] } | null;
  hut: ModelSite | null; lookout: ModelSite | null; wreck: { group: THREE.Group; placed: Placed[]; colliders: Collider[]; anchors: typeof wreckBake.anchors; holdBounds: typeof wreckBake.holdBounds; floorHeightAt: (x: number, z: number) => number | undefined } | null; shrine: Shrine | null; bushes: { placed: Placed; mesh: THREE.Mesh } | null;
  gulls: AmbientFlockDraw | null; trailside: { mesh: THREE.Mesh; colliders: Collider[]; placed: Placed[] } | null; bridge: ReturnType<typeof placeRopeBridge> | null; seabed: Seabed | null;
  palmSpecs: PalmSpec[]; cove: { group: THREE.Group; placed: Placed[]; crabSites: CustomSections['custom/fixedLayouts']['cove']['spec']['crabSites']; anchors: CustomSections['custom/fixedLayouts']['cove']['native']['anchors']; update: () => void } | null; palms: { placed: Placed; mesh: THREE.Mesh; colliders: Collider[]; update: typeof updateWind } | null; cover: (StreamedCoverHandle & { placed: Placed[] }) | null;
  bridgeDeck: RopeChain | null; blenderIsland: BlenderIsland | null;
}

/** SF46 (G164, shipped by G172): how the world is built with the whole island lowered (the terrain and everything on it
 *  follow the manifest's dropped field, ./sea.ts): the sea at road level, each pier and jetty starting past its entry's
 *  asphalt socket with a ramp up from the socket's road height (their sites: generators/pierSites.ts). */
export interface DriftwoodLowered {
  readonly level: number;
  /** the declared sea row's dry sockets (the swim body's clip, ./sea.ts); the ocean's draw clips each whole deck (G170) */
  readonly dry: readonly DryRect[];
  /** how far inside a confining grid cell's edge the sea stops (G149: the shore revetment's inner face) */
  readonly edgeInset: number;
  /** G164: the shardfile's declared entry landings (world/sea.ts), installed exactly as declared; G170: each is the inner
   *  end of an asphalt road deck (./entryDeck.ts) that carries the socket on over it, and a pier / jetty ramps up from it */
  readonly landings: readonly EntryLanding[];
}
/** G164's lowered world: the sea at road level */
const loweredWorld = { level: LOWERED_SEA, dry: ENTRY_FOOTPRINTS, edgeInset: SHORE_INNER_FACE };

/** The handle off Driftwood: nothing built (main.ts's readers keep their `?.` until S4.2–S4.4 move them). */
export function noDriftwoodWorld(): DriftwoodWorld {
  return { ocean: null, pier: null, jetties: [], boat: null, rocks: null, hut: null, lookout: null, wreck: null, shrine: null,
    bushes: null, gulls: null, trailside: null, bridge: null, seabed: null, palmSpecs: [], cove: null, palms: null, cover: null,
    bridgeDeck: null, blenderIsland: null };
}

/** main.ts:366-467's Driftwood builders, lowered as one by G164 (`sea` is the lowered sea at road level). */
export async function buildDriftwoodWorld(world: World, viewer: () => THREE.Vector3, progress: StepProgress | undefined, scenes: SceneHandles): Promise<DriftwoodWorld> {
  const lowered: DriftwoodLowered = { ...loweredWorld, landings: (await driftwoodProduct().json<EntryLandings>('world/entry-landings.json')).rows }, fixed = driftwoodRows('custom/fixedLayouts');
  if (fixed.entryDecks.some(({ rect }) => rect.minX >= rect.maxX || rect.minZ >= rect.maxZ)) throw new Error('Entry deck requires a positive footprint');
  const { game, sky, player, registry } = world;
  const [{ cutTerrain }, { normalAt, TRAILS }, , islandCover, coverCells] = await Promise.all([import('@wildshard/engine/physics/terrain'), import('@wildshard/engine/world/Heightfield'), loadFixedGeometry(undefined, game.registrationScope),loadIslandCover(),readDriftwoodBlob(`world/cover/cells/${TIER}.bin`)]); // the deferred world code (cut, the live baked heightfield)
  islandCover.wear(world.terrain.mesh.geometry, 0); // E156: the ground wears the cover (its baked bytes, world/islandCover.ts)
  const sea = { level: lowered.level };
  // the built things' legacy boxes, for the ocean's foam rings (every one registers itself: models through
  // src/engine/models/place.ts, the world's welds — the trail, the cove — as world pieces, E315)
  const statics: Collider[] = [];
  const slice = slicer(30, progress);
  const assembly = fixed.assembly, total = 15 + assembly.piers.length;
  const stages = new BuildStages({ slice, total, parent: game.scene, collect: statics });
  progress?.set(0, total, 'Preparing world builders'); // between the builders below: a task ends once it has run ~30 ms (the pier … cove were one 0.3–0.5 s task)
  // G170: the ocean is clipped out under each whole road deck (the socket and its landing), not only the socket
  const deckRows = lowered.landings.map(({ edge }) => {
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
  const placePier = async (id: string): Promise<Pier> => {
    const row = rockMetadata.piers.find(candidate => candidate.id === id);
    if (row === undefined) throw new Error(`Missing authored pier: ${id}`);
    const placed = await scenes.place(id);
    return { placed, group: placed.object, colliders: structuredClone(row.boxes), floorHeightAt: (x, z) => scenes.floorAt(id, x, z) };
  };
  const firstPier = assembly.piers[0]; if (firstPier === undefined) throw new Error('Missing entry pier');
  const pier = await placePier(firstPier.id);
  // G170: the four asphalt road decks over the water (./entryDeck.ts): the platform's socket floor carried on over the
  // declared entry landings (the shardfile's socket-landing proof, installed exactly as declared); each ramp rises from one
  registry.add({ id: 'entry-landings', name: 'Entry landings', category: 'props', file: 'src/shards/driftwood-isle/world/sea.ts', surface: 'stone',
    colliders: lowered.landings.map(({ box }) => ({ ...box })), solidFloor: true,
    floor: (x, z) => (lowered.landings.some(({ box }) => Math.abs(x - box.x) <= box.hx && Math.abs(z - box.z) <= box.hz) ? 0 : undefined) });
  place(entryDeck, deckRows.map(({ placement }) => placement), { ctx: modelContext(sky), draw: 'merged', registry,
    piece: { id: 'entry-decks', floor: (x, z) => floorAtRects(fixed.entryFloors, x, z, 'first'), solidFloor: true } });
  statics.push(...deckRows.map(({ slab }) => slab));
  statics.push(...pier.colliders);
  const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
  // the little sailboat you arrived in, moored alongside the pier by the spawn (E308: half way down); you can drop into it
  // E315 M1: the sailboat model (../models/boat.ts) placed through src/engine/models/place.ts, which registers
  // piece `boat`: it rides the swell, its colliders (in the boat's own frame) follow it on a kinematic body (P4)
  // SF46 (G164): lowered with everything else, it stays moored by the pier
  const boatPlaced = await scenes.place('harbour.boat'), moorings = new MooringLines(scenes.mesh('moorings.mesh'), [fixed.boat.cleats[0], fixed.boat.cleats[1]]);
  const boat = { placed: boatPlaced, group: boatPlaced.object, ropes: moorings.mesh, floorHeightAt: (x: number, z: number) => scenes.floorAt('harbour.boat', x, z), colliders: fixed.boat.walls.map(row => ({ ...row, rot: -0 })),
    refreshPose: () => { moorings.lift(boatPlaced.object.position.y - fixed.boat.spec.waterY, Math.sin(boatPlaced.object.rotation.x)); } };
  statics.push(...boat.colliders);
  game.scene.add(moorings.mesh);
  await stages.next('Pier and boat');
  // faceted shore boulders along the beach
  // Keep the model's authored copy facts over the finished world draw.
  const rocks = await stages.build('Shore boulders', async () => {
    const rows = rockMetadata.rockWorld.shore, mesh = scenes.mesh('rocks.shore');
    mesh.name = shoreBoulder.id;
    const { colliders: _hulls, ...metadata } = shoreBoulder;
    const placed = place(metadata, rows.map(row => ({ x: row.matrix[12] ?? 0, y: row.matrix[13] ?? 0, z: row.matrix[14] ?? 0, matrix: new THREE.Matrix4().fromArray(row.matrix), params: row.params })),
      { ctx: modelContext(sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true }, drawnInto: { object: mesh, boxes: Float32Array.from(rows.flatMap(row => row.box)),
        colliders: readColliderRows(rows.flatMap(row => row.colliders), { kinds: ['hull'], surfaces: [] }) } });
    await placed.registered; game.scene.add(mesh);
    return { placed, colliders: structuredClone(fixed.shoreBoulders.boxes) };
  }, { values: value => value.colliders });
  // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
  const hut = await stages.build('Hut', () => sites.site('hut', 'world', sharedModelContext(sky, game), registry), { values: value => value.colliders });
  // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
  const lookout = await stages.build('Lookout', () => sites.site('lookout', 'world', sharedModelContext(sky, game), registry), { values: value => value.colliders });
  // E315 M1: the declared shipwreck model with the cove's cargo, drift logs and reef
  // rocks, placed drawnInto the wreck site's meshes (piece `wreck`: the site's colliders; the Wreck cove set)
  const wreck = await stages.build('Wreck', async () => {
    const group = scenes.group('wreck.root'), row = wreckBake, ctx = modelContext(sky), floorHeightAt = (x: number, z: number) => floorAtRects(row.floors, x, z, 'first');
    const placed = [place(shipwreck, [{ x: row.spec.x, y: row.floorY, z: row.spec.z, yaw: row.spec.heading, params: { site: row.spec } }], { ctx, draw: 'merged', registry,
      drawnInto: { object: group, boxes: Float32Array.from(row.shipBox), colliders: readColliderRows(row.descs, { kinds: ['box', 'capsule', 'treads'], surfaces: [] }) }, piece: { id: 'wreck', floor: floorHeightAt, solidFloor: true } })];
    const { barrels, crates, coils, rocks: reefRocks } = row.catalogue;
    placed.push(place(barrel, barrels.placements, { ctx, draw: 'merged', registry, drawnInto: { object: group, boxes: Float32Array.from(barrels.boxes) }, piece: { id: 'wreck-barrels' } }));
    placed.push(place(crate, crates.placements, { ctx, draw: 'merged', registry, drawnInto: { object: group, boxes: Float32Array.from(crates.boxes) }, piece: { id: 'wreck-crates' } }));
    placed.push(place(ropeCoil, coils.placements, { ctx, draw: 'merged', registry, drawnInto: { object: group, boxes: Float32Array.from(coils.boxes) }, piece: { id: 'wreck-coils' } }));
    placed.push(await scenes.place('wreck.logs'));
    const { colliders: _reefHulls, ...reefMetadata } = reefRock;
    placed.push(place(reefMetadata, reefRocks.placements, { ctx, draw: 'merged', registry, drawnInto: { object: group, boxes: Float32Array.from(reefRocks.boxes) }, piece: { id: 'wreck-reef-rocks' } }));
    return { group, placed, colliders: structuredClone(row.colliders), anchors: structuredClone(row.anchors), holdBounds: { ...row.holdBounds }, floorHeightAt };
  }, { objects: value => [value.group], values: value => value.colliders });
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
  }, { values: value => value.colliders });
  // the three jetties: three more placements of the pier model, pieces `jetty-0..2`
  const jetties: Pier[] = [];
  for (const row of assembly.piers.slice(1)) {
    const jetty = await placePier(row.id); statics.push(...jetty.colliders); jetties.push(jetty); await stages.next(row.label);
  }
  await slice();
  if (fixed.foliage.seed !== manifest.seed) throw new Error('Foliage placements require their authored seed');
  const foliage = fixed.foliage.tiers[game.tier];
  const bushes = await stages.build('Bushes', async () => {
    const placed = await scenes.place(`foliage.bushes.${game.tier}`), mesh = scenes.mesh('hibiscus.mesh');
    mesh.name = placed.model; mesh.castShadow = driftwoodTierShadows().bush; mesh.userData['islandDressingClipped'] = true;
    return { placed, mesh };
  }, { objects: value => [value.mesh] });
  // gulls: perched on the pier posts / bollards, the boat's bow and stern, the big shore rocks and the wet sand; flocks wheel over the lagoon
  const gulls = await stages.build('Gulls', () => createAmbientFlock(driftwoodRows('custom/gullFlock'), { name: fixed.nativeView.GULL_GRAPH_LOOK, geometry: fixedDraw('gull').copy(), material: lentLook(fixed.nativeView.GULL_GRAPH_LOOK).clone(), castShadow: true }, fixed.gullPerches), { objects: value => [value.group] });
  // sand paths between the POIs: plank steps up the crag, rope fences, signposts
  const trail = driftwoodRows('custom/trailside'), trailMesh = scenes.mesh('trail.mesh'), trailContext = modelContext(sky), trailPlaced: Placed[] = [];
  if (trail.posts.pls.length > 0) trailPlaced.push(place(fencePost, trail.posts.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.posts.boxes) }, piece: { id: 'trail-fence-posts' } }));
  if (trail.signs.pls.length > 0) trailPlaced.push(place(signpost, trail.signs.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.signs.boxes) }, piece: { id: 'trail-signposts' } }));
  if (trail.planks.pls.length > 0) trailPlaced.push(place(plankStep, trail.planks.pls, { ctx: trailContext, draw: 'merged', drawnInto: { object: trailMesh, boxes: Float32Array.from(trail.planks.boxes) }, piece: { id: 'trail-steps' } }));
  const trailside = { mesh: trailMesh, colliders: structuredClone(trail.colliders), placed: trailPlaced };
  // E315 M1: its fence posts, signposts and plank steps are models placed drawnInto the trail's weld (pieces `trail-*`, their
  // colliders with them); the trail's own piece keeps its steps' and stairs' treads
  statics.push(...trailside.colliders);
  await stages.next('Trailside');
  // the rope bridge over the tidal creek on the hut → lookout path (its deck: a RopeChain, below)
  const bridge = await stages.build('Rope bridge', () => placeRopeBridge(sky, assembly.bridge, registry), { values: value => value.colliders });
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
  if (coveRows.catalogue.placements.length > 0) {
    const { colliders: _reefHulls, ...metadata } = reefRock;
    cove.placed.push(place(metadata, coveRows.catalogue.placements, { ctx: modelContext(sky), draw: 'merged', registry,
      drawnInto: { object: scenes.mesh(coveView.rocks), boxes: Float32Array.from(coveRows.catalogue.boxes) }, piece: { id: coveView.reefPiece } }));
  }
  statics.push(...structuredClone(coveRows.native.colliders));
  cutTerrain(world.physics, structuredClone(coveRows.native.cuts)); // the drawn terrain pokes up through the sea cave: the physics ground doesn't
  await stages.next('Cove');
  const palms = { placed: await scenes.place(`foliage.palms.${game.tier}`), mesh: scenes.mesh('palms.mesh'), colliders: structuredClone(rockMetadata.foliage[game.tier].palms), update: updateWind };
  palms.mesh.name = palms.placed.model; palms.mesh.userData['islandDressingClipped'] = true;
  game.scene.add(palms.mesh); // The registry borrows the compacted batch and its native boxes.
  statics.push(...palms.colliders);
  // ground cover near the player (M4): instanced grass / ferns / flowers / pebbles, refilled as you walk
  const coverComposition = await driftwoodProduct().json<CoverComposition>('world/cover-composition.json');
  const coverPlaced = await scenes.place(coverComposition.placement);
  for (const [kind, slot] of Object.entries(fixedGeometryGroups().cover)) scenes.publish(kind, fixedDraw(slot).copy());
  const cover = Object.assign(createStreamedCover(scenes, authoredCover.GROUND_COVER, coverCells), { placed: [coverPlaced] });
  cover.group.name = coverComposition.name;
  const coverLogs = scenes.mesh(coverComposition.mesh);
  Object.assign(coverLogs.userData, coverComposition.userData); cover.group.add(coverLogs);
  game.scene.add(cover.group); game.onUpdate((dt) => cover.update(dt, viewer()), 'shard.driftwood.cover');
  ocean.foamAround(statics); // foam rings around every pile, rock and hull standing in the sea (Ocean W2)
  await stages.next('Palms and ground cover');
  await macrotask();
  // the rope bridge's deck hangs as a jointed chain (PHYSICS.md): it sags and bounces under you, the drawn planks follow
  // SF30 activation stays held until SF46 parity: keep the legacy model's live terrain, widths and owners exactly.
  const bridgeDeck = new RopeChain(world.physics, bridge.chainSpec());
  game.onFixed('post', () => { bridgeDeck.capture(); }, 'shard.driftwood.bridge.capture');
  // the paths as walkways where they cross ground steeper than the motor climbs (PHYSICS P4) — after the decks register,
  // so none where a deck carries the path (a board there pokes up through the bridge's planks); `ground.paths: 'plugin'`
  registry.add({ id: 'paths', name: 'Paths', category: 'ground', file: 'src/engine/physics/paths.ts', surface: 'ground',
    colliders: pathRampDescs(TRAILS, heightAt, (x, z) => normalAt(x, z)[1], { carried: (x, z) => registry.floorAt(x, z) !== undefined }) });
  // the Blender-built spawn cove (DRIFTWOOD-REMASTER X2, E52; the only island since E136): it sits on the procedural cove.
  // The island and tier cover file are required boot content. Let the level loader dispose and
  // report a failed world stage; never substitute procedural scenery for damaged assets.
  await slice(stages.completed + 1, total, 'Bridge physics and paths');
  const blenderIsland = await import('./BlenderIsland').then(async ({ BlenderIsland: B }) => {
    const island = await B.install({
      scene: game.scene, sky, registry, scenes, palmSpecs, islandCover,
    });
    game.onUpdate(() => { island.update(sky); }, 'shard.driftwood.blenderIsland');
    return island;
  });
  await slice(total, total, 'Baked island');
  gpuOnlyTrees([ocean.group, pier.group, ...jetties.map(jetty => jetty.group), boat.group, boat.ropes, rocks.placed.object, hut.group, lookout.group,
    wreck.group, shrine.group, bushes.mesh, gulls.group, trailside.mesh, bridge.placed.object, seabed.mesh, seabed.fish, cove.group, palms.mesh, cover.group, blenderIsland.group], 'driftwood.world', ['position']);
  return { ocean, pier, jetties, boat, rocks, hut, lookout, wreck, shrine, bushes, gulls, trailside, bridge, seabed, palmSpecs, cove, palms, cover, bridgeDeck, blenderIsland };
}

const built = new WeakMap<object, DriftwoodWorld>();
/** The plugin hands its world to the staged shell (keyed by the build's `ShardRuntime`). */
export function keepDriftwoodWorld(runtime: object, world: DriftwoodWorld): void { built.set(runtime, world); }
/** main.ts's readers until S4.2–S4.4 move them into the plugin: Driftwood's world, or nothing built off Driftwood. */
export function driftwoodWorld(runtime: object): DriftwoodWorld { return built.get(runtime) ?? noDriftwoodWorld(); }

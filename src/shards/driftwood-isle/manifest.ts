import { DRIFTWOOD_BUDGET_INPUTS } from './budgets';
import { DRIFTWOOD_RUNTIME_COST } from './data/runtimeCost';
import { area as BLENDER_AREA } from './world/blenderArea';
import { DRIFTWOOD_FAUNA_PLANS } from './creatures/tables';
import exploreWorld from './explore/world-driftwood-isle.webp';
import exploreModels from './explore/models-driftwood-isle.webp';
import exploreSets from './explore/sets-driftwood-isle.webp';
import explorePractice from './explore/practice-driftwood-isle.webp';
import compareSpawnLive from './explore/compare/driftwood-spawn-live.jpg';
import compareSpawnTarget from './explore/compare/driftwood-spawn-target.jpg';
import compareRightLive from './explore/compare/driftwood-right-live.jpg';
import compareRightTarget from './explore/compare/driftwood-right-target.jpg';
import compareOverlookLive from './explore/compare/driftwood-overlook-live.jpg';
import compareOverlookTarget from './explore/compare/driftwood-overlook-target.jpg';
/**
 * Driftwood Isle — the second shard: a small faceted low-poly island in a bright turquoise ocean
 * on grid (−1, +6). Wind Waker in spirit: flat-shaded vertex-coloured geometry, no textures at
 * all (`style: 'toon'`), a wooden pier at the south edge, a moored sailboat, island boar hunted
 * with a wooden sword. Tropical midday sky, the ringed planet high over the water.
 *
 * Build order (docs/tasks/ASKS.md D12): water + pier → boat → beach → the island piece by piece.
 * The landscape below is the sea floor; the island rises out of it as the pieces land.
 */
import { CHUNK_HALF, ROAD_LENGTH } from '@wildshard/engine/core/config';
import { smoothstep, clamp } from '@wildshard/engine/core/noise';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest, OceanDef } from '@wildshard/game/shard/manifest';
import { lateReads } from './boot/lateReads';
import { bootSources } from './boot/sources';
import { DRIFTWOOD_SEA, LOWERED_SEA, SHORE_LEVEL, WORLD_DROP, droppedTerrain } from './world/sea';
import thumbnail from './thumbs/driftwood-isle.jpg';
import heroPortrait from './thumbs/driftwood-isle-portrait.jpg';
import heroLandscape from './thumbs/driftwood-isle-landscape.jpg';

const SEED = 0x5ea1;

/** Sea surface. The four entry roads are forced to y = 0 by `buildTerrain`, so a level a little above 0 turns them into submerged sandbars under the piers. */
const EXPLORE = { art: { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice }, compare: [
    { id: 'spawn', label: 'Spawn · pier', model: 'driftwood-spawn', target: 'art/driftwood-isle/round-4-remaster/mockup-1-fp-front.jpg', live: compareSpawnLive, image: compareSpawnTarget },
    { id: 'right', label: 'Spawn · right', model: 'driftwood-right', target: 'art/driftwood-isle/round-4-remaster/mockup-3-fp-right.jpg', live: compareRightLive, image: compareRightTarget },
    { id: 'overlook', label: 'Island overlook', model: 'driftwood-overlook', target: 'art/driftwood-isle/round-4-remaster/mockup-6-diag-front.jpg', live: compareOverlookLive, image: compareOverlookTarget },
  ] } satisfies NonNullable<ShardManifest['explore']>;

export const OCEAN: OceanDef = {
  // the island's waterline in world space: the authored +0.8 m, less G164's whole-world drop: road height
  // (./world/sea.ts); the landscape below is authored round SHORE_LEVEL
  level: LOWERED_SEA,
  // albedo (linear); the sun + sky here add up to ~3× so the palette stays under 0.5 or it tone-maps to white
  shallowColor: [0.0, 0.8, 0.88],
  deepColor: [0.008, 0.15, 0.52],
  deepDepth: 6,
};

/** Where the south pier lands (the crescent beach) — the island's origin for the later pieces. */
export const PIER = { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckAbove: 1.2 };
/** the other three jetties at the N / W / E edge midpoints (the mandated entry roads are their sandbars); the E one runs on into Wreck Cove.
 *  `landing`: the deck runs on to the dry sand and ramps down onto it, like the south pier (agent playtest round 1, #6: the
 *  north jetty ended 1.45 m over the beach, a step the hoverboard could not climb back up) */
export const JETTIES: readonly { readonly x: number; readonly z: number; readonly rot: number; readonly length: number; readonly landing?: boolean }[] = [
  { x: 0, z: CHUNK_HALF, rot: Math.PI, length: ROAD_LENGTH, landing: true },
  { x: -CHUNK_HALF, z: 0, rot: Math.PI / 2, length: 95 },
  { x: CHUNK_HALF, z: 0, rot: -Math.PI / 2, length: 72 }, // ends 30 m short of the wreck's stern (x 149) — 108 ran straight through it
];
/** the sand paths between the POIs (also `trails[4..]`): [pier → hut], [hut → lookout], [fork → wreck], [hut → shrine] */
export const PATHS: [number, number][][] = [
  // E308: it starts where the built pier's landing steps down onto the sand (z ≈ −152, not on the deck over the lagoon)
  // and runs the fenced corridor off it (Trailside's landing fences) to the plateau ramp's foot. The maps draw this line;
  // the terrain's bed keeps PIER_PATH_BED below
  [[0, -152], [-8, -145], [-18, -143], [-30, -142], [-30, -104], [-24, -80], [-20, -68]],
  // hut → lookout: over the rope bridge end to end (BRIDGE.a → .b), then up the headland ramp's diagonal with its plank
  // steps and fence (Trailside), not beside them over the crags (PHYSICS.md P9: the old line climbed 2–3 m a metre).
  // E354: it ends at the lookout's stair foot (88, 88): its last 2.8 m ran on under the stair's treads (1.4–1.9 m up)
  [[-20, -68], [-8, -50], [14, -24], [17, 8], [15, 12], [16, 14], [32, 30], [34, 32], [46, 46], [86, 86], [88, 88]],
  [[17, 8], [60, 0], [100, -2], [140, 4]],
  // E354: from the fenced approach's end (−94, 88) it turns onto the shrine's axis and up the pool causeway's three
  // steps (between the front glyph pillars): it ran on to (−96, 96), through the south-west pillar into the pool's side
  [[-20, -68], [-52, -30], [-72, 20], [-88, 70], [-94, 88], [-87.5, 93.7], [-89.3, 96.1]],
];
/** the pier → hut path's sand bed as the terrain carves it (`trails`), the line it had before E308: the Blender spawn cove
 *  is baked from these heights (blenderArea.ts), so re-cutting the bed along PATHS[0] would lift or sink the cove's
 *  ground by up to 0.35 m at the pier's foot until the cove is re-baked */
const PIER_PATH_BED: [number, number][] = [[0, -188], [-8, -172], [-30, -142], [-30, -104], [-24, -80], [-20, -68]];
/** the island disc: centre and nominal shoreline radius (the shoreline is noise-warped ±30 m) */
export const ISLAND = { x: 0, z: 12, r: 188 };
/** the hut's plateau: a flat-topped crag in the south-centre; the hut stands at its middle */
export const PLATEAU = { x: -24, z: -62, r: 46, h: 13 };
/** the hut site on the plateau (rot: which way the door faces — south, toward the pier) */
export const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };
/** the north-east massif: a tall craggy headland (a broad shoulder + a high top) with the lookout on its summit */
export const HEADLAND = { x: 98, z: 96, r: 48, h: 22, shoulderR: 80, shoulderH: 9 };
/** Wreck Cove: a bay bitten out of the east shore; the wreck lies half sunk on the reef at its mouth, bow run up the sand, heeled toward the beach (Wreck.ts) */
export const COVE = { ang: -0.02, depth: 46, width: 0.5 };
export const WRECK = { x: 153, z: 2, heading: 2.7, roll: -0.2, pitch: 0.05, floorY: 1.45 - WORLD_DROP }; // G164: the hold floor drops with the world
/** the ring shrine on a knoll in the north-west jungle (rot: its stair faces south-east toward the hut path; its back points at the planet, so the ring frames it from the stair head) */
export const SHRINE = { x: -98, z: 108, rot: 2.51 };
/** the tidal creek across the hut → lookout path (a ravine cut below sea level, so the lagoon runs into it) and the rope bridge over it */
export const GULLY = { x: 24, z: 22, width: 11, depth: 7, length: 64 };
export const BRIDGE = { a: [16, 14] as [number, number], b: [32, 30] as [number, number], sag: 0.9 };
/** the lookout tower on the headland summit (rot: the stair faces south-west, toward the hut) */
export const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };

/** E308 (Jake's pick B, art/onboarding/round-1-first-minutes/board-3-start-length.jpg): half way down the pier (it runs
 *  ~100 m, sea end z −250 → the landing on the sand z ≈ −152), facing north up it, so the first frame is still the island
 *  from the sea: 38 s walking / 22 s sprinting to Wendell, was 49 / 27 from 15 m in */
const SPAWN = { x: 0, z: -194, yaw: Math.PI };
/** the sailboat you arrived in, moored alongside the pier's west side by the spawn (it was at the sea end, 9 m behind the
 *  old spawn; E308, Jake: "move the boat to halfway down the pier too") — bow out to sea, its bow line on the pennant's piling */
export const BOAT_MOOR = { x: -4.2, z: SPAWN.z - 9 };
/** metres from the pier's sea end to the piling that flies the pennant (E111; E308 moved it from the sea-end bollard to
 *  half way down, just past the boat's bow — Jake: "also the flag on the pier also halfway down") */
export const PIER_PENNANT_AT = 43.2;
/** the practice crab (E308, Jake's pick A, board-2-practice-target.jpg): one lone small reef crab on the sand path at the
 *  pier's foot, where the landing's fenced corridor turns for the plateau ramp — the first enemy a new player meets */
export const PRACTICE_CRAB = { x: -7, z: -143 };
/** the boar variants the island rolls (E318): the common four, never Pine Hollow's Scarback or Old Ironhide (whose drop is a gun) */

export const DRIFTWOOD_ISLE: ShardManifest = {
  runtimeCost: DRIFTWOOD_RUNTIME_COST,
  // Migrated verbatim from parity’s camera table; omitted y keeps the existing ground/land placement.
  dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'pier',x:0,z:-194,yaw:Math.PI,pitch:0},{name:'beach',x:-10,z:-150,yaw:4.3,pitch:0},{name:'wreck',x:105,z:0,yaw:-Math.PI/2,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (DRIFTWOOD_ISLE.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
  audio: { bed: 'island', samples: { loopGains: { island: 0.5 } }, ambience: 'ambience.driftwood', score: 'score.driftwood',
    preload: () => import('./runtime/audio/files').then((m) => m.createDriftwoodAudio()) },
  budgets: DRIFTWOOD_BUDGET_INPUTS,
  uses: ['dayCycle'],
  api: 1,
  kitLook: 'toon',
  hands: 'toon',
  // the Blender-baked cove (./world/blenderArea.ts): the export and BlenderIsland.ts clip at its lines
  blender: { area: BLENDER_AREA, models: [] },
  // the painted band above the sea (HorizonMatte); the engine keeps no per-shard strips table (E405 AG25)
  horizonStrips: { day: '/assets/horizon/driftwood-isle-day.webp', night: '/assets/horizon/driftwood-isle-night.webp', elMin: -4, elMax: 24 },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true },
  debugOptions: [],
  assetGlobs: ['public/assets/models/driftwood-blender/**', 'public/assets/models/driftwood-cc0/**', 'public/assets/models/driftwood-fp/**', 'public/assets/models/driftwood-hero/**', 'public/assets/gpu/models/driftwood-blender/**', 'public/assets/gpu/models/driftwood-hero/**', 'public/assets/gpu/baked/driftwood-isle/**', 'public/assets/horizon/driftwood-isle-*', 'public/assets/gpu/horizon/driftwood-isle-*', 'public/assets/lut/driftwood-isle.bin', 'public/assets/title/driftwood-isle-portrait.jpg', 'public/assets/sfx/driftwood-isle/**'],
  ktx2: () => import('./ktx2.generated'),
  boot: { audio: async () => (await import('./runtime/audio/files')).BOOT_AUDIO(), explore: { art: [...Object.values(EXPLORE.art), ...EXPLORE.compare.flatMap(({ live, image }) => [live, image])] }, precache: [], files: (tier) => Object.values(bootSources(tier)).flat(), sources: bootSources, lateReads }, // what its boot reads (./boot/sources.ts: no props of its own); the island's late reads (./boot/lateReads.ts)
  load: () => import('./plugin'), // E357 S4.1: the world build (./world/build.ts); the rest still runs in main.ts until S4.2–S4.4
  order: 1,
  // the phone's picture cuts (E189): the viewmodels in near depth slices, no god-ray pass while the sun is off screen,
  // one FXAA pass instead of SMAA's three and no god rays at all (Jake's picks, "no regression"); the island's own
  // scatter knobs are ./tiers.ts
  tiers: { phone: { slices: true, skipRaysOffscreen: true, aa: 'fxaa', godRays: false } },
  // the toon look (look/render.ts, E357 S4.3): the engine's clean chain
  render: async () => (await import('./look/render')).shardRender(),
  status: 'live',
  
  slug: 'driftwood-isle',
  next: 'nalati-grasslands',
  name: 'Driftwood Isle',
  label: '(−1, +6)',
  seed: SEED,
  treeCount: 0,
  accent: 'marigold', // G104: the HUD accent inside its grid cell
  biome: 'Low-poly island, open ocean', // the title card's one-line blurb (E318: a player's words, not the grid)
  blurb: 'A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.',
  card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
  style: 'toon',
  weapon: 'sword',
  loadout: { weapons: ['weapon.sword', 'weapon.sword-iron'], tools: ['tool.hoverboard'], start: ['weapon.sword', 'tool.hoverboard'],
    pickups: [{ id: 'weapon.sword-iron', at: 'wreck.deck' }] },
  // the castaway's skinned arms (E334, Jake's board-2 A / board-3 A): the wooden and the iron sword on the same hands, and
  // the same arms swimming (driftwood-isle/fpArms.ts); the engine's code-built sword and white gloves if the rig does not load
  sword: async () => {
    try {
      return await (await import('./fpArms')).castawayArms();
    } catch (error) {
      console.warn('driftwood-isle: the castaway arms did not load, the code-built sword stands in', error);
      return {};
    }
  },
  ocean: OCEAN,
  // Explore's hub art and its Compare pairs (the live capture against the mockup it chases; `target` is the mockup's source path)
  explore: EXPLORE,
  // its live models in the Model Explorer (E315 M5): the creatures it spawns, alive now or not, its people, its gear
  roster: async () => (await import('./roster')).ROSTER,
  // the maps draw the island's built world (E130): the sand paths, then the pieces' footprints from the registry (main.ts
  // registers them under these ids) — palms as crowns, the decks as planks, the hut / tower / wreck / zipline as timber, the
  // shrine as stone, the sea cave's vault as rock
  minimap: {
    // SF46 (G164): road height, so the grid's edge reader sees the lowered sea
    openWater: { level: LOWERED_SEA, deepDepth: OCEAN.deepDepth },
    outside: 'rgb(22,74,128)',
    paths: PATHS,
    pieces: [
      { ids: ['palms'], look: 'dot' },
      { ids: ['cove'], look: 'rock' },
      { ids: ['pier', 'jetty-*', 'bridge', 'boat'], look: 'planks' },
      { ids: ['hut', 'lookout', 'wreck', 'zipline'], look: 'timber' },
      { ids: ['shrine'], look: 'stone' },
    ],
  },
  pois: [
    { id: 'jetty', name: 'Jetty', x: 0, z: -CHUNK_HALF + 24, r: 16 },
    { id: 'hut', name: 'Hut', x: HUT.x, z: HUT.z, r: 12 },
    { id: 'shrine', name: 'Ring shrine', x: SHRINE.x, z: SHRINE.z, r: 16 },
    { id: 'lookout', name: 'Lookout', x: LOOKOUT.x, z: LOOKOUT.z, r: 12 },
    { id: 'wreck', name: 'Wreck cove', x: WRECK.x, z: WRECK.z, r: 20 },
    { id: 'bridge', name: 'Rope bridge', x: (BRIDGE.a[0] + BRIDGE.b[0]) / 2, z: (BRIDGE.a[1] + BRIDGE.b[1]) / 2, r: 12 },
  ],

  // the sea is a water body (app.world.water), registered at level.data: the edge step's Boundary and every sea reader ask it
  // G164: the field is authored round SHORE_LEVEL and lowered as one (droppedTerrain: heights,
  // waterline and the bake's datum)
  ground: { paths: 'plugin', water: [DRIFTWOOD_SEA], terrain: droppedTerrain(buildTerrain(SEED, {
    oceanLevel: SHORE_LEVEL,
    /**
     * The island: a noise-warped disc centred a little north of the chunk centre. `m` is signed
     * metres inside the shoreline. Out to sea the floor is 2.6 m down and shelves up over the last
     * 130 m (a wide, clear turquoise lagoon over sand — 1.5–2.5 m deep around the pier); the beach climbs from the water line to ~2.6 m over
     * 25 m, then the interior rises gently to grass at ~6 m. The plateau, cliffs and lookout are
     * added on top as their pieces land. Entry roads are forced to 0 by buildTerrain (sandbars).
     */
    landscape(x, z, { n, n2 }) {
      const dx = x - ISLAND.x, dz = z - ISLAND.z;
      const r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      let R = ISLAND.r + n.get(Math.cos(ang) * 1.7 + 3.3, Math.sin(ang) * 1.7) * 32 + n2.fbm(x * 0.006, z * 0.006, 3) * 22;
      R -= smoothstep(1 - COVE.width, 0.995, Math.cos(ang - COVE.ang)) * COVE.depth; // Wreck Cove bitten out of the east shore
      const m = R - r;
      const sea = SHORE_LEVEL;
      // the shelf and the beach keep a real slope through the water line (a smoothstep there would flatten
      // the shallows into a 20 m wide foam sheet)
      let h = m < 0
        ? -2.6 + clamp(1 + m / 130, 0, 1) ** 1.1 * (sea + 2.6)                             // a wide sandy lagoon: 1.5–2.5 m under the pier (clear turquoise over sand, the spawn mockup)
        : sea + clamp(m / 26, 0, 1) ** 0.85 * 1.8 + smoothstep(20, 90, m) * 3.6;            // beach, then the grassy interior
      h += n.fbm(x * 0.04, z * 0.04, 2) * 0.25 * smoothstep(-10, 15, m);       // small dune / ground bumps on land
      // the hut plateau: a flat-topped crag with a craggy (noise-warped) rim and a gentler ramp on the south side
      {
        const px = x - PLATEAU.x, pz = z - PLATEAU.z;
        const pr = Math.hypot(px, pz) + n2.get(px * 0.05 + 9, pz * 0.05) * 6;
        const south = smoothstep(0.2, 0.9, -pz / Math.max(1, Math.hypot(px, pz))) * smoothstep(14, 0, Math.abs(px + 6)); // a 12 m wide ramp toward the pier
        const rimW = 10 + south * 26;
        h += smoothstep(PLATEAU.r + rimW, PLATEAU.r - 4, pr) * PLATEAU.h;
        h += smoothstep(PLATEAU.r - 6, PLATEAU.r - 30, pr) * n.fbm(x * 0.03 + 4, z * 0.03, 2) * 0.6; // the top is not a table
      }
      // the north-east headland: a broad rocky shoulder and a high craggy top, a narrow ramp up its south-west face
      {
        const hx = x - HEADLAND.x, hz = z - HEADLAND.z;
        const d = Math.hypot(hx, hz);
        const crag = n2.get(hx * 0.04 + 21, hz * 0.04) * 9 + n.get(hx * 0.12, hz * 0.12 + 7) * 3;
        const hr = d + crag;
        const sw = smoothstep(0.3, 0.95, (-hx - hz) / Math.max(1, d * 1.4142)) * smoothstep(16, 0, Math.abs(hx - hz) / 1.4142); // ramp along the SW diagonal
        h += smoothstep(HEADLAND.shoulderR + 14 + sw * 20, HEADLAND.shoulderR - 10, hr) * HEADLAND.shoulderH;
        h += smoothstep(HEADLAND.r + 7 + sw * 26, HEADLAND.r - 6, hr) * HEADLAND.h;
        h += smoothstep(HEADLAND.shoulderR, 20, d) * n.fbm(x * 0.025 + 8, z * 0.025, 3) * 2.2 * (1 - sw); // broken, boulder-strewn top
      }
      // the gully: a ravine cut across the headland's south-west climb (NW–SE), spanned by the rope bridge
      {
        const gx = x - GULLY.x, gz = z - GULLY.z;
        const across = (gx + gz) * 0.7071, along = (gx - gz) * 0.7071; // across = the climb's direction
        const cut = smoothstep(GULLY.width / 2 + 3, GULLY.width / 2 - 2, Math.abs(across) + n2.get(along * 0.15, 3.3) * 1.5) * smoothstep(GULLY.length / 2, GULLY.length / 2 - 14, Math.abs(along));
        h -= cut * (GULLY.depth + n.get(x * 0.2, z * 0.2) * 1.2);
      }
      // the shrine knoll: a soft rise with a flat top for the dais
      { const d = Math.hypot(x - SHRINE.x, z - SHRINE.z); h += smoothstep(34, 9, d) * 3.2; }
      return h;
    },
    /**
     * The four mandated entry roads (the jetties' sandbars), then the sand paths: pier landing → up the
     * plateau ramp → the hut; hut → east → the headland ramp → the lookout; the fork east on to Wreck Cove;
     * hut → north-west → the shrine. The low-poly terrain paints them sand (Terrain.ts, trailDistance).
     */
    /**
     * The paths that climb crags are graded (cut and filled to ≤ 32° along the centreline): hut → lookout on both sides
     * of the bridge (never across the creek), the fork → wreck, hut → shrine. Only outside the Blender spawn cove
     * (blenderArea.ts, z < −20.6 — its terrain is baked in Blender from these heights): each graded stretch starts
     * a shelf's width (7 m) clear of it. The plateau rim inside it is climbed by stairs (Trailside `flights`).
     */
    graded: {
      paths: [
        [[14.9, -13.5], [17, 8], [15, 12], [16, 14]],
        [[32, 30], [34, 32], [46, 46], [86, 86], [90, 90]],
        [[17, 8], [60, 0], [100, -2], [140, 4]],
        [[-58.6, -13.5], [-72, 20], [-88, 70], [-96, 96]],
      ],
      maxGrade: Math.tan(32 * Math.PI / 180),
    },
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
      PIER_PATH_BED, ...PATHS.slice(1),
    ],
    cabinSites: [],
    // no `splat`: the low-poly terrain colours by height and slope (E318: the borrowed splat, PBR assets, pine bark, forest
    // block and HDRI name the Pine Hollow path would read are gone — ShardManifest makes them optional)
  })) },

  trees: { factory: 'none', noun: 'trees' }, // no forest trees (palms are their own builder, src/shards/driftwood-isle/world/Palms.ts)
  // ── island fauna (loot-agent): no forest here, so every plan asks for the open (`canopy: false`); the placer treats a
  // treeless shard as all clearing and keeps animals above the water line. Trails are only the four jetties' sandbars,
  // hence the wide band. Anchors: boar sounders on the south beach by the pier, the west back-beach palms and the north
  // grove; a brown bear in the south-east jungle grove below the plateau (E294: off the Wreck Cove sand and the wreck path,
  // ~70 m from every quest path, past its 45 m sight), and a black bear on the south-west back beach past the vista point
  // (E318: it was 15–35 m from the Ring Shrine, the finale; now ~90 m off the pier and shrine paths, 74 m from the vista
  // point, clear of the brown bear across the island). Boars are the island's four (E318: no Scarback / Old Ironhide, the
  // Pine Hollow legendaries); no deer (E318: a temperate game animal on a tropical island).
  spawns: DRIFTWOOD_FAUNA_PLANS,
  // E294 (Jake's yes, 2026-09-29): no single enemy hit takes more than 20 of your 100 health, so you survive ~5 hits of
  // anything (brown bear 45 → 20, boars 25 / 32 / 40 → 20, the drowned captain's swing 24 → 20; the sailor's cutlass is 14 in sailor.ts)
  // E297 (Jake's yes, 2026-09-29): one set of fight rules — at most 2 enemies attack at once, boars circle back instead of
  // fleeing, an off-screen wind-up is flagged at the screen edge, no animal's body swallows the camera
  fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: true, maxHitDamage: 20, capExempt: ['captain'], attackers: 2 },
   // the final boss hits harder than the cap (Jake, 2026-09-30)
  // E314 (Jake's picks, 2026-09-30): kills burst doubloons that fly to you (crab 1 … captain 25, src/game/loot/coins.ts)
  loot: { coins: true },
  // E314 stage 3 (Jake, 2026-09-30): "a simple body shadow" — your castaway's shadow on the sand (src/engine/player/BodyShadow.ts)
  bodyShadow: true,

  // open sand: a boar sees you from far off; merged over the species' HuntTuning by AnimalManager.tuningFor
  faunaTuning: {
    boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
  },
  sky: {
    sunColor: [1.0, 0.97, 0.9],
    sunIntensity: 2.7,
    envIntensity: 0.7,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.98, 0.92],
    cloudSunColor: [1.0, 0.98, 0.94],
    // toon ambient (stylize.ts): the whole shade band — a lavender-blue sky fill, a warm sand bounce from below
    hemiSky: 0x7b90f4, hemiGround: 0xd8a878, hemiIntensity: 0.9,
    // the ringed gas giant high in the north-east (up and right of the pier's view), lit from the NW sun
    planet: { azimuth: 36, elevation: 38, size: 17, tilt: 24, roll: -16 },
  },
  atmosphere: {
    fogHeight: -20.0,
    fogHeightFalloff: 0.08,
    fogHeightDensity: 0.0004,
    fogDistDensity: 0.00014,
    volumetricSunColor: [1.0, 0.97, 0.9],
  },
  grade: {
    saturation: 0.3, brightness: 0.0, contrast: 0.2,
    bloomIntensity: 0.4, bloomThreshold: 1.0,
    shadowTint: [0.94, 0.98, 1.06], highTint: [1.04, 1.01, 0.96],
    lift: [0.0, 0.0, 0.005], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  spawn: SPAWN,
};

// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default DRIFTWOOD_ISLE;

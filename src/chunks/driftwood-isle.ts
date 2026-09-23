/**
 * Driftwood Isle — the second shard: a small faceted low-poly island in a bright turquoise ocean
 * on grid (−1, +6). Wind Waker in spirit: flat-shaded vertex-coloured geometry, no textures at
 * all (`style: 'lowpoly'`), a wooden pier at the south edge, a moored sailboat, island boar hunted
 * with a wooden sword. Tropical midday sky, the ringed planet high over the water.
 *
 * Build order (docs/tasks/ASKS.md D12): water + pier → boat → beach → the island piece by piece.
 * The landscape below is the sea floor; the island rises out of it as the pieces land.
 */
import { smoothstep, clamp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { buildTerrain } from './terrain';
import type { ChunkDef, OceanDef } from './ChunkDef';
import thumbnail from './thumbs/driftwood-isle.jpg';
import heroPortrait from './thumbs/driftwood-isle-portrait.jpg';
import heroLandscape from './thumbs/driftwood-isle-landscape.jpg';

const SEED = 0x5ea1;

/** Sea surface. The four entry roads are forced to y = 0 by `buildTerrain`, so a level a little above 0 turns them into submerged sandbars under the piers. */
export const OCEAN: OceanDef = {
  level: 0.8,
  // albedo (linear); the sun + sky here add up to ~3× so the palette stays under 0.5 or it tone-maps to white
  shallowColor: [0.0, 0.8, 0.88],
  deepColor: [0.008, 0.15, 0.52],
  deepDepth: 6,
};

/** Where the south pier lands (the crescent beach) — the island's origin for the later pieces. */
export const PIER = { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckAbove: 1.2 };
/** the other three jetties at the N / W / E edge midpoints (the mandated entry roads are their sandbars); the E one runs on into Wreck Cove */
export const JETTIES = [
  { x: 0, z: CHUNK_HALF, rot: Math.PI, length: ROAD_LENGTH },
  { x: -CHUNK_HALF, z: 0, rot: Math.PI / 2, length: 95 },
  { x: CHUNK_HALF, z: 0, rot: -Math.PI / 2, length: 72 }, // ends 30 m short of the wreck's stern (x 149) — 108 ran straight through it
];
/** the sand paths between the POIs (also `trails[4..]`): [pier → hut], [hut → lookout], [fork → wreck], [hut → shrine] */
export const PATHS: [number, number][][] = [
  [[0, -188], [-8, -172], [-30, -142], [-30, -104], [-24, -80], [-20, -68]],
  // hut → lookout: over the rope bridge end to end (BRIDGE.a → .b), then up the headland ramp's diagonal with its plank
  // steps and fence (Trailside), not beside them over the crags (PHYSICS.md P9: the old line climbed 2–3 m a metre)
  [[-20, -68], [-8, -50], [14, -24], [17, 8], [15, 12], [16, 14], [32, 30], [34, 32], [46, 46], [86, 86], [90, 90]],
  [[17, 8], [60, 0], [100, -2], [140, 4]],
  [[-20, -68], [-52, -30], [-72, 20], [-88, 70], [-96, 96]],
];
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
export const WRECK = { x: 153, z: 2, heading: 2.7, roll: -0.2, pitch: 0.05, floorY: 1.45 };
/** the ring shrine on a knoll in the north-west jungle (rot: its stair faces south-east toward the hut path; its back points at the planet, so the ring frames it from the stair head) */
export const SHRINE = { x: -98, z: 108, rot: 2.51 };
/** the tidal creek across the hut → lookout path (a ravine cut below sea level, so the lagoon runs into it) and the rope bridge over it */
export const GULLY = { x: 24, z: 22, width: 11, depth: 7, length: 64 };
export const BRIDGE = { a: [16, 14] as [number, number], b: [32, 30] as [number, number], sag: 0.9 };
/** the lookout tower on the headland summit (rot: the stair faces south-west, toward the hut) */
export const LOOKOUT = { x: HEADLAND.x - 4, z: HEADLAND.z - 2, rot: 0.6 };

/** on the pier deck, 15 m in (past the HUD's 14 m boundary warning), facing north up the pier */
const SPAWN = { x: 0, z: -CHUNK_HALF + 15, yaw: Math.PI };

export const DRIFTWOOD_ISLE: ChunkDef = {
  id: 'chunk://local/driftwood-isle',
  slug: 'driftwood-isle',
  displayName: 'Driftwood Isle',
  gridCoords: '(−1, +6)',
  seed: SEED,
  treeCount: 0,
  biome: 'Low-poly island · open ocean',
  blurb: 'A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.',
  thumbnail, heroPortrait, heroLandscape,
  style: 'lowpoly',
  weapon: 'sword',
  ocean: OCEAN,
  explore: true,
  pois: [
    { id: 'jetty', name: 'Jetty', x: 0, z: -CHUNK_HALF + 24, r: 16 },
    { id: 'hut', name: 'Hut', x: HUT.x, z: HUT.z, r: 12 },
    { id: 'shrine', name: 'Ring shrine', x: SHRINE.x, z: SHRINE.z, r: 16 },
    { id: 'lookout', name: 'Lookout', x: LOOKOUT.x, z: LOOKOUT.z, r: 12 },
    { id: 'wreck', name: 'Wreck cove', x: WRECK.x, z: WRECK.z, r: 20 },
    { id: 'bridge', name: 'Rope bridge', x: (BRIDGE.a[0] + BRIDGE.b[0]) / 2, z: (BRIDGE.a[1] + BRIDGE.b[1]) / 2, r: 12 },
  ],

  terrain: buildTerrain(SEED, {
    oceanLevel: OCEAN.level,
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
      const sea = OCEAN.level;
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
      ...PATHS,
    ],
    cabinSites: [],
    /** Unused by the low-poly terrain (it colours by height and slope), kept sane for the splat contract: [sand, grass, rock, trail]. */
    splat(x, z, t) {
      const [, ny] = t.normalAt(x, z, 1.0);
      const slope = 1 - ny;
      const h = t.heightAt(x, z);
      const rock = clamp(smoothstep(0.2, 0.4, slope), 0, 1);
      const grass = clamp(smoothstep(2.5, 5, h), 0, 1) * (1 - rock);
      const sand = Math.max(0, 1 - rock - grass);
      return [sand, grass, rock, 0];
    },
  }),

  // the low-poly style loads none of these; they are what the engine's PBR path would use
  assets: {
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[0.95, 0.88, 0.7], [0.6, 0.85, 0.45], [0.7, 0.7, 0.72], [0.9, 0.84, 0.66]],
    slabRock: 'rock_ground',
  },
  trees: { factory: 'none', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees' }, // no forest trees (palms are their own builder, src/world/Palms.ts)
  forest: {
    spacing: 9,
    densityFreq: 0.01,
    clearings: [-0.3, 0.4],
    maxSlope: 0.7,
    tintHue: 0.28, tintHueJitter: [-0.03, 0.03], tintSat: [0.5, 0.7], tintLight: [0.5, 0.62],
    largeVariantChance: 0.1,
  },
  // ── island fauna (loot-agent): no forest here, so every plan asks for the open (`canopy: false`); the placer treats a
  // treeless shard as all clearing and keeps animals above the water line. Trails are only the four jetties' sandbars,
  // hence the wide band. Anchors: boar sounders on the south beach by the pier, the west back-beach palms and the north
  // grove; a brown bear on the Wreck Cove sand, a black bear in the NW jungle under the shrine; a few deer on the plateau.
  fauna: [
    { kind: 'boar', count: 4, anchor: { x: 45, z: -150, rMin: 5, rMax: 25 }, canopy: false, trailBand: [8, 600] },
    { kind: 'boar', count: 3, anchor: { x: -140, z: -30, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
    { kind: 'boar', count: 4, anchor: { x: 30, z: 150, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
    { kind: 'bear', count: 1, variants: ['brown'], anchor: { x: 126, z: 10, rMin: 8, rMax: 26 }, canopy: false, trailBand: [8, 600] },
    { kind: 'bear', count: 1, variants: ['black', 'black-blaze'], anchor: { x: -98, z: 108, rMin: 15, rMax: 35 }, canopy: false, trailBand: [8, 600] },
    { kind: 'deer', count: 3, anchor: { x: -24, z: -62, rMin: 16, rMax: 30 }, canopy: false, trailBand: [8, 600] },
  ],
  // open sand: a boar sees you from far off (Pine Hollow's numbers assume a forest) — ChunkDef.faunaTuning, merged over
  // the species' HuntTuning by AnimalManager.tuningFor
  faunaTuning: {
    boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
    deer: { sightRange: 44, sightRangeGraze: 22, noticeRate: 0.4 },
  },
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
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

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
  shallowColor: [0.07, 0.5, 0.46],
  deepColor: [0.006, 0.07, 0.24],
  deepDepth: 6,
};

/** Where the south pier lands (the crescent beach) — the island's origin for the later pieces. */
export const PIER = { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckAbove: 1.2 };
/** the other three jetties at the N / W / E edge midpoints (the mandated entry roads are their sandbars); the E one runs on into Wreck Cove */
export const JETTIES = [
  { x: 0, z: CHUNK_HALF, rot: Math.PI, length: ROAD_LENGTH },
  { x: -CHUNK_HALF, z: 0, rot: Math.PI / 2, length: 95 },
  { x: CHUNK_HALF, z: 0, rot: -Math.PI / 2, length: 108 },
];
/** the island disc: centre and nominal shoreline radius (the shoreline is noise-warped ±30 m) */
export const ISLAND = { x: 0, z: 12, r: 188 };
/** the hut's plateau: a flat-topped crag in the south-centre; the hut stands at its middle */
export const PLATEAU = { x: -24, z: -62, r: 46, h: 13 };
/** the hut site on the plateau (rot: which way the door faces — south, toward the pier) */
export const HUT = { x: PLATEAU.x + 2, z: PLATEAU.z - 2, rot: 0 };
/** the north-east massif: a tall craggy headland (a broad shoulder + a high top) with the lookout on its summit */
export const HEADLAND = { x: 98, z: 96, r: 48, h: 22, shoulderR: 80, shoulderH: 9 };
/** Wreck Cove: a bay bitten out of the east shore; the wreck lies heeled on its sand, bow to the land */
export const COVE = { ang: -0.02, depth: 46, width: 0.5 };
export const WRECK = { x: 149, z: 4, heading: 2.1, roll: 0.32 };
/** the ring shrine on a knoll in the north-west jungle (rot: which way its pillars face — south-east, toward the hut) */
export const SHRINE = { x: -98, z: 108, rot: 2.4 };
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
  biome: 'Low-poly island · open ocean · SUPER EXPERIMENTAL',
  blurb: 'Super experimental — ocean and a pier so far. A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.',
  thumbnail, heroPortrait, heroLandscape,
  style: 'lowpoly',
  weapon: 'sword',
  ocean: OCEAN,

  terrain: buildTerrain(SEED, {
    oceanLevel: OCEAN.level,
    /**
     * The island: a noise-warped disc centred a little north of the chunk centre. `m` is signed
     * metres inside the shoreline. Out to sea the floor is 5 m down and shelves up over the last
     * 60 m (the turquoise lagoon over sand); the beach climbs from the water line to ~2.6 m over
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
      let h: number;
      // the shelf and the beach keep a real slope through the water line (a smoothstep there would flatten
      // the shallows into a 20 m wide foam sheet)
      if (m < 0) h = -5.0 + Math.pow(clamp(1 + m / 70, 0, 1), 1.6) * (sea + 5.0);           // shelf up to the water line
      else h = sea + Math.pow(clamp(m / 26, 0, 1), 0.85) * 1.8 + smoothstep(20, 90, m) * 3.6; // beach, then the grassy interior
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
      // the shrine knoll: a soft rise with a flat top for the dais
      { const d = Math.hypot(x - SHRINE.x, z - SHRINE.z); h += smoothstep(34, 9, d) * 3.2; }
      return h;
    },
    /** The four mandated entry roads only (they are the four jetties' sandbars). */
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
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
  trees: { factory: 'pine', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees' }, // no trees yet (palms are a later piece)
  forest: {
    spacing: 9,
    densityFreq: 0.01,
    clearings: [-0.3, 0.4],
    maxSlope: 0.7,
    tintHue: 0.28, tintHueJitter: [-0.03, 0.03], tintSat: [0.5, 0.7], tintLight: [0.5, 0.62],
    largeVariantChance: 0.1,
  },
  fauna: [],
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    sunColor: [1.0, 0.97, 0.9],
    sunIntensity: 2.2,
    envIntensity: 0.7,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.98, 0.92],
    cloudSunColor: [1.0, 0.98, 0.94],
    hemiSky: 0x9fd8ff, hemiGround: 0x2a6f8a, hemiIntensity: 0.4,
    // the ringed gas giant high in the north-east (up and right of the pier's view), lit from the NW sun
    planet: { azimuth: 38, elevation: 40, size: 14, tilt: 22, roll: 18 },
  },
  atmosphere: {
    fogHeight: -20.0,
    fogHeightFalloff: 0.08,
    fogHeightDensity: 0.0012,
    fogDistDensity: 0.00032,
    volumetricSunColor: [1.0, 0.97, 0.9],
  },
  grade: {
    saturation: 0.32, brightness: 0.02, contrast: 0.12,
    bloomIntensity: 0.22, bloomThreshold: 0.95,
    shadowTint: [0.94, 0.98, 1.06], highTint: [1.04, 1.01, 0.96],
    lift: [0.0, 0.0, 0.005], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  spawn: SPAWN,
};

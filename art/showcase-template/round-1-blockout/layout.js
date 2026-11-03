// Showcase Template (KITCHEN-SINK, Template 3): the measured 500 m layout this blockout draws.
// One source for the scene (lab.js), the plan labels and the area budget. Metres; x east, z south (north is -z),
// y up. The cell is x, z in [-250, 250]. Every size cites the number it comes from (see README.md).

// Real numbers read from the repo (2026-11-02):
export const REAL = {
  walk: 4.3, sprint: 7.2, crouch: 2.2,            // src/engine/player/walk.ts walkingSpeed
  swim: 4.3 * 0.6,                                 // src/engine/player/swim.ts SWIM_SPEED
  hover: 14, hoverGridCap: 30,                     // src/engine/player/hoverSpeed.ts
  gallop: 13, canter: 8.5,                         // nalati-grasslands/data/ecology.json ride gaits
  gallopTurnR: 21,                                 // src/game/riding/physics.ts reinsTURN.gallop 0.62 rad/s -> ~21 m
  grappleMin: 2.5, grappleMax: 38, zip: 22,        // grapple mode defaults (minRange, maxRange, zipSpeed)
  bossArenaR: 22,                                  // driftwood-isle/data/bossEncounter.json radius
  oval: { halfLen: 60, radius: 38, width: 12 },    // nalati-grasslands/generators/horseCourse.ts OVAL
  ndGrappleRoom: [104, 148, 64],                   // nine-dragon-stack/data/grappleCourse.json room
  entryWidth: 8, entryAsphalt: 15,                 // src/format/contentBounds.ts
  edgeBand: 16,                                    // src/game/grid/frame.ts look blend across the cell edge
  l0Tile: 62.5, nearRadius: 150,                   // CONTENT_CAPS l0.size, nearRadius
  cellAbove: 250, cellBelow: 250,                  // CELL_ABOVE / CELL_BELOW
};

export const CELL = 500, HALF = 250;
export const STRIP = { inner: 237, outer: 247 };   // perimeter strip: storm lap, hover time trial
export const RING = { inner: 40, outer: 52 };      // hub ring road
export const AVENUE_HALF = 6;                       // 12 m avenues from each entry to the ring

// kind: west (non-combat zone, west half) | cand (west support: mount post, cave hill, vault)
//       | set (east combat set piece: stealth yard, gauntlet, mini-bosses, boss) | band (east level band)
// shape: rect {x0,x1,z0,z1} | rects {list} | disc {x,z,r} | stadium {x,z,halfLen,r} (long axis x)
// Set pieces come before bands: the budget raster gives a square metre to the first zone that holds it.
// Jake's layout ruling (2026-11-02): WEST = no enemies at all; EAST = combat only, level bands 1-18 rising along a
// path away from the hub, mini-bosses at L6 / L12 / L18, the L20 boss last; levels come from kills only.
export const ZONES = [
  { id: '01', name: 'HUB', kind: 'west', shape: 'disc', x: 0, z: 0, r: 40,
    why: 'quest givers, contract board, vendor + upgrade shop, trophy wall, feats board; 80 m across = 11 s at a sprint',
    stack: 'sits on the seam: its east gate is the only door into the combat half' },
  { id: '02', name: 'WEAPON RANGE', kind: 'west', shape: 'rect', x0: -90, x1: -15, z0: 112, z1: 212,
    why: '5 lanes x 15 m (sword combo/parry dummies, spear, bow, crossbow ammo, lever rifle); 10-50 m, rifle to 75 m; berm',
    stack: 'practice only; fires south into the berm and wall' },
  { id: '11', name: 'PHYSICS + HOVER', kind: 'west', shape: 'rect', x0: -235, x1: -95, z0: 108, z1: 198,
    why: '45 m halfpipe, kickers with 45 m run-up (3 s at 14 m/s), see-saw, crates, pressure plates', stack: '' },
  { id: '05', name: 'MOVERS PARK', kind: 'west', shape: 'rect', x0: -232, x1: -154, z0: -108, z1: -28,
    why: 'lifts, spinners, sliders, conveyors, jump pads climbing 0 -> 18 m', stack: 'rope bridge onto the cistern roof' },
  { id: 'C', name: 'CISTERN', kind: 'west', shape: 'rect', x0: -149, x1: -112, z0: -95, z1: -55,
    why: '18 m goal block', stack: 'roof = vista + first grapple hook' },
  { id: '06', name: 'GRAPPLE TOWER', kind: 'west', shape: 'rect', x0: -147, x1: -117, z0: 8, z1: 38,
    why: '45 m tower; cistern roof -> mast -> tower, every hop <= 38 m', stack: '146 m zipline (7 s) to the mount post' },
  { id: '04', name: 'RIDING OVAL', kind: 'west', shape: 'stadium', x: -130, z: -165, halfLen: 60, r: 44,
    why: 'Nalati oval as shipped: 479 m lap = 37 s at gallop; r 38 bends > 21 m gallop turn', stack: 'a mount is handed out at the post' },
  { id: 'MP', name: 'MOUNT POST', kind: 'cand', shape: 'rect', x0: -75, x1: -45, z0: -112, z1: -92,
    why: 'hands out the mount (no taming, no stable)', stack: 'zipline lands here' },
  { id: 'H', name: 'CAVE HILL', kind: 'cand', shape: 'rect', x0: -235, x1: -165, z0: 37, z1: 107,
    why: '16 m mound: scramble climb, ladder, vista bench', stack: 'cave + squeeze through it; caches' },
  { id: '12', name: 'PORTAL VAULT', kind: 'cand', shape: 'rect', x0: -90, x1: -40, z0: 40, z1: 92,
    why: 'walk-in portal gatehouse (non-combat puzzle)', stack: 'pressure-plate room 60 x 60 m at y -60' },

  { id: '07', name: 'STEALTH YARD', kind: 'set', shape: 'rect', x0: 130, x1: 230, z0: 30, z1: 134,
    why: 'band 5 set piece; 4 patrols with 15 m cones; storm hour falls on this leg', stack: 'keycard shed' },
  { id: '08', name: 'ELITE GAUNTLET', kind: 'set', shape: 'disc', x: 64, z: 118, r: 42,
    why: 'band 6 set piece: wave amphitheatre, 56 m floor', stack: '' },
  { id: 'K', name: 'BOSS APPROACH', kind: 'set', shape: 'rect', x0: 112, x1: 151, z0: 182, z1: 198,
    why: '39 x 16 m straight walk-in for the in-engine intro; camera pads on the rim', stack: '' },
  { id: '09', name: 'BOSS L20', kind: 'set', shape: 'disc', x: 188, z: 190, r: 38,
    why: 'Driftwood r 22 + 6 = r 28 floor, hazard ring, 6 m wall; farthest point from the hub', stack: 'rim = vista' },
  { id: 'M6', name: 'MINI-BOSS L6', kind: 'set', shape: 'disc', x: 35, z: -140, r: 14, why: 'ring pit', stack: '' },
  { id: 'M12', name: 'MINI-BOSS L12', kind: 'set', shape: 'disc', x: 178, z: -30, r: 14, why: 'ring pit at the road gate', stack: '' },
  { id: 'M18', name: 'MINI-BOSS L18', kind: 'set', shape: 'disc', x: 90, z: 210, r: 14, why: 'ring pit before the approach', stack: '' },
  { id: 'DG', name: 'DUNGEON PORTAL', kind: 'set', shape: 'rect', x0: 208, x1: 224, z0: -126, z1: -110,
    why: 'band 4 side door', stack: 'mini dungeon 40 x 50 m at y -40' },

  { id: 'B1', name: 'BAND 1 · L1–3', kind: 'band', band: 1, shape: 'rect', x0: 52, x1: 120, z0: -60, z1: 60,
    why: 'the east gate: weakest packs', stack: '' },
  { id: 'B2', name: 'BAND 2 · L4–6', kind: 'band', band: 2, shape: 'rect', x0: 8, x1: 120, z0: -160, z1: -60, why: '', stack: '' },
  { id: 'B3', name: 'BAND 3 · L7–9', kind: 'band', band: 3, shape: 'rect', x0: 8, x1: 237, z0: -237, z1: -160, why: '', stack: '' },
  { id: 'B4', name: 'BAND 4 · L10–12', kind: 'band', band: 4, shape: 'rect', x0: 120, x1: 237, z0: -160, z1: -8, why: '', stack: '' },
  { id: 'B5', name: 'BAND 5 · L13–15', kind: 'band', band: 5, shape: 'rect', x0: 120, x1: 237, z0: 8, z1: 150, why: '', stack: '' },
  { id: 'B6', name: 'BAND 6 · L16–18', kind: 'band', band: 6, shape: 'rects', list: [[8, 112, 60, 237], [112, 152, 150, 237]], why: '', stack: '' },
];

// Interiors live under the cell (CELL_BELOW = 250 m): they cost volume, not surface.
export const INTERIORS = [
  { name: 'PRESSURE-PLATE VAULT', w: 60, d: 60, y: -60, under: '12' },
  { name: 'MINI DUNGEON (band 4)', w: 40, d: 50, y: -40, under: 'DG' },
  { name: 'CAVE + SQUEEZE', w: 50, d: 12, y: -6, under: 'H' },
];

// Vistas (b), hidden caches (c) and loot chests (l).
export const SECRETS = [
  { k: 'b', x: -200, z: 72, y: 16 }, { k: 'b', x: -130, z: -75, y: 18 }, { k: 'b', x: -132, z: 23, y: 45 },
  { k: 'b', x: 188, z: 152, y: 6 }, { k: 'b', x: -229, z: -229, y: 0 }, { k: 'b', x: 229, z: -229, y: 0 }, { k: 'b', x: -229, z: 229, y: 0 },
  { k: 'c', x: -150, z: -215, y: 0 }, { k: 'c', x: -232, z: 0, y: 0 }, { k: 'c', x: -100, z: 225, y: 0 }, { k: 'c', x: -20, z: -225, y: 0 },
  { k: 'l', x: 100, z: -40, y: 0 }, { k: 'l', x: 20, z: -100, y: 0 }, { k: 'l', x: 200, z: -205, y: 0 }, { k: 'l', x: 228, z: -60, y: 0 },
  { k: 'l', x: 140, z: 140, y: 0 }, { k: 'l', x: 20, z: 225, y: 0 }, { k: 'l', x: 140, z: -135, y: 0 }, { k: 'l', x: 228, z: 20, y: 0 },
];

// The chain: west loop (non-combat, ends back at the hub) then the east serpentine. A checkpoint card opens each leg.
export const CHAIN = [
  { n: 1, label: 'Hub: contract, vendor', x: -12, z: -8 },
  { n: 2, label: 'Range: practice every weapon', x: -52, z: 118 },
  { n: 3, label: 'Hoverboard + physics park', x: -165, z: 150 },
  { n: 4, label: 'Movers → cistern → grapple → zip', x: -200, z: -40 },
  { n: '4b', x: -130, z: -75 }, { n: '4c', x: -132, z: 23 },
  { n: 5, label: 'Take the mount, beat par on the oval', x: -60, z: -102 },
  { n: '5b', x: -70, z: -121 }, { n: '5c', x: 0, z: -30 },
  { n: 6, label: 'East gate: bands 1–2, mini-boss L6', x: 85, z: 0 },
  { n: '6b', x: 60, z: -110 }, { n: '6c', x: 35, z: -140 },
  { n: 7, label: 'Bands 3–4, mini-boss L12 (dungeon side door)', x: 120, z: -200 },
  { n: '7b', x: 180, z: -90 }, { n: '7c', x: 178, z: -30 },
  { n: 8, label: 'Storm hour: stealth yard, gauntlet, mini-boss L18', x: 180, z: 82 },
  { n: '8b', x: 64, z: 118 }, { n: '8c', x: 90, z: 210 },
  { n: 9, label: 'The Crate Titan, L20', x: 188, z: 190 },
];

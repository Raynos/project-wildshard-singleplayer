// Showcase Template (KITCHEN-SINK, Template 3), round 2: the measured 500 m layout this blockout draws.
// One source for the scene (lab.js), the plan labels and the area budget. Metres; x east, z south (north is -z),
// y up. The cell is x, z in [-250, 250]. Every size cites the number it comes from (see README.md).
// Round 2 changes against round 1 (art/showcase-template/round-1-blockout/layout.js) are marked R2.

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
  entryWidth: 8, entryAsphalt: 15,                 // src/format/contentBounds.ts
  edgeBand: 16,                                    // src/game/grid/frame.ts look blend across the cell edge
  l0Tile: 62.5, nearRadius: 150,                   // CONTENT_CAPS l0.size, nearRadius
  cellAbove: 250, cellBelow: 250,                  // CELL_ABOVE / CELL_BELOW
  plateHold: 12,                                   // Plumb Drone holds 12 m (round-3-levels roster)
};

export const CELL = 500, HALF = 250;
export const STRIP = { inner: 237, outer: 247 };   // perimeter strip: storm lap, hover time trial
export const HUB_R = 28;                            // R2: r 28 plaza (was r 40), Jake's round 2 list item 3
export const RING = { inner: 28, outer: 38 };      // R2: the ring road hugs the smaller plaza (was 40-52)
export const AVENUE_HALF = 6;                       // 12 m avenues from each entry to the ring

// kind: west (non-combat zone, west half) | cand (west support: mount post, cave hill)
//       | set (east combat set piece) | band (east level band)
// shape: rect {x0,x1,z0,z1} | rects {list} | disc {x,z,r} | stadium {x,z,halfLen,r} (long axis x)
// Set pieces come before bands: the budget raster gives a square metre to the first zone that holds it.
export const ZONES = [
  { id: '01', name: 'HUB', kind: 'west', shape: 'disc', x: 0, z: 0, r: HUB_R,
    why: 'board, contracts, vendor, upgrades, trophy wall within 26 m of each other; 6 quest givers',
    stack: 'its east gate is the only door into the combat half' },
  { id: '02', name: 'WEAPON RANGE', kind: 'west', shape: 'rect', x0: -90, x1: -15, z0: 112, z1: 212,
    why: '5 lanes x 15 m; 10-50 m, rifle to 75 m; berm', stack: 'practice only' },
  { id: '11', name: 'PHYSICS + HOVER', kind: 'west', shape: 'rect', x0: -235, x1: -95, z0: 108, z1: 198,
    why: '45 m halfpipe, kickers with 45 m run-up (3 s at 14 m/s), see-saw, crates, pressure plates', stack: '' },
  { id: '05', name: 'MOVERS PARK', kind: 'west', shape: 'rect', x0: -232, x1: -154, z0: -108, z1: -28,
    why: 'a staircase of moving platforms climbing 0 -> 18 m', stack: 'rope bridge onto the tank' },
  { id: 'C', name: 'WATER TANK', kind: 'west', shape: 'disc', x: -131, z: -75, r: 17,
    why: 'R2: an 18 m round tank (was a 37 x 40 block) so it reads as its own shape', stack: 'roof = vista + first grapple hook' },
  { id: '06', name: 'GRAPPLE TOWER', kind: 'west', shape: 'rect', x0: -144, x1: -120, z0: 11, z1: 35,
    why: 'R2: a 45 m open lattice (was a solid block); every hop <= 38 m', stack: '146 m zipline (7 s) to the mount post' },
  { id: '04', name: 'RIDING OVAL', kind: 'west', shape: 'stadium', x: -130, z: -165, halfLen: 60, r: 44,
    why: 'Nalati oval as shipped: 479 m lap = 37 s at gallop', stack: 'a loaner horse at the post' },
  { id: 'MP', name: 'MOUNT POST', kind: 'cand', shape: 'rect', x0: -75, x1: -45, z0: -112, z1: -92,
    why: 'stable hand, loaner horse', stack: 'zipline lands here' },
  { id: 'H', name: 'CAVE HILL', kind: 'cand', shape: 'rect', x0: -235, x1: -165, z0: 37, z1: 107,
    why: '16 m mound: scramble climb, ladder, vista bench', stack: 'cave + squeeze under it, caches' },

  { id: '07', name: 'STEALTH YARD', kind: 'set', shape: 'rect', x0: 130, x1: 230, z0: 30, z1: 134,
    why: 'band 5 set piece; 4 Riveter patrols with 15 m cones; the storm is cover', stack: 'keycard shed' },
  { id: '08', name: 'GAUNTLET', kind: 'set', shape: 'disc', x: 52, z: 112, r: 36,
    why: 'band 6: wave amphitheatre, 56 m floor, FIX: two seating tiers (r 36, was r 42) against the seam; R2: Foreman Unit 7 (L18) is its wave finale', stack: 'no separate L18 pit' },
  { id: 'K', name: 'BOSS APPROACH', kind: 'set', shape: 'rect', x0: 112, x1: 151, z0: 182, z1: 198,
    why: '39 x 16 m straight walk-in for the in-engine intro', stack: '' },
  { id: '09', name: 'CRATE TITAN L20', kind: 'set', shape: 'disc', x: 188, z: 190, r: 38,
    why: 'Driftwood r 22 + 6 = r 28 floor, hazard ring, 6 m wall; far south-east', stack: 'rim = vista' },
  { id: 'M6', name: 'BIG PALLET L6', kind: 'set', shape: 'disc', x: 35, z: -140, r: 14, why: 'band-gate elite: its pit', stack: '' },
  { id: 'TV', name: 'TRAINING VAULT', kind: 'set', shape: 'rect', x0: 204, x1: 226, z0: -72, z1: -50,
    why: 'R2: the one vault: band 4 portal gatehouse, 4 rooms under the cell, Vault Warden L12 inside', stack: '4 rooms 70 x 70 m at y -40' },

  { id: 'B1', name: 'BAND 1 · L1–3', kind: 'band', band: 1, shape: 'rect', x0: 40, x1: 120, z0: -60, z1: 60, why: '', stack: '' },
  { id: 'B2', name: 'BAND 2 · L4–6', kind: 'band', band: 2, shape: 'rect', x0: 8, x1: 120, z0: -160, z1: -60, why: '', stack: '' },
  { id: 'B3', name: 'BAND 3 · L7–9', kind: 'band', band: 3, shape: 'rect', x0: 8, x1: 237, z0: -237, z1: -160, why: '', stack: '' },
  { id: 'B4', name: 'BAND 4 · L10–12', kind: 'band', band: 4, shape: 'rect', x0: 120, x1: 237, z0: -160, z1: -8, why: '', stack: '' },
  { id: 'B5', name: 'BAND 5 · L13–15', kind: 'band', band: 5, shape: 'rect', x0: 120, x1: 237, z0: 8, z1: 150, why: '', stack: '' },
  { id: 'B6', name: 'BAND 6 · L16–18', kind: 'band', band: 6, shape: 'rects', list: [[8, 112, 60, 237], [112, 152, 150, 237]], why: '', stack: '' },
];

// ---------- content placement (round 2b: Jake, 11-02: "beef up the blockout and double-check it all fits") ----------

// The grind maths, from docs/plans/kitchen-sink-v2/levels-combat-mini-plan.md and the round-3-levels page:
// 2.5 kills a minute, 90 s band respawn, kills per level 8 (L1) to 37 (L19), ~422 kills to L20 = ~169 min.
export const GRIND = {
  killsPerMin: 2.5, respawnS: 90,
  killsPerLevel: [8, 8, 11, 13, 14, 16, 17, 19, 21, 22, 24, 26, 27, 29, 30, 32, 33, 35, 37],
};
// Pull envelope: the template brain is aware 12 m, leash 25 m (src/shards/_template/data/creatures.json). Two packs
// must not share a fight: centre spacing >= leash + aware + 3 m slack. Mites get a smaller proposed brain (aware 8,
// leash 18) because band 1 is where new players learn to pull one pack; drones kite at 12 m so their leash is 30.
// tiers: three Mk tiers per band (one per level), packsPerTier packs each; a tier rises along `axis` from `entry`.
// FIX (round 2b): sight-gated aggro. Where a 3 m wall stands between two packs, nothing aggroes through it, so the
// spacing drops to leash + 3 m (walled bands 2, 3 (6 m scaffold screens: drones fly at 3 m) and 4; the stealth yard's walls do the same for band 5, yardSpacing).
// The cover pass puts a wall across the midline of every pack pair closer than the open-ground spacing.
export const BANDS = [
  { band: 1, enemy: 'Crate Mite', lv: [1, 2, 3], packSize: 3, aware: 8, leash: 18, packsPerTier: 3, cover: 'crates',
    role: 'swarmer, comes in threes', entry: [85, 0] },
  { band: 2, enemy: 'Pallet Jack', lv: [4, 5, 6], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'walls',
    role: 'charger, stuns itself on walls', entry: [80, -60], walled: true },
  { band: 3, enemy: 'Plumb Drone', lv: [7, 8, 9], packSize: 2, aware: 12, leash: 30, packsPerTier: 3, cover: 'pillars',
    role: 'kiter, holds 12 m at 3 m up', entry: [20, -165], walled: true },
  { band: 4, enemy: 'Welder Unit', lv: [10, 11, 12], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'bays',
    role: 'zoner, flame cone + slag', entry: [180, -160], walled: true },
  { band: 5, enemy: 'Riveter', lv: [13, 14, 15], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'tall',
    role: 'bulwark, riot plate', entry: [176, 8], yardSpacing: 28 },
  { band: 6, enemy: 'Arc Sentry', lv: [16, 17, 18], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'half',
    role: 'duellist, comes in pairs', entry: [136, 150] },
];
// Rare variants (Jake 11-02): a random roll among the commons, no spawn points of their own (proposed: 10 % uncommon,
// 2 % rare). Night shift: the two top-tier packs of each band swap to lamp-eyed L+1 variants after dark, on the same
// points (0 m² extra). Commons respawn per pack about 90 s after you leave its area, never in view (Jake 11-02).
export const VARIANTS = { nightPointsPerBand: 2, uncommon: 0.10, rare: 0.02 };

// Elites (Jake 11-02): six in all. Three band-gate elites (below) plus three NIGHT elites spread low / mid / high, each
// with a small lair (r 8 ring of junk), night only, L+2. Names from the loot-economy mini plan's elite list.
export const ELITES = [
  { band: 1, name: 'Sir Nibbles', lv: 5 }, { band: 3, name: 'Nailbiter', lv: 11 }, { band: 5, name: 'Riveting Rita', lv: 17 },
];
export const ELITE_LAIR_R = 8, ELITE_AWARE = 16;

// Band-gate elites: each has its own lair (a pit, a vault room, the gauntlet floor).
export const GATE_ELITES = [
  { name: 'Big Pallet', lv: 6, band: 2, where: 'its pit (r 14), band 2 far corner', x: 35, z: -140 },
  { name: 'Vault Warden', lv: 12, band: 4, where: 'room 4 of the Training Vault, under band 4', x: 215, z: -61 },
  { name: 'Foreman Unit 7', lv: 18, band: 6, where: 'the gauntlet\'s wave finale, band 6', x: 52, z: 112 },
  { name: 'The Crate Titan', lv: 20, band: 0, where: 'far south-east arena', x: 188, z: 190 },
];

// Hub (R2, r 28): the services on an inner ring (r 11-14), a few steps apart. The three givers flank the quest
// board (one 'quests corner'); Tinker Rook stands between his vendor stall and the upgrade counter.
export const HUB = {
  services: [
    { id: 'QB', name: 'QUEST BOARD', x: 0, z: -13 },
    { id: 'CB', name: 'CONTRACTS', x: -11, z: -8 },
    { id: 'VN', name: 'VENDOR', x: 11, z: -8 },
    { id: 'UP', name: 'UPGRADES', x: 13, z: 4 },
    { id: 'TW', name: 'TROPHY WALL', x: -13, z: 4 },
    { id: 'FT', name: 'FEATS', x: -15, z: -2 },
  ],
  // the coordinator's brief (Jake 11-02): a giver per tier 1-6 / 7-12 / 13-20, Tinker Rook, the stable hand
  npcs: [
    { id: 'G1', name: 'Yard Boss', lock: 'L1–6', x: 6, z: -15, giver: true,
      quests: 'Mite nests · Jacks off the line · Big Pallet' },
    { id: 'G2', name: 'Surveyor', lock: 'L7–12', x: -6, z: -15, giver: true,
      quests: 'Ground the drones · Cut the torches · The Training Vault' },
    { id: 'G3', name: 'Shift Boss', lock: 'L13–20', x: 0, z: -19, giver: true,
      quests: 'Storm hour (4 beacons) · Keycard · Sentry duels · Foreman Unit 7 · The Crate Titan · Night shift' },
    { id: 'TR', name: 'Tinker Rook', lock: 'shop', x: 13, z: -2, giver: false,
      quests: 'vendor (weapon tiers) + UPGRADES and BENCH tabs' },
  ],
  stableHand: { name: 'Stable hand', x: -60, z: -98, note: 'at the mount post by the riding oval (loaner horse)' },
  trophyFrames: 12,   // loot plan: 12 frames; with Jake's six elites: 6 elites + the Titan + 2 caches = 9, 3 spare
};

// Special quest targets (the rest are generated: one per band tier, at that tier's packs).
export const QUESTS = [
  { band: 2, lock: 5, name: 'Big Pallet', x: 35, z: -140 },
  { band: 4, lock: 10, name: 'Training Vault', x: 215, z: -61 },
  { band: 5, lock: 13, name: 'Keycard', x: 212, z: 122 },
  { band: 5, lock: 13, name: 'Storm hour', x: 178, z: 150 },
  { band: 6, lock: 16, name: 'Foreman Unit 7', x: 52, z: 112 },
  { band: 6, lock: 18, name: 'Crate Titan', x: 188, z: 190 },
];
// Contract board (loot-economy LW4, recounted for Jake's 6 elites): 6 count contracts, 6 elite contracts, the Titan.
export const CONTRACTS = { count: 6, elite: 6, titan: 1 };

// R2: storm-hour beacons on the four corners of band 5, outside the stealth yard's walls. Lit with a pitch bolt.
export const BEACONS = [
  { n: 1, x: 125, z: 20 }, { n: 2, x: 232, z: 20 }, { n: 3, x: 232, z: 144 }, { n: 4, x: 125, z: 144 },
];

// Interiors live under the cell (CELL_BELOW = 250 m): they cost volume, not surface.
export const INTERIORS = [
  { name: 'TRAINING VAULT, 4 ROOMS', w: 70, d: 70, y: -40, under: 'TV', cx: 190, cz: -95,
    rooms: [['PUZZLE', 24, 24], ['FIGHT', 30, 30], ['CLIMB', 20, 20], ['VAULT WARDEN', 32, 32]] },
  { name: 'CAVE + SQUEEZE', w: 50, d: 12, y: -6, under: 'H' },
];

// Vistas (b), hidden caches (c). R2: the round 1 vault ground is free; its lookout bench is the one spot where the
// whole hop chain (tank, mast, tower) reads in one portrait frame. Loot chests are generated: 2 per band (LW5).
export const LOOKOUT = { x: -55, z: 78 };
export const SECRETS = [
  { k: 'b', x: -200, z: 72, y: 16 }, { k: 'b', x: -131, z: -75, y: 18 }, { k: 'b', x: -132, z: 23, y: 45 },
  { k: 'b', x: 188, z: 152, y: 6 }, { k: 'b', x: -229, z: -229, y: 0 }, { k: 'b', x: 229, z: -229, y: 0 }, { k: 'b', x: -229, z: 229, y: 0 },
  { k: 'b', x: LOOKOUT.x, z: LOOKOUT.z, y: 0 },
  { k: 'c', x: -150, z: -215, y: 0 }, { k: 'c', x: -232, z: 0, y: 0 }, { k: 'c', x: -100, z: 225, y: 0 }, { k: 'c', x: -20, z: -225, y: 0 },
];
// 20 Gold 1x1 cubes (loot-economy item 8): 10 west, 10 east. Mostly up high or tucked away (every 5 = a perk).
export const GOLD = [
  { x: -131, z: -75, y: 18.5, at: 'tank roof' }, { x: -132, z: 23, y: 36.6, at: 'tower deck 4' },
  { x: -200, z: 72, y: 16.5, at: 'cave hill top' }, { x: -205, z: 88, y: -5.5, at: 'squeeze cave' },
  { x: -200, z: -88, y: 9, at: 'halfpipe lip' }, { x: -130, z: -165, y: 0, at: 'oval infield' },
  { x: -57, z: 205, y: 10.5, at: 'range berm top' }, { x: -192, z: -78, y: 18, at: 'movers top step' },
  { x: -60, z: -104, y: 4.5, at: 'mount post roof' }, { x: -160, z: 190, y: 0, at: 'hover park corner' },
  { x: 60, z: -50, y: 0, at: 'band 1 crate maze' }, { x: 112, z: -150, y: 0, at: 'band 2 corner' },
  { x: 230, z: -230, y: 0, at: 'band 3 far corner' }, { x: 233, z: -150, y: 0, at: 'band 4 edge' },
  { x: 215, z: -61, y: 9.5, at: 'vault gatehouse roof' }, { x: 188, z: 226, y: 6.5, at: 'boss rim' },
  { x: 212, z: 122, y: 4.5, at: 'keycard shed roof' }, { x: 52, z: 78, y: 4, at: 'gauntlet rim' },
  { x: 20, z: 230, y: 0, at: 'band 6 corner' }, { x: 232, z: 144, y: 20, at: 'beacon 3 crown' },
];

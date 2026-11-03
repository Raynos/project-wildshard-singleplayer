// Showcase Template (KITCHEN-SINK, Template 3), round 3: the measured 500 m layout this blockout draws.
// One source for the scene (lab.js), the plan labels and the area budget. Metres; x east, z south (north is -z),
// y up. The cell is x, z in [-250, 250]. Round 3 changes against round 2 (../round-2-blockout/layout.js) are marked R3.
// Jake 11-03: the hub becomes a town taking a big share of the west; NE = bands 1-4; SE top half = band 5 (the
// stealth yard) and band 6, each its own section; SE bottom half = only the gauntlet (L16-18) and the Crate Titan.

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
export const AVENUE_HALF = 6;                       // 12 m avenues
// R3: the town. 176 x 176 m against the seam, centred on the west entry's line. Its east gate opens onto a 16 m apron
// in the seam avenue; across it, the seam gate is the only way into the combat half.
export const TOWN = { x0: -184, x1: -8, z0: -88, z1: 88, wall: 5 };
export const PLAZA = { x0: -64, x1: -16, z0: -24, z1: 24 };           // the gate plaza, just inside the east gate
export const ROAD = { half: 8.5, x0: 8, x1: STRIP.inner };            // the walled east road (combat side)
export const SEAM_X = 7.5;                                            // seam wall
// Town gates: [x, z, side, what lies outside]
export const GATES = [
  { id: 'E', name: 'EAST GATE', x: -8, z: 0, to: 'seam gate → the combat road (the only way in)' },
  { id: 'N', name: 'STABLE GATE', x: -40, z: -88, to: 'paddock and the riding course' },
  { id: 'NW', name: 'TANK GATE', x: -140, z: -88, to: 'water tank, movers park' },
  { id: 'W', name: 'WEST GATE', x: -184, z: 0, to: 'west avenue, grapple tower' },
  { id: 'SW', name: 'PARK GATE', x: -140, z: 88, to: 'hover park, the Rock' },
  { id: 'S', name: 'RANGE GATE', x: -40, z: 88, to: 'the firing line' },
];
// Combat-road gates: [x0, x1, side (-1 north, +1 south)]
export const ROAD_GATES = [[90, 110, -1], [140, 156, -1], [140, 156, 1], [24, 44, 1]];   // b1, b4, b5, b6 (grinders' way home)
// Band-to-band arches in the NE (the bands snake b1 -> b2 -> b3 -> b4; tiers rise toward the next arch)
export const ARCHES = [{ x: 24, z: -122, ry: 0, band: 2 }, { x: 122, z: -224, ry: Math.PI / 2, band: 3 }, { x: 224, z: -122, ry: 0, band: 4 }];
// The stealth yard's gates: north (from the road crossing) and west (into band 6)
export const YARD_GATES = { north: [140, 156], west: [58, 74] };
// SE: the wall between the top half (bands 5, 6) and the bottom half (gauntlet, Titan), with its two gates.
export const SE_WALL = { z: 122, gates: [[54, 70], [100, 116]] };

// kind: town (R3) | west (non-combat toy) | cand (west support: paddock, the Rock)
//       | set (east combat set piece) | band (east level band)
// shape: rect {x0,x1,z0,z1} | rects {list} | disc {x,z,r} | stadium {x,z,halfLen,r} (long axis x)
// Set pieces come before bands: the budget raster gives a square metre to the first zone that holds it.
export const ZONES = [
  { id: '01', name: 'TOWN', kind: 'town', shape: 'rect', ...TOWN,
    why: 'R3: a walled mini town (was a r 28 plaza): gate plaza, shop row, lanes, 84 buildings, six gates',
    stack: 'roofs: the zipline lands on the shop row; the obelisk stays as its landmark' },
  { id: '02', name: 'WEAPON RANGE', kind: 'west', shape: 'rect', x0: -94, x1: -19, z0: 94, z1: 194,
    why: 'R3: along the town\'s south wall: the Range Gate opens onto the firing line', stack: 'practice only' },
  { id: '11', name: 'PHYSICS + HOVER', kind: 'west', shape: 'rect', x0: -234, x1: -94, z0: 140, z1: 230,
    why: '45 m halfpipe, kickers with 45 m run-up (3 s at 14 m/s), see-saw, crates, pressure plates', stack: '' },
  { id: '05', name: 'MOVERS PARK', kind: 'west', shape: 'rect', x0: -232, x1: -184, z0: -136, z1: -92,
    why: 'R3: stacked: a spiral of moving platforms 0 -> 18 m on 48 x 44 m (was 78 x 80)', stack: 'rope bridge onto the tank' },
  { id: 'C', name: 'WATER TANK', kind: 'west', shape: 'disc', x: -152, z: -114, r: 17,
    why: 'an 18 m round tank', stack: 'roof = vista + first grapple hook' },
  { id: '06', name: 'GRAPPLE TOWER', kind: 'west', shape: 'rect', x0: -218, x1: -194, z0: -58, z1: -34,
    why: 'a 45 m open lattice; tank -> mast -> tower, every hop <= 38 m', stack: 'R3: 98 m zipline onto the shop-row roofs' },
  { id: '04', name: 'RIDING OVAL', kind: 'west', shape: 'stadium', x: -122, z: -186, halfLen: 60, r: 44,
    why: 'Nalati oval as shipped: 479 m lap = 37 s at gallop', stack: 'entered from the paddock at the Stable Gate' },
  { id: 'MP', name: 'PADDOCK', kind: 'cand', shape: 'rect', x0: -64, x1: -16, z0: -136, z1: -96,
    why: 'R3: the riding course entrance: loaner horse, mounting block, chute onto the oval', stack: 'outside the Stable Gate' },
  { id: 'H', name: 'THE ROCK', kind: 'cand', shape: 'rect', x0: -232, x1: -186, z0: 52, z1: 112,
    why: 'R3: Cave Hill reshaped into the town\'s crag: 16 m, scramble climb, vista bench (the lookout)', stack: 'squeeze cave under it, town cellar -> hover park' },

  { id: '07', name: 'STEALTH YARD', kind: 'set', shape: 'rect', x0: 126, x1: 232, z0: 14, z1: 118,
    why: 'R3: band 5 IS the yard (L13-15): Riveter patrols behind tall walls; the storm is cover', stack: 'keycard shed; beacons on its corner towers' },
  { id: '08', name: 'GAUNTLET', kind: 'set', shape: 'disc', x: 62, z: 182, r: 42,
    why: 'R3: the SE bottom half, L16-18 waves; 56 m floor, seating back to r 42; Foreman Unit 7 (L18) is its finale', stack: 'band 6 grinders\' wave arena' },
  { id: 'K', name: 'BOSS APPROACH', kind: 'set', shape: 'rect', x0: 114, x1: 153, z0: 184, z1: 200,
    why: '39 x 16 m straight walk-in for the in-engine intro', stack: '' },
  { id: '09', name: 'CRATE TITAN L20', kind: 'set', shape: 'disc', x: 190, z: 192, r: 38,
    why: 'Driftwood r 22 + 6 = r 28 floor, hazard ring, 6 m wall; the very bottom right', stack: 'rim = vista' },
  { id: 'M6', name: 'BIG PALLET L6', kind: 'set', shape: 'disc', x: 96, z: -206, r: 14, why: 'band-gate elite: its pit at band 2\'s exit to band 3', stack: '' },
  { id: 'TV', name: 'TRAINING VAULT', kind: 'set', shape: 'rect', x0: 204, x1: 226, z0: -72, z1: -50,
    why: 'the one vault: band 4 portal gatehouse, 4 rooms under the cell, Vault Warden L12 inside', stack: '4 rooms 70 x 70 m at y -40' },

  { id: 'B1', name: 'BAND 1 · L1–3', kind: 'band', band: 1, shape: 'rect', x0: 8, x1: 122, z0: -122, z1: -8, why: '', stack: '' },
  { id: 'B2', name: 'BAND 2 · L4–6', kind: 'band', band: 2, shape: 'rect', x0: 8, x1: 122, z0: -237, z1: -122, why: '', stack: '' },
  { id: 'B3', name: 'BAND 3 · L7–9', kind: 'band', band: 3, shape: 'rect', x0: 122, x1: 237, z0: -237, z1: -122, why: '', stack: '' },
  { id: 'B4', name: 'BAND 4 · L10–12', kind: 'band', band: 4, shape: 'rect', x0: 122, x1: 237, z0: -122, z1: -8, why: '', stack: '' },
  { id: 'B5', name: 'BAND 5 · L13–15', kind: 'band', band: 5, shape: 'rect', x0: 122, x1: 237, z0: 8, z1: 122, why: '', stack: '' },
  { id: 'B6', name: 'BAND 6 · L16–18', kind: 'band', band: 6, shape: 'rect', x0: 8, x1: 122, z0: 8, z1: 122, why: '', stack: '' },
];

// ---------- content placement ----------

// R3: the XP curve is golden-ratio steep (KITCHEN-SINK §2 19p): an enemy pays 10 x its level, XP to the next level is
// 100 x 1.618^(L-1) (1,512,538 to L20, ~60 h at 2.5 equal-level kills a minute). kills per level = xpToNext / (10 L).
export const PHI = 1.618;
export const xpToNext = L => 100 * PHI ** (L - 1);
export const GRIND = {
  killsPerMin: 2.5, respawnS: 90, fastKillsPerMin: 4,   // fast = a geared player on Forge IV (proposed design ceiling)
  killsPerLevel: Array.from({ length: 19 }, (_, i) => Math.round(xpToNext(i + 1) / (10 * (i + 1)))),
};
// Pull envelope: the template brain is aware 12 m, leash 25 m (src/shards/_template/data/creatures.json). Two packs
// must not share a fight: centre spacing >= leash + aware + 3 m slack; behind a 3 m sight wall, leash + 3 m.
// R3: bands 5 and 6 get FOUR packs a tier (12 a band): players spend ~8 h in band 5 and ~48 h in band 6 (L16 -> 20)
// on the golden curve, so their tiers need a no-wait ceiling well above 2.5 kills a minute. Band 6 gets 3 m arc
// screens (sight walls) so 12 packs fit its own section.
export const BANDS = [
  { band: 1, enemy: 'Crate Mite', lv: [1, 2, 3], packSize: 3, aware: 8, leash: 18, packsPerTier: 3, cover: 'crates',
    role: 'swarmer, comes in threes', entry: [100, -14] },
  { band: 2, enemy: 'Pallet Jack', lv: [4, 5, 6], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'walls',
    role: 'charger, stuns itself on walls', entry: [20, -122], walled: true },
  { band: 3, enemy: 'Plumb Drone', lv: [7, 8, 9], packSize: 2, aware: 12, leash: 30, packsPerTier: 3, cover: 'pillars',
    role: 'kiter, holds 12 m at 3 m up', entry: [122, -224], walled: true },
  { band: 4, enemy: 'Welder Unit', lv: [10, 11, 12], packSize: 2, aware: 12, leash: 25, packsPerTier: 3, cover: 'bays',
    role: 'zoner, flame cone + slag', entry: [224, -122], walled: true },
  { band: 5, enemy: 'Riveter', lv: [13, 14, 15], packSize: 2, aware: 12, leash: 25, packsPerTier: 4, cover: 'tall',
    role: 'bulwark, riot plate', entry: [148, 14], yardSpacing: 28 },
  { band: 6, enemy: 'Arc Sentry', lv: [16, 17, 18], packSize: 2, aware: 12, leash: 25, packsPerTier: 4, cover: 'half',
    role: 'duellist, comes in pairs', entry: [34, 14], walled: true },
];
// Rare variants (Jake 11-02): a random roll among the commons, no spawn points of their own (proposed: 10 % uncommon,
// 2 % rare). Night shift: the two top-tier packs of each band swap to lamp-eyed L+1 variants after dark, on the same
// points (0 m² extra). Commons respawn per pack about 90 s after you leave its area, never in view (Jake 11-02).
export const VARIANTS = { nightPointsPerBand: 2, uncommon: 0.10, rare: 0.02 };

// Night elites (KITCHEN-SINK §2 19k, Jake's names): Sir Nibbles band 1 L4, Hot Mess band 4 L13, Riveting Rita band 5
// L16. Each has a small lair (r 8 ring of junk), night only (storm hour counts as night).
export const ELITES = [
  { band: 1, name: 'Sir Nibbles', lv: 4 }, { band: 4, name: 'Hot Mess', lv: 13 }, { band: 5, name: 'Riveting Rita', lv: 16 },
];
export const ELITE_LAIR_R = 8, ELITE_AWARE = 16;

// Band-gate elites: each has its own lair (a pit, a vault room, the gauntlet floor).
export const GATE_ELITES = [
  { name: 'Big Pallet', lv: 6, band: 2, where: 'its pit (r 14) at band 2\'s exit to band 3', x: 96, z: -206 },
  { name: 'Vault Warden', lv: 12, band: 4, where: 'room 4 of the Training Vault, under band 4', x: 215, z: -61 },
  { name: 'Foreman Unit 7', lv: 18, band: 6, where: 'the gauntlet\'s wave finale, SE bottom half', x: 62, z: 182 },
  { name: 'The Crate Titan', lv: 20, band: 0, where: 'the very bottom right', x: 190, z: 192 },
];

// R3: the town's services. The gate plaza (48 x 48 m) holds the quest corner, contracts, trophy wall and feats;
// the shop row (Main Street, west of the plaza) holds Tinker Rook's shop, the weapons shop and three empty fronts.
export const HUB = {
  services: [
    { id: 'QB', name: 'QUEST BOARD', x: -40, z: -21, ry: 0 },
    { id: 'CB', name: 'CONTRACTS', x: -28, z: 21, ry: Math.PI },
    { id: 'TW', name: 'TROPHY WALL', x: -46, z: 22, ry: Math.PI },
    { id: 'FT', name: 'FEATS', x: -61, z: 14, ry: -Math.PI / 2 },
    { id: 'TR', name: 'TINKER ROOK', x: -71, z: -16, shop: true, sub: 'vendor · UPGRADES · BENCH' },
    { id: 'WS', name: 'WEAPONS', x: -71, z: 16, shop: true, sub: 'level-locked stock' },
  ],
  npcs: [
    { id: 'G1', name: 'Yard Boss', lock: 'L1–6', x: -32, z: -16, giver: true,
      quests: 'Mite nests · Jacks off the line · Big Pallet' },
    { id: 'G2', name: 'Surveyor', lock: 'L7–12', x: -40, z: -15, giver: true,
      quests: 'Ground the drones · Cut the torches · The Training Vault' },
    { id: 'G3', name: 'Shift Boss', lock: 'L13–20', x: -48, z: -16, giver: true,
      quests: 'Storm hour · Keycard · Sentry duels · Foreman Unit 7 · The Crate Titan' },
    { id: 'TR', name: 'Tinker Rook', lock: 'shop', x: -62, z: -12, giver: false, quests: 'vendor (Forge tiers) + UPGRADES and BENCH' },
    { id: 'WK', name: 'Weapons keeper', lock: 'shop', x: -62, z: 12, giver: false, quests: 'weapons, level-locked (proposed NPC)' },
  ],
  // three empty shop fronts on Main Street for later shops
  toLet: [{ x: -89, z: -14 }, { x: -89, z: 14 }, { x: -118, z: 14 }],
  zipHouse: { x0: -126, x1: -108, z0: -28, z1: -7, h: 12 },
  stableHand: { name: 'Stable hand', x: -40, z: -100, note: 'at the paddock gate outside the Stable Gate (loaner horse)' },
  obelisk: { x: -22, z: 15, h: 22 },
  trophyFrames: 12,
};

// Special quest targets (the rest are generated: one per band tier, at that tier's packs).
export const QUESTS = [
  { band: 2, lock: 5, name: 'Big Pallet', x: 96, z: -206 },
  { band: 4, lock: 10, name: 'Training Vault', x: 215, z: -61 },
  { band: 5, lock: 13, name: 'Keycard', x: 220, z: 106 },
  { band: 5, lock: 13, name: 'Storm hour', x: 179, z: 66 },
  { band: 6, lock: 16, name: 'Foreman Unit 7', x: 62, z: 182 },
  { band: 6, lock: 18, name: 'Crate Titan', x: 190, z: 192 },
];
export const CONTRACTS = { count: 6, elite: 6, titan: 1 };

// Storm-hour beacons crown the stealth yard's four corner towers (band 5), 104-106 m apart, each in sight of the next.
export const BEACONS = [
  { n: 1, x: 126, z: 14 }, { n: 2, x: 232, z: 14 }, { n: 3, x: 232, z: 118 }, { n: 4, x: 126, z: 118 },
];

// Interiors live under the cell (CELL_BELOW = 250 m): they cost volume, not surface.
export const INTERIORS = [
  { name: 'TRAINING VAULT, 4 ROOMS', w: 70, d: 70, y: -40, under: 'TV', cx: 186, cz: -64,
    rooms: [['PUZZLE', 24, 24], ['FIGHT', 30, 30], ['CLIMB', 20, 20], ['VAULT WARDEN', 32, 32]] },
  { name: 'SQUEEZE CAVE', w: 60, d: 10, y: -6, under: 'H' },
];

// Vistas (b), hidden caches (c). R3: the lookout is the Rock's top bench (tank, mast and tower in one frame);
// the east gatehouse roof replaces the old hub-side lookout (band 1 to band 4 in one frame).
export const LOOKOUT = { x: -209, z: 80, y: 16 };
export const SECRETS = [
  { k: 'b', x: LOOKOUT.x, z: LOOKOUT.z, y: 16 }, { k: 'b', x: -152, z: -114, y: 18 }, { k: 'b', x: -206, z: -46, y: 45 },
  { k: 'b', x: 190, z: 154, y: 6 }, { k: 'b', x: -229, z: -229, y: 0 }, { k: 'b', x: 229, z: -229, y: 0 }, { k: 'b', x: -229, z: 229, y: 0 },
  { k: 'b', x: -10, z: -10, y: 9 },
  { k: 'c', x: -233, z: -150, y: 0 }, { k: 'c', x: -233, z: 124, y: 0 }, { k: 'c', x: -70, z: 232, y: 0 }, { k: 'c', x: -20, z: -233, y: 0 },
];
// 20 Gold 1x1 cubes (loot-economy item 8): 10 west, 10 east. Mostly up high or tucked away (every 5 = a perk).
export const GOLD = [
  { x: -152, z: -114, y: 18.5, at: 'tank roof' }, { x: -206, z: -46, y: 36.6, at: 'tower deck 4' },
  { x: -212, z: 84, y: 16.5, at: 'the Rock top' }, { x: -200, z: 120, y: -5.5, at: 'squeeze cave' },
  { x: -197, z: 162, y: 9, at: 'halfpipe lip' }, { x: -122, z: -186, y: 0, at: 'oval infield' },
  { x: -62, z: 187, y: 10.5, at: 'range berm top' }, { x: -196, z: -126, y: 18, at: 'movers top step' },
  { x: -22, z: 15, y: 22.5, at: 'obelisk crown' }, { x: -114, z: -24, y: 12.5, at: 'shop-row roof (zip landing)' },
  { x: 16, z: -114, y: 0, at: 'band 1 crate maze' }, { x: 16, z: -230, y: 0, at: 'band 2 corner' },
  { x: 230, z: -230, y: 0, at: 'band 3 far corner' }, { x: 233, z: -100, y: 0, at: 'band 4 edge' },
  { x: 215, z: -61, y: 9.5, at: 'vault gatehouse roof' }, { x: 190, z: 228, y: 6.5, at: 'Titan rim' },
  { x: 220, z: 106, y: 4.5, at: 'keycard shed roof' }, { x: 23, z: 182, y: 4.1, at: 'gauntlet rim' },
  { x: 14, z: 116, y: 0, at: 'band 6 corner' }, { x: 232, z: 118, y: 20, at: 'beacon 3 crown' },
];

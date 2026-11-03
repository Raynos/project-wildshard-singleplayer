// Showcase Template (KITCHEN-SINK, Template 3), round 5: the measured 500 m layout this blockout draws.
// One source for the scene (lab.js), the plan labels and the area budget. Metres; x east, z south (north is -z),
// y up. The cell is x, z in [-250, 250]. Round 3 changes against round 2 are marked R3; round 4 changes (the WEST
// only: Jake 11-03 "that town might be a little bit too big") are marked R4. Round 5 changes (the SE BOTTOM and the
// hidden layers only: Jake 11-03 "like Elden Ring or Dark Souls, there needs to be a boss portal") are marked R5.
// Everything else is round 4's.
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
// R4: the town shrinks from 176 to 120 m (14,400 m², was 30,976), still against the seam on the west entry's line.
// 120 m keeps one block of houses on every side of a 40 m gate plaza and a 72 m Main Street; the freed 16,576 m² goes
// to the toys. Its east gate opens onto the seam avenue; across it, the seam gate is the only way into the combat half.
export const TOWN = { x0: -128, x1: -8, z0: -60, z1: 60, wall: 5 };
export const PLAZA = { x0: -56, x1: -16, z0: -20, z1: 20 };           // the gate plaza, just inside the east gate
export const ROAD = { half: 8.5, x0: 8, x1: STRIP.inner };            // the walled east road (combat side)
export const SEAM_X = 7.5;                                            // seam wall
// Town gates: each opens toward the toys it names. Only the East Gate leads to combat.
export const GATES = [
  { id: 'E', name: 'EAST GATE', x: -8, z: 0, to: 'seam gate → the combat road (the only way in)' },
  { id: 'N', name: 'STABLE GATE', x: -36, z: -60, to: 'paddock · riding course' },
  { id: 'NW', name: 'MOVERS GATE', x: -95, z: -60, to: 'movers sequence · grapple course' },
  { id: 'W', name: 'WEST GATE', x: -128, z: 0, to: 'grapple start · climb yard · the Rock' },
  { id: 'SW', name: 'PARK GATE', x: -95, z: 60, to: 'hover park · climb yard' },
  { id: 'S', name: 'RANGE GATE', x: -36, z: 60, to: 'weapon range · physics yard' },
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
    why: 'R4: 120 m (was 176): gate plaza, Main Street shop row, lanes, houses, six gates', stack: 'roofs: the zipline lands on the zip house' },
  { id: '02', name: 'WEAPON RANGE', kind: 'west', shape: 'rect', x0: -92, x1: -14, z0: 68, z1: 170,
    why: 'R4: melee yard (sword, spear dummies), 2 bow + 2 crossbow lanes 10-50 m, ammo practice, rifle lane to 75 m', stack: 'out of the Range Gate' },
  { id: '03', name: 'PHYSICS YARD', kind: 'west', shape: 'rect', x0: -92, x1: -14, z0: 180, z1: 234,
    why: 'R4: its own yard (was half of physics + hover): see-saws, crate stacks, ball run, pressure-plate gate', stack: '' },
  { id: '04', name: 'RIDING COURSE', kind: 'west', shape: 'stadium', x: -122, z: -186, halfLen: 60, r: 44,
    why: 'Nalati oval as shipped: 479 m lap = 37 s at gallop; 8 rings, 4 jumps, lap-timer gantry', stack: 'chute from the paddock' },
  { id: 'MP', name: 'PADDOCK', kind: 'cand', shape: 'rect', x0: -62, x1: -14, z0: -132, z1: -72,
    why: 'loaner horse, mounting block, trough, chute onto the oval', stack: 'outside the Stable Gate' },
  { id: '05', name: 'MOVERS SEQUENCE', kind: 'west', shape: 'rect', x0: -168, x1: -70, z0: -132, z1: -74,
    why: 'R4: a straight run of six stations, east to west (was a stacked spiral): conveyors, jump pads, sliders, spinners, lift, top deck', stack: 'rope bridge from the top deck onto the tank roof' },
  { id: '06', name: 'GRAPPLE COURSE', kind: 'west', shape: 'rects', list: [[-234, -176, -132, -14], [-176, -136, -70, -12]],
    why: 'R4: a timed course: start pad, 2 hook poles, tank, hook mast, 45 m tower, 99 m zip to the finish on the zip house', stack: 'every hop <= 38 m' },
  { id: '10', name: 'CLIMB YARD', kind: 'west', shape: 'rect', x0: -176, x1: -136, z0: 14, z1: 70,
    why: 'R4 new: ladders, a scramble wall, three platforms 6/10/14 m and swaying rope bridges, the last onto the Rock', stack: '' },
  { id: 'H', name: 'THE ROCK', kind: 'west', shape: 'rect', x0: -228, x1: -184, z0: 14, z1: 74,
    why: 'R4: a free-standing 16 m crag west of the town: scramble route, ladder, squeeze cave through it, lookout bench', stack: 'squeeze cave 60 m under it' },
  { id: '11', name: 'HOVER PARK', kind: 'west', shape: 'rect', x0: -234, x1: -100, z0: 112, z1: 234,
    why: 'R4: hover only (physics moved out): halfpipe, 3 kickers with a 45 m run-up, quarter pipes, funbox, rails, bowl', stack: 'trick-score start pad' },

  { id: '07', name: 'STEALTH YARD', kind: 'set', shape: 'rect', x0: 126, x1: 232, z0: 14, z1: 118,
    why: 'R3: band 5 IS the yard (L13-15): Riveter patrols behind tall walls; the storm is cover', stack: 'keycard shed; beacons on its corner towers' },
  // R5: the SE bottom. The Titan amphitheatre (r 38) and its 39 m approach leave the surface: the fight is a hidden
  // arena (TITAN_ARENA, y -150) behind a portal in a small Titan gate at the very bottom right. The gauntlet takes the
  // rest: a forecourt and three walled courts run through three gates (C1 -> G1 -> C2 -> G2 -> C3 -> G3 -> the Titan gate).
  { id: '08F', name: 'GAUNTLET FORECOURT', kind: 'set', shape: 'rect', x0: 40, x1: 120, z0: 123, z1: 142,
    why: 'R5: both SE-wall gates open into it; the checkpoint, the run board (5 waves, best time), the entry to C1', stack: 'the Titan road leaves its east end' },
  { id: '08A', name: 'C1 · LOADING YARD', kind: 'set', shape: 'rect', x0: 14, x1: 96, z0: 142, z1: 184,
    why: 'R5: waves 1-2 (L16-17); 8 m entry terrace at +3 m over an 82 x 34 m floor; spawn doors D1, D2', stack: 'gate G1 in its south wall' },
  { id: '08B', name: 'C2 · THE PIT', kind: 'set', shape: 'rect', x0: 14, x1: 96, z0: 190, z1: 234,
    why: 'R5: waves 3-4 (L17-18); entry ledge at +2.5 m, floor 82 x 37 m; the elite reveal lift; spawn doors D3, D4', stack: 'gate G2 in its east wall' },
  { id: '08C', name: "C3 · FOREMAN'S FLOOR", kind: 'set', shape: 'disc', x: 146, z: 186, r: 42,
    why: "R5: wave 5, Foreman Unit 7 (L18): r 28 floor, terraces +1.5 m (to r 34) and +3 m (to r 40), 6 m wall; the Foreman's balcony", stack: 'gate G3 east to the Titan gate' },
  { id: 'TG', name: 'TITAN GATE', kind: 'set', shape: 'rects', dims: 'lane + plaza', list: [[208, 222, 136, 197], [188, 208, 182, 190], [196, 235, 197, 235]],
    why: 'R5: a 14 m walled lane off the Titan road (and the G3 spur) into a 39 x 38 m plaza: checkpoint, the portal arch, the return pad', stack: 'portal -> the hidden Titan arena, y -150' },
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
  { name: 'Foreman Unit 7', lv: 18, band: 6, where: 'R5: the gauntlet\'s wave 5, on C3 (the Foreman\'s floor)', x: 146, z: 186 },
  { name: 'The Crate Titan', lv: 20, band: 0, where: 'R5: the hidden arena (y -150), through the Titan gate portal', x: 216, z: 224 },
];

// R4: the town's services, packed into the 120 m town. The gate plaza (40 x 40 m) holds the quest corner (board +
// three tier givers), contracts, trophy wall, feats, three stalls and the obelisk; Main Street (72 m, west of the
// plaza) holds Tinker Rook's shop, the weapons shop, three empty fronts and the zip house.
export const HUB = {
  services: [
    { id: 'QB', name: 'QUEST BOARD', x: -36, z: -17, ry: 0 },
    { id: 'CB', name: 'CONTRACTS', x: -26, z: 17, ry: Math.PI },
    { id: 'TW', name: 'TROPHY WALL', x: -42, z: 18, ry: Math.PI },
    { id: 'FT', name: 'FEATS', x: -54, z: 12, ry: -Math.PI / 2 },
    { id: 'TR', name: 'TINKER ROOK', x: -64.5, z: -13, shop: true, sub: 'vendor · UPGRADES · BENCH', box: [-72, -57, -20, -6] },
    { id: 'WS', name: 'WEAPONS', x: -64.5, z: 13, shop: true, sub: 'level-locked stock', box: [-72, -57, 6, 20] },
  ],
  npcs: [
    { id: 'G1', name: 'Yard Boss', lock: 'L1–6', x: -29, z: -13, giver: true,
      quests: 'Mite nests · Jacks off the line · Big Pallet' },
    { id: 'G2', name: 'Surveyor', lock: 'L7–12', x: -36, z: -12, giver: true,
      quests: 'Ground the drones · Cut the torches · The Training Vault' },
    { id: 'G3', name: 'Shift Boss', lock: 'L13–20', x: -43, z: -13, giver: true,
      quests: 'Storm hour · Keycard · Sentry duels · Foreman Unit 7 · The Crate Titan' },
    { id: 'TR', name: 'Tinker Rook', lock: 'shop', x: -64, z: -3.5, giver: false, quests: 'vendor (Forge tiers) + UPGRADES and BENCH' },
    { id: 'WK', name: 'Weapons keeper', lock: 'shop', x: -64, z: 3.5, giver: false, quests: 'weapons, level-locked' },
    { id: 'SH', name: 'Stable hand', lock: 'horses', x: -36, z: -54, giver: false, quests: 'lends the loaner horse (inside the Stable Gate)' },
  ],
  // three empty shop fronts on Main Street for later shops
  toLet: [[-89, -75, -18, -6], [-89, -75, 6, 18], [-120, -104, 6, 18]],
  zipHouse: { x0: -124, x1: -106, z0: -26, z1: -7, h: 12 },
  stable: [-28, -10, -56, -38],
  obelisk: { x: -34, z: 0, h: 22 },
  trophyFrames: 12,
};
// The town's streets (open) and blocks (filled with house lots by lab.js townPlan).
export const STREETS = [
  [-127, -56, -6, 6],      // Main Street, West Gate -> plaza
  [-42, -30, -59, -20],    // Stable Lane
  [-42, -30, 20, 59],      // Range Lane
  [-99, -91, -59, 59],     // Cross Lane, Movers Gate -> Park Gate
  [-127, -42, -36, -32], [-127, -42, 32, 36],   // back alleys
];
export const BLOCKS = [
  [-127, -99, -59, -36], [-127, -99, -32, -6], [-91, -42, -59, -36], [-91, -56, -32, -6], [-56, -42, -32, -20], [-30, -9, -59, -20],
  [-127, -99, 6, 32], [-127, -99, 36, 59], [-91, -56, 6, 32], [-56, -42, 20, 32], [-91, -42, 36, 59], [-30, -9, 20, 59],
];

// R4: THE WEST TOYS, item by item. Every builder in lab.js reads these, and the west close-up labels each one.
export const RANGE = {
  firingZ: 80, bermZ: [156, 168],
  melee: { x0: -34, x1: -14, z0: 72, z1: 120, sword: [[-30, 86], [-24, 86], [-18, 86]], spear: [[-30, 104], [-24, 104], [-18, 104]] },
  lanes: [   // west -> east; d = target distances from the firing line
    { name: 'LEVER RIFLE', x: -86.2, d: [25, 50, 75] },
    { name: 'CROSSBOW · AMMO', x: -74.6, d: [10, 20, 30, 40, 50], ammo: ['IRON', 'PITCH', 'BROADHEAD'] },
    { name: 'CROSSBOW', x: -63, d: [10, 20, 30, 40, 50] },
    { name: 'BOW', x: -51.4, d: [10, 20, 30, 40, 50] },
    { name: 'BOW', x: -39.8, d: [10, 20, 30, 40, 50] },
  ],
  pb: [-56, 74],
};
export const MOVERS = {   // east -> west along z -103; heights in metres
  z: -103, start: [-74, -90], pb: [-66, -96],
  stations: [
    { n: 1, name: 'CONVEYORS', x0: -80, x1: -100, y: 0, note: '3 belts, alternating' },
    { n: 2, name: 'JUMP PADS', x0: -102, x1: -118, y: 0, note: '3 pads up to a 6 m ledge' },
    { n: 3, name: 'SLIDING PLATFORMS', x0: -124, x1: -140, y: 6, note: '3 sliders across a pit' },
    { n: 4, name: 'SPINNER', x0: -142, x1: -152, y: 6, note: 'turning disc + sweep arm' },
    { n: 5, name: 'LIFT', x0: -154, x1: -160, y: 6, note: '6 → 18 m' },
    { n: 6, name: 'TOP DECK', x0: -160, x1: -168, y: 18, note: 'rope bridge → tank roof' },
  ],
};
export const GRAPPLE = {
  start: [-142, -22], pb: [-138, -18],
  poles: [{ n: 1, x: -150, z: -44, h: 12 }, { n: 2, x: -170, z: -68, h: 16 }],
  tank: { x: -206, z: -104, r: 16, h: 18 },
  mast: { x: -200, z: -68, h: 28 },
  tower: { x: -212, z: -34, half: 8, h: 45 },
  zip: 22,   // m/s
};
export const CLIMB = {
  scramble: [-174, -160, 16, 22],
  decks: [{ id: 'A', x: -166, z: 28, h: 6 }, { id: 'B', x: -146, z: 44, h: 10 }, { id: 'C', x: -170, z: 60, h: 14 }],
  ladders: ['A', 'B', 'C'],
  bridges: [['A', 'B'], ['B', 'C'], ['C', 'ROCK']],
};
export const ROCK = { x: -206, z: 44, h: 16, rx: 23, rz: 29.4, caveN: [-200, 14], caveS: [-200, 74], ladder: [-216, 15.5] };
export const HOVER = {
  start: [-106, 143], pb: [-106, 152],
  halfpipe: { x: -220, z0: 120, z1: 165 },
  runup: [-112, -157], kickers: [[132, 1.6], [143, 2.4], [154, 3.2]], kickerX: -160,
  quarters: [[-122, 206, Math.PI], [-168, 206, 0]], funbox: [-145, 206], rails: [[-198, 184], [-198, 192], [-198, 200]], bowl: [-212, 216, 12],
};
export const PHYSICS = {
  plates: [[-82, 192], [-72, 192], [-62, 192]], plateGate: [-52, 182, 202], crates: [[-86, 204], [-30, 226], [-44, 228]],
  seesaws: [[-80, 224], [-62, 224]], ballRun: { x0: -42, x1: -18, z: 196, h: 6 }, skittles: [-50, 196],
};
export const PADDOCK = { horse: [-30, -110], block: [-36, -96], trough: [-52, -100], chuteX: -40 };
export const RIDING = { gantryX: -80, trackZ: -148, pb: [-80, -137], rings: 8, jumps: 4 };
// Walks from the plaza (the quest corner, -36, 0) to each toy's start, through the gates. Waypoints in metres.
export const WALKS = [
  { to: 'Weapon range (firing line)', path: [[-36, 0], [-36, 60], [-50, 76]] },
  { to: 'Physics yard (ball run)', path: [[-36, 0], [-36, 60], [-11, 64], [-11, 176], [-22, 188]] },
  { to: 'Paddock (loaner horse)', path: [[-36, 0], [-36, -60], [-30, -106]] },
  { to: 'Riding course (start gantry)', path: [[-36, 0], [-36, -60], [-40, -132], [-80, -146]] },
  { to: 'Movers sequence (start)', path: [[-36, 0], [-36, -34], [-95, -34], [-95, -60], [-74, -90]] },
  { to: 'Grapple course (start)', path: [[-36, 0], [-128, 0], [-142, -22]] },
  { to: 'Climb yard (scramble wall)', path: [[-36, 0], [-128, 0], [-160, 10], [-167, 18]] },
  { to: 'The Rock (cave mouth)', path: [[-36, 0], [-128, 0], [-200, 10], [-200, 14]] },
  { to: 'Hover park (trick start)', path: [[-36, 0], [-36, 34], [-95, 34], [-95, 60], [-106, 143]] },
];

// Special quest targets (the rest are generated: one per band tier, at that tier's packs).
export const QUESTS = [
  { band: 2, lock: 5, name: 'Big Pallet', x: 96, z: -206 },
  { band: 4, lock: 10, name: 'Training Vault', x: 215, z: -61 },
  { band: 5, lock: 13, name: 'Keycard', x: 220, z: 106 },
  { band: 5, lock: 13, name: 'Storm hour', x: 179, z: 66 },
  { band: 6, lock: 16, name: 'Foreman Unit 7', x: 146, z: 186 },
  { band: 6, lock: 18, name: 'Crate Titan', x: 216, z: 224 },
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
  { name: 'SQUEEZE CAVE', w: 60, d: 10, y: -6, under: 'H' },   // R4: through the Rock, north mouth on the west avenue, south mouth facing the hover park,
  // R5: the Crate Titan's arena, reached only through the Titan gate portal. r 70 overall (stands), floor y -150.
  { name: 'CRATE TITAN ARENA', w: 140, d: 140, y: -150, under: 'TG', cx: 150, cz: 165, round: true },
];

// Vistas (b), hidden caches (c). R4: the lookout is the Rock's top bench (tower, climb yard and town in one frame);
// the east gatehouse roof looks over bands 1-4. Two vistas and every east Gold 1x1 are round 3's.
export const LOOKOUT = { x: -210, z: 40, y: 16 };
export const SECRETS = [
  { k: 'b', x: LOOKOUT.x, z: LOOKOUT.z, y: 16, at: 'Rock lookout' }, { k: 'b', x: -206, z: -104, y: 18, at: 'tank roof' },
  { k: 'b', x: -212, z: -34, y: 45, at: 'tower top' },
  { k: 'b', x: 216, z: 229, y: 18, at: 'Titan gate arch top' }, { k: 'b', x: -229, z: -229, y: 0, at: 'NW corner' }, { k: 'b', x: 229, z: -229, y: 0, at: 'NE corner' },
  { k: 'b', x: -229, z: 229, y: 0, at: 'SW corner' }, { k: 'b', x: -10, z: -10, y: 9, at: 'east gatehouse roof' },
  { k: 'c', x: -233, z: -150, y: 0, at: 'behind the oval' }, { k: 'c', x: -233, z: 90, y: 0, at: 'behind the Rock' },
  { k: 'c', x: -96, z: 232, y: 0, at: 'hover / physics alley' }, { k: 'c', x: -20, z: -233, y: 0, at: 'north wall' },
];
// 20 Gold 1x1 cubes (loot-economy item 8): 10 west, 10 east. Mostly up high or tucked away (every 5 = a perk).
export const GOLD = [
  { x: -206, z: -104, y: 18.5, at: 'tank roof' }, { x: -212, z: -34, y: 36.6, at: 'tower deck 4' },
  { x: -204, z: 50, y: 16.5, at: 'the Rock top' }, { x: -200, z: 44, y: -5.5, at: 'squeeze cave' },
  { x: -211, z: 142, y: 5, at: 'halfpipe lip' }, { x: -122, z: -186, y: 0, at: 'oval infield' },
  { x: -60, z: 162, y: 10.5, at: 'range berm top' }, { x: -164, z: -103, y: 19, at: 'movers top deck' },
  { x: -34, z: 0, y: 22.5, at: 'obelisk crown' }, { x: -110, z: -12, y: 12.5, at: 'zip-house roof (finish)' },
  { x: 16, z: -114, y: 0, at: 'band 1 crate maze' }, { x: 16, z: -230, y: 0, at: 'band 2 corner' },
  { x: 230, z: -230, y: 0, at: 'band 3 far corner' }, { x: 233, z: -100, y: 0, at: 'band 4 edge' },
  { x: 215, z: -61, y: 9.5, at: 'vault gatehouse roof' }, { x: 216, z: 229, y: 18.5, at: 'Titan gate arch crown' },
  { x: 220, z: 106, y: 4.5, at: 'keycard shed roof' }, { x: 181, z: 151, y: 8.5, at: "Foreman's office roof" },
  { x: 14, z: 116, y: 0, at: 'band 6 corner' }, { x: 232, z: 118, y: 20, at: 'beacon 3 crown' },
];

// ---------- R5: the SE bottom and the hidden layers ----------
// The SE bottom (x 8..237, z 122..237, 229 x 115 m = 26,335 m²) as round 4 had it, for the before/after.
export const SE_BOTTOM = { x0: 8, x1: 237, z0: 122, z1: 237 };
export const R4_SE = { gauntlet: 5542, approach: 624, titan: 4536, gauntletFloorR: 28, gauntletOuterR: 42, titanFloorR: 28 };
// The Titan road: from the forecourt's east end along the SE wall to the Titan gate lane (circulation, 12 m wide).
export const TITAN_ROAD = { x0: 120, x1: 222, z0: 124, z1: 136 };

// R5: THE GAUNTLET, a run of three sealed courts through three gates (the shrine host's sealed wave room, DG1, three
// times in a row; DG2: a death restarts the court you died in). Waves 1-2 in C1, 3-4 in C2, 5 (the Foreman) in C3.
// y = ground height of a step. Doors D1-D6 are spawn doors with a small closet behind (no spawn in view, EBW5).
export const GAUNTLET = {
  entry: { x: 62, z: 142, name: 'ENTRY', note: 'from the forecourt; seals when wave 1 starts' },
  checkpoint: [48, 132], board: [86, 130],
  courts: [
    { id: 'C1', zone: '08A', name: 'LOADING YARD', waves: [1, 2], floor: [14, 96, 150, 184], steps: [{ box: [14, 96, 142, 150], y: 3, name: 'ENTRY TERRACE +3 m' }],
      ramps: [[30, 146, 0], [80, 146, 0]], wallH: 5 },
    { id: 'C2', zone: '08B', name: 'THE PIT', waves: [3, 4], floor: [14, 96, 197, 234], steps: [{ box: [14, 96, 190, 197], y: 2.5, name: 'ENTRY LEDGE +2.5 m' }],
      ramps: [[48, 193.5, 0], [76, 193.5, 0]], wallH: 5 },
    { id: 'C3', zone: '08C', name: "FOREMAN'S FLOOR", waves: [5], disc: { x: 146, z: 186, floor: 28, t1: 34, t2: 40, wall: 42 }, wallH: 6 },
  ],
  // the three gates of the run: each opens when its court's last wave dies
  gates: [
    { id: 'G1', x: 30, z: 187, w: 10, from: 'C1', to: 'C2', passage: [25, 35, 184, 190] },
    { id: 'G2', x: 105, z: 214, w: 8, from: 'C2', to: 'C3', passage: [96, 115, 210, 218] },
    { id: 'G3', x: 198, z: 186, w: 8, from: 'C3', to: 'the Titan gate', passage: [188, 208, 182, 190] },
  ],
  doors: [
    { id: 'D1', court: 'C1', x: 14, z: 167, closet: [8, 14, 161, 173] }, { id: 'D2', court: 'C1', x: 96, z: 167, closet: [96, 104, 161, 173] },
    { id: 'D3', court: 'C2', x: 14, z: 216, closet: [8, 14, 210, 222] }, { id: 'D4', court: 'C2', x: 96, z: 228, closet: [96, 104, 222, 234] },
    { id: 'D5', court: 'C3', x: 146, z: 144, closet: [140, 152, 137, 144] }, { id: 'D6', court: 'C3', x: 146, z: 228, closet: [140, 152, 228, 236] },
  ],
  reveal: { x: 55, z: 229, size: 6, rise: 4, note: 'C2: the named elite rides up on a lift under a banner (wave 3)' },
  balcony: { x: 175, z: 157, y: 6, office: [176, 186, 146, 156], note: 'C3: the Foreman whistles from his office balcony, then drops in (wave 5)' },
  trophy: { x: 160, z: 186, note: "Foreman's trophy chest, on C3 after wave 5" },
  // cover on the floors: half walls 1.1 m, crate stacks 2.4 m, tall pillars 6 m (line of sight vs rivet guns and the spray)
  cover: [
    ['half', 34, 166, 0], ['half', 76, 172, 0], ['crates', 55, 160, 0], ['crates', 55, 177, 0], ['crates', 24, 178, 0], ['pillar', 86, 158, 0],
    ['pillar', 40, 214, 0], ['pillar', 70, 214, 0], ['half', 26, 226, 1.57], ['half', 55, 205, 0], ['half', 84, 222, 1.57], ['crates', 55, 222, 0],
    ['pillar', 134, 176, 0], ['pillar', 158, 196, 0], ['crates', 128, 198, 0], ['crates', 164, 174, 0], ['half', 146, 168, 0], ['half', 146, 204, 0],
  ],
  // the waves. live = most robots up at once (the whistle calls 3 Mites, max 6 out; P2 adds a Jack and a Sentry once)
  waves: [
    { n: 1, court: 'C1', lv: 'L16', doors: ['D1', 'D2'], what: '4 Arc Sentries (two pairs)', live: 4 },
    { n: 2, court: 'C1', lv: 'L16–17', doors: ['D1', 'D2'], what: '4 Riveters + 2 Arc Sentries', live: 6 },
    { n: 3, court: 'C2', lv: 'L17', doors: ['D3', 'D4', 'LIFT'], what: '3 Riveters + 2 Sentries + a named elite (L18) on the lift', live: 6 },
    { n: 4, court: 'C2', lv: 'L17–18', doors: ['D3', 'D4'], what: '4 Riveters + 4 Arc Sentries', live: 8 },
    { n: 5, court: 'C3', lv: 'L18', doors: ['D5', 'D6', 'BALCONY'], what: 'Foreman Unit 7 + whistled Mites (max 6) + P2 Pallet Jack + Arc Sentry', live: 9 },
  ],
  // threat sizes used by the fit check (enemies-bosses §2: slam ring 1.0 s then a shockwave to jump; lunge 0.8 s).
  // ASSUMED until EB tunes them: Riveter shockwave runs out to r 8 m; Arc Sentry lunge covers 7 m; robots close at 4.3 m/s.
  threat: { ringR: 8, lungeM: 7, robotSpeed: 4.3 },
};

// R5: THE TITAN GATE (surface). A walled lane, then a small plaza: the checkpoint (the "stake"), the plaque, the portal
// arch (the boss fog), the return pad. The 12 s intro plays INSIDE the hidden arena on arrival (lab README says why).
export const TITAN_GATE = {
  lane: [208, 222, 136, 197], plaza: [196, 235, 197, 235],
  stake: [211, 210], plaque: [209, 222], returnPad: [222, 214],
  arch: { x: 216, z: 229, w: 16, h: 18, portalR: 6 },
};

// R5: the Crate Titan at three test heights (H, metres). Proportions of the blockout model, as fractions of H.
export const TITAN = {
  scales: [9, 15, 20], chosen: 15,
  body: { leg: .42, torso: .36, head: .22, shoulder: .5, armLen: .46, fist: .13 },
};
// R5: THE HIDDEN TITAN ARENA, inside the cell's footprint at y -150 (CELL_BELOW = 250 allows down to -250).
// r 52 floor (~7 x the 15 m Titan), 8 m wall, stands to r 70 rising 24 m (the intro's high wide shot), floodlights.
// The volume runs from the floor slab (y -156) to its own sky ceiling (y -80): 70 m clear above the floor.
export const TITAN_ARENA = {
  cx: 150, cz: 165, y: -150, slab: 6, ceiling: -80,
  floorR: 52, wallR: 56, wallH: 8, standsR: 70, standsH: 24, leapBand: [40, 50],
  lanes: [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4],   // P3: the 4 x 8 block rolls down one (1.0 s)
  cover: [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map(a => ({ a, r: 30 })),   // broken crate stacks (cardinal, off the lanes)
  alcove: { w: 16, d: 14, note: 'south: the inner checkpoint, the exit portal, the fog gate onto the floor' },
  floodlights: 4,
};
// R5: every layer as a box (x0, x1, z0, z1, y0, y1) for the no-intersection check.
export const LAYERS = [
  { name: 'Surface (deepest: the squeeze cave, y −6; tallest: the 45 m grapple tower)', box: [-250, 250, -250, 250, -6, 45] },
  { name: 'Training Vault interior (4 rooms)', box: [151, 221, -99, -29, -40, -30] },
  { name: 'Crate Titan arena (floor, stands, sky)', box: [80, 220, 95, 235, -156, -80] },
];

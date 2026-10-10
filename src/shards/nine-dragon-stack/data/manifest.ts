// Nine Dragon Stack's manifest rows (SHARD-PLATFORM M3, ex manifest.ts): its strings, the files its boot declares, its
// asset globs, its loadout, its creatures' look, its places on the full map and its explore comparisons.

/** the deck card's and the HUD's strings */
export const NINE_STRINGS = {
  name: 'Nine Dragon Stack',
  label: '(−2, +1)',
  biome: 'Vertical neon city',
  blurb: 'Lantern Square, halfway up a city stacked 500 m high: wet granite, a cinnabar gate, neon calligraphy and the Yamen Well dropping away into silk fog. A prototype fragment — the square, the Well\'s rim and the stair-street — rough edges everywhere.',
  /** the full map's name for each of the road's four portals (the decks at the cell's edge midpoints) */
  roadPortal: 'Road portal',
};

/** where each named place sits on the plan, the middle of its layout.ts rectangle (PLAZA, STALL, STAIR, WELL) to the metre;
 *  the Well's galleries and crossings hang under its rim, so the rim names them */
export const PLACE_AT: Readonly<Record<string, { x: number; z: number; r: number }>> = {
  'lantern-square': { x: 11, z: -3, r: 16 },
  'night-market': { x: 19, z: -17, r: 6 },
  'stair-street': { x: 46, z: 6, r: 24 },
  'well-rim': { x: -14, z: -14, r: 18 },
};

/** the road's four portals on the full map, in the format's edge order (north is +z), 236 m out on each axis */
export const ROAD_PORTAL_PINS = [
  { edge: 'north', x: 0, z: 236 }, { edge: 'east', x: 236, z: 0 }, { edge: 'south', x: 0, z: -236 }, { edge: 'west', x: -236, z: 0 },
];

/** the world's files, declared so the loading bar counts them and the offline cache holds them */
export const BOOT_FILES = [
  // the paint (look/paint.ts)
  '/assets/nine-dragon/paint/concrete.jpg', '/assets/nine-dragon/paint/flag.jpg', '/assets/nine-dragon/paint/flag-a.jpg', '/assets/nine-dragon/paint/flag2.jpg', '/assets/nine-dragon/paint/flag2-a.jpg', '/assets/nine-dragon/paint/lacquer.jpg',
  '/assets/nine-dragon/paint/panel.jpg', '/assets/nine-dragon/paint/poster.jpg', '/assets/nine-dragon/paint/poster-a.jpg', '/assets/nine-dragon/paint/stone.jpg', '/assets/nine-dragon/paint/tiles.jpg', '/assets/nine-dragon/paint/wood.jpg',
  // G285: the layout's offline bake (world/layoutBake.ts)
  '/assets/nine-dragon/baked/layout.bin',
  // G285: the code-built models' and the canopy's geometry (world/specimens.ts)
  '/assets/nine-dragon/baked/specimens.bin',
  '/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb',
  '/assets/nine-dragon/lab/grapple/dragon-hook.glb',
  '/assets/nine-dragon/lab/organic/lion.glb', '/assets/nine-dragon/lab/organic/pots.glb', '/assets/nine-dragon/lab/organic/lanterns.glb',
  '/assets/nine-dragon/lab/organic/leaf-atlas.webp', '/assets/nine-dragon/lab/organic/scroll.webp',
  '/assets/nine-dragon/grade-lut-cleanroom.bin',
  // the first-person arms (lab P8's rig: vm/arms.ts ARMS_FILES)
  '/assets/nine-dragon/viewmodel/fp-rig.glb',
  '/assets/nine-dragon/viewmodel/hand-r-maps.webp', '/assets/nine-dragon/viewmodel/hand-r-nrm.webp',
  '/assets/nine-dragon/viewmodel/arm-r-maps.webp', '/assets/nine-dragon/viewmodel/arm-r-nrm.webp',
  '/assets/nine-dragon/viewmodel/fist-l-maps.webp', '/assets/nine-dragon/viewmodel/fist-l-nrm.webp',
  '/assets/nine-dragon/viewmodel/gauntlet-maps.webp', '/assets/nine-dragon/viewmodel/gauntlet-nrm.webp',
];

/** what the shard ships under public/ */
export const ASSET_GLOBS = ['public/assets/nine-dragon/**', 'public/assets/gpu/nine-dragon/**', 'public/assets/music/nine-dragon-stack/**', 'public/assets/sfx/nine-dragon-stack/**', 'public/assets/title/nine-dragon-stack-portrait.jpg', 'public/assets/nine-dragon-stack/map/**'];

/** the Neon Jian and the hoverboard to start, the Fei Zhua to find */
export const LOADOUT = { weapons: ['weapon.jian'], tools: ['tool.fei-zhua', 'tool.hoverboard'], start: ['weapon.jian', 'tool.hoverboard'], pickups: [] };

/** its creatures' look (it spawns none yet) */
export const CREATURE_LOOK = { lowPoly: false, waitForModels: false, furRim: false, tintRange: 0.2, oneMaterial: false };

/** the World Explorer's live-against-target comparisons (the live and target images are the manifest's imports) */
export const COMPARE_ROWS = [
  { id: 'gate', label: 'Lantern gate', model: 'nine-gate', target: 'art/nine-dragon-stack/round-15-eight-domes/A2-gate-look/target-5.jpg' },
  { id: 'stair', label: 'Stair street', model: 'nine-stair', target: 'art/nine-dragon-stack/round-15-eight-domes/C1-stair-stand/target-5.jpg' },
];

/** Authored stable quest commands, lantern conditions and pickup placements; native geometry/modal owners remain. */
/** The existing command protocol; the modal/ride keeper owns delivery and continuation. */
export const PINE_GRAPH_DATA = { actor: 'pine.interact', step: 'pine.quest.graph', actions: [] };
/** Stable row identities reused by the frame's action path without allocating command strings. */
export const PINE_LANTERN_IDS = { pond: 'lantern.pond', ridge: 'lantern.ridge', den: 'lantern.den' } as const;
/** Command bindings for the shipping latched puzzle, pickups and repeatable bench. */
export const PINE_TABLE_ACTIONS = [
  { id: 'dam-log-a', act: 1 }, { id: 'dam-log-b', act: 2 }, { id: 'pond-glass', act: 3 }, { id: 'ridge-flint', act: 4 },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `token-${i + 1}`, act: 10 + i })), { id: 'lookout-bench', act: 18 },
] as const;
/** Authored lantern requirements and their one-way commits, consumed on both page and native. */
export const PINE_LANTERN_ROWS = [
  { id: 'lantern.pond', act: 5, at: 'lantern.pond', needs: [{ none: ['lit:pond'] }, { all: ['taken:pond-glass'] }], sets: ['lit:pond'] },
  { id: 'lantern.ridge', act: 6, at: 'lantern.ridge', needs: [{ none: ['lit:ridge'] }, { all: ['taken:ridge-flint'] }], sets: ['lit:ridge'] },
  { id: 'lantern.den', act: 7, at: 'lantern.den', needs: [{ none: ['lit:den'] }, { all: ['talked:ranger'] }], sets: ['lit:den'] },
];

export const RESIN_FLAG = 'resin:';
export const TOKEN_FLAG = 'token:';
export const SECRET_FLAGS = ['secret:vista', 'secret:log', 'secret:islet'] as const;

/** 30 resin drops by the trails, one per stretch (each snaps to the nearest trunk within 9 m) */
export const RESIN_SPOTS: readonly [number, number][] = [
  [8, -205], [-14, -165], [-22, -120], [-38, -70], [-32, -26], [12, -20], [40, 8], [70, 24], [100, 4], [136, 20],
  [176, -12], [128, -62], [172, -84], [118, -124], [186, 40], [-12, 50], [14, 100], [-8, 140], [-40, 78], [-76, 142],
  [56, 104], [96, 136], [138, 118], [122, 170], [88, 190], [-82, -8], [-128, -32], [-142, -96], [-80, -142], [-182, 22],
];
export const RESIN_COUNT = RESIN_SPOTS.length;


export const TOKEN_NAMES = ['the fire lookout', 'the hollow log', 'the islet', "the King's stones", 'the waterfall', 'the ridge cabin', 'the mill hamlet', 'under the creek bridge'] as const;

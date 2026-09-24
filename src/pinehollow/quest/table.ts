/**
 * Pine Hollow's interactables (PINE-HOLLOW-REMASTER PH-C1 / C8) on Driftwood's kit (src/world/interact/): the data table,
 * validated by `validateTable` (test/pine-quest.test.ts), built by `Interactables`, read by the quest through flags.
 *
 *   THE POND PUZZLE (beat 2): two logs jam the beaver dam's sluice (a lever on each bank: "Heave the log off the sluice");
 *     with both off the sluice gate lifts on its own and latches (`open:dam-sluice`), the beaver pool drains through it,
 *     and the pond lantern's glass washes out onto the gravel bank below the dam (`taken:pond-glass`).
 *   THE RIDGE (beat 3): the fire-watcher's flint on the fire finder in the lookout's cab (`taken:ridge-flint`).
 *   COLLECTIBLES (PH-U22): 30 amber resin drops (walk into one: `resin:<n>`, an Amber resin in the pack) snapped onto the
 *     nearest pine's trunk at runtime; 8 carved wooden tokens (E: `token:<n>`) at eight memorable spots.
 *   THE SECRETS: the vista bench on the lookout's catwalk (`used:lookout-bench`); the hollow log and the islet are the
 *     runtime's (secrets.ts), each raising `secret:<id>`.
 *
 * Placement is world coordinates (`poi: 'world'`); `y` pins heights on the tower (its deck), the rest sit on the floor.
 */
import type { InteractTable, PickupDef } from '../../world/interact/types';

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

/** a resin drop's placement (the runtime resolves it: the trunk's side facing the trail, ~1.1 m up) */
export interface Spot { x: number; z: number; y?: number; dy?: number }
/** the eight tokens and the places the runtime computes (the tower's deck, the hollow log, the islet …) */
export interface TableSites {
  resin: Spot[];
  tokens: Spot[];
  /** the beaver dam: its centre on the sill, the flow direction (unit, downstream), the bank normal (unit, across) */
  dam: { x: number; z: number; fx: number; fz: number; ax: number; az: number };
  /** the fire finder's top in the lookout cab (world) and the vista bench on the catwalk (world + yaw) */
  finder: { x: number; y: number; z: number };
  bench: { x: number; y: number; z: number; yaw: number };
}

export const TOKEN_NAMES = ['the fire lookout', 'the hollow log', 'the islet', "the King's stones", 'the waterfall', 'the ridge cabin', 'the mill hamlet', 'under the creek bridge'] as const;

export function pineTable(s: TableSites): InteractTable {
  const d = s.dam, yaw = Math.atan2(d.fx, d.fz);
  const resin: PickupDef[] = s.resin.map((p, i) => ({
    kind: 'pickup', id: `resin-${i + 1}`, look: 'resin', item: 'amber-resin', label: 'Amber resin', touch: true, color: '#ffae3a',
    at: { poi: 'world', x: p.x, z: p.z, ...(p.y !== undefined ? { y: p.y } : {}), dy: p.dy ?? 1.1 }, sets: [`${RESIN_FLAG}${i + 1}`],
  }));
  const tokens: PickupDef[] = s.tokens.map((p, i) => ({
    kind: 'pickup', id: `token-${i + 1}`, look: 'token', label: 'the carved token', color: '#ffc27a',
    at: { poi: 'world', x: p.x, z: p.z, ...(p.y !== undefined ? { y: p.y } : {}), ...(p.dy !== undefined ? { dy: p.dy } : {}) }, sets: [`${TOKEN_FLAG}${i + 1}`],
  }));
  const bank = (side: number, along: number, dist: number) => ({ x: d.x + d.ax * side * dist + d.fx * along, z: d.z + d.az * side * dist + d.fz * along });
  const la = bank(1, -1.2, 4.6), lb = bank(-1, -1.2, 4.6), glass = bank(1, 5.5, 3.9);
  return {
    external: ['talked:ranger'],
    rows: [
      // ── the pond puzzle at the beaver dam ──
      { kind: 'lever', id: 'dam-log-a', label: 'Heave the log off the sluice', latch: true, at: { poi: 'world', x: la.x, z: la.z, yaw: yaw + Math.PI / 2 },
        requires: { all: ['talked:ranger'] }, lockedLabel: 'A log jammed in the beavers\' sluice', toast: 'The log rolls clear — one more on the far bank' },
      { kind: 'lever', id: 'dam-log-b', label: 'Heave the log off the sluice', latch: true, at: { poi: 'world', x: lb.x, z: lb.z, yaw: yaw - Math.PI / 2 },
        requires: { all: ['talked:ranger'] }, lockedLabel: 'A log jammed in the beavers\' sluice', toast: 'The log rolls clear — one more on the far bank' },
      { kind: 'door', id: 'dam-sluice', look: 'sluice', w: 2.2, h: 2.2, latch: true, at: { poi: 'world', x: d.x, z: d.z, yaw },
        opensWhen: { all: ['lever:dam-log-a', 'lever:dam-log-b'] }, toast: 'The sluice lifts. The beaver pool drains through it with a roar' },
      { kind: 'pickup', id: 'pond-glass', look: 'seaglass', label: "the pond lantern's glass", color: '#ffd9a0', at: { poi: 'world', x: glass.x, z: glass.z, dy: 0.12 },
        showWhen: { all: ['open:dam-sluice'] }, toast: "The pond lantern's glass, washed out onto the gravel" },
      // ── the ridge: the fire-watcher's flint on the fire finder ──
      { kind: 'pickup', id: 'ridge-flint', look: 'flint', label: "the fire-watcher's flint", at: { poi: 'world', x: s.finder.x, z: s.finder.z, y: s.finder.y },
        toast: "The fire-watcher's flint and a coil of wick" },
      // ── the secrets: the vista bench on the lookout's catwalk ──
      { kind: 'bench', id: 'lookout-bench', label: 'Sit and watch the far country', at: { poi: 'world', x: s.bench.x, z: s.bench.z, y: s.bench.y, yaw: s.bench.yaw }, sets: ['secret:vista'], toast: '' },
      ...resin,
      ...tokens,
    ],
  };
}

/**
 * Collision groups (project/archive/2026-09-23-physics.md §Architecture): who can touch whom. Rapier packs a collider's groups in one
 * u32 — membership in the high 16 bits, the filter (what it may touch) in the low 16 — and two colliders interact only
 * when each one's membership is in the other's filter, so every row below lists the full set it meets.
 */
export const GROUP = {
  WORLD: 1 << 0,      // terrain, structures, props — static or kinematic
  PLAYER: 1 << 1,     // the player's capsule
  CREATURE: 1 << 2,   // animals and enemies (their movement capsule)
  HITBOX: 1 << 3,     // a creature's head / body hit volumes (queries only)
  PROJECTILE: 1 << 4, // bolts, thrown things in flight
  ITEM: 1 << 5,       // coconuts, the barrel, drops, pickups — dynamic bodies the player can push
  DEBRIS: 1 << 6,     // small short-lived bodies (never touch the player)
  SENSOR: 1 << 7,     // pressure plates, triggers
} as const;
export type GroupName = keyof typeof GROUP;

const ALL = 0xffff;
const MEETS: Record<GroupName, number> = {
  WORLD: ALL,
  PLAYER: GROUP.WORLD | GROUP.CREATURE | GROUP.ITEM | GROUP.SENSOR,
  CREATURE: GROUP.WORLD | GROUP.PLAYER | GROUP.CREATURE | GROUP.ITEM,
  HITBOX: GROUP.WORLD | GROUP.PROJECTILE,
  PROJECTILE: GROUP.WORLD | GROUP.HITBOX,
  ITEM: GROUP.WORLD | GROUP.PLAYER | GROUP.CREATURE | GROUP.ITEM | GROUP.SENSOR,
  DEBRIS: GROUP.WORLD,
  SENSOR: GROUP.PLAYER | GROUP.ITEM,
};

/** The packed `collisionGroups` / `solverGroups` value for a collider of this kind. */
export function groups(kind: GroupName): number {
  return ((GROUP[kind] << 16) | MEETS[kind]) >>> 0;
}

/** A query filter's packed groups: the querier is `as`, and it sees only the kinds in `sees`. */
export function queryGroups(sees: readonly GroupName[], as: GroupName = 'PLAYER'): number {
  const mask = [...new Set(sees)].reduce((m, k) => m + GROUP[k], 0); // distinct single bits: the sum is the union
  return ((GROUP[as] << 16) | mask) >>> 0;
}

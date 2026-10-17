/** The built shrine's pool is local (0, 11), yaw rot + PI; the Captain faces another PI around. */
export const DRIFTWOOD_SPAWNS = { homes: [], bosses: [{ id: 'driftwood.captain', kind: 'captain', look: 'captain',
  at: [-98 + 11 * Math.sin(2.51), 108 + 11 * Math.cos(2.51)] as [number, number], yaw: 2.51 + 2 * Math.PI }] };
// The ecology/practice homes need night, out-of-sight, random-delay and distance gates; those remain trusted runtime rules.

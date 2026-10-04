/** The template's single grey blob and its reusable platform behaviour, consumed by the shardfile loader at SF16. */
export const CREATURES = {
  brains: [{ id: 'blob-pursuit', kind: 'pursue', awareRadius: 12, leashRadius: 25, speed: 1, returnSpeed: 2,
    stopDistance: 1.5, turnRate: 4, thinkDivisor: 3, attackCooldownTicks: 60, wanderRadius: 4, wanderEveryTicks: 420 }],
  spawns: [{ id: 'grey-blob:1', species: 'grey-blob', variant: 'grey', brain: 'blob-pursuit', strike: null, seed: 435, scale: 1, at: [0, 0, -19], yaw: 0 }],
};

/** Signal's admitted native host defaults. Its declared lash item supplies every damaging player contact. */
export const SIGNAL_LEVEL = {
  ground: { size: 500, height: 0 },
  player: { lift: 0.1, speed: 5 },
  probe: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1,
    recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] },
} as const;

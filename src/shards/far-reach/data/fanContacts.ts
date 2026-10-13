/** Shipping fan contacts: SWING, HEAVY and GUST retain their original cone, clocks and event order. */
export const FAN_CONTACTS = [
  { lane: 'primary', heavy: false, cooldown: 0.45, shape: 'cone', reach: 4.4, size: 0.9,
    height: 0, allowance: 0, lands: [], show: 0, reports: true,
    hits: [{ source: 'env', damage: 16, tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], moveId: 'far.fan.light',
      copyVectors: true, copyTags: true, reactions: [] }] },
  { lane: 'primary', heavy: true, cooldown: 0.85, shape: 'cone', reach: 4.4, size: 0.9,
    height: 0, allowance: 0, lands: [], show: 0, reports: true,
    hits: [{ source: 'env', damage: 30, tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], moveId: 'far.fan.heavy',
      copyVectors: true, copyTags: true, reactions: [] }] },
  { lane: 'secondary', heavy: false, cooldown: 1.6, shape: 'cone', reach: 9, size: 0.6,
    height: 0, allowance: 0, lands: [], show: 0, reports: false,
    hits: [{ source: 'env', damage: 4, tags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], moveId: 'far.fan.gust',
      copyVectors: true, copyTags: true,
      reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: 15, lift: 4 }] }] },
] as const;

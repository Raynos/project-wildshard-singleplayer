/** The shipping crack and double crack as ordered shared melee contacts. The native owner supplies the source actor. */
export const WHIP_CONTACT_MOVES = [
  { lane: 'primary', heavy: false, cooldown: 0.45, shape: 'lane', reach: 7, size: 0.9, height: 0.9, allowance: 0.7,
    lands: [0.12], show: 0.42, reports: true,
    hits: [{ source: 'owner', damage: 18, tags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'],
      moveId: 'sunscar.whip.crack', copyVectors: false, copyTags: false, reactions: [] }] },
  { lane: 'primary', heavy: true, cooldown: 0.9, shape: 'lane', reach: 8, size: 0.9, height: 0.9, allowance: 0.7,
    lands: [0.12, 0.32], show: 0.62, reports: true,
    hits: [
      { source: 'owner', damage: 16, tags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'],
        moveId: 'sunscar.whip.double.1', copyVectors: false, copyTags: false,
        reactions: [{ when: 'survived', kind: 'impulse', direction: 'aim-backward', speed: 16, lift: 0, maxHealth: 40 }] },
      { source: 'owner', damage: 16, tags: ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'],
        moveId: 'sunscar.whip.double.2', copyVectors: false, copyTags: false,
        reactions: [{ when: 'survived', kind: 'stagger', strength: 0.8, aboveHealth: 40 }] },
    ] },
] as const;

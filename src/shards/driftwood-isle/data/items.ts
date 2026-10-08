/** Trusted sword families preserve the original contact/combo/view recipes and legacy equipment identities. */
export const DRIFTWOOD_SWORDS = { version: 1,
  rows: [{ name: 'Wooden sword', damage: 12 }, { name: 'Iron sword', damage: 28 }].map((profile, index) => {
    const name = index === 0 ? 'wood' : 'iron', id = `weapon.driftwood-isle.${name}`;
    return { id, kind: 'weapon', family: `driftwood-isle.${name}`, slot: `declared.${id}`, context: 'weapon.melee',
      ui: { name: profile.name, icon: 'sword', swapIcon: '⚔', blurb: '' },
      view: { recipe: `driftwood-isle.${name}`, colour: index === 0 ? '#76512f' : '#a2acb3', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
      light: { id: `driftwood.${name}.light`, damage: profile.damage, cooldown: 0.08, range: 2.2, width: 1, tags: ['actor.player', 'dmg.melee'], effect: null },
      heavy: { id: `driftwood.${name}.heavy`, damage: profile.damage * 2, cooldown: 0.08, range: 2.2, width: 1, tags: ['actor.player', 'dmg.melee'], effect: null },
      charge: 0.45 };
  }),
  contexts: [], loadout: { primary: 'weapon.driftwood-isle.wood', secondary: null, tools: [] },
};

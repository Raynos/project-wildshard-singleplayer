import { DRIFTWOOD_NATIVE_PACK } from './nativeInventory';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../data/meleeProfile';

const equipmentRows = [{"id":"weapon.sword","legacySlot":"sword","ui":{"swapIcon":"<path d=\"M20.5 3.5 9.2 14.8M20.5 3.5l-.6 4.2M20.5 3.5l-4.2.6\"/><path d=\"M6.6 12.2l5.2 5.2M8.4 15.6 4 20\"/>","name":"Wooden sword","icon":"sword","touch":"melee","lockOn":true,"melee":true,"tracers":false},"meta":{"name":"Wooden sword","icon":"sword","blurb":"","category":"weapon"},"cues":{"fire":"cue.sword.swing","reload":"cue.reload","impact":"cue.sword.hit","hit":"cue.sword.hit","heavy":"cue.sword.heavy"},"hitStop":{"body":0.06,"head":0.06,"kill":0.06}},{"id":"weapon.sword-iron","legacySlot":"sword-iron","ui":{"swapIcon":"<path d=\"M20.5 3.5 9.2 14.8M20.5 3.5l-.6 4.2M20.5 3.5l-4.2.6\"/><path d=\"M6.6 12.2l5.2 5.2M8.4 15.6 4 20\"/>","name":"Iron sword","icon":"sword","touch":"melee","lockOn":true,"melee":true,"tracers":false},"meta":{"name":"Iron sword","icon":"sword","blurb":"","category":"weapon"},"cues":{"fire":"cue.sword.swing","reload":"cue.reload","impact":"cue.sword.hit"},"hitStop":{"body":0.06,"head":0.06,"kill":0.06}}];
/** Trusted sword families preserve the original contact/combo/view recipes and legacy equipment identities. */
export const DRIFTWOOD_SWORDS = { version: 1,
  rows: [{ name: 'Wooden sword', damage: 12 }, { name: 'Iron sword', damage: 28 }].map((profile, index) => {
    const name = index === 0 ? 'wood' : 'iron', id = `weapon.driftwood-isle.${name}`;
    return { id, kind: 'weapon', equipment: equipmentRows[index], family: 'melee', slot: `declared.${id}`, context: 'weapon.melee',
      ui: { name: profile.name, icon: 'sword', swapIcon: '⚔', blurb: '' },
      view: { recipe: `driftwood-isle.${name}`, colour: index === 0 ? '#76512f' : '#a2acb3', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
      light: { id: `driftwood.${name}.light`, damage: profile.damage, cooldown: 0.08, range: 2.2, width: 1, tags: ['actor.player', 'dmg.melee'], effect: null },
      heavy: { id: `driftwood.${name}.heavy`, damage: profile.damage * 2, cooldown: 0.08, range: 2.2, width: 1, tags: ['actor.player', 'dmg.melee'], effect: null },
      charge: 0.45, profile: index === 0 ? DRIFTWOOD_MELEE_PROFILE : DRIFTWOOD_IRON_PROFILE };
  }),
  contexts: [], loadout: { inventory: DRIFTWOOD_NATIVE_PACK, primary: 'weapon.driftwood-isle.wood', secondary: null, tools: [] },
};

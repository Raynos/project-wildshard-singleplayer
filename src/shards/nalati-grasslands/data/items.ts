import { AR15, BOW, SABRE, SPEAR } from '../weapons/equipment';

/** Native projectile families keep their trusted flight/throwing contacts; these bounded entries never deal damage. */
const placeholder = (id: string) => ({ id, damage: 0, cooldown: 1, range: 0.01, width: 0.01, tags: [], effect: null });

/** The authored loadout keeps its native slots through the G51 family shim, with declared identity, UI and contexts. */
export const NALATI_ITEMS = { version: 1, rows: [
  { row: BOW, family: 'nalati-grasslands.bow', context: 'weapon.bow' },
  { row: SABRE, family: 'nalati-grasslands.sabre', context: 'weapon.melee' },
  { row: SPEAR, family: 'nalati-grasslands.spear', context: 'weapon.spear' },
  { row: AR15, family: 'nalati-grasslands.rifle', context: 'weapon.ranged' },
].map(({ row, family, context }) => {
  if (typeof row.ui.icon !== 'string') throw new Error('Nalati declares its original item icons');
  return { id: row.id, kind: 'weapon', family, slot: `declared.${row.id}`, context,
    ui: { name: row.ui.name, icon: row.ui.icon, swapIcon: row.ui.swapIcon, blurb: row.meta.blurb },
    view: { recipe: family, colour: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
    light: row.id === SABRE.id ? { id: 'sabre.light', damage: 24, cooldown: 0.08, range: 2.2, width: 0.9, tags: [], effect: null } : placeholder(`${row.id}.light`),
    heavy: row.id === SABRE.id ? { id: 'sabre.heavy', damage: 48, cooldown: 0.08, range: 2.2, width: 0.9, tags: [], effect: null } : placeholder(`${row.id}.heavy`),
    charge: row.id === SABRE.id ? 0.45 : 0.001 };
}), contexts: [], runtimeContexts: ['weapon.melee', 'weapon.bow', 'weapon.spear', 'weapon.ranged'],
loadout: { primary: BOW.id, secondary: SABRE.id, tools: [] } };

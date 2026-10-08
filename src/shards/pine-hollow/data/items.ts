import { CROSSBOW, LEVER, LONGBOW } from '../weapons/equipment';

/** These contacts are bounded placeholders: the trusted native projectile families own flight, damage and reload. */
const contact = (id: string) => ({ id, damage: 0, cooldown: 1, range: 0.01, width: 0.01, tags: [], effect: null });
/** Existing saved equipment ids and the exact authored glyphs; shard-owned families resolve the G51 native recipes. */
export const PINE_ITEMS = { version: 1, rows: [
  { row: CROSSBOW, family: 'pine-hollow.crossbow', context: 'weapon.ranged' },
  { row: LEVER, family: 'pine-hollow.lever', context: 'weapon.ranged' },
  { row: LONGBOW, family: 'pine-hollow.longbow', context: 'weapon.bow' },
].map(({ row, family, context }) => {
  if (typeof row.ui.icon !== 'string') throw new Error('Pine items need their authored icon and swap glyph');
  return { id: row.id, kind: 'weapon', family, slot: `declared.${row.id}`, context,
    ui: { name: row.ui.name, icon: row.ui.icon, swapIcon: row.ui.swapIcon, blurb: row.meta.blurb },
    view: { recipe: family, colour: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
    light: contact(`${row.id}.light`), heavy: contact(`${row.id}.heavy`), charge: 0.001 };
}), contexts: [], runtimeContexts: ['weapon.ranged', 'weapon.bow'],
loadout: { primary: CROSSBOW.id, secondary: LONGBOW.id, tools: [] } };

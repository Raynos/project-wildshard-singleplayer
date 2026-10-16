import { LEVER_WEAPON_PROFILE } from '../data/leverProfile';
import { CROSSBOW_WEAPON_PROFILE } from '../data/crossbowProfile';
import { BOW_PROFILE } from '../data/bowProfile';
import { CROSSBOW, LEVER, LONGBOW } from './equipment';

/** These contacts are bounded placeholders: the trusted native projectile families own flight, damage and reload. */
const contact = (id: string) => ({ id, damage: 0, cooldown: 1, range: 0.01, width: 0.01, tags: [], effect: null });
/** Existing saved equipment ids and the exact authored glyphs; shard-owned families resolve the G51 native recipes. */
export const PINE_ITEMS = { version: 1, rows: [
  { row: CROSSBOW, family: 'firearm', context: 'weapon.ranged' },
  { row: LEVER, family: 'firearm', context: 'weapon.ranged' },
  { row: LONGBOW, family: 'bow', context: 'weapon.bow' },
].map(({ row, family, context }) => {
  if (typeof row.ui.icon !== 'string') throw new Error('Pine items need their authored icon and swap glyph');
  const declared = { id: row.id, kind: 'weapon', family, equipment: row, slot: `declared.${row.id}`, context,
    ui: { name: row.ui.name, icon: row.ui.icon, swapIcon: row.ui.swapIcon, blurb: row.meta.blurb },
    view: { recipe: row.id === LONGBOW.id ? 'pine-hollow.longbow' : row.id === CROSSBOW.id ? 'pine-hollow.crossbow' : row.id === LEVER.id ? 'pine-hollow.lever' : family, colour: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
    ranged: { step: row.id === CROSSBOW.id ? 'pine.crossbow' : row.id === LEVER.id ? 'pine.lever' : 'pine.longbow', slot: row.id === CROSSBOW.id ? 0 : row.id === LEVER.id ? 1 : 2, eye: 1.68, extent: row.id === LONGBOW.id ? 330 : 310, floor: -150, radius: row.id === LONGBOW.id ? 0.02 : 0.03,
      tags: [row.id, 'dmg.ranged', 'cover.checked'], defaultAmmo: 'iron',
      glance: row.id === LONGBOW.id ? { lift: 0.03, keep: 0.35, bounce: 0.25, maxSpeed: 9 } : { lift: 0.02, keep: 0.25, bounce: 0.15, maxSpeed: 6 },
      ammunition: [{ id: 'iron', flight: { gravity: 1, drag: 1 }, wet: { gravity: 0.2, drag: 0.9 }, targets: [], damage: 1 },
        { id: 'pitch', flight: { gravity: 0.8, drag: 0.7 }, targets: [], damage: 1 },
        { id: 'broadhead', flight: { gravity: 1.08, drag: 1.1 }, wet: { gravity: 0.2, drag: 0.9 }, targets: ['deer', 'boar'], damage: 1.4 }],
      ...(row.id === LONGBOW.id ? { shaft: { capacity: 48, length: 0.76, bury: 0.09, reach: { radius: 1.25, up: 2.1, down: 1.2 }, recover: 0.7, recoveryStride: 8 } } : {}) },
    light: contact(`${row.id}.light`), heavy: contact(`${row.id}.heavy`), charge: 0.001 };
  return row.id === CROSSBOW.id ? Object.assign(declared, { profile: CROSSBOW_WEAPON_PROFILE }) : row.id === LONGBOW.id ? Object.assign(declared, { profile: BOW_PROFILE }) : row.id === LEVER.id ? Object.assign(declared, { profile: LEVER_WEAPON_PROFILE }) : declared;
}), contexts: [], runtimeContexts: ['weapon.ranged', 'weapon.bow'],
loadout: { primary: CROSSBOW.id, secondary: LONGBOW.id, tools: [] } };

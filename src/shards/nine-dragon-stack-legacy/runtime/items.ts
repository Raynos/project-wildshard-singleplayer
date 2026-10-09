import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily, ItemFamilyPresentation } from '@wildshard/engine/combat/itemFamilies';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { Tool } from '@wildshard/engine/combat/Tool';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';

/** Keep native feel, cues and metadata while declared identity, names, glyphs and context remain authoritative. */
function presentation(row: EquipmentRow): ItemFamilyPresentation {
  const { name: _name, icon: _icon, inputContext: _context, swapIcon: _swap, ...ui } = row.ui;
  return { ui, ...(row.cues === undefined ? {} : { cues: row.cues }), ...(row.hitStop === undefined ? {} : { hitStop: row.hitStop }),
    ...(row.rangedFeel === undefined ? {} : { rangedFeel: row.rangedFeel }) };
}
/** Adopt the prebuilt Jian and play-stage Fei Zhua, preserving their native construction and installation order. */
export function bindNineItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, primary: Weapon, grapple: Tool): void {
  const sword = primary.row, tool = grapple.row;
  const families = new Map<string, ItemFamily>([
    ['nine-dragon-stack.jian', { kind: 'weapon', presentation: presentation(sword), create: (row) => {
      // G51 compatibility: the native sword controller and current held saves keep the original sword slot.
      primary.row = { ...row, legacySlot: primary.id, meta: sword.meta }; return primary;
    } }],
    ['nine-dragon-stack.fei-zhua', { kind: 'tool', presentation: presentation(tool), create: (row) => {
      grapple.row = { ...row, meta: tool.meta }; return grapple;
    } }],
  ]);
  bindRuntimeItems(ctx, source, { families, icon: (name) => {
    const row = [sword, tool].find((entry) => entry.ui.icon === name);
    if (row === undefined) throw new Error(`Unknown Nine Dragon item icon ${name}`); return row.ui.icon;
  } });
}

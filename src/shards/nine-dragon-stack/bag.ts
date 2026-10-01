/**
 * Nine Dragon Stack's Bag (E314, Jake's pick A, art/loot/round-3-other-shards/board-3-nine-dragon.jpg): MAP · GEAR, the
 * leanest. The fragment is a prototype with no loop — no enemies, no items, no feats — so the Bag names only what is
 * there: the Neon Jian in the hand and the Fei Zhua grapple on the other arm. PACK and FEATS hide themselves (the
 * Inventory keeps nothing here and the shard has 0 achievements: src/engine/ui/Menu.ts); the iron sword is not in the kit. Tabs
 * come back when the shard has something for them to hold. Node-safe data (test/shards/nine-dragon-stack/bag-tabs.test.ts):
 *
 *   new Weapons(jian, null, [], { baseName: NINE_WEAPON_NAME })   // src/main.ts: the kit's one weapon, named
 *   new GameMenu({ …, tools: () => [FEI_ZHUA] })                   // GEAR's card for the grapple (not a weapon: no HOLD)
 */
import type { GearTool } from '#game/bag/bag';

/** the held weapon's name everywhere the kit is named (the Bag's GEAR, the swap ring / hotbar) — not the generic "Sword" */
export const NINE_WEAPON_NAME = 'Neon Jian';

/** the Fei Zhua (grapple/Traversal.ts): LOCK a brass dragon hook, JUMP to fire and zip */
export const FEI_ZHUA: GearTool = { id: 'fei-zhua', name: 'Fei Zhua', kind: 'Grapple', how: 'Lock a hook, then jump', icon: 'grapple' };

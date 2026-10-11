import { registerWeaponFamily } from '@wildshard/game/plugin/weaponFamily';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { bindRuntimeItems } from '@wildshard/game/plugin/headless';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import type { WarFanWeapon } from '../weapons/WarFan';
import source from '../shard.config';

/** Adopt the already-built fan after its custom input definition enters; no second weapon or gust controller. */
export function bindSkyItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, fan: WarFanWeapon): void {
  const native = fan.row;
  const family: ItemFamily = { kind: 'weapon', presentation: { ...(native.cues === undefined ? {} : { cues: native.cues }), ui: { touch: 'melee', lockOn: true, melee: true, tracers: false } },
    create: (row) => { fan.row = { ...row, legacySlot: 'far-fan', meta: native.meta }; return fan; } };
  const families = new Map<string, ItemFamily>();
  registerWeaponFamily(families, 'far-reach.fan', family);
  const bound = bindRuntimeItems(ctx, source, { families, icon: () => 'sword' });
  if (bound.primary !== fan) throw new Error('Sky declares its existing war fan as primary');
}

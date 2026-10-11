import { registerWeaponFamily } from '@wildshard/game/plugin/weaponFamily';
import { bindRuntimeItems } from '@wildshard/game/plugin/headless';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import type { Targets } from '@wildshard/engine/combat/types';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { Bullwhip } from '../weapons/Bullwhip';
import { whipIcon } from '../weapons/rows';
import source from '../shard.config';

/** Register Signal's trusted lash constructor for this equipment build. Its own native rope, inputs and contacts stay local. */
export function bindSignalItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, targets: Targets,
  built: (whip: Bullwhip) => void): Bullwhip {
  const families = new Map<string, ItemFamily>();
  const owner: { whip: Bullwhip | null } = { whip: null };
  registerWeaponFamily(families, 'sunscar-dunes.whip', { kind: 'weapon', create: () => {
    const whip = new Bullwhip(ctx.app, targets); owner.whip = whip; built(whip); return whip;
  } });
  const items = bindRuntimeItems(ctx, source, { icon: whipIcon, families });
  if (owner.whip === null || items.primary !== owner.whip) throw new Error('Signal Dunes declares its native whip as primary');
  return owner.whip;
}

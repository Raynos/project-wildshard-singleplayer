import { bindPlayerEffects, selectEffectGrants } from '@wildshard/engine/combat/effects/EffectService';
import type { ShardContext } from '../plugin/context';
import { installStarterEffects } from '../plugin/ui';
import { installEnteredRuntimeService, installRetainedPlayerEffects, retainsRuntimeServices } from '../shard/retainedHooks';
import { isOwnedId, isCosmetic } from '../loot/Owned';
import type { EffectDef } from '@wildshard/engine/combat/effects/types';

/** The shared permanent cosmetic grant; authored finish identity and weapon determine its exclusive group. */
export const heldFinishEffect = (id: string, weapon: string): EffectDef => ({
  id: `effect.finish.${id}`, kind: 'permanent', stacking: 'none', tags: ['effect.cosmetic'], modifiers: [],
  grants: [`cosmetic.finish.${id}`], group: `finish.${weapon}`,
});

/** Client-only item effect presentation. Rows select native ownership grants and status UI;
 * player/weapon attribute storage and periodic damage remain engine-owned. */
export function installItemEffects(context: ShardContext): void {
  const items = context.product.shardfile.items, row = items.loadout.effects;
  if (row === undefined) return;
  const runtime = context.game.runtime, world = runtime?.world, play = runtime?.play;
  const effects = context.app.effects, health = context.app.player;
  if (world === undefined || world === null || play === undefined || play === null || effects === null || health === null)
    throw new Error('Item effects need native player and equipment services');
  const { player } = world, owned = play.owned, retained = retainsRuntimeServices(context);
  const grants = [...row.player, ...row.worn, ...row.weapons.flatMap(entry => entry.grants)];
  if (grants.some(grant => !isOwnedId(grant.key) || grant.unless?.some(key => !isOwnedId(key)) === true)
    || row.worn.some(grant => !isOwnedId(grant.key) || !isCosmetic(grant.key))) throw new Error('Unknown item effect ownership');
  const targets = row.weapons.map(entry => ({ grants: entry.grants, items: entry.items.map(id => {
    const item = items.rows.find(value => value.id === id);
    if (item?.kind !== 'weapon' || item.equipment?.legacySlot === undefined) throw new Error('Item effect needs a native equipment slot');
    return play.weapons.get(item.equipment.legacySlot);
  }) }));
  if (retained) installRetainedPlayerEffects(context, { movement: player, position: () => player.position });
  else bindPlayerEffects({ effects, target: health, movement: player, combat: context.app.combat, position: () => player.position, scope: context.scope });
  if (row.statuses) installStarterEffects(context, { player, health, effects }, retained ? install => { installEnteredRuntimeService(context, install); } : undefined);
  for (const entry of targets) for (const target of entry.items) effects.bind(target, () => { target.attributes['damage'] = Math.round(target.attributes['damage'] ?? 0); }, context.scope);
  const has = (id: string): boolean => isOwnedId(id) && owned.has(id);
  const worn = (id: string): boolean => isOwnedId(id) && isCosmetic(id) && owned.worn(id);
  const apply = (): void => {
    if (context.scope.disposed) return;
    const keys = grants.flatMap(grant => [grant.key].concat(grant.unless ?? []));
    const ownedKeys = new Set(keys.filter(has)), wornKeys = new Set(keys.filter(worn));
    if (row.player.length > 0 || row.worn.length > 0 || row.hitCap !== undefined)
      effects.sync(health, [...selectEffectGrants(row.player, ownedKeys), ...selectEffectGrants(row.worn, wornKeys),
        ...(row.hitCap !== undefined && Number.isFinite(context.manifest.fight?.maxHitDamage ?? Infinity) ? [{ id: row.hitCap }] : [])]);
    for (const entry of targets) for (const target of entry.items) effects.sync(target, selectEffectGrants(entry.grants, ownedKeys));
  };
  apply(); context.scope.onDispose(owned.onChange(apply));
}

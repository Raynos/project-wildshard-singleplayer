import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import { HeldFinishes } from '../loadout/finishes';
import { heldFinishEffect } from '../loadout/effects';
import { readItemEquipment, readItemAmmunition } from '../plugin/nativeItems';
import { STARTER_EFFECTS } from '../plugin/ui';
import { installQuestCatalogue } from '../quest/chapter';
import { declaredProductCompendium } from '../shard/declaredRows';

/** Kit-only catalogue registration from admitted ids. Preparation stays with
 * the resident resource owner; this feature registers no frame or save owner. */
export function installClientCatalogue(ctx: ShardContext, row: ClientFeatureRow): void {
  if (row.kind !== 'content.catalogue' || ctx.scope.disposed) throw new Error('Invalid content catalogue feature');
  const items = ctx.product.section('combat/items').items;
  const weapons = row.weapons.map(id => readItemEquipment(items, id));
  const ammunition = row.ammunition.flatMap(id => [...readItemAmmunition(ctx.product.shardfile.items, id).values()].map(ammo => ammo.row));
  const finishes = row.finishes || row.effects.includes('finishes') ? HeldFinishes.current(ctx.product.slug) : null;
  const journals = row.compendiums.map(id => Object.assign(declaredProductCompendium(ctx.product, id), { id }));
  const effects = row.effects.flatMap(kind => kind === 'starter' ? STARTER_EFFECTS
    : finishes?.cards.map(({ id }) => heldFinishEffect(id, finishes.get(id).weapon)) ?? []);
  if (row.quests) installQuestCatalogue(ctx);
  for (const journal of journals) ctx.rows.compendium(journal);
  for (const encounter of row.encounters) ctx.rows.encounter(encounter);
  if (weapons.length > 0) ctx.rows.weapon(weapons);
  if (ammunition.length > 0) ctx.rows.ammo(ammunition);
  if (effects.length > 0) ctx.rows.effect(effects);
  if (row.finishes && finishes !== null) ctx.rows.skin(finishes.list());
}

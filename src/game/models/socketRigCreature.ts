/**
 * G571: a boss creature's card from rows (`SocketRigCreatureSchema`): its model card, its species kind (the hull book's
 * derived row, registered by `prepareHullBookKit`), its one coat (the spawn variant: label, weight, rarity, scale, hp,
 * tint, traits) and the product file whose socket rig rows dress it (`format/roamingCombat` projection, read by
 * `SocketRigCard`). The card is the engine's `creature(kind)` read from that coat, dressed by the fight's own socket rig on
 * the live copy and on the specimen alike. `prepareHullBookKit` is the page kit such a product needs before play: the hull
 * book's derived species, the species programs page, the hull looks, the declared spawn tables, the held equipment and
 * each card's socket rows.
 */
import * as v from 'valibot';
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import type { VariantDef } from '@wildshard/engine/entities/species/registry';
import { SpecimenModelMetadataSchema } from '@wildshard/format/specimenCatalogue';
import { SocketRigCard } from '../boss/socketRig';
import { productHullBook } from '../looks/speciesBook';
import { HeldEquipment } from '../plugin/heldEquipment';
import type { ShardContext } from '../plugin/context';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), n = v.pipe(v.number(), v.finite()), rgb = v.tuple([n, n, n]);
const coat = v.strictObject({ id, label: id, weight: n, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), scale: v.tuple([n, n]),
  hp: v.exactOptional(n), tint: v.exactOptional(v.pipe(v.record(id, rgb), v.maxEntries(32))),
  traits: v.exactOptional(v.pipe(v.record(id, v.union([n, v.boolean(), id])), v.maxEntries(32))) });
export const SocketRigCreatureSchema = v.strictObject({
  model: v.pick(SpecimenModelMetadataSchema, ['id', 'file', 'pipeline', 'surface']),
  /** the product whose socket rig rows dress the card, and that rows file */
  product: id, sockets: id,
  kind: id, coat,
});

/** One boss creature card (see the module note). */
export class SocketRigCreature {
  readonly card: SocketRigCard;
  readonly model: ModelDef<CreatureParams>;
  constructor(input: unknown) {
    const rows = v.parse(SocketRigCreatureSchema, input), { surface, ...card } = rows.model;
    const { hp, tint, traits, ...base } = rows.coat;
    const variant: VariantDef = { ...base, ...(hp === undefined ? {} : { hp }), ...(tint === undefined ? {} : { tint }), ...(traits === undefined ? {} : { traits }) };
    const dressing = this.card = new SocketRigCard(rows.product, rows.sockets);
    this.model = defineModel<CreatureParams>({ ...card, ...creature(rows.kind, { species: { label: variant.label, variants: [variant] },
      dress: (animal, ctx) => { dressing.dress(animal, ctx); } }), ...(surface === undefined ? {} : { surface }) });
  }
}

/** The page kit a hull-book product needs before play (see the module note); `cards` preload their socket rows. */
export async function prepareHullBookKit(ctx: ShardContext, cards: readonly SocketRigCreature[]): Promise<void> {
  const book = productHullBook(ctx.product), programs = ctx.product.section('actors/species-programs');
  book.registerDerived(); ctx.rows.species(programs.page);
  ctx.rows.speciesLook(book.looks);
  ctx.rows.spawnTable(declaredSpawnTables(programs.spawns));
  const held = await HeldEquipment.prepare(ctx.product);
  for (const card of cards) await card.card.preload();
  held.install(ctx);
}

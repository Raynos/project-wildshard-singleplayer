import type { ShardContext } from '@wildshard/game/plugin/context';
import { productHullBook } from '@wildshard/game/looks/speciesBook';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { HeldEquipment } from '@wildshard/game/plugin/heldEquipment';
import type { VariantDef } from '@wildshard/engine/entities/species/registry';
import { SocketRigCard } from '@wildshard/game/boss/socketRig';
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import authoredLook from '../../data/antlerKingLook.json' with { type: 'json' };

const { KING_COAT } = authoredLook;

/**
 * The Antler King's species and card (PINE-HOLLOW-REMASTER PH-C2 / PH-M3, E322 F-M1: Jake picked B): his own upright hull
 * (`public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb`) on the shared limb rig, in a bark-dark,
 * moss-shouldered coat. His lanterns, amber ribcage and core are the fight's socket rig rows (generators/roamingProjection.ts
 * over the baked kit, generators/kingKit.ts); the card dresses from the same rows (@wildshard/game/boss/socketRig).
 */

/** the coat (../data/antlerKingLook.json `KING_COAT`): bark-dark hide, moss on the mane and the rump, pale weathered antlers */
const KING_VARIANT: VariantDef = {
  ...KING_COAT, scale: [KING_COAT.scale[0], KING_COAT.scale[1]],
  tint: Object.fromEntries(Object.entries(KING_COAT.tint).map(([k, c]): [string, [number, number, number]] => [k, [c[0], c[1], c[2]]])),
};

/** The King's card dresses from the fight's own socket rig rows (combat/roaming.json): his lanterns and amber ribcage. */
const KING_CARD = new SocketRigCard('pine-hollow', 'combat/roaming.json');

// ─────────────── the model (E306 / E315 M5) ───────────────

/** his species: the hull book's derived row (generators/nativeView.ts `SPECIES_LOOKS.derived`), registered on his own rig */
const KING_KIND = 'antler-king';

/**
 * The Antler King, Pine Hollow's boss: his own hull (Hunyuan3D-2, `public/assets/pine-hollow/creatures/antler-king-rig
 * [.phone].rigged.glb`) on the shared limb rig, drawn ×2.6 by the fight, dressed with his baked kit (`dressAntlerKing`:
 * the antler lanterns, the amber ribcage). The fight (src/shards/pine-hollow/combat/antlerKing.ts) spawns,
 * dresses and drives the one copy at night in the King's clearing; nothing here draws him in the world.
 *
 * His fields are the engine's `creature(KING_KIND)` read from his one coat (`KING_VARIANT`, its `species` rows): his species
 * is the hull book's derived row (the elk's fields on his own rig, with the roaming boss's damage rule), registered before
 * play by `preparePineModelViews`. Its `dress` is
 * the fight's — the lanterns and the ribcage at full glow — on the live copy and on the specimen alike.
 */
export const antlerKing: ModelDef<CreatureParams> = defineModel<CreatureParams>({
  id: 'pine-hollow/antler-king', pipeline: ['hunyuan', 'code'], file: 'src/shards/pine-hollow/models/antlerKing.ts',
  ...creature(KING_KIND, { species: { label: KING_VARIANT.label, variants: [KING_VARIANT] },
    dress: (a, ctx) => { KING_CARD.dress(a, ctx); } }), surface: 'wood',
});

/** Counted native rig/hull catalogue binding, beside its custom model view. */
export async function preparePineModelViews(ctx: ShardContext): Promise<void> {
  const book = productHullBook(ctx.product); book.registerDerived(); ctx.rows.species(ctx.product.section('actors/species-programs').page);
  ctx.rows.speciesLook(book.looks);
  ctx.rows.spawnTable(declaredSpawnTables(ctx.product.section('actors/species-programs').spawns));
  const held = await HeldEquipment.prepare(ctx.product); await KING_CARD.preload(); held.install(ctx);
}

import type { ShardContext } from '@wildshard/game/plugin/context';
import { productHullBook, type HullLookBook } from '@wildshard/game/looks/speciesBook';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { HeldEquipment } from '@wildshard/game/plugin/heldEquipment';
import { registerSpecies, hasSpecies, type AnimalSpecies, type SpeciesDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
import { roamingBossDamage } from '@wildshard/game/boss/roamingProjection';
import { SocketRigCard } from '@wildshard/game/boss/socketRig';
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import authoredLook from '../../data/antlerKingLook.json' with { type: 'json' };
import { limbAnimation } from '@wildshard/game/animation/limbView';
import { pineView } from '../world/context';

const { KING_COAT, KING_OWN_RIG } = authoredLook;

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

// ─────────────── his own rig (E322 F-M1) ───────────────

/** his body: the skeleton (the hull's own joints replace its rest positions) and the hit volumes
 *  (../data/antlerKingLook.json `KING_OWN_RIG`), and no parts (the hull is the mesh) */
function buildOwnRig(): AnimalSpecies {
  const R = KING_OWN_RIG;
  return {
    bones: pineView().QUADRUPED.bones.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })), furParts: [], hardParts: [], eyeParts: [],
    dims: { ...R.dims, feet: R.dims.feet.map((f): [number, number] => [f[0], f[1]]) },
  };
}

/**
 * The King's species on his own rig (E322 F-M1): `base` (the fight's elk-derived King: his coat, sounds,
 * AI hook and damage rule) as a custom rig — KING_BONES and the limb host's poses instead of the elk's bones and gaits. The
 * hull (`antler-king-rig[.phone].rigged.glb`) is his mesh through species/hulls.ts like every Pine Hollow hull.
 */
function kingOwnSpecies(base: SpeciesDef): SpeciesDef {
  // (the elk's postPose / gait knobs are the quadruped path's: a custom rig never runs them)
  return { ...base, rigContract: { skeleton: 'antler-king.v1', clips: [], sockets: ['body', 'head'] }, rig: 'custom', animate: limbAnimation(pineView().QUADRUPED.spec, pineView().QUADRUPED.blend, pineView().QUADRUPED.clips), build: () => buildOwnRig() };
}

// ─────────────── the model (E306 / E315 M5) ───────────────

/** his species (src/shards/pine-hollow/combat/antlerKing.ts `KING_KIND`): registered by the fight at boot on his own rig (`registerKing`) */
const KING_KIND = 'antler-king';

/**
 * The Antler King, Pine Hollow's boss: his own hull (Hunyuan3D-2, `public/assets/pine-hollow/creatures/antler-king-rig
 * [.phone].rigged.glb`) on the shared limb rig, drawn ×2.6 by the fight, dressed with his baked kit (`dressAntlerKing`:
 * the antler lanterns, the amber ribcage). The fight (src/shards/pine-hollow/combat/antlerKing.ts) spawns,
 * dresses and drives the one copy at night in the King's clearing; nothing here draws him in the world.
 *
 * His fields are the engine's `creature(KING_KIND)` read from his one coat (`KING_VARIANT`, its `species` rows): his species
 * is registered by the fight at boot (the elk's fields on his own rig, with the fight's damage hook), and this module can
 * load before that — importing the fight from here would be a cycle (it imports this file for his look). Its `dress` is
 * the fight's — the lanterns and the ribcage at full glow — on the live copy and on the specimen alike.
 */
export const antlerKing: ModelDef<CreatureParams> = defineModel<CreatureParams>({
  id: 'pine-hollow/antler-king', pipeline: ['hunyuan', 'code'], file: 'src/shards/pine-hollow/models/antlerKing.ts',
  ...creature(KING_KIND, { species: { label: KING_VARIANT.label, variants: [KING_VARIANT] },
    dress: (a, ctx) => { KING_CARD.dress(a, ctx); } }), surface: 'wood',
});

/** Counted native rig/hull catalogue binding, beside its custom model view. */
export async function preparePineModelViews(ctx: ShardContext): Promise<void> {
  const book = productHullBook(ctx.product); registerKing(book); ctx.rows.species(ctx.product.section('actors/species-programs').page);
  ctx.rows.speciesLook(book.looks);
  ctx.rows.spawnTable(declaredSpawnTables(ctx.product.section('actors/species-programs').spawns));
  const held = await HeldEquipment.prepare(ctx.product); await KING_CARD.preload(); held.install(ctx);
}

/** the King's species: the elk's fields re-registered as 'antler-king' — its own AI (the fight drives it), no blood (bark) —
 *  on his own upright rig (E322 F-M1, kingOwnSpecies) */
export function registerKing(book: HullLookBook): void {
  if (hasSpecies(KING_KIND)) return;
  const elk: SpeciesDef = book.definition('elk');
  const def: SpeciesDef = {
    ...elk, kind: KING_KIND, label: 'The Antler King', variants: [KING_VARIANT], aggressive: true, blood: false,
    walkSpeed: 2.2, chargeSpeed: 13,
    sounds: { call: 'elk_bugle', hurt: 'bear_hurt', callEvery: [600, 900] },
    eyeGlow: [1.0, 0.55, 0.15], eyeGlowIntensity: 2.5,
    think: () => { /* the fight's update drives him (AntlerKingFight) */ },
    damageMul: (a, p) => roamingBossDamage(a, p),
  };
  registerSpecies(kingOwnSpecies(def));
}

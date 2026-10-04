import { buildSword, swordMaterial } from '../weapons/melee/SweptMelee';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';

const FILE = 'src/kit/models/sword.ts';

/**
 * A low-poly sword's card (the wooden sword, the iron sword): `buildSword`'s `sword` — the blade, guard, grip, pommel and
 * the two fists on the grip, the one mesh the viewmodel swings — on the specimen's own `swordMaterial`. The forearms (the
 * viewmodel's second mesh, the player's sleeves running out of the frame) are the player's, not the sword's: left out.
 */
export function swordParts(ctx: ModelContext, blade: 'wood' | 'iron'): readonly ModelPart[] {
  const { geometry, material } = ctx.once(`gear:${blade}-sword`, () => ({ geometry: buildSword(blade).sword, material: swordMaterial(ctx.sky, blade) }));
  return [{ geometry, material, castShadow: true, receiveShadow: true }];
}

// ───────────────────────────── the shared gear ─────────────────────────────

/** The iron sword: Sword.ts's rig with `blade: 'iron'` — the steel blade, the dark iron guard — as `swordParts` builds it. */
export const ironSword = defineModel<object>({
  id: 'shared/iron-sword', name: 'Iron sword', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => swordParts(ctx, 'iron'),
});

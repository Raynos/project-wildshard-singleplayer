/**
 * G571: a page's declared melee primary from its item row (`items.rows`, a weapon with a `melee` profile) on a starter
 * blade (wood or iron): the combat profile applied over the blade, the item's equipment row, the blade as its parent and
 * the page's portrait field of view in its feel, registered as the page's weapon row; the runtime's equipment builds the
 * Sword on the shard's declared viewmodel (its own arms or rig), with no rifle or secondary. Nine Dragon Stack's jian is
 * the first user.
 */
import * as v from 'valibot';
import { applyMeleeCombatProfile } from '@wildshard/engine/combat/meleeProfile';
import { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import type { ShardContext } from '../plugin/context';
import { ItemCatalogue } from '../plugin/nativeItems';
import { SWORD_IRON, SWORD_WOOD } from '../weapons/starterMeleeProfile';
import { Sword } from '../weapons/Sword';

const DeclaredMeleeSchema = v.strictObject({
  item: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), blade: v.picklist(['wood', 'iron']),
  portraitFov: v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(179)),
});

/** The installed primary: its combat profile (for the page's runtime equipment binding) and the Sword once built. */
export interface DeclaredMelee {
  readonly profile: v.InferOutput<typeof MeleeWeaponProfileSchema>;
  readonly primary: () => InstanceType<typeof Sword>;
}

/** Register the weapon row and the runtime's equipment builder for the declared melee primary. */
export function installDeclaredMelee(ctx: ShardContext, input: unknown): DeclaredMelee {
  const rows = v.parse(DeclaredMeleeSchema, input), items = ctx.product.shardfile.items;
  const item = items.rows.find(row => row.id === rows.item);
  const profile = v.parse(MeleeWeaponProfileSchema, item?.kind === 'weapon' ? item.profile : undefined);
  const blade = rows.blade === 'iron' ? SWORD_IRON : SWORD_WOOD;
  const row = { ...applyMeleeCombatProfile(blade, profile), ...new ItemCatalogue(items).equipment(rows.item),
    parent: SWORD_WOOD.id, feel: { ...blade.feel, portraitFov: rows.portraitFov } };
  ctx.rows.weapon(row);
  const shell = ctx.game.runtime;
  if (shell === undefined) throw new Error('Declared melee requires the game session');
  let built: InstanceType<typeof Sword> | null = null;
  shell.buildEquipment = (targets, nolock, viewmodel) => {
    const world = shell.world;
    if (world === null) throw new Error('Declared melee requires its world');
    const { ironArms: _ironArms, swim: _swim, ...ownSword } = viewmodel ?? {};
    if (ownSword.arms === undefined && ownSword.rig === undefined) throw new Error('Declared melee needs its declared sword rig');
    built = new Sword(world, targets, { row, profile: row, allowUnlocked: nolock, ...ownSword,
      ...(world.game.level.camera === undefined ? {} : { portraitFov: world.game.level.camera.portraitFov }) });
    return Promise.resolve({ primary: built, rifle: null, secondary: null });
  };
  return { profile, primary: () => { if (built === null) throw new Error('Declared melee is not built before play'); return built; } };
}

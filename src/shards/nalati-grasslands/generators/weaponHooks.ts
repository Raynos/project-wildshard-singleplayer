import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';
import { parseWeaponHooks, type WeaponHooksData } from '@wildshard/format/weaponHooks';
import { SABRE_HOOK } from '../data/sabreHook';

/** Compile the retained one-page native policy and admit its immutable author declaration before any output is written. */
export async function generateNalatiWeaponHooks(source: string): Promise<{ bytes: Uint8Array; module: string; declaration: WeaponHooksData }> {
  const compiled = await compileBehaviourModule(source, 1);
  const declaration = parseWeaponHooks({ id: SABRE_HOOK.id, entity: SABRE_HOOK.entity, module: compiled.module,
    parameters: SABRE_HOOK.parameters, weapons: SABRE_HOOK.weapons });
  return { ...compiled, declaration };
}

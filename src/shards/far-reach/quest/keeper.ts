import type { MeshStandardMaterial } from 'three';
import { pivotNpc, type PivotNpc } from '@wildshard/game/plugin/geometry';
import { hdMaterial, skyHd } from '../world/meshes';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { KEEPER_SCARF_EDITS } from '../data/paintLook';
import { SPAWN } from '../data/layout';
import { KEEPER_AT } from '../data/quests';
import { KEEPER_ROW } from '../data/keeperLook';

/**
 * His book stand and lantern (E399, mockup B): a step behind him and to his right as the spawn sees him, outside the
 * views down the bridge's axis, its book turned to the spawn.
 */
const STAND_X = KEEPER_AT.x + 0.5, STAND_Z = KEEPER_AT.z - 1.2;
export const KEEPER_STAND = { x: STAND_X, z: STAND_Z, yaw: Math.atan2(SPAWN.x - STAND_X, SPAWN.z - STAND_Z) } as const;

/** His painted material, its scarf and sash a warm rust-brown (council: 'the keeper's red scarf reads louder than the mockup's brown one'). */
function scarfed(material: MeshStandardMaterial): MeshStandardMaterial {
  patchShader(material, 'far.keeper-scarf', PATCH_ORDER.decorate, (shader) => { editShader(shader, KEEPER_SCARF_EDITS); }, { key: (prior) => `${prior}|far.keeper-scarf` });
  return material;
}

/**
 * The bridge-keeper (mockup B: an old sky-sailor in a slate-blue coat and hat, a rust-brown scarf, a long white beard, a
 * satchel, a gnarled staff) on the deck at `y`: the shared pivot NPC host's figure and motion from his row
 * (data/keeperLook.ts) in his painted material. Not loaded: no figure, his talk anchor still stands.
 */
export function keeper(y: number): PivotNpc {
  const made = skyHd('keeper-hd');
  return pivotNpc(KEEPER_ROW, made?.geometry ?? null, () => y, made === null ? undefined : scarfed(hdMaterial(made.map)));
}

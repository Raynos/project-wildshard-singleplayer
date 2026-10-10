import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { SimHost } from '@wildshard/engine/sim';
import { installLashHost, type LashCommand, type LashHost, type LashTargetRow } from '@wildshard/game/systems/items/lashHost';
import { WHIP_MOVES, WHIP_TIMING } from '../data/items';

/** The declared whip row's id (data/items.ts) and its fixed-step adapter id. */
export const WHIP_ID = 'weapon.sunscar-whip';
/** The whip's fixed-step id (its lash and aim continuation). */
export const WHIP_STEP = `item.${WHIP_ID}`;
/** The browser player's eye above the feet (engine Player EYE): the lash leaves from the eye toward the crosshair. */
const EYE = 1.68;

/**
 * Signal's bullwhip in the renderer-free host (SF72): the platform's lash host (`@wildshard/game/systems/items/lashHost`)
 * on the declared row with the browser Bullwhip's timing and moves (the lash lands 0.12 s after the swing, the heavy's
 * second lash at 0.32 s staggers a big creature, its first yanks a small one); the crack rows' spots (the well's crank,
 * the waymark bowls) are its world targets, as the browser's levers and braziers answer.
 */
export function installSignalWhip(host: SimHost, row: ItemSpec, commands: () => readonly LashCommand[], targets: readonly LashTargetRow[]): LashHost {
  if (row.kind !== 'weapon' || row.id !== WHIP_ID) throw new Error('Signal declares its whip as a weapon row');
  return installLashHost(host, { step: WHIP_STEP, row, timing: WHIP_TIMING, moves: WHIP_MOVES, eye: EYE, commands, targets });
}

import type { MoverData } from '@wildshard/sdk/movers';
import { MOVERS } from '../data/movers';
import source from '../shard.config';

/** SF49-g (G183): the Rising Islets' rows and their road gates (the platform carries their riders; the plugin draws them). */
export const isIsletMover = (id: string): boolean => id.startsWith('far.islet.');
/**
 * SF8c socketLift: the bridges stay this recipe's rows; the islets and their gates are the shardfile's compiled `movers`
 * (shard.config.ts), the exact rows `wildshard validate` proves, installed once on this one host (no second body or host).
 * View-free (SF72): the browser plugin (runtime/movers.ts) and the headless runtime (runtime/headlessMovers.ts) read it.
 */
export const SKY_MOVERS: MoverData = [...MOVERS.filter((row) => !isIsletMover(row.id)), ...source.movers];
/** The winch bridge's row: raised only by the winch once the roost is quiet and the vanes turn. */
export const WINCH_BRIDGE = 'far.winch.bridge';

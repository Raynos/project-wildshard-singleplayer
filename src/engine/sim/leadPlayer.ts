import type { SimCommand } from '../sim';
import type { PlayerSim } from './playerSim';

/**
 * The player a system not yet per-player serves: the host's first. Weapons, quests, riding and hand-offs bind it; a room's
 * other players share its world, creatures and physics but have none of those (P1-E5.2a). The uses are a ratchet.
 */
export function leadPlayer<P = PlayerSim>(host: { readonly players: ReadonlyMap<string, P> }): P {
  const first = host.players.values().next();
  if (first.done === true) throw new Error('Simulation host has no player');
  return first.value;
}
/** One tick's commands for a host driven as one player. */
export function leadCommands(host: { readonly players: ReadonlyMap<string, { readonly id: string }> }, command: SimCommand | undefined): ReadonlyMap<string, SimCommand> | undefined {
  return command === undefined ? undefined : new Map([[leadPlayer(host).id, command]]);
}

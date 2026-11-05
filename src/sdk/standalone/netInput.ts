import type { NetCommand } from '@wildshard/format/netCommand';
import type { NetTickAct } from '@wildshard/engine/net/acts';
import { lockValue, type ActRoutes } from '@wildshard/engine/sim/actRoutes';
import { NET_BUTTONS } from '@wildshard/engine/input/netButtons';
import { netSimCommand } from '@wildshard/engine/sim/netMotion';
import type { HeadlessCommand } from '../tickProtocol';

const has = (command: NetCommand, button: number): boolean => (command.buttons & button) !== 0;
/** Admission allows a hair past straight up; the tick's grammar does not, and an input may not end the server. */
const lookPitch = (command: NetCommand): number => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, command.pitch));

/**
 * P1-E5.2: the lead player's command as an ordinary tick command, so the tick admits it with the same `TickCommandSchema`
 * every other source uses and the weapon systems bound to the lead read its swing, heavy hold and launcher. SimHost takes a
 * NetCommand directly for every other player.
 */
export function netPlayerCommand(command: NetCommand): Extract<HeadlessCommand, { kind: 'player' }> {
  const { attack, heavyTarget } = command, heavy = has(command, NET_BUTTONS.heavy);
  return { kind: 'player', ...netSimCommand(command), seq: command.seq, pitch: lookPitch(command), sprint: has(command, NET_BUTTONS.sprint), crouch: has(command, NET_BUTTONS.crouch),
    ...(heavy ? { heavy: heavyTarget === undefined ? {} : { targetId: heavyTarget } } : {}),
    // P1-E3.2: a swing that names nothing still swings; the server finds what it strikes (J41).
    ...((attack !== undefined && attack.targetId === undefined) || (heavy && heavyTarget === undefined) ? { swing: true as const } : {}) };
}

/**
 * A player's `interact` acts as the script commands the interaction rows read, naming who acted. They go in the tick's first
 * list, the one the rows watch, whoever sent them. The rows judge reach and state, so a retried act changes nothing; an id
 * no row answers to is dropped, since an input may not end the server.
 */
export function netInteractCommands(routes: ActRoutes, acts: readonly NetTickAct[], player: string): HeadlessCommand[] {
  return acts.flatMap(act => {
    const route = act.kind === 'interact' ? routes.interactions.get(act.id) : undefined;
    return route === undefined ? [] : [{ kind: 'script' as const, ...route, playerId: player }];
  });
}

/** A player's riding: a `ride` act goes to the taming law as it stands, and the lean and look follow its command. */
export function netRide(routes: ActRoutes, player: string, command: NetCommand | undefined, acts: readonly NetTickAct[]): void {
  for (const act of acts) if (act.kind === 'ride') routes.ride?.(player, act.action);
  if (command !== undefined) routes.lean?.(player, command.steer.keyX, lookPitch(command));
}

/** Every tick command one player's input becomes: the player command, then its launcher and acts. `interact` is netInteractCommands'. */
export function netTickCommands(command: NetCommand | null, acts: readonly NetTickAct[], routes?: ActRoutes): HeadlessCommand[] {
  const out: HeadlessCommand[] = [];
  if (command !== null) {
    out.push(netPlayerCommand(command));
    if (has(command, NET_BUTTONS.lock) && routes?.lock !== null && routes?.lock !== undefined) out.push({ kind: 'script', actorId: routes.lock, value: lockValue(command.hookTarget) });
    const { launcher } = command;
    if (launcher !== undefined) out.push({ kind: 'launcher', slot: launcher.slot, ads: launcher.ads, pitch: lookPitch(command), ...(launcher.fire === undefined ? {} : { fire: launcher.fire }) });
  }
  for (const act of acts) {
    if (act.kind === 'reload') out.push({ kind: 'launcher', slot: act.slot, ads: 0, pitch: command === null ? 0 : lookPitch(command), reload: true });
    else if (act.kind === 'equip' && routes?.equip !== null && routes?.equip !== undefined) out.push({ kind: 'script', actorId: routes.equip, value: act.slot });
  }
  return out;
}

import type { NetAct, NetCommand } from '@wildshard/format/netCommand';
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

/** Every tick command one player's input becomes: the player command, then its launcher and acts. */
export function netTickCommands(command: NetCommand | null, acts: readonly NetAct[]): HeadlessCommand[] {
  const out: HeadlessCommand[] = [];
  if (command !== null) {
    out.push(netPlayerCommand(command));
    const { launcher } = command;
    if (launcher !== undefined) out.push({ kind: 'launcher', slot: launcher.slot, ads: launcher.ads, pitch: lookPitch(command), ...(launcher.fire === undefined ? {} : { fire: launcher.fire }) });
  }
  // `interact` waits for its data-only owner: today's trusted resident refuses it, and an input may not end the server.
  for (const act of acts) if (act.kind === 'reload') out.push({ kind: 'launcher', slot: act.slot, ads: 0, pitch: command === null ? 0 : lookPitch(command), reload: true });
  return out;
}

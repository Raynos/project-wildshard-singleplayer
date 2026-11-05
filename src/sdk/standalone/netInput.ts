import type { NetAct, NetCommand } from '@wildshard/format/netCommand';
import { NET_BUTTONS } from '@wildshard/engine/net/command';
import { localWalkingMove } from '@wildshard/engine/player/walk';
import type { HeadlessCommand } from '../tickProtocol';

const has = (command: NetCommand, button: number): boolean => (command.buttons & button) !== 0;

/**
 * P1-E5.2: today's one-player SimHost through a NetCommand adapter (§8), until E5.2a has it take commands directly. The
 * result is an ordinary player command, so the tick admits it with the same `TickCommandSchema` every other source uses.
 */
export function netPlayerCommand(command: NetCommand): Extract<HeadlessCommand, { kind: 'player' }> {
  const move = { x: 0, z: 0 }, { steer, attack, heavyTarget } = command;
  localWalkingMove(steer, command.yaw, move);
  return { kind: 'player', moveX: move.x, moveZ: move.z, yaw: command.yaw, commandVersion: 1, steer: { ...steer },
    sprint: has(command, NET_BUTTONS.sprint), crouch: has(command, NET_BUTTONS.crouch),
    dive: has(command, NET_BUTTONS.dive), surface: has(command, NET_BUTTONS.surface),
    ...(attack?.targetId === undefined ? {} : { attack: { targetId: attack.targetId } }),
    ...(has(command, NET_BUTTONS.hover) ? { hover: true as const } : {}), ...(has(command, NET_BUTTONS.jump) ? { jump: true as const } : {}),
    ...(has(command, NET_BUTTONS.dodge) ? { dodge: true as const } : {}),
    ...(has(command, NET_BUTTONS.heavy) ? { heavy: heavyTarget === undefined ? {} : { targetId: heavyTarget } } : {}),
    // P1-E3.2: a swing that names nothing still swings; the server finds what it strikes (J41).
    ...((attack !== undefined && attack.targetId === undefined) || (has(command, NET_BUTTONS.heavy) && heavyTarget === undefined) ? { swing: true as const } : {}) };
}

/** Every tick command one player's input becomes: the player command, then its launcher and acts. */
export function netTickCommands(command: NetCommand | null, acts: readonly NetAct[]): HeadlessCommand[] {
  const out: HeadlessCommand[] = [];
  if (command !== null) {
    out.push(netPlayerCommand(command));
    const { launcher } = command;
    if (launcher !== undefined) out.push({ kind: 'launcher', slot: launcher.slot, ads: launcher.ads, pitch: command.pitch, ...(launcher.fire === undefined ? {} : { fire: launcher.fire }) });
  }
  // `interact` waits for its data-only owner: today's trusted resident refuses it, and an input may not end the server.
  for (const act of acts) if (act.kind === 'reload') out.push({ kind: 'launcher', slot: act.slot, ads: 0, pitch: command?.pitch ?? 0, reload: true });
  return out;
}

import * as v from 'valibot';
import { NetCommandSchema, type NetCommand } from '@wildshard/format/netCommand';
import { NET_PRESSES, seqAfter } from '../../shared/net/command';

/** Past this the queue is trimmed, which stops a speed-hack by flooding (Unreal's MaxMoveDeltaTime idea, §4.2). */
export const MAX_QUEUED_COMMANDS = 4;

/** A starved tick repeats the holds and drops the presses, as SimHost.advance refuses presses on repeat. */
function holdsOf(command: NetCommand): NetCommand {
  const { attack: _attack, launcher, ...rest } = command;
  return { ...rest, buttons: command.buttons & ~NET_PRESSES, ...(launcher === undefined ? {} : { launcher: { slot: launcher.slot, ads: launcher.ads } }) };
}

/** P1-E5.2 (§4.2): one player's server-side input. Every command is admitted, applied once and consumed one per tick. */
export class CommandQueue {
  private readonly queue: NetCommand[] = [];
  private newest: number | null = null;
  private held: NetCommand | null = null;
  /** The `seq` this player's state reflects, sent back in the owner block. */
  lastSeq = 0;
  /** Commands refused by admission, and copies dropped as duplicates. */
  refused = 0; duplicates = 0;
  /** Queue a decoded bundle, oldest first. A replayed `seq` is dropped, so redundancy cannot repeat a jump. */
  admit(commands: readonly NetCommand[]): void {
    for (const raw of commands) {
      const parsed = v.safeParse(NetCommandSchema, raw);
      if (!parsed.success) { this.refused++; continue; }
      const command = parsed.output;
      if (this.newest !== null && !seqAfter(command.seq, this.newest)) { this.duplicates++; continue; }
      this.newest = command.seq; this.queue.push(command);
    }
    if (this.queue.length > MAX_QUEUED_COMMANDS) this.queue.splice(0, this.queue.length - MAX_QUEUED_COMMANDS);
  }
  /** This tick's command: the oldest queued, else the last holds, else none. */
  next(): NetCommand | null {
    const command = this.queue.shift();
    if (command === undefined) return this.held;
    this.lastSeq = command.seq; this.held = holdsOf(command);
    return command;
  }
}

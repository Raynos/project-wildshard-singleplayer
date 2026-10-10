import { prepareDirectorModule, type DirectorLane } from '@wildshard/game/shardfile/directorRuntime';
import { director } from '@wildshard/sdk/director';
import declaration from '../data/director.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };

/** Finale decisions emitted by the immutable author module; combat and the reward view remain native recipes. */
export type DriftwoodFinaleEvent = 'captain.restore' | 'captain.wake' | 'captain.dead' | 'reward.start' | 'reward.finish';
/** Trusted observations are read at the existing flag-delivery and post-player phases. */
export interface DriftwoodFinalePorts {
  readonly observe: () => Readonly<Record<string, number>>;
  readonly publish: (event: DriftwoodFinaleEvent) => void;
}

/** The same immutable admitted bytes for page and worker; embedding avoids a second runtime download. */
export function driftwoodDirectorBytes(): Uint8Array {
  if (module.module !== declaration.module) throw new Error('Driftwood finale module is stale');
  return Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0);
}

/** Admit the page's exact immutable module; every host owns independent author memory and quota history. */
export async function prepareDriftwoodDirector(): Promise<() => DirectorLane> {
  const create = await prepareDirectorModule(director(declaration), driftwoodDirectorBytes());
  return () => create(357);
}

const INVALID_PAYLOAD = new Error('Invalid Driftwood finale event payload'), UNKNOWN_EVENT = new Error('Unknown Driftwood finale event');

/** One director driven by the native owner's existing clock, with same-tick flag requests and silent exact restore. */
export class DriftwoodScriptFinale {
  private readonly lane: DirectorLane;
  private readonly ports: DriftwoodFinalePorts;
  constructor(lane: DirectorLane, ports: DriftwoodFinalePorts, restoring = false) {
    this.lane = lane; this.ports = ports;
    if (!restoring && lane.tick < 0) this.deliver(lane.step(0, ports.observe(), 0));
  }
  /** An altar/death edge is delivered without advancing the post-player reward clock. */
  changed(): void { this.deliver(this.lane.dispatch(this.ports.observe())); }
  /** Called once at the shipping reward phase, after the player's body and ride update. */
  update(dt: number): void { this.deliver(this.lane.step(this.lane.tick + 1, this.ports.observe(), dt)); }
  /** Complete continuation, including admitted module memory, queued inputs and host quota/failure state. */
  snapshot(): string { return this.lane.snapshot(); }
  /** Restore publishes no event and performs no decision or random draw. */
  restore(saved: string): void { this.lane.restore(saved); }
  private deliver(events: ReturnType<DirectorLane['step']>): void {
    for (let index = 0; index < 32; index++) {
      const event = events[index]; if (event === undefined) break;
      if (event.value !== 0) throw INVALID_PAYLOAD;
      const key = event.key;
      if (key !== 'captain.restore' && key !== 'captain.wake' && key !== 'captain.dead' && key !== 'reward.start' && key !== 'reward.finish') throw UNKNOWN_EVENT;
      this.ports.publish(key);
    }
  }
}

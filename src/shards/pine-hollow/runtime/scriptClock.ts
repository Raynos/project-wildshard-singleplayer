import { prepareDirectorModule, type DirectorLane } from '@wildshard/game/shardfile/directorRuntime';
import { director } from '@wildshard/sdk/director';
import declaration from '../data/director.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };
import type { PineClockEvent, PineClockPorts } from './questClock';

/** Admit the same immutable director as the page; each installed native host gets independent author memory. */
export async function preparePineDirector(): Promise<() => DirectorLane> {
  if (module.module !== declaration.module) throw new Error('Pine director bake is stale');
  const create = await prepareDirectorModule(director(declaration), Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0));
  return () => create(357);
}

const INVALID_EVENT = new Error('Unknown Pine director event'), INVALID_PAYLOAD = new Error('Invalid Pine director payload');
const MAX_EVENTS = 32;
function clockEvent(key: string): PineClockEvent {
  if (key === 'night.consume' || key === 'night.start' || key === 'dawn.start' || key === 'dawn.sunrise' || key === 'dawn.lanterns' || key === 'dawn.caption' || key === 'dawn.finish') return key;
  throw INVALID_EVENT;
}

/** One bounded script clock, driven at the quest's existing phase; immediate requests consume zero elapsed time. */
export class PineScriptClock {
  private readonly lane: DirectorLane;
  private readonly ports: PineClockPorts;
  private readonly live: () => boolean;
  private readonly readNight: () => number;
  private readonly observation = { 'night-request': 0, 'dawn-request': 0, seen: 0, 'has-clock': 0, night: 0 };
  constructor(lane: DirectorLane, ports: PineClockPorts, live: () => boolean = () => true) {
    this.lane = lane; this.ports = ports; this.live = live; this.readNight = ports.night;
    if (lane.tick < 0) this.deliver(lane.step(0, this.readClock()));
  }
  night(): void { this.request('night.request'); }
  dawn(): void { this.request('dawn.request'); }
  tick(dt: number): void {
    if (this.live()) this.deliver(this.lane.step(this.lane.tick + 1, this.readClock(), dt));
  }
  /** Full script continuation includes fuel, failure history, pending inputs and Wasm memory, rather than a scalar shadow clock. */
  save(): string { return this.lane.snapshot(); }
  /** Silent same-engine restoration; callbacks and rewards are not replayed. */
  load(saved: string): void { this.lane.restore(saved); }
  private request(key: 'night.request' | 'dawn.request'): void {
    if (!this.live()) return;
    this.lane.enqueue(key); this.deliver(this.lane.dispatch(this.readClock()));
  }
  private readClock(): Readonly<Record<string, number>> {
    this.observation.seen = Number(this.ports.seen()); this.observation['has-clock'] = Number(this.ports.hasClock()); this.observation.night = this.readNight();
    return this.observation;
  }
  private deliver(events: ReturnType<DirectorLane['step']>): void {
    for (let i = 0; i < MAX_EVENTS; i++) {
      const event = events[i]; if (event === undefined) break;
      if (!this.live()) return;
      const key = clockEvent(event.key), expected = key === 'night.start' ? 6 : key === 'dawn.sunrise' ? 7 : 0;
      if (event.value !== expected) throw INVALID_PAYLOAD;
      this.ports.publish(key, event.value);
    }
  }
}

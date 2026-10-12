// Frozen accepted signal edge before native action binding.
import { DirectorStageLane } from '@wildshard/game/plugin/director';
import rows from '../../../src/shards/sunscar-dunes/data/signalStages.json' with { type: 'json' };

/** The original signal owner supplies the live flag and boss admission, never a fabricated actor. */
export interface SignalDirectorPorts {
  readonly lit: () => boolean;
  readonly summon: () => void;
}
/** The tower's accepted light edge enters its authored stage synchronously after flags and fire dressing. */
export class SignalDirector {
  private readonly lane = new DirectorStageLane(rows);
  private readonly ports: SignalDirectorPorts;
  private readonly observation = { lit: false };
  private readonly invalidAction = new Error('Invalid Signal fire director action');
  constructor(ports: SignalDirectorPorts) {
    this.ports = ports;
    this.lane.step(0, this.observation);
    // A loaded light is already owned by the native boss/save path. Restore its author position without summoning.
    if (ports.lit()) this.lane.step(1, { lit: true });
  }
  /** Run at the actual accepted light edge; denied prompts, unlit bowls and quiet restore never summon. */
  light(): void {
    this.observation.lit = this.ports.lit();
    const actions = this.lane.step(this.lane.tick + 1, this.observation);
    for (let i = 0; i < 1; i++) {
      const action = actions[i];
      if (action === undefined) break;
      if (!('spawn' in action) || action.spawn !== 'sunscar.matriarch') throw this.invalidAction;
      this.ports.summon();
    }
  }
  /** Complete author contract and cursor, with no transient native owner references. */
  snapshot(): string { return this.lane.snapshot(); }
  /** Restore quietly; the boss and interactions keep their own native continuations. */
  restore(value: string): void { this.lane.restore(value); }
}

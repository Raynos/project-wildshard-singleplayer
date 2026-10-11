import { DirectorStageLane } from '@wildshard/game/plugin/director';
import rows from '../data/elitePreludeStages.json' with { type: 'json' };

/** Native actor ports retain the original clock, motor, tells and admitted fight owner. */
export interface PineElitePreludePorts {
  readonly alive: () => boolean;
  readonly clock: () => void;
  readonly clear: () => void;
  readonly home: () => void;
  readonly fight: () => void;
  readonly idle: () => void;
}

/** Pine's authored prelude selects absent, leash, fight or idle at the existing owner phase. */
export class PineElitePrelude {
  private readonly lane = new DirectorStageLane(rows);
  private readonly ports: PineElitePreludePorts;
  private readonly observation = { alive: false, engaged: false, leashing: false };
  private readonly invalidAction = new Error('Invalid Pine elite prelude action');
  private readonly unknownAction = new Error('Unknown Pine elite prelude action');
  constructor(ports: PineElitePreludePorts) {
    this.ports = ports;
    if (this.lane.data.stages.some(stage => stage.do.length > 3)) throw new Error('Pine elite prelude action bound');
    this.lane.step(0, { alive: false, engaged: false, leashing: false });
  }
  /** Select one ordered action set; dead actors only clear tells, while a live clock precedes body effects. */
  advance(engaged: boolean, leashing: boolean): void {
    this.observation.alive = this.ports.alive(); this.observation.engaged = engaged; this.observation.leashing = leashing;
    const actions = this.lane.step(this.lane.tick + 1, this.observation);
    // Each immutable authored action set contains at most clock + clear + home.
    for (let i = 0; i < 3; i++) {
      const action = actions[i];
      if (action === undefined) break;
      if (!('emit' in action) || action.value !== 0) throw this.invalidAction;
      switch (action.emit) {
        case 'pine.elite.clock': this.ports.clock(); break;
        case 'pine.elite.clear': this.ports.clear(); break;
        case 'pine.elite.home': this.ports.home(); break;
        case 'pine.elite.fight': this.ports.fight(); break;
        case 'pine.elite.idle': this.ports.idle(); break;
        default: throw this.unknownAction;
      }
    }
  }
  /** Save the exact author contract and cursor, without native effects. */
  snapshot(): string { return this.lane.snapshot(); }
  /** Restore quietly; refuse foreign rows and malformed cursors. */
  restore(saved: string): void { this.lane.restore(saved); }
  /** Validate a saved cursor without mutating this owner or invoking a native port. */
  validate(saved: string): void { new DirectorStageLane(rows).restore(saved); }
}

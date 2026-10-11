import { DirectorScriptStageLane, prepareDirectorModule, type DirectorLane } from '@wildshard/game/plugin/director';
import { parseDirector } from '@wildshard/format/director';
import declaration from '../data/director.json' with { type: 'json' };
import rows from '../data/raidStages.json' with { type: 'json' };
import module from '../behaviour/director.generated.json' with { type: 'json' };
import type { RaidClockPorts } from '../creatures/raidClock';

/** Admit the retained raid author once; each page or native host gets independent AS memory and stage cursor. */
export function prepareNalatiRaidDirector(): Promise<(seed: number) => DirectorLane> {
  if (module.module !== declaration.module) throw new Error('Nalati raid author is stale');
  return prepareDirectorModule(parseDirector(declaration), Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0));
}

/** The raid's original frame owner advances rows; native ports retain actual spawn admission and RNG authority. */
export class NalatiRaidDirector {
  private readonly stages: DirectorScriptStageLane;
  private readonly raid: RaidClockPorts;
  private phase = -1;
  private started = false;
  constructor(lane: DirectorLane, raid: RaidClockPorts) {
    this.raid = raid;
    this.stages = new DirectorScriptStageLane(rows, lane, {
      observe: () => ({ phase: this.phase, raiding: Number(raid.raiding), present: Number(raid.present),
        tracking: Number(raid.tracking), broken: Number(raid.broken), 'prey-alive': Number(raid.preyAlive),
        cracked: Number(raid.cracked), delay: raid.raidT, pending: raid.pendingT, started: Number(this.started) }),
      publish: (action, source) => {
        if (!('emit' in action) || source === undefined || action.emit !== source.key || action.value !== 0) throw new Error('Invalid Nalati raid stage action');
        this.publish(source.key, source.value);
      },
    });
  }
  private publish(key: string, value: number): void {
    const raid = this.raid;
    switch (key) {
      case 'raid.clock': raid.raidT = value; break;
      case 'raid.pending': raid.pendingT = value; break;
      case 'raid.try':
        this.started = raid.start(); this.phase = 1;
        try { this.stages.changed(); } finally { this.phase = 0; this.started = false; }
        break;
      case 'raid.abandon': raid.raiding = false; break;
      case 'raid.finish':
        if (!Number.isInteger(value) || value < 0 || value > 2) throw new Error('Invalid Nalati raid outcome');
        raid.raiding = false; raid.raidT = raid.next();
        if (value === 1) raid.taken(); else if (value === 2) raid.drivenOff();
        break;
      default: throw new Error('Unknown Nalati raid event');
    }
  }
  /** Wildlife precedes this clock and native shepherd motion follows it, at the same shipping owner phase. */
  advance(dt: number): void { this.phase = 0; this.stages.update(dt); }
  /** Persist the complete version-three AS/stage contract and cursor, never a second scheduler. */
  snapshot(): string { return this.stages.snapshot(); }
  /** Restore quietly; a pre-row, foreign or malformed continuation refuses before mutating either owner. */
  restore(text: string): void { this.stages.restore(text); }
}

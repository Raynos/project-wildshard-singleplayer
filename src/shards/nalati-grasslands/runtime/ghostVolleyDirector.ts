import { DirectorScriptStageLane, prepareDirectorModule, type DirectorLane } from '@wildshard/game/plugin/director';
import { parseDirector } from '@wildshard/format/director';
import declaration from '../data/ghostVolleyDirector.json' with { type: 'json' };
import rows from '../data/ghostVolleyStages.json' with { type: 'json' };
import module from '../behaviour/ghostVolley.generated.json' with { type: 'json' };

const invalidObservation = new Error('Invalid ghost volley observation');

/** Native per-rider clock storage; body, ballistic and AI authority stay with their real owners. */
export interface GhostVolleyClock {
  fireT: number;
  readonly quiet: boolean;
}
/** Prepare immutable authored bytes once; each roster receives an independent AS/stage continuation. */
export function prepareGhostVolleyDirector(): Promise<(seed: number) => DirectorLane> {
  if (module.module !== declaration.module) throw new Error('Nalati ghost volley author is stale');
  return prepareDirectorModule(parseDirector(declaration), Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0));
}
/** One roster advances visible living riders in shipping reverse order, at their existing firing phase. */
export class GhostVolleyDirector<M extends GhostVolleyClock> {
  private readonly stages: DirectorScriptStageLane;
  private phase = -1;
  private member: M | null = null;
  private distance = 0;
  private engaged = false;
  private roll = 0;
  private readonly shoot: (member: M) => void;
  private readonly random: () => number;
  constructor(lane: DirectorLane, random: () => number, shoot: (member: M) => void) {
    this.random = random; this.shoot = shoot;
    this.stages = new DirectorScriptStageLane(rows, lane, {
      // Project only eligibility into the bounded ABI. Native timers remain exact even after hours out of range.
      observe: () => ({ phase: this.phase, remaining: Math.min(10000, Math.max(-1, this.member?.fireT ?? 0)),
        quiet: Number(this.member?.quiet ?? true), distance: Math.min(10000, this.distance),
        engaged: Number(this.engaged), roll: this.roll }),
      publish: (action, source) => {
        if (!('emit' in action) || source === undefined || action.emit !== source.key || action.value !== 0 || this.member === null) throw new Error('Invalid ghost volley action');
        if (source.key === 'ghost.clock') this.member.fireT += source.value;
        else if (source.key === 'ghost.retry') this.member.fireT = source.value;
        else if (source.key === 'ghost.shoot') {
          this.shoot(this.member); this.roll = this.random(); this.phase = 1;
          try { this.stages.changed(); } finally { this.phase = 0; this.roll = 0; }
        } else throw new Error('Unknown ghost volley action');
      },
    });
  }
  /** Call after death/fade/hidden guards, preserving native shoot-then-retry RNG order. */
  advance(member: M, dt: number, distance: number, engaged: boolean): void {
    if (!Number.isFinite(member.fireT) || !Number.isFinite(distance) || distance < 0 || this.member !== null) throw invalidObservation;
    this.member = member; this.distance = distance; this.engaged = engaged; this.phase = 0;
    try { this.stages.update(dt); } finally { this.member = null; this.phase = -1; }
  }
  /** The full version-three AS and stage cursor travels with the roster's native clocks. */
  snapshot(): string { return this.stages.snapshot(); }
  /** Quiet atomic admission; old or foreign contracts refuse through the common stage host. */
  restore(text: string): void { this.stages.restore(text); }
}

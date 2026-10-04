import type { RoadGrid } from './roadRecovery';
import { gridReloadDeck, type GridReloadExit, type GridReloadHandoff } from './reloadHandoff';

/** A fixed-step observation of the admitted active frame and the actual deck contact. */
export interface RoadReloadObservation {
  readonly instance: string | null;
  readonly inside: string | null;
  readonly feet: { readonly x: number; readonly y: number; readonly z: number };
  readonly grounded: boolean;
  readonly ready: boolean;
}
/** Capture only after the durable source has retired and the traveller has reached the asphalt. */
export interface RoadReloadPorts {
  readonly grid: RoadGrid;
  readonly capture: (source: string) => GridReloadHandoff | Promise<GridReloadHandoff>;
  readonly transaction: (source: string) => GridReloadExit;
  readonly report: (error: unknown) => void;
}
/** Only an actual admitted cell visit arms a reload. Strip transfer, proxy visits and a road resume do not. */
export class RoadReload {
  private source: string | null = null;
  private active: GridReloadExit | null = null;
  private retryTicks = 0;
  private readonly ports: RoadReloadPorts;
  constructor(ports: RoadReloadPorts) { this.ports = ports; }
  /** Once per existing fixed step; no timer counts as grounded time. */
  step(observation: RoadReloadObservation): void {
    if (this.active !== null) {
      if (this.active.state() === 'failed' && ++this.retryTicks >= 60) { this.retryTicks = 0; this.start(); }
      return;
    }
    const { inside, instance, feet } = observation;
    if (inside !== null) { this.source = inside === instance ? inside : null; return; }
    if (this.source === null || instance !== null || !observation.grounded || !observation.ready
      || Math.abs(feet.y) > 0.6 || !gridReloadDeck(this.ports.grid, feet.x, feet.z)) return;
    this.active = this.ports.transaction(this.source); this.start();
  }
  private start(): void {
    const source = this.source, active = this.active;
    if (source === null || active === null) return;
    try {
      const value = this.ports.capture(source);
      void active.start(value instanceof Promise ? () => value : value).then((success) => {
        if (!success && active.state() === 'failed') this.ports.report(new Error(active.issue() ?? 'Planned grid reload refused'));
        return success;
      }).catch(this.ports.report);
    }
    catch (error) { this.ports.report(error); }
  }
  /** G119 panel state; source-local failures retain the same held transaction for retry. */
  state(): 'saving' | 'failed' | null {
    const phase = this.active?.state();
    return phase === 'failed' ? 'failed' : phase === 'saving' || phase === 'navigating' ? 'saving' : null;
  }
  /** Dispose cancels late fade completion. A storage refusal still prevents navigation. */
  dispose(): void { this.active?.cancel(); this.source = null; }
}

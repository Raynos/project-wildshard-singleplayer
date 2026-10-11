import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { CreatureBrain } from './CreatureBrain';
import type { StrikeSpec } from './strikes';
import { DiverBrain, type PhasedDiverSpec, type PhasedDiverPorts, type PhasedDiverState } from './diver';

/** Legacy tuning name for the shared diver's phased flight/grounded pattern. */
export type PhasedFlyerSpec = PhasedDiverSpec;
/** Existing trusted flight, reach and contact authority. */
export type PhasedFlyerPorts<A extends AnimalSim> = PhasedDiverPorts<A>;
/** Existing inspected HFSM phases, retained by the compatibility constructor. */
export type PhasedFlyerState = PhasedDiverState;
const STATES: readonly PhasedFlyerState[] = ['circle', 'dive', 'climb', 'grounded'];

/** Existing class/HFSM identity and save contract, selecting the shared diver's phased pattern. */
export class PhasedFlyerBrain<A extends AnimalSim> extends CreatureBrain<PhasedFlyerState, A, PhasedFlyerPorts<A>> {
  private readonly policy: DiverBrain<A>;
  constructor(actor: A, spec: PhasedFlyerSpec, strikes: { readonly dive: readonly StrikeSpec[]; readonly grounded: readonly StrikeSpec[] }) {
    super(actor, STATES);
    this.policy = new DiverBrain(actor, { pattern: 'phased', spec, ...strikes,
      state: { read: () => this.state, transition: state => { this.transition(state); } } });
  }
  /** Preserve the original complete policy continuation. */
  snapshot(): SimValue { return this.policy.snapshot(); }
  /** Restore after every clock, actor and strike has validated; no perception or body command runs. */
  restore(saved: SimValue): void { this.policy.restore(saved); }
  /** Keep the authored memory-mark and attack-token decision laws. */
  override think(ctx: PhasedFlyerPorts<A>): void { this.policy.think({ ...ctx, pattern: 'phased' }); }
  /** Keep flight/grounded strike order and the original host-owned body recipes. */
  override act(ctx: PhasedFlyerPorts<A>): void { this.policy.act({ ...ctx, pattern: 'phased' }); }
}

import type { AnimalPoseSample } from '../entities/AnimalSim';
import type { SimHost } from '../sim';
import type { AnimalNetView } from './animalNet';
import { ANIMAL_CLASS, PLAYER_CLASS } from './netSchemas';
import type { NetRefs } from './schema';
import type { NetVisitor, NetWorld } from './room';

const emptyPose = (): AnimalPoseSample => ({ attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0, stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 0 });

/** P1-E5.2: today's one-player SimHost as a NetWorld. Reads only; the sim classes do not change. */
export class SimNetWorld implements NetWorld {
  readonly player: NetWorld['player'];
  private readonly host: SimHost;
  private readonly pose: AnimalPoseSample = emptyPose();
  constructor(host: SimHost) {
    this.host = host;
    this.player = { id: host.player.id, cls: PLAYER_CLASS, sample: (out: Uint32Array, refs: NetRefs) => { PLAYER_CLASS.owner.forEach((column, index) => { out[index] = column.sample(host, refs); }); } };
  }
  tick(): number { return this.host.state.tick; }
  cell(): number { return 0; }
  visit(visitor: NetVisitor): void {
    const { host, pose } = this, targets = new Map(host.attackTargets());
    visitor.entity(host.player.id, PLAYER_CLASS, host);
    for (const [id, sim] of host.entities) {
      sim.samplePose(pose);
      const view: AnimalNetView = { sim, pose, target: targets.get(id) ?? null };
      visitor.entity(id, ANIMAL_CLASS, view);
    }
  }
}

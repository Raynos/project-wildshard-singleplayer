import type { AnimalPoseSample } from '../entities/AnimalSim';
import type { SimHost } from '../sim';
import { leadPlayer } from '../sim/leadPlayer';
import type { AnimalNetView } from './animalNet';
import { CombatWire, type CombatEvent } from './combatWire';
import { encounterRows } from '../sim/encounterRows';
import { ANIMAL_CLASS, ENCOUNTER_CLASS, PLAYER_CLASS } from './netSchemas';
import type { NetRefs } from './schema';
import type { NetPlayer, NetVisitor, NetWorld } from './room';

const emptyPose = (): AnimalPoseSample => ({ attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0, stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 0 });

/** P1-E5.2: a SimHost as a NetWorld. Reads only; the sim classes do not change. */
export class SimNetWorld implements NetWorld {
  readonly player: NetPlayer;
  private readonly host: SimHost;
  private readonly pose: AnimalPoseSample = emptyPose();
  private readonly wire: CombatWire;
  constructor(host: SimHost) {
    this.host = host; this.wire = new CombatWire(host);
    this.player = this.playerOf(leadPlayer(host).id);
  }
  /** A player, as the client that owns it reads it. */
  playerOf(id: string): NetPlayer {
    const player = this.host.players.get(id);
    if (player === undefined) throw new RangeError(`Unknown net player ${id}`);
    return { id, cls: PLAYER_CLASS, sample: (out: Uint32Array, refs: NetRefs) => { PLAYER_CLASS.owner.forEach((column, index) => { out[index] = column.sample(player, refs); }); } };
  }
  tick(): number { return this.host.state.tick; }
  cell(): number { return 0; }
  combat(): readonly CombatEvent[] { return this.wire.drain(); }
  visit(visitor: NetVisitor): void {
    const { host, pose } = this, targets = new Map(host.attackTargets());
    for (const player of host.players.values()) visitor.entity(player.id, PLAYER_CLASS, player);
    for (const [id, sim] of host.entities) {
      sim.samplePose(pose);
      const view: AnimalNetView = { sim, pose, target: targets.get(id) ?? null };
      visitor.entity(id, ANIMAL_CLASS, view);
    }
    for (const [id, read] of encounterRows(host)) visitor.entity(id, ENCOUNTER_CLASS, read());
  }
}

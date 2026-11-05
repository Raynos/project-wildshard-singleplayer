import type { AnimalPoseSample } from '../entities/AnimalSim';
import type { SimHost } from '../sim';
import { leadPlayer } from '../sim/leadPlayer';
import type { AnimalNetView } from './animalNet';
import { CombatWire, type CombatEvent } from './combatWire';
import type { LedgerFiling } from './ledgerBook';
import { questBooks, type QuestProgressRead } from '../quest/players';
import { encounterRows } from '../sim/encounterRows';
import { ANIMAL_CLASS, ENCOUNTER_CLASS, FLAG_CLASS, PLAYER_CLASS, SCRIPT_CLASS, STATE_CLASS } from './netSchemas';
import { shardRows } from '../sim/shardRows';
import { FLAG_PREFIX, STATE_PREFIX } from './shardNet';
import type { NetRefs } from './schema';
import type { NetPlayer, NetVisitor, NetWorld } from './room';

const emptyPose = (): AnimalPoseSample => ({ attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0, stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 0 });

/** P1-E5.2: a SimHost as a NetWorld. Reads only; the sim classes do not change. */
export class SimNetWorld implements NetWorld {
  readonly player: NetPlayer;
  private readonly host: SimHost;
  private readonly pose: AnimalPoseSample = emptyPose();
  private readonly wire: CombatWire;
  private readonly frame: number;
  private readonly filings: (() => readonly LedgerFiling[]) | undefined;
  /** `frame` names the cell this host's positions are local to; 0 is the highway, and any world that is not on a grid. `filings` reads the tick's grants, which the host's owner holds: the sim keeps none. */
  constructor(host: SimHost, frame = 0, filings?: () => readonly LedgerFiling[]) {
    this.host = host; this.frame = frame; this.filings = filings; this.wire = new CombatWire(host);
    this.player = this.playerOf(leadPlayer(host).id);
  }
  /** A player, as the client that owns it reads it. */
  playerOf(id: string): NetPlayer {
    const player = this.host.players.get(id);
    if (player === undefined) throw new RangeError(`Unknown net player ${id}`);
    return { id, cls: PLAYER_CLASS, sample: (out: Uint32Array, refs: NetRefs) => { PLAYER_CLASS.owner.forEach((column, index) => { out[index] = column.sample(player, refs); }); } };
  }
  tick(): number { return this.host.state.tick; }
  cell(): number { return this.frame; }
  combat(): readonly CombatEvent[] { return this.wire.drain(); }
  ledger(): readonly LedgerFiling[] { return this.filings?.() ?? []; }
  quests(player: string, since: number): QuestProgressRead | null { return questBooks(this.host).progressOf(player, since); }
  visit(visitor: NetVisitor): void {
    const { host, pose } = this, targets = new Map(host.attackTargets());
    for (const player of host.players.values()) if (!host.parked.has(player.id)) visitor.entity(player.id, PLAYER_CLASS, player);
    for (const [id, sim] of host.entities) {
      sim.samplePose(pose);
      const view: AnimalNetView = { sim, pose, target: targets.get(id) ?? null };
      visitor.entity(id, ANIMAL_CLASS, view);
    }
    for (const [id, read] of encounterRows(host)) visitor.entity(id, ENCOUNTER_CLASS, read());
    const { bodies, state } = shardRows(host);
    for (const [id, read] of bodies) visitor.entity(id, SCRIPT_CLASS, read());
    if (state !== null) for (const row of state()) visitor.entity(`${STATE_PREFIX}${row.name}`, STATE_CLASS, row);
    // only the world's: a flag a quest row wrote is its player's alone (J106), and reaches that client as a phase event
    const books = questBooks(host);
    for (const flag of host.flags.all) if (!books.personal(flag)) visitor.entity(`${FLAG_PREFIX}${flag}`, FLAG_CLASS, flag);
  }
}

import type { NetCommand } from '@wildshard/format/netCommand';
import type { AnimalPoseSample } from '../../shared/entities/AnimalSim';
import type { SimHost } from '../sim';
import { actRoutes } from '../../shared/sim/actRoutes';
import { leadPlayer } from '../../shared/sim/leadPlayer';
import type { AnimalNetView } from '../../shared/net/animalNet';
import { CombatWire, type CombatEvent } from './combatWire';
import { keepHitHistory } from './hitHistory';
import type { LedgerFiling } from './ledgerBook';
import { questBooks, type QuestProgressRead } from '../../shared/quest/players';
import { encounterRows } from '../../shared/sim/encounterRows';
import { ANIMAL_CLASS, ENCOUNTER_CLASS, FLAG_CLASS, PLAYER_CLASS, SCRIPT_CLASS, STATE_CLASS } from '../../shared/net/netSchemas';
import { shardRows } from '../../shared/sim/shardRows';
import { FLAG_PREFIX, STATE_PREFIX } from '../../shared/net/shardNet';
import type { NetRefs } from '../../shared/net/schema';
import type { NetPlayer, NetTickInput, NetVisitor, NetWorld } from './room';

const emptyPose = (): AnimalPoseSample => ({ attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0, stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 0 });

/** P1-E5.2: a SimHost as a NetWorld. Reads only; the sim classes do not change. */
export class SimNetWorld implements NetWorld {
  readonly player: NetPlayer;
  private readonly host: SimHost;
  private readonly pose: AnimalPoseSample = emptyPose();
  private readonly wire: CombatWire;
  private readonly frame: number;
  private readonly filings: (() => readonly LedgerFiling[]) | undefined;
  private readonly turn = { still: new Set<string>(), extra: new Map<string, NetCommand>() };
  /** `frame` names the cell this host's positions are local to; 0 is the highway, and any world that is not on a grid. `filings` reads the tick's grants, which the host's owner holds: the sim keeps none. */
  constructor(host: SimHost, frame = 0, filings?: () => readonly LedgerFiling[]) {
    this.host = host; this.frame = frame; this.filings = filings; this.wire = new CombatWire(host); keepHitHistory(host);
    this.player = this.playerOf(leadPlayer(host).id);
  }
  /** A player, as the client that owns it reads it. */
  playerOf(id: string): NetPlayer {
    const player = this.host.players.get(id);
    if (player === undefined) throw new RangeError(`Unknown net player ${id}`);
    return { id, cls: PLAYER_CLASS, sample: (out: Float64Array, refs: NetRefs) => { PLAYER_CLASS.owner.forEach((column, index) => { out[index] = column.sample(player, refs); }); },
      ride: out => player.rideWords(out) };
  }
  riders(): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    for (const player of this.host.players.values()) { const mount = player.ridden; if (mount !== null) out.set(player.id, mount); }
    return out;
  }
  commanded(inputs: readonly NetTickInput[]): void {
    const { turn, host } = this;
    turn.still.clear(); turn.extra.clear();
    for (const { player, still, extra } of inputs) {
      if (still) turn.still.add(player);
      if (extra !== null) turn.extra.set(player, extra);
    }
    host.commanded = turn;
  }
  refused(): number { const routes = actRoutes(this.host), { refused } = routes; routes.refused = 0; return refused; }
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
    const { bodies, state, world } = shardRows(host);
    for (const [id, read] of bodies) visitor.entity(id, SCRIPT_CLASS, read());
    if (state !== null) for (const row of state()) visitor.entity(`${STATE_PREFIX}${row.name}`, STATE_CLASS, row);
    for (const read of world.values()) for (const row of read()) visitor.entity(`${STATE_PREFIX}${row.name}`, STATE_CLASS, row);
    // only the world's: a flag a quest row wrote is its player's alone (J106), and reaches that client as a phase event
    const books = questBooks(host);
    for (const flag of host.flags.all) if (!books.personal(flag)) visitor.entity(`${FLAG_PREFIX}${flag}`, FLAG_CLASS, flag);
  }
}

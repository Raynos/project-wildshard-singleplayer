import type * as v from 'valibot';
import { Vector3 } from 'three';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { strikeFromData, type StrikeData } from '@wildshard/engine/ai/strikeRows';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { ChallengeGrazerBrain } from '@wildshard/engine/ai/challengeGrazer';
import { PatrolDiverBrain } from '@wildshard/engine/ai/patrolDiver';
import { PhasedFlyerBrain } from '@wildshard/engine/ai/phasedFlyer';
import { canReach } from '@wildshard/engine/ai/reach';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { parseChallengeGrazer, type ChallengeGrazerSchema, type ShardChallengeGrazer } from './grazers';
import { parsePatrolDiver, type PatrolDiverSchema, type ShardPatrolDiver } from './flyers';
import { parsePhasedFlyer, type PhasedFlyerSchema, type ShardPhasedFlyer } from './phasedFlyers';
import { parseScriptSpecies, ScriptSpeciesPolicy, SpeciesScriptLane, type ScriptSpeciesData, type ScriptSpeciesSchema } from './speciesScripts';
import { installHomeKeeper, type KeptBossBody, type KeptBossRow, type KeptHome, type KeptHomeRow } from './homeKeeper';

/**
 * A species row's declared brain (SHARD-PLATFORM SF27): a platform archetype and its data, resolved the same way by the
 * browser client (`SpeciesBrains.bind`) and the headless host (`installSpeciesHomes`). A challenge grazer's circling
 * phase is the actor seed's slot in `[0, phaseSlots)` (`seedSlot`), so a pack spreads round its home. A `phased-flyer` is
 * a boss flyer its encounter drives through memory fields (circle, dive, climb; grounded from a phase).
 */
export type SpeciesBrain =
  | { readonly archetype: 'challenge-grazer'; readonly data: v.InferInput<typeof ChallengeGrazerSchema>; readonly phaseSlots: number }
  | { readonly archetype: 'patrol-diver'; readonly data: v.InferInput<typeof PatrolDiverSchema> }
  | { readonly archetype: 'phased-flyer'; readonly data: v.InferInput<typeof PhasedFlyerSchema> }
  | { readonly archetype: 'script'; readonly data: v.InferInput<typeof ScriptSpeciesSchema> };
/** A species' gameplay data with an optional declared brain; a row without one keeps its runtime's own policy. */
export type BrainedSpecies = Omit<SpeciesRow, 'parent' | 'think' | 'act'> & { readonly brain?: SpeciesBrain };

/** One policy's continuation-bearing surface: decisions, movement, and its exact snapshot / restore. */
export interface SpeciesPolicy<P> { think: (ports: P) => void; act: (ports: P) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }

/**
 * What one home body's policy observes in the headless host, allocated once at its spawn and refreshed each call: the
 * union of every archetype's ports (and a runtime's own policies'), the host's player, attack tokens, reach and contact.
 */
export interface HomeObservation {
  dt: number; t: number; player: Vector3; calm: boolean; phaseOffset: number;
  reach: (actor: AnimalSim) => boolean; claim: (actor: AnimalSim) => boolean; hurt: (damage: number) => void;
  steer: (actor: AnimalSim, yaw: number, speed: number, turn: number) => void;
  flight: { steer: (actor: AnimalSim, yaw: number, speed: number, altitude: number, turn: number) => void };
}

type Admitted =
  | { readonly archetype: 'challenge-grazer'; readonly data: ShardChallengeGrazer; readonly phaseSlots: number; readonly charge: StrikeSpec; readonly close: StrikeSpec }
  | { readonly archetype: 'patrol-diver'; readonly data: ShardPatrolDiver; readonly strike: StrikeSpec }
  | { readonly archetype: 'phased-flyer'; readonly data: ShardPhasedFlyer; readonly dive: readonly StrikeSpec[]; readonly grounded: readonly StrikeSpec[] }
  | { readonly archetype: 'script'; readonly data: ScriptSpeciesData; readonly lane: SpeciesScriptLane; readonly catalogue: readonly StrikeSpec[] };

/** A stable small integer per actor (its seed hashed) in `[0, n)`: the slot a pack member takes round a ring. */
export function seedSlot(seed: number, n: number): number { return Math.floor(Math.abs(Math.sin(seed * 12.9898 + 1.7) * 43758.5)) % n; }

/** The admitted brains of a species catalogue, by kind: the browser rows, the live witness and the headless policies. */
export interface SpeciesBrains {
  /** The kinds that run a declared brain. */
  readonly kinds: ReadonlySet<string>;
  /**
   * The browser callbacks of a declared kind: `think` / `act` bound to one policy per animal, spread onto its species
   * row (`{ ...ROW, ...brains.bind(kind) }`). Each call binds a fresh policy table; a kind without a brain refuses.
   */
  bind: (kind: string) => Required<Pick<SpeciesRow, 'think' | 'act'>>;
  /** The archetype a live browser animal runs (null when it runs none of these rows' brains). */
  witness: (actor: Animal) => string | null;
  /** A fresh headless policy for one body of a declared kind, or null when the kind declares no brain. */
  policy: (kind: string, actor: AnimalSim) => SpeciesPolicy<HomeObservation> | null;
  /** The headless phase offset of one body (its challenge grazer's seed slot, else 0). */
  phase: (kind: string, actor: AnimalSim) => number;
}

function strikeOf(strikes: ReadonlyMap<string, StrikeSpec>, id: string, kind: string): StrikeSpec {
  const strike = strikes.get(id); if (strike === undefined) throw new Error(`Species ${kind}'s brain names an undeclared strike ${id}`); return strike;
}
function admit(brain: SpeciesBrain, kind: string, strikes: ReadonlyMap<string, StrikeSpec>, modules: ReadonlyMap<string, Uint8Array>): Admitted {
  switch (brain.archetype) {
    case 'challenge-grazer': {
      const data = parseChallengeGrazer(brain.data);
      if (!Number.isInteger(brain.phaseSlots) || brain.phaseSlots < 1 || brain.phaseSlots > 64) throw new Error(`Species ${kind}'s phase slots must be an integer in 1..64`);
      return { archetype: brain.archetype, data, phaseSlots: brain.phaseSlots, charge: strikeOf(strikes, data.charge, kind), close: strikeOf(strikes, data.close, kind) };
    }
    case 'patrol-diver': { const data = parsePatrolDiver(brain.data); return { archetype: brain.archetype, data, strike: strikeOf(strikes, data.strike, kind) }; }
    case 'phased-flyer': {
      const data = parsePhasedFlyer(brain.data);
      return { archetype: brain.archetype, data, dive: data.dive.map(id => strikeOf(strikes, id, kind)), grounded: data.grounded.map(id => strikeOf(strikes, id, kind)) };
    }
    case 'script': {
      const data = parseScriptSpecies(brain.data), bytes = modules.get(data.module);
      if (bytes === undefined) throw new Error(`Species ${kind}'s brain module ${data.module} was not supplied`);
      return { archetype: brain.archetype, data, lane: new SpeciesScriptLane(data, bytes), catalogue: data.strikes.map(row => strikeOf(strikes, row.strike, kind)) };
    }
    default: throw new Error(`Species ${kind} declares an unknown brain archetype`);
  }
}
type Callbacks = Required<Pick<SpeciesRow, 'think' | 'act'>>;
/** Browser callbacks bound to one policy per animal (built at its first decision); `live` answers the witness. */
function browserCallbacks(brain: Admitted): { callbacks: Callbacks; live: (actor: Animal) => boolean } {
  switch (brain.archetype) {
    case 'challenge-grazer': {
      const live = new WeakMap<Animal, ChallengeGrazerBrain<Animal>>(), slots = brain.phaseSlots;
      const of = (a: Animal): ChallengeGrazerBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new ChallengeGrazerBrain(a, brain.data, brain.charge, brain.close); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: {
        think: (a, c) => { of(a).think({ ...c, phaseOffset: seedSlot(a.seed, slots) }); }, act: (a, c) => { of(a).act({ ...c, phaseOffset: seedSlot(a.seed, slots) }); } } };
    }
    case 'patrol-diver': {
      const live = new WeakMap<Animal, PatrolDiverBrain<Animal>>();
      const of = (a: Animal): PatrolDiverBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new PatrolDiverBrain(a, brain.data, brain.data.home, brain.strike); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    case 'phased-flyer': {
      const live = new WeakMap<Animal, PhasedFlyerBrain<Animal>>();
      const of = (a: Animal): PhasedFlyerBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new PhasedFlyerBrain(a, brain.data, brain); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    case 'script': {
      const live = new WeakMap<Animal, ScriptSpeciesPolicy<Animal>>();
      const of = (a: Animal): ScriptSpeciesPolicy<Animal> => { let value = live.get(a); if (value === undefined) { value = new ScriptSpeciesPolicy(a, brain.lane, brain.catalogue); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    default: throw new Error('Unknown admitted brain archetype');
  }
}

/**
 * Admit a species catalogue's declared brains (SF27) against its strike rows: every brain's data passes its archetype's
 * strict schema and every strike it names resolves, before any row, policy or actor exists; a script brain's module
 * (`modules`, by hash) is checked against its hash and admitted on its own ScriptHost. Duplicate kinds refuse.
 */
export function admitSpeciesBrains(species: readonly BrainedSpecies[], strikeRows: readonly StrikeData[], modules: ReadonlyMap<string, Uint8Array> = new Map()): SpeciesBrains {
  const strikes = new Map(strikeRows.map(row => [row.id, strikeFromData(row)] as const));
  if (strikes.size !== strikeRows.length || new Set(species.map(row => row.kind)).size !== species.length) throw new Error('Duplicate species kind or strike id');
  const admitted = new Map(species.flatMap(row => row.brain === undefined ? [] : [[row.kind, admit(row.brain, row.kind, strikes, modules)] as const]));
  const witnesses: { archetype: string; live: (actor: Animal) => boolean }[] = [];
  return {
    kinds: new Set(admitted.keys()),
    bind: kind => {
      const brain = admitted.get(kind);
      if (brain === undefined) throw new Error(`Species ${kind} declares no brain`);
      const bound = browserCallbacks(brain); witnesses.push({ archetype: brain.archetype, live: bound.live }); return bound.callbacks;
    },
    witness: actor => witnesses.find(entry => entry.live(actor))?.archetype ?? null,
    policy: (kind, actor) => {
      const brain = admitted.get(kind);
      if (brain === undefined) return null;
      switch (brain.archetype) {
        case 'challenge-grazer': return new ChallengeGrazerBrain(actor, brain.data, brain.charge, brain.close);
        case 'patrol-diver': return new PatrolDiverBrain(actor, brain.data, brain.data.home, brain.strike);
        case 'phased-flyer': return new PhasedFlyerBrain(actor, brain.data, brain);
        case 'script': return new ScriptSpeciesPolicy(actor, brain.lane, brain.catalogue);
        default: throw new Error('Unknown admitted brain archetype');
      }
    },
    phase: (kind, actor) => { const brain = admitted.get(kind); return brain?.archetype === 'challenge-grazer' ? seedSlot(actor.seed, brain.phaseSlots) : 0; },
  };
}

/** The melee shards' strike arc: a self-thinking species hurts only inside 70° of its facing (AnimalManager HURT_ARC). */
const HURT_ARC = (70 * Math.PI) / 180;

/** A declared catalogue's homes on the platform's renderer-free keeper, each body's policy its species' brain or the runtime's own. */
export interface SpeciesHomesSpec {
  /** The keeper's fixed-step id (`installHomeKeeper`). */
  readonly step: string;
  /** The level seed (the creature stream is `Rng(seed + 31)`). */
  readonly seed: number;
  readonly homes: readonly KeptHomeRow[];
  readonly boss?: KeptBossRow;
  /** Each kind's baked native spec. */
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** The catalogue's rows (each kind's scale range is its first variant's). */
  readonly species: readonly BrainedSpecies[];
  /** The catalogue's admitted brains (`admitSpeciesBrains` over the same rows). */
  readonly brains: SpeciesBrains;
  /** `fight.attackers` from the manifest. */
  readonly attackers: number;
  /** The decision band (the browser's 'legacy' band: every 6 ticks, 0.1 s). */
  readonly think: { readonly every: number; readonly dt: number };
  /** The contact's move id per kind (the browser's PlayerHurt.creature move). */
  readonly contactMove: (kind: string) => string;
  /** The runtime's own policy for a kind that declares no brain (a unique boss, a not-yet-declared creature). */
  readonly custom: (kind: string, actor: AnimalSim) => SpeciesPolicy<HomeObservation>;
  /** Runs first on every tick (a gate the homes read). */
  readonly beforeStep?: (homes: readonly KeptHome[]) => void;
}

/**
 * Declared homes whose policies come from their species rows (SF27): the keeper's stream, tokens, respawn clocks and
 * exact restore (`installHomeKeeper`), each body observing through one reused `HomeObservation`. Contacts reach the
 * player through the host's combat pipeline only inside the strike arc and with a clear line, filed as the browser's
 * PlayerHurt.creature files them: tagged `creature.<kind>`, `feel.blow` (the host's knockback) and `cover.checked` (the
 * reach test is the line check), the blow's point at the creature.
 */
export function installSpeciesHomes(host: SimHost, spec: SpeciesHomesSpec, saved?: Readonly<SimSnapshot>): { settle: () => void; homes: () => readonly KeptHome[]; boss: KeptBossBody | null } {
  const scales = new Map(spec.species.map(row => {
    const variant = row.variants[0]; if (variant === undefined) throw new Error(`Species ${row.kind} has no variant`);
    return [row.kind, variant.scale] as const;
  }));
  const player = host.player.position, reach = (a: AnimalSim): boolean => canReach(a, player, host.physics);
  return installHomeKeeper(host, { step: spec.step, seed: spec.seed, homes: spec.homes, ...(spec.boss === undefined ? {} : { boss: spec.boss }),
    specs: spec.specs, scales, attackers: spec.attackers, think: spec.think, ...(spec.beforeStep === undefined ? {} : { beforeStep: spec.beforeStep }),
    policy: (kind, actor, claim) => {
      const point = new Vector3(), dir = new Vector3(), from = new Vector3(), tags: readonly `${string}.${string}`[] = [`creature.${kind}`, 'feel.blow', 'cover.checked'], move = spec.contactMove(kind);
      const hurt = (damage: number): void => {
        let rel = Math.atan2(player.x - actor.position.x, player.z - actor.position.z) - actor.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) > HURT_ARC || !reach(actor)) return;
        point.copy(actor.position); dir.subVectors(player, actor.position).normalize(); from.copy(actor.position);
        host.combat.hit({ source: actor.combatActor(), sourceTags: tags, target: host.player.health, amount: damage, point, dir, from, moveId: move });
      };
      const ports: HomeObservation = { dt: 0, t: 0, player, calm: false, phaseOffset: spec.brains.phase(kind, actor), reach, claim, hurt,
        steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
        flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } } };
      const brain = spec.brains.policy(kind, actor) ?? spec.custom(kind, actor);
      const observe = (dt: number): void => { ports.dt = dt; ports.t = host.clock.now; };
      return {
        decide: dt => { observe(dt); brain.think(ports); },
        move: dt => { observe(dt); brain.act(ports); },
        snapshot: () => brain.snapshot(),
        restore: value => { brain.restore(value); },
      };
    } }, saved);
}

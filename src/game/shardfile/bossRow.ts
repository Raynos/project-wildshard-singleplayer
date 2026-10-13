import * as v from 'valibot';
import { Vector3 } from 'three';
import { parseBossOwnerRow } from '@wildshard/format/bossProfiles';
import { bossFight, type HeldBossBrain } from '../plugin/bossPhase';
import type { KeptBossBody } from './homeKeeper';
import { DirectorBossBrain } from '../plugin/director';
import { BossBrain, type BossContinuation, type BossDefinition, type BossSaved, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { silentBossPresentation } from '@wildshard/engine/ai/phases';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { installSpeciesHomes, type SpeciesHomesSpec } from '../plugin/brain';

/** A boss row's two durable flags: beaten (its record's `defeated`) and paid (its record's `rewardTaken`). */
export interface BossRowFlagNames { readonly defeated: string; readonly paid: string }
/** The shard flags a boss record reads and writes. */
export interface BossRowFlags { has: (flag: string) => boolean; set: (flag: string) => void }

/** A boss row's record kept on the shard's own flags (no save of its own): `saved` to start from, `persist` to write. */
export function bossFlagRecord(flags: BossRowFlags, names: BossRowFlagNames): { saved: BossSaved; persist: (value: BossSaved) => void } {
  const defeated = flags.has(names.defeated);
  return { saved: { defeated, rewardTaken: flags.has(names.paid), kills: defeated ? 1 : 0 },
    persist: (value) => { if (value.defeated) flags.set(names.defeated); if (value.rewardTaken) flags.set(names.paid); } };
}

/** What a boss row's encounter is given: its definition and view-free script, its body, its record and its fight state. */
export interface BossRowSpec {
  /** The encounter's fixed-step id; its continuation is `{ version: 1, boss: BossBrain's, fight: the script's }`. */
  readonly step: string;
  readonly definition: BossDefinition;
  /** Explicit encounter author; absent retains the original native continuation. */
  readonly stages?: unknown;
  readonly script: BossScript;
  /** The boss's live body (null between resets): a hit on it is refused while `shielded`. */
  readonly body: () => AnimalSim | null;
  /** The script's shield / invulnerability through a beat (the host's `damage.modify` refuses hits on the body). */
  readonly shielded: () => boolean;
  /** The script's own continuation beside BossBrain's; `restore` validates its own shape. */
  readonly fight: { readonly snapshot: () => unknown; readonly restore: (value: unknown) => void };
  /** The record to start from and how it persists (`bossFlagRecord`, or the shard's own). */
  readonly saved: BossSaved;
  readonly persist: (value: BossSaved) => void;
  /** The victory's reward (coins through the platform's effect port); the brain calls it on the first fall. */
  readonly spawnReward?: () => void;
  /** Armed at install (a boss that waits for the player in its arena); otherwise `summon` arms it. */
  readonly armed?: boolean;
  /** After a restore: re-adopt the body the host reinstalled, mirror the restored record. */
  readonly restored?: (boss: BossContinuation) => void;
}

const finite = v.pipe(v.number(), v.finite());
const Boss = v.strictObject({ state: v.picklist(['dormant', 'armed', 'intro', 'fight', 'beat', 'victory']), phase: finite, checkpoint: finite, attempts: finite, t: finite, skipT: finite, short: v.boolean(),
  director: v.exactOptional(v.string()),
  saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) });
const Saved = v.strictObject({ version: v.picklist([1, 2]), boss: Boss, fight: v.unknown() });

/**
 * A declared boss row's encounter in a renderer-free host (SHARD-PLATFORM SF72): the engine's `BossBrain` (arm, intro,
 * phase thresholds, beats, checkpoints, victory) over the shard's view-free script, with no views (the silent
 * presentation: the boss bar, name card, skip hold and toasts are the browser's). It answers the host's
 * `damage.modify` (no hit on the body while the script is shielded) and the health model's `death.checkpoint` (a player
 * death in the fight returns them to the script's respawn point and resets the boss to the checkpoint's phase), moves
 * the player for the brain's respawn / face-toward, and keeps the brain's and the script's continuation as one fixed
 * step. The player's weapons are locked through the intro (`locked`). Signal's Dune Matriarch and Sky Reach's Storm Roc
 * have this shape.
 */
export function installBossRow(host: SimHost, spec: BossRowSpec): { boss: BossBrain; summon: () => void; locked: () => boolean } {
  const player = host.player;
  const ports = { events: host.events, player: { position: player.position },
    lockInput: () => undefined, skipHeld: () => false,
    respawn: (pos: Vector3, yaw: number) => { player.position.copy(pos); player.yaw = yaw; },
    faceToward: (target: Vector3) => { player.yaw = Math.atan2(player.position.x - target.x, player.position.z - target.z); },
    spawnReward: () => { spec.spawnReward?.(); }, persist: spec.persist };
  const boss = spec.stages === undefined
    ? new BossBrain(spec.definition, spec.script, ports, silentBossPresentation(), spec.saved)
    : new DirectorBossBrain(spec.definition, spec.script, ports, silentBossPresentation(), spec.saved, spec.stages);
  host.events.answer('damage.modify', (request) => { const body = spec.body(); return request !== null && body !== null && request.target === body.combatActor() && spec.shielded() ? null : request; }, host.scope);
  host.events.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true, host.scope);
  if (spec.armed === true) boss.arm();
  host.onStep(spec.step, dt => { boss.update(dt, host.clock.now); }, {
    snapshot: () => JSON.stringify({ version: spec.stages === undefined ? 1 : 2, boss: boss.snapshot(), fight: spec.fight.snapshot() }),
    restore: value => {
      if (typeof value !== 'string') throw new Error(`Invalid ${spec.step} continuation`);
      const state = v.parse(Saved, JSON.parse(value));
      if (state.version !== (spec.stages === undefined ? 1 : 2) || (state.boss.director === undefined) !== (spec.stages === undefined)) throw new Error('Incompatible boss stage continuation');
      boss.restore(state.boss); spec.fight.restore(state.fight); spec.restored?.(state.boss);
    },
  });
  return { boss, summon: () => { if (boss.state === 'dormant') boss.arm(); }, locked: () => boss.state === 'intro' };
}


/** Real roster ownership; the row cannot manufacture, retire or replace a foreign body. */
export type BossOwnerBody =
  | { readonly kind: 'spawned'; readonly keeper: KeptBossBody }
  | { readonly kind: 'held'; readonly actor: AnimalSim; readonly brain: HeldBossBrain };
/** Native effect ports are supplied by the host, never serialized callbacks. */
export interface BossOwnerPorts {
  readonly body: BossOwnerBody;
  readonly fact: (name: string, actorId: string) => void;
  readonly coins: (amount: number, actorId: string) => void;
}
const spawnedState = v.strictObject({ stormGoal: finite, storm: finite, invulnerable: v.boolean() });
/** Install the authored stage/profile and its real body's native lifetime together.
 * Both held and spawned patterns preserve install order, reward timing and the
 * existing BossBrain/fight continuation; restore only adopts the owned roster. */
export function installBossOwnerRow(host: SimHost, input: unknown, ports: BossOwnerPorts): ReturnType<typeof installBossRow> {
  const row = parseBossOwnerRow(input), profile = row.profile, owner = ports.body;
  if (profile.pattern !== owner.kind) throw new Error('Boss owner/profile mismatch');
  const record = row.record === undefined ? undefined : bossFlagRecord(host.flags, row.record);
  const saved = record?.saved ?? row.saved ?? { defeated: false, rewardTaken: false, kills: 0 };
  const persist = record?.persist ?? (() => undefined);
  const victory = (): void => {
    if (row.victory.once && host.flags.has(row.victory.flag)) return;
    host.flags.set(row.victory.flag); ports.fact(row.victory.fact, row.actor);
    if (row.reward.when === 'victory') ports.coins(row.reward.amount, row.actor);
  };
  const reward = row.reward.when === 'claim' ? () => {
    saved.rewardTaken = true; persist(saved); ports.coins(row.reward.amount, row.actor);
  } : undefined;
  if (profile.pattern === 'spawned' && owner.kind === 'spawned') {
    const placement = row.placement;
    if (placement === undefined) throw new Error('Spawned boss placement missing');
    const at = placement.rewardPoint, back = placement.respawn, keeper = owner.keeper;
    const fight = bossFight(profile, { body: { spawn: () => keeper.draw(), retire: () => { keeper.free(); } },
      rewardPoint: new Vector3(at.x, at.y, at.z),
      respawnPoint: () => ({ pos: new Vector3(back.x, host.groundHeightAt(back.x, back.z), back.z), yaw: back.yaw }), victory });
    fight.adopt(keeper.actor());
    return installBossRow(host, { step: row.step, stages: row.stages, definition: row.definition,
      script: fight.script, body: fight.body, shielded: fight.invulnerable,
      fight: { snapshot: fight.snapshot, restore: value => { fight.restore(v.parse(spawnedState, value)); } },
      saved, persist, ...(reward === undefined ? {} : { spawnReward: reward }), armed: row.armed,
      restored: () => { fight.adopt(keeper.actor()); } });
  }
  if (profile.pattern !== 'held' || owner.kind !== 'held') throw new Error('Held boss owner missing');
  const fight = bossFight(profile, { body: owner.actor, brain: owner.brain, victory });
  return installBossRow(host, { step: row.step, stages: row.stages, definition: row.definition,
    script: fight.script, body: () => owner.actor, shielded: fight.shielded,
    fight: { snapshot: fight.snapshot, restore: fight.restore }, saved, persist,
    ...(reward === undefined ? {} : { spawnReward: reward }), armed: row.armed });
}

/** Install an encounter over its declared population's actual owner. Admission
 * checks the owner address before allocating bodies; held controllers come from
 * that population's admitted brain, and spawned bosses use its own keeper.
 * The caller retains construction phase, fixed-step order and settle timing. */
export function installSpeciesEncounter(host: SimHost, population: SpeciesHomesSpec, input: unknown,
  ports: Omit<BossOwnerPorts, 'body'>, saved?: Parameters<typeof installSpeciesHomes>[2]): {
  keeper: ReturnType<typeof installSpeciesHomes>; encounter: ReturnType<typeof installBossOwnerRow>;
} {
  const row = parseBossOwnerRow(input), pattern = row.profile.pattern;
  if (pattern === 'spawned' ? population.boss?.id !== row.actor : !population.homes.some(home => home.id === row.actor)) {
    throw new Error('Encounter owner must belong to its declared species population');
  }
  const keeper = installSpeciesHomes(host, population, saved);
  let body: BossOwnerBody;
  if (pattern === 'spawned') {
    if (keeper.boss === null) throw new Error('Declared spawned encounter has no keeper');
    body = { kind: 'spawned', keeper: keeper.boss };
  } else {
    const actor = keeper.homes().find(home => home.id === row.actor)?.actor;
    const brain = actor === null || actor === undefined ? null : population.brains.held(actor.kind, actor);
    if (actor === null || actor === undefined || brain === null) throw new Error('Declared held encounter has no owned controller');
    body = { kind: 'held', actor, brain };
  }
  return { keeper, encounter: installBossOwnerRow(host, row, { body, ...ports }) };
}

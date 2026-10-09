import * as v from 'valibot';
import { BossBrain, type BossContinuation, type BossDefinition, type BossSaved, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { silentBossPresentation } from '@wildshard/engine/ai/phases';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';

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
  saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) });
const Saved = v.strictObject({ version: v.literal(1), boss: Boss, fight: v.unknown() });

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
  const boss = new BossBrain(spec.definition, spec.script, { events: host.events, player: { position: player.position },
    lockInput: () => undefined, skipHeld: () => false,
    respawn: (pos, yaw) => { player.position.copy(pos); player.yaw = yaw; },
    faceToward: (target) => { player.yaw = Math.atan2(player.position.x - target.x, player.position.z - target.z); },
    spawnReward: () => { spec.spawnReward?.(); }, persist: spec.persist }, silentBossPresentation(), spec.saved);
  host.events.answer('damage.modify', (request) => { const body = spec.body(); return request !== null && body !== null && request.target === body.combatActor() && spec.shielded() ? null : request; }, host.scope);
  host.events.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true, host.scope);
  if (spec.armed === true) boss.arm();
  host.onStep(spec.step, dt => { boss.update(dt, host.clock.now); }, {
    snapshot: () => JSON.stringify({ version: 1, boss: boss.snapshot(), fight: spec.fight.snapshot() }),
    restore: value => {
      if (typeof value !== 'string') throw new Error(`Invalid ${spec.step} continuation`);
      const state = v.parse(Saved, JSON.parse(value));
      boss.restore(state.boss); spec.fight.restore(state.fight); spec.restored?.(state.boss);
    },
  });
  return { boss, summon: () => { if (boss.state === 'dormant') boss.arm(); }, locked: () => boss.state === 'intro' };
}

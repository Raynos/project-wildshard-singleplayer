import * as v from 'valibot';
import { Vector3 } from 'three';
import { BossBrain } from '@wildshard/engine/ai/BossBrain';
import { silentBossPresentation } from '@wildshard/engine/ai/phases';
import type { SimHost } from '@wildshard/engine/sim';
import { BASIN } from '../layout';
import { BASIN_FLOOR } from '../world/dunes';
import { FACT, MATRIARCH_FLAG } from '../quests/signal';
import { MATRIARCH_ID, MATRIARCH_REWARD, matriarchDefinition, matriarchFight, matriarchFlagRecord } from '../combat/matriarchFight';
import type { SignalBossBody } from './homes';

/** Her encounter's fixed-step id; its continuation is `BossBrain`'s plus the script's storm and invulnerability. */
export const MATRIARCH_STEP = MATRIARCH_ID;

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1),
  boss: v.strictObject({ state: v.picklist(['dormant', 'armed', 'intro', 'fight', 'beat', 'victory']), phase: finite, checkpoint: finite, attempts: finite, t: finite, skipT: finite, short: v.boolean(),
    saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) }),
  fight: v.strictObject({ stormGoal: finite, storm: finite, invulnerable: v.boolean() }) });

/** What her encounter is lent: her body in the creature keeper and the platform's effect ports. */
export interface SignalMatriarchPorts {
  readonly body: SignalBossBody;
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
}

/**
 * The Dune Matriarch's encounter in the renderer-free host (SF72): the engine's `BossBrain` (arm, intro, phase
 * thresholds, beats, checkpoints, victory) over the view-free script (combat/matriarchFight.ts), with her body in the
 * creature keeper (runtime/homes.ts: the stream's six draws per reset, the shared tokens, her `MatriarchBrain` at the
 * 10 Hz cadence). The signal fire's light arms her (`summon`); her invulnerability through a beat answers the host's
 * `damage.modify`; victory sets `MATRIARCH_FLAG` (the quest's last step) and emits her fact, and the first fall pays
 * her 20 coins. The player's weapons are locked through the intro (`locked`). A player death in her fight answers the
 * health model's `death.checkpoint` as the browser does: back at the basin's rim, her body fresh at the checkpoint's
 * phase. The browser's skip hold, toasts, boss bar, fog and coin burst are views.
 */
export function installSignalMatriarch(host: SimHost, ports: SignalMatriarchPorts): { boss: BossBrain; summon: () => void; locked: () => boolean } {
  const record = matriarchFlagRecord(host.flags), saved = record.saved;
  const fight = matriarchFight({ body: { spawn: () => ports.body.draw(), retire: () => { ports.body.free(); } },
    rewardPoint: new Vector3(BASIN.x, BASIN_FLOOR, BASIN.z),
    respawnPoint: () => ({ pos: new Vector3(BASIN.x, host.groundHeightAt(BASIN.x, BASIN.z + BASIN.r + 4), BASIN.z + BASIN.r + 4), yaw: 0 }),
    victory: () => { host.flags.set(MATRIARCH_FLAG); ports.fact(FACT.matriarch, MATRIARCH_ID); } });
  const player = host.player;
  const boss = new BossBrain(matriarchDefinition(), fight.script, { events: host.events, player: { position: player.position },
    lockInput: () => undefined, skipHeld: () => false,
    respawn: (pos, yaw) => { player.position.copy(pos); player.yaw = yaw; },
    faceToward: (target) => { player.yaw = Math.atan2(player.position.x - target.x, player.position.z - target.z); },
    spawnReward: () => { saved.rewardTaken = true; record.persist(saved); ports.coins(MATRIARCH_REWARD, MATRIARCH_ID); },
    persist: record.persist }, silentBossPresentation(), saved);
  host.events.answer('damage.modify', (request) => { const animal = fight.body(); return request !== null && animal !== null && request.target === animal.combatActor() && fight.invulnerable() ? null : request; }, host.scope);
  host.events.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true, host.scope);
  fight.adopt(ports.body.actor());
  host.onStep(MATRIARCH_STEP, dt => { boss.update(dt, host.clock.now); }, {
    snapshot: () => JSON.stringify({ version: 1, boss: boss.snapshot(), fight: fight.snapshot() }),
    restore: value => {
      if (typeof value !== 'string') throw new Error('Invalid Matriarch continuation');
      const state = v.parse(Saved, JSON.parse(value));
      boss.restore(state.boss); fight.restore(state.fight); fight.adopt(ports.body.actor());
    },
  });
  return { boss, summon: () => { if (boss.state === 'dormant') boss.arm(); }, locked: () => boss.state === 'intro' };
}

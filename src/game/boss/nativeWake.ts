/** Native wake shell over the existing world. Public inputs are rows and
 * placement values; the body is resolved by the row's declared kind. */
import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { WakeBossEncounter, type WakeBossObservation } from './wake';
import { parseWakeEncounter } from '@wildshard/format/bossEncounter';

const finite = v.pipe(v.number(), v.finite());
const Encounter = v.strictObject({ attempt: v.boolean(), waitForReturn: v.boolean(),
  boss: v.strictObject({ state: v.picklist(['dormant', 'armed', 'intro', 'fight', 'beat', 'victory']), phase: finite, checkpoint: finite, attempts: finite, t: finite, skipT: finite, short: v.boolean(),
    saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) }) });

/** Install from data. Spawn remains the existing AS director/roster command,
 * rather than an arbitrary callback lent to the encounter. */
export function installWakeBoss(host: SimHost, input: unknown, placement: { pool: { x: number; z: number }; arena: number }): { encounter: WakeBossEncounter; publish: (event: string) => void } {
  const row = parseWakeEncounter(input), { pool, arena } = placement;
  const encounter = new WakeBossEncounter(row, pool);
  const body = () => Array.from(host.entities.values()).find(actor => actor.kind === row.kind) ?? null;
  const observation = (): WakeBossObservation => ({ player: host.player.position, animal: body(), wake: host.flags.has(row.wakeFlag), dead: host.flags.has(row.deadFlag) });
  const flush = (): void => { for (const effect of encounter.takeEffects()) if (effect.kind === 'outcome') host.events.emit('boss.attempt', { boss: row.id, level: row.level, outcome: effect.outcome }); };
  host.events.on('damage.dealt', ({ req, killed }) => {
    const actor = body(); if (killed && actor !== null && req.target === actor.combatActor()) host.flags.set(row.deadFlag);
  }, host.scope);
  host.events.on('player.died', () => { encounter.onPlayerDeath(host.player.position); flush(); }, host.scope);
  host.onStep(row.step, () => { encounter.update(observation()); flush(); }, {
    snapshot: () => JSON.stringify(encounter.encounterSnapshot()),
    restore: value => { encounter.encounterRestore(v.parse(Encounter, JSON.parse(v.parse(v.string(), value)))); },
  });
  return { encounter, publish: event => {
    if (event !== row.events.restore && event !== row.events.wake) throw new Error('Unknown boss event');
    const actor = body(); if (actor === null) throw new Error('Boss director did not materialize its declared body');
    actor.herd = -1; actor.mem[row.fields.poolX] = pool.x; actor.mem[row.fields.poolZ] = pool.z; actor.mem[row.fields.arena] = arena;
    if (event === row.events.wake) encounter.wake(observation()); flush();
  } };
}

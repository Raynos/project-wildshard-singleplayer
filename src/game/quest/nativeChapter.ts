/** Renderer-free chapter clock binding shared by the actual native quest entries. */
import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { isJsonData } from '@wildshard/format/json';
import { ChapterDirectorSchema, parseChapterDirector } from '@wildshard/format/chapterDirector';
import { WakeEncounterSchema } from '@wildshard/format/bossEncounter';
import type { DirectorScriptStageLane, readDirectorProduct } from '../plugin/director';
import { mixedPopulation } from '../population/mixedRoster';
import { installWakeBoss } from '../boss/nativeWake';
import { installNativeQuestChannels } from './nativeInputs';
import { ChapterClock } from './chapterClock';

const finite = v.pipe(v.number(), v.finite());
const chapterName = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const nativeChapter = v.strictObject({ id: chapterName, rows: ChapterDirectorSchema, reward: v.exactOptional(chapterName),
  wake: v.exactOptional(v.strictObject({ population: chapterName, encounter: WakeEncounterSchema,
    placement: v.strictObject({ pool: v.object({ x: finite, z: finite }), arena: finite }),
    cues: v.pipe(v.array(v.strictObject({ id: chapterName, operation: v.picklist(['restore', 'wake', 'effects']) })), v.maxLength(64)) })) });

/** Renderer-free chapter entry. Closed rows borrow actual population, encounter
 * and reward owners; the caller retains its existing step and save envelope. */
export function installNativeChapterDirector(host: SimHost, director: Awaited<ReturnType<typeof readDirectorProduct>>, input: unknown, restoring = false): {
  readonly clock: DirectorScriptStageLane; readonly fast: ChapterClock['fast'];
  readonly update: (dt: number, step?: string) => void;
} {
  if (host.scope.disposed || !isJsonData(input)) throw new Error('Native chapter requires live JSON rows');
  const policy = v.parse(nativeChapter, input), rows = parseChapterDirector(policy.rows);
  const cues = new Map(policy.wake?.cues.map(cue => [cue.id, cue]));
  if (cues.size !== (policy.wake?.cues.length ?? 0)) throw new Error('Duplicate native chapter cue');
  for (const effects of Object.values(rows.actions)) for (const effect of effects) {
    if (effect.kind === 'cue' && !cues.has(effect.id)) throw new Error('Missing native chapter cue');
    if (effect.kind === 'reward' && policy.reward === undefined) throw new Error('Missing native chapter reward owner');
    if (!['flag', 'phase', 'cue', 'reward'].includes(effect.kind)) throw new Error('Native chapter requires closed native effects');
  }
  const population = policy.wake === undefined ? null : mixedPopulation(host, policy.wake.population);
  const encounter = policy.wake === undefined ? null : installWakeBoss(host, policy.wake.encounter, policy.wake.placement);
  const reward = policy.reward === undefined ? null : installNativeQuestChannels(host, policy.reward, { started: false, completed: false });
  const timeline = new ChapterClock(host.scope, director, rows, host.flags,
    { get day() { return host.dayClock ?? null; }, player: host.player.position, reward: rows.reward ?? null, finish: 'assign' }, effect => {
      if (effect.kind === 'reward' && reward !== null) reward[effect.state] = true;
      else if (effect.kind === 'cue' && population !== null && encounter !== null && policy.wake !== undefined) {
        const cue = cues.get(effect.id); if (cue === undefined) throw new Error('Unknown native chapter cue');
        if (cue.operation !== 'effects') {
          if (population.captain() === null) population.spawnCaptain();
          encounter.publish(cue.operation === 'wake' ? policy.wake.encounter.events.wake : policy.wake.encounter.events.restore);
        }
      }
    }, restoring);
  timeline.lane.registerNative(host, policy.id);
  return { clock: timeline.lane, fast: timeline.fast, update: (dt, step) => { timeline.update(dt, step); } };
}

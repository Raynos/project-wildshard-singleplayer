import { Vector3 } from 'three';
import { RewardCaption } from '@wildshard/engine/quest/view/ui';
import { parseChapterDirector, type ChapterDirectorRows } from '@wildshard/format/chapterDirector';
import type { ShardContext } from '../plugin/context';
import { DirectorScriptStageLane, readDirectorProduct } from '../plugin/director';
import { enteredCompletion } from '../complete/declared';
import { boundQuestChapter } from './chapter';
import { commitQuestEffects } from './effects';
import { QuestRewardController } from '../plugin/quests';

/** Client-only chapter presentation on the caller's existing update phase.
 * Rows select observations and ordered effects; concrete entered services supply
 * flags, inventory, clock, objective, equipment and completion. Cues are values
 * for an existing view owner to consume, never reflected calls into shard code.
 */
export async function readChapterDirector(ctx: ShardContext, file: string): Promise<{
  readonly caption: RewardCaption; readonly rewardAt: Vector3 | null;
  readonly rewardPose: ChapterDirectorRows['reward'];
  update: (dt: number) => void; request: (id: string) => void;
  run: (id: string) => void; takeCues: () => string[];
}> {
  const rows = parseChapterDirector(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(file))));
  const director = await readDirectorProduct(ctx.product, ctx.scope);
  if (ctx.scope.disposed) throw new Error('Chapter left during director admission');
  const chapter = boundQuestChapter(ctx.scope, rows.quest), flags = chapter.quest.flags;
  const world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Chapter director requires its entered play services');
  const day = world.sky.dayNight;
  const rewardAt = rows.reward === undefined ? null : new Vector3(rows.reward.x, rows.reward.y, rows.reward.z);
  let fast: { from: number; span: number; t: number; dur: number; to: number } | null = null;
  const cues: string[] = [], state = { started: false, completed: false };
  ctx.scope.onDispose(() => { cues.length = 0; fast = null; });
  const caption = ctx.scope.run(() => new RewardCaption(rows.caption.kicker, rows.caption.title, rows.caption.subtitle));
  const reward = rows.reward === undefined || rewardAt === null ? null : new QuestRewardController(world.player, day,
    { ...rows.reward, at: rewardAt, when: () => state.started,
      finish: () => enteredCompletion(ctx.scope)?.showAfterReward() === true }, {
      start: () => { caption.show(true); play.weapons.visible = false; chapter.objective.hide(true); play.music.sting('chunk'); },
      finish: () => { caption.show(false); },
      release: () => { play.weapons.visible = true; chapter.objective.hide(false); },
    });
  ctx.scope.onDispose(() => { reward?.dispose(); caption.scope.dispose(); });
  const run = (id: string): void => {
    if (ctx.scope.disposed) return;
    const effects = rows.actions[id]; if (effects === undefined) throw new Error(`Unknown chapter publication ${id}`);
    for (const effect of effects) {
      if (effect.kind === 'phase') {
        if (day !== null) fast = { from: day.phase, span: (((effect.to - day.phase) % 1) + 1) % 1, t: 0, dur: effect.seconds, to: effect.to };
      } else if (effect.kind === 'caption') caption.show(effect.show);
      else if (effect.kind === 'objective') chapter.objective.hide(effect.hide);
      else if (effect.kind === 'cue') {
        if (cues.length >= 64) throw new Error('Chapter cue allowance');
        cues.push(effect.id);
      } else if (effect.kind === 'reward') state[effect.state] = true;
      else commitQuestEffects(ctx, rows.quest, [effect]);
    }
  };
  const observe = (): Record<string, number> => Object.fromEntries(Object.entries(rows.observations).map(([key, row]) => {
    if (typeof row === 'number') return [key, row];
    if ('flag' in row) return [key, Number(flags.has(row.flag))];
    const value = row.read === 'day-present' ? Number(day !== null) : row.read === 'night' ? day?.night ?? 0
      : row.read === 'player-x' ? world.player.position.x : row.read === 'player-z' ? world.player.position.z
      : row.read === 'reward-x' ? rewardAt?.x : rewardAt?.z;
    if (value === undefined) throw new Error('Chapter reward observation lacks its pose');
    return [key, value];
  }));
  const script = director.create();
  const clock = ctx.scope.run(() => new DirectorScriptStageLane(director.stages, script, { scope: ctx.scope, observe,
    emits: { source: rows.source, value: 'literal', actions: new Map(Object.keys(rows.actions).filter(key => script.data.events.some(event => event.direction === 'output' && event.key === key)).map(key => [key, () => { run(key); }])) },
  }, false, rows.initialDt));
  const request = (id: string): void => { clock.request(id); };
  ctx.scope.onDispose(flags.onChange((key, on) => {
    if (!on) return;
    if (rows.changes.includes(key)) clock.changed();
    for (const row of rows.requests) if ('flag' in row && row.flag === key) request(row.request);
  }));
  ctx.scope.onDispose(chapter.quest.observe({ step: step => {
    for (const row of rows.requests) if ('step' in row && row.step === step?.id) request(row.request);
  } }));
  for (const row of rows.requests) if ('step' in row && row.step === chapter.quest.current?.id) request(row.request);
  return { caption, rewardAt, rewardPose: rows.reward, run, request, takeCues: () => cues.splice(0), update: dt => {
    if (ctx.scope.disposed) return;
    if (fast !== null && day !== null) {
      fast.t += dt; const k = Math.min(1, fast.t / fast.dur), e = k * k * (3 - 2 * k);
      day.phase = (fast.from + fast.span * e) % 1;
      if (k >= 1) { const to = fast.to; fast = null; void day.set(to); }
    }
    clock.update(dt); reward?.update(dt, state.completed);
  } };
}

import { Vector3 } from 'three';
import { RewardCaption } from '@wildshard/engine/quest/view/ui';
import { parseChapterDirector, type ChapterDirectorRows } from '@wildshard/format/chapterDirector';
import type { ShardContext } from '../plugin/context';
import { DirectorScriptStageLane, readDirectorProduct } from '../plugin/director';
import { enteredCompletion } from '../complete/declared';
import { boundQuestChapter } from './chapter';
import { commitQuestEffects } from './effects';
import { QuestRewardController } from '../plugin/quests';
import { parseQuestSpawnPage, parseQuestLeadPage, QuestSpawnPageSchema, QuestLeadPageSchema, type QuestSpawnPageRows, type QuestLeadPageRows } from '@wildshard/format/questSteps';
import * as v from 'valibot';
import { readSpawnScript, SpawnScript } from '../population/spawnScript';
import { boundQuestState } from './boundState';
import { TIER } from '@wildshard/engine/core/tier';
import { questSpawnObservations, questSpawnPublications } from './steps';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import type { Animal } from '@wildshard/engine/entities/AnimalView';

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

/** Client-only quest projection over the existing AS spawn director. It owns
 * no decision clock or body policy, and accepts no shard callbacks. Puff cues
 * remain plain points consumed by the existing view owner. */
export async function installQuestSpawnDirector(ctx: ShardContext, input: unknown): Promise<{
  readonly puffs: QuestSpawnPageRows['puffs'];
  readonly count: number; force: () => void; useSfx: (bank: DeclaredSoundBank) => void;
  update: (dt: number, player: Vector3) => void; takePuffs: () => readonly { readonly x: number; readonly y: number; readonly z: number }[];
}> {
  const rows = parseQuestSpawnPage(v.parse(v.object({ spawns: QuestSpawnPageSchema }), input).spawns), source = await readSpawnScript(ctx.product, rows.script);
  if (ctx.scope.disposed) throw new Error('Quest left during spawn director admission');
  if (rows.channel > source.channels.length || rows.cues.some(cue => cue.id > source.cues.length)
    || [...rows.flags, ...rows.complete].some(row => !source.flags.includes(row.flag))) throw new Error('Unknown quest spawn observation or publication');
  const flags = boundQuestState(ctx.scope, rows.quest).flags, world = ctx.game.runtime?.world, animals = ctx.game.runtime?.play?.animals;
  if (world === undefined || world === null || animals === undefined) throw new Error('Quest spawn director requires its entered world');
  const brain = SpawnScript.page(animals, source), observed: string[] = [];
  let bank: DeclaredSoundBank | null = null, puffs: { readonly x: number; readonly y: number; readonly z: number }[] = [];
  ctx.scope.onDispose(() => { puffs.length = 0; bank = null; });
  return { puffs: rows.puffs, get count() { return brain.channel(rows.channel); }, force: () => { brain.force(); }, useSfx: value => {
    if (rows.cues.some(cue => cue.kind === 'sound' && !value.acceptsShot(cue.name))) throw new Error('Unknown quest spawn sound');
    bank = value;
  },
    takePuffs: () => { const out = puffs; puffs = []; return out; }, update: (dt, player) => {
      if (ctx.scope.disposed) return;
      questSpawnObservations(rows, flags.all, observed);
      brain.advance(dt, player, world.sky.dayNight?.night ?? 0, rows.limit[TIER], observed);
      commitQuestEffects(ctx, rows.quest, questSpawnPublications(rows, flags.all, rows.complete.filter(row => brain.hasFlag(row.flag)).map(row => row.flag)));
      for (const event of brain.drainEffects()) {
        if (event.kind !== 'cue') continue;
        const cue = rows.cues.find(row => row.id === event.id);
        if (cue?.kind === 'sound') bank?.shot(cue.name, { at: event.at });
        else if (cue?.kind === 'puff') { if (puffs.length >= 64) throw new Error('Quest puff cue allowance'); puffs.push(event.at); }
      }
    } };
}

/** Client-only guide lifetime over the actual manager. The chapter's existing
 * AS projection decides at 10 Hz; the native body integrates each frame. A
 * guide is removed from combat, aim-assist and minimap lists immediately. */
export function installChapterLead(ctx: ShardContext, input: unknown): {
  readonly puffs: QuestLeadPageRows['puffs'];
  readonly active: boolean; readonly position: Vector3 | null;
  update: (dt: number, t: number) => void;
  takePuffs: () => readonly { readonly kind: 'appear' | 'fade'; readonly x: number; readonly y: number; readonly z: number }[];
} {
  const rows = parseQuestLeadPage(v.parse(v.object({ leadPage: QuestLeadPageSchema }), input).leadPage), chapter = boundQuestChapter(ctx.scope, rows.quest);
  const world = ctx.game.runtime?.world, animals = ctx.game.runtime?.play?.animals;
  if (world === undefined || world === null || animals === undefined) throw new Error('Chapter guide requires its entered world');
  if (!chapter.quest.def.steps.some(step => step.id === rows.step)) throw new Error('Unknown chapter guide step');
  let actor: Animal | null = null, pending = 0;
  const walk = { i: 0, mode: 0, elapsed: 0 }, observation = { i: 0, mode: 0, elapsed: 0, begin: 0, dt: 0, on: 0, playerX: 0, playerZ: 0, atX: 0, atZ: 0 };
  let puffs: { readonly kind: 'appear' | 'fade'; readonly x: number; readonly y: number; readonly z: number }[] = [];
  const puff = (kind: 'appear' | 'fade'): void => {
    if (actor === null) return;
    if (puffs.length >= 64) throw new Error('Chapter guide cue allowance');
    puffs.push({ kind, x: actor.position.x, y: actor.position.y, z: actor.position.z });
  };
  const vanish = (done: boolean): void => {
    if (actor === null) return;
    if (actor.mesh.visible) puff('fade');
    actor.alive = false; actor.hidden = true; actor.mesh.visible = false; actor.mesh.removeFromParent(); actor = null;
    if (done) commitQuestEffects(ctx, rows.quest, rows.effects.complete);
  };
  ctx.scope.onDispose(() => { vanish(false); puffs.length = 0; });
  return { puffs: rows.puffs, get active() { return actor !== null; }, get position() { return actor?.position ?? null; },
    takePuffs: () => { const out = puffs; puffs = []; return out; }, update: (dt, t) => {
      if (ctx.scope.disposed) return;
      const player = world.player.position;
      pending += dt;
      if (pending >= 0.1) {
        const point = rows.path[walk.i], at = actor?.position;
        Object.assign(observation, walk, { dt: pending, on: Number(chapter.quest.current?.id === rows.step && (world.sky.dayNight?.night ?? 0) > rows.nightAbove),
          playerX: player.x, playerZ: player.z, atX: at?.x ?? point?.[0] ?? 0, atZ: at?.z ?? point?.[1] ?? 0 });
        const result = chapter.project(rows.signal, observation), i = result['i'], mode = result['mode'], elapsed = result['elapsed'], event = result['event'];
        if (i === undefined || mode === undefined || elapsed === undefined || event === undefined || !Number.isInteger(i) || i < 0 || i >= rows.path.length
          || !Number.isInteger(mode) || mode < 0 || mode > 3 || elapsed < 0 || !Number.isInteger(event) || event < 0 || event > 5) throw new Error('Invalid chapter guide projection');
        walk.i = i; walk.mode = mode; walk.elapsed = elapsed; pending = 0;
        if (event === 4) vanish(false);
        else if (event === 1 || event === 2) {
          const target = rows.path[walk.i];
          if (target === undefined) throw new Error('Missing chapter guide point');
          const yaw = Math.atan2(player.x - target[0], player.z - target[1]);
          if (actor !== null) { actor.place(target[0], target[1], yaw); actor.mesh.visible = true; }
          else {
            actor = animals.spawn(rows.actor.kind, target[0], target[1], yaw, rows.actor.variant);
            const index = animals.animals.indexOf(actor); if (index !== -1) animals.animals.splice(index, 1);
            actor.herd = -1; actor.setDrawLod(0);
          }
          actor.sampleTerrain(); puff('appear'); if (event === 1) commitQuestEffects(ctx, rows.quest, rows.effects.appear);
        } else if (event !== 0 && actor !== null) {
          puff('fade'); animals.onSound?.(rows.sound, actor.position);
          actor.mesh.visible = false; actor.setMotion(actor.yaw, 0, rows.motion.stopTurn);
          if (event === 5) vanish(true);
        }
      }
      if (actor === null) return;
      actor.update(dt, t, true);
      if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) actor.sampleTerrain();
      if (walk.mode === 1) {
        actor.setMotion(Math.atan2(player.x - actor.position.x, player.z - actor.position.z), 0, rows.motion.faceTurn);
        actor.lookTarget.copy(player); actor.lookWeight = 1;
      } else if (walk.mode === 2) {
        const next = rows.path[walk.i + 1] ?? rows.path[walk.i];
        if (next !== undefined) actor.setMotion(Math.atan2(next[0] - actor.position.x, next[1] - actor.position.z), rows.motion.trotSpeed, rows.motion.trotTurn);
        actor.lookWeight = 0;
      }
    } };
}

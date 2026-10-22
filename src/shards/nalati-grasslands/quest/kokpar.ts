import { CarriedQuestProp } from '@wildshard/game/quest/carriedProp';
import * as v from 'valibot';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installChapterStory } from '@wildshard/game/quest/chapter';
import type { AdventurePersistence } from '@wildshard/game/quest/persistence';
import type { Nalati } from '../runtime/state';
import { enterFigureGroup } from '@wildshard/game/systems/npc/figureRows';
import population from '../boot/peopleFrames.generated.json' with { type: 'json' };

/** The remaining counted quest view: native resources feed the chapter, camp
 * and goat at their original phases; every story decision comes from AS. */
export async function installNalatiQuestView(ctx: ShardContext, rt: Pick<Nalati, 'ride' | 'boss' | 'titan'>,
  persistence: AdventurePersistence): Promise<Flags> {
  const alive = (): boolean => !ctx.scope.disposed;
  const world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Quest view requires its entered world and play');
  const { game, sky, player, registry } = world, { animals } = play, ride = rt.ride;
  const [story, content] = await Promise.all([ctx.product.json<unknown>('quests/chapters.json'), ctx.product.json<unknown>('quests/content.json')]);
  if (!alive()) throw new Error('The adventure left during story admission');
  const people = enterFigureGroup({ scope: ctx.scope, sky, registry, channels: ctx.product.shardfile.clientChannels }, population);
  const kokparRows = v.parse(v.object({ kokpar:v.object({program:v.unknown()}) }), content).kokpar;
  const chapter = installChapterStory(ctx, story, { content, program: kokparRows.program }), { chip, markers, places, line } = chapter;
  if (places === null || line === null) throw new Error('The chapter requires its original discovery and quest line');
  const flags = chapter.quest.flags;
  const kokpar = new CarriedQuestProp(ctx,await ctx.product.json<unknown>('quests/carried.json'));
  game.scene.add(kokpar.object);
  let now = 0, slowT = 0, eliteT = -1e9;
  const poll = (): void => { chapter.project('quest', { now, bonded: Number(ride?.taming.phase === 'bonded'), argymaq: Number(ride?.taming.upgraded === true),
    inside: Number(rt.boss.inside), tied: Number(rt.titan.fight.tied) });
    if (now - eliteT > 2) { eliteT = now; chapter.project('feathers', { now }); }
  };
  poll();
  const carving = (): void => { chapter.project('carving', { now }); };
  ctx.on('actor.died', ({ actor }) => {
    const body = animals.animals.find(candidate => candidate.combatActor() === actor);
    if (body === undefined) return;
    persistence.kill(body.kind, body.variant); if (body.kind === 'balbal') carving();
  });
  chapter.installFeats();
  ctx.system({ id: 'shard.nalati.quest', phase: 'update', after: ['main.6'], before: ['hud.combat', 'shard.nalati-grasslands.bind', 'first hints', 'main.world', 'main.frame'], run: (dt, t) => {
    now = t; const pp = player.position;
    chapter.update(dt, pp); people.update(dt, t, pp); kokpar.update(dt); chip.update(t, player);
    if (t - slowT > 0.5) { slowT = t; poll(); places.update(pp.x, pp.z); }
  } });
  ctx.debug.expose('nalati.quest', { flags, line, people, kokpar, places, chip, markers, get dialogue() { return chapter.dialogueBox(); }, kokparGoals: kokpar.goals, carving, talk: chapter.talk });
  await people.ready;
  if (!alive()) throw new Error('Nalati was unloaded during the camp people model load');
  return flags;
}

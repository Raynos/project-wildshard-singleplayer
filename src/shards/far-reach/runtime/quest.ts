import type { SimHost } from '@wildshard/engine/sim';
import { bindDirectorActions } from '@wildshard/game/plugin/director';
import { SKY_QUEST_STAGES, SKY_QUEST_STAGE_INITIAL } from '../data/questStages';
import { FLAGS } from '../quest/flags';

/** The winch's permission bits, as the browser hands its mover (runtime/index.ts): the roost quiet 1, the vanes turning 2. */
export function skyWinchPermission(flags: Pick<SimHost['flags'], 'has'>): number {
  return Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2;
}

/** Bind the declared flag effects; native observations still come from the existing body or mover owner. */
export function bindSkyQuestStage(id: keyof typeof SKY_QUEST_STAGES, flags: Pick<SimHost['flags'], 'has' | 'set'>, observe?: (binding: string) => boolean): ReturnType<typeof bindDirectorActions> {
  return bindDirectorActions(SKY_QUEST_STAGES[id], { flags, ...(observe === undefined ? {} : { observe }), bindings: [], initial: SKY_QUEST_STAGE_INITIAL[id] });
}


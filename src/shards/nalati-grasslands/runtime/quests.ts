import { QuestLine } from '@wildshard/engine/quest/core';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeQuest, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';

/** Assemble the existing chained view over platform-bound quest states, with one state/listener per chapter. */
export function bindNalatiQuests(ctx: Pick<ShardContext, 'app' | 'scope'>, flags: Flags, facts: RuntimeFacts, data: Shardfile = source): QuestLine {
  const line = new QuestLine([], flags);
  for (let i = 0; i < Math.min(data.quests.quests.length, 3); i++) {
    const row = data.quests.quests[i]; if (row === undefined) continue;
    const quest = bindRuntimeQuest(ctx, data, row.id, { flags, facts }).state;
    quest.onStep = (step, previous) => { line.onStep?.(quest, step, previous); };
    quest.onComplete = () => { line.onComplete?.(quest); };
    line.chapters.push(quest);
  }
  return line;
}

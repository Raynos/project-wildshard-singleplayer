import type { QuestDef, QuestStep } from '../../../shared/quest/core';
import { questChip, questHint, questObjective, type QuestCount, type QuestProgress } from '../../../shared/quest/progress';

/**
 * P1-E3.3: a client's quests, read from what the server replicates. It holds the shard's quest rows and each quest's
 * latest progress and decides nothing: the text is the same law the server's QuestState speaks with.
 */
export class QuestReplica {
  private readonly defs: ReadonlyMap<string, QuestDef>;
  private readonly progress: ReadonlyMap<string, QuestProgress>;
  constructor(defs: readonly QuestDef[], progress: ReadonlyMap<string, QuestProgress>) {
    this.defs = new Map(defs.map(def => [def.id, def])); this.progress = progress;
  }
  private read(id: string): { def: QuestDef; started: boolean; step: QuestStep | null; count: QuestCount | null } {
    const def = this.defs.get(id); if (def === undefined) throw new Error(`Unknown quest ${id}`);
    const row = this.progress.get(id), step = row?.step === null || row === undefined ? null : def.steps.find(entry => entry.id === row.step) ?? null;
    return { def, started: row?.started ?? false, step, count: step?.count === undefined ? null : { n: row?.n ?? 0, of: step.count.length } };
  }
  isStarted(id: string): boolean { return this.read(id).started; }
  objective(id: string): string { const { def, started, step, count } = this.read(id); return questObjective(def, started, step, count); }
  chip(id: string): { label: string; count: string } { const { def, started, step, count } = this.read(id); return questChip(def, started, step, count); }
  hint(id: string): string { const { def, started, step } = this.read(id); return questHint(def, started, step); }
}

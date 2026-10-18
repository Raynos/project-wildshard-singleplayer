import type { Shardfile } from '@wildshard/format/shardSchema';
import type { ShardContext } from '../plugin/context';
import { QuestState, type QuestMarker, type QuestStep } from '@wildshard/engine/quest/core';
import { installCableModes } from '@wildshard/engine/player/modes';
import { publishBoundQuest } from './boundState';
import type { RuntimeQuestPorts, RuntimeQuest } from '../plugin/headless';

type MarkerRow = NonNullable<Shardfile['quests']['quests'][number]['steps'][number]['markers']>[number];
/** Bind a declared quest to the actual flag/ledger owners. The caller chooses
 * its admitted mode rows; this function never constructs a runtime declaration. */
export function bindPageQuest(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile, id: string,
  ports: RuntimeQuestPorts, modes = source.modes): RuntimeQuest {
  const declared = source.quests.quests.find((row) => row.id === id);
  if (declared === undefined) throw new Error(`Undeclared quest ${id}`);
  const fact = declared.onComplete?.fact ?? null, facts = ports.facts;
  if (fact !== null && (facts === undefined || !source.ledger.some((rule) => rule.fact === fact))) throw new Error(`Quest ${id} completes with fact ${fact}, which needs the bound ledger`);
  const place = (marker: MarkerRow): QuestMarker => ({ ...marker, at: ports.place?.(marker) ?? marker.at });
  const steps = declared.steps.map((step): QuestStep => {
    const chip = ports.chip?.(step) ?? step.chip;
    return { ...step, ...(chip === undefined ? {} : { chip }), ...(step.markers === undefined ? {} : { markers: step.markers.map(place) }) };
  });
  const intro = declared.intro === undefined ? undefined : { ...declared.intro, ...(declared.intro.markers === undefined ? {} : { markers: declared.intro.markers.map(place) }) };
  const state = new QuestState({ id: declared.id, title: declared.title, completeFlag: declared.completeFlag, steps,
    ...(declared.startWhen === undefined ? {} : { startWhen: declared.startWhen }), ...(intro === undefined ? {} : { intro }) }, ports.flags, ctx.app.events, ctx.scope);
  if (fact !== null && facts !== undefined) {
    const witness = (): void => { facts(fact, declared.id); };
    if (state.isComplete) witness();
    ctx.scope.onDispose(state.observe({ complete: witness }));
  }
  const bound = { state, declared, cables: installCableModes(ctx.scope, modes?.traverse ?? [], ports.flags), reward: { coins: declared.onComplete?.coins ?? 0, fact } };
  publishBoundQuest(ctx.scope, state);
  return bound;
}

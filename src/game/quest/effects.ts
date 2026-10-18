import { parseQuestServiceActions } from '@wildshard/format/questSteps';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { SimHost } from '@wildshard/engine/sim';
import type { ShardContext } from '../plugin/context';
import { isItemId } from '../bag/itemCatalog';
import { creditNativeInventory, debitNativeInventory } from '../inventoryLaw';
import { boundQuestState } from './boundState';
import { boundChapter, readQuestObservation } from './chapterBindings';
import type { QuestStepEffect } from './steps';

/** Framework-internal dispatch; shard APIs supply effect rows and owner ids only. */
function commit(effects: readonly QuestStepEffect[], flags: Flags,
  credit: (item: string, count: number) => void, debit: (item: string, count: number) => boolean, present?: (effect: Extract<QuestStepEffect, { kind: 'toast' | 'sting' | 'reading' }>) => void): void {
  for (const effect of effects) {
    if (effect.kind === 'flag') { if (effect.value === false) flags.clear(effect.flag); else flags.set(effect.flag); }
    else if (effect.kind === 'item') credit(effect.item, effect.count);
    else if (effect.kind === 'take') {
      if (!debit(effect.item, effect.count)) throw new Error('Quest delivery changed before commit');
    } else if (effect.kind === 'toast' || effect.kind === 'sting' || effect.kind === 'reading') {
      if (present === undefined) throw new Error('Quest presentation requires a page host');
      present(effect);
    } else throw new Error('Quest effect requires an admitted command or notice lane');
  }
}

/** Apply ordered rows at the existing event phase. Page contexts borrow the bound quest/play pack;
 * native hosts borrow their registered pack and flags. The page branch is client-only presentation. */
export function commitQuestEffects(context: Pick<ShardContext, 'scope' | 'game'> | SimHost, owner: string, effects: readonly QuestStepEffect[]): void {
  if ('game' in context) {
    const state = boundQuestState(context.scope, owner), play = context.game.runtime?.play;
    if (play === undefined || play === null) throw new Error('Quest effects require the play host');
    commit(effects, state.flags, (item, count) => {
      if (!isItemId(item)) throw new Error('Unknown quest inventory item');
      play.inventory.add(item, count);
    }, (item, count) => {
      if (!isItemId(item)) throw new Error('Unknown quest inventory item');
      return play.inventory.take(item, count);
    }, effect => {
      if (effect.kind === 'toast' && effect.when !== undefined && readQuestObservation(context, owner, effect.when) === 0) return;
      if (effect.kind === 'reading') boundChapter(context.scope, owner).reading(effect);
      else if (effect.kind === 'sting') play.music.sting(effect.name);
      else if (effect.progress !== undefined) {
        const progress = effect.progress, count = progress.flags.filter(flag => state.flags.has(flag)).length;
        play.hud.toast(count === progress.flags.length ? progress.complete : `${effect.text} · ${String(count)}/${String(progress.flags.length)}`);
      } else play.hud.toast(effect.counter === undefined ? effect.text
        : `${effect.text} · ${String(state.flags.count(effect.counter.prefix))} / ${String(effect.counter.of)}`);
    });
  } else commit(effects, context.flags, (item, count) => { creditNativeInventory(context, owner, { item, count }); },
    (item, count) => debitNativeInventory(context, owner, { item, count }));
}

/** Client-only named actions borrow existing services; parsing creates no state, listener or save owner. */
export async function readQuestServiceActions(ctx: Pick<ShardContext, 'scope' | 'game' | 'product'>, quest: string, file: string): Promise<{ readonly run: (id: string) => void }> {
  if (!ctx.product.shardfile.quests.quests.some(row => row.id === quest)) throw new Error('Quest service actions require a declared quest');
  const rows = parseQuestServiceActions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(file))));
  if (ctx.scope.disposed) throw new Error('Quest left while admitting service actions');
  const actions = new Map(rows.actions.map(row => [row.id, row.effects]));
  return { run: id => {
    const effects = actions.get(id); if (effects === undefined) throw new Error(`Unknown quest service action ${id}`);
    commitQuestEffects(ctx, quest, effects);
  } };
}

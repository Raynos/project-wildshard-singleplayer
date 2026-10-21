import type { SimHost } from '@wildshard/engine/sim';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { NativeInventory } from '../inventoryLaw';
import { ItemCatalogue } from '../plugin/nativeItems';
import { bindQuestTableSpots } from '../plugin/quests';
import { installDeclaredQuestHost, type QuestHostPorts } from '../plugin/simulation';
import { nativeQuestInputs } from './nativeInputs';
import { AchievementCounterBook, type AchievementCounterRows } from '../achievements';

type NativeQuestOwners = Omit<QuestHostPorts, 'spots' | 'commands' | 'fact' | 'coins'> & { readonly spots?: QuestHostPorts['spots'] };

/** The existing saved counter book with its actual native ledger owner. */
interface NativeQuestAchievements extends AchievementCounterBook {
  readonly flush: () => void; readonly sync: () => void; readonly observe: () => void;
}

/** Renderer-free entry over the admitted inventory/table and existing worker
 * command and ledger owners. Composition lends only actual platform mechanics
 * at its original graph-install phase; author input stays rows and identities. */
export function prepareNativeQuestEntry<Spot extends { readonly id: string; readonly kind: string }>(
  host: SimHost, source: Shardfile, table: InteractTable, spots: readonly Spot[],
  bounds: Parameters<typeof bindQuestTableSpots>[3] = {},
): {
  readonly input: ReturnType<typeof nativeQuestInputs>; readonly inventory: ItemCatalogue['inventory'];
  readonly rules: ReturnType<typeof bindQuestTableSpots<Spot>>; readonly pack: NativeInventory<string>;
  readonly achievements: (rows: AchievementCounterRows, initial?: Readonly<Record<string, number>>) => NativeQuestAchievements;
  readonly install: (owners?: NativeQuestOwners) => ReturnType<typeof installDeclaredQuestHost>;
} {
  if (host.scope.disposed) throw new Error('Native quest entry left before preparation');
  const input = nativeQuestInputs(host), inventory = new ItemCatalogue(source.items).inventory;
  const rules = bindQuestTableSpots(table, spots, host.flags, bounds), pack = new NativeInventory(inventory, host);
  let installed = false;
  return { input, inventory, rules, pack,
    achievements: (rows, initial = {}): NativeQuestAchievements => {
      const book = new AchievementCounterBook(rows, initial);
      const flush = (): void => {
        const facts = book.takeFacts();
        for (let i = 0; i < 1048576; i++) { const row = facts[i]; if (row === undefined) break; input.ledger.fact(row.fact, row.entity); }
      };
      const sync = (): void => { book.counters.syncFlags(host.flags); flush(); };
      return Object.assign(book, { flush, sync, observe: (): void => {
        host.scope.onDispose(host.flags.onChange((flag, on) => { if (on && !flag.startsWith('plate:') && !flag.startsWith('lever:')) sync(); }));
      } });
    },
    install: (owners: NativeQuestOwners = {}): ReturnType<typeof installDeclaredQuestHost> => {
      if (installed || host.scope.disposed) throw new Error('Native quest entry already installed or disposed');
      installed = true;
      return installDeclaredQuestHost(host, source, { ...owners, spots: owners.spots ?? { interact: [], crack: [] },
        commands: input.scripts, fact: input.ledger.fact, coins: input.ledger.coins });
    } };
}

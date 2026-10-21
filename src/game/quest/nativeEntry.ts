import type { SimHost } from '@wildshard/engine/sim';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { NativeInventory } from '../inventoryLaw';
import { ItemCatalogue } from '../plugin/nativeItems';
import { bindQuestTableSpots } from '../plugin/quests';
import { installDeclaredQuestHost, type QuestHostPorts } from '../plugin/simulation';
import { nativeQuestInputs } from './nativeInputs';

/** Renderer-free entry over the admitted inventory/table and existing worker
 * command and ledger owners. Composition lends only actual platform mechanics
 * at its original graph-install phase; author input stays rows and identities. */
export function prepareNativeQuestEntry<Spot extends { readonly id: string; readonly kind: string }>(
  host: SimHost, source: Shardfile, table: InteractTable, spots: readonly Spot[],
  bounds: Parameters<typeof bindQuestTableSpots>[3] = {},
): {
  readonly input: ReturnType<typeof nativeQuestInputs>; readonly inventory: ItemCatalogue['inventory'];
  readonly rules: ReturnType<typeof bindQuestTableSpots<Spot>>; readonly pack: NativeInventory<string>;
  readonly install: (owners?: Omit<QuestHostPorts, 'spots' | 'commands' | 'fact' | 'coins'>) => ReturnType<typeof installDeclaredQuestHost>;
} {
  if (host.scope.disposed) throw new Error('Native quest entry left before preparation');
  const input = nativeQuestInputs(host), inventory = new ItemCatalogue(source.items).inventory;
  const rules = bindQuestTableSpots(table, spots, host.flags, bounds), pack = new NativeInventory(inventory, host);
  let installed = false;
  return { input, inventory, rules, pack,
    install: (owners: Omit<QuestHostPorts, 'spots' | 'commands' | 'fact' | 'coins'> = {}): ReturnType<typeof installDeclaredQuestHost> => {
      if (installed || host.scope.disposed) throw new Error('Native quest entry already installed or disposed');
      installed = true;
      return installDeclaredQuestHost(host, source, { ...owners, spots: { interact: [], crack: [] },
        commands: input.scripts, fact: input.ledger.fact, coins: input.ledger.coins });
    } };
}

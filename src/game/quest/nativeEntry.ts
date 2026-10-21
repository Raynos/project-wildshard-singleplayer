import type { SimHost } from '@wildshard/engine/sim';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { NativeInventory } from '../inventoryLaw';
import { ItemCatalogue } from '../plugin/nativeItems';
import { bindQuestTableSpots } from '../plugin/quests';
import { installDeclaredQuestHost, type QuestHostPorts } from '../plugin/simulation';
import { nativeQuestInputs } from './nativeInputs';
import { AchievementCounterBook, type AchievementCounterRows } from '../achievements';
import * as v from 'valibot';
import { bindInteractionTransitions, type InteractionState, type InteractionTransitions } from '@wildshard/engine/world/interact/flags';
import { plateOverlap } from '@wildshard/engine/world/interact/barrel';
import { walkInPickup } from '@wildshard/engine/world/interact/pickup';
import { isJsonData } from '@wildshard/format/json';

type NativeQuestOwners = Omit<QuestHostPorts, 'spots' | 'commands' | 'fact' | 'coins'> & { readonly spots?: QuestHostPorts['spots'] };
type NativeQuestRule<Spot> = InteractionState & { readonly spot: Spot };
const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const transitionRows = v.strictObject({ ids: v.pipe(v.array(v.string()), v.maxLength(1024)),
  rowLimit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1024)), flagLimit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1024)),
  touch: v.picklist(['direct', 'graph']), pickup: v.union([v.literal('walk-in'), v.strictObject({ radius: positive, height: positive })]),
  plate: v.exactOptional(v.strictObject({ inset: finite, depth: finite })),
});
const transitionSpot = v.object({ x: finite, y: finite, z: finite, yaw: finite });

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
  readonly transitions: (rows: unknown) => InteractionTransitions<NativeQuestRule<Spot>>;
  readonly install: (owners?: NativeQuestOwners) => ReturnType<typeof installDeclaredQuestHost>;
} {
  if (host.scope.disposed) throw new Error('Native quest entry left before preparation');
  const input = nativeQuestInputs(host), inventory = new ItemCatalogue(source.items).inventory;
  const rules = bindQuestTableSpots(table, spots, host.flags, bounds), pack = new NativeInventory(inventory, host);
  let installed = false, graph: ReturnType<typeof installDeclaredQuestHost> | null = null;
  return { input, inventory, rules, pack,
    transitions: data => {
      if (host.scope.disposed || !isJsonData(data)) throw new Error('Native transitions require live JSON rows');
      const rows = v.parse(transitionRows, data), selected = rows.ids.map(id => {
        const rule = rules.get(id); if (rule === undefined) throw new Error(`Unknown native transition row ${id}`); return rule;
      });
      const positions = new Map(selected.map(rule => [rule.d.id, v.parse(transitionSpot, rule.spot)]));
      const at = (row: NativeQuestRule<Spot>) => {
        const position = positions.get(row.d.id); if (position === undefined) throw new Error('Missing native transition position'); return position;
      };
      return bindInteractionTransitions(selected, host.flags, { rowLimit: rows.rowLimit, flagLimit: rows.flagLimit, touch: rows.touch,
        commit: id => { if (graph === null) throw new Error('Native quest graph is not installed'); return graph.run(id); },
        item: (id, n) => { pack.add(id, n); },
        ...(rows.plate === undefined ? {} : { plate: (row: NativeQuestRule<Spot>, size: number) => plateOverlap(host.physics, at(row), at(row).yaw, size, rows.plate) }),
        touched: row => {
          const position = at(row), feet = host.player.position, pickup = rows.pickup;
          if (pickup === 'walk-in') return walkInPickup(host.physics, feet, position);
          const dx = feet.x - position.x, dz = feet.z - position.z;
          return dx * dx + dz * dz < pickup.radius * pickup.radius && Math.abs(feet.y - position.y) < pickup.height;
        },
      });
    },
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
      graph = installDeclaredQuestHost(host, source, { ...owners, spots: owners.spots ?? { interact: [], crack: [] },
        commands: input.scripts, fact: input.ledger.fact, coins: input.ledger.coins });
      return graph;
    } };
}

import type { Scope } from '@wildshard/engine/app/scope';
import type { TabId as BagTabId, TabSpec as BagTabSpec, TabFragment as BagFragment } from '@wildshard/engine/ui/tabs';
import { registerItemRow } from '../bag/itemCatalog';
import { registerAchievements, type AchievementDef } from '../achievements';
import { registerCompendium } from '../compendium/registry';
import type { ShardCompendium } from '../compendium/types';
import type { ShardRuntime } from './runtime';
import { normalizeItemRow, type ItemRow } from '../bag/items';
import type { ContentRow, EngineRows, LevelContext } from '@wildshard/engine/level/context';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import type { ShardManifest } from './manifest';
import type { PageResidency } from '../grid/pageResidency';

export interface BagVerbs { tab: (spec: BagTabSpec) => void; fragment: (tab: BagTabId, fragment: BagFragment) => void }
export interface GameRowMap { item: ItemRow; lootTable: ContentRow; skin: SkinDef; feat: AchievementDef; shop: ContentRow; compendium: ShardCompendium & { id: string }; places: ContentRow }
export type GameRows = { [K in keyof GameRowMap]: (value: GameRowMap[K] | readonly GameRowMap[K][]) => void };
export interface GameServices {
  /** The composition root's pre-bootstrap residency owner, shared with trusted hybrid data and the grid. */
  readonly residency?: PageResidency;
  readonly runtime?: ShardRuntime;
  readonly shard: ShardManifest;
  readonly rows: Map<keyof GameRowMap, Map<string, ContentRow>>;
  readonly bag: {
    tab: (spec: BagTabSpec) => () => void;
    fragment: (tab: BagTabId, fragment: BagFragment) => () => void;
  };
}
export interface ShardContext extends LevelContext {
  /** Retained home runtimes install transient services here; each entered scope releases them on leave. */
  readonly whileEntered?: (install: (scope: Scope) => void) => void;
  /** the shard's own manifest */
  readonly manifest: ShardManifest;
  /** the game's services: progress, inventory, loot, the compendium, travel */
  readonly game: GameServices;
  /** the Bag's verbs: tabs, fragments and finds a shard adds */
  readonly bag: BagVerbs;
  /** the engine's rows plus the game's (items, feats, quests …), for the shard's life */
  readonly rows: EngineRows & GameRows;
}

export function shardContext(ctx: LevelContext, manifest: ShardManifest, game: GameServices): ShardContext {
  const live = (): void => { if (ctx.scope.disposed) throw new Error('The shard scope is disposed'); };
  const add = <K extends keyof GameRowMap>(kind: K, values: GameRowMap[K] | readonly GameRowMap[K][]): void => {
    ctx.app.levelRegistrations.assertKit(ctx.scope);
    const list: readonly GameRowMap[K][] = Array.isArray(values) ? values : [values as GameRowMap[K]];
    const rows = game.rows.get(kind) ?? new Map<string, ContentRow>();
    const ids = new Set<string>();
    for (const value of list) {
      if (rows.has(value.id) || ids.has(value.id)) throw new Error(`Duplicate ${kind} row: ${value.id}`);
      ids.add(value.id);
    }
    game.rows.set(kind, rows);
    for (const value of list) {
      rows.set(value.id, kind === 'item' ? normalizeItemRow(value) : value);
      ctx.scope.onDispose(() => { rows.delete(value.id); if (rows.size === 0) game.rows.delete(kind); });
    }
  };
  // Retain progress as a getter: its stage changes while the same context serves all hooks.
  return {
    ...ctx, get progress() { return ctx.progress; }, manifest, game,
    bag: {
      tab: (spec) => { live(); ctx.scope.onDispose(game.bag.tab(spec)); },
      fragment: (tab, fragment) => { live(); ctx.scope.onDispose(game.bag.fragment(tab, fragment)); },
    },
    rows: { ...ctx.rows,
      item: (values) => { add('item', values); const list: readonly ItemRow[] = Array.isArray(values) ? values : [values as ItemRow]; for (const value of list) ctx.scope.onDispose(registerItemRow(value)); }, lootTable: (values) => add('lootTable', values),
      skin: (values) => add('skin', values), feat: (values) => { add('feat', values); ctx.scope.onDispose(registerAchievements(manifest.slug, [...(game.rows.get('feat')?.values() ?? [])] as AchievementDef[])); },
      shop: (values) => add('shop', values), compendium: (values) => { add('compendium', values); const list: readonly (ShardCompendium & { id: string })[] = Array.isArray(values) ? values : [values as ShardCompendium & { id: string }]; for (const value of list) ctx.scope.onDispose(registerCompendium(value)); }, places: (values) => add('places', values),
    },
  };
}

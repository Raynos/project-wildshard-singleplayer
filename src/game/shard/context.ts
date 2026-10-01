import type { ShardRuntime } from './runtime';
import { normalizeItemRow, type ItemRow } from '../bag/items';
import type { ContentRow, SkinDef, EngineRows, LevelContext } from '#engine';
import type { ShardManifest } from './manifest';

export type BagTabId = 'map' | 'gear' | 'pack' | 'finds' | 'feats';
export interface BagTabSpec { id: BagTabId; title: string }
export interface BagFragment { id: string; render: (host: HTMLElement) => void }
export interface BagVerbs { tab: (spec: BagTabSpec) => void; fragment: (tab: BagTabId, fragment: BagFragment) => void }
export interface GameRowMap { item: ItemRow; lootTable: ContentRow; skin: SkinDef; feat: ContentRow; shop: ContentRow; compendium: ContentRow; places: ContentRow }
export type GameRows = { [K in keyof GameRowMap]: (value: GameRowMap[K] | readonly GameRowMap[K][]) => void };
export interface GameServices {
  readonly runtime?: ShardRuntime;
  readonly shard: ShardManifest;
  readonly rows: Map<keyof GameRowMap, Map<string, ContentRow>>;
  readonly bag: {
    tab: (spec: BagTabSpec) => () => void;
    fragment: (tab: BagTabId, fragment: BagFragment) => () => void;
  };
}
export interface ShardContext extends LevelContext {
  readonly manifest: ShardManifest;
  readonly game: GameServices;
  readonly bag: BagVerbs;
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
      item: (values) => add('item', values), lootTable: (values) => add('lootTable', values),
      skin: (values) => add('skin', values), feat: (values) => add('feat', values),
      shop: (values) => add('shop', values), compendium: (values) => add('compendium', values), places: (values) => add('places', values),
    },
  };
}

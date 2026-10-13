import * as v from "valibot";
import type { HomeResidencyClaim, PageResidency } from '../grid/pageResidency';
import { currentPageMode } from '../grid/pageMode';
import type { ShardManifest } from '../shard/manifest';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { TabId as BagTabId, TabSpec as BagTabSpec, TabFragment as BagFragment } from '@wildshard/engine/ui/tabs';
import { registerItemRow } from '../bag/itemCatalog';
import { registerAchievements, type AchievementDef } from '../achievements';
import { registerCompendium } from '../compendium/registry';
import type { ShardCompendium } from '../compendium/types';
import type { ShardRuntime } from '../shard/runtime';
import { normalizeItemRow, type ItemRow } from '../bag/items';
import type { ContentRow, EngineRows, LevelContext } from '@wildshard/engine/level/context';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import type { AudioData } from '@wildshard/format/audio';
import { RuntimeSchema, type RuntimeDeclaration } from '@wildshard/format/runtime';
import { parseShardSlug } from '../shard/slug';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { stillImageUrl } from '../shardfile/stillImage';
import { presentationCard } from '../shardfile/presentation';


/** The page's chosen entry mode. */
export type PageMode = 'grid' | 'shard';
/** A grid cell by its stable catalogue instance id (SF14: `driftwood-isle`, `template-1` …; never the cell coordinates). */
export interface GridCellRef { readonly instance: string; readonly slug: string }
/**
 * The seam for inside-cell enter / leave notifications (SF46's hybrid runtime activation consumes them; the grid client
 * produces them). Today's home-cell boot enters its one cell at boot and never leaves it; the grid client calls
 * `enter` / `leave` as the player's frame crosses cell interiors. A late subscriber hears `enter` for the current cell.
 */
export class GridCellEvents {
  private current: GridCellRef | null = null;
  private readonly entered = new Set<(cell: GridCellRef) => void>();
  private readonly left = new Set<(cell: GridCellRef) => void>();
  /** the cell interior the player is in now (null on a strip, the highway, or outside the grid) */
  get cell(): GridCellRef | null { return this.current; }
  /** producer: the player entered a cell interior (leaving the previous one first) */
  enter(cell: GridCellRef): void {
    if (this.current?.instance === cell.instance) return;
    if (this.current !== null) this.leave();
    this.current = cell;
    for (const fn of this.entered) fn(cell);
  }
  /** producer: the player left the current cell interior */
  leave(): void {
    const was = this.current;
    if (was === null) return;
    this.current = null;
    for (const fn of this.left) fn(was);
  }
  /** consumer: returns the unsubscribe */
  onEnter(fn: (cell: GridCellRef) => void): () => void {
    this.entered.add(fn);
    if (this.current !== null) fn(this.current);
    return () => { this.entered.delete(fn); };
  }
  onLeave(fn: (cell: GridCellRef) => void): () => void { this.left.add(fn); return () => { this.left.delete(fn); }; }
}
/** this page's cell events (grid mode only ever enters cells) */
export const gridCells = new GridCellEvents();

/** The home cell's restored simulation as its client hands it over (sp-x5's `onSimulation`, SF15a): the existing driver's gate and its durable save. */
export interface GridHomeSimulation { readonly setActive: (active: boolean) => void; readonly checkpoint: () => boolean; readonly disposed: () => boolean; readonly residency?: HomeResidencyClaim; readonly suppressCheckpoint?: () => void }
/**
 * The seam between the home cell's client (its shardfile simulation, when one runs: Driftwood's hybrid boot) and the live
 * grid owner. The client offers its handoff once; the grid's live session takes it and gates the existing home driver
 * while the traveller is in another region (the freeze fence). A late taker hears the current offer.
 */
export class GridHomeHandoff {
  private current: GridHomeSimulation | null = null;
  private readonly takers = new Set<(sim: GridHomeSimulation) => void>();
  get simulation(): GridHomeSimulation | null { return this.current !== null && !this.current.disposed() ? this.current : null; }
  private expected = false;
  /** the home client announces a handoff on its way (a hybrid home in a grid page), so the entry reveal waits for it (G98) */
  expect(): void { this.expected = true; }
  /** true while an announced handoff has not arrived (the reveal's third wait; false when none was announced) */
  get pending(): boolean { return this.expected && this.current === null; }
  offer(sim: GridHomeSimulation): void { this.current = sim; for (const fn of this.takers) fn(sim); }
  take(fn: (sim: GridHomeSimulation) => void): () => void {
    this.takers.add(fn);
    const now = this.simulation; if (now !== null) fn(now);
    return () => { this.takers.delete(fn); };
  }
}
/** this page's home handoff (only a grid page's home client offers one) */
export const gridHomeSim = new GridHomeHandoff();

/** this page's mode, decided once at boot (held in the leaf grid/pageMode.ts) */
export function pageMode(): PageMode { return currentPageMode(); }
/** the catalogue instance this grid page booted into (null in shard mode) */
export function pageGridInstance(): string | null { return currentPageMode() === 'grid' ? gridCells.cell?.instance ?? null : null; }
/** Scoped bag registration verbs supplied to trusted plugins. */
export interface BagVerbs { tab: (spec: BagTabSpec) => void; fragment: (tab: BagTabId, fragment: BagFragment) => void }
/** Content rows a trusted plugin may register through its owned context. */
export interface GameRowMap { item: ItemRow; lootTable: ContentRow; skin: SkinDef; feat: AchievementDef; shop: ContentRow; compendium: ShardCompendium & { id: string }; places: ContentRow }
/** Typed registration verbs for game content rows. */
export type GameRows = { [K in keyof GameRowMap]: (value: GameRowMap[K] | readonly GameRowMap[K][]) => void };
/** Game services provided by the composition root, scoped to one shard. */
export interface GameServices {
  /** The composition root's pre-bootstrap residency owner, shared with trusted hybrid data and the grid. */
  readonly residency?: PageResidency;
  readonly runtime?: ShardRuntime;
  /** The admitted emitted audio rows for this runtime's own resident; absent for legacy-only entries. */
  readonly declaredAudio?: AudioData;
  readonly shard: ShardManifest;
  readonly rows: Map<keyof GameRowMap, Map<string, ContentRow>>;
  readonly bag: {
    tab: (spec: BagTabSpec) => () => void;
    fragment: (tab: BagTabId, fragment: BagFragment) => () => void;
  };
}
/** A trusted plugin's owned engine and game context. */
export interface ShardContext extends LevelContext {
  /** the shard's own manifest */
  readonly manifest: ShardManifest;
  /** the game's services: progress, inventory, loot, the compendium, travel */
  readonly game: GameServices;
  /** the Bag's verbs: tabs, fragments and finds a shard adds */
  readonly bag: BagVerbs;
  /** the engine's rows plus the game's (items, feats, quests …), for the shard's life */
  readonly rows: EngineRows & GameRows;
  /**
   * G99: the shard's cube while it runs as a grid cell (home or neighbour): every shard is a 500 × 500 × 500 cube, so
   * nothing it draws may stand past `half` metres from its centre in x or z (the road and the neighbours are there).
   * `null` standalone, where the shard keeps its own horizon. A shard reads it to leave out or clip its out-of-cube
   * dressing (a skirt, backdrop props); the platform already drops the level's horizon rings and cloud sea in the grid.
   */
  readonly cube: ShardCube | null;
}
/** A grid cell's extent in shard-local metres (G99): the cube's half width, its centre at the shard's origin. */
export interface ShardCube { readonly half: number }
const GRID_CUBE: ShardCube = Object.freeze({ half: CHUNK_HALF });

/** Construct the owned game context without installing services at import time. */
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
    ...ctx, get progress() { return ctx.progress; }, manifest, game, cube: pageMode() === 'grid' ? GRID_CUBE : null,
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

/** Read the current counted world-step sink through the defining game context port. */
export function buildProgress(context: Pick<ShardContext, 'progress'>): ShardContext['progress'] { return context.progress; }


/** Trusted composition-root binding; the declaration can select only the entry belonging to the same shard. */
export interface TrustedRuntimeEntry {
  readonly slug: string;
  readonly entry: string;
  readonly load: () => Promise<{ default: new () => ShardPlugin }>;
}
/** Resolve only explicitly registered first-party code. Neighbour preparation may import it without running hooks. */
export async function prepareTrustedRuntime(declaration: RuntimeDeclaration, slug: string, firstParty: boolean,
  entries: readonly TrustedRuntimeEntry[]): Promise<new () => ShardPlugin> {
  const parsed = v.parse(RuntimeSchema, declaration);
  if (!firstParty) throw new Error('Custom runtime requires a trusted first-party shard');
  const registered = new Map<string, TrustedRuntimeEntry[]>();
  for (const entry of entries) { const group = registered.get(entry.slug) ?? []; group.push(entry); registered.set(entry.slug, group); }
  const matches = (registered.get(slug) ?? []).filter((entry) => entry.entry === parsed.entry);
  if (matches.length !== 1) throw new Error('Runtime entry must have exactly one matching trusted shard binding');
  const match = matches[0];
  if (match === undefined) throw new Error('Missing trusted runtime entry');
  return (await match.load()).default;
}

/** Pure catalogue/level mapping from parsed data and already admitted immutable image bytes.
 * No fetch, browser decode, world allocation or service installation occurs here. Absent presentation keeps the empty card.
 * The caller owns asset admission and the library lease; the returned hooks enter the ordinary session later. */
export function sourceManifest(source: Pick<Shardfile, 'identity' | 'accent' | 'spawn' | 'look' | 'presentation' | 'map'> & Partial<Pick<Shardfile, 'navigation'>>, assets: ReadonlyMap<string, Uint8Array> = new Map()): ShardManifest {
  const presentation = source.presentation;
  const navigation = source.navigation === null || source.navigation === undefined ? undefined : assets.get(source.navigation.file);
  if (source.navigation !== null && source.navigation !== undefined && navigation === undefined) throw new Error('Navigation is missing admitted bytes');
  const map = source.map === undefined ? undefined : assets.get(source.map.image);
  if (source.map !== undefined && map === undefined) throw new Error('Map image is missing admitted bytes');
  const card = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
  return {
    ...(source.navigation === null || source.navigation === undefined || navigation === undefined ? {} : { navigation: { row: source.navigation, bytes: navigation } }),
    api: 1, accent: source.accent, slug: parseShardSlug(source.identity.slug), name: source.identity.name, seed: source.identity.seed,
    order: 0, status: 'live', label: '(0, 0)', biome: presentation?.biome ?? 'Empty world', blurb: presentation?.blurb ?? 'An empty shardfile world.',
    card: presentation === undefined ? { thumb: card, portrait: card, landscape: card } : presentationCard(presentation, assets), style: 'greybox', kitLook: 'toon', hands: 'toon', weapon: 'custom',
    treeCount: 0, trees: { factory: 'none', noun: 'trees' }, ground: { structures: true, paths: 'plugin' }, horizon: { rings: [], cloudSea: false },
    spawn: { ...source.spawn }, spawns: [], species: [], uses: [], boundary: { visible: false },
    sky: { sunColor: [1, 1, 1], sunIntensity: 1, envIntensity: 0.5, bgIntensity: 1, fogSunColor: [1, 1, 1], cloudSunColor: [1, 1, 1], hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
    atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 1, 1] },
    grade: { saturation: source.look.grade.saturation - 1, brightness: 0, contrast: source.look.grade.contrast - 1, bloomIntensity: 0, bloomThreshold: 1, shadowTint: [1, 1, 1], highTint: [1, 1, 1], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
    budgets: {}, fight: {}, loadout: { weapons: [], tools: [], start: [] }, minimap: map === undefined ? {} : { image: stillImageUrl(map) },
    render: async () => source.look.keys.length === 0 ? (await import('../shardfile/emptyLook')).emptyLook(source.look.dayOverride) : (await import('../shardfile/look')).shardfileLook(source.look), tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
    audio: { ambience: 'none', score: 'none' },
    boot: { files: () => [], sources: () => ({ sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [] }), viewmodelSets: [], audio: () => Promise.resolve([]), precache: [] },
    // A plugin source enters the ordinary staged LevelLoader, even with no authored hooks.
    load: async () => { const { EmptyEquipment } = await import('../shardfile/emptyEquipment'); return { default: class {
      kit(ctx: ShardContext): void {
        const runtime = ctx.game.runtime;
        if (runtime === undefined) throw new Error('Shardfile source requires the session host');
        runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), secondary: null, rifle: null });
      }
    } }; },
  };
}

/** Staged trusted plugin hooks; invoked only by the owning session. */
export abstract class ShardPlugin {
  world?(ctx: ShardContext): Promise<void> | void;
  kit?(ctx: ShardContext): Promise<void> | void;
  play?(ctx: ShardContext): Promise<void> | void;
}

/** Standalone admission factory; caller-owned data and native constructors retain their original staged hook order.
 * The instance chooses its entry once in world(), then kit/play reuse that same composite. No service runs on import.
 * Optional constructor ports preserve existing LEGACY and SHARDFILE test/host injection without a second boot. */
export function standaloneHybridEntry(Native: new () => ShardPlugin, admitDefault: (ctx: ShardContext) => Promise<ShardPlugin>,
  shardfileDefault: (ctx: ShardContext) => boolean, name: string): new (
    Legacy?: new () => ShardPlugin, admit?: (ctx: ShardContext) => Promise<ShardPlugin>,
    shardfile?: (ctx: ShardContext) => boolean,
  ) => Required<ShardPlugin> {
  return class extends ShardPlugin {
    private composite: ShardPlugin | undefined;
    private readonly Legacy: new () => ShardPlugin;
    private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin>;
    private readonly shardfile: (ctx: ShardContext) => boolean;
    constructor(Legacy: new () => ShardPlugin = Native,
      admit: (ctx: ShardContext) => Promise<ShardPlugin> = admitDefault,
      shardfile: (ctx: ShardContext) => boolean = shardfileDefault) {
      super(); this.Legacy = Legacy; this.admit = admit; this.shardfile = shardfile;
    }
    override async world(ctx: ShardContext): Promise<void> {
      this.composite = this.shardfile(ctx) ? await this.admit(ctx) : new this.Legacy();
      await this.composite.world?.(ctx);
    }
    override async kit(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error(`${name} hybrid world is not admitted`);
      await this.composite.kit?.(ctx);
    }
    override async play(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error(`${name} hybrid world is not admitted`);
      await this.composite.play?.(ctx);
    }
  };
}

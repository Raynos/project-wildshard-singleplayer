import { GridAssembly, type GridCell } from "../grid/assembly";
import { pageGridIntents } from "../grid/intent";
import { gridMode, type MenuMode } from "../grid/menu";
import { devserverCellOn } from "../grid/debug";
import { findShard } from "../shard/registry";
import { chooseShardEntry } from "../shard/entryMode";
import { travel } from "../travel/travel";
import { type HomeResidencyClaim, PageResidency } from "../grid/pageResidency";
import { gridRecovery, recoveryCatalogue, type GridRecoveryRecord } from "../grid/recovery";
import { app } from "@wildshard/engine/app/runtime";
import { currentPageMode, setPageMode } from "../grid/pageMode";
import type { SaveStore } from "@wildshard/engine/saves/store";
import type { ShardManifest } from "../shard/manifest";
import { runtimeAccountedBytes } from "@wildshard/format/runtimeCost";
import { ResidencyAllocator } from "../grid/allocator";
import { MemoryAdmission } from "@wildshard/format/product";
import { isDev } from "@wildshard/engine/core/devMode";
import { contentCost } from "@wildshard/format/contentCost";
import { CONTENT_CAPS, CHUNK_HALF } from "@wildshard/engine/core/config";
import type { TabId as BagTabId, TabSpec as BagTabSpec, TabFragment as BagFragment } from "@wildshard/engine/ui/tabs";
import { registerItemRow } from "../bag/itemCatalog";
import { registerAchievements, type AchievementDef } from "../achievements";
import { registerCompendium } from "../compendium/registry";
import type { ShardCompendium } from "../compendium/types";
import type { ShardRuntime } from "../shard/runtime";
import { normalizeItemRow, type ItemRow } from "../bag/items";
import type { ContentRow, EngineRows, LevelContext } from "@wildshard/engine/level/context";
import type { SkinDef } from "@wildshard/engine/player/Skins";

/**
 * Infinite Wildshard's way in (SF21a). The catalogue's home cell boots through the normal shard flow as page mode
 * `'grid'`; its live grid session borrows that world and transfers the traveller between admitted frames. A title tap
 * or a validated recovery record selects the home before normal memory admission and descriptor hydration.
 *
 *   title tap  → enterGrid()               the one-shot intent, then a fresh document for the home cell
 *   boot       → bootPageMode(slug)         consumes the tap or uses validated recovery; the URL drops to the bare title
 *                                           URL, so an unrecorded reload (or an iOS kill's restart) lands on the title
 *   alive beat → pageMode()                 AliveInfo.mode, so the title can say the grid ended unexpectedly
 */
export type PageMode = 'grid' | 'shard';

/** the home cell of the grid this device would assemble now (Developer, DEVSERVER and its Debug row apply at grid start) */
export function gridHome(mode?: MenuMode): GridCell {
  const assembly = new GridAssembly(gridMode(devserverCellOn(), mode));
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('The grid catalogue has no home cell at (0, 0)');
  return home;
}

/** The title's Infinite Wildshard tap: write the one-shot intent, then open the home cell in a fresh document. */
export function enterGrid(): void {
  // A deliberate new player attempt starts a new guard window; automatic reloads cannot clear it.
  if (!gridRecovery(app.saves).clearLoop()) throw new Error('Grid recovery guard could not be cleared');
  clearGridRecovery();
  const home = gridHome();
  const target = findShard(home.slug);
  if (target === undefined) throw new Error(`The grid's home cell names no shard: ${home.slug}`);
  // INFINITE WILDSHARD enters the catalogue home, never SHARD SELECT's frozen LEGACY copy.
  chooseShardEntry(target.slug, 'shardfile');
  pageGridIntents().set({ instance: home.instance, slug: target.slug });
  travel({ to: target.slug, mode: 'enter' });
}

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

/** The boot's one read of the tap intent (used or not), overridden by validated recovery before ordinary admission.
 * In grid mode the address becomes the bare title URL, preventing an unrecorded automatic restart. */
export function bootPageMode(slug: string): PageMode {
  let intent = null;
  try { intent = pageGridIntents().consume(slug); } catch { /* blocked storage: no intent, the normal shard flow */ }
  const recovery = pageGridRecovery();
  if (recovery !== null && [slug].includes(recovery.slug)) intent = { instance: recovery.instance, slug: recovery.slug, at: recovery.at };
  const mode: PageMode = intent === null ? 'shard' : 'grid';
  setPageMode(mode);
  if (intent !== null) gridCells.enter({ instance: intent.instance, slug: intent.slug }); // the home cell: the page starts inside it
  if (mode === 'grid' && typeof history !== 'undefined') {
    try { history.replaceState(history.state, '', new URL(location.pathname, location.origin)); } catch { /* a sandboxed frame: the URL stays */ }
  }
  return mode;
}

/** the catalogue instance this grid page booted into (null in shard mode) */
export function pageGridInstance(): string | null { return currentPageMode() === 'grid' ? gridCells.cell?.instance ?? null : null; }

/** The title page's boot: a stale intent is consumed and dropped, never kept for a later page. */
export function dropGridIntent(): void {
  try { pageGridIntents().consume(''); } catch { /* nothing to drop */ }
}

/** Page-local selection is installed explicitly by the composition root, never by importing this module. */
let selected: NonNullable<GridRecoveryRecord> | null = null;
let refused = false;
let loop = false;

/** A validated current catalogue's default home and road lane, used when recovery metadata is unsafe. */
export function safeGridRecovery(assembly: GridAssembly, now: number): NonNullable<GridRecoveryRecord> {
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('Recovery catalogue requires a home cell');
  return { instance: home.instance, slug: home.slug, catalogue: recoveryCatalogue(assembly), at: now, reason: 'gpu',
    road: { x: home.origin.x + assembly.pitch / 2 + 3.6, z: home.origin.z, yaw: 0 } };
}

/** Consume recovery metadata before routing/hydration; ordinary boot and unsupported future records select nothing. */
export function consumeGridRecovery(options: { assembly?: GridAssembly; saves?: SaveStore; now?: () => number; unexpected?: boolean } = {}): NonNullable<GridRecoveryRecord> | null {
  const assembly = options.assembly ?? new GridAssembly(gridMode(devserverCellOn()));
  const now = options.now ?? Date.now;
  const result = gridRecovery(options.saves ?? app.saves, now).consume(assembly, options.unexpected);
  loop = result.kind === 'loop';
  refused = result.kind === 'refused' || loop;
  selected = result.kind === 'resume' ? result.record : result.kind === 'fallback' ? safeGridRecovery(assembly, now()) : null;
  return selected;
}

/** Same-document handoff to ordinary admission and the live road placement; progress is read from real saves. */
export function pageGridRecovery(): NonNullable<GridRecoveryRecord> | null { return selected; }
/** A failed recovery boot returns to the title and must not supply a selection to another boot. */
export function clearGridRecovery(): void { selected = null; refused = false; loop = false; }
/** Future or unconsumed metadata cannot enter a renderer on this boot. */
export function gridRecoveryRefused(): boolean { return refused; }
/** A repeated failing recovery opens the existing shard picker, never another automatic boot. */
export function gridRecoveryLoop(): boolean { return loop; }

/** The composition root passes this selection to hydration and startSession; its grid intent has already been consumed. */
export interface PageResidencyBoot {
  readonly mode: PageMode;
  readonly instance: string | null;
  readonly residency?: PageResidency;
  /** G216: one trusted page policy also reaches data-only SHARD SELECT validation and its warning surface. */
  readonly memory: MemoryAdmission;
  /** Validated recovery uses the ordinary owner, then returns to the road. */
  readonly recovery?: NonNullable<GridRecoveryRecord>;
}

/**
 * G144's single grid boot seam. Call before descriptor hydration and any world construction. Opaque homes must supply
 * reviewed measurements here, since their hybrid data hook runs after bootstrap. Data homes are admitted by the loader
 * against their declared sim cost, then their actual library and tile claims. The root disposes failed hydration; the
 * successful session installs the owner's level lifetime.
 */
export function preparePageResidency(manifest: Pick<ShardManifest, 'slug' | 'shardfile' | 'runtimeCost'>, configuredSlug?: string, memory = new MemoryAdmission(isDev)): PageResidencyBoot {
  const mode = bootPageMode(configuredSlug ?? manifest.slug);
  const measuredHome = configuredSlug === undefined && manifest.shardfile === undefined;
  if (mode !== 'grid' && (!measuredHome || manifest.runtimeCost === undefined)) return { mode, instance: null, memory };
  const instance = mode === 'grid' ? pageGridInstance() : manifest.slug;
  if (instance === null) throw new Error('Grid residency requires the consumed home instance');
  const residency = new PageResidency(new ResidencyAllocator({ memory }));
  try {
    if (measuredHome) {
      if (manifest.runtimeCost === undefined) throw new Error('Grid runtime home requires reviewed memory measurements before bootstrap');
      const bytes = runtimeAccountedBytes(manifest.runtimeCost), row = manifest.runtimeCost;
      const cost = contentCost({ l0: 0, l1: 0, far: 0, libraries: 0, sims: bytes, commons: 0, overlap: CONTENT_CAPS.overlap });
      if (!memory.accept({ stage: 'runtime', owner: instance, id: `sim:${instance}`, claimedBytes: bytes,
        accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading,
        measured: { webContentBytes: Math.ceil(row.webContentMB * 1_000_000), glBytes: Math.ceil(row.glMB * 1_000_000), engineBaseBytes: Math.ceil(row.engineBaseMB * 1_000_000),
          ...(row.residentBaseMB === undefined ? {} : { residentBaseBytes: Math.ceil(row.residentBaseMB * 1_000_000) }),
          rev: row.rev, device: row.device, evidence: row.evidence } })) throw new Error('Home residency admission deferred by the shared budget');
      // A matched increment subtracts the persistent composer; it cannot cover that page component again.
      residency.admitHome(instance, bytes, row.residentBaseMB === undefined);
    }
    const recovery = mode === 'grid' ? pageGridRecovery() : null;
    return { mode, instance, residency, memory, ...(recovery === null ? {} : { recovery }) };
  } catch (error) { residency.dispose(); throw error; }
}

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

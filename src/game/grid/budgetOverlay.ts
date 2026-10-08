/**
 * The points budget overlay (SHARD-PLATFORM SF38, G30): Developer mode only, grid pages only. One line under the top bar,
 * in plain words ("MEMORY · ALL LOADED 2331 / 1000 MB (233%) · PINE HOLLOW 749% OF BUDGET · 3 SHARDS OK · SHARED 113 MB"), scores the crossroads against the 1.0 GB playing cap and each shard (and the road) against its §3.2 budget, green /
 * amber / red; a tap expands the raw bytes per category (library, L0 / L1 tiles, sim, road, far, commons, product and the
 * overlap allowance), each shard's tiles and the heaviest tiles. The numbers are `budgetPoints.ts` over the one live
 * residency allocator (SF18b / G144), read once a second, never per frame.
 *
 * Costs nothing when off: no element and no timer exist until the Developer switch is on; switching it off stops the
 * timer and hides the strip. Text is authored with `textContent` only. Players never see it (no URL switch, E162).
 */
import type { Scope } from '@wildshard/engine/app/scope';
import { isDev, onDev } from '@wildshard/engine/core/devMode';
import { mountUi } from '@wildshard/engine/ui/ownership';
import { memoryAttribution, type MemorySnapshot } from '@wildshard/engine/core/memoryAttribution';
import type { ResidencyAllocator } from './allocator';
import { BUDGET_CATEGORIES, megabytes, PLATFORM_OWNER, readBudgetPoints, type BudgetCategory, type BudgetPoints, type BudgetShard, type PointsTone } from './budgetPoints';
import { memoryRows, type MemoryGrouping, type MemorySort } from './memoryRows';
import './budgetOverlay.css';

/** Developer tooling text (not player-facing; never localized). */
const TEXT = {
  title: 'MEMORY', ok: 'SHARDS OK', platform: 'SHARED', crossroads: 'ALL LOADED', budget: 'OF BUDGET', loading: 'LOAD', road: 'ROAD', tiles: 'TILES', worst: 'WORST', measured: 'MEASURED',
  category: { library: 'LIBRARY', l0: 'L0 TILES', l1: 'L1 TILES', sim: 'SIM', road: 'ROAD', far: 'FAR', commons: 'COMMONS', product: 'PRODUCT' } satisfies Record<BudgetCategory, string>,
  overlap: 'OVERLAP', base: 'ENGINE BASE', factor: 'RESIDENT ×', accounted: 'ACCOUNTED', playing: 'PLAYING',
} as const;
/** How often the strip re-reads the allocator while it shows. */
export const BUDGET_REFRESH_MS = 1000;
/** How many of the heaviest tiles the expanded view lists. */
const WORST_TILES = 6;

export interface BudgetOverlayHost {
  readonly scope: Scope;
  readonly hudRoot: HTMLElement;
  readonly allocator: Pick<ResidencyAllocator, 'entries' | 'cost'>;
  /** an owner (a cell instance) to its shard's display name; the platform is the road */
  readonly name: (owner: string) => string;
  /** the owner's reviewed standalone measurement (MB), when its shard has one */
  readonly measuredMB?: (owner: string) => number | null;
  /** whether an owner is a shard with a budget (a cell instance); others are page-wide (the road, the platform's sims) */
  readonly shard?: (owner: string) => boolean;
  /** Existing allocation identities, not another admission ledger. Null native readings remain unavailable. */
  readonly memory?: () => MemorySnapshot;
}
export interface BudgetOverlay {
  /** the last scored table (null until Developer mode first shows the strip) */
  readonly state: () => BudgetPoints | null;
  /** re-read the allocator now (the timer does this every {@link BUDGET_REFRESH_MS}) */
  readonly refresh: () => void;
  /** expand or collapse the raw numbers (the tap) */
  readonly toggle: () => void;
}

const MB = (bytes: number): string => `${megabytes(bytes)} MB`;
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
/** A `data-*` attribute: the tone for the stylesheet, raw bytes for tests and captures. */
function data(node: HTMLElement, name: string, value: string | number): void { node.setAttribute(`data-${name}`, String(value)); }
function scored(className: string, text: string, tone: PointsTone | null): HTMLElement {
  const node = el('span', className, text); data(node, 'tone', tone ?? 'none'); return node;
}
function row(label: string, value: string, tone: PointsTone | null = null): HTMLElement {
  const line = el('div', 'ws-grid-budget-row'); data(line, 'tone', tone ?? 'none');
  line.append(el('span', 'ws-grid-budget-k', label), el('span', 'ws-grid-budget-v', value));
  return line;
}

/** Install the overlay on a grid page; everything leaves with the scope. */
export function installBudgetOverlay(host: BudgetOverlayHost): BudgetOverlay {
  const { scope } = host;
  let root: HTMLElement | null = null, bar: HTMLElement | null = null, detail: HTMLElement | null = null;
  let timer: ReturnType<typeof setInterval> | 0 = 0, expanded = false, last: BudgetPoints | null = null, signature = '';
  let group: MemoryGrouping = 'owner', sort: MemorySort = 'total';
  let allocationScope: Scope | null = null;
  const label = (owner: string): string => (owner === PLATFORM_OWNER ? TEXT.road : host.name(owner));

  const memorySection = (snapshot: MemorySnapshot): HTMLElement => {
    allocationScope?.dispose();
    const entered = scope.child('ui.budget-memory'); allocationScope = entered;
    const sec = el('section', 'ws-grid-budget-sec'); data(sec, 'memory', 'observed');
    sec.append(el('h4', 'ws-grid-budget-h', 'GPU / RAM · OBSERVED STORAGE'),
      row('GPU', MB(snapshot.totals.gpu)), row('RAM STORAGE / CAPACITY', MB(snapshot.totals.ram)),
      row('UNATTRIBUTED GPU', MB(snapshot.unattributed.gpu)), row('UNATTRIBUTED RAM STORAGE', MB(snapshot.unattributed.ram)));
    const measured = snapshot.measured;
    sec.append(row('NATIVE WC + LABELLED GL', measured === null ? 'NOT SAMPLED' : MB(measured.webContentBytes + measured.labelledGpuBytes),
      measured !== null && measured.webContentBytes + measured.labelledGpuBytes > 1e9 ? 'red' : null));
    if (measured !== null) sec.append(el('p', 'ws-grid-budget-memory-note', `${new Date(measured.sampledAt).toISOString()} · ${measured.source}`));
    sec.append(el('p', 'ws-grid-budget-memory-note', 'GPU is allocated storage. RAM is live storage / capacity, not physical footprint. Neither is added to WebContent. Native unobserved RAM remains unknown.'));
    const controls = el('div', 'ws-grid-budget-tools');
    const pick = (name: string, choices: readonly (readonly [string, string])[], value: string, changed: (value: string) => void): void => {
      const select = document.createElement('select'); select.className = 'ws-grid-budget-choice'; select.setAttribute('aria-label', name);
      for (const [key, title] of choices) { const option = document.createElement('option'); option.value = key; option.textContent = title; select.append(option); }
      select.value = value; entered.listen(select, 'change', () => { changed(select.value); signature = ''; refresh(); }); controls.append(select);
    };
    pick('Group allocations', [['owner', 'BY OWNER'], ['asset', 'BY OWNER + ASSET']], group, value => { group = value === 'asset' ? 'asset' : 'owner'; });
    pick('Sort allocations', [['total', 'TOTAL'], ['gpu', 'GPU'], ['ram', 'RAM'], ['name', 'NAME']], sort, value => {
      sort = value === 'gpu' || value === 'ram' || value === 'name' ? value : 'total';
    });
    sec.append(controls);
    const projection = memoryRows(snapshot, group, sort);
    for (const allocation of projection.rows) {
      const line = row(allocation.asset.length === 0 ? allocation.owner : `${allocation.owner}\n${allocation.asset}`, `GPU ${MB(allocation.gpu)} · RAM ${MB(allocation.ram)}`);
      line.classList.add('ws-grid-budget-allocation');
      data(line, 'memory-owner', allocation.owner); data(line, 'gpu-bytes', allocation.gpu); data(line, 'ram-bytes', allocation.ram);
      if (group === 'owner') {
        const drill = document.createElement('button'); drill.type = 'button'; drill.className = 'ws-grid-budget-choice'; drill.textContent = allocation.owner;
        const key = line.firstElementChild;
        if (key !== null) { key.replaceChildren(drill); entered.listen(drill, 'click', () => { group = 'asset'; signature = ''; refresh(); }); }
      }
      sec.append(line, el('small', 'ws-grid-budget-memory-note', `${allocation.allocations} allocations · ${MB(allocation.estimated)} estimated`));
    }
    sec.append(row('ROWS BELOW 1 MB', `GPU ${MB(projection.omitted.gpu)} · RAM ${MB(projection.omitted.ram)}`));
    // Controls and asset taps never collapse the existing chip or reach the touch controls behind it.
    entered.listen(sec, 'click', event => { event.stopPropagation(); });
    return sec;
  };
  const paint = (points: BudgetPoints, memory: MemorySnapshot | null): void => {
    if (bar === null || detail === null) return;
    const { crossroads } = points;
    // plain words (playtest round 2): "ALL LOADED 2331 / 1000 MB (233%)", each shard over its line as "% OF BUDGET"
    const head = scored('ws-grid-budget-x', `${TEXT.crossroads} ${Math.round(crossroads.playing / 1e6)} / ${Math.round(crossroads.playingCap / 1e6)} MB (${crossroads.points}%)`, crossroads.tone);
    data(head, 'playing', crossroads.playing); data(head, 'accounted', crossroads.accounted);
    // collapsed, the line names only the shards over their warning line; green shards and page-wide owners are counted
    const chip = (shard: BudgetShard, shown: boolean): HTMLElement => {
      const node = scored('ws-grid-budget-chip', shard.points === null ? `${label(shard.owner).toUpperCase()} ${megabytes(shard.total)} MB` : `${label(shard.owner).toUpperCase()} ${shard.points}% ${TEXT.budget}`, shard.tone);
      data(node, 'owner', shard.owner); data(node, 'bytes', shard.total); node.hidden = !shown; return node;
    };
    const warned = (shard: BudgetShard): boolean => shard.tone === 'amber' || shard.tone === 'red';
    const green = points.shards.filter((shard) => shard.tone === 'green').length;
    const page = points.shards.filter((shard) => shard.budget === null).reduce((sum, shard) => sum + shard.total, 0);
    bar.replaceChildren(el('b', 'ws-grid-budget-title', TEXT.title), head, ...points.shards.map((shard) => chip(shard, expanded || warned(shard))),
      ...(expanded ? [] : [scored('ws-grid-budget-chip', `${green} ${TEXT.ok}`, 'green'), scored('ws-grid-budget-chip', `${TEXT.platform} ${megabytes(page)} MB`, null)]));
    if (!expanded) { allocationScope?.dispose(); allocationScope = null; detail.replaceChildren(); return; }
    const cross = el('section', 'ws-grid-budget-sec');
    cross.append(el('h4', 'ws-grid-budget-h', TEXT.crossroads),
      ...BUDGET_CATEGORIES.map((category) => { const line = row(TEXT.category[category], MB(crossroads.bytes[category])); data(line, 'category', category); data(line, 'bytes', crossroads.bytes[category]); return line; }),
      row(TEXT.accounted, MB(crossroads.accounted)), row(TEXT.factor, String(crossroads.residentFactor)), row(TEXT.base, MB(crossroads.engineBase)), row(TEXT.overlap, MB(crossroads.overlap)),
      row(TEXT.playing, `${MB(crossroads.playing)} / ${megabytes(crossroads.playingCap)} · ${crossroads.points}`, crossroads.tone),
      row(TEXT.loading, `${MB(crossroads.loading)} / ${megabytes(crossroads.loadingCap)} · ${crossroads.loadingPoints}`, crossroads.loadingTone));
    const shards = points.shards.map((shard) => {
      const sec = el('section', 'ws-grid-budget-sec'); data(sec, 'owner', shard.owner);
      const heading = shard.budget === null ? `${label(shard.owner)} · ${MB(shard.total)}` : `${label(shard.owner)} · ${shard.points ?? 0} · ${megabytes(shard.total)}/${megabytes(shard.budget)} MB`;
      const h = el('h4', 'ws-grid-budget-h', heading); data(h, 'tone', shard.tone ?? 'none');
      sec.append(h, ...BUDGET_CATEGORIES.filter((category) => shard.bytes[category] > 0).map((category) => {
        const line = row(TEXT.category[category], MB(shard.bytes[category])); data(line, 'category', category); data(line, 'bytes', shard.bytes[category]); return line;
      }));
      if (shard.tiles.count > 0) sec.append(row(TEXT.tiles, `${shard.tiles.count} · ${shard.tiles.green}/${shard.tiles.amber}/${shard.tiles.red} · ${TEXT.worst.toLowerCase()} ${shard.tiles.worst}`));
      if (shard.measuredMB !== null) sec.append(row(TEXT.measured, `${shard.measuredMB.toFixed(1)} MB`));
      return sec;
    });
    const worst = el('section', 'ws-grid-budget-sec');
    worst.append(el('h4', 'ws-grid-budget-h', `${TEXT.worst} ${TEXT.tiles}`),
      ...points.tiles.slice(0, WORST_TILES).map((tile) => row(tile.id, `${megabytes(tile.bytes)}/${megabytes(tile.budget)} · ${tile.points}`, tile.tone)));
    detail.replaceChildren(cross, ...(memory === null ? [] : [memorySection(memory)]), ...shards, ...(points.tiles.length > 0 ? [worst] : []));
  };

  function refresh(): void {
    if (root === null || scope.disposed) return;
    const cost = host.allocator.cost(), entries = host.allocator.entries();
    const memory = expanded ? host.memory?.() ?? memoryAttribution.snapshot(cost.accounted) : null;
    // repaint only when the table changed (bytes or membership) or the view did: the timer is otherwise a cheap read
    const next = `${cost.accounted}|${entries.length}|${String(expanded)}|${group}|${sort}|${memory === null ? '' : JSON.stringify(memory)}`;
    if (next === signature && last !== null) return;
    signature = next;
    last = readBudgetPoints({ entries: () => entries, cost: () => cost }, { name: label, ...(host.measuredMB === undefined ? {} : { measuredMB: host.measuredMB }), ...(host.shard === undefined ? {} : { shard: host.shard }) });
    paint(last, memory);
  }
  const toggle = (): void => {
    if (root === null || detail === null) return;
    expanded = !expanded; root.setAttribute('aria-expanded', String(expanded)); detail.hidden = !expanded;
    refresh();
  };
  const build = (): void => {
    root = el('div', 'ws-grid-budget'); root.setAttribute('role', 'button'); root.setAttribute('aria-expanded', 'false'); root.tabIndex = -1;
    bar = el('div', 'ws-grid-budget-bar'); detail = el('div', 'ws-grid-budget-detail'); detail.hidden = true;
    root.append(bar, detail);
    // the strip takes its own taps; the touch controls under it never see them
    scope.listen(root, 'pointerdown', (event: Event) => { event.stopPropagation(); });
    scope.listen(root, 'click', (event: Event) => { event.stopPropagation(); toggle(); });
    mountUi(root, scope, host.hudRoot);
  };
  const sync = (on: boolean): void => {
    if (scope.disposed) return;
    if (!on) { scope.cancelTimer(timer); timer = 0; allocationScope?.dispose(); allocationScope = null; if (root !== null) root.hidden = true; return; }
    if (root === null) build();
    if (root === null) return;
    root.hidden = false; signature = ''; refresh();
    if (timer === 0) timer = scope.interval(BUDGET_REFRESH_MS, refresh);
  };
  sync(isDev());
  scope.onDispose(onDev(sync));
  return { state: () => last, refresh, toggle };
}

/**
 * G342: the near-placeholder tier. The cells around the player's crossroads (or next to the player's cell) draw a richer
 * placeholder than the far proxy: the terrain at L1 density (17 × 17 per 125 m region) and the shard's own drawn world
 * (landmarks, trees, water) at a low LOD, baked by `scripts/bake/near-placeholder.mjs` into one single-draw GLB per shard
 * (`public/assets/baked/<slug>/near.glb`, regions in TEXCOORD_0.x like the far proxy, so the rings' masks apply to it
 * unchanged). Cells further out keep the far proxy; the entered runtime always wins; it never registers a collider.
 *
 * The owner plans with `planNearPlaceholders` (at most four cells), loads cancel-safely (a cell that leaves the plan
 * before its bytes land is discarded, never installed), charges each view through the one `ResidencyAllocator` under its
 * own `near` category, and hides that cell's far proxy only once its near view is drawn (the far fallback stays until then).
 */
import type { Material, Object3D } from 'three';
import type { GridCell } from './assembly';
import type { ResidencyAllocator, ResidencyLease } from './allocator';
import { installFarProxy, type FarPrepared, type FarProxyView } from './farView';
import { planNearPlaceholders, type NearCrossroads } from './nearPlaceholderPlan';

/**
 * The bake's budget (measured, G342): the ground sampled at the height field's own ~2 m (64 quads a 125 m region) and
 * reduced to `groundError` metres (round 3), a content triangle budget, a sanity triangle cap and the per-cell resident
 * ceiling. Round 3 (Jake: Nalati's terrain "super low poly") measured the dense ground at 0.5 m on 2026-10-12: Nalati
 * 24k triangles / 1.9 MB, Pine 20k / 1.67 MB, Driftwood 16k / 1.38 MB (the L1-density ground was 10k / 0.77 MB); whole
 * cells Nalati 5.47, Driftwood 5.81 and Pine 8.07 MB with its 40k props, so the ceiling went 6 → 8.5 MB (coordinator
 * approval, G342 / E435): four cells 34 MB on the near line, inside the 1.0 GB Explorer envelope.
 */
export const NEAR_BAKE = { quads: 64, groundError: 0.5, contentTriangles: 42_000, triangles: 160_000, residentBytes: 8_500_000 } as const;

/** What the owner needs from the grid session. */
export interface NearPlaceholderHost {
  readonly allocator: ResidencyAllocator;
  readonly cells: readonly GridCell[];
  readonly pitch: number;
  /** the cell's render root (absent: not a neighbour of this session) */
  root: (instance: string) => Object3D | undefined;
  /** fetch and parse the cell's near placeholder; rejects when its shard has none (the far proxy stays). `owns`: the bake
   *  carries the shard's own world (props, trees), so the near view may own the whole cell over its L1 / L0 ring tiles; a
   *  terrain-only bake (a shardfile project whose world is in its tiles) leaves those tiles refining */
  load: (instance: string) => Promise<{ prepared: FarPrepared; bytes: number; owns?: boolean }>;
  /** the far proxy's visibility override: true hides it while the near view draws */
  cover: (instance: string, covered: boolean) => void;
  /** the regions the rings refined in this cell (the far proxy's current mask) */
  mask: (instance: string) => ReadonlySet<number>;
  /** frame / horizon hooks, as the far proxy gets them; returns the undo */
  adopt?: (view: FarProxyView, prepared: FarPrepared) => () => void;
  decorate?: (material: Material) => void;
}
interface Slot { readonly instance: string; generation: number; view: FarProxyView | null; lease: ResidencyLease | null; undo: (() => void) | null; owns: boolean }
/** A readout for the cell screen and captures. */
export interface NearPlaceholderState { readonly crossroads: NearCrossroads | null; readonly mode: 'crossroads' | 'adjacent'; readonly cells: readonly { instance: string; shows: 'near' | 'loading' | 'none' }[]; readonly bytes: number }

export class NearPlaceholders {
  private readonly slots = new Map<string, Slot>();
  private readonly missing = new Set<string>();
  private crossroads: NearCrossroads | null = null;
  private mode: 'crossroads' | 'adjacent' = 'crossroads';
  private generation = 0;
  private disposed = false;
  constructor(private readonly host: NearPlaceholderHost) {}

  /** Re-plan around the viewer (home-frame metres are converted by the caller to grid metres) and stream the difference. */
  update(point: Readonly<{ x: number; z: number }>, entered: string | null): void {
    if (this.disposed) return;
    const plan = planNearPlaceholders(this.host.cells, this.host.pitch, point, entered, this.crossroads);
    this.crossroads = plan.crossroads; this.mode = plan.mode;
    const wanted = new Map(plan.cells.filter(c => !this.missing.has(c.instance) && this.host.root(c.instance) !== undefined).map(c => [c.instance, c.distance]));
    for (const [instance, slot] of this.slots) if (!wanted.has(instance)) this.drop(slot);
    for (const [instance, distance] of wanted) {
      const slot = this.slots.get(instance);
      if (slot === undefined) this.start(instance, distance);
      else slot.lease?.update({ distance });
    }
  }

  /** Mirror the rings' refinement onto a cell's near view (the regions its L1 / L0 tiles now draw). */
  remask(instance: string): void {
    const view = this.slots.get(instance)?.view;
    if (view !== null && view !== undefined) view.mask(this.host.mask(instance));
  }

  /** True while the cell's near view is drawn (its far proxy is covered). */
  shows(instance: string): boolean { return (this.slots.get(instance)?.view ?? null) !== null; }

  /** True while the cell's near view is drawn and owns the cell (round 3: the rings stop refining it to its L1 / L0 tiles). */
  owns(instance: string): boolean { const slot = this.slots.get(instance); return slot?.view !== null && slot?.view !== undefined && slot.owns; }

  state(): NearPlaceholderState {
    let bytes = 0;
    const cells: { instance: string; shows: 'near' | 'loading' | 'none' }[] = [...this.slots.values()].map(s => {
      if (s.view !== null) bytes += this.bytes.get(s.instance) ?? 0;
      return { instance: s.instance, shows: s.view !== null ? 'near' : 'loading' };
    });
    for (const instance of this.missing) cells.push({ instance, shows: 'none' });
    return { crossroads: this.crossroads, mode: this.mode, cells, bytes };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of Array.from(this.slots.values())) this.drop(slot);
  }

  private readonly bytes = new Map<string, number>();

  private start(instance: string, distance: number): void {
    const slot: Slot = { instance, generation: ++this.generation, view: null, lease: null, undo: null, owns: false };
    this.slots.set(instance, slot);
    const generation = slot.generation;
    const run = async (): Promise<void> => {
      let loaded: Awaited<ReturnType<NearPlaceholderHost['load']>>;
      try { loaded = await this.host.load(instance); } catch {
        if (this.slots.get(instance)?.generation === generation) { this.slots.delete(instance); this.missing.add(instance); }
        return;
      }
      const { prepared, bytes, owns = false } = loaded;
      // cancel-safe: a cell that left the plan (or a disposed owner) discards what arrived
      if (this.disposed || this.slots.get(instance)?.generation !== generation) { prepared.geometry.dispose(); return; }
      const root = this.host.root(instance);
      const lease = root === undefined ? null : this.host.allocator.reserve({ id: `near:${instance}`, category: 'near', bytes, owner: instance, distance, needed: false,
        evictSync: () => { const live = this.slots.get(instance); if (live !== undefined) this.drop(live, false); } });
      if (root === undefined || lease === null) { prepared.geometry.dispose(); this.slots.delete(instance); return; } // refused: the far proxy stays
      const view = installFarProxy(root, prepared.geometry, prepared.look, prepared.positionalMask === true, this.host.decorate);
      view.mesh.name = 'near-placeholder';
      slot.view = view; slot.lease = lease; slot.undo = this.host.adopt?.(view, prepared) ?? null; slot.owns = owns;
      this.bytes.set(instance, bytes);
      view.mask(this.host.mask(instance));
      this.host.cover(instance, true);
    };
    void run();
  }

  private drop(slot: Slot, release = true): void {
    this.slots.delete(slot.instance);
    slot.generation = -1;
    if (slot.view !== null) { this.host.cover(slot.instance, false); slot.undo?.(); slot.view.dispose(); }
    if (release) slot.lease?.release();
    slot.view = null; slot.lease = null; slot.undo = null;
    this.bytes.delete(slot.instance);
  }
}

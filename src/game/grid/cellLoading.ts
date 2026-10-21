/**
 * G555 (Jake, 2026-10-21): one loading screen, the detailed step-by-step one, everywhere. A grid cell entry or re-entry
 * that waits shows the same screen as SHARD SELECT (`Loading`, in its scoped mid-play mode, on the `cell` loading path)
 * over the region's live admission: product, region world, equipment, gameplay, colliders and simulation, the entry
 * warm-up, then entry. It replaced G217's in-world hex card (`cellScreen.ts`, deleted with its 4-step plan).
 *
 * `cellLoadingStep` is the pure part: a cell's live state to its current step and detail, a refusal's reason, or done.
 * `CellLoading` owns the one scoped screen: it opens on the cell the traveller waits at (or has entered before it is
 * gameplay-ready), steps it at most a few times a second, and fades it out when the cell is ready or left.
 */
import { Loading } from '@wildshard/engine/ui/Loading';
import { loadingPath } from '../boot/loadingPaths';
import { gridPrefetchStatus } from './prefetch';

/** One waiting cell's live admission, read through the grid session's read-only port. */
export interface CellLoadingInput {
  readonly instance: string; readonly slug: string; readonly name: string;
  /** the admission refused this shard, or it cannot enter the grid yet: the screen shows why */
  readonly refusal: string | null;
  /** its product is admitted (its claim in the one allocator) and how much it holds */
  readonly product: boolean; readonly claimedMB: number;
  /** the readiness fences */
  readonly requested: boolean; readonly runtime: boolean; readonly colliders: boolean; readonly sim: boolean;
  /** a runtime region's entered hooks finished since this load began, and the one running now */
  readonly hooks: ReadonlySet<string>; readonly hook: string | null;
  /** whether it has hooks at all (a declared bodyless region has none) */
  readonly hybrid: boolean;
  /** the traveller is in it; and its gameplay is ready */
  readonly entered: boolean; readonly gameplayReady: boolean;
}
export type CellLoadingStep = { readonly kind: 'step'; readonly key: string; readonly detail: string }
  | { readonly kind: 'failed'; readonly reason: string } | { readonly kind: 'done' };

/** The cell's current step on the `cell` path, its detail, its refusal, or done (entered and gameplay-ready). */
export function cellLoadingStep(input: CellLoadingInput): CellLoadingStep {
  if (input.refusal !== null) return { kind: 'failed', reason: input.refusal };
  if (input.entered && input.gameplayReady) return { kind: 'done' };
  const hooksDone = (last: string): boolean => !input.hybrid || input.hooks.has(last);
  if (!input.product) return { kind: 'step', key: 'admission', detail: input.requested ? 'reading and verifying its product' : 'requested as you approach' };
  const running = input.hook === null ? '' : ` · ${input.hook}`;
  if (!hooksDone('afterWorld')) return { kind: 'step', key: 'world', detail: `${input.claimedMB.toFixed(0)} MB admitted${running}` };
  if (!hooksDone('afterKit')) return { kind: 'step', key: 'loadout', detail: `weapons, held items and HUD${running}` };
  if (!hooksDone('afterPlay') || !input.runtime) return { kind: 'step', key: 'gameplay', detail: `saved state and its systems${running}` };
  if (!input.colliders || !input.sim) return { kind: 'step', key: 'colliders', detail: `${input.colliders ? 'colliders ready' : 'colliders'} · ${input.sim ? 'simulation ready' : 'simulation'}` };
  if (!input.entered) return { kind: 'step', key: 'warm', detail: 'ready: drive in' };
  return { kind: 'step', key: input.hook === 'activate' ? 'enter' : 'warm', detail: `preparing its first frame${running}` };
}

/** The one scoped loading screen over the cell the traveller waits at. */
export class CellLoading {
  private loading: Loading | null = null;
  private instance: string | null = null;
  private failed = false;
  /** the furthest step reached: a region learns it has hooks only when they start, so a row never goes back */
  private reached = -1;
  /** Open, step or close the screen from this cell's live state (null: no cell is waiting). */
  step(input: CellLoadingInput | null): void {
    if (input === null || input.instance !== this.instance) this.close();
    if (input === null) return;
    const step = cellLoadingStep(input);
    if (step.kind === 'done') { this.close(); return; }
    if (this.loading === null) {
      this.loading = new Loading({ id: input.slug, name: input.name }, { scoped: true });
      this.loading.setPrefetchSource(gridPrefetchStatus);
      this.loading.setPath(loadingPath('cell')); this.instance = input.instance; this.failed = false; this.reached = -1;
    }
    if (step.kind === 'failed') { if (!this.failed) { this.loading.scopedFail(step.reason); this.failed = true; } return; }
    const keys = loadingPath('cell').steps.map(row => row.key), index = keys.indexOf(step.key);
    if (index >= this.reached) { this.reached = index; this.loading.scopedStep(step.key, step.detail); }
  }
  /** The screen's cell (null: none open). */
  get open(): string | null { return this.instance; }
  /** Fade the open screen out (it disposes itself when gone). */
  close(): void {
    const loading = this.loading; this.loading = null; this.instance = null; this.failed = false;
    if (loading !== null) void loading.done();
  }
}

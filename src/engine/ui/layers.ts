import type { Scope } from '../app/scope';

export type UiLayer = 'hud' | 'gameMenu' | 'menu' | 'modal' | 'error';
export interface UiView {
  root: HTMLElement;
  back: () => void;
  /** Preserve an existing widget's order within its layer. */
  order?: number;
  /** An embedded view inherits its ancestor's input ownership; it only registers placement/lifetime. */
  embedded?: boolean;
}
export interface UiHandle { readonly active: boolean; readonly top: boolean; dispose: () => void }
interface Entry { layer: UiLayer; view: UiView; handle: UiHandle; resident: Scope | null; forget: () => void }
const PRIORITY: Record<UiLayer, number> = { hud: 0, gameMenu: 1, menu: 2, modal: 3, error: 4 };

/** A single back/input owner; resident scopes retain their own overlay entries. */
export class UiLayers {
  private readonly now: () => number;
  constructor(now: () => number = () => 0) { this.now = now; }
  closedAt = Number.NEGATIVE_INFINITY;
  private entries: Entry[] = [];
  private changed: (() => void) | undefined;
  private owner: (() => Scope | null) | undefined;
  connect(changed: () => void, owner?: () => Scope | null): void { this.changed = changed; this.owner = owner; }
  private visible(): Entry[] {
    const owner = this.owner?.();
    return this.entries.filter((entry) => entry.resident === null || entry.resident === owner)
      .sort((a, b) => PRIORITY[a.layer] - PRIORITY[b.layer]);
  }
  private input(): Entry[] { return this.visible().filter((entry) => entry.view.embedded !== true); }
  get top(): UiLayer { return this.input().at(-1)?.layer ?? 'hud'; }
  get blocking(): boolean { return this.top !== 'hud'; }
  isTop(handle: UiHandle): boolean { return this.input().at(-1)?.handle === handle; }
  push(layer: UiLayer, view: UiView, scope: Scope): UiHandle {
    let active = !scope.disposed;
    const isTop = (): boolean => this.input().at(-1)?.view === view;
    const handle: UiHandle = {
      get active() { return active; },
      get top() { return active && isTop(); },
      dispose: () => {
        if (!active) return;
        active = false;
        if (view.embedded !== true) this.closedAt = this.now();
        const at = this.entries.findIndex((entry) => entry.handle === handle);
        if (at !== -1) { const [entry] = this.entries.splice(at, 1); entry?.forget(); }
        this.refresh();
      },
    };
    if (!active) return handle;
    const owner = this.owner?.();
    const entry: Entry = { layer, view, handle, resident: owner && scope.belongsTo(owner) ? owner : null,
      forget: () => { /* Assigned below. */ } };
    view.root.style.zIndex = `calc(var(--ws-layer-${layer}) + ${view.order ?? 0})`;
    this.entries.push(entry);
    entry.forget = scope.capture('disposers', handle.dispose);
    this.refresh();
    return handle;
  }
  back(): boolean {
    const entry = this.input().at(-1);
    if (entry === undefined) return false;
    entry.view.back();
    return true;
  }
  refresh(): void {
    const visible = this.input(), top = visible.at(-1);
    for (const entry of visible) entry.view.root.inert = entry !== top;
    this.changed?.();
  }
}

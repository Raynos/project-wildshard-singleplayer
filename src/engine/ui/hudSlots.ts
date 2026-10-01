

export type DiscSpot = 'r0' | 'r1' | 'r2' | 'r3' | 'aim' | 'up0' | 'lean-l' | 'lean-r' | 'edge-r' | 'edge-l' | 'lock' | 'jump';
export interface TouchRelabel { label: string; icon?: string; tone: 'rest' | 'ready' | 'active'; accent?: string }
export interface DiscOpts {
  /** the disc's own class(es), styled by the owner's stylesheet (`ws-ride-gallop`, `ws-stealth-crouch`) */
  cls: string;
  /** inline svg markup */
  icon: string;
  label: string;
  spot: DiscSpot;
  /** pointer down (the disc lights `.down` while held) */
  press?: () => void;
  /** pointer up / cancel / leave */
  release?: () => void;
}
/** the status column's order: the base's rows first, then whatever a shard adds, then the pills */
export const ROW = { vitals: 0, ammo: 1, steed: 2, stealth: 3, grass: 4, pill: 10 } as const;

class HudSlots {
  private layer: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private pending: ((layer: HTMLElement, status: HTMLElement) => void)[] = [];

  /** TouchControls, once its layer is in #hud */
  mount(layer: HTMLElement, status: HTMLElement): void {
    this.layer = layer; this.status = status;
    for (const f of this.pending.splice(0)) f(layer, status);
  }

  get touch(): boolean { return this.layer !== null; }

  private run(f: (layer: HTMLElement, status: HTMLElement) => void): void {
    if (this.layer !== null && this.status !== null) f(this.layer, this.status); else this.pending.push(f);
  }

  onLayer(f: (layer: HTMLElement) => void): void { this.run((layer) => { f(layer); }); }

  /** a row of the top-left status column; `order` from ROW (a shard's own rows go after the base's). `box: false` keeps
   *  the element's own box (the base's VITALS / ammo strips, game.css) instead of the shared row glass */
  statusRow(el: HTMLElement, order: number, box = true): void {
    if (box) el.classList.add('ws-touch-row');
    el.style.order = String(order);
    this.run((_l, status) => { status.append(el); });
  }

  /** a tappable tag under the status column (it flows with the rows above it) */
  pill(el: HTMLElement, onTap: () => void): void {
    el.classList.add('ws-touch-tag');
    el.style.order = String(ROW.pill);
    // the layer cancels its touch events (TouchControls, E46), so there is no click: act on the pointer's release
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    el.addEventListener('pointerup', (e) => { e.stopPropagation(); onTap(); });
    this.run((_l, status) => { status.append(el); });
  }

  /** a round control disc at `spot`, with the base's press plumbing; hidden until `.show` */
  disc(o: DiscOpts): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ws-touch-disc at at-${o.spot} ${o.cls}`;
    b.innerHTML = `${o.icon}<span>${o.label}</span>`;
    b.setAttribute('draggable', 'false');
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); o.press?.(); });
    const end = (e: Event): void => { e.stopPropagation(); if (!b.classList.contains('down')) return; b.classList.remove('down'); o.release?.(); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('pointerleave', end);
    this.run((layer) => { layer.append(b); });
    return b;
  }

  show(el: HTMLElement, on: boolean): void { el.classList.toggle('show', on); }

  /** E155: each resident shard has its own touch layer — the host swaps the slots' state with the running shard */
  snapshot(): HudSlotsState { return { layer: this.layer, status: this.status, pending: [...this.pending] }; }
  restore(s: HudSlotsState): void { this.layer = s.layer; this.status = s.status; this.pending = [...s.pending]; }
}
interface HudSlotsState { layer: HTMLElement | null; status: HTMLElement | null; pending: ((layer: HTMLElement, status: HTMLElement) => void)[] }

export const hudSlots = new HudSlots();

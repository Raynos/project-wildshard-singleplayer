/**
 * hudSlots — the ONE way anything adds to the phone HUD (E154, the user: "one shared base-layer HUD … how does each
 * shard add new things to the HUD that's custom to the shard").
 *
 * The base HUD is the same on every shard: TouchControls (src/player/TouchControls.ts) builds the layer — PAUSE, the
 * top-left status column, the bar (MOVE · ATTACK · LOOK), the E119 row (LOCK · DODGE · JUMP above the LOOK pad), HOVER on
 * the left edge, USE — and HUD.ts fills the column with VITALS and the held weapon's ammo strip. A shard never builds its
 * own HUD and never positions its own controls: it asks for a slot here, and the base stylesheet (touch.css) places it.
 *
 *   hudSlots.statusRow(el, ROW.steed)        // a row of the top-left status column (VITALS' glass: `.ws-touch-row`)
 *   hudSlots.pill(el)                        // a small round-cornered tag under the column (✎ NOTE, JOURNAL)
 *   hudSlots.disc({ cls, icon, label, spot, press, release })   // a round control disc at a named spot (below)
 *   hudSlots.onLayer((layer) => …)           // the raw layer, for a class toggle (`.riding`, …) — last resort
 *
 * Spots (touch.css `.at-*`): `r0` JUMP's · `r1` DODGE's · `r2` LOCK's · `r3` the 4th slot left of LOCK (all in the E119
 * row) · `aim` wherever AIM is (LOCK's slot, or the 4th when LOCK shows) · `up0` above JUMP (the row pushes the USE band
 * up while a disc there `.show`s) · `lean-l` / `lean-r` just above the bar at the two edges · `edge-r` a tab on the right
 * screen edge. A disc starts hidden; the caller toggles `.show` (or `hudSlots.show(el, on)`).
 *
 * Everything is queued until TouchControls mounts the layer (`mount`), so build order in main.ts never matters. On a
 * mouse / trackpad device nothing mounts: the calls are harmless and the elements stay detached.
 */

export type DiscSpot = 'r0' | 'r1' | 'r2' | 'r3' | 'aim' | 'up0' | 'lean-l' | 'lean-r' | 'edge-r';
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
}

export const hudSlots = new HudSlots();

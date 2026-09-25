/**
 * ToastStack — the HUD's ONE toast queue (`hud.toast(text)`: the journal's new pages / places, elite drops, the boss's
 * rewards, the feedback notes, the quest's steps — every caller goes through HUD.toast). Styled in game.css
 * (`.ws-game-toasts`, `.ws-game-toast`).
 *
 *   const stack = new ToastStack(box);    // box = the `.ws-game-toasts` column HUD builds
 *   stack.push('Journal · new page: Black bear');
 *   stack.tick();                         // every frame (HUD.setState): re-lays the column ~6× a second while a toast is up
 *
 * At most `MAX` toasts show: the newest at the bottom, the older ones dimmed (CSS), the oldest dropped. The same text
 * twice in a row restarts that toast instead of stacking a copy.
 *
 * **No overlap with the top bars.** The column keeps its CSS home (phone: the left column under PAUSE / the journal disc;
 * desktop: the right column), and is pushed DOWN below whatever top-anchored bar shares its horizontal band right now:
 * the named elite's pinned bar and its NAMED ELITE NEARBY banner (EliteBar), the boss bar and its reward card (BossBar),
 * the quest's boss bar, the quest chip, the minimap, the kill feed. It measures those boxes (getBoundingClientRect) only
 * while a toast is up and at most every `EVERY` ms, and moves the column with a transform (no reflow of the HUD).
 * An elite's bar floating over its head (not pinned) is world-anchored and is not an obstacle: it dims itself where it
 * crosses the toasts (`toastArea`, read by EliteBar). Pushed down toward the crosshair (half the screen, less a margin),
 * the oldest toasts leave early — the newest always shows.
 */
import { stateSlot } from '../core/shardState';

const MAX = 3;
const LIFE = 3200, OUT = 500, EVERY = 160, GAP = 8;
/** top-anchored boxes the column never draws over (only when shown) */
const OBSTACLES = [
  '.ws-elite-bar.pinned.show', '.ws-elite-banner.show',
  '.ws-boss-bar.show', '.ws-boss-reward.show', '.ws-quest-boss.show',
  '.ws-quest-obj.show', '.ws-minimap', '.ws-game-feed',
].join(', ');

interface Toast { el: HTMLElement; timer: number; text: string }

/** where the toasts are on screen right now (viewport px; empty = none up) — the elite's floating name dims under them */
export const toastArea = { left: 0, right: 0, top: 0, bottom: 0 };

export class ToastStack {
  private live: Toast[] = [];
  private lastLayout = -1e9;
  private shift = 0;

  constructor(private readonly box: HTMLElement) {}

  push(text: string): void {
    const last = this.live.at(-1);
    if (last?.text === text && !last.el.classList.contains('out')) { this.arm(last); return; }
    const el = document.createElement('div');
    el.className = 'ws-glass ws-game-toast';
    el.textContent = text;
    const t: Toast = { el, timer: 0, text };
    this.box.append(el);
    this.live.push(t);
    this.arm(t);
    while (this.live.length > MAX) { const old = this.live.shift(); if (old) { clearTimeout(old.timer); old.el.remove(); } }
    this.layout();
  }

  /** every frame: re-lay the column while a toast is up (throttled) */
  tick(): void {
    if (this.live.length === 0) { if (this.shift !== 0) { this.shift = 0; this.box.style.transform = ''; } toastArea.bottom = toastArea.top; return; }
    if (performance.now() - this.lastLayout >= EVERY) this.layout();
  }

  private arm(t: Toast): void {
    clearTimeout(t.timer);
    t.el.classList.remove('out');
    t.timer = window.setTimeout(() => {
      t.el.classList.add('out');
      t.timer = window.setTimeout(() => { t.el.remove(); const i = this.live.indexOf(t); if (i !== -1) this.live.splice(i, 1); }, OUT);
    }, LIFE);
  }

  /** push the column below every shown top bar that shares its horizontal band */
  private layout(): void {
    this.lastLayout = performance.now();
    const root = this.box.offsetParent;
    if (!(root instanceof HTMLElement)) return;
    const host = root.getBoundingClientRect();
    const b = this.box.getBoundingClientRect();
    if (b.width === 0) return;
    const home = host.top + this.box.offsetTop;     // the CSS top (offsetTop ignores the transform)
    const left = b.left, right = b.right;
    const rects: DOMRect[] = [];
    for (const o of root.querySelectorAll<HTMLElement>(OBSTACLES)) {
      const r = o.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > left && r.left < right && r.bottom > home) rects.push(r);
    }
    rects.sort((p, q) => p.top - q.top);
    // top to bottom: a bar that starts above the column's (moved) bottom steps it under that bar
    let top = home;
    for (const r of rects) if (r.top < top + Math.max(24, b.height)) top = Math.max(top, r.bottom + GAP);
    // never down into the crosshair's band: pushed that far, the oldest toasts go early (the newest always shows)
    const floor = host.top + host.height * 0.5 - 44;
    let h = b.height;
    while (this.live.length > 1 && top + h > floor) {
      const old = this.live.shift();
      if (!old) break;
      clearTimeout(old.timer); h -= old.el.offsetHeight + 6; old.el.remove();   // + the column's 6 px gap
    }
    const shift = Math.round(top - home);
    if (shift !== this.shift) { this.shift = shift; this.box.style.transform = shift === 0 ? '' : `translateY(${shift}px)`; }
    toastArea.left = left; toastArea.right = right; toastArea.top = top; toastArea.bottom = top + h;
  }
}

// E155 (src/core/shardState.ts): the running shard's toast area
stateSlot('toastArea', toastArea);

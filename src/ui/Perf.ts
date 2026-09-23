/**
 * Frame meter, top-right — after trials-gauntlet-demo's `src/ui/perf.ts`: fps and frame ms p50 / p95
 * from the game's ring of frame times, draw calls and triangles from renderer.info, the tier and DPR.
 * Repainted at most twice a second and written to the DOM only when the text changed, so the meter
 * costs the phone nothing. `?perf=0` hides it.
 *
 * Phones (E47, Jake: "a compact FPS counter next to the pause button … '59 fps 17 ms' … when you tap it it can expand to
 * show calls and tris … on top of the mini map"): perf.css turns the meter into a small glass pill on PAUSE's row showing
 * only fps + p50 ms; it is a button, and a tap opens `.ws-perf-panel` over the minimap (p50 / p95, draw calls, triangles,
 * tier · DPR, GL losses). A tap on the panel or anywhere else closes it. The pill cancels its own touch events (no
 * double-tap zoom, no callout / selection on iOS) and toggles on pointerup, so it never starts a look drag. Desktop keeps
 * the one-line readout, click-through as before.
 */
import type { Game } from '../core/Game';
import { TIER } from '../core/tier';
import './perf.css';

const PAINT_MS = 500;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

export class Perf {
  readonly root: HTMLElement;
  private lastPaint = 0;
  private lastText = '';
  private sorted = new Float32Array(120);
  private panel: HTMLElement;
  private rows: { p50: HTMLElement; p95: HTMLElement; calls: HTMLElement; tris: HTMLElement; tier: HTMLElement; gl: HTMLElement };

  constructor(private game: Game) {
    const root = this.root = document.createElement('button');
    root.className = 'ws-perf';
    root.setAttribute('type', 'button');
    root.setAttribute('aria-label', 'Frame meter — tap for details');
    root.innerHTML = '<b>—</b><span class="ws-perf-ms"></span><span class="ws-perf-long"></span>';
    const panel = this.panel = document.createElement('div');
    panel.className = 'ws-perf-panel';
    panel.innerHTML = '<div class="ws-perf-row"><i>Frame p50</i><span data-r="p50">—</span></div><div class="ws-perf-row"><i>Frame p95</i><span data-r="p95">—</span></div><div class="ws-perf-row"><i>Draw calls</i><span data-r="calls">—</span></div><div class="ws-perf-row"><i>Triangles</i><span data-r="tris">—</span></div><div class="ws-perf-row"><i>Tier · DPR</i><span data-r="tier">—</span></div><div class="ws-perf-row"><i>GL</i><span data-r="gl">ok</span></div>';
    const row = (r: string): HTMLElement => { const e = panel.querySelector<HTMLElement>(`[data-r="${r}"]`); if (e === null) throw new Error(`Perf: missing row ${r}`); return e; };
    this.rows = { p50: row('p50'), p95: row('p95'), calls: row('calls'), tris: row('tris'), tier: row('tier'), gl: row('gl') };
    document.body.append(root, panel);
    // the pill is a button on phones: toggle on the lift; cancel its touches (iOS double-tap zoom / callout / selection)
    // and never let them reach the look layer. The panel closes on a tap on it or anywhere else (not cancelled, so a
    // look drag that starts outside still looks).
    const cancel = (e: Event): void => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
    for (const t of ['touchstart', 'touchmove', 'touchend'] as const) root.addEventListener(t, cancel, { passive: false });
    for (const t of ['pointerdown', 'dragstart', 'contextmenu'] as const) root.addEventListener(t, cancel);
    root.addEventListener('pointerup', (e) => { cancel(e); this.open(!panel.classList.contains('open')); });
    for (const n of [root, ...root.querySelectorAll('*'), panel, ...panel.querySelectorAll('*')]) n.setAttribute('draggable', 'false');
    document.addEventListener('pointerdown', (e) => { if (e.target instanceof Node && !root.contains(e.target)) this.open(false); }, true);
    document.querySelectorAll<HTMLElement>('.ws-game-fps').forEach((e) => { e.hidden = true; }); // the HUD's old faint readout; this meter replaces it
    if (new URLSearchParams(location.search).get('perf') === '0') { this.userHidden = true; this.root.hidden = true; }
    game.onUpdate(() => this.update(performance.now()));
    // frames are gated on the menu (Game.frameGate): say so rather than freeze on the last number
    setInterval(() => { if (performance.now() - this.lastPaint > 1500 && this.lastText !== 'idle') { this.lastText = 'idle'; (this.root.firstElementChild as HTMLElement).textContent = '—'; (this.root.querySelector('.ws-perf-long') as HTMLElement).textContent = 'world paused'; (this.root.querySelector('.ws-perf-ms') as HTMLElement).textContent = 'paused'; this.root.classList.remove('slow', 'bad'); } }, 500);
  }

  /** Hidden while the menu is up (the world is not rendering, so there is nothing to measure). */
  setActive(on: boolean): void { this.root.hidden = on ? this.userHidden : true; if (!on || this.userHidden) this.open(false); }
  /** the details panel over the minimap (phones) */
  private open(on: boolean): void { const show = on && this.root.hidden === false; this.panel.classList.toggle('open', show); this.root.classList.toggle('open', show); }
  private userHidden = false;

  private update(now: number) {
    if (now - this.lastPaint < PAINT_MS) return;
    this.lastPaint = now;
    const g = this.game;
    this.sorted.set(g.frameMs); this.sorted.sort();
    const n = this.sorted.findIndex((v) => v > 0); // unfilled slots are 0 and sort first
    const valid = n === -1 ? 0 : this.sorted.length - n;
    if (valid < 10) return;
    const q = (p: number): number => this.sorted[n + Math.min(valid - 1, Math.floor(valid * p))] ?? 0;
    const p50 = q(0.5), p95 = q(0.95);
    const r = g.lastFrame;
    const gl = g.gl.events ? ` · gl lost ×${g.gl.events}${g.gl.restoredAt > g.gl.lostAt ? ` restored ${Math.round(g.gl.restoredAt - g.gl.lostAt)} ms` : ''}` : '';
    const text = `${Math.round(1000 / p50)}|${p50.toFixed(1)} / ${p95.toFixed(1)} ms · ${r.calls} calls · ${k(r.triangles)} tris · ${TIER} ${g.renderer.getPixelRatio().toFixed(2)}×${gl}`;
    if (text === this.lastText) return;
    this.lastText = text;
    const [fps = '', rest = ''] = text.split('|');
    (this.root.firstElementChild as HTMLElement).textContent = fps;
    (this.root.querySelector('.ws-perf-long') as HTMLElement).textContent = rest;
    // phones: the pill shows fps + p50 ms; the panel carries the draw calls / triangles the phone-tier budget is measured in
    // (project/archive/2026-09-22-play-perf.md), the p95, the tier and DPR
    (this.root.querySelector('.ws-perf-ms') as HTMLElement).textContent = `${Math.round(p50)} ms`;
    const R = this.rows;
    R.p50.textContent = `${p50.toFixed(1)} ms`;
    R.p95.textContent = `${p95.toFixed(1)} ms`;
    R.calls.textContent = String(r.calls);
    R.tris.textContent = k(r.triangles);
    R.tier.textContent = `${TIER} · ${g.renderer.getPixelRatio().toFixed(2)}×`;
    R.gl.textContent = gl === '' ? 'ok' : gl.replace(/^ · /, '');
    this.root.classList.toggle('slow', p50 > 20);   // under 50 fps
    this.root.classList.toggle('bad', p50 > 33.4);  // under 30 fps
  }
}

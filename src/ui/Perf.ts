/**
 * Frame meter, top-right — after trials-gauntlet-demo's `src/ui/perf.ts`: fps and frame ms p50 / p95
 * from the game's ring of frame times, draw calls and triangles from renderer.info, the tier and DPR.
 * Repainted at most twice a second and written to the DOM only when the text changed, so the meter
 * costs the phone nothing. `?perf=0` hides it.
 *
 * `?perf=1` adds the budget check: the worst draw calls / triangles of the last ~10 s against the tier's budget
 * (phone ≤ 110 calls, ≤ 1.6 M triangles — docs/plans/NALATI.md, the phone-tier handoff; desktop shows the maxima only),
 * `OK` / `OVER` on the meter (red when over), and `window.__perfBudget` for scripted checks.
 */
import type { Game } from '../core/Game';
import { TIER } from '../core/tier';
import './perf.css';

const PAINT_MS = 500;
const BUDGET = TIER === 'phone' ? { calls: 110, tris: 1.6e6 } : null;
const WINDOW = 20; // paints (~10 s)
export interface PerfBudget { maxCalls: number; maxTris: number; calls: number; tris: number; over: boolean }
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

export class Perf {
  readonly root: HTMLElement;
  private lastPaint = 0;
  private lastText = '';
  private sorted = new Float32Array(120);
  private readonly budgetOn = new URLSearchParams(location.search).get('perf') === '1';
  private readonly recent: { calls: number; tris: number }[] = [];
  readonly budget: PerfBudget = { maxCalls: 0, maxTris: 0, calls: BUDGET?.calls ?? Infinity, tris: BUDGET?.tris ?? Infinity, over: false };

  constructor(private game: Game) {
    this.root = document.createElement('div');
    this.root.className = 'ws-perf';
    this.root.innerHTML = '<b>—</b><span class="ws-perf-long"></span><span class="ws-perf-short"></span>';
    document.body.append(this.root);
    document.querySelectorAll<HTMLElement>('.ws-game-fps').forEach((e) => { e.hidden = true; }); // the HUD's old faint readout; this meter replaces it
    if (new URLSearchParams(location.search).get('perf') === '0') { this.userHidden = true; this.root.hidden = true; }
    if (this.budgetOn) Object.assign(window, { __perfBudget: this.budget });
    game.onUpdate(() => this.update(performance.now()));
    // frames are gated on the menu (Game.frameGate): say so rather than freeze on the last number
    setInterval(() => { if (performance.now() - this.lastPaint > 1500 && this.lastText !== 'idle') { this.lastText = 'idle'; (this.root.firstElementChild as HTMLElement).textContent = '—'; (this.root.querySelector('.ws-perf-long') as HTMLElement).textContent = 'world paused'; (this.root.querySelector('.ws-perf-short') as HTMLElement).textContent = 'paused'; this.root.className = 'ws-perf'; } }, 500);
  }

  /** Hidden while the menu is up (the world is not rendering, so there is nothing to measure). */
  setActive(on: boolean): void { this.root.hidden = on ? this.userHidden : true; }
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
    let check = '';
    if (this.budgetOn) {
      this.recent.push({ calls: r.calls, tris: r.triangles });
      if (this.recent.length > WINDOW) this.recent.shift();
      const b = this.budget;
      b.maxCalls = Math.max(...this.recent.map((x) => x.calls)); b.maxTris = Math.max(...this.recent.map((x) => x.tris));
      b.over = b.maxCalls > b.calls || b.maxTris > b.tris;
      check = ` · max ${b.maxCalls}c / ${k(b.maxTris)}${BUDGET ? ` ${b.over ? 'OVER' : 'OK'} (≤${BUDGET.calls}c / ${k(BUDGET.tris)})` : ''}`;
    }
    const text = `${Math.round(1000 / p50)}|${p50.toFixed(1)} / ${p95.toFixed(1)} ms · ${r.calls} calls · ${k(r.triangles)} tris · ${TIER} ${g.renderer.getPixelRatio().toFixed(2)}×${gl}${check}`;
    if (text === this.lastText) return;
    this.lastText = text;
    const [fps = '', rest = ''] = text.split('|');
    (this.root.firstElementChild as HTMLElement).textContent = fps;
    (this.root.querySelector('.ws-perf-long') as HTMLElement).textContent = rest;
    // phones: one short line — p50 ms plus the draw calls / triangles the phone-tier budget is measured in (project/archive/2026-09-22-play-perf.md)
    (this.root.querySelector('.ws-perf-short') as HTMLElement).textContent = `${Math.round(p50)} ms · ${r.calls} calls · ${k(r.triangles)} tris${gl}${check}`;
    this.root.classList.toggle('slow', p50 > 20);   // under 50 fps
    this.root.classList.toggle('bad', p50 > 33.4 || (this.budgetOn && this.budget.over));  // under 30 fps (or over the draw budget)
  }
}

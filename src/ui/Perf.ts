/**
 * Frame meter, top-right — after trials-gauntlet-demo's `src/ui/perf.ts`: fps and frame ms p50 / p95
 * from the game's ring of frame times, draw calls and triangles from renderer.info, the tier and DPR.
 * Repainted at most twice a second and written to the DOM only when the text changed, so the meter
 * costs the phone nothing. `?perf=0` hides it.
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

  constructor(private game: Game) {
    this.root = document.createElement('div');
    this.root.className = 'ws-perf';
    this.root.innerHTML = '<b>—</b><span></span>';
    document.body.appendChild(this.root);
    if (new URLSearchParams(location.search).get('perf') === '0') this.root.hidden = true;
    game.onUpdate(() => this.update(performance.now()));
  }

  private update(now: number) {
    if (now - this.lastPaint < PAINT_MS) return;
    this.lastPaint = now;
    const g = this.game;
    this.sorted.set(g.frameMs); this.sorted.sort();
    const n = this.sorted.findIndex((v) => v > 0); // unfilled slots are 0 and sort first
    const valid = n < 0 ? 0 : this.sorted.length - n;
    if (valid < 10) return;
    const q = (p: number) => this.sorted[n + Math.min(valid - 1, Math.floor(valid * p))];
    const p50 = q(0.5), p95 = q(0.95);
    const r = g.lastFrame;
    const text = `${Math.round(1000 / p50)}|${p50.toFixed(1)} / ${p95.toFixed(1)} ms · ${r.calls} calls · ${k(r.triangles)} tris · ${TIER} ${g.renderer.getPixelRatio().toFixed(2)}×`;
    if (text === this.lastText) return;
    this.lastText = text;
    const [fps, rest] = text.split('|');
    (this.root.firstElementChild as HTMLElement).textContent = fps;
    (this.root.lastElementChild as HTMLElement).textContent = rest;
    this.root.classList.toggle('slow', p50 > 20);   // under 50 fps
    this.root.classList.toggle('bad', p50 > 33.4);  // under 30 fps
  }
}

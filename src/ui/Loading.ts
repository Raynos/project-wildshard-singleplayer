import { getActiveChunk } from '../chunks/registry';
import { formatMB, type ProgressView } from '../boot/plan';
import { TIER } from '../core/tier';
import './loading.css';

/**
 * Loading screen in the Wildshard staging identity — a painter of the boot plan's view
 * (src/boot/plan.ts) and nothing else: two tracks (DOWNLOAD bytes read / declared, SETUP
 * weighted steps) as integers that read 100 only when the fraction is exactly 1, an elapsed
 * clock, and one row per step with its wall ms and live detail. Nothing here eases, animates
 * on a timer or guesses. `done()` fades it out and resolves when it is gone.
 */
export class Loading {
  root: HTMLElement;
  private els: Record<string, HTMLElement>;
  private rowsEl: HTMLElement;
  private t0 = performance.now();
  private raf = 0;
  private view: ProgressView | null = null;

  constructor() {
    const chunk = getActiveChunk();
    this.root = document.createElement('div');
    this.root.className = 'ws-load';
    this.root.innerHTML = `
      <div class="ws-load-head">
        <div class="ws-wordmark">Project <b>Wildshard</b></div>
        <div class="ws-tagline">A world that does not exist yet, arriving one chunk at a time.</div>
      </div>
      <div class="ws-load-body">
        <div class="ws-glass ws-load-panel">
          <div class="ws-load-title">Loading chunk · <b>${chunk.slug}</b><span class="ws-load-clock" data-el="clock">00:00.0</span></div>
          <div class="ws-load-meta ws-load-meta-1">
            <div><span>tier</span><span>${TIER} · ${Math.round(innerWidth * devicePixelRatio)}×${Math.round(innerHeight * devicePixelRatio)} · ${navigator.hardwareConcurrency ?? '?'} cores${window.__ws_sw ? ' · offline cache' : ''}</span></div>
          </div>
          <div class="ws-load-track">
            <div class="ws-load-track-row"><span class="ws-load-track-name">download</span><span class="ws-load-track-fact" data-el="dlFact">—</span><span class="ws-load-track-pct" data-el="dlPct">0</span></div>
            <div class="ws-load-bar"><div class="ws-load-fill" data-el="dlBar"></div></div>
          </div>
          <div class="ws-load-track">
            <div class="ws-load-track-row"><span class="ws-load-track-name">setup</span><span class="ws-load-track-fact" data-el="suFact">—</span><span class="ws-load-track-pct" data-el="suPct">0</span></div>
            <div class="ws-load-bar"><div class="ws-load-fill" data-el="suBar"></div></div>
          </div>
          <div class="ws-load-log" data-el="rows"></div>
        </div>
      </div>
      <div class="ws-load-foot"><span>local build · unuploaded</span><span data-el="foot">an in-progress private project</span></div>`;
    document.body.appendChild(this.root);
    this.els = {};
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => { this.els[e.dataset.el!] = e; });
    this.rowsEl = this.els.rows;
    const tick = () => { this.tickClock(); this.raf = requestAnimationFrame(tick); };
    tick();
  }

  /** The plan publishes a view on every event; paint it. Integers floor, so 100 means done. */
  paint(v: ProgressView) {
    this.view = v;
    const pct = (f: number) => String(Math.floor(f * 100));
    this.els.dlPct.textContent = pct(v.download);
    this.els.suPct.textContent = pct(v.setup);
    this.els.dlBar.style.width = `${(v.download * 100).toFixed(1)}%`;
    this.els.suBar.style.width = `${(v.setup * 100).toFixed(1)}%`;
    this.els.dlFact.textContent = v.bytesTotal > 0
      ? `${formatMB(v.bytesRead)} / ${formatMB(v.bytesTotal)} · ${v.filesDone} / ${v.filesTotal} files${v.bytes && v.bytes.done < v.bytes.total ? ` · ${v.bytes.label}` : ''}`
      : 'nothing declared';
    this.els.suFact.textContent = `step ${Math.min(v.doneCount + 1, v.rows.length)} / ${v.rows.length} · ${v.label}${v.detail ? ` · ${v.detail}` : ''}`;
    this.root.dataset.download = pct(v.download);
    this.root.dataset.setup = pct(v.setup);
    this.root.dataset.step = v.step;
    this.paintRows();
    if (v.error) this.els.foot.textContent = v.error;
  }

  private paintRows() {
    const v = this.view; if (!v) return;
    // every step that has started, newest last; todo steps are not rows (nothing to say about them yet)
    const shown = v.rows.filter((r) => r.state !== 'todo');
    while (this.rowsEl.children.length < shown.length) { const d = document.createElement('div'); d.innerHTML = '<span class="ws-load-row-label"></span><span class="ws-load-row-detail"></span><span class="ws-load-row-ms"></span>'; this.rowsEl.appendChild(d); }
    shown.forEach((r, i) => {
      const el = this.rowsEl.children[i] as HTMLElement;
      el.className = r.state === 'on' ? 'on' : 'ok';
      (el.children[0] as HTMLElement).textContent = `▸ ${r.label}`;
      (el.children[1] as HTMLElement).textContent = r.detail;
      const ms = r.state === 'on' ? performance.now() - r.t0 : r.ms;
      (el.children[2] as HTMLElement).textContent = ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
    });
  }

  private tickClock() {
    const s = (performance.now() - this.t0) / 1000;
    this.els.clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
    // the running step's ms is live: repaint rows so its clock moves without a plan event
    if (this.view && !this.view.done) this.paintRows();
  }

  done(): Promise<void> {
    return new Promise((res) => setTimeout(() => {
      this.root.classList.add('hide');
      setTimeout(() => { cancelAnimationFrame(this.raf); this.root.remove(); res(); }, 700);
    }, 350));
  }
}

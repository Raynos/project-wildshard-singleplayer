import * as THREE from 'three';
import { CHUNK_ID, CHUNK_COORDS, CHUNK_SIZE, SEED } from '../core/config';

/**
 * Loading screen in the Wildshard staging identity. Shown before anything renders; each
 * build step reports through `step(label, fraction)`; asset downloads feed the bar through
 * three's DefaultLoadingManager. `done()` fades it out and resolves when it is gone.
 */
export class Loading {
  root: HTMLElement;
  private bar: HTMLElement;
  private pct: HTMLElement;
  private label: HTMLElement;
  private log: HTMLElement;
  private stepFrac = 0;
  private assetFrac = 0;
  private shown = 0;
  private raf = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'ws-loading';
    this.root.innerHTML = `
      <div class="ws-loading-head">
        <div class="ws-wordmark">Project <b>Wildshard</b></div>
        <div class="ws-tagline">A world that does not exist yet, arriving one chunk at a time.</div>
      </div>
      <div class="ws-loading-body">
        <div class="ws-glass ws-loading-panel">
          <div class="ws-ptitle">Loading chunk · <b>pine-hollow</b></div>
          <div class="ws-loading-meta">
            <div><span>chunk</span><span>${CHUNK_ID}</span></div>
            <div><span>grid</span><span>${CHUNK_COORDS}</span></div>
            <div><span>size</span><span>${CHUNK_SIZE} m × ${CHUNK_SIZE} m</span></div>
            <div><span>seed</span><span>0x${SEED.toString(16).toUpperCase().padStart(8, '0')}</span></div>
          </div>
          <div class="ws-loading-bar"><div class="ws-loading-fill"></div></div>
          <div class="ws-loading-row"><span class="ws-loading-label">Contacting staging server…</span><span class="ws-loading-pct">0%</span></div>
          <div class="ws-loading-log"></div>
        </div>
      </div>
      <div class="ws-loading-foot"><span>local build · unuploaded</span><span>an in-progress private project</span></div>`;
    document.body.appendChild(this.root);
    this.bar = this.root.querySelector('.ws-loading-fill')!;
    this.pct = this.root.querySelector('.ws-loading-pct')!;
    this.label = this.root.querySelector('.ws-loading-label')!;
    this.log = this.root.querySelector('.ws-loading-log')!;

    const mgr = THREE.DefaultLoadingManager;
    mgr.onProgress = (_url, loaded, total) => { this.assetFrac = total > 0 ? loaded / total : 0; };
    const tick = () => { this.render(); this.raf = requestAnimationFrame(tick); };
    tick();
  }

  /** Report a build step: `frac` is overall progress 0..1 reached *after* this step. */
  step(label: string, frac: number) {
    this.stepFrac = frac;
    this.label.textContent = label;
    const line = document.createElement('div');
    line.textContent = `▸ ${label}`;
    this.log.appendChild(line);
    while (this.log.children.length > 6) this.log.removeChild(this.log.firstChild!);
  }

  private render() {
    // step progress carries the bar; asset downloads smooth the gaps between steps
    const target = Math.min(1, this.stepFrac * 0.85 + this.assetFrac * 0.15);
    this.shown += (target - this.shown) * 0.12;
    this.bar.style.width = `${(this.shown * 100).toFixed(1)}%`;
    this.pct.textContent = `${Math.round(this.shown * 100)}%`;
  }

  done(): Promise<void> {
    this.stepFrac = 1; this.assetFrac = 1;
    this.label.textContent = 'Chunk ready';
    return new Promise((res) => setTimeout(() => {
      this.root.classList.add('hide');
      setTimeout(() => { cancelAnimationFrame(this.raf); this.root.remove(); res(); }, 700);
    }, 350));
  }
}

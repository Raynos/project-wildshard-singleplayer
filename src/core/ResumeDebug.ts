import type * as THREE from 'three';

/**
 * Black-screen-on-app-switch debugging modal. On every real resume (the page was hidden for more
 * than a second) a dismissible panel lists what happened, so a phone screenshot tells us which
 * black it was: the iOS snapshot (nothing wrong on our side, first frame fast), the drawing buffer
 * (readPixels black after resume), a lost GL context, or a gated / stalled loop.
 *
 * Sampled: the centre pixel of live frames 1/5/30 after resume (read inside the render task; black = 0,0,0),
 * the first five rAF gaps, first live frame delay, gl context events, snapshot
 * state, standalone mode, memory, and which lifecycle events fired in what order.
 */
export class ResumeDebug {
  private hiddenAt = 0;
  private events: string[] = [];
  private t0 = performance.now();
  private glLost = 0; private glRestored = 0; private glLostAt = 0;
  private modal?: HTMLElement;
  private enabled = !/[?&]rdbg=0/.test(location.search);

  constructor(private renderer: THREE.WebGLRenderer, private firstFrameAt: () => number, private gated: () => boolean, private snapshotState: () => string) {
    const log = (name: string) => this.events.push(`${name} @${this.ms()}`);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { this.hiddenAt = performance.now(); this.events = []; log('hidden'); }
      else { log('visible'); this.onResume(); }
    });
    window.addEventListener('pagehide', () => log('pagehide'));
    window.addEventListener('pageshow', (e) => log(`pageshow${(e as PageTransitionEvent).persisted ? ' (bfcache)' : ''}`));
    window.addEventListener('focus', () => log('focus'));
    window.addEventListener('blur', () => log('blur'));
    (document as unknown as { addEventListener(n: string, f: () => void): void }).addEventListener('freeze', () => log('freeze'));
    (document as unknown as { addEventListener(n: string, f: () => void): void }).addEventListener('resume', () => log('resume(lifecycle)'));
    renderer.domElement.addEventListener('webglcontextlost', () => { this.glLost++; this.glLostAt = performance.now(); log('webglcontextlost'); });
    renderer.domElement.addEventListener('webglcontextrestored', () => { this.glRestored++; log(`webglcontextrestored (+${Math.round(performance.now() - this.glLostAt)} ms)`); });
  }

  private ms() { return `${(performance.now() - this.t0).toFixed(0)}ms`; }

  private async onResume() {
    if (!this.enabled) return;
    const resumedAt = performance.now();
    const awayMs = this.hiddenAt ? resumedAt - this.hiddenAt : 0;
    if (awayMs < 1000) return; // a real app switch, not a tab flicker
    const rafGaps: number[] = []; let last = resumedAt;
    const rafs = new Promise<void>((res) => { let n = 0; const tick = (t: number) => { rafGaps.push(Math.round(t - last)); last = t; if (++n < 5) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    await new Promise((r) => setTimeout(r, 1500)); await rafs;
    const ff = this.firstFrameAt();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const lines = [
      `RESUME DEBUG · ${new Date().toLocaleTimeString()} · away ${(awayMs / 1000).toFixed(1)} s`,
      `first live frame: ${ff > resumedAt ? `+${Math.round(ff - resumedAt)} ms` : 'NONE within 1.5 s'} · loop gated (menu): ${this.gated() ? 'no' : 'YES'}`,
      `rAF gaps after resume (ms): ${rafGaps.join(', ')}`,
      `gl context: lost ×${this.glLost}, restored ×${this.glRestored}`,
      `snapshot: ${this.snapshotState()}`,
      `events: ${this.events.join(' → ') || '(none)'}`,
      `standalone PWA: ${(navigator as unknown as { standalone?: boolean }).standalone ? 'yes' : 'no'} · visible now: ${document.visibilityState} · focus: ${document.hasFocus()}`,
      `canvas ${this.renderer.domElement.width}×${this.renderer.domElement.height} · dpr ${this.renderer.getPixelRatio().toFixed(2)} · heap ${mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MB` : 'n/a'} · ${navigator.userAgent.match(/OS \d+_\d+/)?.[0] ?? ''}`,
    ];
    console.warn('[resume-debug]\n' + lines.join('\n'));
    this.show(lines);
  }

  private show(lines: string[]) {
    this.modal?.remove();
    const m = document.createElement('div');
    m.className = 'ws-rdbg';
    Object.assign(m.style, { position: 'fixed', left: '12px', right: '12px', top: 'calc(60px + env(safe-area-inset-top, 0px))', zIndex: '9999', background: 'rgba(6,10,18,0.96)', border: '2px solid #ff7a6b', color: '#fff', font: '12px/1.5 JetBrains Mono, Menlo, monospace', padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'auto' } as CSSStyleDeclaration);
    m.textContent = lines.join('\n');
    const btn = document.createElement('button');
    btn.textContent = 'DISMISS';
    Object.assign(btn.style, { display: 'block', marginTop: '10px', padding: '10px 18px', font: '700 14px Rajdhani, sans-serif', letterSpacing: '0.2em', background: '#ff7a6b', color: '#000', border: '0' } as CSSStyleDeclaration);
    btn.onclick = () => m.remove();
    m.appendChild(btn);
    document.body.appendChild(m);
    this.modal = m;
  }
}

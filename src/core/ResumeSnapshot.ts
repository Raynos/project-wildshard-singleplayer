import type * as THREE from 'three';

/**
 * iOS black-screen-on-app-switch fix. iOS snapshots the screen to show while a backgrounded app
 * resumes, and WebGL layers are NOT captured — so the game's canvas is black in that snapshot for
 * 1–2 s on return. A standalone PWA may also be snapshotted before `visibilitychange` runs, so
 * waiting for the event is not enough: a low-res mirror of the last frame is kept in a plain 2D
 * canvas UNDER the game canvas at all times (a 1/6-scale readback every MIRROR_MS, tens of KB),
 * and on `hidden` a full-res copy is painted OVER the canvas. Both are ordinary DOM layers iOS does
 * snapshot. The overlay drops after the first two live frames; the mirror is always there.
 *
 * The drawing buffer is only intact within the task that rendered it (no preserveDrawingBuffer),
 * so every capture renders and reads back in the same task.
 */
const MIRROR_MS = 300;
const MIRROR_SCALE = 1 / 6;

export class ResumeSnapshot {
  private overlay: HTMLCanvasElement;   // full-res, over the canvas, shown only across a background/foreground
  private mirror: HTMLCanvasElement;    // low-res, under the canvas, always current
  private octx: CanvasRenderingContext2D;
  private mctx: CanvasRenderingContext2D;
  private flip = document.createElement('canvas');
  private pixels?: Uint8Array;
  private small?: Uint8Array;
  private pendingFrames = 0;
  private lastMirror = 0;
  /** resume timing for the perf meter: when we became visible, and when the first live frame followed */
  resumedAt = 0; firstFrameAt = 0; resumes = 0;
  /** centre pixel of live frames 1 / 5 / 30 after a resume, read inside the render task (the only place the buffer is valid) */
  liveSamples: string[] = []; private framesSinceResume = 0;

  constructor(private renderer: THREE.WebGLRenderer, private renderFrame: () => void, private worldVisible: () => boolean) {
    const mk = (z: string) => {
      const c = document.createElement('canvas');
      Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: z, pointerEvents: 'none' });
      document.body.appendChild(c);
      return c;
    };
    this.overlay = mk('5'); this.overlay.className = 'ws-resume'; this.overlay.hidden = true;
    this.mirror = mk('-1'); this.mirror.className = 'ws-resume-mirror'; // under the canvas (#game is z-index auto in the flow)
    this.octx = this.overlay.getContext('2d')!;
    this.mctx = this.mirror.getContext('2d')!;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.capture();
      else { this.pendingFrames = 2; this.resumedAt = performance.now(); this.firstFrameAt = 0; this.resumes++; this.framesSinceResume = 0; this.liveSamples = []; }
    });
    window.addEventListener('pagehide', () => this.capture());
  }

  /** For the debug modal: what the overlay / mirror hold right now. */
  describe() { return `live centre pixel ${this.liveSamples.join(' · ') || '(no live frame yet)'} · overlay ${this.overlay.hidden ? 'hidden' : 'SHOWING'} (${this.overlay.width}×${this.overlay.height}) · mirror ${this.mirror.width}×${this.mirror.height} age ${Math.round(performance.now() - this.lastMirror)} ms`; }

  /** Called by the loop after each rendered frame — inside the render task, so the buffer is readable. */
  afterFrame(now: number) {
    if (this.resumedAt && !this.firstFrameAt) this.firstFrameAt = now;
    if (this.resumedAt && this.framesSinceResume < 30) {
      const f = ++this.framesSinceResume;
      if (f === 1 || f === 5 || f === 30) {
        try { const gl = this.renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); this.liveSamples.push(`f${f}: ${px[0]},${px[1]},${px[2]}${px[0] + px[1] + px[2] === 0 ? ' BLACK' : ''}`); } catch { /* ignore */ }
      }
    }
    if (!this.overlay.hidden && this.pendingFrames > 0 && --this.pendingFrames === 0) this.overlay.hidden = true;
    if (now - this.lastMirror >= MIRROR_MS && this.worldVisible()) { this.lastMirror = now; this.mirrorFrame(); }
  }

  /** Low-res readback of the frame just drawn into the always-present mirror. */
  private mirrorFrame() {
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const w = Math.max(1, Math.round(W * MIRROR_SCALE)), h = Math.max(1, Math.round(H * MIRROR_SCALE));
    try {
      // read the whole buffer at a stride: sample every Nth pixel by reading rows into a reusable buffer
      if (!this.pixels || this.pixels.length !== W * H * 4) this.pixels = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      if (!this.small || this.small.length !== w * h * 4) this.small = new Uint8Array(w * h * 4);
      const sx = W / w, sy = H / h, src = this.pixels, dst = this.small;
      for (let y = 0; y < h; y++) {
        const srow = (H - 1 - Math.min(H - 1, Math.floor((y + 0.5) * sy))) * W; // flip while sampling
        for (let x = 0; x < w; x++) {
          const si = (srow + Math.min(W - 1, Math.floor((x + 0.5) * sx))) * 4, di = (y * w + x) * 4;
          dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = 255;
        }
      }
      if (this.mirror.width !== w || this.mirror.height !== h) { this.mirror.width = w; this.mirror.height = h; }
      const img = this.mctx.createImageData(w, h); img.data.set(dst); this.mctx.putImageData(img, 0, 0);
    } catch (e) { console.warn('[resume] mirror failed', e); }
  }

  /** Full-res copy over the canvas the moment we go to the background. */
  private capture() {
    if (!this.worldVisible()) return; // the menu's hero art covers the canvas: the DOM snapshot is already right
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (!w || !h) return;
    try {
      this.renderFrame();
      if (!this.pixels || this.pixels.length !== w * h * 4) this.pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      this.flip.width = w; this.flip.height = h;
      const fctx = this.flip.getContext('2d')!;
      const img = fctx.createImageData(w, h); img.data.set(this.pixels.subarray(0, w * h * 4)); fctx.putImageData(img, 0, 0);
      this.overlay.width = w; this.overlay.height = h;
      this.octx.save(); this.octx.scale(1, -1); this.octx.drawImage(this.flip, 0, -h); this.octx.restore();
      this.overlay.hidden = false;
      this.pendingFrames = 0;
    } catch (e) { console.warn('[resume] snapshot failed', e); }
  }
}

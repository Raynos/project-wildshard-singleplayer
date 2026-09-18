import type * as THREE from 'three';

/**
 * iOS black-screen-on-app-switch fix. When the app goes to the background iOS snapshots the screen
 * to show while the web view resumes — and WebGL layers are NOT captured, so the game's canvas is
 * black in that snapshot for 1–2 s on return. The moment we go hidden we draw the last frame into a
 * plain 2D canvas over the game (that one IS snapshotted); on return it stays up until the first
 * live frame has been drawn, then goes away.
 *
 * The drawing buffer is only intact within the task that rendered it (no preserveDrawingBuffer), so
 * the render and the readPixels happen back to back inside the visibilitychange handler.
 */
export class ResumeSnapshot {
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private flip?: HTMLCanvasElement;
  private pixels?: Uint8Array;
  private pendingFrames = 0;
  /** true while the overlay is showing a stale frame (the loop must draw one frame to clear it) */
  get showing() { return !this.overlay.hidden; }

  constructor(private renderer: THREE.WebGLRenderer, private renderFrame: () => void, private worldVisible: () => boolean) {
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'ws-resume';
    this.overlay.hidden = true;
    Object.assign(this.overlay.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '5', pointerEvents: 'none' });
    document.body.appendChild(this.overlay);
    this.ctx = this.overlay.getContext('2d')!;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.capture();
      else this.pendingFrames = 2; // drop the overlay once two live frames have been composited
    });
    window.addEventListener('pagehide', () => this.capture());
  }

  /** Called by the loop after each rendered frame. */
  afterFrame() {
    if (this.overlay.hidden || this.pendingFrames <= 0) return;
    if (--this.pendingFrames === 0) this.overlay.hidden = true;
  }

  private capture() {
    if (!this.worldVisible()) return; // the menu's hero art covers the canvas: the DOM snapshot is already right
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (!w || !h) return;
    try {
      this.renderFrame();
      if (!this.pixels || this.pixels.length !== w * h * 4) this.pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      // GL rows are bottom-up: put into a scratch canvas, then draw flipped into the overlay
      if (!this.flip) this.flip = document.createElement('canvas');
      this.flip.width = w; this.flip.height = h;
      const fctx = this.flip.getContext('2d')!;
      const img = fctx.createImageData(w, h); img.data.set(this.pixels.subarray(0, w * h * 4)); fctx.putImageData(img, 0, 0);
      this.overlay.width = w; this.overlay.height = h;
      this.ctx.save();
      this.ctx.scale(1, -1);
      this.ctx.drawImage(this.flip, 0, -h);
      this.ctx.restore();
      this.overlay.hidden = false;
      this.pendingFrames = 0;
    } catch (e) { console.warn('[resume] snapshot failed', e); }
  }
}

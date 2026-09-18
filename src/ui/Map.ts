/**
 * The full map — tap the minimap to open it; CLOSE / Esc / M closes it.
 *
 * The whole 500 m chunk, north-up, drawn from the Minimap's own terrain layer (hillshade, pond,
 * trails, crowns, cabin roofs) with the same fog of war; points of interest (the cabins, the pond)
 * named; your arrow. No animal markers — the map is for finding your way, not for finding prey.
 * Drag to pan, pinch or wheel to zoom (1× = the chunk fitted to the screen, up to 6×). The world
 * keeps running underneath; the overlay swallows touch so the pads don't move you.
 */
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { getActiveChunk } from '../chunks/registry';
import type { Minimap } from './Minimap';

const FOG_BRIGHTNESS = 0.3;
const ZOOM_MIN = 1, ZOOM_MAX = 6;

export class FullMap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fog = document.createElement('canvas');
  private title: HTMLDivElement;
  private open = false;
  // view: world point at the screen centre + zoom
  private cx = 0; private cz = 0; private zoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0; private pinchZoom = 1;
  onToggle?: (open: boolean) => void;

  constructor(private minimap: Minimap) {
    this.root = document.createElement('div');
    this.root.className = 'ws-map';
    Object.assign(this.root.style, { position: 'fixed', inset: '0', zIndex: '70', background: 'rgba(4, 7, 12, 0.985)', display: 'none', pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', overflow: 'hidden' } as CSSStyleDeclaration);
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } as CSSStyleDeclaration);
    this.ctx = this.canvas.getContext('2d')!;
    this.title = document.createElement('div');
    Object.assign(this.title.style, { position: 'absolute', left: '16px', top: 'calc(var(--ws-top, 16px) + 6px)', font: '700 18px Rajdhani, sans-serif', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.8)', pointerEvents: 'none' } as CSSStyleDeclaration);
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'CLOSE';
    Object.assign(close.style, { position: 'absolute', right: '16px', top: 'calc(var(--ws-top, 16px) + 2px)', padding: '12px 22px', font: '700 15px Rajdhani, sans-serif', letterSpacing: '0.24em', color: '#8fe3ff', background: 'rgba(6, 10, 18, 0.85)', border: '1px solid #8fe3ff', pointerEvents: 'auto', zIndex: '2' } as CSSStyleDeclaration);
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    close.addEventListener('click', () => this.hide());
    const hint = document.createElement('div');
    hint.textContent = 'drag to pan · pinch to zoom';
    Object.assign(hint.style, { position: 'absolute', left: '0', right: '0', bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', font: '10px JetBrains Mono, Menlo, monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(196, 220, 232, 0.5)', pointerEvents: 'none' } as CSSStyleDeclaration);
    this.root.append(this.canvas, this.title, close, hint);
    document.body.appendChild(this.root);

    // pan / pinch
    this.canvas.addEventListener('pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.pointers.size === 2) { this.pinchDist = this.dist(); this.pinchZoom = this.zoom; } });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      if (this.pointers.size === 1) { this.panBy(e.clientX - p.x, e.clientY - p.y); }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinchDist > 0) { const d = this.dist(); this.zoomTo(this.pinchZoom * (d / this.pinchDist), this.mid()); }
    });
    const end = (e: PointerEvent) => { this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinchDist = 0; };
    this.canvas.addEventListener('pointerup', end); this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomTo(this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY }); }, { passive: false });
    document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.open) this.hide(); else if (e.code === 'KeyM') this.toggle(); });
    // the minimap is the map button
    minimap.root.style.pointerEvents = 'auto';
    minimap.root.style.cursor = 'pointer';
    minimap.root.addEventListener('pointerup', (e) => { e.stopPropagation(); this.show(); });
    window.addEventListener('resize', () => { if (this.open) this.fit(); });
  }

  get isOpen() { return this.open; }
  toggle() { if (this.open) this.hide(); else this.show(); }
  show() {
    if (this.open) return;
    this.open = true;
    this.root.style.display = 'block';
    this.title.textContent = `${getActiveChunk().displayName} · ${CHUNK_SIZE} m`;
    this.cx = 0; this.cz = 0; this.zoom = 1;
    this.fit();
    this.onToggle?.(true);
  }
  hide() { if (!this.open) return; this.open = false; this.root.style.display = 'none'; this.pointers.clear(); this.onToggle?.(false); }

  private dpr = 1;
  private fit() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }
  /** screen px (device) per metre at the current zoom */
  private ppm() { return (Math.min(this.canvas.width, this.canvas.height) * 0.9 / CHUNK_SIZE) * this.zoom; }
  private dist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  private mid() { const [a, b] = [...this.pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  private panBy(dxCss: number, dyCss: number) {
    const k = this.dpr / this.ppm();
    this.cx += dxCss * k;  // screen right = world −X (the minimap's convention: −X is east)
    this.cz += dyCss * k;  // screen down = world −Z
    this.clamp();
  }
  private zoomTo(z: number, aroundCss: { x: number; y: number }) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    // keep the world point under the finger fixed
    const before = this.toWorld(aroundCss);
    this.zoom = nz;
    const after = this.toWorld(aroundCss);
    this.cx += before.x - after.x; this.cz += before.z - after.z;
    this.clamp();
  }
  private toWorld(css: { x: number; y: number }) {
    const ppm = this.ppm(), W = this.canvas.width, H = this.canvas.height;
    return { x: this.cx - (css.x * this.dpr - W / 2) / ppm, z: this.cz - (css.y * this.dpr - H / 2) / ppm };
  }
  private clamp() { const m = CHUNK_HALF * (1 - 0.5 / this.zoom); this.cx = Math.max(-m, Math.min(m, this.cx)); this.cz = Math.max(-m, Math.min(m, this.cz)); }

  /** Every frame while open. */
  update(pos: { x: number; z: number }, yaw: number) {
    if (!this.open) return;
    const { terrain, cover } = this.minimap.layers;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, ppm = this.ppm(), side = CHUNK_SIZE * ppm;
    const sx = (x: number) => W / 2 + (this.cx - x) * ppm;   // −X is east (screen right)
    const sz = (z: number) => H / 2 + (this.cz - z) * ppm;   // +Z is north (screen up)
    const ox = sx(CHUNK_HALF), oy = sz(CHUNK_HALF);           // the chunk's NE corner on screen

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrain, ox, oy, side, side);

    // fog of war, same rule as the minimap: unexplored ground at FOG_BRIGHTNESS (fog canvas at screen res, clipped to the view)
    if (this.fog.width !== W || this.fog.height !== H) { this.fog.width = W; this.fog.height = H; }
    const fc = this.fog.getContext('2d')!;
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, W, H);
    fc.fillStyle = `rgba(0, 0, 0, ${1 - FOG_BRIGHTNESS})`;
    fc.fillRect(ox, oy, side, side);
    fc.globalCompositeOperation = 'destination-out';
    fc.drawImage(cover, ox, oy, side, side);
    ctx.drawImage(this.fog, 0, 0);

    // chunk edge
    ctx.strokeStyle = 'rgba(143, 227, 255, 0.55)'; ctx.lineWidth = 1.5 * this.dpr;
    ctx.strokeRect(ox, oy, side, side);

    // points of interest
    const fs = Math.max(11 * this.dpr, side * 0.022 / this.zoom);
    ctx.font = `${fs}px JetBrains Mono, Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const poi = (x: number, z: number, label: string, color: string) => {
      const px = sx(x), py = sz(z), r = Math.max(4 * this.dpr, fs * 0.35);
      ctx.fillStyle = color; ctx.strokeStyle = 'rgba(6, 10, 18, 0.9)'; ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)'; ctx.lineWidth = 3 * this.dpr; ctx.strokeText(label, px, py + r + 3 * this.dpr);
      ctx.fillText(label, px, py + r + 3 * this.dpr);
    };
    CABIN_SITES.forEach((c, i) => poi(c.x, c.z, `CABIN ${i + 1}`, '#8fe3ff'));
    if (hasPond()) poi(POND.x, POND.z, 'THE POND', '#6fb8e8');

    // you
    const deg = 180 - (yaw * 180) / Math.PI;
    const px = sx(pos.x), py = sz(pos.z), r = Math.max(7 * this.dpr, fs * 0.6);
    ctx.save();
    ctx.translate(px, py); ctx.rotate((deg * Math.PI) / 180);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(6, 10, 18, 0.9)'; ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 0.9, r); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * 0.9, r); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = this.dpr;
    ctx.beginPath(); ctx.arc(px, py, r * 2.2, 0, Math.PI * 2); ctx.stroke();

    // N marker at the top edge of the chunk
    ctx.fillStyle = '#8fe3ff'; ctx.font = `700 ${Math.max(12 * this.dpr, fs * 1.3)}px Rajdhani, sans-serif`; ctx.textBaseline = 'bottom';
    ctx.fillText('N', ox + side / 2, oy - 4 * this.dpr);
  }
}

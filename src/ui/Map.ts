/**
 * The full map — the MAP tab of the in-game menu (src/ui/Menu.ts): tap the minimap or press M.
 *
 * The whole 500 m chunk, north-up, drawn from the Minimap's own terrain layer (hillshade, pond,
 * trails, crowns, cabin roofs) with the same fog of war; points of interest (the cabins, the pond)
 * named; your arrow. No animal markers — the map is for finding your way, not for finding prey.
 * Drag to pan, pinch or wheel to zoom (1× = the chunk fitted to the frame, up to 6×). The world
 * keeps running underneath; the canvas swallows touch so the pads don't move you.
 *
 *   const fullMap = new FullMap(minimap);   // builds the canvas only
 *   fullMap.mount(frame)                    // the menu puts it in its map frame (Menu.ts); show()/hide() are the menu's
 *   fullMap.setZoom(2) / fullMap.zoom / fullMap.onZoom / fullMap.fit()
 */
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import type { Minimap } from './Minimap';

const FOG_BRIGHTNESS = 0.3;
const ZOOM_MIN = 1, ZOOM_MAX = 6;

export class FullMap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fog = document.createElement('canvas');
  private open = false;
  // view: world point at the frame centre + zoom
  private cx = 0; private cz = 0; private _zoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0; private pinchZoom = 1;
  onToggle?: (open: boolean) => void;
  /** the zoom changed (pinch / wheel / setZoom) — the menu's zoom chips follow */
  onZoom?: (zoom: number) => void;

  constructor(private minimap: Minimap) {
    this.root = document.createElement('div');
    this.root.className = 'ws-gmenu-mapcanvas';
    Object.assign(this.root.style, { position: 'absolute', inset: '0', display: 'none', pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', overflow: 'hidden' } as CSSStyleDeclaration);
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } as CSSStyleDeclaration);
    this.ctx = this.canvas.getContext('2d')!;
    this.root.append(this.canvas);

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
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomTo(this._zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY }); }, { passive: false });
  }

  /** put the map in its frame (the menu's MAP tab); the frame is the map's viewport */
  mount(frame: HTMLElement) { frame.appendChild(this.root); }
  /** the minimap as a button: `onTap` (the menu opens on the Map tab) */
  bindMinimap(onTap: () => void) {
    const m = this.minimap.root;
    m.style.pointerEvents = 'auto';
    m.style.cursor = 'pointer';
    m.style.zIndex = '6'; // above the phone's full-screen touch layer (.ws-touch, z-index 5), which would otherwise eat the tap
    m.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    m.addEventListener('pointerup', (e) => { e.stopPropagation(); onTap(); });
  }

  get isOpen() { return this.open; }
  get zoom() { return this._zoom; }
  /** zoom about the frame centre (the menu's 1× / 2× / 4× chips) */
  setZoom(z: number) { const r = this.canvas.getBoundingClientRect(); this.zoomTo(z, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  show() {
    if (this.open) return;
    this.open = true;
    this.root.style.display = 'block';
    this.cx = 0; this.cz = 0; this._zoom = 1;
    this.fit();
    this.onToggle?.(true);
    this.onZoom?.(1);
  }
  hide() { if (!this.open) return; this.open = false; this.root.style.display = 'none'; this.pointers.clear(); this.onToggle?.(false); }

  private dpr = 1;
  /** size the canvas to its frame (call after the frame resizes) */
  fit() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }
  /** screen px (device) per metre at the current zoom */
  private ppm() { return (Math.min(this.canvas.width, this.canvas.height) * 0.9 / CHUNK_SIZE) * this._zoom; }
  private dist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  private mid() { const [a, b] = [...this.pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  private panBy(dxCss: number, dyCss: number) {
    const k = this.dpr / this.ppm();
    this.cx += dxCss * k;  // screen right = world −X (the minimap's convention: −X is east)
    this.cz += dyCss * k;  // screen down = world −Z
    this.clamp();
  }
  private zoomTo(z: number, aroundClient: { x: number; y: number }) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    // keep the world point under the finger fixed
    const before = this.toWorld(aroundClient);
    this._zoom = nz;
    const after = this.toWorld(aroundClient);
    this.cx += before.x - after.x; this.cz += before.z - after.z;
    this.clamp();
    this.onZoom?.(nz);
  }
  /** client (viewport) CSS px → world; the canvas may sit anywhere in the page */
  private toWorld(client: { x: number; y: number }) {
    const r = this.canvas.getBoundingClientRect();
    const ppm = this.ppm(), W = this.canvas.width, H = this.canvas.height;
    return { x: this.cx - ((client.x - r.left) * this.dpr - W / 2) / ppm, z: this.cz - ((client.y - r.top) * this.dpr - H / 2) / ppm };
  }
  private clamp() { const m = CHUNK_HALF * (1 - 0.5 / this._zoom); this.cx = Math.max(-m, Math.min(m, this.cx)); this.cz = Math.max(-m, Math.min(m, this.cz)); }

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
    const fs = Math.max(11 * this.dpr, side * 0.022 / this._zoom);
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

/**
 * The full map — the MAP tab of the in-game menu (src/ui/Menu.ts): tap the minimap or press M.
 *
 * The whole 500 m chunk, north-up, drawn from the Minimap's own terrain layer (hillshade, pond,
 * trails, crowns, cabin roofs) with the same fog of war; points of interest (the cabins, the pond)
 * named; your arrow. No animal markers — the map is for finding your way, not for finding prey.
 * Zoomed in, the ground is repainted sharp: TILE_PX tiles at the screen's own px/m (Minimap.paintTile), a few per
 * frame over the stretched layer, cached (E97: the 2 px/m layer alone went to mush at 4–6×).
 * Drag to pan, pinch or wheel to zoom (1× = the chunk fitted to the frame, up to 6×). The world
 * keeps running underneath; the canvas swallows touch so the pads don't move you.
 *
 *   const fullMap = new FullMap(minimap);   // builds the canvas only
 *   fullMap.mount(frame)                    // the menu puts it in its map frame (Menu.ts); show()/hide() are the menu's
 *   fullMap.setZoom(2) / fullMap.zoom / fullMap.onZoom / fullMap.fit()
 *   fullMap.setPois(() => MapPoi[])        // a shard's own points of interest (Driftwood: its places with discovery + the
 *                                          // quest's markers, src/game/quest/Places.ts); unset = the cabins / pond as before
 *   fullMap.setQuest(() => MapQuest|null)  // the quest in full — title, objective, sub-steps — for the MAP tab's card (E51)
 */
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { LAYER_PPM, type Minimap } from './Minimap';

/** a point on the full map: a discovered place (named), an undiscovered one ("?"), or a live quest marker (pulsing diamond) */
export interface MapPoi { x: number; z: number; label: string; kind: 'place' | 'unknown' | 'quest' }
/** the quest in full for the MAP tab's quest card (the HUD only shows its short chip, E51): chapter title, objective, sub-steps */
export interface MapQuest { title: string; objective: string; hint: string }

const FOG_BRIGHTNESS = 0.3;
const ZOOM_MIN = 1, ZOOM_MAX = 6;
const TILE_PX = 256;          // a zoom tile's side, device px
const TILE_CACHE = 64;        // tiles kept (256 KB each)
const TILE_BUDGET_MS = 6;     // painting new tiles, per frame
const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => { const ctx = c.getContext('2d'); if (!ctx) throw new Error('FullMap: no 2d context'); return ctx; };

export class FullMap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fog = document.createElement('canvas');
  private fc = ctx2d(this.fog);
  private open = false;
  // view: world point at the frame centre + zoom
  private cx = 0; private cz = 0; private _zoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0; private pinchZoom = 1;
  onToggle?: (open: boolean) => void;
  private poiSource: (() => MapPoi[]) | null = null;
  /** move a quest marker's label off a place's label it would cover (setPois' `declutter`; Nalati only) */
  private declutter = false;
  private questSource: (() => MapQuest | null) | null = null;
  /** the zoom changed (pinch / wheel / setZoom) — the menu's zoom chips follow */
  onZoom?: (zoom: number) => void;

  constructor(private minimap: Minimap) {
    this.root = document.createElement('div');
    this.root.className = 'ws-gmenu-mapcanvas';
    Object.assign(this.root.style, { position: 'absolute', inset: '0', display: 'none', pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', overflow: 'hidden' } as CSSStyleDeclaration);
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } as CSSStyleDeclaration);
    this.ctx = ctx2d(this.canvas);
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
  mount(frame: HTMLElement): void { frame.append(this.root); }
  /** the minimap as a button: `onTap` (the menu opens on the Map tab) */
  bindMinimap(onTap: () => void): void {
    const m = this.minimap.root;
    m.style.pointerEvents = 'auto';
    m.style.cursor = 'pointer';
    m.style.zIndex = '6'; // above the phone's full-screen touch layer (.ws-touch, z-index 5), which would otherwise eat the tap
    m.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    m.addEventListener('pointerup', (e) => { e.stopPropagation(); onTap(); });
  }

  get isOpen(): boolean { return this.open; }
  /** replace the default points of interest (cabins, pond) with the shard's own list, read every frame the map is open;
   *  `declutter`: a quest marker's label that would cover a place's name goes above its diamond (NALATI-MERGE F11: the
   *  elder's "BAQYT ATA" sat on "NOMAD CAMP"). Off by default, so a shard that does not ask draws exactly as before */
  setPois(source: () => MapPoi[], opts: { declutter?: boolean } = {}): void { this.poiSource = source; this.declutter = opts.declutter === true; }
  /** the shard's quest, read by the menu each time the MAP tab shows (null = no quest card) */
  setQuest(source: () => MapQuest | null): void { this.questSource = source; }
  get quest(): MapQuest | null { return this.questSource?.() ?? null; }
  get zoom(): number { return this._zoom; }
  /** zoom about the frame centre (the menu's 1× / 2× / 4× chips) */
  setZoom(z: number): void { const r = this.canvas.getBoundingClientRect(); this.zoomTo(z, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  show(): void {
    if (this.open) return;
    this.open = true;
    this.root.style.display = 'block';
    this.cx = 0; this.cz = 0; this._zoom = 1;
    this.fit();
    this.onToggle?.(true);
    this.onZoom?.(1);
  }
  hide(): void { if (!this.open) return; this.open = false; this.root.style.display = 'none'; this.pointers.clear(); this.onToggle?.(false); }

  private dpr = 1;
  /** size the canvas to its frame (call after the frame resizes) */
  fit(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }
  /** screen px (device) per metre at the current zoom */
  private ppm() { return (Math.min(this.canvas.width, this.canvas.height) * 0.9 / CHUNK_SIZE) * this._zoom; }
  private pair(): [{ x: number; y: number }, { x: number; y: number }] { const [a, b] = [...this.pointers.values()]; if (!a || !b) throw new Error('FullMap: pinch needs two pointers'); return [a, b]; }
  private dist(): number { const [a, b] = this.pair(); return Math.hypot(a.x - b.x, a.y - b.y); }
  private mid(): { x: number; y: number } { const [a, b] = this.pair(); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
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
  update(pos: { x: number; z: number }, yaw: number): void {
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
    this.drawTiles(ox, oy, ppm);

    // fog of war, same rule as the minimap: unexplored ground at FOG_BRIGHTNESS (fog canvas at screen res, clipped to the view)
    if (this.fog.width !== W || this.fog.height !== H) { this.fog.width = W; this.fog.height = H; }
    const fc = this.fc;
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
    if (this.poiSource) this.drawPois(this.poiSource(), sx, sz, fs, poi);
    else {
      CABIN_SITES.forEach((c, i) => poi(c.x, c.z, `CABIN ${i + 1}`, '#8fe3ff'));
      if (hasPond()) poi(POND.x, POND.z, 'THE POND', '#6fb8e8');
    }

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

  // ── zoom tiles: the ground at the screen's own resolution, level ℓ = LAYER_PPM · 2^ℓ px/m ──
  private tiles = new Map<string, HTMLCanvasElement>();
  private tilesGen = -1;
  private drawTiles(ox: number, oy: number, ppm: number): void {
    if (this.tilesGen !== this.minimap.layerGen) { this.tiles.clear(); this.tilesGen = this.minimap.layerGen; }
    if (ppm <= LAYER_PPM * 1.25) return;
    const level = Math.min(4, Math.ceil(Math.log2(ppm / LAYER_PPM)));
    const W = this.canvas.width, H = this.canvas.height, t0 = performance.now(), side = CHUNK_SIZE * ppm;
    this.ctx.save();
    this.ctx.beginPath(); this.ctx.rect(ox, oy, side, side); this.ctx.clip(); // the chunk's last tiles run past its edge
    // the level below first (cached tiles only), so crossing a level mid-pinch never drops back to the stretched layer
    for (const l of level > 1 ? [level - 1, level] : [level]) {
      const tm = TILE_PX / (LAYER_PPM * 2 ** l), n = Math.ceil(CHUNK_SIZE / tm); // tile side in metres, tiles per chunk side
      const clampI = (v: number) => Math.max(0, Math.min(n - 1, v));
      const i0 = clampI(Math.floor(-ox / ppm / tm)), i1 = clampI(Math.floor((W - ox) / ppm / tm));
      const j0 = clampI(Math.floor(-oy / ppm / tm)), j1 = clampI(Math.floor((H - oy) / ppm / tm));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const key = `${l}:${i}:${j}`;
        let tile = this.tiles.get(key);
        if (tile) { this.tiles.delete(key); this.tiles.set(key, tile); } // most recently used last
        else if (l === level && performance.now() - t0 < TILE_BUDGET_MS) {
          tile = document.createElement('canvas');
          this.minimap.paintTile(tile, i * tm, j * tm, tm, TILE_PX);
          this.tiles.set(key, tile);
          if (this.tiles.size > TILE_CACHE) { const oldest = this.tiles.keys().next().value; if (oldest !== undefined) this.tiles.delete(oldest); }
        }
        if (!tile) continue;
        // snap to whole device px so neighbouring tiles meet without a hairline seam
        const x0 = Math.round(ox + i * tm * ppm), x1 = Math.round(ox + (i + 1) * tm * ppm);
        const y0 = Math.round(oy + j * tm * ppm), y1 = Math.round(oy + (j + 1) * tm * ppm);
        this.ctx.drawImage(tile, x0, y0, x1 - x0, y1 - y0);
      }
    }
    this.ctx.restore();
  }

  /** a shard's own POIs: places (named dots), undiscovered places (dim "?"), quest markers (pulsing cyan diamonds, on top) */
  private drawPois(list: MapPoi[], sx: (x: number) => number, sz: (z: number) => number, fs: number, poi: (x: number, z: number, label: string, color: string) => void): void {
    const ctx = this.ctx, d = this.dpr;
    for (const p of list) {
      if (p.kind === 'place') poi(p.x, p.z, p.label, '#e6f2f8');
      else if (p.kind === 'unknown') {
        const px = sx(p.x), py = sz(p.z), r = Math.max(3.5 * d, fs * 0.3);
        ctx.fillStyle = 'rgba(196, 220, 232, 0.35)'; ctx.strokeStyle = 'rgba(6, 10, 18, 0.8)'; ctx.lineWidth = 1.5 * d;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(230, 242, 248, 0.7)'; ctx.fillText('?', px, py + r + 3 * d);
      }
    }
    // declutter: the boxes the place names (and the "?"s) take, then each quest label's, so a marker's label that would
    // land on one goes above its diamond instead
    const taken: Box[] = [];
    if (this.declutter) {
      for (const p of list) {
        if (p.kind === 'quest') continue;
        const px = sx(p.x), py = sz(p.z), r = p.kind === 'place' ? Math.max(4 * d, fs * 0.35) : Math.max(3.5 * d, fs * 0.3);
        taken.push(labelBox(ctx, p.kind === 'place' ? p.label : '?', px, py + r + 3 * d, fs));
      }
    }
    const pulse = (performance.now() % 1600) / 1600;
    for (const p of list) {
      if (p.kind !== 'quest') continue;
      const px = sx(p.x), py = sz(p.z), r = Math.max(6 * d, fs * 0.55);
      let ly = py + r + 3 * d;
      if (this.declutter) {
        const below = labelBox(ctx, p.label, px, ly, fs), above = labelBox(ctx, p.label, px, py - r - 3 * d - fs, fs);
        const hits = (b: Box) => taken.some((t) => b.x0 < t.x1 && b.x1 > t.x0 && b.y0 < t.y1 && b.y1 > t.y0);
        const pick = hits(below) && !hits(above) ? above : below;
        ly = pick.y0; taken.push(pick);
      }
      ctx.strokeStyle = `rgba(143, 227, 255, ${0.7 * (1 - pulse)})`; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.arc(px, py, r * (1.2 + pulse * 1.6), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#8fe3ff'; ctx.strokeStyle = 'rgba(6, 10, 18, 0.9)'; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r, py); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8fe3ff'; ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)'; ctx.lineWidth = 3 * d;
      ctx.strokeText(p.label, px, ly); ctx.fillText(p.label, px, ly);
    }
  }
}

interface Box { x0: number; y0: number; x1: number; y1: number }
/** the box a centred, top-baseline label takes at (x, top) in the current font (fs px tall) */
function labelBox(ctx: CanvasRenderingContext2D, label: string, x: number, top: number, fs: number): Box {
  const w = ctx.measureText(label).width;
  return { x0: x - w / 2, y0: top, x1: x + w / 2, y1: top + fs };
}

import { app } from '../app/runtime';
import type { UiHandle } from './layers';
import type { Scope } from '../app/scope';
import { uiScope, mountUi } from './ownership';
import { currentOwner } from '../app/ownership';
import { engineString } from '../strings';
/**
 * The full map — the MAP tab of the in-game menu (src/engine/ui/Menu.ts): tap the minimap or press M.
 *
 * The whole 500 m chunk, north-up, drawn from the Minimap's own ground layer — the shard's map baked from the world (SF66,
 * `MinimapSpec.image`), else the painted terrain (hillshade, pond, trails, crowns, cabin roofs) — with the same fog of war;
 * points of interest named (the shard's own list, else its manifest's places, else the cabins and the pond); your arrow. No
 * animal markers — the map is for finding your way, not for finding prey.
 * Zoomed in, a painted ground is repainted sharp: TILE_PX tiles at the screen's own px/m (Minimap.paintTile), a few per
 * frame over the stretched layer, cached (E97: the 2 px/m layer alone went to mush at 4–6×). A baked map is drawn as it is.
 * Around the chunk, `setExtras` lays out more ground as data (the grid: every cell's baked map at its cell, the road network
 * and each shard's name; SF66), and the view then spans all of it.
 * Drag to pan, pinch or wheel to zoom (1× = the chunk fitted to the frame, up to 6×). The world
 * keeps running underneath; the canvas swallows touch so the pads don't move you.
 *
 *   const fullMap = new FullMap(minimap);   // builds the canvas only
 *   fullMap.mount(frame)                    // the menu puts it in its map frame (Menu.ts); show()/hide() are the menu's
 *   fullMap.setZoom(2) / fullMap.zoom / fullMap.onZoom / fullMap.fit()
 *   fullMap.setPois(() => MapPoi[])        // a shard's own points of interest (Driftwood: its places with discovery + the
 *                                          // quest's markers, src/shards/driftwood-isle/quest/Places.ts); unset = the cabins / pond as before
 *   fullMap.setPois(src, { tally: true })  // + "PLACES n / N" (found / all places) in the frame's bottom-left corner (E309 A)
 *   (the minimap's marks, Minimap.setMarks — Driftwood's sea chart — are drawn here too: small ringed beads, no label)
 *   fullMap.setQuest(() => MapQuest|null)  // the quest in full — title, objective, sub-steps — for the MAP tab's card (E51)
 *   fullMap.setZones(MapZone[])            // the shard's zone names under the pins (Pine Hollow, PH-C9)
 *   fullMap.setFeatures({ trees, roofs })  // the shard's real trees + extra roofs on the ground layer (Minimap.setFeatures)
 *
 * Labels (E130 C): a quest marker is labelled with its short name behind a small cyan ◆ (the glyph says "a shard / goal waits
 * here" instead of the word); a marker at a place of the same name puts its ◆ on that place's label (an undiscovered one then
 * shows the marker's name, not "?"). An undiscovered place is a dashed cyan ring with a "?" inside (E309 A: the dim "?" read
 * as noise on the phone). Every label is laid out against the others, the markers and your arrow: it tries below,
 * above, right, left, then a line further, and takes the first spot that is free.
 */
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { activeLevel } from '../level/selection';
import { LAYER_PPM, type MapExtras, type MapFeatures, type Minimap } from './Minimap';
import { ROOM_BG, fitRoom, paintRoom } from './roomMap';

/** a point on the full map: a discovered place (named), an undiscovered one ("?"), or a live quest marker (pulsing diamond);
 *  `short` = a quest marker's short name ("SEA CAVE" for "SEA CAVE SHARD") — the map labels it with that */
export interface MapPoi { x: number; z: number; label: string; kind: 'place' | 'unknown' | 'quest'; short?: string }
/** the quest in full for the MAP tab's quest card (the HUD only shows its short chip, E51): chapter title, objective, sub-steps */
export interface MapQuest { title: string; objective: string; hint: string }
/** a zone's name on the full map (setZones) */
export interface MapZone { x: number; z: number; label: string }

const FOG_BRIGHTNESS = 0.3;
/** 1× fits everything the map spans; the closest zoom shows as much ground as 6× of one chunk */
const ZOOM_MIN = 1, ZOOM_CHUNK_MAX = 6;
const TILE_PX = 256;          // a zoom tile's side, device px
const TILE_CACHE = 64;        // tiles kept (256 KB each)
const TILE_BUDGET_MS = 6;     // painting new tiles, per frame
const CYAN = '#8fe3ff';
const NO_DASH: number[] = [];
/** metres: a quest marker this close to a place of its name tags that place's label instead of carrying its own */
const MERGE_M = 30;
const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => { const ctx = c.getContext('2d'); if (!ctx) throw new Error('FullMap: no 2d context'); return ctx; };

export class FullMap {
  readonly scope = uiScope('FullMap');
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fog = document.createElement('canvas');
  private fc = ctx2d(this.fog);
  private layer: UiHandle | null = null;
  private openScope: Scope | null = null;
  private get open(): boolean { return this.layer?.active === true; }
  // view: world point at the frame centre + zoom
  private cx = 0; private cz = 0; private _zoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0; private pinchZoom = 1;
  onToggle?: (open: boolean) => void;
  private poiSource: (() => MapPoi[]) | null = null;
  private questSource: (() => MapQuest | null) | null = null;
  /** the zoom changed (pinch / wheel / setZoom) — the menu's zoom chips follow */
  onZoom?: (zoom: number) => void;

  private minimap: Minimap;
  constructor(minimap: Minimap) {
    this.minimap = minimap;
    this.root = document.createElement('div');
    this.root.className = 'ws-gmenu-mapcanvas';
    Object.assign(this.root.style, { position: 'absolute', inset: '0', display: 'none', pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', overflow: 'hidden' } as CSSStyleDeclaration);
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' } as CSSStyleDeclaration);
    this.ctx = ctx2d(this.canvas);
    this.root.append(this.canvas);

    // pan / pinch
    this.scope.listen(this.canvas, 'pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.pointers.size === 2) { this.pinchDist = this.dist(); this.pinchZoom = this.zoom; } });
    this.scope.listen(this.canvas, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      if (this.pointers.size === 1) { this.panBy(e.clientX - p.x, e.clientY - p.y); }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinchDist > 0) { const d = this.dist(); this.zoomTo(this.pinchZoom * (d / this.pinchDist), this.mid()); }
    });
    const end = (e: PointerEvent) => { this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinchDist = 0; };
    this.scope.listen(this.canvas, 'pointerup', end); this.scope.listen(this.canvas, 'pointercancel', end);
    this.scope.listen(this.canvas, 'wheel', (e) => { e.preventDefault(); this.zoomTo(this._zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY }); }, { passive: false });
  }

  /** put the map in its frame (the menu's MAP tab); the frame is the map's viewport */
  mount(frame: HTMLElement): void { mountUi(this.root, this.scope, frame); }
  /** the minimap as a button: `onTap` (the menu opens on the Map tab) */
  bindMinimap(onTap: () => void): void {
    const m = this.minimap.root;
    m.style.pointerEvents = 'auto';
    m.style.cursor = 'pointer';
    app.ui.push('hud', { root: m, embedded: true, order: 6, back: () => undefined }, this.scope); // above the touch layer, with no overlay input owner
    this.scope.listen(m, 'pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    this.scope.listen(m, 'pointerup', (e) => { e.stopPropagation(); onTap(); });
  }

  get isOpen(): boolean { return this.open; }
  /** replace the default points of interest (cabins, pond) with the shard's own list, read every frame the map is open.
   *  (`declutter` is kept for its callers: every label is laid out apart now, E130 — NALATI-MERGE F11's elder included) */
  setPois(source: () => MapPoi[], opts: { declutter?: boolean; tally?: boolean } = {}): void {
    this.poiSource = source; this.tally = opts.tally === true;
    // SF57: a shard's list (and the world it closes over) goes with its owner — a resident's, through its ownedFacade —
    // and a replaced list's hold is dropped at once, so no owner keeps more than the latest
    this.forgetPois(); this.forgetPois = holdUntilOwnerDispose(() => { if (this.poiSource === source) { this.poiSource = null; this.tally = false; } });
  }
  private forgetPois = (): void => undefined;
  /** Quest overlays keep the base places and tally intact. */
  addPois(source: () => MapPoi[]): () => void {
    this.poiSources.add(source);
    return () => { this.poiSources.delete(source); };
  }
  private readonly poiSources = new Set<() => MapPoi[]>();
  private tally = false;
  private dash: number[] = [3, 2.5];
  /** the shard's zone names (Pine Hollow: THE RIDGE, THE OLD-GROWTH, …), big faint caps under the pins up to 2.5× */
  setZones(zones: readonly MapZone[]): void { this.zones = zones; }
  private zones: readonly MapZone[] = [];
  /** the shard's real trees + extra roofs for the ground layer (Minimap.setFeatures) */
  setFeatures(f: MapFeatures): void { this.minimap.setFeatures(f); }
  /** More ground around the chunk, read every frame the map is open (data only, in the same metres as `update`'s position):
   *  its rectangles and images under the chunk, its labels over them; the view spans them all. null clears it. */
  setExtras(source: (() => MapExtras | null) | null): void { this.extrasSource = source; }
  private extrasSource: (() => MapExtras | null) | null = null;
  /** the shard's quest, read by the menu each time the MAP tab shows (null = no quest card) */
  setQuest(source: () => MapQuest | null): void {
    this.questSource = source;
    this.forgetQuest(); this.forgetQuest = holdUntilOwnerDispose(() => { if (this.questSource === source) this.questSource = null; });
  }
  private forgetQuest = (): void => undefined;
  /** Scoped cards may retire in any order without resurrecting a disposed quest. */
  addQuest(source: () => MapQuest | null): () => void {
    this.questSources.push(source);
    return () => { const i = this.questSources.indexOf(source); if (i !== -1) this.questSources.splice(i, 1); };
  }
  private readonly questSources: (() => MapQuest | null)[] = [];
  get quest(): MapQuest | null { return this.minimap.room !== null ? null : (this.questSources.at(-1) ?? this.questSource)?.() ?? null; }
  /** a practice room's own map is up (the minimap's, E321): the MAP tab shows it — in the arena / a playground too */
  get hasRoom(): boolean { return this.minimap.room !== null; }
  get zoom(): number { return this._zoom; }
  /** zoom about the frame centre (the menu's 1× / 2× / 4× chips) */
  setZoom(z: number): void { const r = this.canvas.getBoundingClientRect(); this.zoomTo(z, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  show(): void {
    if (this.open) return;
    this.openScope = this.scope.child('open');
    this.layer = app.ui.push('gameMenu', { root: this.root, embedded: true, order: 0, back: () => { this.hide(); } }, this.openScope);
    this.root.style.display = 'block';
    const b = this.bounds(this.extrasSource?.() ?? null);
    this.cx = (b.x0 + b.x1) / 2; this.cz = (b.z0 + b.z1) / 2; this._zoom = 1;
    this.fit();
    // E440: the map draws itself every frame while open. The menu that shows it pauses the app (Menu.open), and a paused
    // app runs no update phase (Game.runPhase, E357 F8), so a draw driven from the play loop never came and the frame stayed black
    const scope = this.openScope;
    const frame = (): void => { this.draw(); scope.raf(frame); };
    scope.raf(frame);
    this.onToggle?.(true);
    this.onZoom?.(1);
  }
  hide(): void { if (!this.open) return; this.layer?.dispose(); this.layer = null; this.openScope?.dispose(); this.openScope = null; this.root.style.display = 'none'; this.pointers.clear(); this.onToggle?.(false); }

  private dpr = 1;
  /** size the canvas to its frame (call after the frame resizes) */
  fit(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.root.clientWidth || window.innerWidth, h = this.root.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.dash = [3 * this.dpr, 2.5 * this.dpr];
  }
  /** the world square the map spans (metres): the chunk, grown to hold every extra */
  private bounds(extras: MapExtras | null): { x0: number; x1: number; z0: number; z1: number; span: number } {
    let x0 = -CHUNK_HALF, x1 = CHUNK_HALF, z0 = -CHUNK_HALF, z1 = CHUNK_HALF;
    for (const r of extras?.rects ?? []) { x0 = Math.min(x0, r.x - r.hx); x1 = Math.max(x1, r.x + r.hx); z0 = Math.min(z0, r.z - r.hz); z1 = Math.max(z1, r.z + r.hz); }
    for (const m of extras?.images ?? []) { const h = m.size / 2; x0 = Math.min(x0, m.x - h); x1 = Math.max(x1, m.x + h); z0 = Math.min(z0, m.z - h); z1 = Math.max(z1, m.z + h); }
    return { x0, x1, z0, z1, span: Math.max(x1 - x0, z1 - z0) };
  }
  private span(): number { return this.bounds(this.extrasSource?.() ?? null).span; }
  private zoomMax(): number { return ZOOM_CHUNK_MAX * this.span() / CHUNK_SIZE; }
  /** screen px (device) per metre at the current zoom */
  private ppm() { return (Math.min(this.canvas.width, this.canvas.height) * 0.9 / this.span()) * this._zoom; }
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
    const nz = Math.min(this.zoomMax(), Math.max(ZOOM_MIN, z));
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
  private clamp() {
    const b = this.bounds(this.extrasSource?.() ?? null), m = (b.span / 2) * (1 - 0.5 / this._zoom), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
    this.cx = Math.max(mx - m, Math.min(mx + m, this.cx)); this.cz = Math.max(mz - m, Math.min(mz + m, this.cz));
  }

  private readonly pose = { x: 0, z: 0, yaw: 0 };
  /** Every frame of play: where you are. The map draws from it on its own frames while open (show), paused or not. */
  update(pos: { x: number; z: number }, yaw: number): void { this.pose.x = pos.x; this.pose.z = pos.z; this.pose.yaw = yaw; }

  private draw(): void {
    if (!this.open) return;
    const pos = this.pose, yaw = this.pose.yaw;
    const room = this.minimap.room;
    if (room !== null) {   // a practice room: its own layout, fitted to the frame (the zoom chips scale it), no shard, no pins
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, view = fitRoom(room, W, H, false);
      view.ppm *= this._zoom;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = ROOM_BG; ctx.fillRect(0, 0, W, H);
      paintRoom(ctx, room, view, pos, yaw, this.dpr, { labels: true });
      return;
    }
    const { terrain, cover } = this.minimap.layers;
    const extras = this.extrasSource?.() ?? null;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, ppm = this.ppm(), side = CHUNK_SIZE * ppm;
    const sx = (x: number) => W / 2 + (this.cx - x) * ppm;   // −X is east (screen right)
    const sz = (z: number) => H / 2 + (this.cz - z) * ppm;   // +Z is north (screen up)
    const ox = sx(CHUNK_HALF), oy = sz(CHUNK_HALF);           // the chunk's NE corner on screen

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    if (extras !== null) {   // the ground around the chunk (the grid's cells and roads), under it
      if (extras.outside !== undefined) { ctx.fillStyle = extras.outside; ctx.fillRect(0, 0, W, H); }
      for (const r of extras.rects) { ctx.fillStyle = r.color; ctx.fillRect(sx(r.x + r.hx), sz(r.z + r.hz), 2 * r.hx * ppm, 2 * r.hz * ppm); }
      for (const m of extras.images) {
        if (m.alpha <= 0) continue;
        ctx.globalAlpha = Math.min(1, m.alpha);
        ctx.drawImage(m.image, sx(m.x + m.size / 2), sz(m.z + m.size / 2), m.size * ppm, m.size * ppm);
      }
      ctx.globalAlpha = 1;
    }
    const baseAlpha = extras?.baseAlpha ?? 1;
    if (terrain !== null && baseAlpha > 0) {
      ctx.globalAlpha = baseAlpha; ctx.drawImage(terrain, ox, oy, side, side); ctx.globalAlpha = 1;
      if (!this.minimap.bakedGround) this.drawTiles(ox, oy, ppm);
    }

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

    // the extras' labels (the grid: each cell's shard name), under the pins
    const held: Box[] = [];
    if (extras !== null && extras.labels.length > 0) {
      ctx.font = `700 ${Math.max(12 * this.dpr, 0.05 * CHUNK_SIZE * ppm)}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3 * this.dpr; ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)';
      const lh = Math.max(12 * this.dpr, 0.05 * CHUNK_SIZE * ppm);
      for (const l of extras.labels) {
        const t = l.text.toUpperCase(), x = sx(l.x), y = sz(l.z), hw = ctx.measureText(t).width / 2;
        ctx.strokeText(t, x, y); ctx.fillStyle = l.color; ctx.fillText(t, x, y);
        held.push({ x0: x - hw, y0: y - lh / 2, x1: x + hw, y1: y + lh / 2 }); // the pins' labels lay out clear of it (playtest round 3)
      }
      ctx.textAlign = 'left';
    }

    // points of interest (their labels laid out clear of each other, the markers and your arrow)
    const fs = Math.max(11 * this.dpr, side * 0.022 / this._zoom);
    const px = sx(pos.x), py = sz(pos.z), r = Math.max(7 * this.dpr, fs * 0.6);
    const list: Pin[] = this.poiSource ? [...this.poiSource()] : levelPins();
    if (this.poiSources.size > 0) list.push(...[...this.poiSources].flatMap((source) => source()));
    const tally = this.tally ? this.layTally(list, ox, oy + side) : null;
    if (tally !== null) held.push(tally);
    // the minimap's marks (Driftwood's sea chart: every unfound sea glass piece, E314) — under the pins, no labels, not
    // tallied; a bead in the piece's colour inside a white ring (a quest marker is a cyan diamond, a place a white dot)
    const marks = this.minimap.marks;
    if (marks.length > 0) {
      const mr = Math.max(3.5 * this.dpr, fs * 0.3);
      for (const m of marks) {
        ctx.beginPath(); ctx.arc(sx(m.x), sz(m.z), mr, 0, Math.PI * 2);
        ctx.fillStyle = m.color; ctx.fill();
        ctx.lineWidth = 3 * this.dpr; ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)'; ctx.stroke();
        ctx.lineWidth = 1.2 * this.dpr; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.stroke();
      }
    }
    this.drawPois(list, sx, sz, fs, { x: px, y: py, r: r * 2.2 }, held);
    if (tally) this.drawTally(tally);

    // you
    const deg = 180 - (yaw * 180) / Math.PI;
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
    ctx.fillText(engineString('s_8ce86a6ae65d'), ox + side / 2, oy - 4 * this.dpr);
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

  /** the points of interest: places (named dots), undiscovered places (dim "?"), quest markers (pulsing cyan diamonds, on top);
   *  then every label, placed where it covers no other label, marker or your arrow (`you`) */
  private drawPois(list: Pin[], sx: (x: number) => number, sz: (z: number) => number, fs: number, you: { x: number; y: number; r: number }, avoid: readonly Box[]): void {
    const ctx = this.ctx, d = this.dpr;
    // the shard's zone names (setZones — Pine Hollow's THE RIDGE, THE OLD-GROWTH, …): big faint caps under everything, up to 2.5×
    if (this._zoom <= 2.5 && this.zones.length > 0) {
      const zfs = fs * 1.15;
      ctx.font = `600 ${zfs}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(230, 242, 248, 0.5)'; ctx.strokeStyle = 'rgba(6, 10, 18, 0.55)'; ctx.lineWidth = 3 * d;
      for (const zn of this.zones) { ctx.strokeText(zn.label, sx(zn.x), sz(zn.z)); ctx.fillText(zn.label, sx(zn.x), sz(zn.z)); }
    }
    ctx.font = `${fs}px JetBrains Mono, Menlo, monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const pins = list.map((p) => {
      const r = p.kind === 'quest' ? Math.max(6 * d, fs * 0.55) : p.kind === 'place' ? Math.max(4 * d, fs * 0.35) : Math.max(10 * d, fs * 0.85);
      return { p, x: sx(p.x), y: sz(p.z), r, text: p.kind === 'unknown' ? engineString('s_8a8de823d5ed') : p.kind === 'quest' ? (p.short ?? p.label) : p.label, glyph: p.kind === 'quest', own: true };
    });
    // two unfound rings that would overlap (the sea cave by the wreck, at 1×) are pushed apart along the line between them
    for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i], b = pins[j];
      if (a === undefined || b === undefined || a.p.kind !== 'unknown' || b.p.kind !== 'unknown') continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dd = Math.hypot(dx, dy), want = a.r + b.r + 2 * d;
      if (dd >= want) continue;
      if (dd < 1e-3) { dx = 1; dy = 0; } else { dx /= dd; dy /= dd; }
      const push = (want - dd) / 2;
      a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    }
    // a quest marker at a place of its own name (LOOKOUT at THE LOOKOUT) puts its ◆ on that place's label, one marker a place
    for (const q of pins) {
      if (q.p.kind !== 'quest') continue;
      const name = q.text.toUpperCase();
      let best: (typeof pins)[number] | null = null, bestD = MERGE_M * MERGE_M;
      for (const o of pins) {
        if (o.p.kind === 'quest' || o.glyph) continue;
        const real = o.p.label.toUpperCase(), dd = (o.p.x - q.p.x) ** 2 + (o.p.z - q.p.z) ** 2;
        if (dd < bestD && (real.includes(name) || name.includes(real))) { best = o; bestD = dd; }
      }
      if (best) { best.glyph = true; if (best.p.kind === 'unknown') best.text = q.text; q.own = false; }
    }
    // markers: places (dots) + unfound places (a dashed cyan ring, "?" inside: E309 A) under the quest diamonds
    for (const m of pins) {
      if (m.p.kind === 'quest') continue;
      if (m.p.kind === 'unknown') {
        ctx.fillStyle = 'rgba(8, 20, 30, 0.72)';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(6, 10, 18, 0.8)'; ctx.lineWidth = 3.5 * d; ctx.stroke();
        ctx.setLineDash(this.dash); ctx.strokeStyle = CYAN; ctx.lineWidth = 1.6 * d; ctx.stroke(); ctx.setLineDash(NO_DASH);
        ctx.save();
        ctx.font = `700 ${Math.round(m.r * 1.25)}px JetBrains Mono, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = CYAN; ctx.fillText(engineString('s_8a8de823d5ed'), m.x, m.y + m.r * 0.06);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = m.p.color ?? '#e6f2f8';
      ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)'; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const pulse = (performance.now() % 1600) / 1600;
    for (const m of pins) {
      if (m.p.kind !== 'quest') continue;
      ctx.strokeStyle = `rgba(143, 227, 255, ${0.7 * (1 - pulse)})`; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1.2 + pulse * 1.6), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = CYAN; ctx.strokeStyle = 'rgba(6, 10, 18, 0.9)'; ctx.lineWidth = 2 * d;
      diamond(ctx, m.x, m.y, m.r); ctx.fill(); ctx.stroke();
    }
    // labels: ◆-tagged first, then places, then "?"; each takes the first candidate spot that is free (else the least covered)
    const taken: Box[] = [{ x0: you.x - you.r, y0: you.y - you.r, x1: you.x + you.r, y1: you.y + you.r }];
    for (const m of pins) taken.push({ x0: m.x - m.r, y0: m.y - m.r, x1: m.x + m.r, y1: m.y + m.r });
    taken.push(...avoid);   // the PLACES tally (E309 A) and the extras' labels (the grid's shard names)
    // off the canvas counts as taken, so a pin at the chunk's edge (a road portal) labels inward instead of cut off (SF66)
    const cw = ctx.canvas.width, ch = ctx.canvas.height, far = Math.max(cw, ch);
    taken.push({ x0: -far, y0: -far, x1: 0, y1: ch + far }, { x0: cw, y0: -far, x1: cw + far, y1: ch + far }, { x0: -far, y0: -far, x1: cw + far, y1: 0 }, { x0: -far, y0: ch, x1: cw + far, y1: ch + far });
    const rank = (m: (typeof pins)[number]): number => (m.glyph ? 0 : m.p.kind === 'place' ? 1 : 2);
    const gw = fs * 0.62, gap = fs * 0.3, pad = 2 * d;
    // (an unfound place's "?" is inside its ring: it carries no label unless a quest marker named it)
    for (const m of pins.filter((q) => q.own && (q.glyph || q.p.kind !== 'unknown')).sort((a, b) => rank(a) - rank(b))) {
      const w = ctx.measureText(m.text).width + (m.glyph ? gw + gap : 0), h = fs, o = m.r + 3 * d;
      const spots: [number, number][] = [
        [m.x - w / 2, m.y + o], [m.x - w / 2, m.y - o - h], [m.x + o + d, m.y - h / 2], [m.x - o - d - w, m.y - h / 2],
        [m.x - w / 2, m.y + o + h + pad], [m.x - w / 2, m.y - o - 2 * h - pad], [m.x + o + d, m.y + h / 2 + pad], [m.x - o - d - w, m.y + h / 2 + pad],
        [m.x + o + d, m.y - 1.5 * h - pad], [m.x - o - d - w, m.y - 1.5 * h - pad],
      ];
      let pick: Box | null = null, least = Infinity;
      for (const [x0, y0] of spots) {
        const b = { x0: x0 - pad, y0: y0 - pad, x1: x0 + w + pad, y1: y0 + h + pad };
        let hit = 0;
        for (const t of taken) hit += Math.max(0, Math.min(b.x1, t.x1) - Math.max(b.x0, t.x0)) * Math.max(0, Math.min(b.y1, t.y1) - Math.max(b.y0, t.y0));
        if (hit < least) { least = hit; pick = b; }
        if (hit === 0) break;
      }
      if (!pick) continue;
      taken.push(pick);
      let x = pick.x0 + pad;
      const y = pick.y0 + pad;
      if (m.glyph) {
        ctx.fillStyle = CYAN; ctx.strokeStyle = 'rgba(6, 10, 18, 0.9)'; ctx.lineWidth = 1.5 * d;
        diamond(ctx, x + gw / 2, y + h * 0.48, gw / 2); ctx.fill(); ctx.stroke();
        x += gw + gap;
      }
      ctx.fillStyle = m.p.kind === 'unknown' && !m.glyph ? 'rgba(230, 242, 248, 0.7)' : m.p.kind === 'quest' ? CYAN : 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)'; ctx.lineWidth = 3 * d;
      ctx.strokeText(m.text, x, y); ctx.fillText(m.text, x, y);
    }
    ctx.textAlign = 'center';
  }

  /** E309 A: "PLACES n / N" (found / all places) on a navy glass plate in the bottom-left corner, fixed while you pan: inside
   *  the chunk's corner while it is on screen (1×), else the frame's. Laid out first, so the place labels keep clear of it */
  private layTally(list: readonly Pin[], chunkLeft: number, chunkBottom: number): Tally | null {
    let found = 0, all = 0;
    for (const p of list) { if (p.kind === 'place') { found++; all++; } else if (p.kind === 'unknown') all++; }
    if (all === 0) return null;
    const ctx = this.ctx, d = this.dpr, fs = 11 * d, sp = fs * 0.2, text = `PLACES ${found} / ${all}`;
    ctx.font = `600 ${fs}px JetBrains Mono, Menlo, monospace`;
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + sp;
    w -= sp;
    const padX = 8 * d, h = fs + 10 * d, x0 = Math.max(10 * d, chunkLeft + 8 * d), y0 = Math.min(this.canvas.height - 10 * d, chunkBottom - 8 * d) - h;
    return { x0, y0, x1: x0 + w + padX * 2, y1: y0 + h, text, fs, sp, padX };
  }

  private drawTally(t: Tally): void {
    const ctx = this.ctx, d = this.dpr, h = t.y1 - t.y0;
    ctx.save();
    ctx.font = `600 ${t.fs}px JetBrains Mono, Menlo, monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(13, 27, 38, 0.8)'; ctx.fillRect(t.x0, t.y0, t.x1 - t.x0, h);
    ctx.strokeStyle = 'rgba(143, 227, 255, 0.55)'; ctx.lineWidth = d; ctx.strokeRect(t.x0 + d / 2, t.y0 + d / 2, t.x1 - t.x0 - d, h - d);
    ctx.fillStyle = CYAN;
    let x = t.x0 + t.padX;
    for (const ch of t.text) { ctx.fillText(ch, x, t.y0 + h / 2); x += ctx.measureText(ch).width + t.sp; }
    ctx.restore();
  }
}


/** a pin as the map draws it: a MapPoi, with a dot colour for the built-in cabins / pond */
type Pin = MapPoi & { color?: string };
/** the pins a level shows when its shard sets none (`setPois`): its listed places (LevelSpec.pois), else the cabins and the
 *  pond of its terrain (test/map-coverage.test.ts: every listed place is on the map) */
export function levelPins(): Pin[] {
  const pois = activeLevel().pois;
  if (pois !== undefined && pois.length > 0) return pois.map((p): Pin => ({ x: p.x, z: p.z, label: p.name.toUpperCase(), kind: 'place', color: CYAN }));
  return [
    ...CABIN_SITES.map((c, i): Pin => ({ x: c.x, z: c.z, label: engineString('s_a5912d0f68ef', [i + 1]), kind: 'place', color: '#8fe3ff' })),
    ...(hasPond() ? [{ x: POND.x, z: POND.z, label: engineString('s_5dddbb894d63'), kind: 'place', color: '#6fb8e8' } satisfies Pin] : []),
  ];
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
}

interface Box { x0: number; y0: number; x1: number; y1: number }
/** the PLACES tally's plate (a Box) and how its letter-spaced text is set */
interface Tally extends Box { text: string; fs: number; sp: number; padX: number }

/** Run `release` when the current owner disposes; the returned function drops that hold early (a superseded source). */
function holdUntilOwnerDispose(release: () => void): () => void {
  return currentOwner()?.capture('disposers', release) ?? ((): void => undefined);
}

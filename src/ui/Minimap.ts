/**
 * Minimap — the circular top-down map top-right of the HUD (mockup B, art/minimap-k1-B-terrain.png).
 *
 *   const minimap = new Minimap();                                    // mounts into #hud
 *   minimap.update(player.position, player.yaw, animals.animals);     // every frame
 *   minimap.setVisible(false);
 *
 * North-up (+Z is north, −X is east — the compass band's convention: heading = 180 − yaw°), the
 * player arrow rotates with the yaw, the map scrolls under it. The view covers ±VIEW_RADIUS metres.
 *
 * Layers, back to front:
 *   1. terrain — painted ONCE into an offscreen canvas covering the whole chunk at LAYER_PPM px/m:
 *      hillshaded ground (heightAt), pond (POND), dirt trails (TRAILS), pine crowns stippled from the
 *      same density noise Forest.ts thins its candidates with, cabin roofs (CABIN_SITES);
 *   2. fog of war — a low-res coverage canvas (COVER_PPM px/m) the player's visited positions stamp a
 *      feathered disc into; unexplored ground shows at FOG_BRIGHTNESS;
 *   3. animal dots — yellow = passive (deer), red = can turn on you (boar, bear: `aggressive`, else the
 *      species registry's flag); a red dot that is charging / stalking / alert (or, without a public state,
 *      wounded) pulses;
 *   4. the player arrow, a rim vignette. The cyan rim, 45° ticks, "N" and the heading readout are CSS.
 *
 * Nothing is allocated per frame: every canvas, gradient and sprite is built at construction or on resize.
 */
import { CHUNK_HALF, CHUNK_SIZE, SEED } from '../core/config';
import { heightAt, trailDistance, TRAILS, CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { Noise2D, smoothstep } from '../core/noise';
import { Rng } from '../core/rng';
import { getActiveChunk, onActiveChunkChange } from '../chunks/registry';
import { hasSpecies, speciesDef } from '../entities/species/registry';

export interface MinimapAnimal {
  kind: string;
  /** charges the player (red dot); default: the species registry's `aggressive` flag for `kind` */
  aggressive?: boolean;
  /** 'rare' / 'legendary' animals get a thin white ring */
  rarity?: string;
  position: { x: number; z: number };
  alive?: boolean;
  hp?: number;
  maxHp?: number;
  state?: string;
}

const VIEW_RADIUS = 110;          // metres from the player to the rim
const LAYER_PPM = 2;              // terrain layer px per metre (1000 × 1000 for the 500 m chunk)
const HEIGHT_STEP = 2;            // metres between height samples for the ground shading
const COVER_PPM = 0.5;            // fog coverage px per metre (1 px per 2 m)
const REVEAL_RADIUS = 45;         // metres a visited position reveals
const STAMP_EVERY = 4;            // metres moved between coverage stamps
const FOG_BRIGHTNESS = 0.3;       // unexplored ground brightness
const DESKTOP_SIZE = 180;         // css px (phone size comes from the stylesheet: 26vw)

// palette — the game's muted ground tones (see the mockup): olive grass, grey rock, khaki dirt, slate water
const GRASS_LO: RGB = [104, 118, 58], GRASS_HI: RGB = [150, 158, 84];   // olive meadow, lighter with altitude
const FLOOR: RGB = [72, 78, 44];                                            // forest floor under the canopy
const ROCK: RGB = [122, 118, 108];
const WATER = '#3b607c', WATER_EDGE = '#2a4458';
const TRAIL_EDGE = 'rgba(80, 64, 44, 0.85)', TRAIL = '#a08a66';
const CROWN_DARK = '#2b4229', CROWN_MID = '#3c5a34', CROWN_LIGHT = '#66864a', CROWN_SHADOW = 'rgba(18, 34, 20, 0.5)';
const ROOF = '#74523a', ROOF_RIDGE = '#9a7a58', ROOF_SHADOW = 'rgba(0, 0, 0, 0.45)';
const VOID = '#0b1016';
const DOT_PASSIVE = '#ffe066', DOT_AGGRESSIVE = '#ff5a4a', DOT_OUTLINE = 'rgba(6, 10, 18, 0.9)';
const ARROW = '#ffffff';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number, out: RGB) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const CARDINAL4 = ['N', 'E', 'S', 'W'];

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctx2d(c: HTMLCanvasElement) { return c.getContext('2d')!; }

export class Minimap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nLabel: HTMLSpanElement;
  private headingEl: HTMLSpanElement;

  private layer = canvas(CHUNK_SIZE * LAYER_PPM, CHUNK_SIZE * LAYER_PPM);
  private layerDirty = true;
  /** last paint time of the terrain layer, ms */
  paintMs = 0;

  private cover = canvas(Math.ceil(CHUNK_SIZE * COVER_PPM), Math.ceil(CHUNK_SIZE * COVER_PPM));
  private coverCtx = ctx2d(this.cover);
  private stamp: HTMLCanvasElement;
  private lastStampX = NaN; private lastStampZ = NaN;

  private fog = canvas(1, 1);
  private fogCtx = ctx2d(this.fog);
  private vignette: CanvasGradient | null = null;

  private size = 0;      // device px, square
  private dpr = 1;
  private lastHeading = -1;
  private visible = true;
  private ro: ResizeObserver | null = null;

  constructor(parent: HTMLElement | null = document.getElementById('hud')) {
    this.root = document.createElement('div');
    this.root.className = 'ws-minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ws-minimap-canvas';
    this.nLabel = document.createElement('span');
    this.nLabel.className = 'ws-minimap-n';
    this.nLabel.textContent = 'N';
    this.headingEl = document.createElement('span');
    this.headingEl.className = 'ws-minimap-heading';
    this.headingEl.textContent = '000° N';
    this.root.append(this.canvas, this.nLabel, this.headingEl);
    (parent ?? document.body).appendChild(this.root);
    this.ctx = ctx2d(this.canvas);

    this.stamp = this.buildStamp();
    this.layerDirty = true;
    onActiveChunkChange(() => { this.layerDirty = true; this.clearCoverage(); });

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(this.root);
    }
    this.fit();
  }

  /** The painted terrain layer and fog coverage, for the full map (src/ui/Map.ts). */
  get layers() { if (this.layerDirty) this.paintLayer(); return { terrain: this.layer, cover: this.cover }; }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.root.classList.toggle('hidden', !v);
  }

  /** Forget everything explored (a new chunk, a respawn to a fresh shard). */
  clearCoverage() {
    this.coverCtx.clearRect(0, 0, this.cover.width, this.cover.height);
    this.lastStampX = this.lastStampZ = NaN;
  }

  dispose() { this.ro?.disconnect(); this.root.remove(); }

  // ── per frame ──
  update(pos: { x: number; z: number }, yaw: number, animals: ReadonlyArray<MinimapAnimal>) {
    if (!this.visible) return;
    if (this.layerDirty) this.paintLayer();
    if (this.size === 0) { this.fit(); if (this.size === 0) return; }

    // heading readout — the compass band's convention (HUD.ts): +Z is north, turning left decreases the heading
    let deg = 180 - (yaw * 180) / Math.PI; deg = ((deg % 360) + 360) % 360;
    const degR = Math.round(deg) % 360;
    if (degR !== this.lastHeading) {
      this.lastHeading = degR;
      const card = CARDINAL4[Math.round(deg / 90) % 4];
      this.headingEl.textContent = `${String(degR).padStart(3, '0')}° ${card}`;
    }

    // fog of war: stamp the visited position every STAMP_EVERY metres
    if (Number.isNaN(this.lastStampX) || Math.hypot(pos.x - this.lastStampX, pos.z - this.lastStampZ) >= STAMP_EVERY) {
      this.lastStampX = pos.x; this.lastStampZ = pos.z;
      const r = this.stamp.width / 2;
      this.coverCtx.drawImage(this.stamp, (CHUNK_HALF - pos.x) * COVER_PPM - r, (CHUNK_HALF - pos.z) * COVER_PPM - r);
    }

    const D = this.size, c = D / 2, k = D / (2 * VIEW_RADIUS); // device px per metre
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = VOID; ctx.fillRect(0, 0, D, D);

    // 1. terrain, the player centred, north up (layer u = (HALF − x) · ppm so east (−X) is screen right)
    const lr = VIEW_RADIUS * LAYER_PPM;
    ctx.drawImage(this.layer, (CHUNK_HALF - pos.x) * LAYER_PPM - lr, (CHUNK_HALF - pos.z) * LAYER_PPM - lr, lr * 2, lr * 2, 0, 0, D, D);

    // 2. fog: black at (1 − brightness), punched out where the coverage canvas is opaque
    const fc = this.fogCtx, cr = VIEW_RADIUS * COVER_PPM;
    fc.globalCompositeOperation = 'copy'; // replaces last frame's fog rather than stacking on it
    fc.fillStyle = `rgba(0, 0, 0, ${1 - FOG_BRIGHTNESS})`;
    fc.fillRect(0, 0, D, D);
    fc.globalCompositeOperation = 'destination-out';
    fc.drawImage(this.cover, (CHUNK_HALF - pos.x) * COVER_PPM - cr, (CHUNK_HALF - pos.z) * COVER_PPM - cr, cr * 2, cr * 2, 0, 0, D, D);
    ctx.drawImage(this.fog, 0, 0);

    // 3. animals
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    const dot = 1.75 * this.dpr, outline = this.dpr;
    ctx.lineWidth = outline;
    for (const a of animals) {
      if (a.alive === false || (a.hp !== undefined && a.hp <= 0)) continue;
      const dx = a.position.x - pos.x, dz = a.position.z - pos.z;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;
      const sx = c - dx * k, sy = c - dz * k;
      const aggressive = a.aggressive ?? (hasSpecies(a.kind) && !!speciesDef(a.kind).aggressive);
      const hot = aggressive && (a.state !== undefined ? (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert') : (a.hp !== undefined && a.maxHp !== undefined && a.hp < a.maxHp));
      const r = hot ? dot * (1 + 0.5 * pulse) : dot;
      if (hot) {
        ctx.beginPath(); ctx.arc(sx, sy, r + 3 * this.dpr * (0.5 + pulse), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 90, 74, ${0.35 * (1 - pulse)})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = aggressive ? DOT_AGGRESSIVE : DOT_PASSIVE; ctx.fill();
      ctx.strokeStyle = DOT_OUTLINE; ctx.stroke();
      if (a.rarity === 'rare' || a.rarity === 'legendary') {   // a thin white ring marks the trophies
        ctx.beginPath(); ctx.arc(sx, sy, r + 2.2 * this.dpr, 0, Math.PI * 2);
        ctx.strokeStyle = a.rarity === 'legendary' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'; ctx.stroke();
        ctx.strokeStyle = DOT_OUTLINE;
      }
    }

    // 4. the player arrow (heading is clockwise from north; canvas rotate() is clockwise on screen)
    ctx.translate(c, c); ctx.rotate((deg * Math.PI) / 180);
    const s = this.dpr;
    ctx.beginPath(); ctx.moveTo(0, -7 * s); ctx.lineTo(5 * s, 6 * s); ctx.lineTo(0, 3 * s); ctx.lineTo(-5 * s, 6 * s); ctx.closePath();
    ctx.fillStyle = ARROW; ctx.strokeStyle = DOT_OUTLINE; ctx.lineWidth = 1.5 * s; ctx.lineJoin = 'round';
    ctx.stroke(); ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // rim vignette
    if (this.vignette) { ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, D, D); }
    ctx.restore();
  }

  // ── sizing ──
  private fit() {
    const css = this.root.clientWidth || DESKTOP_SIZE;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const D = Math.round(css * dpr);
    if (D === this.size && dpr === this.dpr) return;
    this.size = D; this.dpr = dpr;
    this.canvas.width = this.canvas.height = D;
    this.fog.width = this.fog.height = D;
    this.fogCtx = ctx2d(this.fog);
    const g = this.ctx.createRadialGradient(D / 2, D / 2, D * 0.3, D / 2, D / 2, D / 2);
    g.addColorStop(0, 'rgba(6, 10, 18, 0)'); g.addColorStop(1, 'rgba(6, 10, 18, 0.45)');
    this.vignette = g;
  }

  private buildStamp() {
    const r = Math.ceil(REVEAL_RADIUS * COVER_PPM);
    const c = canvas(r * 2, r * 2), x = ctx2d(c);
    const g = x.createRadialGradient(r, r, r * 0.45, r, r, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  // ── the terrain layer (once) ──
  private paintLayer() {
    const t0 = performance.now();
    this.layerDirty = false;
    const L = this.layer.width, ppm = LAYER_PPM, ctx = ctx2d(this.layer);
    const toU = (x: number) => (CHUNK_HALF - x) * ppm;   // east (−X) → right
    const toV = (z: number) => (CHUNK_HALF - z) * ppm;   // north (+Z) → up

    // ground: sample heights on a HEIGHT_STEP grid, hillshade from the sampled slopes, upscale smoothly
    const N = Math.floor(CHUNK_SIZE / HEIGHT_STEP) + 1;
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) { const z = CHUNK_HALF - j * HEIGHT_STEP; for (let i = 0; i < N; i++) h[j * N + i] = heightAt(CHUNK_HALF - i * HEIGHT_STEP, z); }
    let hMin = Infinity, hMax = -Infinity;
    for (let i = 0; i < h.length; i++) { if (h[i] < hMin) hMin = h[i]; if (h[i] > hMax) hMax = h[i]; }
    const img = new ImageData(N, N), px = img.data, col: RGB = [0, 0, 0];
    const lx = -0.55, ly = 0.65, lz = -0.52; // light from the upper-left of the map (north-west), fairly low
    const chunk = getActiveChunk();
    const F = chunk.forest;
    const ocean = chunk.ocean ?? null; // open-water shard: sea by depth, sand where the floor breaks the surface, no forest
    const SEA_DEEP: RGB = [22, 74, 128], SEA_SHALLOW: RGB = [78, 196, 214], SAND: RGB = [226, 206, 150];
    const density = new Noise2D(SEED + 5);   // Forest.ts thins its tree candidates with this field: groves are dark floor, clearings meadow
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = CHUNK_HALF - i * HEIGHT_STEP, wz = CHUNK_HALF - j * HEIGHT_STEP;
      const grove = smoothstep(F.clearings[0], F.clearings[1], density.fbm(wx * F.densityFreq, wz * F.densityFreq, 3));
      const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(N - 1, j + 1);
      const dhx = (h[j * N + i1] - h[j * N + i0]) / ((i1 - i0) * HEIGHT_STEP);
      const dhy = (h[j1 * N + i] - h[j0 * N + i]) / ((j1 - j0) * HEIGHT_STEP);
      const inv = 1 / Math.hypot(dhx, dhy, 1);
      const nx = -dhx * inv, ny = inv, nz = -dhy * inv;
      const shade = 0.6 + 0.4 * Math.max(0, nx * lx + ny * ly + nz * lz) / Math.hypot(lx, ly, lz);
      const slope = 1 - ny;
      const alt = (h[j * N + i] - hMin) / Math.max(1, hMax - hMin);
      let sh = shade;
      if (ocean) {
        const depth = ocean.level - h[j * N + i];
        if (depth > 0) { mix(SEA_SHALLOW, SEA_DEEP, smoothstep(0, ocean.deepDepth, depth), col); sh = 1; }
        else { mix(SAND, GRASS_HI, smoothstep(1.5, 8, -depth), col); mix(col, ROCK, smoothstep(0.14, 0.4, slope), col); }
      } else {
        mix(GRASS_LO, GRASS_HI, alt, col);
        mix(col, FLOOR, grove * 0.8, col);
        mix(col, ROCK, smoothstep(0.14, 0.4, slope), col);
      }
      const o = (j * N + i) * 4;
      px[o] = col[0] * sh; px[o + 1] = col[1] * sh; px[o + 2] = col[2] * sh; px[o + 3] = 255;
    }
    const small = canvas(N, N); ctx2d(small).putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, N, N, 0, 0, L, L);

    // pond
    if (hasPond()) {
      const u = toU(POND.x), v = toV(POND.z), r = POND.r * ppm;
      ctx.beginPath(); ctx.arc(u, v, r * 1.12, 0, Math.PI * 2); ctx.fillStyle = WATER_EDGE; ctx.fill();
      const g = ctx.createRadialGradient(u - r * 0.3, v - r * 0.3, r * 0.1, u, v, r);
      g.addColorStop(0, '#4d7592'); g.addColorStop(1, WATER);
      ctx.beginPath(); ctx.arc(u, v, r * 0.98, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    }

    if (ocean) {
      // the south pier (src/world/Pier.ts: 4 m deck from the edge midpoint 60 m north) — the entry roads are submerged sandbars
      ctx.fillStyle = '#b8945e';
      ctx.fillRect(toU(2), toV(-CHUNK_HALF + 60), 4 * ppm, 60 * ppm);
      return;
    }
    // trails: a dark bed with a lighter dirt centre
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (w: number, style: string) => {
      ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
      for (const poly of TRAILS) { poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z)))); }
      ctx.stroke();
    };
    stroke(8, TRAIL_EDGE); stroke(5, TRAIL);

    // pine crowns: candidates on a grid, thinned by the same density field Forest.ts uses, kept off the trails/pond/pads
    const rng = new Rng(SEED + 4242);
    const sprite = this.buildCrownSprite(Math.ceil(6 * ppm));
    const cell = 5, half = CHUNK_HALF - 6;
    const cabinR = 12;
    const crowns: number[] = []; // u, v, r triples — shadows go under every crown, so two passes
    for (let x = -half; x < half; x += cell) for (let z = -half; z < half; z += cell) {
      const cx = x + rng.range(-cell * 0.5, cell * 0.5), cz = z + rng.range(-cell * 0.5, cell * 0.5);
      const d = density.fbm(cx * F.densityFreq, cz * F.densityFreq, 3);
      const keep = smoothstep(F.clearings[0], F.clearings[1], d) * 0.92 + 0.08;
      if (rng.next() > keep * 0.9) continue;
      const roadEntry = (Math.abs(cx) < 16 && Math.abs(cz) > CHUNK_HALF - 95) || (Math.abs(cz) < 16 && Math.abs(cx) > CHUNK_HALF - 95);
      if (roadEntry) continue;
      if (trailDistance(cx, cz) < 8 + rng.range(0, 4)) continue;
      if (hasPond() && Math.hypot(cx - POND.x, cz - POND.z) < POND.r + 4) continue;
      let onPad = false;
      for (const c of CABIN_SITES) if (Math.hypot(cx - c.x, cz - c.z) < cabinR) { onPad = true; break; }
      if (onPad) continue;
      crowns.push(toU(cx), toV(cz), (3.4 + rng.range(0, 2.6)) * ppm);
    }
    ctx.fillStyle = CROWN_SHADOW;
    for (let i = 0; i < crowns.length; i += 3) { ctx.beginPath(); ctx.arc(crowns[i] + 1.5 * ppm, crowns[i + 1] + 1.5 * ppm, crowns[i + 2] * 1.1, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < crowns.length; i += 3) { const r = crowns[i + 2]; ctx.drawImage(sprite, crowns[i] - r, crowns[i + 1] - r, r * 2, r * 2); }

    // cabin roofs: a rotated rectangle with a ridge line and a soft shadow
    for (const c of CABIN_SITES) {
      const w = 9 * ppm, dpt = 7 * ppm;
      ctx.save();
      ctx.translate(toU(c.x), toV(c.z));
      ctx.rotate(-c.rot); // Ry(rot) turns +x toward −z; on screen (u, v) = (−x, −z) that is anticlockwise, canvas rotate() is clockwise
      ctx.fillStyle = ROOF_SHADOW; ctx.fillRect(-w / 2 + 2, -dpt / 2 + 3, w, dpt);
      ctx.fillStyle = ROOF; ctx.fillRect(-w / 2, -dpt / 2, w, dpt);
      ctx.fillStyle = ROOF_RIDGE; ctx.fillRect(-w / 2, -1, w, 2);
      ctx.restore();
    }

    this.paintMs = performance.now() - t0;
  }

  private buildCrownSprite(r: number) {
    const c = canvas(r * 2, r * 2), x = ctx2d(c);
    const g = x.createRadialGradient(r * 0.7, r * 0.7, 0, r, r, r);
    g.addColorStop(0, CROWN_LIGHT); g.addColorStop(0.4, CROWN_MID); g.addColorStop(1, CROWN_DARK);
    x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, Math.PI * 2); x.fill();
    return c;
  }
}

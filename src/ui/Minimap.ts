/**
 * Minimap — the circular top-down map top-right of the HUD (mockup B, art/minimap/round-1/minimap-k1-B-terrain.png).
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
 *   4. the player arrow, a rim vignette. The cyan rim, 45° ticks and "N" are CSS. (The heading readout under the circle is
 *      gone, E51: the arrow already says where you face.)
 *
 * The built world (E130, `ChunkDef.map`): the shard's sand paths and its registered pieces' collider footprints as flat
 * silhouettes (src/ui/mapShapes.ts) — Driftwood's pier, jetties, boat, hut, bridge, lookout, wreck, zipline, shrine, the sea
 * cave's vault and the palms' crowns — painted into the same layer and zoom tiles, so the minimap and the full map both show them.
 *
 * Nothing is allocated per frame: every canvas, gradient and sprite is built at construction or on resize.
 *
 * NALATI (`chunk.style === 'painterly'`, plan row B15): the ground is painted in the shard's own colours instead — the green
 * valley, the gold-olive Sky Grassland, grey rock on the escarpment, snow over the snow line, the Kunes' braided channels
 * (glacial blue) and gravel bars, the plateau brook, the spruce gullies stippled from the chunk's own spruce mask — and the
 * map-01 places (NOMAD CAMP, KUNES RIVER, …: `mapPois()`, read from the chunk def / layout, never hard-coded) are the
 * full map's pins (main.ts `fullMap.setPois`: named once explored, "?" before) — no names on the minimap itself. A wolf lying hidden in long grass (`mem.hidden`, Pack.ts) is not on it (the stealth rule).
 */
import { CHUNK_HALF, CHUNK_SIZE, SEED } from '../core/config';
import { heightAt, trailDistance, TRAILS, CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { Noise2D, smoothstep } from '../core/noise';
import { Rng } from '../core/rng';
import { getActiveChunk, onActiveChunkChange } from '../chunks/registry';
import { hasSpecies, speciesDef } from '../entities/species/registry';
import * as NALATI_DEF from '../chunks/nalati-grasslands';
import { nalatiWetAt } from '../nalati/wet';
import { NALATI_WILDLIFE } from '../entities/Wildlife';
import { activeRegistry } from '../world/registry';
import { mapShapes, mapWants, type MapPoly, type MapShapes } from './mapShapes';

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
  /** Animal.mem — a wolf with `hidden` 1 (lying still in long grass, Pack.ts) is off the map */
  mem?: Record<string, number>;
}

/** a named place on the maps (the minimap's labels, the full map's pins) */
export interface MapPoi { x: number; z: number; label: string; color: string }

// ── Nalati's map, read BY NAME from the chunk def at runtime (layout v2 is being rebuilt: consts come and go, so nothing
//    here imports one; the ground colours are by height / slope / the river, which follow any terrain) ──
const NDEF = new Map<string, unknown>(Object.entries(NALATI_DEF));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
function defXZ(name: string): { x: number; z: number } | null {
  const v = NDEF.get(name);
  return isObj(v) && typeof v['x'] === 'number' && typeof v['z'] === 'number' ? { x: v['x'], z: v['z'] } : null;
}
function defNum(name: string, d: number): number { const v = NDEF.get(name); return typeof v === 'number' ? v : d; }
function defFn(name: string): ((x: number, z: number) => number) | null {
  const v = NDEF.get(name);
  return typeof v === 'function' ? (x: number, z: number) => { const r: unknown = Reflect.apply(v, undefined, [x, z]); return typeof r === 'number' ? r : 0; } : null;
}
const labelled = (list: unknown, color: string): MapPoi[] => {
  const out: MapPoi[] = [];
  if (Array.isArray(list)) for (const e of list) if (isObj(e) && typeof e['label'] === 'string' && typeof e['x'] === 'number' && typeof e['z'] === 'number') out.push({ x: e['x'], z: e['z'], label: e['label'], color: typeof e['color'] === 'string' ? e['color'] : color });
  return out;
};
const POI_COLOR = '#f0e6c8';

/** the active shard's named places: Nalati's (the def's `NALATI_MAP.pois`, else whichever named consts it exports), else the
 *  cabins + the pond */
export function mapPois(): MapPoi[] {
  if (getActiveChunk().style === 'painterly') {
    const m = NDEF.get('NALATI_MAP');
    const listed = isObj(m) ? labelled(m['pois'], POI_COLOR) : [];
    if (listed.length > 0) return listed;
    const out: MapPoi[] = [];
    const add = (label: string, p: { x: number; z: number } | null, color = POI_COLOR): void => { if (p !== null) out.push({ x: p.x, z: p.z, label, color }); };
    add('NOMAD CAMP', defXZ('CAMP')); add('BRIDGE', defXZ('BRIDGE')); add('SHEEP PASTURE', defXZ('PASTURE'));
    add('EAGLE ROCK', defXZ('EAGLE_ROCK')); add('THE CRAGS', defXZ('CRAGS')); add('SUMMER CAMP', defXZ('SUMMER_YURTS'));
    add('WIND CAIRN', defXZ('CAIRN')); add('KOKPAR FIELD', defXZ('KOKPAR')); add('RUINED WATCHTOWER', defXZ('WATCHTOWER'));
    add('GLACIER', defXZ('GLACIER')); add('SNOW LEOPARD CAVE', defXZ('LEOPARD_CAVE'));
    const kurgans = NDEF.get('KURGANS');
    if (Array.isArray(kurgans)) {
      const great: unknown = kurgans.find((k: unknown) => isObj(k) && k['great'] === true) ?? kurgans[0];
      if (isObj(great) && typeof great['x'] === 'number' && typeof great['z'] === 'number') add('KURGAN FIELD', { x: great['x'], z: great['z'] });
    }
    const herd = NALATI_WILDLIFE.herds[0];
    if (herd) add('HORSE PLAINS', herd);
    const bridge = defXZ('BRIDGE'), rz = NDEF.get('RIVER');
    if (bridge !== null && isObj(rz) && typeof rz['z'] === 'function') {
      const x = bridge.x - 90, z: unknown = Reflect.apply(rz['z'], undefined, [x]);
      if (typeof z === 'number') add('KUNES RIVER', { x, z }, '#a8d8f0');
    }
    return out;
  }
  const out: MapPoi[] = CABIN_SITES.map((c, i) => ({ x: c.x, z: c.z, label: `CABIN ${i + 1}`, color: '#8fe3ff' }));
  if (hasPond()) out.push({ x: POND.x, z: POND.z, label: 'THE POND', color: '#6fb8e8' });
  return out;
}

const VIEW_RADIUS = 110;          // metres from the player to the rim
export const LAYER_PPM = 2;       // terrain layer px per metre (1000 × 1000 for the 500 m chunk)
const HEIGHT_STEP = 2;            // metres between height samples for the ground shading
const COVER_PPM = 0.5;            // fog coverage px per metre (1 px per 2 m)
const REVEAL_RADIUS = 45;         // metres a visited position reveals
const STAMP_EVERY = 4;            // metres moved between coverage stamps
const FOG_BRIGHTNESS = 0.3;       // unexplored ground brightness
const DESKTOP_SIZE = 144;         // css px, the fallback before layout (the stylesheet sets it: 144 px desktop, 27.2vw phone — E51, 80 % of 180 / 34vw)

// palette — the game's muted ground tones (see the mockup): olive grass, grey rock, khaki dirt, slate water
const GRASS_LO: RGB = [104, 118, 58], GRASS_HI: RGB = [150, 158, 84];   // olive meadow, lighter with altitude
const FLOOR: RGB = [72, 78, 44];                                            // forest floor under the canopy
const ROCK: RGB = [122, 118, 108];
const WATER = '#3b607c', WATER_EDGE = '#2a4458';
const TRAIL_EDGE = 'rgba(80, 64, 44, 0.85)', TRAIL = '#a08a66';
const CROWN_DARK = '#2b4229', CROWN_MID = '#3c5a34', CROWN_LIGHT = '#66864a', CROWN_SHADOW = 'rgba(18, 34, 20, 0.5)';
const ROOF = '#74523a', ROOF_RIDGE = '#9a7a58', ROOF_SHADOW = 'rgba(0, 0, 0, 0.45)';
// the built world's looks (ChunkDef.map): fill, outline — flat, like the roofs
const LOOK: Record<MapPoly['look'], [string, string]> = { planks: ['#c9a46c', '#5e4630'], timber: ['#8e5d38', '#3a2716'], stone: ['#ddd6c4', '#5f5a50'], rock: ['#8f8a7e', '#403c36'] };
const PATH_EDGE = 'rgba(112, 90, 58, 0.6)', PATH = '#e4cd96', PALM = '#3d7a3c', PALM_SHADOW = 'rgba(10, 30, 16, 0.4)';
const VOID = '#0b1016';
const OPEN_SEA = 'rgb(22, 74, 128)';                                        // an ocean shard past the painted map: the deep-sea colour (SEA_DEEP)
const DOT_PASSIVE = '#ffe066', DOT_AGGRESSIVE = '#ff5a4a', DOT_OUTLINE = 'rgba(6, 10, 18, 0.9)';
const ARROW = '#ffffff';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number, out: RGB) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };

function canvas(w: number, h: number): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D { const ctx = c.getContext('2d'); if (!ctx) throw new Error('Minimap: no 2d context'); return ctx; }

/** Nalati's painted ground at one sample, by HEIGHT (so it follows any layout): the lowland green, the gold-green high
 *  meadow, grey rock where it is steep, snow over the def's SNOW_LINE, the Kunes' glacial channels + gravel bars (the def's
 *  riverMask), meltwater / the brook (nalatiWetAt), a darker floor where the spruce mask keeps trees */
const RIVER_MASK = defFn('riverMask');
function nalatiGround(x: number, z: number, h: number, slope: number, spruce: number, out: RGB): void {
  const VALLEY: RGB = [92, 128, 58], MEADOW: RGB = [176, 164, 86], MEADOW_HI: RGB = [192, 178, 104];
  const ROCK_N: RGB = [132, 130, 126], SNOW: RGB = [234, 238, 244], SPRUCE_FLOOR: RGB = [52, 70, 44];
  const CHANNEL: RGB = [112, 164, 194], GRAVEL: RGB = [180, 172, 154], MELT: RGB = [100, 156, 190];
  const snowLine = defNum('SNOW_LINE', 55);
  const high = smoothstep(2, 18, h);                                       // off the valley floor onto the high meadow
  mix(VALLEY, MEADOW, high, out);
  mix(out, MEADOW_HI, smoothstep(28, 40, h) * 0.5, out);
  mix(out, SPRUCE_FLOOR, Math.min(1, spruce) * 0.55, out);
  mix(out, ROCK_N, smoothstep(0.16, 0.42, slope), out);
  mix(out, SNOW, smoothstep(snowLine - 4, snowLine + 6, h), out);
  const rm = RIVER_MASK?.(x, z) ?? 0;
  if (rm > 0.35) { mix(GRAVEL, CHANNEL, smoothstep(0.55, 0.8, rm), out); return; }
  if (high > 0.5 && nalatiWetAt(x, z)) mix(out, MELT, 0.9, out);
}

export class Minimap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nLabel: HTMLSpanElement;

  private layer = canvas(CHUNK_SIZE * LAYER_PPM, CHUNK_SIZE * LAYER_PPM);
  private layerDirty = true;
  /** last paint time of the terrain layer, ms */
  paintMs = 0;

  private cover = canvas(Math.ceil(CHUNK_SIZE * COVER_PPM), Math.ceil(CHUNK_SIZE * COVER_PPM));
  private coverCtx = ctx2d(this.cover);
  private stamp: HTMLCanvasElement;
  private lastStampX = Number.NaN; private lastStampZ = Number.NaN;

  private fog = canvas(1, 1);
  private fogCtx = ctx2d(this.fog);
  private vignette: CanvasGradient | null = null;

  private size = 0;      // device px, square
  private dpr = 1;
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
    this.root.append(this.canvas, this.nLabel);
    (parent ?? document.body).append(this.root);
    this.ctx = ctx2d(this.canvas);

    this.stamp = this.buildStamp();
    this.layerDirty = true;
    onActiveChunkChange(() => { this.layerDirty = true; this.clearCoverage(); });
    // a piece the map draws that lands after the layer was painted (the zipline, with the adventure) → paint again
    activeRegistry().onAdd((p) => { if (this.shapes !== null && mapWants(getActiveChunk().map, p.id)) this.layerDirty = true; });

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(this.root);
    }
    this.fit();
  }

  /** The painted terrain layer and fog coverage, for the full map (src/ui/Map.ts). */
  get layers(): { terrain: HTMLCanvasElement; cover: HTMLCanvasElement } { if (this.layerDirty) this.paintLayer(); return { terrain: this.layer, cover: this.cover }; }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.classList.toggle('hidden', !v);
  }

  /** has the player been near (x, z)? — the fog-of-war coverage (a place on the full map is named once explored, else "?") */
  explored(x: number, z: number): boolean {
    const px = Math.floor((CHUNK_HALF - x) * COVER_PPM), pz = Math.floor((CHUNK_HALF - z) * COVER_PPM);
    if (px < 0 || pz < 0 || px >= this.cover.width || pz >= this.cover.height) return false;
    return (this.coverCtx.getImageData(px, pz, 1, 1).data[3] ?? 0) > 128;
  }

  /** Forget everything explored (a new chunk, a respawn to a fresh shard). */
  clearCoverage(): void {
    this.coverCtx.clearRect(0, 0, this.cover.width, this.cover.height);
    this.lastStampX = this.lastStampZ = Number.NaN;
  }

  dispose(): void { this.ro?.disconnect(); this.root.remove(); }

  // ── per frame ──
  update(pos: { x: number; z: number }, yaw: number, animals: readonly MinimapAnimal[]): void {
    if (!this.visible) return;
    if (this.layerDirty) this.paintLayer();
    if (this.size === 0) this.fit();
    if (this.size === 0) return;

    // heading, for the player arrow — the compass band's convention (HUD.ts): +Z is north, turning left decreases it
    let deg = 180 - (yaw * 180) / Math.PI; deg = ((deg % 360) + 360) % 360;

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
    ctx.fillStyle = getActiveChunk().ocean ? OPEN_SEA : VOID; ctx.fillRect(0, 0, D, D); // the island's sea runs on past the chunk edge (the pier spawn looks off it)

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
      if (a.alive === false || (a.hp !== undefined && a.hp <= 0) || a.mem?.['hidden'] === 1) continue;
      const dx = a.position.x - pos.x, dz = a.position.z - pos.z;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;
      const sx = c - dx * k, sy = c - dz * k;
      const aggressive = a.aggressive ?? (hasSpecies(a.kind) && speciesDef(a.kind).aggressive === true);
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
  private fit(): void {
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

  private buildStamp(): HTMLCanvasElement {
    const r = Math.ceil(REVEAL_RADIUS * COVER_PPM);
    const c = canvas(r * 2, r * 2), x = ctx2d(c);
    const g = x.createRadialGradient(r, r, r * 0.45, r, r, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  // ── the terrain layer (once) ──
  private paintLayer(): void {
    const t0 = performance.now();
    this.layerDirty = false;
    this.crowns = null;
    this.shapes = null;
    this.layerGen++;
    this.paintRegion(ctx2d(this.layer), 0, 0, CHUNK_SIZE, this.layer.width, HEIGHT_STEP);
    this.paintMs = performance.now() - t0;
  }

  /** bumps every time the terrain is repainted (a new chunk): the full map's zoom tiles are stale then */
  layerGen = 0;
  /**
   * Paint a square of the map at any resolution — the full map's sharp tiles when zoomed in (src/ui/Map.ts).
   * The square is in map metres from the chunk's NE corner (u = HALF − x, east → right; v = HALF − z, north → up),
   * `sizeM` metres a side into a `px` × `px` canvas, the ground sampled every ~2 px (at least 1/8 m).
   */
  paintTile(target: HTMLCanvasElement, u0: number, v0: number, sizeM: number, px: number): void {
    if (this.layerDirty) this.paintLayer();
    if (target.width !== px || target.height !== px) { target.width = px; target.height = px; }
    const ctx = ctx2d(target);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    this.paintRegion(ctx, u0, v0, sizeM, px, Math.max(0.125, (2 * sizeM) / px));
  }

  /** the pine crowns as (u, v, r) metre triples — the same Rng walk every time, so a tile draws the crowns the layer does */
  private crowns: number[] | null = null;
  private crownList(): number[] {
    if (this.crowns) return this.crowns;
    const F = getActiveChunk().forest, density = new Noise2D(SEED + 5);
    const rng = new Rng(SEED + 4242);
    const cell = 5, half = CHUNK_HALF - 6;
    const cabinR = 12;
    const crowns: number[] = [];
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
      crowns.push(CHUNK_HALF - cx, CHUNK_HALF - cz, 3.4 + rng.range(0, 2.6));
    }
    this.crowns = crowns;
    return crowns;
  }

  /** the terrain over map square (u0, v0, sizeM metres) into `ctx` at px × px; ground sampled every `step` metres */
  private paintRegion(ctx: CanvasRenderingContext2D, u0: number, v0: number, sizeM: number, px: number, step: number): void {
    const ppm = px / sizeM, k = ppm / LAYER_PPM; // k: the layer's pixel-sized details (shadow offsets) scale with it
    const toU = (x: number): number => (CHUNK_HALF - x - u0) * ppm;   // east (−X) → right
    const toV = (z: number): number => (CHUNK_HALF - z - v0) * ppm;   // north (+Z) → up

    // ground: sample heights on a `step` grid (one sample of margin each side, so tiles shade seamlessly), hillshade from
    // the sampled slopes, upscale smoothly
    const N = Math.ceil(sizeM / step) + 1, M = N + 2;
    const h = step >= HEIGHT_STEP ? new Float32Array(M * M) : this.smoothHeights(u0, v0, step, M);
    if (step >= HEIGHT_STEP) for (let j = 0; j < M; j++) { const z = CHUNK_HALF - v0 - (j - 1) * step; for (let i = 0; i < M; i++) h[j * M + i] = heightAt(CHUNK_HALF - u0 - (i - 1) * step, z); }
    const [hMin, hMax] = this.heightRange();
    const img = new ImageData(N, N), data = img.data, col: RGB = [0, 0, 0];
    const lx = -0.55, ly = 0.65, lz = -0.52; // light from the upper-left of the map (north-west), fairly low
    const chunk = getActiveChunk();
    const F = chunk.forest;
    const ocean = chunk.ocean ?? null; // open-water shard: sea by depth, sand where the floor breaks the surface, no forest
    const SEA_DEEP: RGB = [22, 74, 128], SEA_SHALLOW: RGB = [78, 196, 214], SAND: RGB = [226, 206, 150];
    const painted = chunk.style === 'painterly';   // Nalati: its own palette (nalatiGround), its names, no pines / cabins
    const spruce = painted ? chunk.forest.mask : undefined;
    const density = new Noise2D(SEED + 5);   // Forest.ts thins its tree candidates with this field: groves are dark floor, clearings meadow
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = CHUNK_HALF - u0 - i * step, wz = CHUNK_HALF - v0 - j * step;
      const c = (j + 1) * M + i + 1;
      const dhx = ((h[c + 1] ?? 0) - (h[c - 1] ?? 0)) / (2 * step);
      const dhy = ((h[c + M] ?? 0) - (h[c - M] ?? 0)) / (2 * step);
      const inv = 1 / Math.hypot(dhx, dhy, 1);
      const nx = -dhx * inv, ny = inv, nz = -dhy * inv;
      const shade = 0.6 + 0.4 * Math.max(0, nx * lx + ny * ly + nz * lz) / Math.hypot(lx, ly, lz);
      const slope = 1 - ny;
      const hij = h[c] ?? 0;
      const alt = (hij - hMin) / Math.max(1, hMax - hMin);
      let sh = shade;
      if (painted) {
        nalatiGround(wx, wz, hij, slope, spruce?.(wx, wz) ?? 0, col);
      } else if (ocean) {
        const depth = ocean.level - hij;
        if (depth > 0) { mix(SEA_SHALLOW, SEA_DEEP, smoothstep(0, ocean.deepDepth, depth), col); sh = 1; }
        else { mix(SAND, GRASS_HI, smoothstep(1.5, 8, -depth), col); mix(col, ROCK, smoothstep(0.14, 0.4, slope), col); }
      } else {
        const grove = smoothstep(F.clearings[0], F.clearings[1], density.fbm(wx * F.densityFreq, wz * F.densityFreq, 3));
        mix(GRASS_LO, GRASS_HI, alt, col);
        mix(col, FLOOR, grove * 0.8, col);
        mix(col, ROCK, smoothstep(0.14, 0.4, slope), col);
      }
      const o = (j * N + i) * 4;
      data[o] = col[0] * sh; data[o + 1] = col[1] * sh; data[o + 2] = col[2] * sh; data[o + 3] = 255;
    }
    const small = canvas(N, N); ctx2d(small).putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const cellPx = step * ppm; // sample i sits at u0 + i·step: centre each texel on its sample
    ctx.drawImage(small, 0, 0, N, N, -cellPx / 2, -cellPx / 2, N * cellPx, N * cellPx);

    // pond
    if (hasPond()) {
      const u = toU(POND.x), v = toV(POND.z), r = POND.r * ppm;
      ctx.beginPath(); ctx.arc(u, v, r * 1.12, 0, Math.PI * 2); ctx.fillStyle = WATER_EDGE; ctx.fill();
      const g = ctx.createRadialGradient(u - r * 0.3, v - r * 0.3, r * 0.1, u, v, r);
      g.addColorStop(0, '#4d7592'); g.addColorStop(1, WATER);
      ctx.beginPath(); ctx.arc(u, v, r * 0.98, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    }

    if (painted) {
      // the spruce: a stipple of dark crowns where the chunk's own spruce mask keeps trees
      if (spruce) {
        const rng = new Rng(SEED + 4242);
        for (let x = -CHUNK_HALF + 3; x < CHUNK_HALF - 3; x += 4.2) for (let z = -CHUNK_HALF + 3; z < CHUNK_HALF - 3; z += 4.2) {
          const cx = x + rng.range(-1.6, 1.6), cz = z + rng.range(-1.6, 1.6);
          if (rng.next() > spruce(cx, cz) * 0.85) continue;
          const r = (1.6 + rng.range(0, 1.1)) * ppm;
          ctx.fillStyle = 'rgba(14, 26, 18, 0.45)'; ctx.beginPath(); ctx.arc(toU(cx) + 0.8 * ppm, toV(cz) + 0.8 * ppm, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rng.next() < 0.5 ? '#2c4a30' : '#38583a'; ctx.beginPath(); ctx.arc(toU(cx), toV(cz), r, 0, Math.PI * 2); ctx.fill();
        }
      }
      // the roads (the N road, the sky road's hairpins …): the chunk's trails, a warm dirt line
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, style] of [[6, 'rgba(70, 54, 36, 0.8)'], [3.5, '#b89c70']] as const) {
        ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
        for (const poly of TRAILS) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
        ctx.stroke();
      }
      return;
    }
    if (ocean) { this.paintBuilt(ctx, toU, toV, ppm, px, k); return; } // the piers, the paths, the island's buildings: all from ChunkDef.map
    // trails: a dark bed with a lighter dirt centre
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (w: number, style: string): void => {
      ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
      for (const poly of TRAILS) { poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z)))); }
      ctx.stroke();
    };
    stroke(8, TRAIL_EDGE); stroke(5, TRAIL);

    // pine crowns (shadows go under every crown, so two passes), only those that touch the square
    const crowns = this.crownList();
    const sprite = this.buildCrownSprite(Math.ceil(6 * ppm));
    const touches = (u: number, v: number, r: number): boolean => u + r > 0 && v + r > 0 && u - r < px && v - r < px;
    ctx.fillStyle = CROWN_SHADOW;
    for (let i = 0; i < crowns.length; i += 3) {
      const u = ((crowns[i] ?? 0) - u0) * ppm, v = ((crowns[i + 1] ?? 0) - v0) * ppm, r = (crowns[i + 2] ?? 0) * ppm;
      if (!touches(u, v, r * 1.6)) continue;
      ctx.beginPath(); ctx.arc(u + 1.5 * ppm, v + 1.5 * ppm, r * 1.1, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < crowns.length; i += 3) {
      const u = ((crowns[i] ?? 0) - u0) * ppm, v = ((crowns[i + 1] ?? 0) - v0) * ppm, r = (crowns[i + 2] ?? 0) * ppm;
      if (touches(u, v, r)) ctx.drawImage(sprite, u - r, v - r, r * 2, r * 2);
    }

    // cabin roofs: a rotated rectangle with a ridge line and a soft shadow
    for (const c of CABIN_SITES) {
      const w = 9 * ppm, dpt = 7 * ppm;
      ctx.save();
      ctx.translate(toU(c.x), toV(c.z));
      ctx.rotate(-c.rot); // Ry(rot) turns +x toward −z; on screen (u, v) = (−x, −z) that is anticlockwise, canvas rotate() is clockwise
      ctx.fillStyle = ROOF_SHADOW; ctx.fillRect(-w / 2 + 2 * k, -dpt / 2 + 3 * k, w, dpt);
      ctx.fillStyle = ROOF; ctx.fillRect(-w / 2, -dpt / 2, w, dpt);
      ctx.fillStyle = ROOF_RIDGE; ctx.fillRect(-w / 2, -k, w, 2 * k);
      ctx.restore();
    }
  }

  /** the def's built world as shapes (mapShapes), read from the registry once per layer paint */
  private shapes: MapShapes | null = null;
  /** ChunkDef.map over the square: the sand paths, the palms' crowns, then each look's footprints — outlined as one
   *  silhouette (every outline first, then every fill), a soft shadow under them like the cabin roofs */
  private paintBuilt(ctx: CanvasRenderingContext2D, toU: (x: number) => number, toV: (z: number) => number, ppm: number, px: number, k: number): void {
    const def = getActiveChunk().map;
    if (!def) return;
    this.shapes ??= mapShapes(def, activeRegistry().pieces);
    const { polys, dots } = this.shapes;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, style] of [[4.5, PATH_EDGE], [3, PATH]] as const) {
      ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
      for (const poly of def.paths ?? []) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
      ctx.stroke();
    }
    const inside = (u0: number, v0: number, u1: number, v1: number): boolean => Math.max(u0, u1) > -4 && Math.max(v0, v1) > -4 && Math.min(u0, u1) < px + 4 && Math.min(v0, v1) < px + 4;
    const r = Math.max(1.6 * ppm, 1.1), sh = Math.max(ppm * 0.6, 1);
    ctx.fillStyle = PALM_SHADOW; ctx.beginPath();
    for (const d of dots) { const u = toU(d.x), v = toV(d.z); if (inside(u, v, u, v)) { ctx.moveTo(u + sh + r, v + sh); ctx.arc(u + sh, v + sh, r, 0, Math.PI * 2); } }
    ctx.fill();
    ctx.fillStyle = PALM; ctx.beginPath();
    for (const d of dots) { const u = toU(d.x), v = toV(d.z); if (inside(u, v, u, v)) { ctx.moveTo(u + r, v); ctx.arc(u, v, r, 0, Math.PI * 2); } }
    ctx.fill();
    const trace = (p: MapPoly, du: number, dv: number): void => {
      for (let i = 0; i < p.pts.length; i += 2) { const u = toU(p.pts[i] ?? 0) + du, v = toV(p.pts[i + 1] ?? 0) + dv; if (i === 0) ctx.moveTo(u, v); else ctx.lineTo(u, v); }
      ctx.closePath();
    };
    for (const look of ['rock', 'planks', 'timber', 'stone'] as const) {
      const mine = polys.filter((p) => p.look === look && inside(toU(p.x0), toV(p.z0), toU(p.x1), toV(p.z1)));
      if (mine.length === 0) continue;
      const [fill, edge] = LOOK[look];
      ctx.fillStyle = ROOF_SHADOW; ctx.beginPath(); for (const p of mine) trace(p, 1.5 * k, 2 * k); ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = Math.max(0.7 * ppm, 1.2); ctx.beginPath(); for (const p of mine) trace(p, 0, 0); ctx.stroke();
      ctx.fillStyle = fill; ctx.beginPath(); for (const p of mine) trace(p, 0, 0); ctx.fill();
    }
  }

  /**
   * Heights for a zoom tile finer than the ground's own ~2 m grid: sampled every HEIGHT_STEP, then Catmull-Rom
   * interpolated to the fine `step` grid (M × M, one sample of margin), so slopes stay smooth — sampling heightAt
   * directly shades its bilinear 2 m cells as stair-steps along every cliff and shore.
   */
  private smoothHeights(u0: number, v0: number, step: number, M: number): Float32Array {
    const HS = HEIGHT_STEP;
    const cu0 = Math.floor((u0 - 2 * step) / HS) * HS - HS, cv0 = Math.floor((v0 - 2 * step) / HS) * HS - HS;
    const C = Math.ceil((M * step + 4 * step) / HS) + 6;
    const g = new Float32Array(C * C);
    for (let b = 0; b < C; b++) { const z = CHUNK_HALF - (cv0 + b * HS); for (let a = 0; a < C; a++) g[b * C + a] = heightAt(CHUNK_HALF - (cu0 + a * HS), z); }
    // per axis: the first of the four coarse nodes and their Catmull-Rom weights, for each fine sample
    const axis = (origin: number, start: number): { idx: Int32Array; w: Float32Array } => {
      const idx = new Int32Array(M), w = new Float32Array(M * 4);
      for (let k = 0; k < M; k++) {
        const t = (start + (k - 1) * step - origin) / HS, ia = Math.floor(t), f = t - ia, f2 = f * f, f3 = f2 * f;
        idx[k] = Math.min(C - 4, Math.max(0, ia - 1));
        w[k * 4] = (-f + 2 * f2 - f3) / 2; w[k * 4 + 1] = (2 - 5 * f2 + 3 * f3) / 2; w[k * 4 + 2] = (f + 4 * f2 - 3 * f3) / 2; w[k * 4 + 3] = (f3 - f2) / 2;
      }
      return { idx, w };
    };
    const U = axis(cu0, u0), V = axis(cv0, v0);
    const h = new Float32Array(M * M);
    for (let j = 0; j < M; j++) {
      const vb = V.idx[j] ?? 0;
      for (let i = 0; i < M; i++) {
        const ua = U.idx[i] ?? 0;
        let sum = 0;
        for (let b = 0; b < 4; b++) {
          const row = (vb + b) * C + ua;
          const r = (g[row] ?? 0) * (U.w[i * 4] ?? 0) + (g[row + 1] ?? 0) * (U.w[i * 4 + 1] ?? 0) + (g[row + 2] ?? 0) * (U.w[i * 4 + 2] ?? 0) + (g[row + 3] ?? 0) * (U.w[i * 4 + 3] ?? 0);
          sum += r * (V.w[j * 4 + b] ?? 0);
        }
        h[j * M + i] = sum;
      }
    }
    return h;
  }

  /** the chunk's lowest and highest ground on the HEIGHT_STEP grid — the altitude tint is relative to it, the same in every tile */
  private hRange: [number, number] | null = null;
  private heightRange(): [number, number] {
    if (this.hRange && this.hRangeGen === this.layerGen) return this.hRange;
    let lo = Infinity, hi = -Infinity;
    for (let z = -CHUNK_HALF; z <= CHUNK_HALF; z += HEIGHT_STEP) for (let x = -CHUNK_HALF; x <= CHUNK_HALF; x += HEIGHT_STEP) {
      const v = heightAt(x, z); if (v < lo) lo = v; if (v > hi) hi = v;
    }
    this.hRange = [lo, hi]; this.hRangeGen = this.layerGen;
    return this.hRange;
  }
  private hRangeGen = -1;

  private crownSprites = new Map<number, HTMLCanvasElement>();
  private buildCrownSprite(r: number): HTMLCanvasElement {
    const hit = this.crownSprites.get(r); if (hit) return hit;
    const c = canvas(r * 2, r * 2), x = ctx2d(c);
    this.crownSprites.set(r, c);
    const g = x.createRadialGradient(r * 0.7, r * 0.7, 0, r, r, r);
    g.addColorStop(0, CROWN_LIGHT); g.addColorStop(0.4, CROWN_MID); g.addColorStop(1, CROWN_DARK);
    x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, Math.PI * 2); x.fill();
    return c;
  }
}

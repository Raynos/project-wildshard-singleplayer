import { CosmeticsLocker } from '@wildshard/game/cosmetics/locker';
import { EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { EffectTarget } from '@wildshard/engine/combat/effects/types';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { nalatiSkinEffect } from './effects';
import * as THREE from 'three';
import type { Bow } from '@wildshard/game/weapons/Bow';
import type { SabreWeapon } from '../runtime/weapons/mountedSword';
import { horseBones } from '../species/horse';

import { nalatiSkinsSave as savedSlot } from './saves';


/**
 * Nalati's wearable skins (plan row B15; handoff docs/design/nalati/handoff/b15-items-map.md §2). The named elites drop
 * them (src/shards/nalati-grasslands/elites.ts `ELITE_DEFS[*].drop.skin`, persisted by the elite system and mirrored in `elites.skins`), the
 * Storm Titan pays the Sky-Marked Saddle. This is the locker (what you own and wear, per slot, persisted) and the painter
 * (the look on the kit and your horse) — separate from Skins.ts, whose tables are the crossbow / AR-15 material names.
 *
 *   const locker = new NalatiSkinLocker();         // loads 'ws.nalati.skins.v1'
 *   locker.own(id)                                 // a drop taken (auto-worn when its slot is bare)
 *   locker.toggle(id)                              // the menu's Inventory tab: WEAR / TAKE OFF
 *   locker.entries()                               // the Inventory rows
 *   const painter = new NalatiSkinPainter(locker, { sabre, bow, golden: () => …, naizagai: () => …, horses: () => … })
 *   painter.update(dt)                             // every frame (cheap: re-applies only on a change / a new horse)
 *
 * The looks (uniforms / vertex colours only — no new shader programs):
 *   IRBIS sabre        — pale frost steel (the steel extras material)
 *   SKY-WOLF bow       — blue-grey horn limbs, a silver string (Bow.setStyle('sky-wolf'))
 *   STORM-WING arrows  — golden arrows (the arrow pool's painterly tint)
 *   NIGHT RIDER mount  — a near-black coat with a faint spectral glow
 *   SKY-MARKED SADDLE  — the horse's felt blanket repainted white-and-blue, a white blaze down the face (vertex colours)
 * A mount skin dresses the horse you ride and your bonded horse (Tulpar / Argymaq).
 */

export type NalatiSkinSlot = 'sabre' | 'bow' | 'arrows' | 'mount';
export interface NalatiSkinDef { id: string; slot: NalatiSkinSlot; name: string; blurb: string }
export interface NalatiSkinEntry extends NalatiSkinDef { worn: boolean }

export const NALATI_SKINS: readonly NalatiSkinDef[] = [
  { id: 'irbis-sabre', slot: 'sabre', name: 'Irbis', blurb: 'Sabre skin · pale frost steel' },
  { id: 'sky-wolf-bow', slot: 'bow', name: 'Sky-Wolf', blurb: 'Bow skin · blue-grey horn, a silver string' },
  { id: 'storm-wing-arrows', slot: 'arrows', name: 'Storm-Wing', blurb: 'Arrow skin · golden fletching' },
  { id: 'night-rider-mount', slot: 'mount', name: 'Night Rider', blurb: 'Mount skin · black barding, a spectral glow' },
  { id: 'sky-marked-saddle', slot: 'mount', name: 'Sky-Marked Saddle', blurb: 'Mount skin · white-and-blue felt, a lightning blaze' },
];
/** Nalati profile: auto-wear bare slots and synchronize the authored skin effects. */
export class NalatiSkinLocker extends CosmeticsLocker<NalatiSkinSlot, NalatiSkinDef> {
  readonly effects = new EffectService(NALATI_SKINS.map((skin) => nalatiSkinEffect(skin.id, skin.slot)));
  readonly effectTarget: EffectTarget = { attributes: {} };
  constructor(save: Pick<typeof savedSlot, 'read' | 'write'> = savedSlot) {
    super('nalati-grasslands', NALATI_SKINS, { save, autoWear: true, slot: (row) => row.slot });
    this.changed = () => { this.syncEffects(); };
    this.syncEffects();
  }
  private syncEffects(): void {
    this.effects.sync(this.effectTarget, Object.values(this.worn).map((id) => ({ id: `effect.skin.${id}` })));
  }
}

export interface SkinTargets {
  mounted?: () => Animal | null;
  sabre: SabreWeapon | null;
  bow: Bow | null;
  /** the Golden Bow is yours (its repaint is the bow's base look under a skin) */
  golden: () => boolean;
  /** Naizagai is yours (its storm-blue blade is the sabre's base look under a skin) */
  naizagai: () => boolean;
  /** your bonded horse (Tulpar / Argymaq), if any */
  tulpar: () => Animal | null;
}

const FROST = new THREE.Color(0.9, 0.96, 1.0), FROST_GLOW = new THREE.Color(0.08, 0.14, 0.2);
const STORM_BLUE = new THREE.Color(0.62, 0.78, 1.0), STORM_GLOW = new THREE.Color(0.1, 0.2, 0.55);
const GOLD_ARROW = new THREE.Color(1.35, 1.0, 0.42);
const NIGHT_COAT = new THREE.Color(0.3, 0.3, 0.36), NIGHT_GLOW = new THREE.Color(0.008, 0.03, 0.045);

const FELT_BLUE = new THREE.Color(0.03, 0.09, 0.42), FELT_WHITE = new THREE.Color(0.8, 0.82, 0.88), BLAZE = new THREE.Color(0.95, 0.96, 1.0);
interface HorseDress { coat: THREE.Color; emissive: THREE.Color; skin: string; geo?: THREE.BufferGeometry; map?: THREE.Texture }

export class NalatiSkinPainter {
  private applied = -1;
  private readonly steel = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; emissive: THREE.Color; ei: number }>();
  private arrowBase: THREE.Color | null = null;
  private readonly dressed = new Map<Animal, HorseDress>();
  private goldenWas = false; private naizagaiWas = false;

  constructor(private readonly locker: NalatiSkinLocker, private readonly t: SkinTargets) {}

  update(): void {
    const golden = this.t.golden(), nz = this.t.naizagai();
    if (this.applied !== this.locker.version || golden !== this.goldenWas || nz !== this.naizagaiWas) {
      this.applied = this.locker.version; this.goldenWas = golden; this.naizagaiWas = nz;
      this.paintKit();
      for (const [a] of this.dressed) this.undress(a);
    }
    // the mount skin: the horse under you and your bonded horse
    const skin = this.locker.wearing('mount')?.id ?? null;
    const want = new Set<Animal>();
    if (skin !== null) { const mounted = this.t.mounted?.() ?? null; if (mounted !== null) want.add(mounted); const tp = this.t.tulpar(); if (tp !== null && tp.alive && !tp.hidden) want.add(tp); }
    for (const [a, d] of this.dressed) if (!want.has(a) || d.skin !== skin) this.undress(a);
    if (skin !== null) for (const a of want) if (!this.dressed.has(a)) this.dress(a, skin);
  }

  private paintKit(): void {
    const sab = this.t.sabre, bow = this.t.bow;
    // the sabre's steel: frost (Irbis) over storm-blue (Naizagai) over the forged original
    if (sab !== null) {
      sab.model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mats: readonly unknown[] = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue;
          let base = this.steel.get(m);
          if (base === undefined) {
            // the forged look — before any skin; if Naizagai already repainted it, its colours are the base we keep
            base = { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity };
            this.steel.set(m, base);
          }
          const irbis = this.locker.effects.has(this.locker.effectTarget, 'cosmetic.skin.irbis-sabre');
          if (irbis) { m.color.copy(FROST); m.emissive.copy(FROST_GLOW); m.emissiveIntensity = 1; }
          else if (this.t.naizagai()) { m.color.copy(STORM_BLUE); m.emissive.copy(STORM_GLOW); m.emissiveIntensity = 1; }
          else { m.color.copy(base.color); m.emissive.copy(base.emissive); m.emissiveIntensity = base.ei; }
        }
      });
    }
    if (bow !== null) {
      bow.setStyle(this.locker.effects.has(this.locker.effectTarget, 'cosmetic.skin.sky-wolf-bow') ? 'sky-wolf' : this.t.golden() ? 'golden' : 'recurve');
      const am = bow.arrows.mesh.material;
      if (am instanceof THREE.MeshLambertMaterial) {
        this.arrowBase ??= am.color.clone();
        am.color.copy(this.locker.effects.has(this.locker.effectTarget, 'cosmetic.skin.storm-wing-arrows') ? GOLD_ARROW : this.arrowBase);
      }
    }
  }

  private coatMats(a: Animal): THREE.MeshLambertMaterial[] {
    const mats: readonly unknown[] = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
    return mats.filter((m): m is THREE.MeshLambertMaterial => m instanceof THREE.MeshLambertMaterial);
  }

  private dress(a: Animal, skin: string): void {
    const mats = this.coatMats(a);
    const first = mats[0];
    const d: HorseDress = { coat: first ? first.color.clone() : new THREE.Color(1, 1, 1), emissive: first ? first.emissive.clone() : new THREE.Color(0, 0, 0), skin };
    if (skin === 'night-rider-mount') for (const m of mats) { m.color.copy(NIGHT_COAT); m.emissive.copy(NIGHT_GLOW); }
    if (skin === 'sky-marked-saddle') {
      // the horse's own felt blanket repainted white-and-blue, a white blaze down the face — on a clone of its geometry
      // (the variant's geometry is shared), so taking the skin off hands the original back
      // a rigged hull (the default creatures, glbCreatures.ts) carries its felt in the atlas: the atlas is repainted
      const m0 = mats[0];
      if (m0?.map) {
        d.map = m0.map;
        const felt = skyMarkedAtlas(m0.map, FELT_BLUE, FELT_WHITE, a.mesh.geometry);
        for (const m of mats) { m.map = felt; m.needsUpdate = true; }
      } else {
        const orig = a.mesh.geometry, g = orig.clone();
        let head = -1;
        try { head = a.mesh.skeleton.bones.indexOf(horseBones(a).head); } catch { /* not a horse rig */ }
        if (skyMarked(g, head)) { a.mesh.geometry = g; d.geo = orig; } else g.dispose();
      }
    }
    this.dressed.set(a, d);
  }

  private undress(a: Animal): void {
    const d = this.dressed.get(a);
    if (d === undefined) return;
    for (const m of this.coatMats(a)) { m.color.copy(d.coat); m.emissive.copy(d.emissive); }
    if (d.geo !== undefined) { a.mesh.geometry.dispose(); a.mesh.geometry = d.geo; }
    if (d.map !== undefined) for (const m of this.coatMats(a)) { m.map = d.map; m.needsUpdate = true; }
    this.dressed.delete(a);
  }
}

/** repaint a horse geometry's red felt (the camp / Tulpar blanket and tassels: red ≫ green, unlike the leather or the
 *  straps) white with blue in its dark rules, and a white blaze on the head bone's top midline; false when nothing changed */
function skyMarked(g: THREE.BufferGeometry, head: number): boolean {
  const col = g.getAttribute('color'), pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  if (!(col instanceof THREE.BufferAttribute)) return false;
  let n = 0;
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), gr = col.getY(i);
    if (r > 0.02 && r > gr * 10) {
      const k = Math.min(1, Math.max(0, (r / 0.34 - 0.35) / 0.45));
      c.copy(FELT_BLUE).lerp(FELT_WHITE, k * k * (3 - 2 * k));
      col.setXYZ(i, c.r, c.g, c.b); n++;
      continue;
    }
    if (head >= 0 && si instanceof THREE.BufferAttribute && sw instanceof THREE.BufferAttribute && nrm instanceof THREE.BufferAttribute && pos instanceof THREE.BufferAttribute
      && si.getX(i) === head && sw.getX(i) > 0.5 && Math.abs(pos.getX(i)) < 0.028 && nrm.getY(i) > 0.25) {
      col.setXYZ(i, BLAZE.r, BLAZE.g, BLAZE.b); n++;
    }
  }
  col.needsUpdate = true;
  return n > 0;
}

// ── the Sky-Marked Saddle on a rigged hull: its atlas repainted ──
const LUT_N = 4096;
const toSrgb = new Uint8ClampedArray(LUT_N + 1).map((_, i) => { const c = i / LUT_N; return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
const hueOf = (r: number, g: number, b: number): number => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d <= 1e-6) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};

/** per source atlas, its sky-marked repaint */
const skyCache = new WeakMap<THREE.Texture, THREE.Texture>();

/** an atlas's pixels on a canvas (null when the image can't be read) */
function readAtlas(map: THREE.Texture): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData } | null {
  const img = map.image as CanvasImageSource & { width: number; height: number } | null;
  if (!img || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, data: ctx.getImageData(0, 0, img.width, img.height) };
}

/**
 * The Sky-Marked Saddle on a rigged hull: the red felt of the saddle cloth repainted from deep blue to white by its
 * brightness, as the painter does to the procedural blanket's vertex colours. Cached per source atlas.
 *
 * By hue alone only the cloth's brightest trim changed (NALATI-FINISH B2, E302: "the saddle skin repaints only the
 * trim"): the generated atlas paints the cloth a brick red (≈ 5–16°) that runs into the bay coat's orange-brown (≈ 16–25°).
 * With the hull's `geometry` the texels of the triangles under the saddle (the middle of the back, down the flanks to the
 * girth — `SADDLE_ZONE`, in the bind pose's box) are masked in uv space, and inside that mask every red-to-rust texel is
 * felt and the cream ornament goes white; outside it only the saturated brick red (the tassels) is.
 */
function skyMarkedAtlas(map: THREE.Texture, blue: THREE.Color, white: THREE.Color, geometry?: THREE.BufferGeometry): THREE.Texture {
  const hit = skyCache.get(map);
  if (hit) return hit;
  const a = readAtlas(map);
  if (!a) return map;
  const W = a.canvas.width, H = a.canvas.height;
  const zone = geometry ? saddleMask(geometry, W, H, map.flipY) : null;
  const px = a.data.data;
  const c = new THREE.Color();
  for (let o = 0; o < px.length; o += 4) {
    const R = (px[o] ?? 0) / 255, G = (px[o + 1] ?? 0) / 255, B = (px[o + 2] ?? 0) / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx > 0 ? 1 - mn / mx : 0;
    const inZone = zone !== null && (zone[o >> 2] ?? 0) > 0;
    let w: number, k: number;
    if (inZone && sat < 0.32 && mx > 0.62) { w = 0.9; k = 1; }                       // the cream ornament → white felt
    else {
      if (mx - mn < 0.05) continue;
      let dh = hueOf(R, G, B); if (dh > 180) dh -= 360;                              // −180 … 180, red at 0
      w = inZone
        ? (1 - THREE.MathUtils.smoothstep(dh, 15, 19)) * THREE.MathUtils.smoothstep(dh, -30, -20) * THREE.MathUtils.smoothstep(sat, 0.36, 0.46) * THREE.MathUtils.smoothstep(mx, 0.14, 0.24)
        : (1 - THREE.MathUtils.smoothstep(Math.abs(dh - 4), 9, 13)) * THREE.MathUtils.smoothstep(sat, 0.5, 0.6) * THREE.MathUtils.smoothstep(mx, 0.3, 0.45);
      if (w <= 0) continue;
      // the felt: deep blue in the cloth's body, white only in its highlights (the ornament above is white) — inside the
      // saddle zone the whole cloth changes, so it may lean blue; the tassels outside keep the old ramp
      k = inZone ? Math.min(1, Math.max(0, (mx - 0.34) / 0.5)) : Math.min(1, Math.max(0, (mx - 0.2) / 0.5));
    }
    c.copy(blue).lerp(white, k * k * (3 - 2 * k));
    const tr = toSrgb[Math.round(Math.min(1, c.r) * LUT_N)] ?? 0, tg = toSrgb[Math.round(Math.min(1, c.g) * LUT_N)] ?? 0, tb = toSrgb[Math.round(Math.min(1, c.b) * LUT_N)] ?? 0;
    px[o] = (px[o] ?? 0) + (tr - (px[o] ?? 0)) * w; px[o + 1] = (px[o + 1] ?? 0) + (tg - (px[o + 1] ?? 0)) * w; px[o + 2] = (px[o + 2] ?? 0) + (tb - (px[o + 2] ?? 0)) * w;
  }
  a.ctx.putImageData(a.data, 0, 0);
  const tex = new THREE.CanvasTexture(a.canvas);
  tex.flipY = map.flipY; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = map.anisotropy;
  tex.wrapS = map.wrapS; tex.wrapT = map.wrapT; tex.name = `${map.name}:sky-marked`;
  skyCache.set(map, tex);
  return tex;
}

/** where the saddle cloth sits, as fractions of the hull's bind-pose box (the horse faces +z): the middle of the back
 *  and the flanks down to the girth, clear of the neck and the quarters */
const SADDLE_ZONE = { y0: 0.4, y1: 0.86, z0: 0.3, z1: 0.62 };
/** a uv-space mask (one byte per texel, > 0 inside) of the triangles whose centroid lies in SADDLE_ZONE */
function saddleMask(g: THREE.BufferGeometry, W: number, H: number, flipY: boolean): Uint8ClampedArray | null {
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');   // (a GLB's are often interleaved)
  if (!(pos instanceof THREE.BufferAttribute || pos instanceof THREE.InterleavedBufferAttribute) || !(uv instanceof THREE.BufferAttribute || uv instanceof THREE.InterleavedBufferAttribute)) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return null;
  const sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;   // (the stroke closes the gutters between the fills)
  const idx = g.getIndex(), n = idx ? idx.count : pos.count;
  const at = (i: number): number => (idx ? idx.getX(i) : i);
  const U = (i: number): number => uv.getX(i) * W, V = (i: number): number => (flipY ? 1 - uv.getY(i) : uv.getY(i)) * H;
  for (let t = 0; t + 2 < n; t += 3) {
    const a = at(t), b = at(t + 1), c = at(t + 2);
    const fy = ((pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3 - bb.min.y) / sy, fz = ((pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3 - bb.min.z) / sz;
    if (fy < SADDLE_ZONE.y0 || fy > SADDLE_ZONE.y1 || fz < SADDLE_ZONE.z0 || fz > SADDLE_ZONE.z1) continue;
    ctx.beginPath(); ctx.moveTo(U(a), V(a)); ctx.lineTo(U(b), V(b)); ctx.lineTo(U(c), V(c)); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const d = ctx.getImageData(0, 0, W, H).data, out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] ?? 0;
  return out;
}

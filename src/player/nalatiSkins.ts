import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import type { Bow } from './Bow';
import type { Sabre } from './Sabre';
import { horseBones } from '../entities/species/horse';
import { riding } from './riding';

/**
 * Nalati's wearable skins (plan row B15; handoff docs/design/nalati/handoff/b15-items-map.md §2). The named elites drop
 * them (src/nalati/elites.ts `ELITE_DEFS[*].drop.skin`, persisted by the elite system and mirrored in `elites.skins`), the
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
const STORE = 'ws.nalati.skins.v1';
const byId = (id: string): NalatiSkinDef | undefined => NALATI_SKINS.find((s) => s.id === id);

export class NalatiSkinLocker {
  readonly owned = new Set<string>();
  readonly worn: Partial<Record<NalatiSkinSlot, string>> = {};
  /** bumps on every change (the painter re-applies) */
  version = 0;
  onChange?: (() => void) | undefined;

  constructor() {
    try {
      const raw = localStorage.getItem(STORE);
      const s = raw !== null ? JSON.parse(raw) as { owned?: unknown; worn?: unknown } : null;
      if (s !== null && Array.isArray(s.owned)) for (const id of s.owned) if (typeof id === 'string' && byId(id)) this.owned.add(id);
      if (s !== null && typeof s.worn === 'object' && s.worn !== null) {
        for (const [slot, id] of Object.entries(s.worn as Record<string, unknown>)) {
          if (typeof id !== 'string') continue;
          const d = byId(id);
          if (d?.slot === slot && this.owned.has(id)) this.worn[d.slot] = d.id;
        }
      }
    } catch { /* a fresh locker */ }
  }

  private save(): void {
    this.version++;
    try { localStorage.setItem(STORE, JSON.stringify({ owned: [...this.owned], worn: this.worn })); } catch { /* not persisted */ }
    this.onChange?.();
  }

  /** a skin taken (idempotent): worn at once if nothing is worn in its slot */
  own(id: string): void {
    const d = byId(id);
    if (d === undefined || this.owned.has(id)) return;
    this.owned.add(id);
    this.worn[d.slot] ??= id;
    this.save();
  }
  /** wear it (taking off whatever was in the slot), or take it off if it is on */
  toggle(id: string): void {
    const d = byId(id);
    if (d === undefined || !this.owned.has(id)) return;
    if (this.worn[d.slot] === id) delete this.worn[d.slot]; else this.worn[d.slot] = id;
    this.save();
  }
  wearing(slot: NalatiSkinSlot): string | null { return this.worn[slot] ?? null; }
  entries(): NalatiSkinEntry[] {
    const out: NalatiSkinEntry[] = [];
    for (const d of NALATI_SKINS) if (this.owned.has(d.id)) out.push({ id: d.id, slot: d.slot, name: d.name, blurb: d.blurb, worn: this.worn[d.slot] === d.id });
    return out;
  }
}

export interface SkinTargets {
  sabre: Sabre | null;
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

interface HorseDress { coat: THREE.Color; emissive: THREE.Color; skin: string; geo?: THREE.BufferGeometry }

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
    const skin = this.locker.wearing('mount');
    const want = new Set<Animal>();
    if (skin !== null) { if (riding.horse !== null) want.add(riding.horse); const tp = this.t.tulpar(); if (tp !== null && tp.alive && !tp.hidden) want.add(tp); }
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
          const irbis = this.locker.wearing('sabre') === 'irbis-sabre';
          if (irbis) { m.color.copy(FROST); m.emissive.copy(FROST_GLOW); m.emissiveIntensity = 1; }
          else if (this.t.naizagai()) { m.color.copy(STORM_BLUE); m.emissive.copy(STORM_GLOW); m.emissiveIntensity = 1; }
          else { m.color.copy(base.color); m.emissive.copy(base.emissive); m.emissiveIntensity = base.ei; }
        }
      });
    }
    if (bow !== null) {
      bow.setStyle(this.locker.wearing('bow') === 'sky-wolf-bow' ? 'sky-wolf' : this.t.golden() ? 'golden' : 'recurve');
      const am = bow.arrows.mesh.material;
      if (am instanceof THREE.MeshLambertMaterial) {
        this.arrowBase ??= am.color.clone();
        am.color.copy(this.locker.wearing('arrows') === 'storm-wing-arrows' ? GOLD_ARROW : this.arrowBase);
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
      const orig = a.mesh.geometry, g = orig.clone();
      let head = -1;
      try { head = a.mesh.skeleton.bones.indexOf(horseBones(a).head); } catch { /* not a horse rig */ }
      if (skyMarked(g, head)) { a.mesh.geometry = g; d.geo = orig; } else g.dispose();
    }
    this.dressed.set(a, d);
  }

  private undress(a: Animal): void {
    const d = this.dressed.get(a);
    if (d === undefined) return;
    for (const m of this.coatMats(a)) { m.color.copy(d.coat); m.emissive.copy(d.emissive); }
    if (d.geo !== undefined) { a.mesh.geometry.dispose(); a.mesh.geometry = d.geo; }
    this.dressed.delete(a);
  }
}

const FELT_BLUE = new THREE.Color(0.03, 0.09, 0.42), FELT_WHITE = new THREE.Color(0.8, 0.82, 0.88), BLAZE = new THREE.Color(0.95, 0.96, 1.0);
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

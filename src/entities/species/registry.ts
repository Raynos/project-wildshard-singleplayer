import type * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { HuntTuning } from '../AnimalManager';

/**
 * Species registry — the pluggable contract every huntable species implements.
 *
 * A species lives in ONE file, `src/entities/species/<kind>.ts`, that ends with `registerSpecies({...})`.
 * `AnimalFactory.ts` imports every file in this folder (`import.meta.glob`, eager) so dropping a new file in
 * is the whole integration: nothing in AnimalFactory / Animal / AnimalManager needs a new `case`.
 * Import the geometry helpers from `./loft` and the types + `registerSpecies` from `./registry` — never
 * from `../AnimalFactory` (that would be an import cycle: the factory imports you).
 *
 * See the header of `src/entities/AnimalFactory.ts` for the full contract (coordinates, dims, fur, tints).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Per-variant gameplay multipliers, applied by AnimalManager at spawn on top of the species' HuntTuning. */
export interface VariantMods {
  /** × runSpeed / trotSpeed / charge speed (1 = species baseline) */
  speed: number;
  /** × panicDist (the charge trigger) and the "turns on you when hit" distance */
  chargeDist: number;
  /** × damage taken by BODY hits (headshots always land in full) */
  damageTaken: number;
  /** damage dealt to the player by one charge contact (species default 25) */
  chargeDamage: number;
  /** charges last 3× longer, cool down in 1/3 the time, and a hit always provokes one */
  relentless: boolean;
}

export interface VariantDef {
  /** unique within the species, e.g. 'stag', 'black', 'ironhide' (used in HerdPlan.variants and spawn()) */
  id: string;
  /** shown on the health bar / kill feed, e.g. "White stag", "Old Ironhide" */
  label: string;
  /** relative spawn weight inside the species' table (any positive number; the manager normalises) */
  weight: number;
  rarity: Rarity;
  /** uniform mesh scale rolled per individual: [min, max] (1 = the species' modelled size) */
  scale: [number, number];
  /** max hp; omit for the species' HuntTuning.hp */
  hp?: number;
  /** palette overrides for the species' paint function: keys are whatever that species names in its
   *  palette (deer: body, bodyDark, grey, belly, nose…; boar: base, grizzle, dark…), values sRGB 0..1 */
  tint?: Record<string, [number, number, number]>;
  /** fur material overrides (rim glow, emissive, roughness…) merged over the species' FurStyle */
  fur?: Partial<FurStyle>;
  /** free-form knobs the species' build() reads: antlerScale, tuskScale, piebald, scar… */
  traits?: Record<string, number | boolean | string>;
  /** gameplay multipliers (missing keys = 1 / default) */
  mods?: Partial<VariantMods>;
}

export interface AnimalDims {
  /** height of the body bone (spine centre) above ground in the bind pose */
  bodyY: number;
  /** half-length of the body capsule along Z (for hit tests) */
  bodyHalfLen: number;
  /** radius of the body capsule */
  bodyRadius: number;
  /** head hit-sphere radius */
  headRadius: number;
  /** rest length of the front leg (shoulder → hoof) — drives stride frequency */
  legLen: number;
  /** foot rest positions (x, z) per leg FL, FR, BL, BR */
  feet: [number, number][];
  /** width of the body (for the corpse's resting height when rolled on its side) */
  halfWidth: number;
}

export interface BoneDef { name: string; parent: string | null; pos: [number, number, number] }

/** What `SpeciesDef.build()` returns: the un-merged parts of one (kind, variant) model. */
export interface AnimalSpecies {
  bones: BoneDef[];
  /** geometries drawn with the fur material + fur shells (loft() output: has color / skin / furLen attributes) */
  furParts: THREE.BufferGeometry[];
  /** hard parts: hooves, antlers, tusks, snout (no fur shells, vertex colours only) */
  hardParts: THREE.BufferGeometry[];
  /** eye spheres (glossy clearcoat material) */
  eyeParts: THREE.BufferGeometry[];
  dims: AnimalDims;
}

/** Fur texture + material look of a species (per-variant overrides via VariantDef.fur). */
export interface FurStyle {
  /** seed + parameters of the tileable strand albedo / normal texture (baked as fur-<kind>-{map,normal}) */
  texSeed: number;
  tex: { contrast: number; grizzle: number; normalStrength: number; bristle: number; strandLen: number; root: number };
  roughness: number;
  sheen: number;
  sheenColor: [number, number, number];
  envMapIntensity: number;
  /** backlit Fresnel tip colour (linear rgb) */
  rim: [number, number, number];
  /** metres the outermost fur shell stands off the skin for furLen = 1 */
  shellLen: number;
  /** metres of noise displacement on the body/neck/head silhouette (shaggy coat); 0 = smooth */
  shag: number;
  /** optional self-glow (linear rgb × intensity) — the Ghost stag uses it */
  emissive?: [number, number, number];
  emissiveIntensity?: number;
}

export interface SpeciesDef {
  /** 'deer' | 'boar' | 'bear' | … — the Animal.kind string, also the HerdPlan.kind */
  kind: string;
  /** default display name when a variant has none */
  label: string;
  /** the weighted variant table; the first entry is the fallback when spawn() is given an unknown id */
  variants: VariantDef[];
  fur: FurStyle;
  /** build the mesh parts for one variant; called once per (kind, variant) and cached by the factory */
  build(variant: VariantDef, rng: Rng): AnimalSpecies;
  /** true = turns on the player (charges) instead of only fleeing (boar, bear) */
  aggressive?: boolean;
  /** m/s while wandering (default: 1.1 aggressive / 1.3 not) */
  walkSpeed?: number;
  /** m/s of a charge (default 7.5) */
  chargeSpeed?: number;
  /** damage of one charge contact (default 25) */
  chargeDamage?: number;
  /** the hunting-loop numbers; omit for the manager's DEER_TUNING / BOAR_TUNING (deer / boar keep theirs there) */
  tuning?: HuntTuning;
  /** AnimalSound names for the ambient call and the hurt cry (default deer_call / boar_grunt+boar_squeal) */
  sounds?: { call: string; hurt: string };
  /** animation flavour: grazeNeck 1 = the whole neck goes down (deer), 0.3 = only the nose (boar);
   *  gallopTail 1 = tail flagged straight up when running (deer), 0.5 = half (boar) */
  pose?: { grazeNeck: number; gallopTail: number };
}

const SPECIES = new Map<string, SpeciesDef>();

/** Register a species (call once at module top level of `species/<kind>.ts`). Re-registering replaces it. */
export function registerSpecies(def: SpeciesDef): SpeciesDef {
  if (!def.variants.length) throw new Error(`species '${def.kind}' has no variants`);
  SPECIES.set(def.kind, def);
  return def;
}

export function speciesDef(kind: string): SpeciesDef {
  const d = SPECIES.get(kind);
  if (!d) throw new Error(`unknown animal kind '${kind}' (registered: ${[...SPECIES.keys()].join(', ') || 'none'})`);
  return d;
}

export function hasSpecies(kind: string): boolean { return SPECIES.has(kind); }

export function speciesKinds(): string[] { return [...SPECIES.keys()]; }

/** The variant table entry, or the species' first (fallback) variant for an unknown id. */
export function variantDef(kind: string, id: string | undefined): VariantDef {
  const d = speciesDef(kind);
  return (id && d.variants.find((v) => v.id === id)) || d.variants[0];
}

/** Fully-populated gameplay multipliers for a variant (missing keys → 1 / species default). */
export function variantMods(species: SpeciesDef, v: VariantDef): VariantMods {
  const m = v.mods ?? {};
  return {
    speed: m.speed ?? 1,
    chargeDist: m.chargeDist ?? 1,
    damageTaken: m.damageTaken ?? 1,
    chargeDamage: m.chargeDamage ?? species.chargeDamage ?? 25,
    relentless: m.relentless ?? false,
  };
}

/**
 * Roll one variant by weight with a seeded Rng. `allowed` restricts the pool to those ids (HerdPlan.variants);
 * `excludeLegendary` re-rolls a legendary into the rare tier (the manager caps legendaries at one alive per kind).
 */
export function rollVariant(species: SpeciesDef, rng: Rng, allowed?: string[], excludeLegendary = false): VariantDef {
  let pool = allowed?.length ? species.variants.filter((v) => allowed.includes(v.id)) : species.variants;
  if (!pool.length) pool = species.variants;
  const pick = (list: VariantDef[]) => {
    let total = 0;
    for (const v of list) total += Math.max(0, v.weight);
    let r = rng.next() * total;
    for (const v of list) { r -= Math.max(0, v.weight); if (r <= 0) return v; }
    return list[list.length - 1];
  };
  let v = pick(pool);
  if (excludeLegendary && v.rarity === 'legendary') {
    const rare = pool.filter((x) => x.rarity === 'rare');
    const rest = pool.filter((x) => x.rarity !== 'legendary');
    v = rare.length ? pick(rare) : rest.length ? pick(rest) : v;
  }
  return v;
}

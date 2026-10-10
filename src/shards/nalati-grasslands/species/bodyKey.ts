import type { AnimalDims, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';

/** The bake the page fetches (`species/bodies.ts`); here, renderer-free, so the boot manifest can declare it. */
export const NALATI_BODIES_URL = '/assets/nalati/baked/bodies.bin';

/** The loft families Nalati bakes (`generators/bodies.ts`): the horse (and the riders' and elites' horses), the canid. */
export type BodyFamily = 'horse' | 'canid';

/** Every baked geometry's channels, in the binary's order: the lofts' one layout (then a u16 index). */
export const BODY_ATTRS = [['position', 3], ['normal', 3], ['uv', 2], ['color', 3], ['skinIndex', 4], ['skinWeight', 4], ['furLen', 1]] as const;
/** One baked geometry: its vertex count, its index count, then its draw groups flat (start, count, material …). */
export type BodyGeometryRow = readonly number[];
/** One baked body: what the family's `build()` returned for the key's variant. */
export interface BodyRow {
  readonly key: string;
  readonly bones: readonly BoneDef[];
  readonly dims: AnimalDims;
  readonly fur: readonly BodyGeometryRow[];
  readonly hard: readonly BodyGeometryRow[];
  readonly eye: readonly BodyGeometryRow[];
}
/** The bake's rows (`data/bodies.json`): the binary's hash and size and every body in the binary's order. */
export interface BodyRows { readonly bin: string; readonly bytes: number; readonly bodies: readonly BodyRow[] }

/** JSON with every object's keys sorted (a variant's traits / tint in any authored order name one body) */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(Reflect.get(value, k))}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The bake's key for a variant's body: the family, the loft resolution and the two inputs the lofts read (traits, tint). */
export function bodyKey(family: BodyFamily, v: VariantDef, lowPoly: boolean): string {
  return `${family}${lowPoly ? ':low' : ''}:${canonical({ traits: v.traits ?? null, tint: v.tint ?? null })}`;
}

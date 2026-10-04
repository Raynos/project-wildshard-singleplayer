import * as v from 'valibot';
import { FAMILY_IDS, FamilyMaterialSchema, ToonLookSchema, PainterlyLookSchema, EmissiveLookSchema, type FamilyMaterialParams } from '@wildshard/engine/render/families/params';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
/** Authored material IDs select bounded platform family parameters, never shader source. */
export const MaterialsSchema = v.pipe(v.record(id, FamilyMaterialSchema), v.check((rows) => Object.keys(rows).length <= 256, 'bounded material catalogue'));
/** Optional per-shard family looks use the renderer-neutral engine schemas. */
export const FamilyLooksSchema = v.strictObject({ toon: v.exactOptional(ToonLookSchema), painterly: v.exactOptional(PainterlyLookSchema), emissive: v.exactOptional(EmissiveLookSchema) });
/** Resolve authored surface IDs or the four platform default material IDs. */
export function materialExists(materials: Readonly<Record<string, unknown>>, idValue: string): boolean {
  return Object.hasOwn(materials, idValue) || FAMILY_IDS.some((family) => family === idValue);
}
/** All texture inputs, including ground layers and emitter fields, enter the admitted library closure. */
export function materialTextureRefs(materials: Readonly<Record<string, FamilyMaterialParams>>): string[] {
  return Object.values(materials).flatMap((material) => {
    if (material.family === 'toon') return [];
    if (material.family === 'pbr') return [...Object.values(material.maps), material.ground?.grain.map, material.ground?.trail?.map, material.ground?.keyShadow?.map].filter((ref): ref is string => typeof ref === 'string');
    if (material.family === 'painterly') return material.map === null ? [] : [material.map];
    return [material.map, material.tube?.field, ...(material.sky?.maps ?? [])].filter((ref): ref is string => typeof ref === 'string');
  });
}

/**
 * Splat terrain tiles (SHARD-PLATFORM G227): the data half of drawing a native splat terrain (a PBR ground blended by
 * per-vertex layer weights, PH-L8) from the shardfile's props tiles. A world whose ground was a splat terrain bakes it into
 * props tile GLBs whose terrain primitives carry one named material and two application channels per vertex:
 *
 * - `_SPLAT` (VEC4 float): the four layer weights, layer i = texture array layer i (the native `splatAt`, unweighted:
 *   the shader applies its own `pow 2.2` and renormalisation);
 * - `_CANOPY` (SCALAR float, 0..1): the canopy density under the forest (the native forest's canopy map, sampled at the
 *   vertex as the live terrain does: `Terrain.applyCanopy`, nearest of its 256² cells over the 500 m chunk).
 *
 * `props.splat` names that material and supplies what the material reads per world: the three per-role layer files (four
 * KTX2 files each: colour sRGB, normal (OpenGL green) and ARM numeric, each the UNFLIPPED `#layer` twin, one format and
 * edge per role, full mip chains), the four tints and the boreal extras (null: the plain splat shader). The client builds
 * three array textures from them and draws every tile primitive with that one material (`clientSplatTerrain.ts`); the
 * material name is the only name `props.materials` may leave out.
 *
 * The schema lives here, outside the format file (format ownership: sp-x5 wires `splat: v.exactOptional(SplatTerrainSchema)`
 * into `PropsSchema`, calls `validateSplatTerrain` from the props reference check and `checkTileMaterialNames` where the
 * props GLBs' material names are checked).
 */
import * as v from 'valibot';
import { checkPropMaterialNames, type PropMaterials } from './propMaterials';
import { materialTextureRefs, type MaterialsSchema } from './materials';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const finite = v.pipe(v.number(), v.finite());
const factor = v.pipe(finite, v.minValue(0), v.maxValue(4));
const glbName = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^\P{Cc}+$/u, 'no control characters'), v.check((name) => name.trim() === name, 'no edge whitespace'));
const four = <T extends v.GenericSchema>(item: T) => v.tuple([item, item, item, item]);

/** The texture-array roles and the read each takes: colour is sRGB, normal and ARM numeric data. */
export const SPLAT_ROLES = { colour: 'colour', normal: 'data', arm: 'data' } as const;
/** One texture-array role. */
export type SplatRole = keyof typeof SPLAT_ROLES;
/** The GLB application channels a splat tile primitive carries, the attribute the material reads and its components. */
export const SPLAT_CHANNELS = { _SPLAT: { attribute: 'splat', itemSize: 4 }, _CANOPY: { attribute: 'canopy', itemSize: 1 } } as const;

/** `props.splat`: the splat terrain material the props tiles' terrain primitives draw with. */
export const SplatTerrainSchema = v.strictObject({
  /** the baked GLB material name every terrain primitive carries */
  material: glbName,
  /** per role, layer i's KTX2 file (the unflipped `#layer` twin); layer i is splat channel i */
  layers: v.strictObject({ colour: four(ref), normal: four(ref), arm: four(ref) }),
  /** the layer tints (linear RGB multipliers on the colour layer), the ground set's `groundTints` */
  tints: four(v.tuple([factor, factor, factor])),
  /** the boreal extras (canopy litter, moss, heath, tiling breakup); null draws the plain splat shader */
  boreal: v.nullable(v.strictObject({ normalK: four(factor), trailDust: four(factor) })),
});
/** Admitted splat terrain. */
export type SplatTerrain = v.InferOutput<typeof SplatTerrainSchema>;

const read = new WeakMap<object, SplatTerrain | undefined>();
/** A props section's splat terrain, admitted (undefined: none). Reads the additive `splat` field whether or not `PropsSchema` declares it yet. */
export function splatTerrainOf(props: object): SplatTerrain | undefined {
  if (read.has(props)) return read.get(props);
  const raw: unknown = 'splat' in props ? props.splat : undefined;
  const value = raw === undefined ? undefined : v.parse(SplatTerrainSchema, raw);
  read.set(props, value); return value;
}

/** Every layer file in role order (colour ×4, normal ×4, ARM ×4). */
export function splatTextureRefs(splat: SplatTerrain | undefined): string[] {
  return splat === undefined ? [] : [...splat.layers.colour, ...splat.layers.normal, ...splat.layers.arm];
}

/**
 * Check a splat terrain against the admitted files: every layer file is a KTX2 dependency of a declared props tile GLB, one
 * file plays one role (a file may repeat within a role, never across colour and data), and none is also a `look.materials`
 * or named prop material texture (the arrays own their files). `tiles` are the declared props tile GLBs. Throws the first refusal.
 */
export function validateSplatTerrain(splat: SplatTerrain, context: {
  look: v.InferOutput<typeof MaterialsSchema>; tiles: readonly string[]; propTextures: readonly string[];
  files: readonly { hash: string; kind: string; dependencies: readonly string[] }[];
}): void {
  const files = new Map(context.files.map((file) => [file.hash, file]));
  const declared = new Set(context.tiles.flatMap((tile) => files.get(tile)?.dependencies ?? []));
  const elsewhere = new Set([...materialTextureRefs(context.look), ...context.propTextures]), roles = new Map<string, string>();
  for (const role of Object.keys(SPLAT_ROLES) as SplatRole[]) for (const [layer, hash] of splat.layers[role].entries()) {
    if (files.get(hash)?.kind !== 'ktx2' || !declared.has(hash)) throw new Error(`props.splat ${role} layer ${layer}: must be a KTX2 dependency of a declared props tile`);
    if (elsewhere.has(hash)) throw new Error(`props.splat ${role} layer ${layer}: also bound by another material (the arrays own their files)`);
    const use = SPLAT_ROLES[role], seen = roles.get(hash);
    if (seen !== undefined && seen !== use) throw new Error(`props.splat ${role} layer ${layer}: one texture cannot mix colour and numeric data roles`);
    roles.set(hash, use);
  }
}

/**
 * The props GLB material-name check with a splat terrain. Without one, `checkPropMaterialNames` as before (named materials
 * only). With one, every props GLB draws on the named path (the client resolves the splat name first): each material name
 * is the splat material or a `props.materials` name, every primitive has a material, and a name both map is refused.
 */
export function checkTileMaterialNames(materials: PropMaterials | undefined, splat: SplatTerrain | undefined, bytes: Uint8Array): void {
  if (splat === undefined) { if (materials !== undefined) checkPropMaterialNames(materials, bytes); return; }
  if (materials !== undefined && Object.hasOwn(materials, splat.material)) throw new Error(`props material "${splat.material}" is both the splat terrain and a named prop material`);
  checkPropMaterialNames({ ...materials, [splat.material]: { id: 'pbr', colour: null, normal: null, metallicRoughness: null, occlusion: null, emissive: null } }, bytes);
}

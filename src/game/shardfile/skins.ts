/**
 * Exported skins as creature looks (SHARD-PLATFORM SF16, the format half of the creature seam). A look row whose recipe
 * is `platform.skin` draws its species with an SF9c exported skin instead of a procedural view recipe:
 *
 *   { id, species, recipe: 'platform.skin', material: null, parameters: { skin: '<json file hash>' },
 *     animation: { recipe: 'platform.clips', parameters: { attackSpan: 1 } } }
 *
 * `skin` names a `json` file (`ShardSkinFileSchema`: the export's rig row and its binding) whose one dependency is the
 * skin's `glb` file. Both sit in the library closure, so the loader admits, leases and charges them as declared. The
 * clips are chosen from the creature's state (idle / walk / attack / hit / die, `idle.graze` when grazing);
 * `attackSpan` is the attack duration the export sampled the attack clip with (seconds).
 */
import * as v from 'valibot';
import { parseSkinBindings, parseSkinRows, type SkinBinding, type SkinRow } from './skinData';
import type { ShardRows } from './rows';
import type { Shardfile } from './schema';
import { parseGlb } from './assets';
import { skinLayerDecoded } from './skinLayers';
import { MaterialsSchema } from './materials';

/** The look recipe for an exported skin, and its animation recipe. */
export const SKIN_LOOK_RECIPE = 'platform.skin';
export const SKIN_CLIPS_RECIPE = 'platform.clips';
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
/** The look row's parameters. */
export const SkinLookParametersSchema = v.strictObject({ skin: hash });
/** The animation recipe's parameters. */
export const SkinClipParametersSchema = v.strictObject({ attackSpan: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.05), v.maxValue(10)), 1) });
/** The content-addressed skin file: one export row and its binding (validated together by the SF9c parsers). */
export const ShardSkinFileSchema = v.strictObject({ row: v.unknown(), binding: v.unknown() });

/** A parsed skin look: the file it names and the attack span its clip was sampled with. */
export interface SkinLookParameters { skin: string; attackSpan: number }
/** Parse a `platform.skin` look row's parameters (throws on anything else). */
export function skinLookParameters(row: ShardRows['looks'][number]): SkinLookParameters {
  if (row.recipe !== SKIN_LOOK_RECIPE) throw new Error(`look ${row.id}: not a skin look`);
  if (row.animation.recipe !== SKIN_CLIPS_RECIPE) throw new Error(`look ${row.id}: a skin look animates with ${SKIN_CLIPS_RECIPE}`);
  const look = v.safeParse(SkinLookParametersSchema, row.parameters), clips = v.safeParse(SkinClipParametersSchema, row.animation.parameters);
  if (!look.success || !clips.success) throw new Error(`look ${row.id}: invalid skin parameters`);
  return { skin: look.output.skin, attackSpan: clips.output.attackSpan };
}
/** Decode and validate one skin file's bytes: its rig row and binding, the binding for that row. */
export function parseSkinFile(bytes: Uint8Array): { row: SkinRow; binding: SkinBinding } {
  const file = v.parse(ShardSkinFileSchema, JSON.parse(new TextDecoder().decode(bytes)));
  const [row] = parseSkinRows([file.row]); if (row === undefined) throw new Error('skin file: no row');
  const [binding] = parseSkinBindings([file.binding], [row]); if (binding === undefined) throw new Error('skin file: no binding');
  return { row, binding };
}
/** Shardfile reference rules for skin looks: a library `json` file whose dependencies are exactly its row's `glb`. */
export function skinLookRules(source: Pick<Shardfile, 'rows' | 'files' | 'library'>): string[] {
  const errors: string[] = [], files = new Map(source.files.map((file) => [file.hash, file]));
  for (const row of source.rows.looks) {
    if (row.recipe !== SKIN_LOOK_RECIPE) { if (row.animation.recipe === SKIN_CLIPS_RECIPE) errors.push('skin clips without a skin look'); continue; }
    let skin: string; try { skin = skinLookParameters(row).skin; } catch { errors.push('skin look parameters'); continue; }
    const file = files.get(skin), glb = file?.dependencies.length === 1 ? files.get(file.dependencies[0] ?? '') : undefined;
    if (file?.kind !== 'json' || glb?.kind !== 'glb' || !source.library.includes(skin)) errors.push('skin look file references');
  }
  return errors;
}

/** Admit each rig binding and its exact GLB dependency before allocating a client view. */
export function validateSkinAssets(source: Pick<Shardfile, 'rows' | 'files'>, assets: ReadonlyMap<string, Uint8Array>): void {
  const files = new Map(source.files.map((file) => [file.hash, file]));
  for (const look of source.rows.looks) {
    if (look.recipe !== SKIN_LOOK_RECIPE) continue;
    const skinHash = skinLookParameters(look).skin, bytes = assets.get(skinHash);
    if (bytes === undefined) throw new Error('skin file missing');
    const { row, binding } = parseSkinFile(bytes);
    if (files.get(skinHash)?.dependencies[0] !== row.file) throw new Error('skin rig dependency mismatch');
    v.parse(MaterialsSchema, { skin: binding.material });
    const glb = assets.get(row.file), declared = files.get(row.file);
    if (glb === undefined || declared === undefined) throw new Error('skin GLB missing');
    const cost = parseGlb(glb);
    cost.decoded += skinLayerDecoded(binding.poseLayers ?? {}, row.rig.joints[0]?.length ?? 0);
    for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) {
      if (cost[key] > row.cost[key] || cost[key] > declared[key]) throw new Error('skin cost understated');
    }
  }
}

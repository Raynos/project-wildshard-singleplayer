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
import { parseSkinBindings, parseSkinRows, validateCreatureBones, type SkinBinding, type SkinRow } from '@wildshard/format/skinData';
import type { ShardRows } from '@wildshard/format/rows';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { parseGlb } from '@wildshard/format/product';
import { skinLayerDecoded } from '@wildshard/format/skinLayers';
import { MaterialsSchema } from '@wildshard/format/materials';

import { SKIN_LOOK_RECIPE, SKIN_CLIPS_RECIPE, SkinLookParametersSchema, SkinClipParametersSchema, ShardSkinFileSchema, type SkinLookParameters } from '@wildshard/format/skins';

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

const glbRigSchema = v.object({
  nodes: v.array(v.object({ name: v.optional(v.string()), mesh: v.optional(v.number()), skin: v.optional(v.number()) })),
  meshes: v.array(v.object({ primitives: v.array(v.unknown()) })),
  skins: v.array(v.object({ joints: v.array(v.number()) })),
  animations: v.optional(v.array(v.object({ name: v.optional(v.string()) })), []),
});

/** Check admitted GLB joint order, sockets and clips before a renderer allocates the creature view. */
function validateRigBytes(glb: Uint8Array, row: SkinRow): void {
  // parseGlb already bounds and validates the header, JSON chunk and every node/accessor reference.
  const length = new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(12, true);
  const rig = v.parse(glbRigSchema, JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + length))));
  function fail(reason: string): never { throw new Error(`skin ${row.id}: ${reason}`); }
  const named = rig.nodes.flatMap(node => node.name === undefined ? [] : [node.name]);
  const meshes = rig.nodes.filter(node => node.skin !== undefined && node.mesh !== undefined);
  const mesh = meshes[0];
  if (meshes.length !== 1 || mesh?.mesh === undefined || mesh.skin === undefined
    || rig.meshes[mesh.mesh]?.primitives.length !== 1) fail('expected one skinned mesh');
  const joints = rig.skins[mesh.skin]?.joints.map(index => rig.nodes[index]?.name);
  const expected = row.rig.joints[0];
  if (joints === undefined || expected === undefined || joints.length !== expected.length
    || joints.some((name, index) => name !== expected[index])) fail('skin joint order differs from bake');
  for (const name of row.rig.sockets) {
    if (named.filter(actual => actual === name).length !== 1) fail(`missing or ambiguous socket ${name}`);
  }
  for (const name of row.rig.clips) {
    if (rig.animations.filter(clip => clip.name === name).length !== 1) fail(`missing or ambiguous clip ${name}`);
  }
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
    validateCreatureBones(look.species, row.rig.sockets);
    validateCreatureBones(look.species, row.rig.joints[0] ?? []);
    v.parse(MaterialsSchema, { skin: binding.material });
    const glb = assets.get(row.file), declared = files.get(row.file);
    if (glb === undefined || declared === undefined) throw new Error('skin GLB missing');
    const cost = parseGlb(glb);
    validateRigBytes(glb, row);
    cost.decoded += skinLayerDecoded(binding.poseLayers ?? {}, row.rig.joints[0]?.length ?? 0);
    for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) {
      if (cost[key] > row.cost[key] || cost[key] > declared[key]) throw new Error('skin cost understated');
    }
  }
}

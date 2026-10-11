import * as v from 'valibot';
import { SkinPoseLayerSchema, validateSkinLayers } from './skinLayers';
/** Animation clip identity; the native rig uses the same bounded family namespace. */
export type SkinClipName = `${'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'die' | 'turn' | 'swim' | 'fly'}${'' | `.${string}`}`;

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
/** Admitted clip family and optional lowercase action suffix; its transform is an identity type narrowing. */
export const SkinClipNameSchema = v.pipe(v.string(), v.regex(/^(idle|walk|run|attack|hit|die|turn|swim|fly)(\.[a-z][a-z0-9-]*)?$/u), v.transform((name) => name as SkinClipName));
const joint = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_.-]*$/u), v.maxLength(64));
const bytes = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(25_000_000));

/** One exported skin as the export half writes it (`public/assets/baked/<shard>/skins.json`): the GLB's content hash and its rig. */
export const SkinRowSchema = v.object({
  id, file: hash, family: v.picklist(['toon', 'pbr']),
  rig: v.strictObject({ skeleton: v.pipe(v.string(), v.regex(/^[a-z][A-Za-z0-9.]*$/u), v.maxLength(128)), joints: v.pipe(v.array(v.pipe(v.array(joint), v.minLength(1), v.maxLength(128))), v.length(1)), clips: v.pipe(v.array(SkinClipNameSchema), v.minLength(1), v.maxLength(32)), sockets: v.pipe(v.array(joint), v.maxLength(32)) }),
  cost: v.strictObject({ decoded: bytes, gpu: bytes, triangles: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(400_000)), draws: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(512)) }),
});
/** A validated exported skin row. */
export type SkinRow = v.InferOutput<typeof SkinRowSchema>;
/** How a skin plays and draws: the family material entry (SF10a, validated by the family registry) the clips that loop and independent numeric pose clocks. */
export const SkinBindingSchema = v.strictObject({ skin: id, material: v.record(v.string(), v.unknown()), loops: v.pipe(v.array(SkinClipNameSchema), v.maxLength(32)), poseLayers: v.exactOptional(v.record(SkinClipNameSchema, v.pipe(v.array(SkinPoseLayerSchema), v.maxLength(32)))) });
/** A validated skin binding. */
export type SkinBinding = v.InferOutput<typeof SkinBindingSchema>;

/** Every creature kind, including flying/custom rigs, exposes body and head for collision and view binding. */
export function validateCreatureBones(species: string, names: readonly string[]): void {
  for (const bone of ['body', 'head']) {
    if (!names.includes(bone)) throw new Error(`species '${species}': rig missing required bone '${bone}'`);
  }
}

/** Validate the export half's rows; unknown fields (its notes and motion receipt) are ignored. */
export function parseSkinRows(input: unknown): SkinRow[] {
  const r = v.safeParse(v.pipe(v.array(SkinRowSchema), v.maxLength(256)), input);
  if (!r.success) throw new Error(`skins: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  if (new Set(r.output.map((row) => row.id)).size !== r.output.length) throw new Error('skins: unique ids');
  return r.output;
}
/** Validate skin bindings against their rows: one per skin, loops only over the row's clips, with bounded periodic layer tables. */
export function parseSkinBindings(input: unknown, rows: readonly SkinRow[]): SkinBinding[] {
  const r = v.safeParse(v.pipe(v.array(SkinBindingSchema), v.maxLength(256)), input);
  if (!r.success) throw new Error(`skin bindings: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  for (const binding of r.output) {
    const row = rows.find((candidate) => candidate.id === binding.skin);
    if (row === undefined) throw new Error(`skin bindings: no skin ${binding.skin}`);
    if (binding.loops.some((name) => !row.rig.clips.includes(name))) throw new Error(`skin bindings: ${binding.skin} loops an unknown clip`);
    for (const [name, layers] of Object.entries(binding.poseLayers ?? {})) { if (layers === undefined) continue; if (!binding.loops.includes(name as SkinClipName)) throw new Error('skin layers require a looping base'); validateSkinLayers(layers, row.rig.joints[0] ?? []); }
  }
  if (new Set(r.output.map((binding) => binding.skin)).size !== r.output.length) throw new Error('skin bindings: one per skin');
  return r.output;
}

